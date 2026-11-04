// AI 英文導師對話模組 (Gemini API 驅動)
// 支援 ChatGPT 風格介面、即時英語交談、語法與用詞建議、語音輸入與語音朗讀

import { APP_VERSION } from './version.js';

const STORAGE_KEY_API_KEY = 'englishtest_gemini_api_key';
const STORAGE_KEY_MODEL = 'englishtest_gemini_model';
const STORAGE_KEY_TOPIC = 'englishtest_gemini_topic';
const STORAGE_KEY_VOICE_AUTO = 'englishtest_gemini_voice_auto';

// 預設金鑰 (可由使用者在設定彈窗中自訂或更換)
const DEFAULT_API_KEY = '';
const DEFAULT_MODEL = 'gemini-2.0-flash'; // 速度極快且支援最新多輪對話

export const CHAT_TOPICS = [
  { id: 'free', name: '☕ 自由閒聊 (Free Talk)', desc: '輕鬆像朋友一樣聊聊日常生活、愛好與想法', prompt: 'a friendly, encouraging English-speaking friend chatting casually about daily life, hobbies, and ideas' },
  { id: 'cafe', name: '🍰 咖啡廳/餐廳點餐 (Cafe & Restaurant)', desc: '模擬在國外咖啡廳或餐廳向店員點餐詢問', prompt: 'a polite, helpful barista/waiter at an American cafe taking customer orders and offering suggestions' },
  { id: 'interview', name: '💼 英文求職面試 (Job Interview)', desc: '外商或英文職位面試練習，訓練精確回答', prompt: 'a professional hiring manager at an international tech company conducting a job interview with thoughtful follow-up questions' },
  { id: 'airport', name: '✈️ 機場與海關入境 (Airport & Travel)', desc: '模擬機場報到、問路及海關問答', prompt: 'an immigration officer and airline ground staff at an international airport checking passports and answering traveler questions' },
  { id: 'hotel', name: '🏨 飯店入住與旅遊諮詢 (Hotel & Concierge)', desc: '練習入住登記、房間問題反饋與行程建議', prompt: 'a warm and courteous hotel front desk receptionist helping guests check in and giving local travel recommendations' }
];

export class AiChatPractice {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('screen-aichat');
    this.onBack = options.onBack || (() => {});

    this.apiKey = localStorage.getItem(STORAGE_KEY_API_KEY) || DEFAULT_API_KEY;
    this.modelName = localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL;
    this.currentTopic = localStorage.getItem(STORAGE_KEY_TOPIC) || 'free';
    this.autoSpeak = localStorage.getItem(STORAGE_KEY_VOICE_AUTO) !== 'false';

    this.messages = []; // [{ role: 'user'|'model', text: '', grammar?: { hasIssue, userOriginal, improved, explanationZh } }]
    this.isGenerating = false;
    this.recognition = null;
    this.isRecording = false;

    this.initElements();
    this.bindEvents();
    this.initSpeechRecognition();
  }

  initElements() {
    this.els = {
      backBtn: document.getElementById('aichat-back-btn'),
      settingsBtn: document.getElementById('aichat-settings-btn'),
      clearBtn: document.getElementById('aichat-clear-btn'),
      topicSelect: document.getElementById('aichat-topic-select'),
      messageList: document.getElementById('aichat-messages'),
      input: document.getElementById('aichat-input'),
      sendBtn: document.getElementById('aichat-send-btn'),
      micBtn: document.getElementById('aichat-mic-btn'),
      autoVoiceToggle: document.getElementById('aichat-autovoice-toggle'),
      
      // Settings modal
      settingsModal: document.getElementById('aichat-modal'),
      modalCloseBtn: document.getElementById('aichat-modal-close'),
      modalApiKeyInput: document.getElementById('aichat-modal-key-input'),
      modalModelSelect: document.getElementById('aichat-modal-model-select'),
      modalSaveBtn: document.getElementById('aichat-modal-save-btn'),
      modalResetKeyBtn: document.getElementById('aichat-modal-resetkey-btn')
    };

    // 初始化主題選單
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

    this.els.topicSelect?.addEventListener('change', (e) => {
      this.currentTopic = e.target.value;
      localStorage.setItem(STORAGE_KEY_TOPIC, this.currentTopic);
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

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (this.els.micBtn) {
        this.els.micBtn.title = '此瀏覽器不支援語音辨識';
        this.els.micBtn.classList.add('disabled');
      }
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.els.micBtn?.classList.add('recording');
        if (this.els.input) this.els.input.placeholder = '🎙️ 正在聆聽您的英文語音…';
      };

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (this.els.input) {
          this.els.input.value = transcript;
        }
      };

      this.recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err);
        this.stopSpeechRecognition();
      };

      this.recognition.onend = () => {
        this.stopSpeechRecognition();
      };
    } catch (e) {
      console.warn('SpeechRecognition init failed:', e);
    }
  }

  toggleSpeechRecognition() {
    if (!this.recognition) {
      alert('您的瀏覽器不支援語音辨識（建議使用 Chrome / Safari / Edge）。');
      return;
    }
    if (this.isRecording) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Recognition start error:', e);
      }
    }
  }

  stopSpeechRecognition() {
    this.isRecording = false;
    this.els.micBtn?.classList.remove('recording');
    if (this.els.input) this.els.input.placeholder = '請輸入英文與 AI 導師交談… (支援語音輸入)';
  }

  openSettingsModal() {
    if (this.els.modalApiKeyInput) {
      this.els.modalApiKeyInput.value = this.apiKey;
    }
    if (this.els.modalModelSelect) {
      this.els.modalModelSelect.value = this.modelName;
    }
    this.els.settingsModal?.classList.remove('hidden');
  }

  closeSettingsModal() {
    this.els.settingsModal?.classList.add('hidden');
  }

  saveSettingsFromModal() {
    const key = (this.els.modalApiKeyInput?.value || '').trim();
    const model = (this.els.modalModelSelect?.value || '').trim() || DEFAULT_MODEL;

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
    if (this.messages.length === 0) {
      this.sendGreeting();
    } else {
      this.renderMessages();
    }
  }

  sendGreeting() {
    const topic = CHAT_TOPICS.find(t => t.id === this.currentTopic) || CHAT_TOPICS[0];
    let greeting = "Hello there! I'm your AI English Tutor. We can chat about anything you like! What's on your mind today?";
    if (topic.id === 'cafe') {
      greeting = "Hi, welcome to Central Perk Cafe! What can I get started for you today?";
    } else if (topic.id === 'interview') {
      greeting = "Hello! Thanks for coming in today. Could you briefly introduce yourself and tell me why you're interested in this position?";
    } else if (topic.id === 'airport') {
      greeting = "Good day! Welcome to border inspection. May I please see your passport and boarding pass?";
    } else if (topic.id === 'hotel') {
      greeting = "Good afternoon, welcome to Grand Hyatt. Are you checking in today?";
    }

    this.messages.push({
      role: 'model',
      text: greeting
    });
    this.renderMessages();
    if (this.autoSpeak) {
      this.speakText(greeting);
    }
  }

  async handleSendMessage() {
    if (this.isGenerating) return;
    const text = (this.els.input?.value || '').trim();
    if (!text) return;

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

    // 2. 顯示等待骨架/打字中
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
      // 替換 placeholder
      this.messages.pop();

      this.messages.push({
        role: 'model',
        text: responseData.reply,
        grammar: responseData.grammar
      });
      this.renderMessages();

      if (this.autoSpeak && responseData.reply) {
        this.speakText(responseData.reply);
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

    // 構建 System Prompt：要求以嚴格 JSON 格式輸出，同時包含自然英文回應與語法糾錯建議
    const systemPrompt = `You are an expert, encouraging AI English Tutor and conversational partner.
Role context: You are roleplaying as ${topic.prompt}.
Your conversation guidelines:
1. Keep the conversation natural, friendly, and engaging.
2. Ask one relevant follow-up question to keep the chat going.
3. Review the user's latest English message for grammatical errors, awkward collocations, or unnatural phrasing.
4. Output your answer STRICTLY as a valid JSON object without markdown fences, following this JSON structure:
{
  "reply": "Your natural English response to the user in the roleplay context.",
  "grammar": {
    "hasIssue": true/false,
    "userOriginal": "the user sentence with mistakes or null if perfect",
    "improved": "natural native English version or null",
    "explanationZh": "繁體中文簡要說明錯誤原因（如時態、單複數、介系詞或母語者更地道的說法），若完全正確請填 null"
  }
}
Note: If the user writes in Chinese, politely answer in English and guide them to practice speaking English.`;

    // 整理歷史對話（保留最近 8 輪）
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
        temperature: 0.7,
        maxOutputTokens: 1000
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
        grammar: parsed.grammar?.hasIssue ? parsed.grammar : null
      };
    } catch (e) {
      return {
        reply: candidateText,
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

      return `
        <div class="aichat-msg ${isUser ? 'aichat-msg-user' : 'aichat-msg-model'}">
          <div class="aichat-avatar">${isUser ? '👤' : '🤖'}</div>
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

    // 綁定朗讀按鈕
    this.els.messageList.querySelectorAll('.aichat-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-idx'));
        const msg = this.messages[idx];
        if (msg?.text) {
          this.speakText(msg.text);
        }
      });
    });

    // 滾動到底部
    this.els.messageList.scrollTop = this.els.messageList.scrollHeight;
  }

  speakText(text) {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text.trim());
    u.lang = 'en-US';
    u.rate = 0.95;

    const voices = window.speechSynthesis.getVoices() || [];
    const enVoice = voices.find(v => (v.lang || '').startsWith('en-US')) || 
                    voices.find(v => (v.lang || '').startsWith('en'));
    if (enVoice) {
      u.voice = enVoice;
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
