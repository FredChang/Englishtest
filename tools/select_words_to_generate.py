import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
WORDS_PATH = os.path.join(ROOT, "web", "words.json")
GRIDS_PATH = os.path.join(ROOT, "tools", "pending_grids.json")

def main():
    # 1. Load existing words in database
    existing = set()
    if os.path.exists(VOCAB_PATH):
        with open(VOCAB_PATH, "r", encoding="utf-8") as f:
            for entry in json.load(f):
                eng_list = entry.get("English", [])
                if eng_list:
                    existing.add(eng_list[0].lower().strip())

    # 2. Load all words from dictionary
    if not os.path.exists(WORDS_PATH):
        print(f"Error: {WORDS_PATH} not found!")
        return

    with open(WORDS_PATH, "r", encoding="utf-8") as f:
        words_all = json.load(f)

    # Filter B1 and B2 words that lack images
    b2_missing = []
    b1_missing = []

    for item in words_all:
        eng_list = item.get("English", [])
        if not eng_list:
            continue
        word = eng_list[0].strip()
        word_lower = word.lower()
        if word_lower in existing:
            continue
            
        level = item.get("Level", "")
        chinese = item.get("Chinese", "")
        
        word_info = {
            "level": level,
            "word": word,
            "chinese": chinese
        }
        
        if level == "B2":
            b2_missing.append(word_info)
        elif level == "B1":
            b1_missing.append(word_info)

    # Sort each list alphabetically by the english word
    b2_missing.sort(key=lambda x: x["word"].lower())
    b1_missing.sort(key=lambda x: x["word"].lower())

    # We need exactly 496 words: all 299 B2 words + 197 B1 words
    selected_b2 = b2_missing
    selected_b1 = b1_missing[:197]

    selected_words = selected_b2 + selected_b1
    # Sort the combined selection alphabetically by word
    selected_words.sort(key=lambda x: x["word"].lower())

    print(f"Selected {len(selected_b2)} B2 words and {len(selected_b1)} B1 words.")
    print(f"Total selected: {len(selected_words)} (target is 496)")

    # Group into 31 grids (numbered 21 to 51) of 16 words each
    grids = {}
    for i in range(31):
        grid_num = str(21 + i)
        start_idx = i * 16
        end_idx = start_idx + 16
        grids[grid_num] = selected_words[start_idx:end_idx]

    os.makedirs(os.path.dirname(GRIDS_PATH), exist_ok=True)
    with open(GRIDS_PATH, "w", encoding="utf-8") as f:
        json.dump(grids, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {GRIDS_PATH}")

if __name__ == "__main__":
    main()
