import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS_PATH = os.path.join(ROOT, "words.json")
WEB_WORDS_PATH = os.path.join(ROOT, "web", "words.json")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
PENDING_PATH = os.path.join(ROOT, "tools", "pending_grids.json")

# 12 items to remove completely from image-vocab.json and web/images/
PHRASES_TO_REMOVE = [
    "save energy",
    "weather pattern",
    "displaced person",
    "power source",
    "too much",
    "a little",
    "hypothesis test",
    "state clearly",
    "summarize broadly",
    "clear up",
    "stand for",
    "5G"
]

def clean_words_list(filepath):
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found.")
        return False
        
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    new_data = []
    
    # We will build maps to easily find and merge/delete items
    # Key is (level, clean_word)
    by_key = {}
    
    # First pass: identify duplicates, numbered words to rename/merge
    # The numbered word mapping rules:
    # - can1 (A1) -> rename to can (A1)
    # - can2 (A2) -> merge with can (A2)
    # - close1 (A1) -> delete (dup of close A1)
    # - close2 (A2) -> rename to close (A2)
    # - do1 (A1) -> delete (dup of do A1)
    # - lie1 (A1) -> delete (dup of lie A1)
    # - live1 (A1) -> delete (dup of live A1)
    # - long1 (A1) -> delete (dup of long A1)
    # - minute1 (A1) -> delete (dup of minute A1)
    # - lead1 (A2) -> rename to lead (A2)
    # - refuse1 (A2) -> rename to refuse (A2)
    # - ring1 (A2), ring2 (A2) -> merge to ring (A2, "戒指 / 按鈴")
    # - wind1 (A2) -> rename to wind (A2)
    # - content1 (B1) -> delete (dup of content B1)
    # - live2 (B1) -> rename to live (B1)
    # - plus1 (B1) -> merge with plus (B1, "加") to "加 / 加上"
    # - row1 (B1) -> delete (dup of row B1)
    # - used1 (B1), used2 (B1) -> merge to used (B1, "習慣的 / 用過的")
    
    deleted_words = set()
    renamed_words = {}
    merged_chinese = {} # key is (level, word) -> new_chinese
    
    # Set up explicitly what to do
    to_delete = {
        ("A1", "close1"),
        ("A1", "do1"),
        ("A1", "lie1"),
        ("A1", "live1"),
        ("A1", "long1"),
        ("A1", "minute1"),
        ("B1", "content1"),
        ("B1", "row1")
    }
    
    to_rename = {
        ("A1", "can1"): "can",
        ("A2", "close2"): "close",
        ("A2", "lead1"): "lead",
        ("A2", "refuse1"): "refuse",
        ("A2", "wind1"): "wind",
        ("B1", "live2"): "live"
    }
    
    # We will handle merges explicitly
    # 1. can2 (A2) + can (A2) -> can (A2, "可以 / 罐頭")
    # 2. ring1 (A2) + ring2 (A2) -> ring (A2, "戒指 / 按鈴")
    # 3. plus1 (B1) + plus (B1) -> plus (B1, "加 / 加上")
    # 4. used1 (B1) + used2 (B1) -> used (B1, "習慣的 / 用過的")
    
    merges_to_handle = [
        ("A2", "can2", "can", "可以 / 罐頭"),
        ("A2", "ring1", "ring", "戒指 / 按鈴"),
        ("A2", "ring2", "ring", "戒指 / 按鈴"),
        ("B1", "plus1", "plus", "加 / 加上"),
        ("B1", "used1", "used", "習慣的 / 用過的"),
        ("B1", "used2", "used", "習慣的 / 用過的")
    ]
    
    for level, from_w, to_w, chi in merges_to_handle:
        deleted_words.add((level, from_w))
        merged_chinese[(level, to_w)] = chi

    for item in data:
        level = item.get("Level", "")
        english = item.get("English", [])
        if not english:
            continue
        primary = english[0].strip()
        primary_lower = primary.lower()
        
        # Remove if contains space or is 5G
        if " " in primary or primary_lower == "5g" or (level, primary_lower) in deleted_words or (level, primary_lower) in to_delete:
            print(f"Removing entry from {os.path.basename(filepath)}: {primary} ({level})")
            continue
            
        # Rename if requested
        if (level, primary_lower) in to_rename:
            new_name = to_rename[(level, primary_lower)]
            print(f"Renaming entry in {os.path.basename(filepath)}: {primary} -> {new_name} ({level})")
            item["English"] = [new_name]
            primary_lower = new_name
            
        # Update Chinese if merged
        if (level, primary_lower) in merged_chinese:
            item["Chinese"] = merged_chinese[(level, primary_lower)]
            
        new_data.append(item)
        
    # Write back clean list
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        
    print(f"Cleaned {filepath}. Total entries: {len(new_data)}")
    return True

def clean_image_vocab():
    if not os.path.exists(VOCAB_PATH):
        print(f"Error: {VOCAB_PATH} not found.")
        return
        
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)
        
    new_vocab = []
    deleted_images_count = 0
    
    phrases_lower = {p.lower() for p in PHRASES_TO_REMOVE}
    
    for entry in vocab:
        eng_list = entry.get("English", [])
        if not eng_list:
            continue
        word = eng_list[0].lower().strip()
        
        if word in phrases_lower:
            print(f"Removing phrase from image-vocab.json: {word}")
            # Delete image file
            img_url = entry.get("ImageUrl")
            if img_url:
                img_path = os.path.join(ROOT, "web", img_url)
                if os.path.exists(img_path):
                    try:
                        os.remove(img_path)
                        deleted_images_count += 1
                    except Exception as e:
                        print(f"Failed to delete image {img_path}: {e}")
            continue
            
        new_vocab.append(entry)
        
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(new_vocab, f, ensure_ascii=False, indent=2)
        
    print(f"Cleaned image-vocab.json. Total entries: {len(new_vocab)}. Deleted images: {deleted_images_count}")

def clean_pending_grids():
    if not os.path.exists(PENDING_PATH):
        print(f"Error: {PENDING_PATH} not found.")
        return
        
    with open(PENDING_PATH, "r", encoding="utf-8") as f:
        grids = json.load(f)
        
    # Since 5G is in Grid 21, and we want to remove 5G, let's see if 5G is in Grid 21
    # If 5G is in Grid 21, let's replace it with another B1 word that is missing, or just remove it.
    # Wait, Grid 21 has already been generated and processed. Since we are removing 5G, we can just remove it from pending_grids as well to be clean.
    # Note that removing it from Grid 21 doesn't affect crop_pending_grids if we don't re-crop Grid 21. But we deleted b1-5g.jpg anyway.
    modified = False
    for grid_num, words_list in grids.items():
        new_list = []
        for item in words_list:
            w = item["word"].lower().strip()
            if w == "5g" or w in PHRASES_TO_REMOVE:
                print(f"Removing {item['word']} from Grid {grid_num} in pending_grids.json")
                modified = True
                continue
            new_list.append(item)
        grids[grid_num] = new_list
        
    if modified:
        with open(PENDING_PATH, "w", encoding="utf-8") as f:
            json.dump(grids, f, ensure_ascii=False, indent=2)
        print("Updated pending_grids.json")

def main():
    clean_words_list(WORDS_PATH)
    clean_words_list(WEB_WORDS_PATH)
    clean_image_vocab()
    clean_pending_grids()

if __name__ == "__main__":
    main()
