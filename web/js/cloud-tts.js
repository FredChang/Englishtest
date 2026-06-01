/**
 * 雲端 TTS（StreamElements）。
 * Android Chrome 的 speechSynthesis 無法切換男/女聲，必須改播遠端 MP3。
 * 使用 <audio> 載入跨域 URL 不受 CORS 限制（無需自建 proxy）。
 */

const VOICES = {
  male: 'Brian',
  female: 'Amy'
};

const MAX_CHARS = 400;
const TTS_ENDPOINT = 'https://api.streamelements.com/kappa/v2/speech';

let currentAudio = null;
let aborted = false;

export function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 導讀在 Android／iOS 一律走雲端 TTS；桌面仍可用 speechSynthesis */
export function shouldUseCloudTts() {
  return isMobileBrowser();
}

export function cloudVoiceLabel(gender) {
  return gender === 'male' ? `男聲（${VOICES.male}）` : `女聲（${VOICES.female}）`;
}

export function buildCloudTtsUrl(text, gender) {
  const voice = gender === 'male' ? VOICES.male : VOICES.female;
  const url = new URL(TTS_ENDPOINT);
  url.searchParams.set('voice', voice);
  url.searchParams.set('text', (text || '').trim().slice(0, MAX_CHARS));
  return url.toString();
}

export function stopCloudSpeech() {
  aborted = true;
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.removeAttribute('src');
  currentAudio.load();
  currentAudio = null;
}

export function pauseCloudSpeech() {
  currentAudio?.pause();
}

export function resumeCloudSpeech() {
  if (currentAudio && !aborted) {
    return currentAudio.play();
  }
  return Promise.resolve();
}

export function speakCloudText(text, gender, { rate = 1.0 } = {}) {
  stopCloudSpeech();
  aborted = false;

  const trimmed = (text || '').trim();
  if (!trimmed) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const audio = new Audio(buildCloudTtsUrl(trimmed, gender));
    currentAudio = audio;
    audio.playbackRate = Math.min(2, Math.max(0.5, rate));

    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };

    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      reject(new Error('雲端語音播放失敗，請確認網路連線。'));
    };

    audio.play().catch((err) => {
      if (currentAudio === audio) currentAudio = null;
      reject(err);
    });
  });
}
