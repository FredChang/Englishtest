import os
import json
import urllib.request
import io
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(ROOT, "web", "images")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
WORDS_PATH = os.path.join(ROOT, "web", "words.json")

TARGETS = {
    "apple": "1F34E",
    "bird": "1F426",
    "book": "1F4D6",
    "car": "1F697",
    "cat": "1F431",
    "dog": "1F436",
    "egg": "1F95A",
    "fish": "1F41F",
    "house": "1F3E0",
    "milk": "1F95B",
    "tree": "1F333",
    "water": "1F4A7"
}

def download_image_data(hex_str):
    url = f"https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618/{hex_str}.png"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read()
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return None

def main():
    os.makedirs(IMAGE_DIR, exist_ok=True)
    
    # 1. Load words.json for translations and phonetics
    words_data = {}
    if os.path.exists(WORDS_PATH):
        with open(WORDS_PATH, "r", encoding="utf-8") as f:
            for item in json.load(f):
                eng_list = item.get("English", [])
                if eng_list:
                    eng_clean = eng_list[0].strip().lower()
                    words_data[eng_clean] = item

    # 2. Load existing image-vocab.json
    vocab = []
    if os.path.exists(VOCAB_PATH):
        with open(VOCAB_PATH, "r", encoding="utf-8") as f:
            try:
                vocab = json.load(f)
            except Exception:
                vocab = []
                
    # Create mapping of existing database
    existing_map = {}
    for idx, entry in enumerate(vocab):
        eng_list = entry.get("English", [])
        if eng_list:
            existing_map[eng_list[0].strip().lower()] = idx

    # 3. Generate the 12 target cards
    print("Generating 12 target OpenMoji cards...")
    for word, hex_str in TARGETS.items():
        img_data = download_image_data(hex_str)
        if not img_data:
            print(f"Failed to get image for {word}")
            continue
            
        try:
            # Process and center OpenMoji
            openmoji_img = Image.open(io.BytesIO(img_data)).convert('RGBA')
            canvas_size = 128
            card = Image.new('RGBA', (canvas_size, canvas_size), (255, 255, 255, 255))
            draw = ImageDraw.Draw(card)
            
            # 1px solid black border
            draw.rectangle([(0, 0), (canvas_size - 1, canvas_size - 1)], outline=(0, 0, 0), width=1)
            
            content_size = 100
            openmoji_resized = openmoji_img.resize((content_size, content_size), Image.Resampling.LANCZOS)
            offset = (canvas_size - content_size) // 2
            card.paste(openmoji_resized, (offset, offset), openmoji_resized)
            
            filename = f"a1-{word}.jpg"
            filepath = os.path.join(IMAGE_DIR, filename)
            final_card = card.convert('RGB')
            final_card.save(filepath, 'JPEG', quality=90)
            print(f"Generated card: {filename}")
            
            # Find metadata
            word_info = words_data.get(word, {})
            chinese = word_info.get("Chinese", "")
            phonetic = word_info.get("Phonetic", "")
            
            entry = {
                "Level": "A1",
                "English": [word],
                "ImageUrl": f"images/{filename}"
            }
            if chinese:
                entry["Chinese"] = chinese
            if phonetic:
                entry["Phonetic"] = phonetic
                
            if word in existing_map:
                vocab[existing_map[word]] = entry
                print(f"Updated in json: {word}")
            else:
                vocab.append(entry)
                existing_map[word] = len(vocab) - 1
                print(f"Added to json: {word}")
                
        except Exception as e:
            print(f"Error processing card for {word}: {e}")

    # Write back image-vocab.json
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
    print("image-vocab.json updated successfully with 12 target words.")

if __name__ == "__main__":
    main()
