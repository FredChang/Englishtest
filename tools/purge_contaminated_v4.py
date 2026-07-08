import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
PENDING_PATH = os.path.join(ROOT, "tools", "pending_grids.json")

# Grids that have been identified as contaminated in this run
CONTAMINATED_GRIDS = ["26", "27", "36", "43", "44", "46", "52", "61", "62", "63"]

def main():
    if not os.path.exists(VOCAB_PATH):
        print(f"Error: {VOCAB_PATH} not found!")
        return
    if not os.path.exists(PENDING_PATH):
        print(f"Error: {PENDING_PATH} not found!")
        return

    with open(PENDING_PATH, "r", encoding="utf-8") as f:
        pending_grids = json.load(f)

    # Gather all words from contaminated grids
    purge_words = set()
    for grid_num in CONTAMINATED_GRIDS:
        if grid_num in pending_grids:
            for item in pending_grids[grid_num]:
                purge_words.add(item["word"].lower().strip())

    print(f"Total words to purge: {len(purge_words)}")

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

    # Also delete the grid PNGs from backup data if they exist
    deleted_grids_count = 0
    for grid_num in CONTAMINATED_GRIDS:
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
