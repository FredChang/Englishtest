const STORAGE_KEY = 'englishtest-guide-reading-v1';

/** 不依賴 lookbehind，相容舊版 Safari / WebView */
function splitIntoSentences(normalized) {
  const segments = [];
  const parts = normalized.split(/([.!?])\s+/);
  let buf = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/^[.!?]$/.test(part)) {
      buf += part;
      const sentence = buf.trim();
      if (sentence) segments.push(sentence);
      buf = '';
    } else if (part) {
      buf = buf ? `${buf} ${part}` : part;
    }
  }

  const last = buf.trim();
  if (last) segments.push(last);
  return segments;
}

export function parsePlainTextToSegments(text) {
  const segments = [];
  const paragraphs = text.trim().split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ');
    if (!normalized) continue;
    segments.push(...splitIntoSentences(normalized));
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

function hasCjk(text) {
  return /[\u3400-\u9fff]/.test(text || '');
}

function parseFriendsLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return null;

  const pipeIdx = trimmed.indexOf(' | ');
  if (pipeIdx !== -1) {
    return {
      english: trimmed.slice(0, pipeIdx).trim(),
      chinese: trimmed.slice(pipeIdx + 3).trim()
    };
  }

  return { english: trimmed, chinese: '' };
}

/** 判斷是否為六人行導讀（含舊版 localStorage 未標記 sourceType 的情況） */
export function inferFriendsSourceType({ sourceType, sourceLabel, fullText } = {}) {
  if (sourceType === 'friends') return 'friends';
  if (sourceLabel && /六人行/.test(sourceLabel)) return 'friends';
  if (fullText && / \| [\u3400-\u9fff]/.test(fullText)) return 'friends';
  return sourceType || 'txt';
}

/** 六人行對話：每段一行英文，可選同一行以「 | 」分隔中文，或下一行為中文 */
export function parseFriendsScene(sceneText) {
  const blocks = (sceneText || '').trim().split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const items = [];

  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const first = parseFriendsLine(lines[0]);
    if (!first?.english) continue;

    let chinese = first.chinese;
    if (!chinese && lines.length >= 2 && hasCjk(lines[1])) {
      chinese = lines[1];
    }

    items.push({ english: first.english, chinese });
  }

  return {
    segments: items.map((item) => item.english),
    displayItems: items,
    fullText: items
      .map((item) => (item.chinese ? `${item.english} | ${item.chinese}` : item.english))
      .join('\n\n'),
    sourceType: 'friends'
  };
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

    const resolvedType = inferFriendsSourceType({
      sourceType: data.sourceType,
      sourceLabel: data.sourceLabel,
      fullText: data.fullText
    });

    const parsed =
      resolvedType === 'friends'
        ? parseFriendsScene(data.fullText)
        : parseContent(data.fullText, {
            fileName: data.sourceType === 'srt' ? 'saved.srt' : 'saved.txt'
          });

    return {
      segments: parsed.segments,
      displayItems: parsed.displayItems || null,
      fullText: data.fullText,
      sourceLabel: data.sourceLabel,
      sourceType: resolvedType,
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
    saved.sourceType === 'friends'
      ? '六人行'
      : saved.sourceType === 'srt'
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
