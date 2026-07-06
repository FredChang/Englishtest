import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
GRIDS_PATH = os.path.join(ROOT, "tools", "pending_grids.json")

def main():
    if not os.path.exists(GRIDS_PATH):
        print(f"Error: {GRIDS_PATH} not found!")
        return

    # 1. Load the original set of words from pending_grids.json (we want to keep the exact vocabulary set)
    with open(GRIDS_PATH, "r", encoding="utf-8") as f:
        original_grids = json.load(f)

    all_target_words = []
    # Collect all words from the original grids (we assume grid 21 to 64)
    for grid_num, items in original_grids.items():
        # Only process our target B1/B2 grids (grids 21 to 64)
        if 21 <= int(grid_num) <= 64:
            for item in items:
                all_target_words.append(item)

    print(f"Total target words in vocabulary set: {len(all_target_words)}")

    # 2. Load existing clean cards in image-vocab.json
    existing = set()
    if os.path.exists(VOCAB_PATH):
        with open(VOCAB_PATH, "r", encoding="utf-8") as f:
            for entry in json.load(f):
                eng_list = entry.get("English", [])
                if eng_list:
                    existing.add(eng_list[0].lower().strip())

    print(f"Verified clean cards in database: {len(existing)}")

    # 3. Filter out completed words to get missing words
    missing_words = []
    for item in all_target_words:
        word_lower = item["word"].lower().strip()
        if word_lower not in existing:
            missing_words.append(item)

    print(f"Remaining missing words: {len(missing_words)}")

    if not missing_words:
        print("All B1/B2 target words are already completed!")
        return

    # 4. Group the missing words into new 16-word grids starting from grid_num 21
    new_grids = {}
    num_grids = (len(missing_words) + 15) // 16
    for i in range(num_grids):
        grid_num = str(21 + i)
        start_idx = i * 16
        end_idx = start_idx + 16
        grid_words = missing_words[start_idx:end_idx]
        
        # If the last grid has less than 16 words, we pad it with empty placeholder items
        # to ensure it always has exactly 16 cells for the cropping script
        if len(grid_words) < 16:
            padding_needed = 16 - len(grid_words)
            # Use placeholder words that are easily recognizable
            for p in range(padding_needed):
                grid_words.append({
                    "level": "B1",
                    "word": f"placeholder_{p+1}",
                    "chinese": "占位符"
                })
        
        new_grids[grid_num] = grid_words

    # 5. Overwrite pending_grids.json with the consolidated grids
    with open(GRIDS_PATH, "w", encoding="utf-8") as f:
        json.dump(new_grids, f, ensure_ascii=False, indent=2)

    print(f"Consolidated missing words into {num_grids} new grids (saved to {GRIDS_PATH}).")
    print(f"New grids list to generate: {list(new_grids.keys())}")

if __name__ == "__main__":
    main()
