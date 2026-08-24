# -*- coding: utf-8 -*-
with open('web/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

ids = [
  'sentences-open-btn',
  'screen-sentences',
  'sent-back-btn',
  'sent-manage-btn',
  'sent-stat-unmasked',
  'sent-stat-masked',
  'sent-category-select',
  'sent-mode-random',
  'sent-mode-seq',
  'sent-mask-en-toggle',
  'sent-badge-id',
  'sent-badge-cat',
  'sent-zh-text',
  'sent-en-container',
  'sent-en-text',
  'sent-en-mask-overlay',
  'sent-reveal-btn',
  'sent-play-btn',
  'sent-mask-sentence-btn',
  'sent-prev-btn',
  'sent-next-btn',
  'sent-seq-counter',
  'sent-modal',
  'sent-modal-close-btn',
  'sent-modal-search',
  'sent-modal-cat-select',
  'sent-tab-all',
  'sent-tab-unmasked',
  'sent-tab-masked',
  'sent-modal-list',
  'sent-modal-reset-all-btn',
  'sent-modal-count-info'
]

for i in ids:
    target = f'id="{i}"'
    if target not in html:
        print('MISSING ID:', i)
    else:
        print('OK:', i)
