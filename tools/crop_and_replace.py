import os
import json
import re
from PIL import Image
import numpy as np

ROOT = r"c:\Users\aggyy\source\repos\Englishtest"
BACKUP_DIR = os.path.join(ROOT, "backup data")
IMAGE_DIR = os.path.join(ROOT, "web", "images")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")

# Database paths to search for phonetics / translations
DB_PATHS = [
    os.path.join(ROOT, "web", "image-vocab.json"),
    os.path.join(ROOT, "web", "words.json"),
    os.path.join(ROOT, "words.json"),
    os.path.join(ROOT, "backup data", "words_5000.json"),
    os.path.join(ROOT, "backup data", "words_9279.json"),
    os.path.join(ROOT, "backup data", "words_all_11282.json")
]

# Load resolved words info
with open(os.path.join(ROOT, "tools", "resolved_words.json"), "r", encoding="utf-8") as f:
    resolved_words = json.load(f)

# Build a database of existing entries to look up phonetic and other fields
db_entries = {}
for path in DB_PATHS:
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            for item in data:
                english_list = item.get("English", [])
                if isinstance(english_list, str):
                    english_list = [english_list]
                for eng in english_list:
                    eng_lower = eng.strip().lower()
                    if eng_lower not in db_entries:
                        db_entries[eng_lower] = []
                    db_entries[eng_lower].append(item)
        except Exception as e:
            print(f"Error loading {path}: {e}")

def get_phonetic(word):
    entries = db_entries.get(word.lower().strip(), [])
    for entry in entries:
        if "Phonetic" in entry and entry["Phonetic"]:
            return entry["Phonetic"]
    return ""

# Perform cropping and updates
new_entries = []

for filename, words_list in resolved_words.items():
    image_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(image_path):
        print(f"Error: Source image not found at {image_path}")
        continue
        
    print(f"\nProcessing {filename}...")
    img = Image.open(image_path)
    w, h = img.size
    
    # Get overall bounding box of non-white pixels (the grid region)
    arr = np.array(img.convert('L'))
    non_white = np.where(arr < 250)
    
    if len(non_white[0]) == 0:
        print(f"Error: No non-white content detected in {filename}")
        continue
        
    min_y, max_y = non_white[0].min(), non_white[0].max()
    min_x, max_x = non_white[1].min(), non_white[1].max()
    
    print(f"  Content Bounding Box: X {min_x} to {max_x}, Y {min_y} to {max_y}")
    
    W = max_x - min_x
    H = max_y - min_y
    grid_size = (4, 4)
    cell_w = W / grid_size[1]
    cell_h = H / grid_size[0]
    
    for idx, word_info in enumerate(words_list):
        word = word_info["word"]
        level = word_info["level"]
        chinese = word_info["chinese"]
        
        # Calculate grid position
        row = idx // grid_size[1]
        col = idx % grid_size[1]
        
        # Determine rough cell boundaries based on the content box
        left_rough = int(min_x + col * cell_w)
        right_rough = int(min_x + (col + 1) * cell_w)
        top_rough = int(min_y + row * cell_h)
        bottom_rough = int(min_y + (row + 1) * cell_h)
        
        # Find the exact bounding box of the icon inside this rough cell
        cell_arr = arr[top_rough:bottom_rough, left_rough:right_rough]
        cell_non_white = np.where(cell_arr < 250)
        
        if len(cell_non_white[0]) > 0:
            icon_min_x = left_rough + cell_non_white[1].min()
            icon_max_x = left_rough + cell_non_white[1].max()
            icon_min_y = top_rough + cell_non_white[0].min()
            icon_max_y = top_rough + cell_non_white[0].max()
            
            # Center of the icon
            cx = (icon_min_x + icon_max_x) / 2.0
            cy = (icon_min_y + icon_max_y) / 2.0
            
            # Size of the icon
            icon_w = icon_max_x - icon_min_x
            icon_h = icon_max_y - icon_min_y
            icon_size = max(icon_w, icon_h)
            
            # Crop box size (icon should take up ~85% of the crop box)
            crop_size = int(icon_size / 0.85)
            
            # Calculate crop box coordinates
            crop_left = int(cx - crop_size / 2.0)
            crop_right = crop_left + crop_size
            crop_top = int(cy - crop_size / 2.0)
            crop_bottom = crop_top + crop_size
            
            # Handle out-of-bounds with a white background padding
            src_left = max(0, crop_left)
            src_top = max(0, crop_top)
            src_right = min(w, crop_right)
            src_bottom = min(h, crop_bottom)
            
            paste_x = src_left - crop_left
            paste_y = src_top - crop_top
            
            cell = Image.new("RGB", (crop_size, crop_size), (255, 255, 255))
            if src_right > src_left and src_bottom > src_top:
                src_crop = img.crop((src_left, src_top, src_right, src_bottom))
                cell.paste(src_crop, (paste_x, paste_y))
        else:
            # Fallback to direct crop of rough cell if no non-white pixels are found
            margin = 4
            left = left_rough + margin
            right = right_rough - margin
            top = top_rough + margin
            bottom = bottom_rough - margin
            cell = img.crop((left, top, right, bottom)).convert("RGB")
            
        cell = cell.convert("RGB").resize((128, 128), Image.Resampling.LANCZOS)
        
        # Format filename e.g. b2-analyst.jpg
        level_lower = level.lower()
        filename_out = f"{level_lower}-{word.replace(' ', '_')}.jpg"
        out_path = os.path.join(IMAGE_DIR, filename_out)
        
        cell.save(out_path, "JPEG", quality=90)
        print(f"  Smart cropped slot {idx+1}: {word} -> {filename_out}")
        
        # Get phonetic symbol
        phonetic = get_phonetic(word)
        
        new_entries.append({
            "Level": level,
            "word": word,
            "chinese": chinese,
            "phonetic": phonetic,
            "img_url": f"images/{filename_out}"
        })


# Load the current image-vocab.json
if os.path.exists(VOCAB_PATH):
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        try:
            vocab = json.load(f)
        except Exception:
            vocab = []
else:
    vocab = []

# Index existing vocab entries by lowercase first English word
existing_map = {}
for idx, entry in enumerate(vocab):
    if entry.get("English") and len(entry["English"]) > 0:
        existing_map[entry["English"][0].lower().strip()] = idx

# Update or append new entries
for entry_info in new_entries:
    word = entry_info["word"]
    level = entry_info["Level"]
    chinese = entry_info["chinese"]
    phonetic = entry_info["phonetic"]
    img_url = entry_info["img_url"]
    
    new_vocab_entry = {
        "Level": level,
        "English": [word],
        "ImageUrl": img_url,
        "Chinese": chinese
    }
    if phonetic:
        new_vocab_entry["Phonetic"] = phonetic
        
    word_key = word.lower().strip()
    if word_key in existing_map:
        # Update existing
        vocab[existing_map[word_key]] = new_vocab_entry
        print(f"Updated in image-vocab.json: {word}")
    else:
        # Append new
        vocab.append(new_vocab_entry)
        existing_map[word_key] = len(vocab) - 1
        print(f"Added to image-vocab.json: {word}")

# Save updated image-vocab.json
with open(VOCAB_PATH, "w", encoding="utf-8") as f:
    json.dump(vocab, f, ensure_ascii=False, indent=2)

print("\nFinished cropping all images and updating image-vocab.json successfully!")
