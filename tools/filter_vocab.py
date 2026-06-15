# -*- coding: utf-8 -*-
import os
import sys
import json
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS_PATH = os.path.join(ROOT, "words.json")
WEB_WORDS_PATH = os.path.join(ROOT, "web", "words.json")
WORDS_SOURCE_PATH = os.path.join(ROOT, "backup data", "words_9279.json")
if not os.path.exists(WORDS_SOURCE_PATH):
    WORDS_SOURCE_PATH = WORDS_PATH

GOOGLE_FREQ_URL = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt"

def fetch_google_freq_list(url):
    print(f"Fetching Google 10,000 English word list from: {url}")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            lines = response.read().decode('utf-8').splitlines()
            # Map word to its rank (lower rank = more common)
            freq_map = {word.strip().lower(): i for i, word in enumerate(lines)}
            return freq_map
    except Exception as e:
        print(f"Error fetching Google frequency list: {e}")
        sys.exit(1)

def load_vocab(path):
    print(f"Loading vocabulary from: {path}")
    if not os.path.exists(path):
        print(f"File not found: {path}")
        sys.exit(1)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading vocabulary: {e}")
        sys.exit(1)

def main():
    # Set console encoding to UTF-8
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    vocab = load_vocab(WORDS_SOURCE_PATH)
    print(f"Loaded {len(vocab)} total vocabulary words.")

    freq_map = fetch_google_freq_list(GOOGLE_FREQ_URL)
    print(f"Successfully loaded {len(freq_map)} frequency list ranks.")

    # Divide vocabulary into A1/A2/B1 (to keep completely) and B2/C1/C2 (to filter by frequency)
    base_levels = {'A1', 'A2', 'B1'}
    base_words = []
    advanced_words = []

    for item in vocab:
        level = item.get("Level", "A1").upper().strip()
        if level in base_levels:
            base_words.append(item)
        elif level != "C2":
            advanced_words.append(item)

    print(f"Base words (A1/A2/B1): {len(base_words)}")
    print(f"Advanced words (B2/C1/C2): {len(advanced_words)}")

    target_total = 5000
    target_advanced = target_total - len(base_words)
    print(f"Targeting exactly {target_total} words total. Need to select {target_advanced} advanced words.")

    # Rank advanced words
    # Rank is determined by the Google 10,000 index (lower index = higher frequency/more common)
    # If a word is not in the Google 10,000, we rank it at the end (large number)
    def get_rank(item):
        engs = item.get("English", [""])
        word = engs[0].strip().lower() if engs else ""
        return freq_map.get(word, 1000000)

    # Sort advanced words by frequency rank (most common first)
    advanced_words.sort(key=get_rank)

    # Select the top target_advanced words
    selected_advanced = advanced_words[:target_advanced]
    print(f"Selected {len(selected_advanced)} advanced words. Most common B2/C1/C2 words.")

    # Print a few examples of selected and discarded advanced words for verification
    print("Examples of KEPT advanced words (rank is low/more common):")
    for item in selected_advanced[:5]:
        engs = item.get("English", [""])
        word = engs[0] if engs else ""
        print(f"  {word} ({item.get('Level')}) - Google Rank: {get_rank(item)}")

    discarded_advanced = advanced_words[target_advanced:]
    print("Examples of DISCARDED advanced words (rank is high/less common):")
    for item in discarded_advanced[:5]:
        engs = item.get("English", [""])
        word = engs[0] if engs else ""
        print(f"  {word} ({item.get('Level')}) - Google Rank: {get_rank(item)}")

    # Merge base and selected advanced words
    final_vocab = base_words + selected_advanced
    print(f"Merged vocabulary size: {len(final_vocab)} (Target: {target_total})")

    # Sort final list by Level (A1, A2, B1, B2, C1, C2) then English word alphabetically
    levels_list = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    def sort_key(item):
        lvl = item.get("Level", "A1")
        try:
            lvl_idx = levels_list.index(lvl)
        except ValueError:
            lvl_idx = 0
        
        engs = item.get("English", [""])
        eng = engs[0] if engs else ""
        return (lvl_idx, eng.lower())

    final_vocab.sort(key=sort_key)

    # Save to root words.json
    print(f"Saving filtered vocabulary to: {WORDS_PATH}")
    with open(WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(final_vocab, f, ensure_ascii=False, indent=2)

    # Save to web/words.json
    print(f"Saving filtered vocabulary to: {WEB_WORDS_PATH}")
    os.makedirs(os.path.dirname(WEB_WORDS_PATH), exist_ok=True)
    with open(WEB_WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(final_vocab, f, ensure_ascii=False, indent=2)

    # Verify counts by level
    from collections import Counter
    counts = Counter(w.get("Level", "A1") for w in final_vocab)
    print("Final Word Count by Level:")
    for lvl in levels_list:
        print(f"  {lvl}: {counts.get(lvl, 0)}")
    print(f"  Total: {sum(counts.values())}")

if __name__ == "__main__":
    main()
