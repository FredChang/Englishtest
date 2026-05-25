import {
  parseContent,
  loadSavedGuideContent,
  hasSavedGuideContent,
  formatSavedSummary,
  applyLoadedContent,
  clearSavedGuideContent
} from './guide-content.js';

function rateFromSlider(value) {
  return Math.max(0.5, Math.min(2, 1 + Number(value) * 0.125));
}

function speedLabelFromSlider(value) {
  const v = Number(value);
  if (v <= -5) return '很慢';
  if (v <= -2) return '較慢';
  if (v >= 5) return '很快';
  if (v >= 2) return '較快';
  return '正常';
}

export function initGuideReading({ screens, showScreen }) {
  const els = {
    openBtn: document.getElementById('guide-open-btn'),
    lastBtn: document.getElementById('guide-use-last-btn'),
    lastHint: document.getElementById('guide-last-hint'),
    fileInput: document.getElementById('guide-file-input'),
    pickFileBtn: document.getElementById('guide-pick-file-btn'),
    pasteArea: document.getElementById('guide-paste-area'),
    pasteApplyBtn: document.getElementById('guide-paste-apply-btn'),
    loadBackBtn: document.getElementById('guide-load-back-btn'),
    clearSavedBtn: document.getElementById('guide-clear-saved-btn'),
    sourceText: document.getElementById('guide-source-text'),
    progressText: document.getElementById('guide-progress-text'),
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
    els.speedLabel.textContent = speedLabelFromSlider(els.speedSlider.value);
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

  function getEnglishVoice() {
    const voices = window.speechSynthesis?.getVoices() || [];
    return (
      voices.find((v) => v.lang.startsWith('en-US')) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null
    );
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
    utterance.rate = rateFromSlider(els.speedSlider.value);
    const voice = getEnglishVoice();
    if (voice) utterance.voice = voice;

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

    window.speechSynthesis.speak(utterance);
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

  els.openBtn?.addEventListener('click', showLoadScreen);

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
    window.speechSynthesis.onvoiceschanged = () => {};
    getEnglishVoice();
  }

  updateSpeedLabel();
  updateLastButton();

  return { showLoadScreen, stopReading: () => stopReading(true) };
}
