const STORAGE_KEY = 'englishtest-guide-reading-v1';
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

export function parsePlainTextToSegments(text) {
  const segments = [];
  const paragraphs = text.trim().split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ');
    if (!normalized) continue;

    for (const part of normalized.split(SENTENCE_SPLIT)) {
      const sentence = part.trim();
      if (sentence.length > 0) segments.push(sentence);
    }
  }

  return segments;
}

export function parseSrtToSegments(srt) {
  const normalized = srt.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/);
  const segments = [];

  for (const block of blocks) {
    const blockLines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (blockLines.length === 0) continue;

    let i = 0;
    if (/^\d+$/.test(blockLines[0])) i = 1;
    if (i < blockLines.length && /-->\s*/.test(blockLines[i])) i++;

    const textLines = [];
    for (; i < blockLines.length; i++) {
      const line = blockLines[i].replace(/<[^>]+>/g, '').trim();
      if (line) textLines.push(line);
    }

    if (textLines.length > 0) segments.push(textLines.join(' '));
  }

  return segments;
}

export function isLikelySrt(text) {
  return /-->\s*\d{1,2}:\d{2}/.test(text);
}

export function parseContent(text, { fileName = '' } = {}) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { segments: [], sourceType: 'txt', fullText: '' };

  const useSrt =
    (fileName && /\.srt$/i.test(fileName)) || isLikelySrt(trimmed);

  if (useSrt) {
    const segments = parseSrtToSegments(trimmed);
    return {
      segments,
      sourceType: 'srt',
      fullText: segments.join('\n\n')
    };
  }

  const segments = parsePlainTextToSegments(trimmed);
  return {
    segments,
    sourceType: 'txt',
    fullText: trimmed
  };
}

export function saveGuideContent({ fullText, sourceLabel, sourceType }) {
  const payload = {
    version: 1,
    fullText,
    sourceLabel: sourceLabel || '文稿',
    sourceType: sourceType || 'txt',
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedGuideContent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data?.fullText?.trim()) return null;

    const parsed = parseContent(data.fullText, {
      fileName: data.sourceType === 'srt' ? 'saved.srt' : 'saved.txt'
    });

    return {
      segments: parsed.segments,
      fullText: data.fullText,
      sourceLabel: data.sourceLabel,
      sourceType: data.sourceType,
      savedAt: data.savedAt
    };
  } catch {
    return null;
  }
}

export function hasSavedGuideContent() {
  return !!localStorage.getItem(STORAGE_KEY);
}

export function clearSavedGuideContent() {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatSavedSummary(saved) {
  if (!saved) return '';
  const date = saved.savedAt
    ? new Date(saved.savedAt).toLocaleString('zh-TW', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';
  const typeLabel =
    saved.sourceType === 'srt'
      ? '字幕'
      : saved.sourceType === 'paste'
        ? '貼上'
        : '文字';
  return `${saved.sourceLabel}（${typeLabel}${date ? ` · ${date}` : ''}）`;
}

export function applyLoadedContent({ segments, fullText, sourceLabel, sourceType }) {
  if (!segments?.length) {
    return { ok: false, message: '無法解析內容，請確認檔案或文字格式。' };
  }

  const saved = saveGuideContent({ fullText, sourceLabel, sourceType });
  return {
    ok: true,
    segments,
    fullText,
    sourceLabel,
    sourceType,
    persisted: saved
  };
}
