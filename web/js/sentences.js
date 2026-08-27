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

    // Speech recognition for pronunciation practice
    this.recognition = null;
    this.isRecording = false;
    this.speechRecognitionSupported = false;

    this.modalFilter = 'all'; // 'all' | 'unmasked' | 'masked'
    this.modalSearchQuery = '';
    this.modalCategory = 'all';

    this.initElements();
    this.loadSettings();
    this.bindEvents();
    this.initSpeech();
    this.initSpeechRecognition();
  }

  initElements() {
    this.els = {
      backBtn: document.getElementById('sent-back-btn'),
      compactBtn: document.getElementById('sent-compact-btn'),
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
      recordBtn: document.getElementById('sent-record-btn'),
      maskSentenceBtn: document.getElementById('sent-mask-sentence-btn'),
      maskStatusBadge: document.getElementById('sent-mask-status-badge'),

      // Eval panel
      evalPanel: document.getElementById('sent-eval-panel'),
      evalStatus: document.getElementById('sent-eval-status'),
      evalStatusText: document.getElementById('sent-eval-status-text'),
      evalResult: document.getElementById('sent-eval-result'),
      evalScoreBadge: document.getElementById('sent-eval-score-badge'),
      evalScoreNum: document.getElementById('sent-eval-score-num'),
      evalGrade: document.getElementById('sent-eval-grade'),
      evalSummary: document.getElementById('sent-eval-summary'),
      evalWords: document.getElementById('sent-eval-words'),
      evalTranscriptText: document.getElementById('sent-eval-transcript-text'),

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
      const savedCompact = localStorage.getItem('englishtest_compact_mode');
      if (savedCompact !== null) {
        this.compactMode = savedCompact === 'true';
      }
      this.applyCompactMode();
    } catch (e) {
      console.warn('Failed to load sentence settings from localStorage', e);
    }
  }

  toggleCompactMode() {
    this.compactMode = !this.compactMode;
    try {
      localStorage.setItem('englishtest_compact_mode', String(this.compactMode));
    } catch (e) {}
    this.applyCompactMode();
  }

  applyCompactMode() {
    if (!this.container) return;
    this.container.classList.toggle('compact-mode', !!this.compactMode);
    if (this.els.compactBtn) {
      this.els.compactBtn.innerHTML = this.compactMode ? '📋 標準模式' : '✨ 簡潔模式';
      this.els.compactBtn.title = this.compactMode ? '切換為標準模式' : '切換為簡潔模式';
      this.els.compactBtn.classList.toggle('btn-primary', !!this.compactMode);
      this.els.compactBtn.classList.toggle('btn-secondary', !this.compactMode);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_MASKED, JSON.stringify(Array.from(this.maskedIds)));
      localStorage.setItem(STORAGE_KEY_MASK_EN_DEFAULT, String(this.maskEnglishGlobal));
      localStorage.setItem('englishtest_compact_mode', String(!!this.compactMode));
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
    const total = this.sentences.length;
    const optionsHtml = [`<option value="all">全部類別 (${total} 句)</option>`]
      .concat(this.categories.map(cat => {
        const count = this.sentences.filter(s => s.category === cat).length;
        return `<option value="${cat}">${cat} (${count}句)</option>`;
      }))
      .join('');
    this.els.categorySelect.innerHTML = optionsHtml;
    if (this.els.modalCatSelect) {
      this.els.modalCatSelect.innerHTML = optionsHtml;
    }
    if (this.els.modalTabAll) {
      this.els.modalTabAll.textContent = `全部 (${total})`;
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

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechRecognitionSupported = !!SpeechRecognition;
  }

  toggleRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的瀏覽器暫不支援 Web Speech API 語音辨識。\n建議使用 Chrome、Edge 或 Safari 瀏覽器以獲得最佳口說練習體驗。');
      return;
    }

    if (this.isRecording) {
      this.stopRecording();
      return;
    }

    this.startRecording();
  }

  startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop any existing instance
    this.stopRecording();

    // Automatically reveal English so user can read it
    if (!this.isRevealed) {
      this.isRevealed = true;
      this.renderEnglishMaskState();
    }

    this.resetEvalPanel();
    if (this.els.evalPanel) {
      this.els.evalPanel.classList.remove('hidden');
    }
    this.showEvalStatus('正在聆聽您的發音… 請清晰朗讀英文句子');

    this.accumulatedTranscript = '';
    this.evaluated = false;

    try {
      // Create a FRESH instance every time for iOS Safari and Android Chrome stability
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.continuous = false;

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.updateRecordButtonUI(true);
      };

      this.recognition.onresult = (event) => {
        let currentFinal = '';
        let currentInterim = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            currentFinal += res[0].transcript + ' ';
          } else {
            currentInterim += res[0].transcript;
          }
        }

        const bestText = (currentFinal || currentInterim || '').trim();
        if (bestText) {
          this.accumulatedTranscript = bestText;
          this.showEvalStatus(`🎙️ 聽到：「${bestText}」...`);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'no-speech') {
          if (!this.accumulatedTranscript && !this.evaluated) {
            this.showEvalStatus('⚠️ 沒有偵測到聲音，請靠近麥克風再試一次。', 'warning');
          }
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.showEvalStatus('🚫 請允許瀏覽器麥克風權限以進行發音練習。', 'error');
        } else if (event.error !== 'aborted') {
          if (!this.accumulatedTranscript && !this.evaluated) {
            this.showEvalStatus(`⚠️ 語音辨識發生錯誤 (${event.error})，請再試一次。`, 'error');
          }
        }
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        this.updateRecordButtonUI(false);
        this.clearRecordTimeout();

        // Process accumulated transcript if available
        if (this.accumulatedTranscript && !this.evaluated && this.currentSentence) {
          this.evaluated = true;
          this.evaluatePronunciation(this.accumulatedTranscript, this.currentSentence.en);
        } else if (!this.evaluated && (!this.els.evalStatus || (!this.els.evalStatus.classList.contains('warning') && !this.els.evalStatus.classList.contains('error')))) {
          this.showEvalStatus('⚠️ 未偵測到清晰語音，請靠近麥克風並清晰朗讀。', 'warning');
        }
      };

      this.recognition.start();

      // Safety timeout: auto-stop after 8 seconds of recording
      this.clearRecordTimeout();
      this.recordTimeout = setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, 8000);

    } catch (err) {
      console.warn('Failed to start speech recognition', err);
      this.isRecording = false;
      this.updateRecordButtonUI(false);
      this.showEvalStatus('⚠️ 無法啟動語音辨識，請重新整理頁面後再試。', 'error');
    }
  }

  stopRecording() {
    this.clearRecordTimeout();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isRecording = false;
    this.updateRecordButtonUI(false);

    // If we have text and haven't evaluated yet, evaluate immediately
    if (this.accumulatedTranscript && !this.evaluated && this.currentSentence) {
      this.evaluated = true;
      this.evaluatePronunciation(this.accumulatedTranscript, this.currentSentence.en);
    }
  }

  clearRecordTimeout() {
    if (this.recordTimeout) {
      clearTimeout(this.recordTimeout);
      this.recordTimeout = null;
    }
  }

  updateRecordButtonUI(recording) {
    if (!this.els.recordBtn) return;
    if (recording) {
      this.els.recordBtn.classList.add('recording');
      this.els.recordBtn.innerHTML = '⏹️ 停止錄音';
      this.els.recordBtn.title = '點擊停止錄音 (快捷鍵: S)';
    } else {
      this.els.recordBtn.classList.remove('recording');
      this.els.recordBtn.innerHTML = '🎤 錄音評分';
      this.els.recordBtn.title = '錄音練習發音比對 (快捷鍵: S)';
    }
  }

  showEvalStatus(text, type = 'normal') {
    if (!this.els.evalPanel || !this.els.evalStatusText) return;
    this.els.evalPanel.classList.remove('hidden');
    this.els.evalStatus?.classList.remove('hidden', 'warning', 'error');
    if (type !== 'normal') {
      this.els.evalStatus?.classList.add(type);
    }
    this.els.evalStatusText.textContent = text;
  }

  resetEvalPanel() {
    this.clearRecordTimeout();
    this.accumulatedTranscript = '';
    this.evaluated = false;
    if (this.els.evalPanel) this.els.evalPanel.classList.add('hidden');
    if (this.els.evalResult) this.els.evalResult.classList.add('hidden');
    if (this.els.evalStatus) this.els.evalStatus.classList.remove('hidden', 'warning', 'error');
  }

  evaluatePronunciation(userTranscript, targetSentence) {
    if (!userTranscript || !targetSentence) return;

    const contractionsMap = {
      "i'm": ["i", "am"],
      "it's": ["it", "is"],
      "don't": ["do", "not"],
      "doesn't": ["does", "not"],
      "didn't": ["did", "not"],
      "can't": ["can", "not"],
      "won't": ["will", "not"],
      "i've": ["i", "have"],
      "you've": ["you", "have"],
      "we've": ["we", "have"],
      "they've": ["they", "have"],
      "i'll": ["i", "will"],
      "you'll": ["you", "will"],
      "he'll": ["he", "will"],
      "she'll": ["she", "will"],
      "we'll": ["we", "will"],
      "they'll": ["they", "will"],
      "you're": ["you", "are"],
      "we're": ["we", "are"],
      "they're": ["they", "are"],
      "what's": ["what", "is"],
      "how's": ["how", "is"],
      "where's": ["where", "is"],
      "there's": ["there", "is"],
      "that's": ["that", "is"],
      "let's": ["let", "us"],
      "couldn't": ["could", "not"],
      "wouldn't": ["would", "not"],
      "shouldn't": ["should", "not"],
      "haven't": ["have", "not"],
      "hasn't": ["has", "not"],
      "aren't": ["are", "not"],
      "isn't": ["is", "not"],
      "wasn't": ["was", "not"],
      "weren't": ["were", "not"]
    };

    const clean = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '').trim();

    const levenshtein = (a, b) => {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    const targetRawTokens = targetSentence.trim().split(/\s+/);
    const spokenTokens = userTranscript.trim().split(/\s+/).map(clean).filter(Boolean);

    let spokenIdx = 0;
    let matchedWeight = 0;
    const wordResults = [];

    for (let i = 0; i < targetRawTokens.length; i++) {
      const raw = targetRawTokens[i];
      const targetClean = clean(raw);
      if (!targetClean) continue;

      let status = 'miss';
      let bestMatchIdx = -1;

      // Lookahead window in spoken tokens (up to 4 tokens ahead)
      const maxLookahead = Math.min(spokenTokens.length, spokenIdx + 4);
      for (let j = spokenIdx; j < maxLookahead; j++) {
        const spoken = spokenTokens[j];
        if (spoken === targetClean) {
          status = 'match';
          bestMatchIdx = j;
          break;
        }

        // Check contractions
        if (contractionsMap[targetClean] && contractionsMap[targetClean].includes(spoken)) {
          status = 'match';
          bestMatchIdx = j;
          break;
        }
        if (contractionsMap[spoken] && contractionsMap[spoken].includes(targetClean)) {
          status = 'match';
          bestMatchIdx = j;
          break;
        }

        // Check fuzzy distance
        const dist = levenshtein(targetClean, spoken);
        if (dist === 1 || (dist === 2 && targetClean.length >= 6)) {
          status = 'near';
          bestMatchIdx = j;
          break;
        }
      }

      if (status !== 'miss' && bestMatchIdx !== -1) {
        spokenIdx = bestMatchIdx + 1;
        if (status === 'match') {
          matchedWeight += 1.0;
        } else if (status === 'near') {
          matchedWeight += 0.8;
        }
      }

      wordResults.push({
        raw,
        status
      });
    }

    const totalWords = targetRawTokens.length || 1;
    const score = Math.min(100, Math.max(0, Math.round((matchedWeight / totalWords) * 100)));

    this.renderPronunciationResult({
      score,
      wordResults,
      userTranscript
    });
  }

  renderPronunciationResult({ score, wordResults, userTranscript }) {
    if (!this.els.evalPanel) return;

    this.els.evalPanel.classList.remove('hidden');
    this.els.evalStatus?.classList.add('hidden');
    this.els.evalResult?.classList.remove('hidden');

    if (this.els.evalScoreNum) {
      this.els.evalScoreNum.textContent = String(score);
    }

    let gradeText = '';
    let gradeClass = '';
    let summaryText = '';

    if (score >= 90) {
      gradeText = '🌟 優秀 (Excellent!)';
      gradeClass = 'grade-excellent';
      summaryText = '太棒了！發音非常清晰且標準！';
    } else if (score >= 75) {
      gradeText = '👍 良好 (Good!)';
      gradeClass = 'grade-good';
      summaryText = '很不錯！絕大多數單字發音正確。';
    } else if (score >= 50) {
      gradeText = '⚠️ 還行 (Keep Trying)';
      gradeClass = 'grade-average';
      summaryText = '還可以，注意標紅的單字再試一次！';
    } else {
      gradeText = '🔄 需加強 (Try Again)';
      gradeClass = 'grade-poor';
      summaryText = '請再試一次，試著放慢語速、清晰朗讀。';
    }

    if (this.els.evalScoreBadge) {
      this.els.evalScoreBadge.className = `sent-eval-score-badge ${gradeClass}`;
    }
    if (this.els.evalGrade) {
      this.els.evalGrade.textContent = gradeText;
    }
    if (this.els.evalSummary) {
      this.els.evalSummary.textContent = summaryText;
    }

    if (this.els.evalWords) {
      this.els.evalWords.innerHTML = wordResults.map(item => {
        const title = item.status === 'match' ? '發音正確' : (item.status === 'near' ? '發音相近' : '未辨識到或發音不準');
        return `<span class="word-chip ${item.status}" title="${title}">${item.raw}</span>`;
      }).join(' ');
    }

    if (this.els.evalTranscriptText) {
      this.els.evalTranscriptText.textContent = `"${userTranscript}"`;
    }
  }

  bindEvents() {
    this.els.backBtn?.addEventListener('click', () => {
      window.speechSynthesis?.cancel();
      this.stopRecording();
      this.onBack();
    });

    this.els.compactBtn?.addEventListener('click', () => {
      this.toggleCompactMode();
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

    this.els.recordBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleRecording();
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
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.toggleRecording();
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
    this.stopRecording();
    this.resetEvalPanel();
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

    if (this.els.badgeId) this.els.badgeId.textContent = `#${s.id} / ${this.sentences.length}`;
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
      this.els.modalCountInfo.textContent = `共符合 ${list.length} 句（已遮罩: ${this.maskedIds.size} / 總數: ${this.sentences.length}）`;
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
