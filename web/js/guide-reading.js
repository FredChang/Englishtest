import {
  parseContent,
  loadSavedGuideContent,
  hasSavedGuideContent,
  formatSavedSummary,
  applyLoadedContent,
  clearSavedGuideContent
} from './guide-content.js';
import { generateGuideArticle } from './guide-generate.js';
import {
  shouldUseCloudTts,
  cloudVoiceLabel,
  speakCloudText,
  stopCloudSpeech,
  pauseCloudSpeech,
  resumeCloudSpeech
} from './cloud-tts.js';

function speedLabelFromRate(value) {
  const v = Number(value);
  return `${v.toFixed(1)}x`;
}

function applySpeechVoice(utterance, gender) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const want = gender === 'male' ? 'male' : 'female';
  const nameMatch = want === 'male' ? /\bmale\b|daniel|brian|david|mark|james|guy|alex|fred/i : /\bfemale\b|samantha|zira|hazel|karen|aria|jenny|amy|emma/i;

  const picked =
    voices.find((v) => nameMatch.test(v.name || '')) ||
    voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));

  if (picked) {
    utterance.voice = picked;
    utterance.lang = (picked.lang || 'en-US').replace(/_/g, '-');
  } else {
    utterance.lang = want === 'male' ? 'en-GB' : 'en-US';
  }
}

function speakWithSynthesis(text, gender, rate) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('此瀏覽器不支援語音朗讀。'));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    applySpeechVoice(utterance, gender);

    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('語音播放失敗。'));

    window.speechSynthesis.speak(utterance);
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
    voiceHint: document.getElementById('guide-voice-hint'),
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
  let useCloud = shouldUseCloudTts();

  function updateVoiceHint() {
    if (!els.voiceHint) return;
    const gender = els.voiceGenderSelect?.value || 'female';
    if (useCloud) {
      els.voiceHint.textContent = `手機版使用雲端 ${cloudVoiceLabel(gender)}，需網路。`;
      return;
    }
    els.voiceHint.textContent = '電腦版使用瀏覽器內建語音。';
  }

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
    useCloud = shouldUseCloudTts();

    els.sourceText.textContent = `來源：${sourceLabel} · 共 ${segments.length} 句`;
    renderSegmentList(-1);
    updateProgressText();
    updatePlayControls();
    updateVoiceHint();
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

  async function speakSegment(text) {
    const gender = els.voiceGenderSelect?.value || 'female';
    const rate = Number(els.speedSlider.value);

    if (useCloud) {
      await speakCloudText(text, gender, { rate });
      return;
    }

    await speakWithSynthesis(text, gender, rate);
  }

  async function speakCurrent() {
    if (currentIndex >= segments.length) {
      finishReading();
      return;
    }

    renderSegmentList(currentIndex);
    updateProgressText();

    try {
      await speakSegment(segments[currentIndex]);
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

  function startReading() {
    if (!segments.length) return;
    if (currentIndex >= segments.length) currentIndex = 0;

    isPlaying = true;
    isPaused = false;
    updatePlayControls();
    speakCurrent();
  }

  function pauseReading() {
    if (!isPlaying || isPaused) return;

    if (useCloud) pauseCloudSpeech();
    else window.speechSynthesis.cancel();

    isPlaying = false;
    isPaused = true;
    updatePlayControls();
  }

  function stopReading(resetIndex) {
    if (useCloud) stopCloudSpeech();
    else window.speechSynthesis?.cancel();

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

    if (useCloud) {
      resumeCloudSpeech().catch(() => speakCurrent());
      return;
    }

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

  els.voiceGenderSelect?.addEventListener('change', updateVoiceHint);

  els.playBtn?.addEventListener('click', () => {
    if (isPaused) resumeReading();
    else if (!isPlaying) startReading();
  });

  els.pauseBtn?.addEventListener('click', pauseReading);
  els.stopBtn?.addEventListener('click', () => stopReading(true));

  updateSpeedLabel();
  updateLastButton();
  updateVoiceHint();

  return { showLoadScreen, stopReading: () => stopReading(true) };
}
