import os
import json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(ROOT, "web", "images")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")

# Define the 10 grids with their level and words
GRIDS = {
    1: [
        ("B1", "patience"), ("B1", "honesty"), ("B1", "modesty"), ("B1", "loyalty"),
        ("B1", "compassion"), ("B1", "envy"), ("B1", "rage"), ("B1", "terror"),
        ("B1", "astonishment"), ("B1", "remorse"), ("B1", "hopelessness"), ("B1", "contentment"),
        ("B1", "frustration"), ("B1", "grateful"), ("B1", "watch"), ("B1", "join")
    ],
    2: [
        ("B1", "change"), ("B1", "destroy"), ("B1", "fix"), ("B1", "intimidate"),
        ("B1", "save energy"), ("B1", "weather pattern"), ("B1", "displaced person"), ("B1", "financial plan"),
        ("B1", "benefit"), ("B1", "right"), ("B1", "duty"), ("B1", "law"),
        ("B1", "rule"), ("B1", "liberty"), ("B1", "equality"), ("B1", "fairness")
    ],
    3: [
        ("B1", "ballot"), ("B1", "administration"), ("B1", "policy"), ("B1", "uprising"),
        ("B1", "harmony"), ("B1", "warfare"), ("B1", "media"), ("B1", "advertisement"),
        ("B1", "brand"), ("B1", "consumer"), ("B1", "produce"), ("B1", "service"),
        ("B1", "quality"), ("B1", "quantity"), ("B1", "price"), ("B1", "profit")
    ],
    4: [
        ("B1", "cost"), ("B1", "demand"), ("B1", "supply"), ("B1", "competitiveness"),
        ("B1", "innovation"), ("B1", "technology"), ("B1", "science"), ("B1", "research"),
        ("B1", "experiment"), ("B1", "theory"), ("B1", "practice"), ("B1", "proof"),
        ("B1", "conclusion"), ("B1", "cause"), ("B1", "outcome"), ("B1", "effect")
    ],
    5: [
        ("B1", "relation"), ("B1", "communication"), ("B1", "discussion"), ("B1", "argument"),
        ("B1", "speech"), ("B1", "report"), ("B1", "article"), ("B1", "paragraph"),
        ("B1", "sentence"), ("B1", "vocabulary"), ("B1", "grammar"), ("B1", "pronunciation"),
        ("B1", "accent"), ("B1", "fluent"), ("B1", "translate"), ("B1", "interpret")
    ],
    6: [
        ("B1", "describe"), ("B1", "compare"), ("B1", "contrast"), ("B1", "summarize"),
        ("B1", "examine"), ("B1", "evaluate"), ("B1", "suggest"), ("B1", "recommend"),
        ("B1", "criticize"), ("B1", "encourage"), ("B1", "motivate"), ("B1", "inspire"),
        ("B1", "bored"), ("B1", "interesting"), ("B1", "excited"), ("B1", "nervous")
    ],
    7: [
        ("B1", "relaxed"), ("B1", "pressure"), ("B1", "equilibrium"), ("B1", "routine"),
        ("B1", "objective"), ("B1", "plan"), ("B1", "step"), ("B1", "process"),
        ("B1", "method"), ("B1", "system"), ("B1", "structure"), ("B1", "function"),
        ("B1", "purpose"), ("B1", "meaning"), ("B1", "value"), ("B1", "tradition")
    ],
    8: [
        ("B1", "culture"), ("B1", "community"), ("B1", "neighborhood"), ("B1", "citizen"),
        ("B1", "surroundings"), ("B1", "nature"), ("B1", "resource"), ("B1", "power source"),
        ("B1", "waste"), ("B1", "economize"), ("B1", "charity"), ("B1", "volunteer"),
        ("B1", "donate"), ("B1", "foundation"), ("B1", "education"), ("B1", "train")
    ],
    9: [
        ("B1", "skill"), ("B1", "background"), ("B1", "capability"), ("B1", "talent"),
        ("B1", "effort"), ("B1", "luck"), ("B1", "opportunity"), ("B1", "challenge"),
        ("B1", "difficulty"), ("B1", "resolve"), ("B1", "issue"), ("B1", "crisis"),
        ("B1", "stable"), ("B1", "variation"), ("B1", "tendency"), ("B1", "development")
    ],
    10: [
        ("B1", "advance"), ("B1", "backward"), ("B1", "modernize"), ("B1", "globalize"),
        ("A2", "computer"), ("A2", "agree"), ("A2", "remember"), ("A2", "probably"),
        ("A2", "invite"), ("A2", "prepare"), ("A2", "complete"), ("A2", "continue"),
        ("A2", "succeed"), ("A2", "fail"), ("A2", "repair"), ("A2", "build")
    ]
}

def split_grid(grid_num, image_path, target_size=(128, 128)):
    if grid_num not in GRIDS:
        print(f"Error: Grid {grid_num} is not defined.")
        return
        
    if not os.path.exists(image_path):
        print(f"Error: Source image not found at {image_path}")
        return

    words_info = GRIDS[grid_num]
    
    img = Image.open(image_path)
    w, h = img.size
    
    grid_size = (4, 4)
    cell_w = w / grid_size[1]
    cell_h = h / grid_size[0]
    
    if not os.path.exists(IMAGE_DIR):
        os.makedirs(IMAGE_DIR)
        
    cropped_files = []
    
    for i in range(grid_size[0]):
        for j in range(grid_size[1]):
            idx = i * grid_size[1] + j
            if idx >= len(words_info):
                break
                
            level, word = words_info[idx]
            
            # Crop margins slightly to avoid border lines
            margin = 4 
            left = j * cell_w + margin
            upper = i * cell_h + margin
            right = (j + 1) * cell_w - margin
            lower = (i + 1) * cell_h - margin
            
            cell = img.crop((left, upper, right, lower))
            cell = cell.convert("RGB").resize(target_size, Image.Resampling.LANCZOS)
            
            # Format filename e.g. b1-patience.jpg or a2-computer.jpg
            lvl_lower = level.lower()
            filename = f"{lvl_lower}-{word.replace(' ', '_')}.jpg"
            out_path = os.path.join(IMAGE_DIR, filename)
            
            cell.save(out_path, "JPEG", quality=90)
            cropped_files.append((level, word, f"images/{filename}"))
            print(f"Successfully generated: {filename}")
            
    # Load and update image-vocab.json
    update_image_vocab(cropped_files)

def update_image_vocab(new_entries):
    if not os.path.exists(VOCAB_PATH):
        vocab = []
    else:
        with open(VOCAB_PATH, "r", encoding="utf-8") as f:
            try:
                vocab = json.load(f)
            except Exception:
                vocab = []
                
    # Create index map of existing entries
    existing_map = {}
    for idx, entry in enumerate(vocab):
        # We index by lowercase English
        if entry.get("English") and len(entry["English"]) > 0:
            existing_map[entry["English"][0].lower()] = idx
            
    for level, word, img_url in new_entries:
        entry = {
            "Level": level,
            "English": [word],
            "ImageUrl": img_url
        }
        
        word_key = word.lower()
        if word_key in existing_map:
            # Overwrite existing
            vocab[existing_map[word_key]] = entry
            print(f"Updated in json: {word}")
        else:
            vocab.append(entry)
            existing_map[word_key] = len(vocab) - 1
            print(f"Added to json: {word}")
            
    # Write back
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
    print("image-vocab.json updated successfully.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python process_grids.py [grid_num] [image_path]")
    else:
        grid_num = int(sys.argv[1])
        img_path = sys.argv[2]
        split_grid(grid_num, img_path)
