import os
import json
import re
from datetime import datetime, timedelta

NEWS_DIR = "news"
OUTPUT_FILE = os.path.join(NEWS_DIR, "index.json")

yaml_pattern = re.compile(r"^---\s*(.*?)\s*---", re.DOTALL)

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

def sentence_case(s):
    if not s:
        return ""
    return s[0].upper() + s[1:]

def normalise_description(name):
    name = name.replace("_", " ").replace("-", " ")
    name = " ".join(name.split())
    return sentence_case(name)

def rename_txt_files():
    today = datetime.today().strftime("%Y-%m-%d")
    txt_files = [f for f in os.listdir(NEWS_DIR) if f.endswith(".txt") and not f.endswith(".md.txt")]

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
            start = datetime.today().strftime("%Y-%m-%d")
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

    print("\nTXT files processed. Please review the new files and run the script again.")
    return True

def build_index():
    entries = []

    for filename in os.listdir(NEWS_DIR):
        if not (filename.endswith(".md.txt")):
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

    entries.sort(key=lambda x: x["file"], reverse=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)

    print(f"index.json updated with {len(entries)} entries.")

def main():
    if rename_txt_files():
        return  # stop here, user must re-run
    build_index()

if __name__ == "__main__":
    main()
