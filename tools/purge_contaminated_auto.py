import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
PENDING_PATH = os.path.join(ROOT, "tools", "pending_grids.json")
DETECTED_PATH = os.path.join(ROOT, "tools", "detected_text_cards_v2.json")

def main():
    if not os.path.exists(VOCAB_PATH):
        print(f"Error: {VOCAB_PATH} not found!")
        return
    if not os.path.exists(PENDING_PATH):
        print(f"Error: {PENDING_PATH} not found!")
        return
    if not os.path.exists(DETECTED_PATH):
        print(f"Error: {DETECTED_PATH} not found. No contamination detected.")
        return

    # Load pending grids mapping
    with open(PENDING_PATH, "r", encoding="utf-8") as f:
        pending_grids = json.load(f)

    # Map each word to its grid number
    word_to_grid = {}
    for grid_num, items in pending_grids.items():
        for item in items:
            word_to_grid[item["word"].lower().strip()] = grid_num

    # Load OCR detected text cards
    with open(DETECTED_PATH, "r", encoding="utf-8") as f:
        detected_items = json.load(f)

    # Determine contaminated grids
    contaminated_grids = set()
    for item in detected_items:
        word = item.get("word", "").lower().strip()
        grid_num = word_to_grid.get(word)
        if grid_num:
            contaminated_grids.add(grid_num)
        else:
            # If it's a legacy or unmapped card, we can purge it individually or skip
            print(f"Warning: Word '{word}' is detected with text but has no mapped grid. Skipping grid purge for it.")

    if not contaminated_grids:
        print("No contaminated grids found in this OCR scan.")
        return

    print(f"Contaminated grids identified for PNG cleanup: {list(contaminated_grids)}")

    # Gather only the specific contaminated words
    purge_words = set()
    for item in detected_items:
        word = item.get("word", "").lower().strip()
        if word:
            purge_words.add(word)

    print(f"Total words to purge from database: {len(purge_words)}")

    # Load vocab database
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    new_vocab = []
    purged_entries = []
    deleted_images_count = 0

    for entry in vocab:
        eng_list = entry.get("English", [])
        should_purge = False
        if eng_list:
            word = eng_list[0].lower().strip()
            if word in purge_words:
                should_purge = True
        
        if should_purge:
            purged_entries.append(entry)
            # Delete the image file
            img_url = entry.get("ImageUrl")
            if img_url:
                img_path = os.path.join(ROOT, "web", img_url)
                if os.path.exists(img_path):
                    try:
                        os.remove(img_path)
                        deleted_images_count += 1
                    except Exception as e:
                        print(f"Failed to delete {img_path}: {e}")
        else:
            new_vocab.append(entry)

    # Save updated database
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(new_vocab, f, ensure_ascii=False, indent=2)

    print(f"Purged {len(purged_entries)} entries from image-vocab.json.")
    print(f"Deleted {deleted_images_count} image files from web/images/.")
    print(f"New database size: {len(new_vocab)} entries.")

    # Delete the grid PNGs from backup data
    deleted_grids_count = 0
    for grid_num in contaminated_grids:
        grid_path = os.path.join(ROOT, "backup data", f"grid_{grid_num}.png")
        if os.path.exists(grid_path):
            try:
                os.remove(grid_path)
                deleted_grids_count += 1
            except Exception as e:
                print(f"Failed to delete grid PNG {grid_path}: {e}")
                
    print(f"Deleted {deleted_grids_count} grid sheet PNGs from backup data/.")

if __name__ == "__main__":
    main()
