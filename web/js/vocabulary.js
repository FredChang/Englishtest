const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MAX_QUESTIONS = 30;

function normalizeLevel(level) {
  if (!level || !String(level).trim()) return 'A1';
  const value = String(level).trim().toUpperCase();
  return CEFR_LEVELS.includes(value) ? value : 'A1';
}

function normalizeText(value) {
  return !value || !String(value).trim() ? '' : String(value).trim().toLowerCase();
}

export class VocabularyService {
  constructor() {
    this._items = [];
    this._sessionQueue = [];
    this._currentLevel = 'B1';
    this._sessionPosition = 0;
    this.sessionTotal = 0;
  }

  get currentLevel() {
    return this._currentLevel;
  }

  get countForCurrentLevel() {
    return this._getPoolIndices().length;
  }

  get sessionAnswered() {
    return this._sessionPosition;
  }

  get sessionRemaining() {
    return Math.max(0, this.sessionTotal - this.sessionAnswered);
  }

  get isSessionComplete() {
    return this.sessionTotal > 0 && this._sessionPosition >= this.sessionTotal;
  }

  get countByLevel() {
    const counts = {};
    for (const level of CEFR_LEVELS) {
      counts[level] = this._items.filter((i) => normalizeLevel(i.Level) === level).length;
    }
    return counts;
  }

  async load(wordsUrl = 'words.json') {
    this._items = [];
    this.clearSession();

    try {
      const res = await fetch(wordsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const loaded = await res.json();
      if (Array.isArray(loaded) && loaded.length > 0) {
        for (const item of loaded) {
          if (
            !item?.Chinese?.trim() ||
            !Array.isArray(item.English) ||
            !item.English.some((e) => e && String(e).trim())
          ) {
            continue;
          }
          item.Level = normalizeLevel(item.Level);
          this._items.push(item);
        }
        if (this._items.length > 0) return;
      }
    } catch {
      // fall through to defaults
    }

    this._items = [
      { Level: 'A1', Chinese: '蘋果', English: ['apple'] },
      { Level: 'A1', Chinese: '書', English: ['book'] },
      { Level: 'A1', Chinese: '水', English: ['water'] },
      { Level: 'A2', Chinese: '電腦', English: ['computer'] },
      { Level: 'B1', Chinese: '重要', English: ['important'] },
      { Level: 'B2', Chinese: '股票', English: ['stock'] }
    ];
  }

  setLevel(level) {
    this._currentLevel = normalizeLevel(level);
  }

  canStartSession(level, questionCount) {
    this.setLevel(level);
    return this._getPoolIndices().length > 0 && questionCount >= 1;
  }

  startSession(level, questionCount) {
    this.setLevel(level);
    const pool = this._getPoolIndices();
    if (pool.length === 0) {
      this.clearSession();
      return false;
    }

    let count = Math.max(1, questionCount);
    count = Math.min(count, MAX_QUESTIONS, pool.length);

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this._sessionQueue = shuffled.slice(0, count);
    this._sessionPosition = 0;
    this.sessionTotal = this._sessionQueue.length;
    return this.sessionTotal > 0;
  }

  getNextQuestion() {
    if (this.isSessionComplete || this._sessionQueue.length === 0) return null;
    const index = this._sessionQueue[this._sessionPosition++];
    return this._items[index];
  }

  checkAnswer(item, userInput) {
    const answers = (item?.English || [])
      .filter((e) => e && String(e).trim())
      .map(normalizeText);

    const correctDisplay = answers.length > 0 ? (item.English || []).join(' / ') : '';

    if (answers.length === 0 || !userInput?.trim()) {
      return { isCorrect: false, correctDisplay };
    }

    return {
      isCorrect: answers.includes(normalizeText(userInput)),
      correctDisplay
    };
  }

  checkChineseAnswer(item, userInput) {
    const answer = (item?.Chinese || '').trim();
    const input = (userInput || '').trim();
    const isCorrect =
      answer.length > 0 && input.length > 0 && answer.toLowerCase() === input.toLowerCase();
    return { isCorrect, correctDisplay: answer };
  }

  getDistractors(correct, count = 3) {
    const result = [];
    const usedChinese = new Set([normalizeText(correct.Chinese)]);
    const usedEnglish = new Set();
    for (const e of correct.English || []) usedEnglish.add(normalizeText(e));

    const sameLevel = this._items.filter(
      (i) => i !== correct && normalizeLevel(i.Level) === this._currentLevel
    );
    const otherLevel = this._items.filter(
      (i) => i !== correct && normalizeLevel(i.Level) !== this._currentLevel
    );
    const candidates = [
      ...this._shuffle(sameLevel),
      ...this._shuffle(otherLevel)
    ];

    for (const item of candidates) {
      if (result.length >= count) break;
      const chi = normalizeText(item.Chinese);
      const eng = normalizeText(primaryEnglish(item));
      if (!chi || !eng) continue;
      if (usedChinese.has(chi) || usedEnglish.has(eng)) continue;
      usedChinese.add(chi);
      usedEnglish.add(eng);
      result.push(item);
    }
    return result;
  }

  clearSession() {
    this._sessionQueue = [];
    this._sessionPosition = 0;
    this.sessionTotal = 0;
  }

  _getPoolIndices() {
    const pool = [];
    for (let i = 0; i < this._items.length; i++) {
      if (normalizeLevel(this._items[i].Level) === this._currentLevel) pool.push(i);
    }
    return pool;
  }

  _shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }
}

export function primaryEnglish(item) {
  if (!item?.English) return '';
  return item.English.find((e) => e && String(e).trim()) || '';
}

export function lookupWord(item) {
  let word = primaryEnglish(item);
  if (!word?.trim()) return null;
  word = word.trim();
  const space = word.indexOf(' ');
  return space > 0 ? word.substring(0, space) : word;
}
