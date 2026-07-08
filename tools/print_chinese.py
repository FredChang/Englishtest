import json
import re
import sys
import os

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

def main():
    with open('tools/detected_text_cards_v2.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    with open('tools/pending_grids.json', 'r', encoding='utf-8') as f:
        pending_grids = json.load(f)
        
    # Build word to grid map
    word_to_grid = {}
    for grid_num, words_list in pending_grids.items():
        for item in words_list:
            word_to_grid[item["word"].lower().strip()] = grid_num
            
    chi_pat = re.compile(r'[\u4e00-\u9fff]')
    count = 0
    grid_counts = {}
    for item in data:
        has_chinese = False
        for d in item["detected"]:
            if chi_pat.search(d):
                has_chinese = True
                break
        if has_chinese:
            w = item["word"].lower().strip()
            g = word_to_grid.get(w, "unknown")
            print(f"{item['index']}: {item['word']} ({item['level']}) [Grid {g}] -> {item['detected']} - {item['image']}")
            grid_counts[g] = grid_counts.get(g, 0) + 1
            count += 1
            
    print(f"\nTotal cards with Chinese characters: {count}")
    print("Counts by grid:")
    for g, c in sorted(grid_counts.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999):
        print(f"  Grid {g}: {c} words")

if __name__ == '__main__':
    main()
