import os
import json
import re

NEWS_DIR = "news"
OUTPUT_FILE = os.path.join(NEWS_DIR, "index.json")

yaml_pattern = re.compile(r"^---\s*(.*?)\s*---", re.DOTALL)

def extract_yaml(md_text):
    """Extract YAML front-matter and return a dict."""
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

def main():
    entries = []

    for filename in os.listdir(NEWS_DIR):
        if not filename.endswith(".md"):
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

    # Sort newest-first by filename (YYYY-MM-DD-title.md)
    entries.sort(key=lambda x: x["file"], reverse=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)

    print(f"index.json updated with {len(entries)} entries.")

if __name__ == "__main__":
    main()
