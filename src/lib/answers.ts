// Answer normalisation and matching. Deliberately strict: no fuzzy matching,
// only formatting differences are forgiven.

const LEADING_ARTICLE = /^(a|an|the)\s+/;

export function normaliseAnswer(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics (Pokémon -> Pokemon)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-_/]+/g, ' ')            // hyphens and slashes act as spaces
    .replace(/[^a-z0-9\s]/g, '')        // drop remaining punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_ARTICLE, '');
}

/** Spacing-insensitive form so "camshaft" matches "cam shaft". */
function squash(s: string): string {
  return normaliseAnswer(s).replace(/\s/g, '');
}

export function isCorrect(guess: string, answer: string, accepted: string[]): boolean {
  const g = squash(guess);
  if (!g) return false;
  return [answer, ...accepted].some((a) => squash(a) === g);
}
