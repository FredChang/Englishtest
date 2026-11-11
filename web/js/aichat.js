// AI 英文導師對話模組 (Gemini API 驅動)
// 支援 ChatGPT 風格介面、對話難度調整、NPC 探索交談遊戲模式 (隨機 3~5 項情報)、即時語法糾錯、語音辨識 (2秒靜音自動送出/自動標點) 與性別匹配朗讀

import { APP_VERSION } from './version.js';

const STORAGE_KEY_API_KEY = 'englishtest_gemini_api_key';
const STORAGE_KEY_MODEL = 'englishtest_gemini_model';
const STORAGE_KEY_TOPIC = 'englishtest_gemini_topic';
const STORAGE_KEY_DIFFICULTY = 'englishtest_gemini_difficulty';
const STORAGE_KEY_VOICE_AUTO = 'englishtest_gemini_voice_auto';

const DEFAULT_API_KEY = '';
const DEFAULT_MODEL = 'gemini-3.8-flash';

export const CHAT_TOPICS = [
  { id: 'npc_mystery', name: '🕵️ NPC 情緒與生活閒聊 (自然解鎖情報)', desc: '在輕鬆日常交談中認識 NPC，聊聊生活，解開身上隨機的 3～5 個未知祕密！', prompt: 'an interactive mystery NPC' },
  { id: 'free', name: '☕ 自由閒聊 (Free Talk)', desc: '輕鬆像朋友一樣聊聊日常生活、愛好與想法', prompt: 'a friendly, encouraging English-speaking friend chatting casually about daily life, hobbies, and ideas' },
  { id: 'cafe', name: '🍰 咖啡廳/餐廳點餐 (Cafe & Restaurant)', desc: '模擬在國外咖啡廳或餐廳向店員點餐詢問', prompt: 'a polite, helpful barista/waiter at an American cafe taking customer orders and offering suggestions' },
  { id: 'interview', name: '💼 英文求職面試 (Job Interview)', desc: '外商或英文職位面試練習，訓練精確回答', prompt: 'a professional hiring manager at an international tech company conducting a job interview with thoughtful follow-up questions' },
  { id: 'airport', name: '✈️ 機場與海關入境 (Airport & Travel)', desc: '模擬機場報到、問路及海關問答', prompt: 'an immigration officer and airline ground staff at an international airport checking passports and answering traveler questions' },
  { id: 'hotel', name: '🏨 飯店入住與旅遊諮詢 (Hotel & Concierge)', desc: '練習入住登記、房間問題反饋與行程建議', prompt: 'a warm and courteous hotel front desk receptionist helping guests check in and giving local travel recommendations' }
];

export const DIFFICULTY_LEVELS = {
  beginner: {
    name: '初級入門',
    speechRate: 0.85,
    prompt: `Level: BEGINNER (A1-A2).
- Use VERY SHORT, SIMPLE sentences (max 10-15 words per sentence).
- Limit vocabulary to common daily words (CEFR A1/A2). Avoid complex idioms, advanced slang, or long subordinate clauses.
- Keep responses friendly, warm, and brief (only 1 to 2 short sentences total).
- Ask only ONE very simple question so the user can easily reply with a few words.
- In grammar corrections: be very gentle. Only correct basic mistakes, and suggest very simple 3-5 word native alternatives.`
  },
  intermediate: {
    name: '中級實用',
    speechRate: 0.95,
    prompt: `Level: INTERMEDIATE (B1-B2).
- Speak naturally like a native speaker in everyday life.
- Sentences can be normal length with standard conversational phrases.
- Keep response around 2 to 3 sentences, followed by one engaging follow-up question.`
  },
  advanced: {
    name: '高級進階',
    speechRate: 1.0,
    prompt: `Level: ADVANCED (C1-C2).
- Use rich, precise vocabulary, natural idioms, and authentic phrasal verbs.
- Challenge the user with in-depth questions and nuanced grammar/phrasing corrections.`
  }
};

// 豐富的 NPC 秘密情報資料庫 (隨機抽取 3～5 個項目)
export const NPC_CANDIDATES = [
  {
    name: 'Chloe (克蘿伊)',
    gender: 'female',
    avatar: '👩‍🎨',
    items: [
      { key: 'job', label: '💼 職業 (Job)', answer: 'Illustrator (插畫家)', clue: 'draws pictures and children book covers on a tablet' },
      { key: 'hobby', label: '🎨 興趣 (Hobby)', answer: 'Baking bread (烘焙麵包)', clue: 'loves the smell of fresh yeast and ovens on Sunday mornings' },
      { key: 'pet', label: '🐱 寵物 (Pet)', answer: 'A fat orange cat (橘貓)', clue: 'has a chubby furry pet who loves knocking water cups over' },
      { key: 'drink', label: '☕ 最愛飲品 (Drink)', answer: 'Matcha latte (抹茶拿鐵)', clue: 'green Japanese tea with steamed milk and little sugar' },
      { key: 'city', label: '🏙️ 嚮往城市 (Dream City)', answer: 'Kyoto (京都)', clue: 'an ancient Japanese city with temples and autumn leaves' }
    ]
  },
  {
    name: 'Marcus (馬克思)',
    gender: 'male',
    avatar: '👨‍🍳',
    items: [
      { key: 'job', label: '💼 職業 (Job)', answer: 'Head Chef (主廚)', clue: 'spends all day in a hot kitchen cooking Italian pasta and steak' },
      { key: 'hobby', label: '🎸 興趣 (Hobby)', answer: 'Playing bass guitar (彈貝斯)', clue: 'plays thick 4-string musical instruments in an indie rock band' },
      { key: 'pet', label: '🐶 寵物 (Pet)', answer: 'Border Collie (邊境牧羊犬)', clue: 'a very smart dog who catches frisbees at the park' },
      { key: 'sport', label: '⚽ 最愛運動 (Sport)', answer: 'Rock climbing (攀岩)', clue: 'loves climbing artificial walls or outdoor boulders on weekends' }
    ]
  },
  {
    name: 'Sophie (蘇菲)',
    gender: 'female',
    avatar: '👩‍🔬',
    items: [
      { key: 'job', label: '💼 職業 (Job)', answer: 'Marine Biologist (海洋生物學家)', clue: 'studies dolphins, coral reefs, and ocean ecosystems' },
      { key: 'hobby', label: '📷 興趣 (Hobby)', answer: 'Scuba diving (水肺潛水)', clue: 'breathes through oxygen tanks exploring deep underwater caves' },
      { key: 'snack', label: '🍫 最愛零食 (Snack)', answer: 'Dark chocolate (黑巧克力)', clue: 'bitter-sweet cocoa bars above 85% purity' },
      { key: 'dream', label: '🏝️ 夢想 (Dream)', answer: 'Protect the coral reefs (守護珊瑚礁)', clue: 'wants to save colorful underwater ecosystems from bleaching' },
      { key: 'music', label: '🎵 音樂 (Music)', answer: 'Jazz music (爵士樂)', clue: 'smooth saxophone and piano melodies' }
    ]
  },
  {
    name: 'Leo (里歐)',
    gender: 'male',
    avatar: '👨‍💻',
    items: [
      { key: 'job', label: '💼 職業 (Job)', answer: 'Game Developer (遊戲工程師)', clue: 'writes C# code and designs 3D levels for indie video games' },
      { key: 'hobby', label: '🎮 興趣 (Hobby)', answer: 'Speedrunning RPGs (快通角色扮演遊戲)', clue: 'beats video games as fast as possible against the world clock' },
      { key: 'food', label: '🍕 最愛食物 (Food)', answer: 'Pepperoni pizza (義式臘腸披薩)', clue: 'cheesy flatbread topped with spicy round sausage slices' },
      { key: 'pet', label: '🦜 寵物 (Pet)', answer: 'Green Parrot (綠鸚鵡)', clue: 'a colorful feathered bird that repeats words and laughs' }
    ]
  },
  {
    name: 'Hannah (漢娜)',
    gender: 'female',
    avatar: '👩‍✈️',
    items: [
      { key: 'job', label: '💼 職業 (Job)', answer: 'Airline Pilot (民航機飛行員)', clue: 'flies commercial Boeing and Airbus planes at 35,000 feet' },
      { key: 'hobby', label: '🏃‍♀️ 興趣 (Hobby)', answer: 'Running marathons (跑馬拉松)', clue: 'runs 42 kilometers in big international city races' },
      { key: 'drink', label: '☕ 最愛飲品 (Drink)', answer: 'Double espresso (雙份義式濃縮)', clue: 'two strong bitter shots of coffee with thick golden crema' },
      { key: 'country', label: '🗺️ 最愛國家 (Favorite Country)', answer: 'Iceland (冰島)', clue: 'a cold Nordic island with glaciers, volcanoes, and northern lights' }
    ]
  }
];

function voiceNameHasWord(name, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(name);
}

export function classifyVoiceGender(voice) {
  const text = `${voice?.name || ''} ${voice?.voiceURI || ''}`.toLowerCase();
  if (!text.trim()) return 'unknown';

  // 女聲特徵字眼
  if (
    /female|woman|girl|女/i.test(text) ||
    /samantha|zira|hazel|jenny|amy|emma|aria|karen|victoria|susan|linda|catherine|joanna|stephanie|fiona|moira|tessa|ava|allison/i.test(text)
  ) {
    if (!voiceNameHasWord(text, 'male') || voiceNameHasWord(text, 'female')) {
      return 'female';
    }
  }

  // 男聲特徵字眼
  if (
    /male|man|boy|男/i.test(text) ||
    /daniel|brian|david|mark|james|guy|alex|fred|tom|john|george|robert|oliver|arthur|richard/i.test(text)
  ) {
    if (!voiceNameHasWord(text, 'female')) {
      return 'male';
    }
  }

  return 'unknown';
}

export function pickVoiceForGender(gender) {
  const want = gender === 'male' ? 'male' : 'female';
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if (!voices.length) return null;

  // 優先篩選英文語音
  const english = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('en') || name.includes('english') || name.includes('英文');
  });
  const pool = english.length ? english : voices;

  // 1. 精準匹配性別
  const matched = pool.filter((v) => classifyVoiceGender(v) === want);
  if (matched.length) return matched[0];

  // 2. 備用匹配方案
  if (want === 'male') {
    const labelMale = pool.filter((v) => {
      const n = (v.name || '').toLowerCase();
      return voiceNameHasWord(n, 'male') && !voiceNameHasWord(n, 'female');
    });
    if (labelMale.length) return labelMale[0];

    const notFemale = pool.filter((v) => classifyVoiceGender(v) !== 'female');
    if (notFemale.length > 1) return notFemale[1];
    if (notFemale.length) return notFemale[0];
  } else {
    const labelFemale = pool.filter((v) => voiceNameHasWord((v.name || '').toLowerCase(), 'female'));
    if (labelFemale.length) return labelFemale[0];

    const notMale = pool.filter((v) => classifyVoiceGender(v) !== 'male');
    if (notMale.length) return notMale[0];
  }

  return pool[0];
}

export class AiChatPractice {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('screen-aichat');
    this.onBack = options.onBack || (() => {});

    this.apiKey = localStorage.getItem(STORAGE_KEY_API_KEY) || DEFAULT_API_KEY;
    this.modelName = DEFAULT_MODEL; // 鎖定 gemini-3.8-flash
    this.currentTopic = localStorage.getItem(STORAGE_KEY_TOPIC) || 'npc_mystery';
    this.difficulty = localStorage.getItem(STORAGE_KEY_DIFFICULTY) || 'beginner';
    this.autoSpeak = localStorage.getItem(STORAGE_KEY_VOICE_AUTO) !== 'false';

    this.currentNpc = null;
    this.npcSlots = []; // [{ key, label, answer, clue, unlocked: bool }]

    this.messages = [];
    this.isGenerating = false;
    this.recognition = null;
    this.isRecording = false;
    this.silenceTimer = null;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        try { window.speechSynthesis.getVoices(); } catch (e) {}
      };
    }

    this.initElements();
    this.bindEvents();
    this.initSpeechRecognition();
  }

  initElements() {
    this.els = {
      backBtn: document.getElementById('aichat-back-btn'),
      settingsBtn: document.getElementById('aichat-settings-btn'),
      clearBtn: document.getElementById('aichat-clear-btn'),
      difficultySelect: document.getElementById('aichat-difficulty-select'),
      topicSelect: document.getElementById('aichat-topic-select'),
      messageList: document.getElementById('aichat-messages'),
      input: document.getElementById('aichat-input'),
      sendBtn: document.getElementById('aichat-send-btn'),
      micBtn: document.getElementById('aichat-mic-btn'),
      autoVoiceToggle: document.getElementById('aichat-autovoice-toggle'),
      
      // NPC 情節專屬 UI
      npcDossier: document.getElementById('aichat-npc-dossier'),
      npcAvatar: document.getElementById('aichat-npc-avatar'),
      npcName: document.getElementById('aichat-npc-name'),
      npcHint: document.getElementById('aichat-npc-hint'),
      npcSlotsContainer: document.getElementById('aichat-npc-slots'),
      npcNextBtn: document.getElementById('aichat-npc-next-btn'),

      // Settings modal
      settingsModal: document.getElementById('aichat-modal'),
      modalCloseBtn: document.getElementById('aichat-modal-close'),
      modalApiKeyInput: document.getElementById('aichat-modal-key-input'),
      modalModelSelect: document.getElementById('aichat-modal-model-select'),
      modalSaveBtn: document.getElementById('aichat-modal-save-btn'),
      modalResetKeyBtn: document.getElementById('aichat-modal-resetkey-btn')
    };

    if (this.els.difficultySelect) {
      this.els.difficultySelect.value = this.difficulty;
    }

    if (this.els.topicSelect) {
      this.els.topicSelect.innerHTML = CHAT_TOPICS.map(t => 
        `<option value="${t.id}" ${t.id === this.currentTopic ? 'selected' : ''}>${t.name}</option>`
      ).join('');
    }

    if (this.els.autoVoiceToggle) {
      this.els.autoVoiceToggle.checked = this.autoSpeak;
    }
  }

  bindEvents() {
    this.els.backBtn?.addEventListener('click', () => this.onBack());
    this.els.settingsBtn?.addEventListener('click', () => this.openSettingsModal());
    this.els.modalCloseBtn?.addEventListener('click', () => this.closeSettingsModal());
    this.els.modalSaveBtn?.addEventListener('click', () => this.saveSettingsFromModal());
    this.els.modalResetKeyBtn?.addEventListener('click', () => {
      if (this.els.modalApiKeyInput) {
        this.els.modalApiKeyInput.value = '';
      }
    });

    this.els.clearBtn?.addEventListener('click', () => {
      if (confirm('確定要清空當前對話紀錄嗎？')) {
        this.messages = [];
        this.renderMessages();
        this.sendGreeting();
      }
    });

    this.els.difficultySelect?.addEventListener('change', (e) => {
      this.difficulty = e.target.value;
      localStorage.setItem(STORAGE_KEY_DIFFICULTY, this.difficulty);
      this.messages = [];
      this.renderMessages();
      this.sendGreeting();
    });

    this.els.topicSelect?.addEventListener('change', (e) => {
      this.currentTopic = e.target.value;
      localStorage.setItem(STORAGE_KEY_TOPIC, this.currentTopic);
      this.messages = [];
      this.renderMessages();
      this.sendGreeting();
    });

    this.els.npcNextBtn?.addEventListener('click', () => {
      this.pickRandomNpc();
      this.messages = [];
      this.renderMessages();
      this.sendGreeting();
    });

    this.els.autoVoiceToggle?.addEventListener('change', (e) => {
      this.autoSpeak = e.target.checked;
      localStorage.setItem(STORAGE_KEY_VOICE_AUTO, this.autoSpeak ? 'true' : 'false');
    });

    this.els.sendBtn?.addEventListener('click', () => this.handleSendMessage());
    this.els.input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.els.micBtn?.addEventListener('click', () => this.toggleSpeechRecognition());
  }

  getVoiceGender() {
    if (this.currentTopic === 'npc_mystery' && this.currentNpc?.gender) {
      return this.currentNpc.gender;
    }
    return 'female';
  }

  pickRandomNpc() {
    const candidate = NPC_CANDIDATES[Math.floor(Math.random() * NPC_CANDIDATES.length)];
    this.currentNpc = candidate;

    // 隨機抽取 3～5 個項目
    const shuffledItems = [...candidate.items].sort(() => Math.random() - 0.5);
    const count = Math.min(shuffledItems.length, Math.max(3, Math.floor(Math.random() * 3) + 3)); // 3, 4 或 5 個
    this.npcSlots = shuffledItems.slice(0, count).map(it => ({
      key: it.key,
      label: it.label,
      answer: it.answer,
      clue: it.clue,
      unlocked: false
    }));

    this.renderNpcDossier();
  }

  renderNpcDossier() {
    if (!this.els.npcDossier) return;

    if (this.currentTopic !== 'npc_mystery') {
      this.els.npcDossier.classList.add('hidden');
      return;
    }

    this.els.npcDossier.classList.remove('hidden');
    if (this.els.npcAvatar) this.els.npcAvatar.textContent = this.currentNpc?.avatar || '🕵️';
    if (this.els.npcName) this.els.npcName.textContent = `聊天對象：${this.currentNpc?.name || '未知'}`;

    const allUnlocked = this.npcSlots.length > 0 && this.npcSlots.every(s => s.unlocked);

    let slotsHtml = this.npcSlots.map(slot => {
      if (slot.unlocked) {
        return `
          <div class="aichat-npc-slot unlocked">
            <div class="slot-label">${this.escapeHtml(slot.label)}</div>
            <div class="slot-value unlocked-text">✅ ${this.escapeHtml(slot.answer)}</div>
          </div>
        `;
      } else {
        return `
          <div class="aichat-npc-slot locked" title="自然閒聊中聊到相關話題即可解鎖！">
            <div class="slot-label">${this.escapeHtml(slot.label)}</div>
            <div class="slot-value locked-text">❓❓❓❓</div>
          </div>
        `;
      }
    }).join('');

    if (allUnlocked) {
      slotsHtml += `
        <div class="npc-victory-banner" style="grid-column: 1 / -1;">
          🎉 太棒了！您已在聊天中完整認識了 ${this.currentNpc.name}！點擊上方「🎲 換下一位 NPC」認識新朋友！
        </div>
      `;
    }

    if (this.els.npcSlotsContainer) {
      this.els.npcSlotsContainer.innerHTML = slotsHtml;
    }
  }

  deduplicatePhrases(text) {
    if (!text) return '';
    let str = text.replace(/\s+/g, ' ').trim();

    // 由短到長 (1 ~ 12 個單字) 骨牌式消除階梯累進重複與跳針重疊
    // 例如: "Okay okay good okay good night" -> "Okay good okay good night" -> "Okay good night"
    let changed = true;
    let guard = 0;
    while (changed && guard < 25) {
      changed = false;
      guard++;
      for (let wordsCount = 1; wordsCount <= 12; wordsCount++) {
        const pattern =
          wordsCount === 1
            ? /\b([\w']+)(?:[\s,.!?;:]+\1)+\b/gi
            : new RegExp(`\\b((?:[\\w']+[\\s,.!?;:]+){${wordsCount - 1}}[\\w']+)(?:[\\s,.!?;:]+\\1)+\\b`, 'gi');
        const next = str.replace(pattern, '$1');
        if (next !== str) {
          str = next;
          changed = true;
          break;
        }
      }
    }

    return str.trim();
  }

  formatSpeechTranscript(rawText, finalize = false) {
    if (!rawText) return '';
    let text = rawText.trim().replace(/\s+/g, ' ');

    // 0. 去除語音辨識重複跳針迴圈
    text = this.deduplicatePhrases(text);

    // 1. 首字大寫
    text = text.charAt(0).toUpperCase() + text.slice(1);

    // 2. 修正常見單字與縮寫（例如大寫 I 與常用縮寫）
    text = text.replace(/\bi\b/g, 'I');
    text = text.replace(/\bi'm\b/gi, "I'm");
    text = text.replace(/\bi've\b/gi, "I've");
    text = text.replace(/\bi'll\b/gi, "I'll");
    text = text.replace(/\bi'd\b/gi, "I'd");

    if (!finalize) {
      return text;
    }

    // 3. 自動依文意與語氣補齊結尾標點符號（問句補 ?，陳述句補 .）
    if (!/[.?!]$/.test(text)) {
      const isQuestion = /^(what|where|when|why|who|whom|whose|which|how|is|are|am|was|were|do|does|did|can|could|would|will|should|may|might|have|has|had|aren't|isn't|don't|doesn't|didn't|can't|won't)\b/i.test(text) ||
                         /,\s*(right|is it|isn't it|are you|aren't you|do you|don't you|can you|could you)\s*$/i.test(text);
      text += isQuestion ? '?' : '.';
    }

    return text;
  }

  isProgressiveRevision(prevClean, currClean) {
    if (!prevClean || !currClean) return false;
    if (currClean === prevClean || currClean.startsWith(prevClean)) return true;

    const prevWords = prevClean.split(' ').filter(Boolean);
    const currWords = currClean.split(' ').filter(Boolean);
    if (prevWords.length === 0 || currWords.length < prevWords.length) return false;

    // 若開頭單字相同，且前句有 60% 以上單字出現在後句，視為 Android 語音修正擴展而非新句子
    if (prevWords[0] === currWords[0]) {
      const currSet = new Set(currWords);
      const matchCount = prevWords.filter((w) => currSet.has(w)).length;
      if (matchCount / prevWords.length >= 0.6) {
        return true;
      }
    }
    return false;
  }

  extractTranscriptFromEvent(event) {
    if (!event || !event.results) return '';

    const finalPieces = [];
    let interimPiece = '';

    for (let i = 0; i < event.results.length; i++) {
      const res = event.results[i];
      const transcript = (res[0]?.transcript || '').trim();
      if (!transcript) continue;

      if (res.isFinal) {
        if (finalPieces.length > 0) {
          const prev = finalPieces[finalPieces.length - 1];
          const prevClean = prev.toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
          const currClean = transcript.toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();

          // 完全重複或前句已包含當前句 -> 跳過
          if (currClean === prevClean || prevClean.startsWith(currClean)) {
            continue;
          }

          // 累積式擴展（防範 Android Chrome bug：整句累積重送，如 "Okay" -> "Okay good" -> "Okay good night"）
          if (this.isProgressiveRevision(prevClean, currClean)) {
            finalPieces[finalPieces.length - 1] = transcript;
            continue;
          }
        }
        finalPieces.push(transcript);
      } else {
        interimPiece = transcript;
      }
    }

    let finalCombined = finalPieces.join(' ').trim();

    if (interimPiece) {
      const finalClean = finalCombined.toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
      const interimClean = interimPiece.toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();

      if (!finalClean) {
        return interimPiece;
      }
      if (interimClean === finalClean || finalClean.endsWith(interimClean) || finalClean.startsWith(interimClean)) {
        return finalCombined;
      }
      if (this.isProgressiveRevision(finalClean, interimClean)) {
        return interimPiece;
      }
      return `${finalCombined} ${interimPiece}`.trim();
    }

    return finalCombined;
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (this.els.micBtn) {
        this.els.micBtn.title = '此瀏覽器不支援語音辨識';
        this.els.micBtn.classList.add('disabled');
      }
    }
  }

  resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (!this.isRecording) return;

    this.silenceTimer = setTimeout(() => {
      const rawText = (this.els.input?.value || '').trim();
      if (rawText) {
        if (this.els.input) {
          this.els.input.value = this.formatSpeechTranscript(rawText, true);
        }
        this.stopSpeechRecognition();
        this.handleSendMessage();
      }
    }, 1600);
  }

  startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的瀏覽器不支援語音辨識（建議使用 Chrome / Safari / Edge）。');
      return;
    }

    this.stopSpeechRecognition();

    try {
      // 每次啟動皆建立全新的 SpeechRecognition 實例，並統一設定 continuous = false
      // 徹底杜絕 Android Chrome (含電腦版網站模式) 連續累積重送 partial result 的問題
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.els.micBtn?.classList.add('recording');
        if (this.els.input) {
          this.els.input.placeholder = '🎙️ 正在聆聽… (停頓約 1.5 秒將自動送出)';
        }
      };

      this.recognition.onresult = (event) => {
        const text = this.extractTranscriptFromEvent(event);
        if (text && this.els.input) {
          this.els.input.value = this.formatSpeechTranscript(text, false);
        }
        // 重新計時靜音自動送出
        this.resetSilenceTimer();
      };

      this.recognition.onerror = (err) => {
        if (err.error !== 'no-speech') {
          console.warn('Speech recognition error:', err);
          this.stopSpeechRecognition();
        }
      };

      this.recognition.onend = () => {
        const rawText = (this.els.input?.value || '').trim();
        if (this.isRecording && rawText) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          this.silenceTimer = setTimeout(() => {
            if (this.els.input) {
              this.els.input.value = this.formatSpeechTranscript(rawText, true);
            }
            this.stopSpeechRecognition();
            this.handleSendMessage();
          }, 800);
        } else if (this.isRecording) {
          this.stopSpeechRecognition();
        }
      };

      this.recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start failed:', e);
      this.stopSpeechRecognition();
    }
  }

  toggleSpeechRecognition() {
    if (this.isRecording) {
      const rawText = (this.els.input?.value || '').trim();
      this.stopSpeechRecognition();
      if (rawText) {
        if (this.els.input) {
          this.els.input.value = this.formatSpeechTranscript(rawText, true);
        }
        this.handleSendMessage();
      }
    } else {
      this.startSpeechRecognition();
    }
  }

  stopSpeechRecognition() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.isRecording = false;
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
    this.els.micBtn?.classList.remove('recording');
    if (this.els.input) {
      this.els.input.placeholder = '請輸入英文與 AI 導師交談… (支援語音輸入)';
    }
  }

  openSettingsModal() {
    if (this.els.modalApiKeyInput) {
      this.els.modalApiKeyInput.value = this.apiKey;
    }
    this.els.settingsModal?.classList.remove('hidden');
  }

  closeSettingsModal() {
    this.els.settingsModal?.classList.add('hidden');
  }

  saveSettingsFromModal() {
    const key = (this.els.modalApiKeyInput?.value || '').trim();
    const model = DEFAULT_MODEL;

    if (!key) {
      alert('請填入 Gemini API Key！');
      return;
    }

    this.apiKey = key;
    this.modelName = model;
    localStorage.setItem(STORAGE_KEY_API_KEY, this.apiKey);
    localStorage.setItem(STORAGE_KEY_MODEL, this.modelName);

    this.closeSettingsModal();
    alert('✅ AI 設定已儲存！');
  }

  start() {
    if (this.currentTopic === 'npc_mystery' && !this.currentNpc) {
      this.pickRandomNpc();
    }
    this.renderNpcDossier();

    if (this.messages.length === 0) {
      this.sendGreeting();
    } else {
      this.renderMessages();
    }
  }

  sendGreeting() {
    const topic = CHAT_TOPICS.find(t => t.id === this.currentTopic) || CHAT_TOPICS[0];
    const isBeginner = this.difficulty === 'beginner';

    if (this.currentTopic === 'npc_mystery') {
      if (!this.currentNpc) this.pickRandomNpc();
      this.renderNpcDossier();
    } else {
      this.renderNpcDossier();
    }

    let greeting = "";
    if (this.currentTopic === 'npc_mystery') {
      const npcFirstName = this.currentNpc.name.split(' ')[0];
      if (isBeginner) {
        if (npcFirstName === 'Chloe') greeting = "Hi! I'm Chloe. Nice to meet you! How's your day going?";
        else if (npcFirstName === 'Marcus') greeting = "Hello! I'm Marcus. Glad to meet you! What are you doing today?";
        else if (npcFirstName === 'Sophie') greeting = "Hi! I'm Sophie. Nice to meet you! How are you doing today?";
        else if (npcFirstName === 'Leo') greeting = "Hey! I'm Leo. Nice to meet you! Having a good day?";
        else greeting = `Hi there! I'm ${npcFirstName}. Great to meet you! How are you today?`;
      } else {
        if (npcFirstName === 'Chloe') greeting = "Hello! I'm Chloe. Lovely to meet you! Just taking a quick break with a warm drink. How is your day going so far?";
        else if (npcFirstName === 'Marcus') greeting = "Hey there! I'm Marcus. Great to meet you! Taking a breather after a busy morning. How is everything with you?";
        else if (npcFirstName === 'Sophie') greeting = "Hi there! I'm Sophie. Wonderful to meet you! Just finished reviewing some notes. What brings you by today?";
        else if (npcFirstName === 'Leo') greeting = "Hey! I'm Leo. Awesome to meet you! Just stretching my legs after coding at my desk. How's your day going?";
        else greeting = `Hello! I'm ${npcFirstName}. It's a pleasure to meet you! How are you doing today?`;
      }
    } else if (isBeginner) {
      if (topic.id === 'cafe') {
        greeting = "Hi! Welcome! What would you like to drink? (Coffee, tea, or water?)";
      } else if (topic.id === 'interview') {
        greeting = "Hello! Nice to meet you. What is your name?";
      } else if (topic.id === 'airport') {
        greeting = "Hello! Where are you flying today?";
      } else if (topic.id === 'hotel') {
        greeting = "Hi! Welcome to our hotel. Do you have a reservation?";
      } else {
        greeting = "Hi! Nice to meet you! How are you doing today?";
      }
    } else {
      if (topic.id === 'cafe') {
        greeting = "Hi, welcome to Central Perk Cafe! What can I get started for you today?";
      } else if (topic.id === 'interview') {
        greeting = "Hello! Thanks for coming in today. Could you briefly introduce yourself and tell me why you're interested in this position?";
      } else if (topic.id === 'airport') {
        greeting = "Good day! Welcome to border inspection. May I please see your passport and boarding pass?";
      } else if (topic.id === 'hotel') {
        greeting = "Good afternoon, welcome to Grand Hyatt. Are you checking in today?";
      } else {
        greeting = "Hello there! I'm your AI English Tutor. We can chat about anything you like! What's on your mind today?";
      }
    }

    this.messages.push({
      role: 'model',
      text: greeting
    });
    this.renderMessages();
    if (this.autoSpeak) {
      this.speakText(greeting, this.getVoiceGender());
    }
  }

  async handleSendMessage() {
    if (this.isGenerating) return;
    let text = (this.els.input?.value || '').trim();
    if (!text) return;

    // 自動補齊首字大寫與標點符號
    text = this.formatSpeechTranscript(text, true);

    if (!this.apiKey) {
      alert('請先點擊右上角「⚙️ 設定」填入您的 Gemini API Key！');
      this.openSettingsModal();
      return;
    }

    this.els.input.value = '';
    this.stopSpeechRecognition();

    // 1. 加入使用者訊息
    this.messages.push({
      role: 'user',
      text: text
    });
    this.renderMessages();

    // 2. 顯示等待骨架
    this.isGenerating = true;
    this.updateSendButtonState();
    const placeholderMsg = {
      role: 'model',
      text: 'Thinking...',
      isLoading: true
    };
    this.messages.push(placeholderMsg);
    this.renderMessages();

    try {
      const responseData = await this.callGeminiApi(text);
      this.messages.pop();

      // 更新 NPC 情報解鎖狀態
      if (this.currentTopic === 'npc_mystery' && Array.isArray(responseData.unlockedKeys)) {
        let hasNewUnlock = false;
        responseData.unlockedKeys.forEach(k => {
          const slot = this.npcSlots.find(s => s.key === k && !s.unlocked);
          if (slot) {
            slot.unlocked = true;
            hasNewUnlock = true;
          }
        });
        if (hasNewUnlock) {
          this.renderNpcDossier();
        }
      }

      this.messages.push({
        role: 'model',
        text: responseData.reply,
        grammar: responseData.grammar
      });
      this.renderMessages();

      if (this.autoSpeak && responseData.reply) {
        this.speakText(responseData.reply, this.getVoiceGender());
      }
    } catch (err) {
      this.messages.pop();
      console.error('Gemini API call failed:', err);
      this.messages.push({
        role: 'model',
        text: `⚠️ 回應失敗：${err.message || '連線錯誤'}。\n請點右上角 ⚙️ 檢查您的 Gemini API Key 是否正確。`
      });
      this.renderMessages();
    } finally {
      this.isGenerating = false;
      this.updateSendButtonState();
    }
  }

  updateSendButtonState() {
    if (this.els.sendBtn) {
      this.els.sendBtn.disabled = this.isGenerating;
      this.els.sendBtn.textContent = this.isGenerating ? '傳送中…' : '傳送';
    }
  }

  async callGeminiApi(userMessage) {
    const topic = CHAT_TOPICS.find(t => t.id === this.currentTopic) || CHAT_TOPICS[0];
    const diffConfig = DIFFICULTY_LEVELS[this.difficulty] || DIFFICULTY_LEVELS.beginner;

    let systemPrompt = '';

    if (this.currentTopic === 'npc_mystery') {
      const secretSummary = this.npcSlots.map(s => `- ${s.key} (${s.label}): ${s.answer} [Background Detail: ${s.clue}] Status: ${s.unlocked ? 'ALREADY UNLOCKED' : 'STILL HIDDEN (????)'}`).join('\n');
      const npcFirstName = this.currentNpc.name.split(' ')[0];

      systemPrompt = `You are roleplaying as ${npcFirstName} in a friendly, relaxed, and natural English conversation.
You are an authentic, warm person having a casual everyday chat with the user.

Your personal background & details (KEEP IN MIND, DO NOT RECITE OR FORCE UNLESS IT NATURALLY COMES UP):
${secretSummary}

CONVERSATION STYLE & CORE RULES:
1. FOCUS ON NATURAL CASUAL CHIT-CHAT (SMALL TALK FIRST):
   - Talk like an authentic, friendly peer chatting in a coffee shop or over lunch.
   - React warmly and naturally to what the user says (show empathy, laugh, comment on daily topics).
   - DO NOT turn this into a guessing game, quiz show, or interrogation!
   - NEVER say "Can you guess what I do?", "Guess my hobby!", or "Ask me about my secrets!". Keep the conversation completely natural, genuine, and organic.
2. ORGANIC INFORMATION SHARING:
   - Only mention your job, hobbies, pet, or favorites when the user asks about them or when it naturally connects to what you are talking about.
   - If the user asks directly (e.g. "What do you do for work?", "Do you have any pets?", "What music do you listen to?"), answer truthfully and cheerfully in your own voice, then bounce a question back to the user to keep the conversation flowing.
3. BACKGROUND DISCOVERY MECHANIC:
   - When the user asks about, discusses, or mentions a topic that matches any of your still-hidden secret items, answer naturally and include that item's key in the JSON "unlockedKeys" array.
   - If the user hasn't asked or touched upon any secret items in this turn, simply chat naturally and return "unlockedKeys": [].
4. STRICT DIFFICULTY LEVEL INSTRUCTIONS:
${diffConfig.prompt}
5. You MUST return your answer STRICTLY as a valid JSON object without markdown fences, with this structure:
{
  "reply": "Your conversational English reply (warm, authentic small talk, appropriate for the level).",
  "unlockedKeys": ["key1"], // Secret keys unlocked in this turn from [${this.npcSlots.map(s => `\"${s.key}\"`).join(', ')}]. If none, return [].
  "grammar": {
    "hasIssue": true/false,
    "userOriginal": "user sentence with error or null",
    "improved": "natural simple English or null",
    "explanationZh": "繁體中文簡要說明 or null"
  }
}`;
    } else {
      systemPrompt = `You are a supportive, friendly AI English Conversational Partner and Tutor.
Role context: You are roleplaying as ${topic.prompt}.

STRICT DIFFICULTY LEVEL INSTRUCTIONS:
${diffConfig.prompt}

Core Conversation Rules:
1. Always respond in English appropriate for the chosen difficulty level.
2. Review the user's latest English message for grammar mistakes, awkward phrasing, or typos.
3. Output your answer STRICTLY as a valid JSON object without markdown code blocks:
{
  "reply": "Your English reply in the roleplay context according to the difficulty level.",
  "grammar": {
    "hasIssue": true/false,
    "userOriginal": "the user sentence with mistakes or null if perfect",
    "improved": "natural native English version (simple and appropriate for this level) or null",
    "explanationZh": "繁體中文簡要說明 or null"
  }
}`;
    }

    const recentHistory = this.messages.slice(-8).filter(m => !m.isLoading).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelName)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const bodyData = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: recentHistory,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.6,
        maxOutputTokens: 800
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(errMsg);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('API 未回傳有效文字內容');
    }

    try {
      const cleaned = candidateText.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        reply: parsed.reply || candidateText,
        unlockedKeys: parsed.unlockedKeys || [],
        grammar: parsed.grammar?.hasIssue ? parsed.grammar : null
      };
    } catch (e) {
      return {
        reply: candidateText,
        unlockedKeys: [],
        grammar: null
      };
    }
  }

  renderMessages() {
    if (!this.els.messageList) return;

    this.els.messageList.innerHTML = this.messages.map((m, idx) => {
      const isUser = m.role === 'user';
      if (m.isLoading) {
        return `
          <div class="aichat-msg aichat-msg-model">
            <div class="aichat-avatar">🤖</div>
            <div class="aichat-bubble loading-dots">
              <span>●</span><span>●</span><span>●</span>
            </div>
          </div>
        `;
      }

      let grammarHtml = '';
      if (m.grammar && m.grammar.improved) {
        grammarHtml = `
          <div class="aichat-grammar-card">
            <div class="grammar-title">💡 英語導師筆記 (Grammar & Polish)</div>
            ${m.grammar.userOriginal ? `<div class="grammar-orig"><strong>原句：</strong>${this.escapeHtml(m.grammar.userOriginal)}</div>` : ''}
            <div class="grammar-suggest"><strong>推薦說法：</strong>✨ ${this.escapeHtml(m.grammar.improved)}</div>
            ${m.grammar.explanationZh ? `<div class="grammar-explain">${this.escapeHtml(m.grammar.explanationZh)}</div>` : ''}
          </div>
        `;
      }

      const avatarIcon = isUser ? '👤' : (this.currentTopic === 'npc_mystery' && this.currentNpc ? this.currentNpc.avatar : '🤖');

      return `
        <div class="aichat-msg ${isUser ? 'aichat-msg-user' : 'aichat-msg-model'}">
          <div class="aichat-avatar">${avatarIcon}</div>
          <div class="aichat-bubble-wrapper">
            <div class="aichat-bubble">
              <div class="aichat-text">${this.escapeHtml(m.text)}</div>
              ${!isUser ? `
                <button type="button" class="aichat-play-btn" data-idx="${idx}" title="朗讀此句">🔊 朗讀</button>
              ` : ''}
            </div>
            ${grammarHtml}
          </div>
        </div>
      `;
    }).join('');

    this.els.messageList.querySelectorAll('.aichat-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-idx'));
        const msg = this.messages[idx];
        if (msg?.text) {
          this.speakText(msg.text, this.getVoiceGender());
        }
      });
    });

    this.els.messageList.scrollTop = this.els.messageList.scrollHeight;
  }

  speakText(text, gender = null) {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const diffConfig = DIFFICULTY_LEVELS[this.difficulty] || DIFFICULTY_LEVELS.beginner;

    const u = new SpeechSynthesisUtterance(text.trim());
    u.lang = 'en-US';
    u.rate = diffConfig.speechRate || 0.85;

    const targetGender = gender || this.getVoiceGender();
    const voice = pickVoiceForGender(targetGender);
    if (voice) {
      u.voice = voice;
      if (voice.lang) u.lang = voice.lang;
    }

    window.speechSynthesis.speak(u);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br/>');
  }
}
