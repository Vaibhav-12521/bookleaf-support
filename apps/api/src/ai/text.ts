function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length]!;
}

const EDGE_PUNCT = /^[\s"'“”‘’(«]+|[\s"'“”‘’)»,.!?:;]+$/g;

export function correctNearMisses(text: string, canonicalPhrases: string[]): string {
  let out = text;
  for (const phrase of canonicalPhrases) {
    const target = phrase.toLowerCase();
    const wordCount = phrase.split(/\s+/).length;
    const maxDistance = target.length <= 6 ? 1 : target.length <= 12 ? 2 : 3;
    const tokens = out.split(/(\s+)/);
    const words = tokens.map((t, i) => ({ t, i })).filter(({ t }) => t.trim());
    for (let w = 0; w + wordCount <= words.length; w++) {
      const window = words.slice(w, w + wordCount);
      const rawText = tokens.slice(window[0]!.i, window[window.length - 1]!.i + 1).join('');
      const core = rawText.replace(EDGE_PUNCT, '');
      if (!core || core.toLowerCase() === target) continue;
      if (core[0]!.toLowerCase() !== target[0]) continue;
      if (Math.abs(core.length - target.length) > maxDistance) continue;
      if (levenshtein(core.toLowerCase(), target) > maxDistance) continue;
      const fixed = rawText.replace(core, phrase);
      tokens.splice(window[0]!.i, window[window.length - 1]!.i - window[0]!.i + 1, fixed, ...Array(window[window.length - 1]!.i - window[0]!.i).fill(''));
    }
    out = tokens.join('');
  }
  return out;
}

export function enforceGreeting(text: string, firstName: string): string {
  const greeting = /^(hi|hello|dear)\s+[^,\n]+,/i;
  return greeting.test(text) ? text.replace(greeting, `Hi ${firstName},`) : `Hi ${firstName},\n\n${text}`;
}

export function normalizeModelText(text: string): string {
  return text
    .replace(/[‐‑]/g, '-')
    .replace(/[     ]/g, ' ')
    .replace(/[​‌‍﻿]/g, '')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
