import {
  parseContent,
  parseFriendsScene,
  inferFriendsSourceType,
  enrichFriendsDisplayItems,
  buildFriendsZhMap,
  loadSavedGuideContent,
  hasSavedGuideContent,
  formatSavedSummary,
  applyLoadedContent,
  clearSavedGuideContent
} from './guide-content.js';
import { APP_VERSION } from './version.js';

let friendsZhMapPromise = null;

function loadFriendsZhMap() {
  if (!friendsZhMapPromise) {
    friendsZhMapPromise = fetch(`friends_zh.json?v=${APP_VERSION}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => buildFriendsZhMap(data))
      .catch(() => buildFriendsZhMap([]));
  }
  return friendsZhMapPromise;
}

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

function applyVoiceToUtterance(utterance, genderOrVoiceName) {
  utterance.lang = 'en-US';
  try {
    const voices = getVoices();
    const explicitVoice = voices.find(v => v.name === genderOrVoiceName);
    if (explicitVoice) {
      utterance.voice = explicitVoice;
      if (explicitVoice.lang) {
        utterance.lang = explicitVoice.lang;
      }
      console.log('Set explicit voice to:', explicitVoice.name, explicitVoice.lang);
      return;
    }

    const voice = pickVoiceForGender(genderOrVoiceName);
    if (voice) {
      utterance.voice = voice;
      if (voice.lang) {
        utterance.lang = voice.lang;
      }
      console.log('Set voice explicitly:', voice.name, voice.lang, 'for gender:', genderOrVoiceName);
    }
  } catch (err) {
    console.warn('Failed to set explicit voice, using default en-US', err);
  }
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

function speakText(text, gender, rate) {
  const voices = getVoices();
  console.log('Available voices:', voices.length, voices.map(v => ({ name: v.name, lang: v.lang })));

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

    utterance.volume = 1;

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

      // Robust fallback for synthesis-failed or network errors when using explicit voice
      if (utterance.voice && (event.error === 'synthesis-failed' || event.error === 'network')) {
        console.warn('Voice failed to synthesize, retrying with default voice...');
        try {
          const fallbackUtterance = new SpeechSynthesisUtterance(text);
          fallbackUtterance.rate = utterance.rate;
          fallbackUtterance.lang = 'en-US';
          fallbackUtterance.volume = 1;
          fallbackUtterance.onend = () => {
            console.log('Fallback utterance completed successfully');
            resolve();
          };
          fallbackUtterance.onerror = (errEvent) => {
            console.error('Fallback TTS error:', errEvent);
            const errorDetails = errEvent.error || errEvent.message || '未知錯誤';
            reject(new Error(`語音播放失敗：${errorDetails}`));
          };
          window.speechSynthesis.speak(fallbackUtterance);
          return;
        } catch (e) {
          console.error('Exception during fallback speak:', e);
          reject(e);
          return;
        }
      }

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
    friendsBtn: document.getElementById('guide-friends-btn'),
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
    friendsHint: document.getElementById('guide-friends-hint'),
    showChineseBtn: document.getElementById('guide-show-chinese-btn'),
    playBackBtn: document.getElementById('guide-play-back-btn')
  };

  let segments = [];
  let friendsDisplayItems = null;
  let isFriendsContent = false;
  let showChinese = false;
  let sourceLabel = '';
  let currentIndex = 0;
  let isPlaying = false;
  let isPaused = false;

  function populateVoicesDropdown() {
    const select = els.voiceGenderSelect;
    if (!select) return;

    const voices = getVoices();
    const english = voices.filter((v) => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      const name = (v.name || '').toLowerCase();
      return lang.startsWith('en') || name.includes('english') || name.includes('英文');
    });

    const prevSelected = select.value;
    select.innerHTML = '';

    // Add default options first
    const optFemale = document.createElement('option');
    optFemale.value = 'female';
    optFemale.textContent = '預設女音 (系統)';
    select.appendChild(optFemale);

    const optMale = document.createElement('option');
    optMale.value = 'male';
    optMale.textContent = '預設男音 (系統)';
    select.appendChild(optMale);

    // Add explicit voices
    english.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      select.appendChild(opt);
    });

    if (prevSelected && Array.from(select.options).some((o) => o.value === prevSelected)) {
      select.value = prevSelected;
    } else {
      select.value = 'female';
    }
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
    friendsDisplayItems = null;
    isFriendsContent = false;
    showChinese = false;
    updateChineseToggle();
    updateLastButton();
    showScreen('guideLoad');
  }

  function updateChineseToggle() {
    const btn = els.showChineseBtn;
    const hint = els.friendsHint;
    if (!btn) return;

    if (!isFriendsContent) {
      btn.classList.add('hidden');
      hint?.classList.add('hidden');
      return;
    }

    btn.classList.remove('hidden');
    hint?.classList.remove('hidden');
    btn.textContent = showChinese ? '隱藏中文' : '顯示中文';
    btn.setAttribute('aria-pressed', showChinese ? 'true' : 'false');
    btn.classList.toggle('active', showChinese);
  }

  function showPlayScreen(result) {
    segments = result.segments;
    friendsDisplayItems = result.displayItems || null;
    isFriendsContent = result.forceFriends || inferFriendsSourceType({
      sourceType: result.sourceType,
      sourceLabel: result.sourceLabel,
      fullText: result.fullText
    }) === 'friends';
    if (isFriendsContent && result.defaultShowChinese !== false) {
      showChinese = true;
    }
    sourceLabel = result.sourceLabel;
    currentIndex = 0;
    isPaused = false;

    els.sourceText.textContent = `來源：${sourceLabel} · 共 ${segments.length} 句`;
    updateChineseToggle();
    renderSegmentList(-1);
    updateProgressText();
    updatePlayControls();
    showScreen('guidePlay');
  }

  async function loadFromText(text, { sourceLabel: label, fileName = '', sourceType = '' } = {}) {
    const resolvedSourceType = inferFriendsSourceType({
      sourceType,
      sourceLabel: label,
      fullText: text
    });

    const parsed =
      resolvedSourceType === 'friends'
        ? parseFriendsScene(text)
        : parseContent(text, { fileName });

    let displayItems = parsed.displayItems || null;
    if (resolvedSourceType === 'friends') {
      const zhMap = await loadFriendsZhMap();
      displayItems = enrichFriendsDisplayItems(displayItems, zhMap);
    }

    const result = applyLoadedContent({
      segments: parsed.segments,
      fullText: parsed.fullText || text.trim(),
      sourceLabel: label,
      sourceType: resolvedSourceType
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
      displayItems,
      sourceType: resolvedSourceType,
      sourceLabel: result.sourceLabel,
      fullText: result.fullText,
      forceFriends: resolvedSourceType === 'friends',
      defaultShowChinese: resolvedSourceType === 'friends'
    });
    return true;
  }

  function renderSegmentList(activeIndex) {
    els.segmentList.innerHTML = '';
    segments.forEach((text, index) => {
      const li = document.createElement('li');
      li.className = 'guide-segment' + (index === activeIndex ? ' active' : '');

      const en = document.createElement('div');
      en.className = 'guide-segment-en';
      en.textContent = text;
      li.appendChild(en);

      const chinese = friendsDisplayItems?.[index]?.chinese;
      if (isFriendsContent && showChinese && chinese) {
        const zh = document.createElement('div');
        zh.className = 'guide-segment-zh';
        zh.textContent = chinese;
        li.appendChild(zh);
      }

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

  function startReading() {
    if (!segments.length) return;
    if (currentIndex >= segments.length) currentIndex = 0;

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
    // Only cancel if there's active speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    updatePlayControls();
    speakCurrent();
  }

  els.lastBtn?.addEventListener('click', async () => {
    const saved = loadSavedGuideContent();
    if (!saved?.segments?.length) {
      alert('找不到上次儲存的文稿。');
      updateLastButton();
      return;
    }

    const isFriends = inferFriendsSourceType({
      sourceType: saved.sourceType,
      sourceLabel: saved.sourceLabel,
      fullText: saved.fullText
    }) === 'friends';

    let displayItems = saved.displayItems || null;
    if (isFriends) {
      const zhMap = await loadFriendsZhMap();
      displayItems = enrichFriendsDisplayItems(displayItems, zhMap);
    }

    showPlayScreen({
      segments: saved.segments,
      displayItems,
      sourceType: saved.sourceType,
      sourceLabel: formatSavedSummary(saved) || saved.sourceLabel,
      fullText: saved.fullText,
      forceFriends: isFriends,
      defaultShowChinese: isFriends
    });
  });

  els.pickFileBtn?.addEventListener('click', () => els.fileInput?.click());

  els.friendsBtn?.addEventListener('click', async () => {
    els.friendsBtn.disabled = true;
    const oldText = els.friendsBtn.textContent;
    els.friendsBtn.textContent = '載入中…';
    try {
      const [response, zhMap] = await Promise.all([
        fetch(`friends.txt?v=${APP_VERSION}`, { cache: 'no-store' }),
        loadFriendsZhMap()
      ]);
      if (!response.ok) throw new Error('無法載入六人行對話檔');
      const content = await response.text();
      const scenes = content.split(/(?:^|\n)===(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
      if (scenes.length === 0) throw new Error('對話檔內容為空');

      const randIndex = Math.floor(Math.random() * scenes.length);
      const selectedScene = scenes[randIndex];
      const sceneLabel = `六人行對話 - 隨機第 ${randIndex + 1} 組`;
      const parsed = parseFriendsScene(selectedScene);
      const displayItems = enrichFriendsDisplayItems(parsed.displayItems, zhMap);

      const result = applyLoadedContent({
        segments: parsed.segments,
        fullText: parsed.fullText || selectedScene.trim(),
        sourceLabel: sceneLabel,
        sourceType: 'friends'
      });

      if (!result.ok) {
        alert(result.message);
        return;
      }

      showPlayScreen({
        segments: result.segments,
        displayItems,
        sourceType: 'friends',
        sourceLabel: result.sourceLabel,
        fullText: result.fullText,
        forceFriends: true,
        defaultShowChinese: true
      });
    } catch (err) {
      alert(err?.message || '讀取對話失敗，請再試一次。');
    } finally {
      els.friendsBtn.textContent = oldText;
      els.friendsBtn.disabled = false;
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

  els.showChineseBtn?.addEventListener('click', () => {
    if (!isFriendsContent) return;
    showChinese = !showChinese;
    updateChineseToggle();
    renderSegmentList(isPlaying || isPaused ? currentIndex : -1);
  });

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
      populateVoicesDropdown();
    };
  }

  populateVoicesDropdown();
  updateSpeedLabel();
  updateLastButton();

  return { showLoadScreen, stopReading: () => stopReading(true) };
}
