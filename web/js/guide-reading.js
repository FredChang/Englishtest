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
  isAndroidBrowser,
  getEnglishVoices,
  resolveVoiceForGender,
  findVoiceByUri,
  loadSavedVoiceUri,
  saveVoiceUri,
  applyVoiceToUtterance,
  formatVoiceLabel,
  classifyVoiceGender,
  waitForVoices,
  speakWithVoice
} from './speech-voice.js';

function speedLabelFromRate(value) {
  const v = Number(value);
  return `${v.toFixed(1)}x`;
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
    voiceSelect: document.getElementById('guide-voice-select'),
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
  let cancelBeforeNextSpeak = true;

  function updateVoiceHint(selectedVoice) {
    if (!els.voiceHint) return;
    if (isAndroidBrowser()) {
      els.voiceHint.textContent = selectedVoice
        ? `目前：${selectedVoice.name}（${selectedVoice.lang}）`
        : 'Android：若男/女音無效，請在上方列表選含 Male/男 的項目；或至系統「文字轉語音」安裝英文男聲。';
      return;
    }
    els.voiceHint.textContent = selectedVoice
      ? `目前語音：${selectedVoice.name}`
      : '';
  }

  function populateVoiceSelect(preferredUri = '') {
    if (!els.voiceSelect) return;

    const voices = getEnglishVoices();
    els.voiceSelect.innerHTML = '';

    if (!voices.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '找不到英文語音（請在系統設定安裝 TTS）';
      els.voiceSelect.appendChild(opt);
      updateVoiceHint(null);
      return;
    }

    voices.forEach((voice) => {
      const opt = document.createElement('option');
      opt.value = voice.voiceURI;
      opt.textContent = formatVoiceLabel(voice);
      els.voiceSelect.appendChild(opt);
    });

    const savedUri = preferredUri || loadSavedVoiceUri();
    let selected =
      (savedUri && findVoiceByUri(savedUri)) ||
      findVoiceByUri(els.voiceSelect.value) ||
      voices[0];

    const gender = els.voiceGenderSelect?.value || 'female';
    const genderPick = resolveVoiceForGender(gender, voices).voice;
    if (!savedUri && genderPick) selected = genderPick;

    els.voiceSelect.value = selected?.voiceURI || voices[0].voiceURI;
    if (selected?.voiceURI) saveVoiceUri(selected.voiceURI);
    updateVoiceHint(findVoiceByUri(els.voiceSelect.value));
  }

  async function ensureVoicesReady() {
    await waitForVoices();
    populateVoiceSelect();
  }

  function syncGenderToVoiceSelect() {
    const gender = els.voiceGenderSelect?.value || 'female';
    const { voice } = resolveVoiceForGender(gender);
    if (voice && els.voiceSelect) {
      els.voiceSelect.value = voice.voiceURI;
      saveVoiceUri(voice.voiceURI);
      updateVoiceHint(voice);
    }
  }

  function getSelectedVoice() {
    const uri = els.voiceSelect?.value || loadSavedVoiceUri();
    return findVoiceByUri(uri) || resolveVoiceForGender(els.voiceGenderSelect?.value || 'female').voice;
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

    els.sourceText.textContent = `來源：${sourceLabel} · 共 ${segments.length} 句`;
    renderSegmentList(-1);
    updateProgressText();
    updatePlayControls();
    ensureVoicesReady();
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

    const gender = els.voiceGenderSelect?.value || 'female';
    const voice = getSelectedVoice();
    const genderResolved = resolveVoiceForGender(gender);
    const pitch =
      gender === 'male' && voice && classifyVoiceGender(voice) !== 'male'
        ? genderResolved.pitch
        : 1.0;

    const utterance = new SpeechSynthesisUtterance(segments[currentIndex]);
    utterance.rate = Number(els.speedSlider.value);
    applyVoiceToUtterance(utterance, voice, { gender, pitch });

    utterance.onend = () => {
      if (!isPlaying) return;
      currentIndex++;
      cancelBeforeNextSpeak = false;
      if (currentIndex >= segments.length) {
        finishReading();
        return;
      }
      speakCurrent();
    };

    utterance.onerror = () => {
      if (isPlaying) stopReading(false);
    };

    speakWithVoice(utterance, { cancelFirst: cancelBeforeNextSpeak });
    cancelBeforeNextSpeak = false;
  }

  async function startReading() {
    if (!segments.length) return;
    if (currentIndex >= segments.length) currentIndex = 0;

    await ensureVoicesReady();
    cancelBeforeNextSpeak = true;

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
    cancelBeforeNextSpeak = true;
    updatePlayControls();
  }

  function stopReading(resetIndex) {
    window.speechSynthesis?.cancel();
    isPlaying = false;
    isPaused = false;
    cancelBeforeNextSpeak = true;
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
    cancelBeforeNextSpeak = true;
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

  els.voiceGenderSelect?.addEventListener('change', () => {
    syncGenderToVoiceSelect();
  });

  els.voiceSelect?.addEventListener('change', () => {
    const voice = findVoiceByUri(els.voiceSelect.value);
    if (voice?.voiceURI) saveVoiceUri(voice.voiceURI);
    updateVoiceHint(voice);
  });

  els.playBtn?.addEventListener('click', () => {
    if (isPaused) resumeReading();
    else if (!isPlaying) startReading();
  });

  els.pauseBtn?.addEventListener('click', pauseReading);
  els.stopBtn?.addEventListener('click', () => stopReading(true));

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      if (document.getElementById('screen-guide-play')?.classList.contains('hidden')) return;
      populateVoiceSelect(els.voiceSelect?.value || loadSavedVoiceUri());
    };
  }

  updateSpeedLabel();
  updateLastButton();

  return { showLoadScreen, stopReading: () => stopReading(true) };
}
