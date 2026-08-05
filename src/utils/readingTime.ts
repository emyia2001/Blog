/**
 * Estimate reading time for mixed CJK + English content.
 * CJK characters: ~300 chars/min
 * English words: ~200 words/min
 * Returns at least 1 minute.
 */
export function readingTime(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const englishWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;

  const cjkMinutes = cjkChars / 300;
  const englishMinutes = englishWords / 200;
  return Math.max(1, Math.ceil(cjkMinutes + englishMinutes));
}
