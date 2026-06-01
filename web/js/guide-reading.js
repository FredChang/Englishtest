import {
  parseContent,
  loadSavedGuideContent,
  hasSavedGuideContent,
  formatSavedSummary,
  applyLoadedContent,
  clearSavedGuideContent
} from './guide-content.js';
import { generateGuideArticle } from './guide-generate.js';

function speedLabelFromRate(value) {
  const v = Number(value);
  return `${v.toFixed(1)}x`;
}

/** 以單字邊界比對，避免 "david" 誤判含 "ava"、"female" 誤判含 "male" */
function voiceNameHasWord(name, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`, 'i').test(name);
}

function classifyVoiceGender(voice) {
  const name = (voice?.name || '').toLowerCase();
  if (!name) return 'unknown';

  const femaleWords = [
    'female',
    'woman',
    'girl',
    'zira',
    'hazel',
    'jenny',
    'mary',
    'susan',
    'amy',
    'emily',
    'aria',
    'sara',
    'ava',
    'victoria',
    'karen',
    'michelle',
    'zoe',
    'samantha',
    'linda',
    'helen',
    'catherine',
    'moira',
    'fiona',
    'nicky',
    'kate',
    'serena',
    'tessa'
  ];
  const maleWords = [
    'male',
    'man',
    'boy',
    'david',
    'jeff',
    'tom',
    'john',
    'mark',
    'paul',
    'daniel',
    'robert',
    'james',
    'george',
    'kenneth',
    'roger',
    'thomas',
    'guy',
    'ryan',
    'richard',
    'christopher',
    'martin',
    'liam',
    'aaron',
    'alex',
    'fred',
    'nathan',
    'oliver',
    'brian',
    'eddy',
    'reed',
    'gordon',
    'arthur'
  ];

  if (femaleWords.some((w) => voiceNameHasWord(name, w))) return 'female';
  if (maleWords.some((w) => voiceNameHasWord(name, w))) return 'male';
  return 'unknown';
}

function getEnglishVoices() {
  const all = window.speechSynthesis?.getVoices?.() || [];
  const english = all.filter((v) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('en') || name.includes('english') || name.includes('en-');
  });
  if (english.length >= 2) return english;

  // 手機常只回傳 1 個英文語音或 lang 不完整，改排除明顯非英文
  const relaxed = all.filter((v) => {
    const lang = (v.lang || '').toLowerCase();
    return !lang || (!lang.startsWith('zh') && !lang.startsWith('ja') && !lang.startsWith('ko'));
  });
  return relaxed.length ? relaxed : all;
}

const PRIORITY_MALE_KEYS = [
  'daniel',
  'alex',
  'fred',
  'david',
  'microsoft david',
  'google uk english male',
  'google us english male',
  'english male',
  'en-gb male',
  'en-us male',
  'mark',
  'james',
  'tom',
  'aaron',
  'gordon',
  'eddy',
  'reed',
  'nathan',
  'oliver',
  'brian',
  'arthur',
  'grandpa'
];

const PRIORITY_FEMALE_KEYS = [
  'samantha',
  'zira',
  'hazel',
  'google uk english female',
  'google us english female',
  'english female',
  'en-gb female',
  'en-us female',
  'karen',
  'victoria',
  'aria',
  'jenny',
  'susan',
  'nicky',
  'kate',
  'serena',
  'tessa'
];

function pickPriorityVoice(voices, keys, excludeFemaleForMale = false) {
  for (const key of keys) {
    const found = voices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const uri = (v.voiceURI || '').toLowerCase();
      if (!name.includes(key) && !uri.includes(key)) return false;
      if (excludeFemaleForMale && classifyVoiceGender(v) === 'female') return false;
      return true;
    });
    if (found) return found;
  }
  return null;
}

/** 每次朗讀前重新解析，避免手機快取過期語音物件 */
function resolveVoiceForSpeak(gender) {
  const want = gender === 'male' ? 'male' : 'female';
  const voices = getEnglishVoices();
  if (!voices.length) return { voice: null, pitch: want === 'male' ? 0.75 : 1.0 };

  if (want === 'male') {
    const priority = pickPriorityVoice(voices, PRIORITY_MALE_KEYS, true);
    if (priority) return { voice: priority, pitch: 1.0 };

    const males = voices.filter((v) => classifyVoiceGender(v) === 'male');
    if (males.length) return { voice: males[0], pitch: 1.0 };

    const labelMale = voices.filter((v) => voiceNameHasWord((v.name || '').toLowerCase(), 'male'));
    const labelNotFemale = labelMale.filter((v) => !voiceNameHasWord((v.name || '').toLowerCase(), 'female'));
    if (labelNotFemale.length) return { voice: labelNotFemale[0], pitch: 1.0 };

    const notFemale = voices.filter((v) => classifyVoiceGender(v) !== 'female');
    if (notFemale.length > 1) return { voice: notFemale[1], pitch: 0.9 };
    if (notFemale.length === 1) return { voice: notFemale[0], pitch: 0.8 };

    return { voice: voices[0], pitch: 0.75 };
  }

  const priority = pickPriorityVoice(voices, PRIORITY_FEMALE_KEYS);
  if (priority) return { voice: priority, pitch: 1.0 };

  const females = voices.filter((v) => classifyVoiceGender(v) === 'female');
  if (females.length) return { voice: females[0], pitch: 1.0 };

  const labelFemale = voices.filter((v) => voiceNameHasWord((v.name || '').toLowerCase(), 'female'));
  if (labelFemale.length) return { voice: labelFemale[0], pitch: 1.0 };

  return { voice: voices[0], pitch: 1.0 };
}

function bindVoiceToUtterance(utterance, gender) {
  const { voice, pitch } = resolveVoiceForSpeak(gender);
  if (voice) {
    // 以 voiceURI 重新查找，確保是當前 getVoices() 回傳的有效物件（iOS 必要）
    const fresh =
      window.speechSynthesis
        .getVoices()
        .find((v) => v.voiceURI === voice.voiceURI && v.name === voice.name) || voice;
    utterance.voice = fresh;
  }
  utterance.pitch = pitch;
  return voice;
}

function speakUtterance(utterance) {
  window.speechSynthesis.cancel();
  const start = () => window.speechSynthesis.speak(utterance);
  // iOS / Android WebView 需在 cancel 後稍候再 speak，且 voice 才會生效
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    setTimeout(start, 80);
  } else {
    start();
  }
}

function refreshVoiceCache() {
  // 語音列表載入後預熱（實際朗讀仍每次重新解析）
  window.speechSynthesis?.getVoices?.();
}

export function initGuideReading({ screens, showScreen }) {
  const els = {
    openBtn: document.getElementById('guide-open-btn'),
    lastBtn: document.getElementById('guide-use-last-btn'),
    lastHint: document.getElementById('guide-last-hint'),
    genLevel: document.getElementById('guide-gen-level'),
    genCount: document.getElementById('guide-gen-count'),
    genBtn: document.getElementById('guide-gen-btn'),
    fileInput: document.getElementById('guide-file-input'),
    pickFileBtn: document.getElementById('guide-pick-file-btn'),
    pasteArea: document.getElementById('guide-paste-area'),
    pasteApplyBtn: document.getElementById('guide-paste-apply-btn'),
    loadBackBtn: document.getElementById('guide-load-back-btn'),
    clearSavedBtn: document.getElementById('guide-clear-saved-btn'),
    sourceText: document.getElementById('guide-source-text'),
    progressText: document.getElementById('guide-progress-text'),
    voiceGenderSelect: document.getElementById('guide-voice-gender'),
    speedSlider: document.getElementById('guide-speed-slider'),
    speedLabel: document.getElementById('guide-speed-label'),
    segmentList: document.getElementById('guide-segment-list'),
    playBtn: document.getElementById('guide-play-btn'),
    pauseBtn: document.getElementById('guide-pause-btn'),
    stopBtn: document.getElementById('guide-stop-btn'),
    changeSourceBtn: document.getElementById('guide-change-source-btn'),
    playBackBtn: document.getElementById('guide-play-back-btn')
  };

  let segments = [];
  let sourceLabel = '';
  let currentIndex = 0;
  let isPlaying = false;
  let isPaused = false;

  function updateLastButton() {
    const has = hasSavedGuideContent();
    els.lastBtn.disabled = !has;
    if (has) {
      const saved = loadSavedGuideContent();
      els.lastHint.textContent = saved
        ? `上次：${formatSavedSummary(saved)} · ${saved.segments.length} 句`
        : '';
    } else {
      els.lastHint.textContent = '尚無已儲存的文稿';
    }
  }

  function showLoadScreen() {
    stopReading(true);
    segments = [];
    updateLastButton();
    showScreen('guideLoad');
  }

  function showPlayScreen(result) {
    segments = result.segments;
    sourceLabel = result.sourceLabel;
    currentIndex = 0;
    isPaused = false;

    els.sourceText.textContent = `來源：${sourceLabel} · 共 ${segments.length} 句`;
    renderSegmentList(-1);
    updateProgressText();
    updatePlayControls();
    showScreen('guidePlay');
  }

  function loadFromText(text, { sourceLabel: label, fileName = '' }) {
    const parsed = parseContent(text, { fileName });
    const result = applyLoadedContent({
      segments: parsed.segments,
      fullText: parsed.fullText || text.trim(),
      sourceLabel: label,
      sourceType: parsed.sourceType === 'srt' ? 'srt' : fileName ? 'txt' : 'paste'
    });

    if (!result.ok) {
      alert(result.message);
      return false;
    }

    if (!result.persisted) {
      alert('文稿已載入，但無法寫入本機儲存（可能為私密瀏覽模式）。');
    }

    showPlayScreen({
      segments: result.segments,
      sourceLabel: result.sourceLabel
    });
    return true;
  }

  function renderSegmentList(activeIndex) {
    els.segmentList.innerHTML = '';
    segments.forEach((text, index) => {
      const li = document.createElement('li');
      li.className = 'guide-segment' + (index === activeIndex ? ' active' : '');
      li.textContent = text;
      li.addEventListener('click', () => {
        if (isPlaying) return;
        currentIndex = index;
        renderSegmentList(currentIndex);
        updateProgressText();
      });
      els.segmentList.appendChild(li);
    });

    if (activeIndex >= 0) {
      const active = els.segmentList.children[activeIndex];
      active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function updateProgressText() {
    const total = segments.length;
    if (!total) {
      els.progressText.textContent = '';
      return;
    }

    if (isPlaying || currentIndex > 0) {
      const current = Math.min(currentIndex + 1, total);
      els.progressText.textContent = `進度：第 ${current} / ${total} 句`;
    } else {
      els.progressText.textContent = `共 ${total} 句，按「開始朗讀」播放`;
    }
  }

  function updateSpeedLabel() {
    els.speedLabel.textContent = speedLabelFromRate(els.speedSlider.value);
  }

  function updatePlayControls() {
    if (isPlaying) {
      els.playBtn.textContent = '朗讀中…';
      els.playBtn.disabled = true;
      els.pauseBtn.disabled = false;
      els.stopBtn.disabled = false;
      els.segmentList.classList.add('locked');
    } else if (isPaused) {
      els.playBtn.textContent = '繼續朗讀';
      els.playBtn.disabled = false;
      els.pauseBtn.disabled = true;
      els.stopBtn.disabled = false;
      els.segmentList.classList.remove('locked');
    } else {
      els.playBtn.textContent = '開始朗讀';
      els.playBtn.disabled = segments.length === 0;
      els.pauseBtn.disabled = true;
      els.stopBtn.disabled = currentIndex > 0;
      els.segmentList.classList.remove('locked');
    }
  }

  function speakCurrent() {
    if (!('speechSynthesis' in window)) {
      alert('此瀏覽器不支援語音朗讀。');
      stopReading(true);
      return;
    }

    if (currentIndex >= segments.length) {
      finishReading();
      return;
    }

    renderSegmentList(currentIndex);
    updateProgressText();

    const utterance = new SpeechSynthesisUtterance(segments[currentIndex]);
    utterance.lang = 'en-US';
    utterance.rate = Number(els.speedSlider.value);
    const gender = els.voiceGenderSelect?.value || 'female';
    bindVoiceToUtterance(utterance, gender);

    utterance.onend = () => {
      if (!isPlaying) return;
      currentIndex++;
      if (currentIndex >= segments.length) {
        finishReading();
        return;
      }
      speakCurrent();
    };

    utterance.onerror = () => {
      if (isPlaying) stopReading(false);
    };

    speakUtterance(utterance);
  }

  function startReading() {
    if (!segments.length) return;
    if (currentIndex >= segments.length) currentIndex = 0;

    // 手機需在使用者手勢當下先觸發 getVoices，列表才會完整
    window.speechSynthesis?.getVoices?.();

    isPlaying = true;
    isPaused = false;
    updatePlayControls();
    speakCurrent();
  }

  function pauseReading() {
    if (!isPlaying || isPaused) return;
    window.speechSynthesis.cancel();
    isPlaying = false;
    isPaused = true;
    updatePlayControls();
  }

  function stopReading(resetIndex) {
    window.speechSynthesis?.cancel();
    isPlaying = false;
    isPaused = false;
    if (resetIndex) {
      currentIndex = 0;
      renderSegmentList(-1);
    }
    updateProgressText();
    updatePlayControls();
  }

  function finishReading() {
    stopReading(false);
    alert('導讀已完成。');
  }

  function resumeReading() {
    isPaused = false;
    isPlaying = true;
    updatePlayControls();
    speakCurrent();
  }

  els.lastBtn?.addEventListener('click', () => {
    const saved = loadSavedGuideContent();
    if (!saved?.segments?.length) {
      alert('找不到上次儲存的文稿。');
      updateLastButton();
      return;
    }

    segments = saved.segments;
    showPlayScreen({
      segments: saved.segments,
      sourceLabel: formatSavedSummary(saved) || saved.sourceLabel
    });
  });

  els.pickFileBtn?.addEventListener('click', () => els.fileInput?.click());

  els.genBtn?.addEventListener('click', async () => {
    const level = els.genLevel?.value || 'B1';
    const count = Number(els.genCount?.value || 20);

    els.genBtn.disabled = true;
    const oldText = els.genBtn.textContent;
    els.genBtn.textContent = '產生中…';
    try {
      const article = await generateGuideArticle({
        level,
        sentenceCount: count,
        wordsUrl: 'words.json'
      });

      loadFromText(article.fullText, {
        sourceLabel: `隨機文章 ${article.level} · ${article.sentenceCount} 句`
      });
    } catch {
      alert('產生文章失敗，請再試一次。');
    } finally {
      els.genBtn.textContent = oldText;
      els.genBtn.disabled = false;
    }
  });

  els.fileInput?.addEventListener('change', async () => {
    const file = els.fileInput.files?.[0];
    els.fileInput.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      loadFromText(text, {
        sourceLabel: file.name,
        fileName: file.name
      });
    } catch {
      alert('無法讀取檔案，請再試一次。');
    }
  });

  els.pasteApplyBtn?.addEventListener('click', () => {
    const text = els.pasteArea?.value?.trim();
    if (!text) {
      alert('請先貼上導讀內容。');
      return;
    }

    const parsed = parseContent(text);
    const label =
      parsed.sourceType === 'srt' ? '貼上的字幕' : '貼上的文字';
    loadFromText(text, { sourceLabel: label });
  });

  els.clearSavedBtn?.addEventListener('click', () => {
    if (!hasSavedGuideContent()) return;
    if (!confirm('確定要清除本機儲存的文稿嗎？')) return;
    clearSavedGuideContent();
    updateLastButton();
  });

  els.loadBackBtn?.addEventListener('click', () => showScreen('setup'));
  els.playBackBtn?.addEventListener('click', () => {
    stopReading(true);
    showScreen('setup');
  });

  els.changeSourceBtn?.addEventListener('click', showLoadScreen);

  els.speedSlider?.addEventListener('input', updateSpeedLabel);

  els.voiceGenderSelect?.addEventListener('change', refreshVoiceCache);

  els.playBtn?.addEventListener('click', () => {
    if (isPaused) resumeReading();
    else if (!isPlaying) startReading();
  });

  els.pauseBtn?.addEventListener('click', pauseReading);
  els.stopBtn?.addEventListener('click', () => stopReading(true));

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = refreshVoiceCache;
    refreshVoiceCache();
  }

  updateSpeedLabel();
  updateLastButton();

  return { showLoadScreen, stopReading: () => stopReading(true) };
}
