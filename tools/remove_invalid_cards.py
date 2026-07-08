import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
DETECTED_PATH = os.path.join(ROOT, "tools", "detected_text_cards.json")

def main():
    if not os.path.exists(DETECTED_PATH):
        print(f"Error: {DETECTED_PATH} not found!")
        return
        
    if not os.path.exists(VOCAB_PATH):
        print(f"Error: {VOCAB_PATH} not found!")
        return

    with open(DETECTED_PATH, "r", encoding="utf-8") as f:
        detected_cards = json.load(f)
        
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    # Convert detected info to a set of words for easy lookup
    invalid_words = {card["word"].lower().strip() for card in detected_cards}
    
    print(f"Total invalid cards identified: {len(invalid_words)}")

    # 1. Delete image files
    deleted_count = 0
    for card in detected_cards:
        img_url = card["image"]
        filepath = os.path.join(ROOT, "web", img_url)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                deleted_count += 1
            except Exception as e:
                print(f"Failed to delete {filepath}: {e}")

    # 2. Re-build database excluding the invalid entries
    new_vocab = []
    for entry in vocab:
        eng_list = entry.get("English", [])
        if eng_list:
            word = eng_list[0].lower().strip()
            if word in invalid_words:
                continue
        new_vocab.append(entry)

    # Save the updated database
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(new_vocab, f, ensure_ascii=False, indent=2)

    print(f"\nRemoved {len(vocab) - len(new_vocab)} entries from image-vocab.json.")
    print(f"Deleted {deleted_count} image files from web/images/.")
    print(f"New database size: {len(new_vocab)} entries.")

if __name__ == "__main__":
    main()
