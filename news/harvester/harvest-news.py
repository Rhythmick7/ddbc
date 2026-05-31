import imaplib
import email
import json
import os
import pathlib
import html
from winotify import Notification

# -----------------------------
# Load config (relative to script)
# -----------------------------
BASE_DIR = pathlib.Path(__file__).parent
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
# Connect to Gmail IMAP
# -----------------------------
imap = imaplib.IMAP4_SSL("imap.gmail.com")
imap.login(EMAIL, APP_PASSWORD)
imap.select("INBOX")

# -----------------------------
# Search for unread Formspree emails
# -----------------------------
status, messages = imap.search(
    None,
    f'(UNSEEN SUBJECT "{SUBJECT_FILTER}")'
)

if status != "OK":
    print("IMAP search failed")
    exit()

msg_ids = messages[0].split()
new_items = 0

# -----------------------------
# Process each matching email
# -----------------------------
for msg_id in msg_ids:
    status, msg_data = imap.fetch(msg_id, "(RFC822)")
    if status != "OK":
        continue

    msg = email.message_from_bytes(msg_data[0][1])

    # Extract LAST text/plain part (Gmail threads prepend older messages)
    body = None
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_payload(decode=True).decode(errors="ignore")
    else:
        body = msg.get_payload(decode=True).decode(errors="ignore")

    if not body:
        print("No usable text/plain part found")
        continue

    lines = body.splitlines()

    # -----------------------------
    # Find ALL divider indices
    # -----------------------------
    divider_indices = [
        i for i, line in enumerate(lines)
        if "COPY EVERYTHING BELOW THIS LINE" in line
    ]

    if not divider_indices:
        print("No payload blocks found")
        continue

    # -----------------------------
    # Process each payload block independently
    # -----------------------------
    for div_index in divider_indices:
        payload_lines = lines[div_index+1:]

        # -----------------------------
        # Extract filename
        # -----------------------------
        filename = None
        for line in payload_lines:
            if line.startswith(FILENAME_MARKER):
                filename = line.replace(FILENAME_MARKER, "").strip()
                break

        if not filename:
            print("Could not find filename in payload block")
            continue

        full_path = os.path.join(TARGET_FOLDER, filename)

        # Skip duplicates
        if os.path.exists(full_path):
            print(f"Skipping duplicate: {filename}")
            continue

        # -----------------------------
        # Extract YAML start/end
        # -----------------------------
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
            print(f"YAML not found in {filename}")
            continue

        yaml_lines = payload_lines[yaml_start:yaml_end+1]

        # Remove blank lines inside YAML
        yaml_clean = []
        for line in yaml_lines:
            if line.strip() == "---":
                yaml_clean.append(line)
            elif line.strip() != "":
                yaml_clean.append(line)

        # -----------------------------
        # Extract content until submission timestamp
        # -----------------------------
        content_lines = []
        for line in payload_lines[yaml_end+1:]:
            stripped = line.strip()

            # Robust match for all Formspree variants
            if "This form was submitted" in stripped or stripped.startswith("Submitted"):
                break

            content_lines.append(line)

        # Decode HTML entities
        content_lines = [html.unescape(line) for line in content_lines]

        # Collapse multiple blank lines
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

        # -----------------------------
        # Combine YAML + content
        # -----------------------------
        final_payload = (
            "\n".join(yaml_clean).strip()
            + "\n\n"
            + "\n".join(clean_content).strip()
            + "\n"
        )

        # -----------------------------
        # Write output file
        # -----------------------------
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(final_payload)

        new_items += 1

    # Mark email as read
    imap.store(msg_id, "+FLAGS", "\\Seen")

# -----------------------------
# Notify user if new items found
# -----------------------------
if new_items > 0:
    notify_new_items(new_items)

imap.close()
imap.logout()
