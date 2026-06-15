import os
import json
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(ROOT, "web", "images")
WORDS_PATH = os.path.join(ROOT, "web", "words.json")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")

# Curated premium color gradients (color1 to color2)
GRADIENTS = [
    ((37, 99, 235), (29, 78, 216)),    # Blue
    ((219, 39, 119), (190, 24, 74)),   # Pink
    ((5, 150, 105), (4, 120, 87)),     # Emerald
    ((217, 119, 6), (180, 83, 9)),     # Amber
    ((124, 58, 237), (109, 40, 217)),  # Violet
    ((13, 148, 136), (15, 118, 110)),  # Teal
    ((79, 70, 229), (67, 56, 202)),    # Indigo
    ((225, 29, 72), (190, 18, 60)),    # Rose
    ((8, 145, 178), (9, 109, 130)),    # Cyan
    ((101, 163, 13), (77, 124, 15)),   # Lime
]

def deterministic_hash(s):
    h = 5381
    for char in s:
        h = ((h << 5) + h) + ord(char)
    return h & 0xFFFFFFFF

def create_gradient_image(width, height, color1, color2):
    base = Image.new("RGB", (width, height), color1)
    top = Image.new("RGB", (width, height), color2)
    mask = Image.new("L", (width, height))
    mask_data = []
    for y in range(height):
        val = int(255 * (y / (height - 1)))
        mask_data.extend([val] * width)
    mask.putdata(mask_data)
    return Image.composite(top, base, mask)

def generate_icon(word, level):
    width, height = 128, 128
    
    # Get gradient pair deterministically
    h_val = deterministic_hash(word)
    gradient_idx = h_val % len(GRADIENTS)
    color1, color2 = GRADIENTS[gradient_idx]
    
    # Create background gradient
    img = create_gradient_image(width, height, color1, color2)
    
    # Create RGBA overlay for transparent card
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    
    # Draw central circle with alpha transparency (frosted glass look)
    cx, cy = width // 2, height // 2
    r = 38
    draw_overlay.ellipse([(cx - r, cy - r), (cx + r, cy + r)], 
                         fill=(255, 255, 255, 45), 
                         outline=(255, 255, 255, 120), 
                         width=1)
    
    # Stylized initials
    initials = word[:2].capitalize() if len(word) >= 2 else word.capitalize()
    
    # Load font
    font = None
    font_paths = [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        "arial.ttf",
        "Helvetica-Bold"
    ]
    for path in font_paths:
        try:
            font = ImageFont.truetype(path, 30)
            break
        except:
            continue
            
    if not font:
        font = ImageFont.load_default()
        
    # Draw centered text
    try:
        # Modern PIL: anchor="mm" centers text perfectly
        draw_overlay.text((cx, cy), initials, fill=(255, 255, 255, 240), font=font, anchor="mm")
    except:
        # Fallback text centering
        try:
            bbox = font.getbbox(initials)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
        except AttributeError:
            w, h = font.getsize(initials)
        tx = cx - w / 2
        ty = cy - h / 2
        draw_overlay.text((tx, ty), initials, fill=(255, 255, 255, 240), font=font)
        
    # Combine background and overlay
    img_rgba = Image.new("RGBA", (width, height))
    img_rgba.paste(img, (0, 0))
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    
    return img_rgba.convert("RGB")

def main():
    if not os.path.exists(IMAGE_DIR):
        os.makedirs(IMAGE_DIR)
        
    with open(WORDS_PATH, "r", encoding="utf-8") as f:
        words = json.load(f)
        
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        images_vocab = json.load(f)
        
    # Map already present words
    present_words = set()
    for item in images_vocab:
        english_list = item.get("English", [])
        if english_list:
            present_words.add(english_list[0].strip().lower())
            
    print(f"Already present in image-vocab: {len(present_words)} words")
    
    count_generated = 0
    updated_vocab = list(images_vocab)
    
    for idx, item in enumerate(words):
        english_list = item.get("English", [])
        if not english_list:
            continue
        primary_english = english_list[0].strip()
        word_key = primary_english.lower()
        
        if word_key in present_words:
            continue
            
        level = item.get("Level", "A1")
        chinese = item.get("Chinese", "")
        phonetic = item.get("Phonetic", "")
        
        # Generate image
        try:
            img = generate_icon(primary_english, level)
            
            # Format filename safely
            safe_word = primary_english.lower().replace(" ", "_").replace("-", "_").replace("'", "")
            filename = f"{level.lower()}-{safe_word}.jpg"
            filepath = os.path.join(IMAGE_DIR, filename)
            
            img.save(filepath, "JPEG", quality=90)
            
            # Add entry
            new_entry = {
                "Level": level,
                "English": english_list,
                "ImageUrl": f"images/{filename}",
                "Chinese": chinese
            }
            if phonetic:
                new_entry["Phonetic"] = phonetic
                
            updated_vocab.append(new_entry)
            present_words.add(word_key)
            count_generated += 1
            
            if count_generated % 500 == 0:
                print(f"Generated {count_generated} images...")
        except Exception as e:
            print(f"Error generating image for '{primary_english}': {e}")
            
    print(f"Total new images generated: {count_generated}")
    
    # Save updated image-vocab.json
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(updated_vocab, f, ensure_ascii=False, indent=2)
        
    print("Successfully updated image-vocab.json database!")

if __name__ == "__main__":
    main()
