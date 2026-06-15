# -*- coding: utf-8 -*-
import os
import sys
import json
import urllib.request
import zhconv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS_PATH = os.path.join(ROOT, "words.json")
WEB_WORDS_PATH = os.path.join(ROOT, "web", "words.json")
GAMEZXZ_URL = "https://raw.githubusercontent.com/Gamezxz/flashcard/main/data/vocabulary.json"

def fetch_external_vocab(url):
    print(f"Fetching external vocabulary from: {url}")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching external vocabulary: {e}")
        sys.exit(1)

def load_existing_vocab(path):
    print(f"Loading existing vocabulary from: {path}")
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading existing vocabulary: {e}")
        return []

def deduplicate_vocab(items):
    print("Deduplicating existing vocabulary...")
    groups = {}
    for item in items:
        engs = item.get("English", [])
        if not engs:
            continue
        word = engs[0].strip().lower()
        level = item.get("Level", "A1").upper().strip()
        key = (level, word)
        groups.setdefault(key, []).append(item)
    
    cleaned = []
    for key, group in groups.items():
        if len(group) == 1:
            cleaned.append(group[0])
        else:
            # Sort to find the best entry among duplicates
            # Criteria:
            # 1. Has roots (longer list of roots is better)
            # 2. Phonetic is not empty and is a real phonetic (contains / and not just /word/)
            # 3. Chinese translation length (longer is usually more descriptive)
            def score_entry(item):
                roots_len = len(item.get("Roots", []))
                
                phonetic = item.get("Phonetic", "")
                word = item.get("English", [""])[0].lower()
                has_real_phonetic = 0
                if phonetic and "/" in phonetic:
                    phon_clean = phonetic.strip("/")
                    if phon_clean != word:
                        has_real_phonetic = 1
                
                chinese_len = len(item.get("Chinese", ""))
                return (roots_len, has_real_phonetic, chinese_len)
            
            group.sort(key=score_entry, reverse=True)
            cleaned.append(group[0])
            
    print(f"Deduplicated existing vocabulary: {len(items)} -> {len(cleaned)} items.")
    return cleaned

def remove_cross_duplicates(items):
    print("Cleaning up cross-entry duplicate words at the same level...")
    levels_list = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    
    # Group by level
    by_level = {}
    for item in items:
        lvl = item.get("Level", "A1").upper().strip()
        by_level.setdefault(lvl, []).append(item)
        
    for lvl, lvl_items in by_level.items():
        # Count occurrences of each word spelling
        word_counts = {}
        for item in lvl_items:
            for eng in item.get("English", []):
                eng_clean = eng.strip().lower()
                word_counts[eng_clean] = word_counts.get(eng_clean, 0) + 1
                
        # Words that appear in more than one entry
        dup_words = {w for w, count in word_counts.items() if count > 1}
        if not dup_words:
            continue
            
        print(f"  Level {lvl} has duplicate spellings across entries: {dup_words}")
        
        for dup in dup_words:
            # Find all entries containing this word
            matching_entries = []
            for item in lvl_items:
                if any(e.strip().lower() == dup for e in item.get("English", [])):
                    matching_entries.append(item)
            
            # Sort matching entries to find which one is best to keep the word in
            # We prefer:
            # 1. An entry that is dedicated to this word (fewer words in its list)
            # 2. An entry with more roots
            # 3. An entry with real phonetic
            def score_for_dup(item):
                eng_count = len(item.get("English", []))
                roots_len = len(item.get("Roots", []))
                phonetic = item.get("Phonetic", "")
                has_real_phon = 1 if (phonetic and "/" in phonetic) else 0
                return (-eng_count, roots_len, has_real_phon)
                
            matching_entries.sort(key=score_for_dup, reverse=True)
            
            # Keep the word in matching_entries[0], and remove it from matching_entries[1:]
            best_entry = matching_entries[0]
            for other_entry in matching_entries[1:]:
                other_entry["English"] = [e for e in other_entry["English"] if e.strip().lower() != dup]
                print(f"    Removed '{dup}' from entry: {other_entry.get('English')} (kept in: {best_entry.get('English')})")
                
    # Filter out entries that ended up with an empty English list
    original_count = len(items)
    items = [item for item in items if item.get("English") and len(item["English"]) > 0]
    if len(items) < original_count:
        print(f"  Removed {original_count - len(items)} entries that became empty after deduplication.")
        
    return items

def main():
    # Set console encoding to UTF-8
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    existing_words = load_existing_vocab(WORDS_PATH)
    print(f"Loaded {len(existing_words)} existing words.")
    
    # Deduplicate existing words first
    existing_words = deduplicate_vocab(existing_words)

    # Create a lookup map for existing words to prevent adding duplicate spellings globally
    existing_map = {}
    for entry in existing_words:
        eng_list = entry.get("English", [])
        for eng in eng_list:
            if eng:
                existing_map[eng.strip().lower()] = entry

    # Fetch external words
    external_data = fetch_external_vocab(GAMEZXZ_URL)
    print(f"Fetched {len(external_data)} words from Gamezxz dataset.")

    new_added_count = 0
    levels_list = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

    for ext_entry in external_data:
        word = ext_entry.get("word")
        if not word:
            continue
        
        word_clean = word.strip()
        word_key = word_clean.lower()

        # If word is already in our existing dictionary, skip it to preserve existing custom content
        if word_key in existing_map:
            continue

        # Get level
        level = ext_entry.get("level", "A1").upper().strip()
        if level not in levels_list:
            level = "A1"

        # Get Chinese translation
        zh_translations = ext_entry.get("translations", {})
        zh_sim = zh_translations.get("zh", "").strip()
        if not zh_sim:
            # Skip if there's no Chinese translation
            continue
        
        # Convert Simplified Chinese to Traditional Chinese (Taiwan standard)
        zh_trad = zhconv.convert(zh_sim, 'zh-tw')

        # Get Phonetic (IPA)
        ipa = ext_entry.get("ipa", "").strip()
        phonetic = ""
        if ipa:
            phonetic = ipa if ipa.startswith("/") else f"/{ipa}/"

        # Construct new entry
        new_entry = {
            "Level": level,
            "Chinese": zh_trad,
            "English": [word_clean],
            "Phonetic": phonetic,
            "Roots": []
        }

        existing_words.append(new_entry)
        existing_map[word_key] = new_entry
        new_added_count += 1

    print(f"Added {new_added_count} new words.")
    
    # Run cross-entry deduplication before saving
    existing_words = remove_cross_duplicates(existing_words)
    
    print(f"Total vocabulary size is now {len(existing_words)}.")

    # Sort final list by Level (A1, A2, B1, B2, C1, C2) then English word alphabetically
    def sort_key(item):
        lvl = item.get("Level", "A1")
        try:
            lvl_idx = levels_list.index(lvl)
        except ValueError:
            lvl_idx = 0
        
        engs = item.get("English", [""])
        eng = engs[0] if engs else ""
        return (lvl_idx, eng.lower())

    existing_words.sort(key=sort_key)

    # Save to root words.json
    print(f"Saving merged vocabulary to: {WORDS_PATH}")
    with open(WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(existing_words, f, ensure_ascii=False, indent=2)

    # Save to web/words.json
    print(f"Saving merged vocabulary to: {WEB_WORDS_PATH}")
    os.makedirs(os.path.dirname(WEB_WORDS_PATH), exist_ok=True)
    with open(WEB_WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(existing_words, f, ensure_ascii=False, indent=2)

    print("Successfully completed vocabulary expansion!")

    # Verify counts by level
    from collections import Counter
    counts = Counter(w.get("Level", "A1") for w in existing_words)
    print("Final Word Count by Level:")
    for lvl in levels_list:
        print(f"  {lvl}: {counts.get(lvl, 0)}")

if __name__ == "__main__":
    main()
