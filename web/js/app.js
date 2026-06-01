import { VocabularyService, primaryEnglish, lookupWord, imageUrl } from './vocabulary.js';
import { lookupPronunciation, speak, playAudio } from './dictionary.js';
import { initGuideReading } from './guide-reading.js';

const vocabulary = new VocabularyService();

const screens = {
  setup: document.getElementById('screen-setup'),
  quiz: document.getElementById('screen-quiz'),
  guideLoad: document.getElementById('screen-guide-load'),
  guidePlay: document.getElementById('screen-guide-play')
};

let guideReading = null;

const els = {
  levelSelect: document.getElementById('level-select'),
  levelPoolText: document.getElementById('level-pool-text'),
  questionSlider: document.getElementById('question-slider'),
  questionCountText: document.getElementById('question-count-text'),
  startBtn: document.getElementById('start-btn'),
  loading: document.getElementById('loading'),
  sessionInfo: document.getElementById('session-info'),
  scoreText: document.getElementById('score-text'),
  questionText: document.getElementById('question-text'),
  phoneticPlaceholder: document.getElementById('phonetic-placeholder'),
  phoneticText: document.getElementById('phonetic-text'),
  rootsSection: document.getElementById('roots-section'),
  rootsWrap: document.getElementById('roots-wrap'),
  rootHint: document.getElementById('root-hint'),
  typingPanel: document.getElementById('typing-panel'),
  choicePanel: document.getElementById('choice-panel'),
  imageChoicePanel: document.getElementById('image-choice-panel'),
  imageOptionButtons: Array.from(document.querySelectorAll('.image-option-btn')),
  directionRow: document.getElementById('direction-row'),
  directionLabel: document.getElementById('direction-label'),
  answerInput: document.getElementById('answer-input'),
  submitBtn: document.getElementById('submit-btn'),
  nextBtn: document.getElementById('next-btn'),
  playBtn: document.getElementById('play-btn'),
  dictBtn: document.getElementById('dict-btn'),
  feedbackPanel: document.getElementById('feedback-panel'),
  feedbackText: document.getElementById('feedback-text'),
  restartBtn: document.getElementById('restart-btn'),
  optionButtons: Array.from(document.querySelectorAll('.option-btn')),
  quizTitle: document.getElementById('quiz-title'),
  promptLabel: document.getElementById('prompt-label')
};

let settings = null;
let current = null;
let correctCount = 0;
let answeredCount = 0;
let answered = false;
let pronunciationRevealed = false;
let currentPronunciation = null;
let correctChoiceIndex = -1;

function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || 'typing';
}

function getDirection() {
  return document.querySelector('input[name="direction"]:checked')?.value || 'ctoE';
}

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name]?.classList.remove('hidden');
}

function isImageMode() {
  return getMode() === 'image';
}

function updateSetupForMode() {
  const imageMode = isImageMode();
  els.directionRow?.classList.toggle('hidden', imageMode);
  els.directionLabel?.classList.toggle('hidden', imageMode);
}

function updateLevelInfo() {
  const level = els.levelSelect.value;
  vocabulary.setLevel(level);
  updateSetupForMode();

  const imageMode = isImageMode();
  const available = imageMode
    ? vocabulary.countWithImagesForCurrentLevel
    : vocabulary.countForCurrentLevel;
  const max = Math.min(30, available);

  if (imageMode) {
    els.levelPoolText.textContent =
      available > 0
        ? `圖像記憶：此難度共有 ${available} 個配有圖片的單字`
        : '此難度尚無圖像單字，請選 A1／B1 或換模式';
  } else {
    els.levelPoolText.textContent =
      available > 0
        ? `此難度題庫共有 ${available} 個單字`
        : '此難度尚無單字，請換其他等級';
  }

  els.questionSlider.max = String(Math.max(1, max));
  if (Number(els.questionSlider.value) > max) els.questionSlider.value = String(max);
  els.questionCountText.textContent = `${els.questionSlider.value} 題`;
  els.startBtn.disabled = available <= 0;
}

function readSettings() {
  return {
    level: els.levelSelect.value,
    questionCount: Number(els.questionSlider.value),
    mode: getMode(),
    direction: getDirection()
  };
}

function startQuiz() {
  settings = readSettings();
  const isImage = settings.mode === 'image';
  const sessionMode = isImage ? 'image' : 'default';

  if (!vocabulary.canStartSession(settings.level, settings.questionCount, sessionMode)) {
    alert(
      isImage
        ? '無法建立挑戰，請確認該難度有配圖單字（請選 A1 或 B1）。'
        : '無法建立挑戰，請確認該難度有足夠單字。'
    );
    return;
  }

  const poolSize = isImage
    ? vocabulary.countWithImagesForCurrentLevel
    : vocabulary.countForCurrentLevel;

  if ((settings.mode === 'choice' || isImage) && poolSize < 4) {
    alert(
      isImage
        ? '圖像記憶至少需要 4 個配圖單字，請選 A1 或 B1。'
        : '選擇題模式至少需要 4 個單字，請換難度或改用輸入模式。'
    );
    return;
  }

  if (!vocabulary.startSession(settings.level, settings.questionCount, sessionMode)) {
    alert('無法開始挑戰，請重新選擇。');
    return;
  }

  correctCount = 0;
  answeredCount = 0;
  answered = false;
  updateScoreDisplay();

  const isEtoC = settings.direction === 'EtoC';
  const isChoice = settings.mode === 'choice';

  if (isImage) {
    els.quizTitle.textContent = '圖像記憶測試';
    els.promptLabel.textContent = '請選出與英文單字相符的圖片：';
  } else {
    els.quizTitle.textContent = isChoice
      ? isEtoC
        ? '英翻中 選擇題'
        : '中翻英 選擇題'
      : isEtoC
        ? '英翻中'
        : '中翻英';

    els.promptLabel.textContent = isChoice
      ? isEtoC
        ? '請選出正確的中文翻譯：'
        : '請選出正確的英文翻譯：'
      : isEtoC
        ? '請輸入中文翻譯：'
        : '請輸入英文翻譯：';
  }

  els.typingPanel.classList.toggle('hidden', isChoice || isImage);
  els.choicePanel.classList.toggle('hidden', !isChoice);
  els.imageChoicePanel.classList.toggle('hidden', !isImage);
  els.playBtn.classList.toggle('hidden', isChoice);
  els.dictBtn.classList.toggle('hidden', isChoice || isImage);
  els.phoneticPlaceholder.parentElement?.classList.toggle('hidden', isImage);

  showScreen('quiz');
  showNextQuestion();
}

function updateSessionInfo() {
  // sessionAnswered 在 getNextQuestion() 後已代表「目前第幾題」（1-based）
  const currentNum = Math.min(vocabulary.sessionAnswered, vocabulary.sessionTotal);
  els.sessionInfo.textContent = `${vocabulary.currentLevel}　挑戰 ${vocabulary.sessionTotal} 題　第 ${currentNum} / ${vocabulary.sessionTotal} 題`;
}

function updateScoreDisplay() {
  const total = vocabulary.sessionTotal || 0;
  els.scoreText.textContent = `得分：${correctCount} / ${total}`;
}

function resetPronunciationDisplay() {
  pronunciationRevealed = false;
  currentPronunciation = null;
  els.phoneticPlaceholder.classList.remove('hidden');
  els.phoneticText.classList.add('hidden');
  els.phoneticText.textContent = '';
  els.rootsSection.classList.add('hidden');
  els.rootsWrap.innerHTML = '';
  els.rootHint.textContent = '';
  els.dictBtn.disabled = true;
}

function buildRootsPanel(item) {
  if (!item?.Roots?.length) {
    els.rootsSection.classList.add('hidden');
    return;
  }

  els.rootsSection.classList.remove('hidden');
  els.rootsWrap.innerHTML = '';

  item.Roots.forEach((root, idx) => {
    if (!root?.Part?.trim()) return;
    if (idx > 0) {
      const plus = document.createElement('span');
      plus.className = 'root-plus';
      plus.textContent = ' + ';
      els.rootsWrap.appendChild(plus);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'root-btn';
    btn.textContent = root.Part;
    btn.addEventListener('click', () => {
      els.rootHint.textContent = root.Hint
        ? `「${root.Part}」→ ${root.Hint}`
        : `「${root.Part}」`;
      speak(root.Part);
    });
    els.rootsWrap.appendChild(btn);
  });
}

function revealPronunciationDisplay(item) {
  pronunciationRevealed = true;
  els.phoneticPlaceholder.classList.add('hidden');

  const phonetic =
    currentPronunciation?.phonetic?.trim() || item?.Phonetic?.trim() || '';
  els.phoneticText.textContent = phonetic || '（暫無音標）';
  els.phoneticText.classList.remove('hidden');
  els.dictBtn.disabled = !currentPronunciation?.dictionaryUrl;
  buildRootsPanel(item);
}

async function onPlayClick() {
  if (!current) return;
  const word = lookupWord(current);
  if (!word) return;

  els.playBtn.disabled = true;
  try {
    if (!currentPronunciation) {
      currentPronunciation = await lookupPronunciation(word);
      if (current.Phonetic) currentPronunciation.phonetic = current.Phonetic;
      if (current.AudioUrl) currentPronunciation.audioUrl = current.AudioUrl;
    }
    revealPronunciationDisplay(current);
    await playAudio(word, currentPronunciation.audioUrl);
  } catch {
    revealPronunciationDisplay(current);
    speak(word);
  } finally {
    els.playBtn.disabled = false;
  }
}

function showNextQuestion() {
  if (vocabulary.isSessionComplete) {
    showSessionComplete();
    return;
  }

  current = vocabulary.getNextQuestion();
  updateSessionInfo();

  if (!current) {
    showSessionComplete();
    return;
  }

  answered = false;
  els.feedbackPanel.classList.add('hidden');
  els.nextBtn.disabled = true;
  resetPronunciationDisplay();

  const isImage = settings.mode === 'image';
  const isEtoC = settings.direction === 'EtoC';

  els.questionText.textContent = isImage
    ? primaryEnglish(current)
    : isEtoC
      ? primaryEnglish(current)
      : current.Chinese || '';

  els.playBtn.disabled = !lookupWord(current);
  els.rootsSection.classList.toggle('hidden', isImage);

  if (settings.mode === 'typing') {
    els.answerInput.value = '';
    els.answerInput.disabled = false;
    els.submitBtn.disabled = false;
    els.answerInput.focus();
  } else if (isImage) {
    showImageChoiceOptions();
  } else {
    showChoiceOptions();
  }
}

function showImageChoiceOptions() {
  const distractors = vocabulary.getImageDistractors(current, 3);
  const allItems = [current, ...distractors];
  const shuffled = [...allItems].sort(() => Math.random() - 0.5);
  correctChoiceIndex = shuffled.indexOf(current);

  els.imageOptionButtons.forEach((btn, i) => {
    const item = shuffled[i];
    const img = btn.querySelector('img');
    if (!item || !img) {
      btn.classList.add('hidden');
      return;
    }
    const url = imageUrl(item);
    btn.classList.remove('hidden', 'correct', 'wrong');
    btn.disabled = false;
    img.src = url;
    img.alt = '';
  });
}

function onImageOptionClick(e) {
  if (answered || !current) return;
  const btn = e.currentTarget;
  const index = Number(btn.dataset.index);
  if (Number.isNaN(index)) return;

  const isCorrect = index === correctChoiceIndex;
  els.imageOptionButtons.forEach((b) => (b.disabled = true));
  els.imageOptionButtons[correctChoiceIndex]?.classList.add('correct');
  if (!isCorrect) btn.classList.add('wrong');

  const chinese = current.Chinese?.trim() || '';
  if (chinese) {
    els.questionText.textContent = `${primaryEnglish(current)} — ${chinese}`;
  }

  showFeedback(isCorrect, '', { imageMode: true });

  const word = lookupWord(current);
  if (word) speak(word);

  els.nextBtn.disabled = false;
}

function showChoiceOptions() {
  const isEtoC = settings.direction === 'EtoC';
  const distractors = vocabulary.getDistractors(current, 3);
  const allItems = [current, ...distractors];
  const shuffled = [...allItems].sort(() => Math.random() - 0.5);
  correctChoiceIndex = shuffled.indexOf(current);

  els.optionButtons.forEach((btn, i) => {
    const item = shuffled[i];
    if (!item) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden', 'correct', 'wrong');
    btn.disabled = false;
    btn.textContent = isEtoC ? item.Chinese : primaryEnglish(item);
  });
}

function showFeedback(isCorrect, correctDisplay, options = {}) {
  answered = true;
  answeredCount++;
  if (isCorrect) correctCount++;
  updateScoreDisplay();

  els.feedbackPanel.classList.remove('hidden', 'ok', 'err');
  els.feedbackPanel.classList.add(isCorrect ? 'ok' : 'err');

  if (options.imageMode) {
    const chinese = current?.Chinese?.trim() || '';
    const chineseHint = chinese ? `　中文：${chinese}` : '';
    els.feedbackText.textContent = isCorrect
      ? `✓ 正確！${chineseHint}`
      : `✗ 不正確，綠框為正確圖片。${chineseHint}`;
    return;
  }

  const phoneticHint =
    pronunciationRevealed && els.phoneticText.textContent !== '（暫無音標）'
      ? `　音標：${els.phoneticText.textContent}`
      : '';

  els.feedbackText.textContent = isCorrect
    ? `✓ 正確！做得很好。${phoneticHint}`
    : `✗ 不正確。參考答案：${correctDisplay}${phoneticHint}`;
}

function submitTypingAnswer() {
  if (answered || !current) return;

  let result;
  if (settings.direction === 'EtoC') {
    result = vocabulary.checkChineseAnswer(current, els.answerInput.value);
  } else {
    result = vocabulary.checkAnswer(current, els.answerInput.value);
  }

  showFeedback(result.isCorrect, result.correctDisplay);
  els.answerInput.disabled = true;
  els.submitBtn.disabled = true;
  els.nextBtn.disabled = false;
  els.nextBtn.focus();
}

function onOptionClick(e) {
  if (answered || !current) return;
  const btn = e.currentTarget;
  const index = Number(btn.dataset.index);
  if (Number.isNaN(index)) return;

  const isCorrect = index === correctChoiceIndex;
  els.optionButtons.forEach((b) => (b.disabled = true));
  els.optionButtons[correctChoiceIndex]?.classList.add('correct');
  if (!isCorrect) btn.classList.add('wrong');

  const correctDisplay =
    settings.direction === 'EtoC' ? current.Chinese : primaryEnglish(current);

  showFeedback(isCorrect, correctDisplay);

  const word = lookupWord(current);
  if (word) speak(word);

  els.nextBtn.disabled = false;
}

function showSessionComplete() {
  els.questionText.textContent = '挑戰完成！';
  resetPronunciationDisplay();
  els.answerInput.disabled = true;
  els.submitBtn.disabled = true;
  els.nextBtn.disabled = true;
  els.playBtn.disabled = true;
  els.optionButtons.forEach((b) => {
    b.disabled = true;
    b.textContent = '';
  });
  els.imageOptionButtons.forEach((b) => {
    b.disabled = true;
    b.classList.remove('correct', 'wrong');
    const img = b.querySelector('img');
    if (img) {
      img.src = '';
      img.alt = '';
    }
  });

  const total = vocabulary.sessionTotal;
  alert(`本次共 ${total} 題，答對 ${correctCount} 題。\n得分：${correctCount} / ${total}`);
}

async function init() {
  // 導讀不依賴題庫，先初始化避免按鈕無反應
  try {
    guideReading = initGuideReading({ screens, showScreen });
  } catch (err) {
    console.error('導讀初始化失敗', err);
  }

  els.loading.classList.remove('hidden');
  try {
    await vocabulary.load('words.json');
  } catch {
    alert('載入題庫失敗，請確認 words.json 是否存在。導讀練習仍可使用。');
  } finally {
    els.loading.classList.add('hidden');
  }

  const total = Object.values(vocabulary.countByLevel).reduce((a, b) => a + b, 0);
  if (total === 0) {
    els.startBtn.disabled = true;
    els.levelPoolText.textContent = '找不到題庫，單字練習無法使用；導讀練習仍可使用。';
    showScreen('setup');
    return;
  }

  CEFR_LEVELS.forEach((level) => {
    const opt = document.createElement('option');
    opt.value = level;
    opt.textContent = level;
    if (level === 'B1') opt.selected = true;
    els.levelSelect.appendChild(opt);
  });

  updateLevelInfo();
  updateSetupForMode();
  showScreen('setup');
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

els.levelSelect?.addEventListener('change', updateLevelInfo);
document.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener('change', updateLevelInfo);
});
els.questionSlider?.addEventListener('input', () => {
  els.questionCountText.textContent = `${els.questionSlider.value} 題`;
});
els.startBtn?.addEventListener('click', startQuiz);
els.restartBtn?.addEventListener('click', () => {
  vocabulary.clearSession();
  guideReading?.stopReading?.();
  showScreen('setup');
  updateLevelInfo();
});
els.submitBtn?.addEventListener('click', submitTypingAnswer);
els.nextBtn?.addEventListener('click', showNextQuestion);
els.playBtn?.addEventListener('click', onPlayClick);
els.dictBtn?.addEventListener('click', () => {
  if (currentPronunciation?.dictionaryUrl) {
    window.open(currentPronunciation.dictionaryUrl, '_blank', 'noopener');
  }
});
els.answerInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (!answered) submitTypingAnswer();
    else showNextQuestion();
  }
});
els.optionButtons.forEach((btn) => btn.addEventListener('click', onOptionClick));
els.imageOptionButtons.forEach((btn) => btn.addEventListener('click', onImageOptionClick));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.getElementById('guide-open-btn')?.addEventListener('click', () => {
  if (guideReading?.showLoadScreen) {
    guideReading.showLoadScreen();
  } else if (screens.guideLoad) {
    showScreen('guideLoad');
  } else {
    alert('導讀功能尚未載入，請重新整理頁面；若仍無效，請清除瀏覽器快取後再試。');
  }
});

init();
