import os
import json
import sys

# Reconfigure stdout to support UTF-8 printing on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRIENDS_TXT_ROOT = os.path.join(ROOT, "friends.txt")
FRIENDS_TXT_WEB = os.path.join(ROOT, "web", "friends.txt")
GEN_FILES = [
    os.path.join(ROOT, "tools", "new_dialogues_1.txt"),
    os.path.join(ROOT, "tools", "new_dialogues_2.txt"),
    os.path.join(ROOT, "tools", "new_dialogues_3.txt")
]

def parse_scenes_from_text(text):
    raw_scenes = text.split("===")
    scenes = []
    for raw in raw_scenes:
        lines = [l.strip() for l in raw.split("\n") if l.strip()]
        if lines:
            scenes.append(lines)
    return scenes

def main():
    # 1. Read existing friends.txt scenes (15 scenes)
    if not os.path.exists(FRIENDS_TXT_ROOT):
        print(f"Error: Base friends.txt not found at {FRIENDS_TXT_ROOT}")
        return
        
    with open(FRIENDS_TXT_ROOT, "r", encoding="utf-8") as f:
        base_content = f.read()
        
    all_scenes = parse_scenes_from_text(base_content)
    print(f"Loaded {len(all_scenes)} base scenes from friends.txt.")

    # 2. Read and parse generated dialogue files
    new_scenes_count = 0
    for idx, path in enumerate(GEN_FILES):
        if not os.path.exists(path):
            print(f"Warning: Generated file {path} not found yet.")
            continue
            
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            
        scenes = parse_scenes_from_text(content)
        print(f"Loaded {len(scenes)} new scenes from new_dialogues_{idx + 1}.txt.")
        
        # Verify formatting and turn counts
        for s_idx, scene in enumerate(scenes):
            valid_scene = []
            for line in scene:
                # Sanity check: must contain " | " and a speaker name
                if " | " in line and ":" in line:
                    valid_scene.append(line)
                else:
                    # Clean english portion for safe printing
                    safe_part = line.split("|")[0].strip() if "|" in line else line
                    print(f"  Warning: Skipped line in file {idx + 1} (invalid format): '{safe_part}'")
            
            if len(valid_scene) >= 20:
                all_scenes.append(valid_scene)
                new_scenes_count += 1
            else:
                print(f"  Warning: Scene {s_idx + 1} in file {idx + 1} only has {len(valid_scene)} valid turns. Skipped.")

    print(f"Total compiled scenes: {len(all_scenes)} (Added {new_scenes_count} new scenes).")

    if len(all_scenes) < 50:
        print(f"Warning: Total scene count is {len(all_scenes)}, which is less than the target of 50.")
    else:
        print(f"Success: Reached target scene count of {len(all_scenes)} (>= 50).")

    # 3. Format output
    scenes_text = []
    for s in all_scenes:
        scenes_text.append("\n\n".join(s))
        
    final_output = "\n\n===\n\n".join(scenes_text) + "\n"

    # 4. Write back to friends.txt and web/friends.txt
    for path in [FRIENDS_TXT_ROOT, FRIENDS_TXT_WEB]:
        with open(path, "w", encoding="utf-8") as f:
            f.write(final_output)
        print(f"Successfully wrote updated content to {path}")

    # Output sentence counts for each scene
    print("\nFinal Passages Sentence Counts:")
    for i, s in enumerate(all_scenes):
        print(f"  Passage {i + 1}: {len(s)} turns")

if __name__ == "__main__":
    main()
