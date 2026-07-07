import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
WORDS_PATH = os.path.join(ROOT, "web", "words.json")
GRIDS_PATH = os.path.join(ROOT, "tools", "pending_grids.json")

def main():
    # 1. Load existing clean words in image-vocab.json
    existing = set()
    if os.path.exists(VOCAB_PATH):
        with open(VOCAB_PATH, "r", encoding="utf-8") as f:
            for entry in json.load(f):
                eng_list = entry.get("English", [])
                if eng_list:
                    existing.add(eng_list[0].lower().strip())

    print(f"Verified clean cards in database: {len(existing)}")

    # 2. Load all words from words.json
    if not os.path.exists(WORDS_PATH):
        print(f"Error: {WORDS_PATH} not found!")
        return

    with open(WORDS_PATH, "r", encoding="utf-8") as f:
        words_all = json.load(f)

    # 3. Filter missing A1 and A2 words
    missing_a1_a2 = []
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
        
        if level in ["A1", "A2"]:
            missing_a1_a2.append({
                "level": level,
                "word": word,
                "chinese": chinese
            })

    # Sort alphabetically by english word
    missing_a1_a2.sort(key=lambda x: x["word"].lower())
    print(f"Total missing A1/A2 words: {len(missing_a1_a2)}")

    if not missing_a1_a2:
        print("No missing A1/A2 words left!")
        return

    # 4. Select the first 256 words (16 grids)
    target_count = min(256, len(missing_a1_a2))
    selected_words = missing_a1_a2[:target_count]
    print(f"Selected {target_count} words for this batch.")

    # 5. Group into grids 21 to 36
    grids = {}
    num_grids = (len(selected_words) + 15) // 16
    for i in range(num_grids):
        grid_num = str(21 + i)
        start_idx = i * 16
        end_idx = start_idx + 16
        grid_words = selected_words[start_idx:end_idx]
        
        # Pad with placeholders if the last grid is not complete
        if len(grid_words) < 16:
            padding_needed = 16 - len(grid_words)
            for p in range(padding_needed):
                grid_words.append({
                    "level": "A1",
                    "word": f"placeholder_{p+1}",
                    "chinese": "占位符"
                })
        
        grids[grid_num] = grid_words

    # 6. Overwrite pending_grids.json
    with open(GRIDS_PATH, "w", encoding="utf-8") as f:
        json.dump(grids, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {num_grids} grids in {GRIDS_PATH}.")
    print(f"Grids list to generate: {list(grids.keys())}")

if __name__ == "__main__":
    main()
