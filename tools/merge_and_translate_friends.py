import os
import json
import shutil
import re
import sys

# Reconfigure stdout to support UTF-8 printing on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_ZH_PATH = os.path.join(ROOT, "friends_zh.json")
TOOLS_ZH_PATH = os.path.join(ROOT, "tools", "friends_zh.json")
FRIENDS_TXT_ROOT = os.path.join(ROOT, "friends.txt")
FRIENDS_TXT_WEB = os.path.join(ROOT, "web", "friends.txt")

SPEAKER_MAP = {
    "monica": "莫妮卡",
    "joey": "喬伊",
    "chandler": "錢德勒",
    "phoebe": "菲比",
    "ross": "羅斯",
    "rachel": "瑞秋",
    "director": "導演",
    "gary": "蓋瑞",
    "fireman": "消防員",
    "mike": "麥克"
}

def clean_english_line(line):
    trimmed = line.strip()
    if " | " in trimmed:
        return trimmed.split(" | ")[0].strip()
    return trimmed

def clean_duplicate_prefix(zh):
    # e.g., "莫妮卡：莫妮卡：..." -> "莫妮卡：..."
    for eng, chi in SPEAKER_MAP.items():
        prefix = f"{chi}："
        if zh.startswith(prefix + prefix) or zh.startswith(prefix + " " + prefix):
            zh = zh.replace(prefix, "", 1).strip()
    return zh

def main():
    # 1. Sync friends_zh.json from root to tools
    if os.path.exists(ROOT_ZH_PATH):
        print(f"Syncing {ROOT_ZH_PATH} to {TOOLS_ZH_PATH}...")
        shutil.copyfile(ROOT_ZH_PATH, TOOLS_ZH_PATH)
    else:
        print("Warning: Root friends_zh.json not found!")

    # 2. Load complete friends_zh.json translations
    if not os.path.exists(TOOLS_ZH_PATH):
        print("Error: Complete translations file not found!")
        return
        
    with open(TOOLS_ZH_PATH, "r", encoding="utf-8") as f:
        translations = json.load(f)
        
    zh_map = {}
    for item in translations:
        en_key = item["en"].strip().lower()
        zh_map[en_key] = item["zh"].strip()

    # 3. Read original friends.txt
    if not os.path.exists(FRIENDS_TXT_ROOT):
        print("Error: friends.txt not found!")
        return
        
    with open(FRIENDS_TXT_ROOT, "r", encoding="utf-8") as f:
        content = f.read()

    # Split into original scenes by "==="
    raw_scenes = content.split("===")
    scenes = []
    
    for raw_scene in raw_scenes:
        # Extract dialogue lines from this scene
        lines = [l.strip() for l in raw_scene.split("\n") if l.strip()]
        if not lines:
            continue
            
        bilingual_lines = []
        for line in lines:
            en = clean_english_line(line)
            
            # Step 1: Direct lookup
            zh = zh_map.get(en.lower())
            
            # Step 2: Fallback lookup without speaker prefix
            if not zh:
                match = re.match(r"^([A-Za-z]+)\s*:\s*(.*)$", en)
                if match:
                    speaker_en = match.group(1).lower()
                    text_en = match.group(2).strip()
                    zh_fallback = zh_map.get(text_en.lower())
                    if zh_fallback:
                        speaker_zh = SPEAKER_MAP.get(speaker_en, match.group(1))
                        zh = f"{speaker_zh}：{zh_fallback}"
                        print(f"Smart Match (No Prefix): '{en}'")
            
            if zh:
                zh = clean_duplicate_prefix(zh)
                bilingual_lines.append(f"{en} | {zh}")
            else:
                print(f"Warning: Missing translation for: {en}")
                bilingual_lines.append(line)
                
        scenes.append(bilingual_lines)

    print(f"Parsed {len(scenes)} original scenes.")

    # 4. Merge scenes so that each merged scene has >= 20 sentences/lines
    merged_scenes = []
    current_merged = []
    current_count = 0
    
    for scene in scenes:
        current_merged.extend(scene)
        current_count += len(scene)
        
        # If we have at least 20 sentences, finalize this merged scene
        if current_count >= 20:
            merged_scenes.append(current_merged)
            current_merged = []
            current_count = 0
            
    # Append any leftover scene turns to the last merged scene if any
    if current_merged:
        if merged_scenes:
            merged_scenes[-1].extend(current_merged)
        else:
            merged_scenes.append(current_merged)

    print(f"Created {len(merged_scenes)} merged passages with the following sentence counts:")
    for idx, s in enumerate(merged_scenes):
        print(f"  Passage {idx + 1}: {len(s)} sentences")

    # 5. Reconstruct final file content with double newlines between turns and "===" between scenes
    scenes_text = []
    for s in merged_scenes:
        scenes_text.append("\n\n".join(s))
        
    final_output = "\n\n===\n\n".join(scenes_text) + "\n"

    # Write back to friends.txt and web/friends.txt
    for path in [FRIENDS_TXT_ROOT, FRIENDS_TXT_WEB]:
        with open(path, "w", encoding="utf-8") as f:
            f.write(final_output)
        print(f"Successfully wrote updated content to {path}")

if __name__ == "__main__":
    main()
