/** Web Speech 語音選擇（含 Android Chrome 相容） */

const VOICE_URI_STORAGE_KEY = 'guide-voice-uri';

export function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent);
}

export function normalizeLang(lang) {
  return (lang || 'en-US').replace(/_/g, '-');
}

function voiceNameHasWord(name, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`, 'i').test(name);
}

export function classifyVoiceGender(voice) {
  const name = (voice?.name || '').toLowerCase();
  const uri = (voice?.voiceURI || '').toLowerCase();
  const combined = `${name} ${uri}`;
  if (!combined.trim()) return 'unknown';

  const femaleWords = [
    'female', 'woman', 'girl', 'zira', 'hazel', 'jenny', 'mary', 'susan', 'amy',
    'emily', 'aria', 'sara', 'ava', 'victoria', 'karen', 'michelle', 'zoe',
    'samantha', 'linda', 'helen', 'catherine', 'moira', 'fiona', 'nicky', 'kate',
    'serena', 'tessa', '女'
  ];
  const maleWords = [
    'male', 'man', 'boy', 'david', 'jeff', 'tom', 'john', 'mark', 'paul', 'daniel',
    'robert', 'james', 'george', 'kenneth', 'roger', 'thomas', 'guy', 'ryan',
    'richard', 'christopher', 'martin', 'liam', 'aaron', 'alex', 'fred', 'nathan',
    'oliver', 'brian', 'eddy', 'reed', 'gordon', 'arthur', 'grandpa', '男'
  ];

  if (femaleWords.some((w) => voiceNameHasWord(combined, w))) return 'female';
  if (maleWords.some((w) => voiceNameHasWord(combined, w))) return 'male';
  return 'unknown';
}

export function getAllVoices() {
  return window.speechSynthesis?.getVoices?.() || [];
}

export function getEnglishVoices() {
  const all = getAllVoices();
  const english = all.filter((v) => {
    const lang = normalizeLang(v.lang).toLowerCase();
    const name = (v.name || '').toLowerCase();
    const uri = (v.voiceURI || '').toLowerCase();
    return (
      lang.startsWith('en') ||
      name.includes('english') ||
      name.includes('en-') ||
      name.includes('英文') ||
      name.includes('英語') ||
      uri.includes('en-') ||
      uri.includes('en_')
    );
  });
  if (english.length >= 2) return english;

  const relaxed = all.filter((v) => {
    const lang = normalizeLang(v.lang).toLowerCase();
    return !lang || (!lang.startsWith('zh') && !lang.startsWith('ja') && !lang.startsWith('ko'));
  });
  return relaxed.length ? relaxed : all;
}

const PRIORITY_MALE_KEYS = [
  'english male', 'en-us male', 'en-gb male', 'en_us male', 'en_gb male',
  'google us english male', 'google uk english male', 'daniel', 'alex', 'fred',
  'david', 'mark', 'james', 'tom', 'aaron', 'gordon', 'eddy', 'reed', 'nathan',
  'oliver', 'brian', 'arthur', 'grandpa', '-gba', '-gbb', 'male'
];

const PRIORITY_FEMALE_KEYS = [
  'english female', 'en-us female', 'en-gb female', 'en_us female', 'en_gb female',
  'google us english female', 'google uk english female', 'samantha', 'zira', 'hazel',
  'karen', 'victoria', 'aria', 'jenny', 'susan', 'nicky', 'kate', 'serena', 'tessa',
  'female'
];

function voiceFieldIncludesKey(name, uri, key) {
  if (key.length <= 4) {
    return voiceNameHasWord(name, key) || voiceNameHasWord(uri, key);
  }
  return name.includes(key) || uri.includes(key);
}

function pickPriorityVoice(voices, keys, excludeFemaleForMale = false) {
  for (const key of keys) {
    const found = voices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const uri = (v.voiceURI || '').toLowerCase();
      if (!voiceFieldIncludesKey(name, uri, key)) return false;
      if (excludeFemaleForMale && classifyVoiceGender(v) === 'female') return false;
      return true;
    });
    if (found) return found;
  }
  return null;
}

export function resolveVoiceForGender(gender, voices = getEnglishVoices()) {
  const want = gender === 'male' ? 'male' : 'female';
  if (!voices.length) return { voice: null, pitch: want === 'male' ? 0.75 : 1.0 };

  if (want === 'male') {
    const priority = pickPriorityVoice(voices, PRIORITY_MALE_KEYS, true);
    if (priority) return { voice: priority, pitch: 1.0 };

    const males = voices.filter((v) => classifyVoiceGender(v) === 'male');
    if (males.length) return { voice: males[0], pitch: 1.0 };

    // Android 常無 male 標記：英國英語有時比美國英語更像男聲
    const gb = voices.find((v) => normalizeLang(v.lang).toLowerCase().startsWith('en-gb'));
    if (gb && classifyVoiceGender(gb) !== 'female') return { voice: gb, pitch: 0.95 };

    const notFemale = voices.filter((v) => classifyVoiceGender(v) !== 'female');
    if (notFemale.length > 1) return { voice: notFemale[1], pitch: 0.9 };
    if (notFemale.length === 1) return { voice: notFemale[0], pitch: 0.8 };

    return { voice: voices[0], pitch: 0.75 };
  }

  const priority = pickPriorityVoice(voices, PRIORITY_FEMALE_KEYS);
  if (priority) return { voice: priority, pitch: 1.0 };

  const females = voices.filter((v) => classifyVoiceGender(v) === 'female');
  if (females.length) return { voice: females[0], pitch: 1.0 };

  return { voice: voices[0], pitch: 1.0 };
}

export function findVoiceByUri(voiceURI) {
  if (!voiceURI) return null;
  return getAllVoices().find((v) => v.voiceURI === voiceURI) || null;
}

export function loadSavedVoiceUri() {
  try {
    return localStorage.getItem(VOICE_URI_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveVoiceUri(voiceURI) {
  try {
    if (voiceURI) localStorage.setItem(VOICE_URI_STORAGE_KEY, voiceURI);
    else localStorage.removeItem(VOICE_URI_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Android Chrome 必須同時設定 voice + lang（來自語音本身，不可硬編 en-US）
 * @see https://dev.to/jankapunkt/cross-browser-speech-synthesis-the-hard-way-and-the-easy-way-353
 */
export function applyVoiceToUtterance(utterance, voice, { gender = 'female', pitch = 1.0 } = {}) {
  if (voice) {
    const fresh = findVoiceByUri(voice.voiceURI) || voice;
    utterance.voice = fresh;
    utterance.lang = normalizeLang(fresh.lang) || 'en-US';
  } else if (gender === 'male' && isAndroidBrowser()) {
    utterance.lang = 'en-GB';
  } else {
    utterance.lang = 'en-US';
  }
  utterance.pitch = pitch;
  return voice;
}

export function formatVoiceLabel(voice) {
  const gender = classifyVoiceGender(voice);
  const tag =
    gender === 'male' ? '男' : gender === 'female' ? '女' : '?';
  const lang = normalizeLang(voice.lang);
  return `${voice.name || '未知語音'}（${tag} · ${lang}）`;
}

export function waitForVoices(timeoutMs = 1200) {
  const existing = getAllVoices();
  if (existing.length) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(getAllVoices());
    };

    const prev = window.speechSynthesis.onvoiceschanged;
    window.speechSynthesis.onvoiceschanged = () => {
      if (typeof prev === 'function') prev();
      finish();
    };
    window.speechSynthesis.getVoices();
    setTimeout(finish, timeoutMs);
  });
}

export function speakWithVoice(utterance, { cancelFirst = false } = {}) {
  if (cancelFirst) window.speechSynthesis.cancel();
  const start = () => window.speechSynthesis.speak(utterance);
  if (isAndroidBrowser()) {
    setTimeout(start, cancelFirst ? 100 : 0);
  } else {
    start();
  }
}
