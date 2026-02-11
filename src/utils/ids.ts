/** Unique ID generation via crypto.randomUUID */
export const uid = (): string => crypto.randomUUID();

/** Current timestamp in ISO format */
export const now = (): string => new Date().toISOString();

/**
 * Fractional indexing midpoint function.
 * Returns a string lexicographically between `a` and `b`.
 * Used for sort-order positioning without reindexing.
 */
export const mid = (a = 'a', b = 'z'): string => {
  let m = '';
  for (let i = 0; i < Math.max(a.length, b.length) + 1; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 97;
    const cb = i < b.length ? b.charCodeAt(i) : 122;
    if (ca < cb - 1) {
      m += String.fromCharCode(Math.floor((ca + cb) / 2));
      return m;
    }
    m += String.fromCharCode(ca);
  }
  return m + 'n';
};

/** Format milliseconds as "M:SS" */
export const fmtTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
