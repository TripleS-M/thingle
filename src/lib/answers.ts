// Answer normalisation and matching. Formatting differences are ignored and
// small spelling mistakes are forgiven; a different word is still wrong.

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

/** Damerau–Levenshtein distance (insert, delete, substitute, swap neighbours), capped at `max`. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      row.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = row;
  }
  return prev[b.length];
}

/** How many typos a word of this length is allowed: short words must be exact. */
export function typoAllowance(length: number): number {
  return length <= 5 ? 0 : length <= 9 ? 1 : length <= 14 ? 2 : 3;
}

const digits = (s: string) => s.replace(/[^0-9]/g, '');

/**
 * A misspelling of the same word still counts ("vaccum tube" = "vacuum tube"),
 * but numbers must match exactly ("f2" is not a typo of "f1") and the first
 * letter must be right, which keeps unrelated short words apart.
 */
function closeEnough(guess: string, target: string): boolean {
  if (guess === target) return true;
  const allowed = typoAllowance(target.length);
  if (!allowed || guess[0] !== target[0] || digits(guess) !== digits(target)) return false;
  return editDistance(guess, target, allowed) <= allowed;
}

/** Returns the accepted answer the guess matches (exactly or as a typo), or null. */
export function matchAnswer(guess: string, answer: string, accepted: string[]): string | null {
  const g = squash(guess);
  if (!g) return null;
  const all = [answer, ...accepted].filter((a) => squash(a));
  return all.find((a) => squash(a) === g) ?? all.find((a) => closeEnough(g, squash(a))) ?? null;
}

export function isCorrect(guess: string, answer: string, accepted: string[]): boolean {
  return matchAnswer(guess, answer, accepted) !== null;
}
