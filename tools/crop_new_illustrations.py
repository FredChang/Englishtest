import os
import json
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.join(ROOT, "backup data")
IMAGE_DIR = os.path.join(ROOT, "web", "images")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
WORDS_PATH = os.path.join(ROOT, "web", "words.json")

# Define target grids
GRIDS_TO_CROP = {
    "c1_grid_17.png": {
        "level": "C1",
        "words": [
            "ambivalence", "paradox", "irony", "figurative",
            "abstraction", "subjectivity", "objectivity", "relativity",
            "absoluteness", "universality", "specificity", "essentially",
            "ostensibly", "in depth", "superficially", "subtly"
        ]
    },
    "c1_grid_18.png": {
        "level": "C1",
        "words": [
            "manifestly", "tacitly", "explicitly", "ambiguously",
            "lucidly", "systematically", "comprehensively", "partially",
            "evenly", "extremely", "moderately", "radically",
            "conservatively", "progressively", "traditionally", "contemporarily"
        ]
    },
    "c2_grid_19.png": {
        "level": "C2",
        "words": [
            "ubiquitously", "seldom", "uniquely", "ordinarily",
            "remarkably", "excellently", "mediocrely", "eminently",
            "abysmally", "exquisitely", "vulgarly", "elegantly",
            "sloppily", "circumspectly", "recklessly", "cunningly"
        ]
    },
    "c2_grid_20.png": {
        "level": "C2",
        "words": [
            "naively", "sophisticatedly", "ingenuously", "hypocritically",
            "sincerely", "affectedly", "unassumingly", "arrogantly",
            "obstinately", "affably", "reclusively", "extrovertedly",
            "introvertedly", "loquaciously", "taciturnly", "verbosely"
        ]
    },
    "a1_grid_extra.png": {
        "level": "A1",
        "words": [
            "house", "milk", "tree", "water"
        ]
    }
}

def main():
    os.makedirs(IMAGE_DIR, exist_ok=True)

    # 1. Load words database for Chinese and Phonetic lookup
    words_db = {}
    if os.path.exists(WORDS_PATH):
        with open(WORDS_PATH, "r", encoding="utf-8") as f:
            try:
                for item in json.load(f):
                    eng_list = item.get("English", [])
                    if eng_list:
                        eng_clean = eng_list[0].strip().lower()
                        words_db[eng_clean] = item
            except Exception as e:
                print(f"Error loading words.json: {e}")

    # 2. Load existing image-vocab.json
    vocab = []
    if os.path.exists(VOCAB_PATH):
        with open(VOCAB_PATH, "r", encoding="utf-8") as f:
            try:
                vocab = json.load(f)
            except Exception:
                vocab = []
                
    # Create mapping of existing database by primary English word
    existing_map = {}
    for idx, entry in enumerate(vocab):
        eng_list = entry.get("English", [])
        if eng_list:
            existing_map[eng_list[0].strip().lower()] = idx

    new_entries = []

    # 3. Process each grid sheet
    for filename, grid_info in GRIDS_TO_CROP.items():
        image_path = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(image_path):
            print(f"Error: Source image not found at {image_path}")
            continue

        print(f"\nProcessing {filename}...")
        img = Image.open(image_path)
        w, h = img.size
        
        # Convert image to grayscale to find non-white grid boundary box
        arr = np.array(img.convert('L'))
        non_white = np.where(arr < 250)
        
        if len(non_white[0]) == 0:
            print(f"Error: No non-white content detected in {filename}")
            continue
            
        min_y, max_y = non_white[0].min(), non_white[0].max()
        min_x, max_x = non_white[1].min(), non_white[1].max()
        
        W = max_x - min_x
        H = max_y - min_y
        
        words = grid_info["words"]
        num_cells = len(words)
        
        # Grid layout (4x4 or 2x2)
        if num_cells == 16:
            grid_cols = 4
            grid_rows = 4
        elif num_cells == 4:
            grid_cols = 2
            grid_rows = 2
        else:
            print(f"Error: Unsupported grid cell count {num_cells}")
            continue
            
        cell_w = W / grid_cols
        cell_h = H / grid_rows
        
        for idx, word in enumerate(words):
            level = grid_info["level"]
            
            # Grid row and column
            row = idx // grid_cols
            col = idx % grid_cols
            
            # Determine rough cell boundary
            left_rough = int(min_x + col * cell_w)
            right_rough = int(min_x + (col + 1) * cell_w)
            top_rough = int(min_y + row * cell_h)
            bottom_rough = int(min_y + (row + 1) * cell_h)
            
            # Extract cell array and find bounding box of drawing inside it
            cell_arr = arr[top_rough:bottom_rough, left_rough:right_rough]
            cell_non_white = np.where(cell_arr < 250)
            
            if len(cell_non_white[0]) > 0:
                icon_min_x = left_rough + cell_non_white[1].min()
                icon_max_x = left_rough + cell_non_white[1].max()
                icon_min_y = top_rough + cell_non_white[0].min()
                icon_max_y = top_rough + cell_non_white[0].max()
                
                # Center of drawing
                cx = (icon_min_x + icon_max_x) / 2.0
                cy = (icon_min_y + icon_max_y) / 2.0
                
                # Bounding size
                icon_w = icon_max_x - icon_min_x
                icon_h = icon_max_y - icon_min_y
                icon_size = max(icon_w, icon_h)
                
                # Smart crop sizing (~85% of crop box)
                crop_size = int(icon_size / 0.85)
                
                # Crop box coordinates
                crop_left = int(cx - crop_size / 2.0)
                crop_right = crop_left + crop_size
                crop_top = int(cy - crop_size / 2.0)
                crop_bottom = crop_top + crop_size
                
                # Handle boundaries
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
                # Fallback to direct rough cell crop
                margin = 4
                left = left_rough + margin
                right = right_rough - margin
                top = top_rough + margin
                bottom = bottom_rough - margin
                cell = img.crop((left, top, right, bottom)).convert("RGB")
                
            cell = cell.convert("RGB").resize((128, 128), Image.Resampling.LANCZOS)
            
            # Safe filename e.g. c1-in_depth.jpg
            safe_word = word.lower().replace(" ", "_").replace("-", "_").replace("'", "")
            filename_out = f"{level.lower()}-{safe_word}.jpg"
            out_path = os.path.join(IMAGE_DIR, filename_out)
            
            cell.save(out_path, "JPEG", quality=90)
            print(f"  Smart cropped slot {idx+1}: {word} -> {filename_out}")
            
            # Lookup metadata
            word_info = words_db.get(word.lower().strip(), {})
            chinese = word_info.get("Chinese", "")
            phonetic = word_info.get("Phonetic", "")
            
            new_vocab_entry = {
                "Level": level,
                "English": [word],
                "ImageUrl": f"images/{filename_out}"
            }
            if chinese:
                new_vocab_entry["Chinese"] = chinese
            if phonetic:
                new_vocab_entry["Phonetic"] = phonetic
                
            word_key = word.lower().strip()
            if word_key in existing_map:
                vocab[existing_map[word_key]] = new_vocab_entry
                print(f"  Updated in database: {word}")
            else:
                vocab.append(new_vocab_entry)
                existing_map[word_key] = len(vocab) - 1
                print(f"  Added to database: {word}")

    # 4. Save updated image-vocab.json
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
        
    print("\nFinished cropping all 68 images and updating image-vocab.json successfully!")

if __name__ == "__main__":
    main()
