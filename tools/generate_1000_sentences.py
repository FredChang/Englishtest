# -*- coding: utf-8 -*-
import json
import os

# 1000 High-Frequency Practical Spoken English Sentences with Traditional Chinese
sentences_data = []

# Helper to add sentences
def add_group(category, items):
    for en, zh in items:
        en_clean = en.strip()
        zh_clean = zh.strip()
        sentences_data.append({
            'id': len(sentences_data) + 1,
            'en': en_clean,
            'zh': zh_clean,
            'category': category
        })

# Let us build comprehensive groups
