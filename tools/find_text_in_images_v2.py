import os
import json
import easyocr
import re
import sys

# Reconfigure stdout to support UTF-8 printing on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")

def main():
    if not os.path.exists(VOCAB_PATH):
        print(f"Error: {VOCAB_PATH} not found!")
        return

    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    print("Initializing EasyOCR Traditional Chinese and English reader...")
    # Initialize reader with ch_tra (Traditional Chinese) and en (English)
    reader = easyocr.Reader(['ch_tra', 'en'], gpu=False)

    # Filter database to only include cards generated today (B1/B2 from Grids 21-24, 30-33, 39-42, 48, 57-59)
    # We can check their filenames or just scan all 577 cards to find any text in the entire database
    print(f"Scanning all {len(vocab)} images in database for English and Chinese text...")
    results = []
    
    # Match any English word (at least 2 letters) or any Chinese character
    text_pattern = re.compile(r'([a-zA-Z]{2,}|[\u4e00-\u9fff])')
    
    for idx, entry in enumerate(vocab):
        img_url = entry.get("ImageUrl")
        if not img_url:
            continue
            
        filepath = os.path.join(ROOT, "web", img_url)
        if not os.path.exists(filepath):
            continue
            
        try:
            ocr_results = reader.readtext(filepath)
            detected_words = []
            for bbox, text, prob in ocr_results:
                clean_text = text.strip()
                if text_pattern.search(clean_text) and prob > 0.4:
                    detected_words.append(f"'{clean_text}' ({prob:.2f})")
            
            if detected_words:
                word_primary = entry["English"][0]
                print(f"[{idx}] {word_primary} ({entry['Level']}) -> Detected: {', '.join(detected_words)}")
                results.append({
                    "index": idx,
                    "word": word_primary,
                    "level": entry["Level"],
                    "image": img_url,
                    "detected": detected_words
                })
        except Exception as e:
            pass

    print(f"\nScan completed. Found {len(results)} images with text.")
    
    out_path = os.path.join(ROOT, "tools", "detected_text_cards_v2.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Saved results to {out_path}")

if __name__ == "__main__":
    main()
