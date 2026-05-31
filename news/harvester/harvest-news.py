import imaplib
import email
import json
import os
import pathlib
import html
from datetime import datetime
from winotify import Notification

# -----------------------------
# Logging setup
# -----------------------------
BASE_DIR = pathlib.Path(__file__).parent
LOG_PATH = BASE_DIR / "harvester.log"

def log(msg):
    """Append a timestamped line to harvester.log, with rotation."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}\n"

    # Rotate log if > 1 MB
    if LOG_PATH.exists() and LOG_PATH.stat().st_size > 1_000_000:
        LOG_PATH.rename(LOG_PATH.with_suffix(".log.bak"))

    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line)

# -----------------------------
# Load config (relative to script)
# -----------------------------
CONFIG_PATH = BASE_DIR / "config.json"

with open(CONFIG_PATH, "r") as f:
    cfg = json.load(f)

EMAIL = cfg["email"]
APP_PASSWORD = cfg["app_password"]
TARGET_FOLDER = cfg["target_folder"]
SUBJECT_FILTER = cfg["subject_filter"]
NOTIFICATION_TEXT = cfg["notification_text"]
FILENAME_MARKER = cfg["filename_marker"]

os.makedirs(TARGET_FOLDER, exist_ok=True)

# -----------------------------
# Windows notification helper
# -----------------------------
def notify_new_items(count):
    toast = Notification(
        app_id="DDBC News Harvester",
        title="DDBC News",
        msg=f"{count} {NOTIFICATION_TEXT}"
    )
    toast.show()

# -----------------------------
# Start log entry
# -----------------------------
log("----- Harvester run started -----")

try:
    # -----------------------------
    # Connect to Gmail IMAP
    # -----------------------------
    log("Connecting to Gmail IMAP...")
    imap = imaplib.IMAP4_SSL("imap.gmail.com")
    imap.login(EMAIL, APP_PASSWORD)
    imap.select("INBOX")
    log("IMAP login successful.")

    # -----------------------------
    # Search for Formspree emails
    # -----------------------------
    status, messages = imap.search(
        None,
        f'(SUBJECT "{SUBJECT_FILTER}")'
    )

    if status != "OK":
        log("IMAP search failed.")
        raise RuntimeError("IMAP search failed")

    msg_ids = messages[0].split()
    log(f"Found {len(msg_ids)} matching emails.")

    new_items = 0

    # -----------------------------
    # Process each matching email
    # -----------------------------
    for msg_id in msg_ids:
        log(f"Processing email ID {msg_id.decode()}...")

        status, msg_data = imap.fetch(msg_id, "(RFC822)")
        if status != "OK":
            log("Failed to fetch email.")
            continue

        msg = email.message_from_bytes(msg_data[0][1])

        # Extract LAST text/plain part
        body = None
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode(errors="ignore")
        else:
            body = msg.get_payload(decode=True).decode(errors="ignore")

        if not body:
            log("No usable text/plain part found.")
            continue

        lines = body.splitlines()

        # -----------------------------
        # Find ALL divider indices
        # -----------------------------
        divider_indices = [
            i for i, line in enumerate(lines)
            if "COPY EVERYTHING BELOW THIS LINE" in line
        ]

        log(f"Found {len(divider_indices)} payload blocks in this email.")

        if not divider_indices:
            continue

        # -----------------------------
        # Process each payload block
        # -----------------------------
        for div_index in divider_indices:
            payload_lines = lines[div_index+1:]

            # Extract filename
            filename = None
            for line in payload_lines:
                if line.startswith(FILENAME_MARKER):
                    filename = line.replace(FILENAME_MARKER, "").strip()
                    break

            if not filename:
                log("Filename not found in payload block.")
                continue

            full_path = os.path.join(TARGET_FOLDER, filename)

            if os.path.exists(full_path):
                log(f"Skipping duplicate: {filename}")
                continue

            # Extract YAML
            yaml_start = None
            yaml_end = None

            for i, line in enumerate(payload_lines):
                if line.strip() == "---":
                    if yaml_start is None:
                        yaml_start = i
                    elif yaml_end is None:
                        yaml_end = i
                        break

            if yaml_start is None or yaml_end is None:
                log(f"YAML not found in {filename}")
                continue

            yaml_lines = payload_lines[yaml_start:yaml_end+1]

            yaml_clean = []
            for line in yaml_lines:
                if line.strip() == "---":
                    yaml_clean.append(line)
                elif line.strip() != "":
                    yaml_clean.append(line)

            # Extract content
            content_lines = []
            for line in payload_lines[yaml_end+1:]:
                stripped = line.strip()
                if "This form was submitted" in stripped or stripped.startswith("Submitted"):
                    break
                content_lines.append(line)

            content_lines = [html.unescape(line) for line in content_lines]

            clean_content = []
            blank = False
            for line in content_lines:
                if line.strip() == "":
                    if not blank:
                        clean_content.append("")
                    blank = True
                else:
                    clean_content.append(line)
                    blank = False

            final_payload = (
                "\n".join(yaml_clean).strip()
                + "\n\n"
                + "\n".join(clean_content).strip()
                + "\n"
            )

            # -----------------------------
            # Write file (INSIDE the loop!)
            # -----------------------------
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(final_payload)

            log(f"Created: {filename}")
            new_items += 1

        # -----------------------------
        # Move email to Processed-News
        # -----------------------------
        imap.copy(msg_id, "Processed-News")
        imap.store(msg_id, "+FLAGS", "\\Deleted")

    # Notify if needed
    if new_items > 0:
        notify_new_items(new_items)
        log(f"Notification sent: {new_items} new items.")
    else:
        log("No new items to notify.")

    # Finalise moves
    imap.expunge()

    imap.close()
    imap.logout()

except Exception as e:
    log(f"ERROR: {e}")

log("----- Harvester run finished -----\n")
