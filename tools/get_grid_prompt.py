import os
import json
import sys

# Reconfigure stdout to support UTF-8 printing on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRIDS_PATH = os.path.join(ROOT, "tools", "pending_grids.json")

def main():
    if len(sys.argv) < 2:
        print("Usage: python get_grid_prompt.py [grid_num]")
        return
        
    grid_num = sys.argv[1]
    
    if not os.path.exists(GRIDS_PATH):
        print(f"Error: {GRIDS_PATH} not found!")
        return
        
    with open(GRIDS_PATH, "r", encoding="utf-8") as f:
        grids = json.load(f)
        
    if grid_num not in grids:
        print(f"Error: Grid {grid_num} not found in pending_grids.json!")
        return
        
    words_info = grids[grid_num]
    
    # Construct enumerated items list without English words to prevent text labels
    items = []
    for idx, item in enumerate(words_info):
        word = item["word"]
        chi = item["chinese"]
        # Special cases for standard uppercase acronyms
        if word.upper() in ["5G", "AIDS", "DVD", "GPS", "IT", "TV", "PC", "IP", "ID", "IQ", "CEO", "VIP"]:
            concept_desc = f"a cute cartoon sticker representing '{word.upper()}'"
        else:
            concept_desc = f"a cute cartoon sticker representing the concept of '{chi}'"
        items.append(f"{idx + 1}. {concept_desc}")
        
    items_str = ", ".join(items)
    
    prompt = f"A high-quality 4x4 grid of 16 cute cartoon sticker icons on a solid white background, representing the following items (strictly do not write any English words, letters, labels, or writing on the stickers or in the image): {items_str}. Each icon is isolated, has a bold white die-cut outline border, and is cleanly separated. Flat vector style, vibrant colors."
    
    print(f"ImageName: grid_{grid_num}")
    print(f"Prompt: {prompt}")

if __name__ == "__main__":
    main()
