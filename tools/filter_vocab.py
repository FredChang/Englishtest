# -*- coding: utf-8 -*-
import os
import sys
import json
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS_ALL_PATH = os.path.join(ROOT, "backup data", "words_all_11282.json")
if not os.path.exists(WORDS_ALL_PATH):
    WORDS_ALL_PATH = os.path.join(ROOT, "backup data", "words_9279.json")

WORDS_PATH = os.path.join(ROOT, "words.json")
WEB_WORDS_PATH = os.path.join(ROOT, "web", "words.json")
PS_PATH = os.path.join(ROOT, "tools", "Expand-WordsJson.ps1")

GOOGLE_FREQ_URL = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt"

# Comprehensive blacklist of acronyms, tech jargon, and abbreviations (case-insensitive)
BLACKLIST = {
    '5g', 'ad', 'aids', 'api', 'atm', 'bc', 'bios', 'cd', 'cdn', 'ceo', 'cfo', 'cli', 'coo', 'cpr', 'cpu', 'cto', 
    'dns', 'dvd', 'ebitda', 'etf', 'gdp', 'gnp', 'gpa', 'gps', 'gpu', 'gui', 'https', 'id', 'ide', 'ipo', 'kpi', 
    'lcd', 'led', 'mooc', 'mri', 'msg', 'nasdaq', 'nfc', 'nft', 'ocr', 'oled', 'pin', 'ram', 'rest api', 'rfid', 
    'roe', 'roi', 'rsvp', 'sdk', 'seo', 'ssd', 'ssl', 'stem', 'svg', 'tv', 'vpn', 'app'
}

# Custom definition overrides
CUSTOM_OVERRIDES = {
    "cookie": {"Level": "A1", "Chinese": "餅乾"},
    "t-shirt": {"Level": "A1", "Chinese": "T恤"},
    "beef": {"Level": "A2", "Chinese": "牛肉"},
    "bee": {"Level": "A2", "Chinese": "蜜蜂"},
    "trainer": {"Level": "B2", "Chinese": "教練 / 運動鞋"},
    "onion": {"Level": "A2"},
    "tomato": {"Level": "A2"},
    "potato": {"Level": "A2"},
    "cabbage": {"Level": "B1"},
    "garlic": {"Level": "B1"},
    "lettuce": {"Level": "B1"},
    "carrot": {"Level": "B1"},
    "butterfly": {"Level": "B1"},
    "mosquito": {"Level": "B2"},
    "spider": {"Level": "A2"},
    "monkey": {"Level": "A2"},
    "lion": {"Level": "A2"},
    "tiger": {"Level": "A2"},
    "elephant": {"Level": "A2"},
    "penguin": {"Level": "B1"},
    "kangaroo": {"Level": "B2"},
    "giraffe": {"Level": "B2"},
    "camel": {"Level": "B2"},
    "crocodile": {"Level": "B2"},
    "dolphin": {"Level": "B1"},
    "whale": {"Level": "B1"},
    "shark": {"Level": "B1"},
    "octopus": {"Level": "B2"},
}

def fetch_google_freq_list(url):
    print(f"Fetching Google 10,000 English word list from: {url}")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            lines = response.read().decode('utf-8').splitlines()
            return {word.strip().lower(): i for i, word in enumerate(lines)}
    except Exception as e:
        print(f"Error fetching Google frequency list: {e}")
        return None

def parse_ps_fillwords(path):
    print(f"Parsing standard CEFR lists from: {path}")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    fillwords = {}
    for lvl in ["A1", "A2", "B1"]:
        match = re.search(fr"'{lvl}'\s*=\s*@\(([^)]+)\)", content)
        if match:
            raw_words = match.group(1)
            words = re.findall(r"'([^']+)'", raw_words)
            if not words:
                words = [w.strip(" '\r\n\t") for w in raw_words.split(",")]
            fillwords[lvl] = {w.strip().lower() for w in words if w.strip()}
            print(f"  Parsed {len(fillwords[lvl])} standard words for {lvl}")
    return fillwords

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    # Load resources
    freq_map = fetch_google_freq_list(GOOGLE_FREQ_URL)
    if not freq_map:
        print("Failed to download frequency list. Aborting.")
        sys.exit(1)
        
    fillwords = parse_ps_fillwords(PS_PATH)
    if not fillwords:
        print("Failed to parse standard CEFR lists. Aborting.")
        sys.exit(1)

    with open(WORDS_ALL_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)
    print(f"Loaded {len(vocab)} words from source database.")

    # 1. Filter out phrases, acronyms, and blacklisted abbreviations
    filtered_vocab = []
    for w in vocab:
        engs = w.get("English")
        if not engs:
            continue
        primary_word = engs[0].strip()
        if ' ' in primary_word:
            continue
        if primary_word.lower() in BLACKLIST:
            continue
        filtered_vocab.append(w)
    print(f"Filtered out phrases and blacklisted abbreviations. Remaining entries: {len(filtered_vocab)}")

    # 2. Deduplicate primary English spellings
    unique_words = {}
    for item in filtered_vocab:
        engs = item.get("English", [])
        word = engs[0].strip().lower()
        
        def score_entry(x):
            roots_len = len(x.get("Roots", []))
            phonetic = x.get("Phonetic", "")
            has_real_phon = 1 if (phonetic and "/" in phonetic) else 0
            chinese_len = len(x.get("Chinese", ""))
            return (roots_len, has_real_phon, chinese_len)
            
        if word not in unique_words:
            unique_words[word] = item
        else:
            if score_entry(item) > score_entry(unique_words[word]):
                unique_words[word] = item
    vocab_list = list(unique_words.values())
    print(f"Deduplicated to unique single words: {len(vocab_list)}")

    # 3. Resolve cross-entry duplicate spellings on the entire list first
    seen_spellings = set()
    duplicate_spellings = set()
    for item in vocab_list:
        for s in item.get("English", []):
            s_lower = s.lower().strip()
            if s_lower in seen_spellings:
                duplicate_spellings.add(s_lower)
            else:
                seen_spellings.add(s_lower)
                
    if duplicate_spellings:
        print(f"Resolving {len(duplicate_spellings)} cross-entry duplicates...")
        for spelling in duplicate_spellings:
            matching_items = [
                item for item in vocab_list 
                if any(s.lower().strip() == spelling for s in item.get("English", []))
            ]
            def score_entry(x):
                roots_len = len(x.get("Roots", []))
                phonetic = x.get("Phonetic", "")
                has_real_phon = 1 if (phonetic and "/" in phonetic) else 0
                chinese_len = len(x.get("Chinese", ""))
                return (roots_len, has_real_phon, chinese_len)
            matching_items.sort(key=score_entry, reverse=True)
            # Remove the spelling from secondary items
            for item in matching_items[1:]:
                item["English"] = [s for s in item.get("English", []) if s.lower().strip() != spelling]
                
    # Remove any entries that became completely empty
    vocab_list = [w for w in vocab_list if w.get("English")]
    print(f"Cleaned unique single words list size: {len(vocab_list)}")

    # 4. Sort by Google frequency rank
    def get_rank(item):
        engs = item.get("English", [""])
        word = engs[0].strip().lower() if engs else ""
        return freq_map.get(word, 999999)
        
    vocab_list.sort(key=get_rank)

    # 5. Select exactly top 5000 (or all if fewer)
    selected_count = min(5000, len(vocab_list))
    top_5000 = vocab_list[:selected_count]
    print(f"Selected exactly top {selected_count} most common words.")

    # 6. Apply level classification & custom overrides & standard CEFR corrections
    for item in top_5000:
        engs = item.get("English", [])
        word = engs[0].strip().lower() if engs else ""
        
        # Determine base rank-based level
        rank = get_rank(item)
        if rank <= 1200:
            assigned_level = "A1"
        elif rank <= 3000:
            assigned_level = "A2"
        elif rank <= 5500:
            assigned_level = "B1"
        elif rank <= 8000:
            assigned_level = "B2"
        elif rank <= 10000:
            assigned_level = "C1"
        else:
            assigned_level = "C2"
            
        # Standard CEFR correction
        if word in fillwords["A1"]:
            assigned_level = "A1"
        elif word in fillwords["A2"]:
            assigned_level = "A2"
        elif word in fillwords["B1"]:
            assigned_level = "B1"
            
        item["Level"] = assigned_level
        
        # Apply custom overrides
        if word in CUSTOM_OVERRIDES:
            override = CUSTOM_OVERRIDES[word]
            if "Level" in override:
                item["Level"] = override["Level"]
            if "Chinese" in override:
                item["Chinese"] = override["Chinese"]

    # Sort final list by Level (A1-C2) then English alphabetically
    levels_list = ["A1", "A2", "B1", "B2", "C1", "C2"]
    def sort_key(x):
        lvl = x.get("Level", "A1")
        try:
            lvl_idx = levels_list.index(lvl)
        except ValueError:
            lvl_idx = 0
        eng = x.get("English", [""])[0]
        return (lvl_idx, eng.lower())
        
    top_5000.sort(key=sort_key)
    
    # Save back to both locations
    print(f"Saving final cleaned vocabulary to {WORDS_PATH}")
    with open(WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(top_5000, f, ensure_ascii=False, indent=2)
        
    print(f"Saving final cleaned vocabulary to {WEB_WORDS_PATH}")
    with open(WEB_WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(top_5000, f, ensure_ascii=False, indent=2)

    # Output level counts
    from collections import Counter
    counts = Counter(w.get("Level") for w in top_5000)
    print("\nRebuilt Word Count by Level:")
    for lvl in levels_list:
        print(f"  {lvl}: {counts.get(lvl, 0)}")
    print(f"  Total: {len(top_5000)}")

if __name__ == "__main__":
    main()
