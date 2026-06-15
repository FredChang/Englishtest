import os
import json
import urllib.request
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(ROOT, "web", "images")
WORDS_PATH = os.path.join(ROOT, "web", "words.json")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")
EMOJI_URL = "https://raw.githubusercontent.com/muan/emojilib/main/dist/emoji-en-US.json"

# Curated soft colors for fallback badge backgrounds
FALLBACK_COLORS_RGB = [
    (191, 219, 254),  # Soft Blue
    (254, 207, 207),  # Soft Red
    (187, 247, 208),  # Soft Green
    (254, 240, 138),  # Soft Yellow
    (221, 230, 253),  # Soft Light Blue
    (199, 244, 244),  # Soft Teal
    (245, 208, 254),  # Soft Purple
    (254, 207, 252)   # Soft Pink
]

def deterministic_hash(s):
    h = 5381
    for char in s:
        h = ((h << 5) + h) + ord(char)
    return h & 0xFFFFFFFF

def download_emoji_db():
    print("Downloading emoji database from GitHub...")
    try:
        response = urllib.request.urlopen(EMOJI_URL)
        return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error downloading emoji db: {e}")
        return {}

def build_emoji_map(emoji_db):
    emoji_map = {}
    for emoji_char, tags in emoji_db.items():
        # First map exact keywords if they are list
        if isinstance(tags, list):
            for tag in tags:
                tag_clean = tag.strip().lower()
                if tag_clean not in emoji_map:
                    emoji_map[tag_clean] = emoji_char
        # Map emoji itself just in case
        emoji_map[emoji_char] = emoji_char
    return emoji_map

def find_emoji_for_word(word, emoji_map):
    word_clean = word.strip().lower()
    
    # 1. Exact match
    if word_clean in emoji_map:
        return emoji_map[word_clean]
        
    # 2. Split match (e.g. "air conditioning" -> match "air" or "conditioning")
    parts = word_clean.replace("-", " ").replace("_", " ").split()
    for part in parts:
        if len(part) > 2 and part in emoji_map:
            return emoji_map[part]
            
    # 3. Substring match inside tags
    for tag, emoji_char in emoji_map.items():
        if len(tag) > 3 and (tag in word_clean or word_clean in tag):
            return emoji_char
            
    return None

def generate_emoji_card(word, emoji_char):
    width, height = 128, 128
    
    # Create white canvas
    img = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw solid black outer border (as in 1.png)
    draw.rectangle([(0, 0), (width - 1, height - 1)], outline=(0, 0, 0), width=1)
    
    # Load Segoe UI Emoji font
    font_path = r"C:\Windows\Fonts\seguiemj.ttf"
    font = None
    try:
        font = ImageFont.truetype(font_path, 80)
    except:
        pass
        
    cx, cy = width // 2, height // 2
    
    if emoji_char and font:
        try:
            draw.text((cx, cy), emoji_char, fill=(0, 0, 0, 255), font=font, anchor="mm", embedded_color=True)
        except:
            # Fallback centering
            try:
                bbox = font.getbbox(emoji_char)
                w = bbox[2] - bbox[0]
                h = bbox[3] - bbox[1]
            except AttributeError:
                w, h = font.getsize(emoji_char)
            draw.text((cx - w/2, cy - h/2), emoji_char, fill=(0, 0, 0, 255), font=font)
    else:
        # Fallback: draw a cute hand-drawn letter badge
        h_val = deterministic_hash(word)
        bg_color = FALLBACK_COLORS_RGB[h_val % len(FALLBACK_COLORS_RGB)]
        
        # Draw soft colored circle inside
        r = 38
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=bg_color, outline=(0, 0, 0), width=2)
        
        # Stylized letters
        initials = word[:2].capitalize() if len(word) >= 2 else word.capitalize()
        
        # Load bold font
        font_txt = None
        font_paths = [r"C:\Windows\Fonts\arialbd.ttf", "arial.ttf"]
        for p in font_paths:
            try:
                font_txt = ImageFont.truetype(p, 30)
                break
            except:
                continue
        if not font_txt:
            font_txt = ImageFont.load_default()
            
        try:
            draw.text((cx, cy), initials, fill=(0, 0, 0, 255), font=font_txt, anchor="mm")
        except:
            try:
                bbox = font_txt.getbbox(initials)
                w = bbox[2] - bbox[0]
                h = bbox[3] - bbox[1]
            except AttributeError:
                w, h = font_txt.getsize(initials)
            draw.text((cx - w/2, cy - h/2), initials, fill=(0, 0, 0, 255), font=font_txt)
            
    return img.convert("RGB")

def main():
    emoji_db = download_emoji_db()
    if not emoji_db:
        print("Failed to download emoji database. Aborting.")
        return
        
    emoji_map = build_emoji_map(emoji_db)
    
    with open(WORDS_PATH, "r", encoding="utf-8") as f:
        words = json.load(f)
        
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        images_vocab = json.load(f)
        
    # We want to check which words already have CUSTOM grid drawings (Grid 1 to 20)
    # The custom drawings are listed in image-vocab.json.
    # To identify custom drawings vs generated placeholder drawings:
    # Any image that was generated in the last run (gradient letter card) should be OVERWRITTEN.
    # But any image that was from Grids 1 to 16 (split cells) or Grids 17 to 20 (PIL custom outlines) should be PRESERVED.
    # Custom grid images in web/images/ are:
    # Grid 1-16 files have the format: level-word.jpg
    # Wait, how do we distinguish?
    # Actually, if we just keep the 332 images that were originally present before we ran the placeholder script, we are good!
    # How do we know which ones were the 332 original ones?
    # Grids 1-16 has 16 * 16 = 256 images.
    # Grids 17-18 has 16 + 16 = 32 images.
    # Grids 19-20 has 16 + 16 = 32 images.
    # Total custom words = 320 words!
    # Wait, the script output said "Already present in image-vocab: 332 words".
    # So yes! Those 332 words are the custom ones.
    # We can preserve those 332 words, and regenerate/overwrite the rest with the emoji format!
    
    # We will build a list of the 332 custom words from the original database.
    # How to identify them?
    # We can check if their ImageUrl exists and their filename matches the grid list.
    # Let's import GRIDS from process_grids and GRIDS_C from generate_icon_images!
    custom_words = set()
    try:
        import sys
        sys.path.append(os.path.join(ROOT, "tools"))
        from process_grids import GRIDS
        from generate_icon_images import GRIDS_C
        
        for g_num, items in GRIDS.items():
            for lvl, word in items:
                custom_words.add(word.strip().lower())
        for g_num, items in GRIDS_C.items():
            for lvl, word, desc in items:
                custom_words.add(word.strip().lower())
    except Exception as e:
        print(f"Error loading custom lists: {e}")
        
    print(f"Total custom illustrations to preserve: {len(custom_words)}")
    
    updated_vocab = []
    count_generated = 0
    count_preserved = 0
    
    for item in words:
        english_list = item.get("English", [])
        if not english_list:
            continue
        primary_english = english_list[0].strip()
        word_key = primary_english.lower()
        
        level = item.get("Level", "A1")
        chinese = item.get("Chinese", "")
        phonetic = item.get("Phonetic", "")
        
        # Check if it is a custom illustration to preserve
        is_custom = word_key in custom_words
        
        # If it is custom, find its original ImageUrl from images_vocab or use default format
        # The default format for custom files: "images/{level.lower()}-{word.lower().replace(' ', '_')}.jpg"
        if is_custom:
            filename = f"{level.lower()}-{primary_english.lower().replace(' ', '_').replace('-', '_')}.jpg"
            filepath = os.path.join(IMAGE_DIR, filename)
            if os.path.exists(filepath):
                new_entry = {
                    "Level": level,
                    "English": english_list,
                    "ImageUrl": f"images/{filename}",
                    "Chinese": chinese
                }
                if phonetic:
                    new_entry["Phonetic"] = phonetic
                updated_vocab.append(new_entry)
                count_preserved += 1
                continue
                
        # If it's not custom, or custom file is missing, generate the emoji card!
        emoji_char = find_emoji_for_word(primary_english, emoji_map)
        
        try:
            img = generate_emoji_card(primary_english, emoji_char)
            
            # Format filename safely
            safe_word = primary_english.lower().replace(" ", "_").replace("-", "_").replace("'", "")
            filename = f"{level.lower()}-{safe_word}.jpg"
            filepath = os.path.join(IMAGE_DIR, filename)
            
            img.save(filepath, "JPEG", quality=90)
            
            new_entry = {
                "Level": level,
                "English": english_list,
                "ImageUrl": f"images/{filename}",
                "Chinese": chinese
            }
            if phonetic:
                new_entry["Phonetic"] = phonetic
                
            updated_vocab.append(new_entry)
            count_generated += 1
            
            if count_generated % 500 == 0:
                print(f"Generated {count_generated} emoji cards...")
        except Exception as e:
            print(f"Error generating emoji card for '{primary_english}': {e}")
            
    print(f"Preserved custom illustrations: {count_preserved}")
    print(f"Generated emoji/badge cards: {count_generated}")
    print(f"Total database size: {len(updated_vocab)}")
    
    # Save updated image-vocab.json
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(updated_vocab, f, ensure_ascii=False, indent=2)
        
    print("Successfully updated image-vocab.json with emoji-style cards!")

if __name__ == "__main__":
    main()
