# -*- coding: utf-8 -*-
import os
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS_PATH = os.path.join(ROOT, "words.json")
WEB_WORDS_PATH = os.path.join(ROOT, "web", "words.json")

def verify_file(path):
    print(f"Verifying file: {path}")
    if not os.path.exists(path):
        print(f"  Error: File does not exist: {path}")
        return False

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  Error: Failed to parse JSON: {e}")
        return False

    if not isinstance(data, list):
        print("  Error: Root element is not a list.")
        return False

    print(f"  Total entries: {len(data)}")

    seen = set()
    levels_set = {'A1', 'A2', 'B1', 'B2', 'C1', 'C2'}
    errors = 0

    for idx, item in enumerate(data):
        # 1. Check schema keys
        if not isinstance(item, dict):
            print(f"  Error: Item at index {idx} is not a dictionary.")
            errors += 1
            continue
        
        # 2. Check Level
        level = item.get("Level")
        if level not in levels_set:
            print(f"  Error: Invalid level '{level}' at index {idx} (word: {item.get('English')})")
            errors += 1
        
        # 3. Check Chinese
        chinese = item.get("Chinese")
        if not chinese or not isinstance(chinese, str) or not chinese.strip():
            print(f"  Error: Missing or invalid Chinese at index {idx} (word: {item.get('English')})")
            errors += 1

        # 4. Check English
        english = item.get("English")
        if not english or not isinstance(english, list) or len(english) == 0:
            print(f"  Error: Missing or invalid English list at index {idx}")
            errors += 1
        else:
            for eng in english:
                if not eng or not isinstance(eng, str) or not eng.strip():
                    print(f"  Error: Invalid English item '{eng}' in list at index {idx}")
                    errors += 1
                
                # Check for duplicates (same level + word spelling)
                word_key = (level, eng.strip().lower())
                if word_key in seen:
                    print(f"  Warning: Duplicate entry for level {level} and word '{eng.strip()}' at index {idx}")
                    # We treat duplicates as errors to ensure database cleaness
                    errors += 1
                else:
                    seen.add(word_key)

    if errors > 0:
        print(f"  Verification failed with {errors} errors.")
        return False
    else:
        print("  Verification passed successfully! No errors found.")
        return True

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    success = True
    success &= verify_file(WORDS_PATH)
    success &= verify_file(WEB_WORDS_PATH)

    # Check that they are identical
    if success:
        with open(WORDS_PATH, "r", encoding="utf-8") as f1:
            w1 = f1.read()
        with open(WEB_WORDS_PATH, "r", encoding="utf-8") as f2:
            w2 = f2.read()
        if w1 != w2:
            print("  Error: words.json and web/words.json are not identical!")
            success = False
        else:
            print("  Success: words.json and web/words.json are completely identical.")

    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
