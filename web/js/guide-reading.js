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

function voiceNameHasWord(name, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`, 'i').test(name);
}

function classifyVoiceGender(voice) {
  const text = `${voice?.name || ''} ${voice?.voiceURI || ''}`.toLowerCase();
  if (!text.trim()) return 'unknown';
  if (/female|woman|girl|女|samantha|zira|hazel|jenny|amy|emma|aria|karen|victoria/i.test(text)) {
    return 'female';
  }
  if (/male|man|boy|男|daniel|brian|david|mark|james|guy|alex|fred|tom|john/i.test(text)) {
    if (!voiceNameHasWord(text, 'female')) return 'male';
  }
  return 'unknown';
}

function getVoices() {
  return window.speechSynthesis?.getVoices?.() || [];
}

function pickVoiceForGender(gender) {
  const want = gender === 'male' ? 'male' : 'female';
  const voices = getVoices();
  if (!voices.length) return null;

  const english = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('en') || name.includes('english') || name.includes('英文');
  });
  const pool = english.length ? english : voices;

  const matched = pool.filter((v) => classifyVoiceGender(v) === want);
  if (matched.length) return matched[0];

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
  }

  return pool[0];
}

function applyVoiceToUtterance(utterance, gender) {
  // Don't set utterance.voice explicitly as it can cause "synthesis - failed" errors
  // Instead, rely on language selection which is more reliable
  utterance.lang = 'en-US';
}

function waitForVoices(timeoutMs = 1500) {
  if (getVoices().length) return Promise.resolve(getVoices());
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(getVoices());
    };
    window.speechSynthesis.onvoiceschanged = finish;
    window.speechSynthesis.getVoices();
    setTimeout(finish, timeoutMs);
  });
}

// Warm up speech synthesis by speaking a silent utterance
let synthesisWarmedUp = false;
function warmUpSynthesis() {
  if (synthesisWarmedUp) return;
  try {
    const warmup = new SpeechSynthesisUtterance('');
    warmup.volume = 0;
    window.speechSynthesis.speak(warmup);
    synthesisWarmedUp = true;
  } catch (e) {
    console.warn('Failed to warm up synthesis:', e);
  }
}

async function speakText(text, gender, rate) {
  await waitForVoices();

  const voices = getVoices();
  console.log('Available voices:', voices.length, voices.map(v => ({ name: v.name, lang: v.lang })));

  if (!voices || voices.length === 0) {
    throw new Error('沒有可用的語音，請確認瀏覽器已安裝語音套件');
  }

  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('此瀏覽器不支援語音朗讀。'));
      return;
    }

    if (!text || !text.trim()) {
      reject(new Error('文字內容為空'));
      return;
    }

    console.log('Speaking:', text, 'rate:', rate, 'gender:', gender);

    const utterance = new SpeechSynthesisUtterance(text);
    // Clamp rate to safe bounds (0.5 to 2.0)
    utterance.rate = Math.max(0.5, Math.min(2.0, rate || 1));
    applyVoiceToUtterance(utterance, gender);

    console.log('Utterance config:', { lang: utterance.lang, rate: utterance.rate, voice: utterance.voice?.name });

    utterance.onend = () => {
      console.log('Utterance completed successfully');
      resolve();
    };
    utterance.onerror = (event) => {
      console.error('TTS error:', event);
      console.error('Error details:', {
        error: event.error,
        message: event.message,
        elapsedTime: event.elapsedTime,
        name: event.name
      });
      const errorDetails = event.error || event.message || JSON.stringify(event);
      reject(new Error(`語音播放失敗：${errorDetails}`));
    };

    try {
      window.speechSynthesis.speak(utterance);
      console.log('Speak called successfully');
    } catch (e) {
      console.error('Exception during speak:', e);
      reject(e);
    }
  });
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

  async function speakCurrent() {
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

    const gender = els.voiceGenderSelect?.value || 'female';
    const rate = Number(els.speedSlider.value);

    try {
      await speakText(segments[currentIndex], gender, rate);
    } catch (err) {
      if (isPlaying) {
        alert(err?.message || '語音播放失敗。');
        stopReading(false);
      }
      return;
    }

    if (!isPlaying) return;

    currentIndex++;
    if (currentIndex >= segments.length) {
      finishReading();
      return;
    }

    speakCurrent();
  }

  async function startReading() {
    if (!segments.length) return;
    if (currentIndex >= segments.length) currentIndex = 0;

    await waitForVoices();
    // Only cancel if there's active speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

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
    cancelBeforeSpeak = true;
    updatePlayControls();
  }

  function stopReading(resetIndex) {
    window.speechSynthesis?.cancel();
    isPlaying = false;
    isPaused = false;
    cancelBeforeSpeak = true;

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
    // Only cancel if there's active speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
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

  els.playBtn?.addEventListener('click', () => {
    if (isPaused) resumeReading();
    else if (!isPlaying) startReading();
  });

  els.pauseBtn?.addEventListener('click', pauseReading);
  els.stopBtn?.addEventListener('click', () => stopReading(true));

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  updateSpeedLabel();
  updateLastButton();

  return { showLoadScreen, stopReading: () => stopReading(true) };
}
