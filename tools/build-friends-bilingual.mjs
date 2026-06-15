import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const translations = JSON.parse(fs.readFileSync(path.join(__dirname, 'friends_zh.json'), 'utf8'));
const zhByEn = new Map(translations.map((item) => [item.en, item.zh]));

function englishKey(line) {
  const trimmed = (line || '').trim();
  const pipeIdx = trimmed.indexOf(' | ');
  return pipeIdx >= 0 ? trimmed.slice(0, pipeIdx).trim() : trimmed;
}

function buildBilingual(content) {
  const scenes = content.split(/(?:^|\n)===(?:\r?\n|$)/);
  return scenes
    .map((scene) => {
      const trimmed = scene.trim();
      if (!trimmed) return '';

      const lines = trimmed.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
      const bilingualLines = lines.map((line) => {
        const en = englishKey(line);
        const zh = zhByEn.get(en);
        if (!zh) {
          if (!line.includes(' | ')) console.warn('Missing translation:', en);
          return line.includes(' | ') ? line : en;
        }
        return `${en} | ${zh}`;
      });

      return bilingualLines.join('\n\n');
    })
    .filter(Boolean)
    .join('\n\n===\n\n');
}

for (const target of ['web/friends.txt', 'friends.txt']) {
  const filePath = path.join(root, target);
  const original = fs.readFileSync(filePath, 'utf8');
  const output = buildBilingual(original);
  fs.writeFileSync(filePath, output + '\n', 'utf8');
  console.log('Updated', target);
}
