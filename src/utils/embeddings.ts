/** Common English stop words filtered out during tokenization */
const stopWords = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'because', 'but', 'and', 'or', 'if', 'while', 'that', 'this', 'it',
  'i', 'we', 'they', 'he', 'she', 'you', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'what', 'which',
]);

/** Sparse vector: term -> weight */
type SparseVec = Record<string, number>;

/**
 * Tokenize text into lowercase words, stripping punctuation
 * and filtering stop words and short tokens.
 */
export const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

/**
 * Compute TF-IDF sparse vector for a document against a corpus.
 * `corpus` is an array of pre-joined token strings (one per document).
 */
export const tfidf = (text: string, corpus: string[]): SparseVec => {
  const tokens = tokenize(text);
  const tf: Record<string, number> = {};
  tokens.forEach((t) => {
    tf[t] = (tf[t] || 0) + 1;
  });
  const maxTf = Math.max(...Object.values(tf), 1);
  const vec: SparseVec = {};
  Object.entries(tf).forEach(([t, f]) => {
    const df = corpus.filter((d) => d.includes(t)).length || 1;
    vec[t] = (f / maxTf) * Math.log((corpus.length + 1) / df);
  });
  return vec;
};

/** Cosine similarity between two sparse vectors */
export const cosSim = (a: SparseVec, b: SparseVec): number => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let na = 0;
  let nb = 0;
  keys.forEach((k) => {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  });
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

export interface SimilarResult<T> {
  card: T;
  score: number;
}

/**
 * Find the top-K most similar cards to `query` using TF-IDF cosine similarity.
 * Cards must have a `content` string field.
 */
export const findSimilar = <T extends { content: string }>(
  query: string,
  cards: T[],
  topK = 5,
): SimilarResult<T>[] => {
  const corpus = cards.map((c) => tokenize(c.content).join(' '));
  const qVec = tfidf(query, corpus);
  return cards
    .map((card, _i) => ({
      card,
      score: cosSim(qVec, tfidf(card.content, corpus)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((x) => x.score > 0.05);
};
