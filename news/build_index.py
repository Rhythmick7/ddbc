import os
import json
import re
from datetime import datetime, timedelta

# -----------------------------
# CONFIG
# -----------------------------
NEWS_DIR = "news"
ALERTS_DIR = "alerts"

NEWS_INDEX = os.path.join(NEWS_DIR, "index.json")
ALERTS_INDEX = os.path.join(ALERTS_DIR, "index.json")

yaml_pattern = re.compile(r"^---\s*(.*?)\s*---", re.DOTALL)


# -----------------------------
# YAML extraction
# -----------------------------
def extract_yaml(md_text):
    match = yaml_pattern.match(md_text)
    if not match:
        return {}
    yaml_block = match.group(1)
    data = {}
    for line in yaml_block.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip()
    return data


# -----------------------------
# Helpers for NEWS filenames
# -----------------------------
def sentence_case(s):
    if not s:
        return ""
    return s[0].upper() + s[1:]


def normalise_description(name):
    name = name.replace("_", " ").replace("-", " ")
    name = " ".join(name.split())
    return sentence_case(name)


# -----------------------------
# NEWS: rename .txt → .md.txt
# -----------------------------
def rename_txt_files_news():
    today = datetime.today().strftime("%Y-%m-%d")
    txt_files = [
        f for f in os.listdir(NEWS_DIR)
        if f.lower().endswith(".txt") and not f.lower().endswith(".md.txt")
    ]

    if not txt_files:
        return False  # nothing to do

    for filename in txt_files:
        base = filename[:-4]  # remove .txt
        desc = normalise_description(base)
        desc_slug = "-".join(desc.lower().split())

        new_filename = f"{today}-{desc_slug}.md.txt"
        old_path = os.path.join(NEWS_DIR, filename)
        new_path = os.path.join(NEWS_DIR, new_filename)

        with open(old_path, "r", encoding="utf-8") as f:
            content = f.read()

        # detect YAML
        if not yaml_pattern.match(content):
            start = today
            end = (datetime.today() + timedelta(days=30)).strftime("%Y-%m-%d")

            yaml_block = (
                f"---\n"
                f"title: {desc}\n"
                f"start: {start}\n"
                f"end: {end}\n"
                f"author:\n"
                f"---\n\n"
            )
            content = yaml_block + content

        with open(new_path, "w", encoding="utf-8") as f:
            f.write(content)

        os.remove(old_path)
        print(f"Converted {filename} → {new_filename}")

    print("\nNEWS TXT files processed. Please review the new files and run the script again.")
    return True


# -----------------------------
# ALERTS: rename .txt → .md.txt
# -----------------------------
def rename_txt_files_alerts():
    today = datetime.today().strftime("%Y-%m-%d")
    txt_files = [
        f for f in os.listdir(ALERTS_DIR)
        if f.lower().endswith(".txt") and not f.lower().endswith(".md.txt")
    ]

    if not txt_files:
        return False  # nothing to do

    for filename in txt_files:
        # Alerts do NOT use title/author or slugging
        new_filename = f"{today}-{filename[:-4]}.md.txt"

        old_path = os.path.join(ALERTS_DIR, filename)
        new_path = os.path.join(ALERTS_DIR, new_filename)

        with open(old_path, "r", encoding="utf-8") as f:
            content = f.read()

        # detect YAML
        if not yaml_pattern.match(content):
            start = today
            end = (datetime.today() + timedelta(days=30)).strftime("%Y-%m-%d")

            yaml_block = (
                f"---\n"
                f"start: {start}\n"
                f"end: {end}\n"
                f"---\n\n"
            )
            content = yaml_block + content

        with open(new_path, "w", encoding="utf-8") as f:
            f.write(content)

        os.remove(old_path)
        print(f"Converted {filename} → {new_filename}")

    print("\nALERTS TXT files processed. Please review the new files and run the script again.")
    return True


# -----------------------------
# Build NEWS index
# -----------------------------
def build_news_index():
    entries = []

    for filename in os.listdir(NEWS_DIR):
        if not filename.lower().endswith(".md.txt"):
            continue

        filepath = os.path.join(NEWS_DIR, filename)

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        yaml_data = extract_yaml(content)

        entry = {
            "file": filename,
            "title": yaml_data.get("title", "(No title)"),
            "start": yaml_data.get("start", "1900-01-01"),
            "end": yaml_data.get("end", "1900-01-02"),
            "author": yaml_data.get("author", "")
        }

        entries.append(entry)

    entries.sort(key=lambda x: x["start"], reverse=True)

    with open(NEWS_INDEX, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)

    print(f"NEWS index.json updated with {len(entries)} entries.")


# -----------------------------
# Build ALERTS index
# -----------------------------
def build_alerts_index():
    entries = []

    for filename in os.listdir(ALERTS_DIR):
        if not filename.lower().endswith(".md.txt"):
            continue

        filepath = os.path.join(ALERTS_DIR, filename)

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        yaml_data = extract_yaml(content)

        entry = {
            "file": filename,
            "start": yaml_data.get("start", "1900-01-01"),
            "end": yaml_data.get("end", "1900-01-02")
        }

        entries.append(entry)

    entries.sort(key=lambda x: x["start"], reverse=True)

    with open(ALERTS_INDEX, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)

    print(f"ALERTS index.json updated with {len(entries)} entries.")


# -----------------------------
# MAIN
# -----------------------------
def main():
    if rename_txt_files_news():
        return

    if rename_txt_files_alerts():
        return

    build_news_index()
    build_alerts_index()


if __name__ == "__main__":
    main()
