const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function normalizeLevel(level) {
  if (!level || !String(level).trim()) return 'A1';
  const value = String(level).trim().toUpperCase();
  return CEFR_LEVELS.includes(value) ? value : 'A1';
}

function primaryEnglish(item) {
  if (!item?.English) return '';
  return item.English.find((e) => e && String(e).trim()) || '';
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function titleCase(word) {
  const w = (word || '').trim();
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function safeWord(word) {
  return (word || '').toString().trim().replace(/\s+/g, ' ');
}

let _cached = null;

async function loadWordsOnce(wordsUrl = 'words.json') {
  if (_cached) return _cached;

  try {
    const res = await fetch(wordsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const loaded = await res.json();
    if (!Array.isArray(loaded)) throw new Error('Invalid words.json');

    const items = loaded
      .filter(
        (it) =>
          Array.isArray(it?.English) &&
          it.English.some((e) => e && String(e).trim()) &&
          it?.Level
      )
      .map((it) => ({
        Level: normalizeLevel(it.Level),
        English: it.English
      }));

    _cached = items;
    return items;
  } catch {
    // 回退：最少的可用詞彙，讓功能不會整個壞掉
    _cached = [
      { Level: 'A1', English: ['apple'] },
      { Level: 'A1', English: ['water'] },
      { Level: 'A2', English: ['computer'] },
      { Level: 'B1', English: ['important'] },
      { Level: 'B2', English: ['stock'] }
    ];
    return _cached;
  }
}

function poolForLevel(items, level) {
  const lvl = normalizeLevel(level);
  const pool = items
    .filter((it) => it.Level === lvl)
    .map((it) => safeWord(primaryEnglish(it)))
    .filter(Boolean);

  // 若該等級太少，允許借用相鄰等級
  if (pool.length >= 20) return pool;

  const idx = CEFR_LEVELS.indexOf(lvl);
  const neighbors = new Set([lvl]);
  if (idx > 0) neighbors.add(CEFR_LEVELS[idx - 1]);
  if (idx < CEFR_LEVELS.length - 1) neighbors.add(CEFR_LEVELS[idx + 1]);

  return items
    .filter((it) => neighbors.has(it.Level))
    .map((it) => safeWord(primaryEnglish(it)))
    .filter(Boolean);
}

function buildSentenceTemplates() {
  return [
    ({ w1, w2 }) => `Today I will practice English with the word ${w1} and the word ${w2}.`,
    ({ w1 }) => `I can say ${w1} clearly and calmly.`,
    ({ w1, w2 }) => `I hear ${w1}, I repeat it, and I remember ${w2}.`,
    ({ w1 }) => `I use ${w1} in a simple sentence.`,
    ({ w1, w2 }) => `I learn step by step, from ${w1} to ${w2}.`,
    ({ w1 }) => `I take a deep breath and speak ${w1} again.`,
    ({ w1, w2 }) => `I do not rush. I practice ${w1}, then ${w2}.`,
    ({ w1 }) => `My pronunciation of ${w1} gets better little by little.`,
    ({ w1, w2 }) => `I try to connect ideas: ${w1}, and also ${w2}.`,
    ({ w1 }) => `I am confident when I say ${w1}.`
  ];
}

export async function generateGuideArticle({
  level = 'B1',
  sentenceCount = 20,
  wordsUrl = 'words.json'
} = {}) {
  const items = await loadWordsOnce(wordsUrl);
  const pool = poolForLevel(items, level);
  const templates = buildSentenceTemplates();

  const count = Math.max(5, Math.min(120, Number(sentenceCount) || 20));
  const paragraphs = [];

  // 讓文章更像段落：每段 5 句
  const perPara = 5;
  let sentences = [];

  // 盡量避免一直重複同一個詞：先洗牌，並在不足時回圈取用
  const shuffledWords = shuffle(pool);
  let wordPtr = 0;
  const nextWord = () => {
    if (!shuffledWords.length) return 'practice';
    const w = shuffledWords[wordPtr % shuffledWords.length];
    wordPtr++;
    return w;
  };

  for (let i = 0; i < count; i++) {
    const w1 = nextWord();
    const w2 = nextWord();
    const tmpl = pick(templates);
    const sentence = tmpl({
      w1: safeWord(w1),
      w2: safeWord(w2)
    });
    sentences.push(titleCase(sentence));

    if (sentences.length === perPara) {
      paragraphs.push(sentences.join(' '));
      sentences = [];
    }
  }

  if (sentences.length) paragraphs.push(sentences.join(' '));

  const title = `Random Guide Reading (${normalizeLevel(level)})`;
  const fullText = `${title}\n\n${paragraphs.join('\n\n')}`.trim();

  return {
    title,
    level: normalizeLevel(level),
    sentenceCount: count,
    fullText
  };
}

