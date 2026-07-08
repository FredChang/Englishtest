import os
import json
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_PATH = os.path.join(ROOT, "web", "image-vocab.json")

def main():
    # Paths of generated images in brain artifacts folder
    # Note: replace the timestamps with the exact ones generated
    bottle_src = r"C:\Users\aggyy\.gemini\antigravity\brain\6f456235-c389-4875-bd43-5f113a0e9fa1\a1_bottle_sticker_1782455113268.png"
    cook_src = r"C:\Users\aggyy\.gemini\antigravity\brain\6f456235-c389-4875-bd43-5f113a0e9fa1\a1_cook_sticker_1782455125877.png"
    
    bottle_dst = os.path.join(ROOT, "web", "images", "a1-bottle.jpg")
    cook_dst = os.path.join(ROOT, "web", "images", "a1-cook.jpg")
    
    if os.path.exists(bottle_src):
        shutil.copy(bottle_src, bottle_dst)
        print(f"Copied bottle image to {bottle_dst}")
    else:
        print(f"Error: {bottle_src} not found!")
        
    if os.path.exists(cook_src):
        shutil.copy(cook_src, cook_dst)
        print(f"Copied cook image to {cook_dst}")
    else:
        print(f"Error: {cook_src} not found!")
        
    # Load and update image-vocab.json
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)
        
    # Remove existing ones if any (to avoid duplicates)
    vocab = [item for item in vocab if item["English"][0].lower().strip() not in ["bottle", "cook"]]
    
    # Add new clean ones
    vocab.append({
        "Level": "A1",
        "English": ["bottle"],
        "ImageUrl": "images/a1-bottle.jpg",
        "Chinese": "瓶子"
    })
    
    vocab.append({
        "Level": "A1",
        "English": ["cook"],
        "ImageUrl": "images/a1-cook.jpg",
        "Chinese": "煮",
        "Phonetic": "/kʊk/"
    })
    
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
        
    print("Updated image-vocab.json with bottle and cook")

if __name__ == "__main__":
    main()
