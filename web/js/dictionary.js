const cache = new Map();

export async function lookupPronunciation(word) {
  if (!word?.trim()) return { word: '', phonetic: '', audioUrl: '', dictionaryUrl: '' };

  const key = word.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const result = {
    word: word.trim(),
    phonetic: '',
    audioUrl: '',
    dictionaryUrl: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(key)}`
  };

  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (res.ok) {
      const entries = await res.json();
      const entry = entries?.[0];
      if (entry?.phonetics) {
        for (const p of entry.phonetics) {
          if (!result.phonetic && p.text) result.phonetic = p.text;
          if (!result.audioUrl && p.audio) result.audioUrl = p.audio;
          if (result.phonetic && result.audioUrl) break;
        }
      }
    }
  } catch {
    // offline or API blocked — use local data only
  }

  cache.set(key, result);
  return result;
}

export function speak(text, lang = 'en-US') {
  if (!text?.trim() || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.trim());
  u.lang = lang;
  u.onerror = (event) => {
    console.error('TTS error in dictionary:', event);
  };
  window.speechSynthesis.speak(u);
}

export async function playAudio(word, audioUrl) {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      await audio.play();
      return;
    } catch {
      // fallback to TTS
    }
  }
  speak(word);
}
