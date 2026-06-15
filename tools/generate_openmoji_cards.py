import os
import json
import urllib.request
import urllib.parse
import io
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(ROOT, "web", "images")
WORDS_PATH = os.path.join(ROOT, "web", "words.json")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
MAPPING_PATH = os.path.join(ROOT, "tools", "word_emoji_mapping.json")

# Gather custom words to preserve
def get_custom_words():
    custom = set()
    try:
        sys.path.append(os.path.join(ROOT, "tools"))
        from process_grids import GRIDS
        from generate_icon_images import GRIDS_C
        
        for g_num, items in GRIDS.items():
            for lvl, word in items:
                custom.add(word.strip().lower())
        for g_num, items in GRIDS_C.items():
            for lvl, word, desc in items:
                custom.add(word.strip().lower())
    except Exception as e:
        print(f"Warning loading custom lists: {e}")
    return custom

# Convert emoji character to OpenMoji filename hex parts
def get_emoji_codes(emoji_char):
    return [f"{ord(c):X}" for c in emoji_char if ord(c) != 0xFE0F]

# Get fallback emoji depending on the level
def get_default_emoji_hex(level):
    lvl = level.upper()
    if "C" in lvl:
        return "1F393"  # Graduation cap 🎓
    elif "B" in lvl:
        return "1F4A1"  # Lightbulb 💡
    else:
        return "270F"    # Pencil ✏️

# Download helper
def download_image_data(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read()
    except Exception:
        return None

# Process individual word card
def process_word_card(word_item, emoji_char, custom_words):
    english_list = word_item.get("English", [])
    if not english_list:
        return None
    primary_english = english_list[0].strip()
    word_key = primary_english.lower()
    level = word_item.get("Level", "A1")
    chinese = word_item.get("Chinese", "")
    phonetic = word_item.get("Phonetic", "")
    
    # Check custom preservation
    safe_word = primary_english.lower().replace(" ", "_").replace("-", "_").replace("'", "")
    filename = f"{level.lower()}-{safe_word}.jpg"
    filepath = os.path.join(IMAGE_DIR, filename)
    
    entry = {
        "Level": level,
        "English": english_list,
        "ImageUrl": f"images/{filename}",
        "Chinese": chinese
    }
    if phonetic:
        entry["Phonetic"] = phonetic
        
    if word_key in custom_words and os.path.exists(filepath):
        # Preserved
        return entry, "preserved"
        
    # Download OpenMoji
    codes = get_emoji_codes(emoji_char) if emoji_char else []
    hex_str = "-".join(codes) if codes else ""
    
    # Candidate URLs
    urls = []
    if hex_str:
        urls.append(f"https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618/{hex_str}.png")
    if len(codes) > 1:
        urls.append(f"https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618/{codes[0]}.png")
    # Level-based default fallback
    default_hex = get_default_emoji_hex(level)
    urls.append(f"https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618/{default_hex}.png")
    
    img_data = None
    used_url = None
    for url in urls:
        img_data = download_image_data(url)
        if img_data:
            used_url = url
            break
            
    if not img_data:
        # Emergency local fallback (draw basic colored card or standard symbol)
        return None
        
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
        
        final_card = card.convert('RGB')
        final_card.save(filepath, 'JPEG', quality=90)
        return entry, "generated"
    except Exception as e:
        print(f"Error drawing card for {primary_english}: {e}")
        return None

def main():
    os.makedirs(IMAGE_DIR, exist_ok=True)
    
    # Load mappings and DBs
    with open(WORDS_PATH, "r", encoding="utf-8") as f:
        words = json.load(f)
        
    with open(MAPPING_PATH, "r", encoding="utf-8") as f:
        emoji_mapping = json.load(f)
        
    custom_words = get_custom_words()
    print(f"Total words in vocabulary: {len(words)}")
    print(f"Custom illustrations to preserve: {len(custom_words)}")
    
    # Setup thread pool execution
    updated_vocab = []
    preserved_count = 0
    generated_count = 0
    failed_count = 0
    
    # Split task to download in threads
    print("Generating OpenMoji cards in concurrent threads...")
    with ThreadPoolExecutor(max_workers=30) as executor:
        # Submit tasks
        futures = {}
        for item in words:
            english_list = item.get("English", [])
            if not english_list:
                continue
            primary_english = english_list[0].strip()
            emoji_char = emoji_mapping.get(primary_english)
            
            future = executor.submit(process_word_card, item, emoji_char, custom_words)
            futures[future] = primary_english
            
        completed = 0
        for future in as_completed(futures):
            word_name = futures[future]
            try:
                res = future.result()
                if res:
                    entry, status = res
                    updated_vocab.append(entry)
                    if status == "preserved":
                        preserved_count += 1
                    else:
                        generated_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                print(f"Error handling task for {word_name}: {e}")
                failed_count += 1
                
            completed += 1
            if completed % 500 == 0:
                print(f"Progress: Completed {completed}/{len(words)} cards...")
                
    # Save image-vocab.json
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(updated_vocab, f, ensure_ascii=False, indent=2)
        
    print("\nGeneration Completed!")
    print(f"Preserved: {preserved_count}")
    print(f"Generated (OpenMoji style): {generated_count}")
    print(f"Failed: {failed_count}")
    print(f"Total database entries in image-vocab.json: {len(updated_vocab)}")

if __name__ == "__main__":
    main()
