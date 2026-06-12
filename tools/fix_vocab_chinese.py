import os
import json
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(ROOT, "tools"))
try:
    from generate_words import NEW_WORDS
except ImportError:
    NEW_WORDS = []

WORDS_PATH = os.path.join(ROOT, "web", "words.json")
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")

def main():
    # 1. Load words from words.json
    words_db = {}
    if os.path.exists(WORDS_PATH):
        with open(WORDS_PATH, "r", encoding="utf-8") as f:
            for w in json.load(f):
                eng = w["English"][0].lower().strip()
                words_db[eng] = w.get("Chinese", "")
                
    # 2. Load words from generate_words.NEW_WORDS
    new_words_db = {}
    for entry in NEW_WORDS:
        level, chi, eng = entry
        new_words_db[eng.lower().strip()] = chi

    # 3. Load image-vocab.json
    if not os.path.exists(VOCAB_PATH):
        print(f"Error: image-vocab.json not found at {VOCAB_PATH}")
        return
        
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)
        
    # 4. Fill Chinese translation
    updated_count = 0
    for entry in vocab:
        eng = entry["English"][0].lower().strip()
        
        # Determine Chinese translation
        chinese = words_db.get(eng, "")
        if not chinese:
            chinese = new_words_db.get(eng, "")
            
        # Hardcoded manual overrides if any are still missing
        if not chinese:
            if eng == "atlas":
                chinese = "地圖集"
            elif eng == "campsite":
                chinese = "露營地"
            elif eng == "desert":
                chinese = "沙漠"
            elif eng == "coastline":
                chinese = "海岸線"
            elif eng == "countryside":
                chinese = "鄉村"
            elif eng == "canal":
                chinese = "運河"
            elif eng == "carriage":
                chinese = "馬車"
            elif eng == "cliff":
                chinese = "懸崖"
            elif eng == "cave":
                chinese = "洞穴"
            elif eng == "destination":
                chinese = "目的地"
            elif eng == "weather pattern":
                chinese = "氣候模式"
            elif eng == "displaced person":
                chinese = "難民"
            elif eng == "financial plan":
                chinese = "財務計劃"
            elif eng == "save energy":
                chinese = "節能"
                
        if chinese:
            entry["Chinese"] = chinese
            updated_count += 1
        else:
            print(f"Warning: No Chinese translation found for {eng}")

    # 5. Write back
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully updated {updated_count} entries in image-vocab.json with Chinese translations.")

if __name__ == "__main__":
    main()
