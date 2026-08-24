// 常用 1000 句練習模組
// 支援遮罩英文、遮罩句子（標記已學會排除出隨機循環名單）、發音朗讀與清單管理
import { APP_VERSION } from './version.js';

const STORAGE_KEY_MASKED = 'englishtest_masked_sentence_ids';
const STORAGE_KEY_MASK_EN_DEFAULT = 'englishtest_mask_english_default';

export class SentencesPractice {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('screen-sentences');
    this.onBack = options.onBack || (() => {});
    
    this.sentences = [];
    this.categories = [];
    this.maskedIds = new Set();
    this.maskEnglishGlobal = true;
    this.currentSentence = null;
    this.history = [];
    this.historyIndex = -1;
    this.currentCategory = 'all';
    this.mode = 'random'; // 'random' | 'sequential'
    this.sequentialIndex = 0;
    this.isRevealed = false;
    this.selectedVoice = null;
    this.speechRate = 1.0;

    this.modalFilter = 'all'; // 'all' | 'unmasked' | 'masked'
    this.modalSearchQuery = '';
    this.modalCategory = 'all';

    this.initElements();
    this.loadSettings();
    this.bindEvents();
    this.initSpeech();
  }

  initElements() {
    this.els = {
      backBtn: document.getElementById('sent-back-btn'),
      manageBtn: document.getElementById('sent-manage-btn'),
      statUnmasked: document.getElementById('sent-stat-unmasked'),
      statMasked: document.getElementById('sent-stat-masked'),
      categorySelect: document.getElementById('sent-category-select'),
      modeRandomBtn: document.getElementById('sent-mode-random'),
      modeSeqBtn: document.getElementById('sent-mode-seq'),
      maskEnToggle: document.getElementById('sent-mask-en-toggle'),

      // Card
      badgeId: document.getElementById('sent-badge-id'),
      badgeCat: document.getElementById('sent-badge-cat'),
      zhText: document.getElementById('sent-zh-text'),
      enContainer: document.getElementById('sent-en-container'),
      enText: document.getElementById('sent-en-text'),
      enMaskOverlay: document.getElementById('sent-en-mask-overlay'),
      revealBtn: document.getElementById('sent-reveal-btn'),
      playBtn: document.getElementById('sent-play-btn'),
      maskSentenceBtn: document.getElementById('sent-mask-sentence-btn'),
      maskStatusBadge: document.getElementById('sent-mask-status-badge'),

      // Nav
      prevBtn: document.getElementById('sent-prev-btn'),
      nextBtn: document.getElementById('sent-next-btn'),
      seqCounter: document.getElementById('sent-seq-counter'),

      // Modal
      modal: document.getElementById('sent-modal'),
      modalCloseBtn: document.getElementById('sent-modal-close-btn'),
      modalSearch: document.getElementById('sent-modal-search'),
      modalCatSelect: document.getElementById('sent-modal-cat-select'),
      modalTabAll: document.getElementById('sent-tab-all'),
      modalTabUnmasked: document.getElementById('sent-tab-unmasked'),
      modalTabMasked: document.getElementById('sent-tab-masked'),
      modalList: document.getElementById('sent-modal-list'),
      modalResetAllBtn: document.getElementById('sent-modal-reset-all-btn'),
      modalCountInfo: document.getElementById('sent-modal-count-info')
    };
  }

  loadSettings() {
    try {
      const savedMasked = localStorage.getItem(STORAGE_KEY_MASKED);
      if (savedMasked) {
        const ids = JSON.parse(savedMasked);
        this.maskedIds = new Set(ids);
      }
      const savedMaskEn = localStorage.getItem(STORAGE_KEY_MASK_EN_DEFAULT);
      if (savedMaskEn !== null) {
        this.maskEnglishGlobal = savedMaskEn === 'true';
      }
      if (this.els.maskEnToggle) {
        this.els.maskEnToggle.checked = this.maskEnglishGlobal;
      }
    } catch (e) {
      console.warn('Failed to load sentence settings from localStorage', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_MASKED, JSON.stringify(Array.from(this.maskedIds)));
      localStorage.setItem(STORAGE_KEY_MASK_EN_DEFAULT, String(this.maskEnglishGlobal));
    } catch (e) {
      console.warn('Failed to save sentence settings', e);
    }
  }

  async loadData() {
    if (this.sentences.length > 0) return;
    try {
      const candidates = [
        'data/sentences_1000.json',
        'sentences_1000.json',
        './data/sentences_1000.json',
        './sentences_1000.json',
        '../data/sentences_1000.json'
      ];

      let data = null;
      for (const p of candidates) {
        try {
          const res = await fetch(`${p}?v=${APP_VERSION}`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json) && json.length > 0) {
              data = json;
              break;
            }
          }
        } catch (err) {}
      }

      if (!data) {
        throw new Error('無法載入 sentences_1000.json 檔案');
      }

      this.sentences = data;

      const catSet = new Set();
      this.sentences.forEach(s => {
        if (s.category) catSet.add(s.category);
      });
      this.categories = Array.from(catSet);
      this.populateCategories();
      this.updateStats();
    } catch (err) {
      console.error('Failed to load sentences_1000.json', err);
      alert('載入 1000 句題庫失敗，請重新整理頁面或清除快取。');
    }
  }

  populateCategories() {
    if (!this.els.categorySelect) return;
    const optionsHtml = ['<option value="all">全部類別 (1000 句)</option>']
      .concat(this.categories.map(cat => {
        const count = this.sentences.filter(s => s.category === cat).length;
        return `<option value="${cat}">${cat} (${count}句)</option>`;
      }))
      .join('');
    this.els.categorySelect.innerHTML = optionsHtml;
    if (this.els.modalCatSelect) {
      this.els.modalCatSelect.innerHTML = optionsHtml;
    }
  }

  initSpeech() {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        this.selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira'))) 
          || voices.find(v => v.lang.startsWith('en')) || null;
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = this.speechRate;
    if (this.selectedVoice) {
      u.voice = this.selectedVoice;
    }
    window.speechSynthesis.speak(u);
  }

  bindEvents() {
    this.els.backBtn?.addEventListener('click', () => {
      window.speechSynthesis?.cancel();
      this.onBack();
    });

    this.els.manageBtn?.addEventListener('click', () => {
      this.openModal();
    });

    this.els.categorySelect?.addEventListener('change', (e) => {
      this.currentCategory = e.target.value;
      this.next();
    });

    this.els.modeRandomBtn?.addEventListener('click', () => {
      this.setMode('random');
    });

    this.els.modeSeqBtn?.addEventListener('click', () => {
      this.setMode('sequential');
    });

    this.els.maskEnToggle?.addEventListener('change', (e) => {
      this.maskEnglishGlobal = e.target.checked;
      this.saveSettings();
      this.renderEnglishMaskState();
    });

    this.els.enContainer?.addEventListener('click', () => {
      this.toggleReveal();
    });

    this.els.revealBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleReveal();
    });

    this.els.playBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentSentence) {
        this.speak(this.currentSentence.en);
      }
    });

    this.els.maskSentenceBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.currentSentence) return;
      this.toggleMaskSentence(this.currentSentence.id);
    });

    this.els.prevBtn?.addEventListener('click', () => {
      this.prev();
    });

    this.els.nextBtn?.addEventListener('click', () => {
      this.next();
    });

    window.addEventListener('keydown', (e) => {
      if (document.getElementById('screen-sentences')?.classList.contains('hidden')) return;
      if (this.els.modal && !this.els.modal.classList.contains('hidden')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault();
        this.next();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (this.currentSentence) this.speak(this.currentSentence.en);
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        this.toggleReveal();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (this.currentSentence) this.toggleMaskSentence(this.currentSentence.id);
      }
    });

    this.els.modalCloseBtn?.addEventListener('click', () => this.closeModal());
    this.els.modal?.addEventListener('click', (e) => {
      if (e.target === this.els.modal) this.closeModal();
    });

    this.els.modalSearch?.addEventListener('input', (e) => {
      this.modalSearchQuery = e.target.value.trim().toLowerCase();
      this.renderModalList();
    });

    this.els.modalCatSelect?.addEventListener('change', (e) => {
      this.modalCategory = e.target.value;
      this.renderModalList();
    });

    this.els.modalTabAll?.addEventListener('click', () => this.setModalTab('all'));
    this.els.modalTabUnmasked?.addEventListener('click', () => this.setModalTab('unmasked'));
    this.els.modalTabMasked?.addEventListener('click', () => this.setModalTab('masked'));

    this.els.modalResetAllBtn?.addEventListener('click', () => {
      if (this.maskedIds.size === 0) {
        alert('目前沒有任何已遮罩/已學會的句子。');
        return;
      }
      if (confirm(`確定要重設所有已遮罩句子嗎？\n這將把全部 ${this.maskedIds.size} 句已學會的句子重新放回隨機循環名單。`)) {
        this.maskedIds.clear();
        this.saveSettings();
        this.updateStats();
        this.renderModalList();
        this.updateCurrentCard();
      }
    });
  }

  setMode(newMode) {
    this.mode = newMode;
    if (this.els.modeRandomBtn && this.els.modeSeqBtn) {
      this.els.modeRandomBtn.classList.toggle('active', this.mode === 'random');
      this.els.modeSeqBtn.classList.toggle('active', this.mode === 'sequential');
    }
    if (this.els.nextBtn) {
      this.els.nextBtn.textContent = this.mode === 'random' ? '🎲 隨機下一句' : '➡️ 依序下一句';
    }
    if (this.sentences.length > 0) {
      this.next();
    }
  }

  getFilteredSentences(includeMasked = false) {
    return this.sentences.filter(s => {
      if (this.currentCategory !== 'all' && s.category !== this.currentCategory) {
        return false;
      }
      if (!includeMasked && this.maskedIds.has(s.id)) {
        return false;
      }
      return true;
    });
  }

  updateStats() {
    const total = this.sentences.length;
    const maskedCount = this.maskedIds.size;
    const unmaskedCount = total - maskedCount;

    if (this.els.statUnmasked) {
      this.els.statUnmasked.textContent = `${unmaskedCount}`;
    }
    if (this.els.statMasked) {
      this.els.statMasked.textContent = `${maskedCount}`;
    }
  }

  start() {
    this.updateStats();
    if (!this.currentSentence) {
      this.next();
    } else {
      this.updateCurrentCard();
    }
  }

  next() {
    const available = this.getFilteredSentences(false);

    if (available.length === 0) {
      const totalInCat = this.getFilteredSentences(true).length;
      if (totalInCat > 0) {
        this.renderAllLearnedState();
        return;
      } else {
        return;
      }
    }

    let nextSentence = null;

    if (this.mode === 'random') {
      if (available.length === 1) {
        nextSentence = available[0];
      } else {
        let attempts = 0;
        do {
          const randIdx = Math.floor(Math.random() * available.length);
          nextSentence = available[randIdx];
          attempts++;
        } while (this.currentSentence && nextSentence.id === this.currentSentence.id && attempts < 10);
      }
    } else {
      const allInCat = this.getFilteredSentences(true);
      if (this.sequentialIndex >= allInCat.length) {
        this.sequentialIndex = 0;
      }
      nextSentence = allInCat[this.sequentialIndex];
      this.sequentialIndex = (this.sequentialIndex + 1) % allInCat.length;
    }

    if (nextSentence) {
      this.history.push(nextSentence);
      this.historyIndex = this.history.length - 1;
      this.setCurrentSentence(nextSentence);
    }
  }

  prev() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const prevSentence = this.history[this.historyIndex];
      this.setCurrentSentence(prevSentence);
    }
  }

  setCurrentSentence(sentence) {
    this.currentSentence = sentence;
    this.isRevealed = !this.maskEnglishGlobal;
    this.updateCurrentCard();
    this.updateStats();
  }

  jumpToSentence(id) {
    const target = this.sentences.find(s => s.id === id);
    if (target) {
      this.history.push(target);
      this.historyIndex = this.history.length - 1;
      this.setCurrentSentence(target);
    }
  }

  toggleReveal() {
    this.isRevealed = !this.isRevealed;
    this.renderEnglishMaskState();
  }

  toggleMaskSentence(id) {
    if (this.maskedIds.has(id)) {
      this.maskedIds.delete(id);
    } else {
      this.maskedIds.add(id);
    }
    this.saveSettings();
    this.updateStats();
    this.updateCurrentCard();
  }

  renderEnglishMaskState() {
    if (!this.els.enContainer) return;
    
    if (!this.isRevealed && this.maskEnglishGlobal) {
      this.els.enContainer.classList.add('masked');
      this.els.enMaskOverlay?.classList.remove('hidden');
      if (this.els.revealBtn) {
        this.els.revealBtn.textContent = '👁️ 點擊揭曉英文';
        this.els.revealBtn.classList.remove('active');
      }
    } else {
      this.els.enContainer.classList.remove('masked');
      this.els.enMaskOverlay?.classList.add('hidden');
      if (this.els.revealBtn) {
        this.els.revealBtn.textContent = '🙈 遮罩英文';
        this.els.revealBtn.classList.add('active');
      }
    }
  }

  updateCurrentCard() {
    if (!this.currentSentence) return;
    const s = this.currentSentence;
    const isMasked = this.maskedIds.has(s.id);

    if (this.els.badgeId) this.els.badgeId.textContent = `#${s.id} / 1000`;
    if (this.els.badgeCat) this.els.badgeCat.textContent = s.category || '常用句子';
    if (this.els.zhText) this.els.zhText.textContent = s.zh;
    if (this.els.enText) this.els.enText.textContent = s.en;

    if (this.els.maskSentenceBtn) {
      if (isMasked) {
        this.els.maskSentenceBtn.className = 'btn-learned active';
        this.els.maskSentenceBtn.innerHTML = '✅ 已學會 (已遮罩，不入隨機名單)';
      } else {
        this.els.maskSentenceBtn.className = 'btn-learned';
        this.els.maskSentenceBtn.innerHTML = '⚪ 標記已學會 (遮罩此句排除)';
      }
    }

    if (this.els.prevBtn) {
      this.els.prevBtn.disabled = this.historyIndex <= 0;
    }

    if (this.els.seqCounter) {
      const allInCat = this.getFilteredSentences(true);
      const idxInCat = allInCat.findIndex(item => item.id === s.id);
      this.els.seqCounter.textContent = `${idxInCat + 1} / ${allInCat.length}`;
    }

    this.renderEnglishMaskState();
  }

  renderAllLearnedState() {
    if (this.els.zhText) {
      this.els.zhText.textContent = '🎉 太棒了！您已經學會此類別下的所有句子！';
    }
    if (this.els.enText) {
      this.els.enText.textContent = 'All sentences in this category are marked as learned (masked).';
    }
    if (this.els.badgeId) this.els.badgeId.textContent = '100% 完成';
    if (this.els.badgeCat) this.els.badgeCat.textContent = this.currentCategory;
    if (this.els.maskSentenceBtn) {
      this.els.maskSentenceBtn.className = 'btn-learned';
      this.els.maskSentenceBtn.innerHTML = '📋 開啟清單解除遮罩以重新練習';
      this.els.maskSentenceBtn.onclick = () => this.openModal();
    }
  }

  openModal() {
    if (!this.els.modal) return;
    this.els.modal.classList.remove('hidden');
    this.renderModalList();
  }

  closeModal() {
    if (!this.els.modal) return;
    this.els.modal.classList.add('hidden');
    this.updateStats();
    this.updateCurrentCard();
  }

  setModalTab(tab) {
    this.modalFilter = tab;
    [this.els.modalTabAll, this.els.modalTabUnmasked, this.els.modalTabMasked].forEach(t => t?.classList.remove('active'));
    if (tab === 'all') this.els.modalTabAll?.classList.add('active');
    if (tab === 'unmasked') this.els.modalTabUnmasked?.classList.add('active');
    if (tab === 'masked') this.els.modalTabMasked?.classList.add('active');
    this.renderModalList();
  }

  renderModalList() {
    if (!this.els.modalList) return;

    let list = this.sentences.filter(s => {
      if (this.modalCategory !== 'all' && s.category !== this.modalCategory) {
        return false;
      }
      const isMasked = this.maskedIds.has(s.id);
      if (this.modalFilter === 'unmasked' && isMasked) return false;
      if (this.modalFilter === 'masked' && !isMasked) return false;

      if (this.modalSearchQuery) {
        const q = this.modalSearchQuery;
        const matchEn = s.en.toLowerCase().includes(q);
        const matchZh = s.zh.toLowerCase().includes(q);
        const matchId = String(s.id) === q;
        if (!matchEn && !matchZh && !matchId) return false;
      }
      return true;
    });

    if (this.els.modalCountInfo) {
      this.els.modalCountInfo.textContent = `共符合 ${list.length} 句（已遮罩: ${this.maskedIds.size} / 總數: 1000）`;
    }

    if (list.length === 0) {
      this.els.modalList.innerHTML = '<div class="sent-list-empty">無符合條件的句子</div>';
      return;
    }

    const renderItems = list.slice(0, 300);
    const html = renderItems.map(s => {
      const isMasked = this.maskedIds.has(s.id);
      return `
        <div class="sent-list-item ${isMasked ? 'is-masked' : ''}" data-id="${s.id}">
          <div class="sent-item-main">
            <div class="sent-item-meta">
              <span class="sent-item-id">#${s.id}</span>
              <span class="sent-item-cat">${s.category}</span>
              ${isMasked ? '<span class="sent-item-tag-masked">已遮罩/已學會</span>' : '<span class="sent-item-tag-unmasked">循環中</span>'}
            </div>
            <div class="sent-item-zh">${s.zh}</div>
            <div class="sent-item-en">${s.en}</div>
          </div>
          <div class="sent-item-actions">
            <button type="button" class="sent-item-play-btn" data-action="play" data-en="${encodeURIComponent(s.en)}" title="朗讀發音">🔊</button>
            <button type="button" class="sent-item-mask-toggle-btn ${isMasked ? 'masked' : ''}" data-action="toggle-mask" data-id="${s.id}" title="切換遮罩狀態">
              ${isMasked ? '✅ 已學會' : '⚪ 遮罩此句'}
            </button>
            <button type="button" class="sent-item-jump-btn" data-action="jump" data-id="${s.id}" title="前往練習">👉 練習</button>
          </div>
        </div>
      `;
    }).join('');

    this.els.modalList.innerHTML = html;

    this.els.modalList.querySelectorAll('.sent-list-item').forEach(el => {
      const id = Number(el.getAttribute('data-id'));
      
      el.querySelector('[data-action="play"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const en = decodeURIComponent(e.currentTarget.getAttribute('data-en'));
        this.speak(en);
      });

      el.querySelector('[data-action="toggle-mask"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMaskSentence(id);
        this.renderModalList();
      });

      el.querySelector('[data-action="jump"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.jumpToSentence(id);
        this.closeModal();
      });

      el.addEventListener('click', () => {
        this.jumpToSentence(id);
        this.closeModal();
      });
    });
  }
}
