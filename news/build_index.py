import os
import json
import shutil

NEWS_DIR = "news"
UNPUBLISHED = os.path.join(NEWS_DIR, "to-be-published")
PUBLISHED = os.path.join(NEWS_DIR, "published")
INDEX_FILE = os.path.join(NEWS_DIR, "index.json")

def extract_yaml_and_body(text):
    if text.startswith("---"):
        parts = text.split("---", 2)
        yaml_block = parts[1].strip()
        body = parts[2].strip()
        return yaml_block, body
    return None, text

def parse_yaml(yaml_block):
    data = {}
    for line in yaml_block.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip()
    return data

# 1. Process unpublished .txt files
for filename in os.listdir(UNPUBLISHED):
    if filename.endswith(".txt"):
        src_path = os.path.join(UNPUBLISHED, filename)

        with open(src_path, "r", encoding="utf-8") as f:
            content = f.read()

        yaml_block, body = extract_yaml_and_body(content)
        meta = parse_yaml(yaml_block)

        # Build final filename
        final_name = f"{meta['start']}-{meta['title']}.md.txt"
        dest_path = os.path.join(PUBLISHED, final_name)

        # Write published file
        with open(dest_path, "w", encoding="utf-8") as f:
            f.write(content)

        # Remove original
        os.remove(src_path)
        print(f"Published: {final_name}")

# 2. Build index.json from published files
items = []

for filename in os.listdir(PUBLISHED):
    if filename.endswith(".md.txt"):
        path = os.path.join(PUBLISHED, filename)

        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        yaml_block, body = extract_yaml_and_body(content)
        meta = parse_yaml(yaml_block)

        items.append({
            "file": filename,
            "title": meta.get("title", ""),
            "start": meta.get("start", ""),
            "end": meta.get("end", ""),
            "author": meta.get("author", "")
        })

# Sort newest first
items.sort(key=lambda x: x["start"], reverse=True)

# Write index.json
with open(INDEX_FILE, "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2)

print("index.json updated.")
