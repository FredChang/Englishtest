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
IMAGE_DIR = os.path.join(ROOT, "web")

def main():
    if not os.path.exists(VOCAB_PATH):
        print(f"Error: {VOCAB_PATH} not found!")
        return

    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    print("Initializing EasyOCR English reader...")
    # This might download the model files on the first run
    reader = easyocr.Reader(['en'], gpu=False)

    print(f"Scanning {len(vocab)} images...")
    results = []
    
    # We want to identify any text that contains actual English letters (A-Z)
    letter_pattern = re.compile(r'[a-zA-Z]{2,}') # at least 2 consecutive letters to avoid single-dot noise
    
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
                # Check if it has letters and confidence is reasonable
                if letter_pattern.search(clean_text) and prob > 0.4:
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
            # print(f"Error scanning {img_url}: {e}")
            pass

    print(f"\nScan completed. Found {len(results)} images with text.")
    
    # Save results to a json file
    out_path = os.path.join(ROOT, "tools", "detected_text_cards.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Saved results to {out_path}")

if __name__ == "__main__":
    main()
