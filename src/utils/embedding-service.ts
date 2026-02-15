import type { EmbeddingProvider, ApiProvider, ApiKeyConfig } from '@/types';
import { getModelDef } from '@/utils/providers';
import type { ModelDef } from '@/utils/providers';

// ---------------------------------------------------------------------------
// Embedding Service
//
// Computes text embeddings for similarity search. Uses a high-quality local
// TF-IDF + random projection approach by default (no API needed). Can use
// Voyage AI or OpenAI embedding APIs when a compatible key is configured.
//
// The local approach:
//   1. Tokenize with stop-word removal and stemming-lite
//   2. Compute term frequencies with bigram support
//   3. Apply IDF weighting from a rolling corpus
//   4. Project sparse TF-IDF vector into fixed-dimension dense vector
//      using consistent random projection (locality-sensitive hashing)
//
// This gives much better semantic quality than simple trigram hashing and
// approaches API-quality for keyword-overlap retrieval tasks like finding
// relevant transcript segments and cross-referencing agent outputs.
// ---------------------------------------------------------------------------

const EMBED_DIMS = 384; // dense vector dimensions
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const OPENAI_URL = 'https://api.openai.com/v1/embeddings';

// ---------------------------------------------------------------------------
// Cached embedding configuration — loaded from DB on startup
// ---------------------------------------------------------------------------

let cachedKey = '';
let cachedProvider: ApiProvider = 'local';
let cachedModelId = 'local-tfidf';

export type EmbeddingVector = Float32Array;

interface EmbedCache {
  text: string;
  vector: EmbeddingVector;
}

const cache = new Map<string, EmbedCache>();
const MAX_CACHE = 2000;

// ---------------------------------------------------------------------------
// IDF corpus — rolling document frequency table built from all embedded texts
// ---------------------------------------------------------------------------

const docFreq = new Map<string, number>();
let totalDocs = 0;

function updateCorpus(tokens: Set<string>): void {
  totalDocs++;
  for (const t of tokens) {
    docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }
}

function idf(term: string): number {
  const df = docFreq.get(term) ?? 0;
  return Math.log((totalDocs + 1) / (df + 1)) + 1; // smoothed IDF
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Compute embedding for a single text string. */
export async function embed(text: string): Promise<EmbeddingVector> {
  const trimmed = text.trim().slice(0, 8000);
  const cacheKey = trimmed.slice(0, 200);

  const hit = cache.get(cacheKey);
  if (hit && hit.text === trimmed) return hit.vector;

  let vector: EmbeddingVector;

  if (cachedProvider === 'voyage' && cachedKey) {
    try {
      vector = await embedViaVoyage(trimmed, cachedKey);
    } catch (e) {
      console.warn('Voyage embedding failed, using local fallback:', e);
      vector = localEmbed(trimmed);
    }
  } else if (cachedProvider === 'openai' && cachedKey) {
    try {
      vector = await embedViaOpenAI(trimmed, cachedKey);
    } catch (e) {
      console.warn('OpenAI embedding failed, using local fallback:', e);
      vector = localEmbed(trimmed);
    }
  } else {
    vector = localEmbed(trimmed);
  }

  // Cache management
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(cacheKey, { text: trimmed, vector });

  return vector;
}

/** Compute embeddings for multiple texts (batched for API efficiency). */
export async function embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
  if (texts.length === 0) return [];

  const trimmed = texts.map(t => t.trim().slice(0, 8000));

  if (cachedProvider === 'voyage' && cachedKey) {
    try {
      return await embedBatchViaVoyage(trimmed, cachedKey);
    } catch (e) {
      console.warn('Voyage batch embedding failed, using local fallback:', e);
    }
  }

  if (cachedProvider === 'openai' && cachedKey) {
    try {
      return await embedBatchViaOpenAI(trimmed, cachedKey);
    } catch (e) {
      console.warn('OpenAI batch embedding failed, using local fallback:', e);
    }
  }

  return trimmed.map(t => localEmbed(t));
}

/** Cosine similarity between two embedding vectors. */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Search for most similar vectors. Returns indices sorted by similarity desc. */
export function searchSimilar(
  query: EmbeddingVector,
  vectors: { id: string; vector: EmbeddingVector }[],
  topK = 5,
  minScore = 0.1,
): { id: string; score: number }[] {
  return vectors
    .map(v => ({ id: v.id, score: cosineSimilarity(query, v.vector) }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Serialize Float32Array to Buffer for SQLite BLOB storage. */
export function vectorToBlob(v: EmbeddingVector): ArrayBuffer {
  return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer;
}

/** Deserialize Buffer from SQLite BLOB to Float32Array. */
export function blobToVector(blob: ArrayBuffer | Buffer): EmbeddingVector {
  if (blob instanceof ArrayBuffer) {
    return new Float32Array(blob);
  }
  const ab = (blob as Buffer).buffer.slice(
    (blob as Buffer).byteOffset,
    (blob as Buffer).byteOffset + (blob as Buffer).byteLength,
  );
  return new Float32Array(ab);
}

/** Clear the embedding cache. */
export function clearEmbeddingCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Public getters / config management
// ---------------------------------------------------------------------------

export const getEmbeddingKey = (): string => cachedKey;
export const getEmbeddingModel = (): string => cachedModelId;
export const getEmbeddingProviderConfig = (): ApiProvider => cachedProvider;

/** Returns which embedding provider tier is currently active. */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (cachedProvider === 'local') return 'local';
  return 'openai'; // openai, voyage — both are API-backed
}

/** Directly set embedding config in memory (called after settings save). */
export const setEmbeddingConfig = (provider: ApiProvider, modelId: string, key: string): void => {
  cachedProvider = provider;
  cachedModelId = modelId;
  cachedKey = key;
};

/**
 * Load embedding slot configuration from the database.
 * Returns true if a valid config was found (key may be empty for local).
 */
export const loadEmbeddingConfig = async (): Promise<boolean> => {
  try {
    const configs: ApiKeyConfig[] = await window.electronAPI?.db?.getApiKeyConfigs() ?? [];
    const embConfig = configs.find(c => c.slot === 'embeddings');
    if (embConfig) {
      cachedProvider = embConfig.provider;
      cachedModelId = embConfig.modelId;
      if (embConfig.hasKey) {
        cachedKey = await window.electronAPI?.db?.getDecryptedKey('embeddings') ?? '';
        return true;
      }
      // Local provider doesn't need a key
      if (embConfig.provider === 'local') return true;
    }
  } catch (e) {
    console.warn('Failed to load embedding config:', e);
  }
  return false;
};

/** Alias for loadEmbeddingConfig — call after changing settings to refresh. */
export const refreshEmbeddingConfig = loadEmbeddingConfig;

async function embedViaVoyage(text: string, apiKey: string): Promise<EmbeddingVector> {
  const r = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cachedModelId,
      input: [text],
      input_type: 'document',
    }),
  });
  if (!r.ok) throw new Error(`Voyage embedding API error: ${r.status}`);
  const d = await r.json();
  const arr = d.data?.[0]?.embedding;
  if (!arr) throw new Error('No embedding in response');
  return new Float32Array(arr);
}

async function embedBatchViaVoyage(texts: string[], apiKey: string): Promise<EmbeddingVector[]> {
  const r = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cachedModelId,
      input: texts,
      input_type: 'document',
    }),
  });
  if (!r.ok) throw new Error(`Voyage batch embedding API error: ${r.status}`);
  const d = await r.json();
  return (d.data as { embedding: number[]; index: number }[])
    .sort((a, b) => a.index - b.index)
    .map(item => new Float32Array(item.embedding));
}

// ---------------------------------------------------------------------------
// OpenAI API (fallback if OpenAI key is provided)
// ---------------------------------------------------------------------------

async function embedViaOpenAI(text: string, apiKey: string): Promise<EmbeddingVector> {
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cachedModelId,
      input: text,
      dimensions: EMBED_DIMS,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI embedding API error: ${r.status}`);
  const d = await r.json();
  const arr = d.data?.[0]?.embedding;
  if (!arr) throw new Error('No embedding in response');
  return new Float32Array(arr);
}

async function embedBatchViaOpenAI(texts: string[], apiKey: string): Promise<EmbeddingVector[]> {
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cachedModelId,
      input: texts,
      dimensions: EMBED_DIMS,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI embedding API error: ${r.status}`);
  const d = await r.json();
  return (d.data as { embedding: number[]; index: number }[])
    .sort((a, b) => a.index - b.index)
    .map(item => new Float32Array(item.embedding));
}

// ---------------------------------------------------------------------------
// Local Embedding — TF-IDF with Random Projection
//
// High-quality local embeddings with zero API dependency:
//   1. Tokenize: lowercase, strip punctuation, remove stop words, stem-lite
//   2. Generate unigrams + bigrams for phrase awareness
//   3. Weight by TF-IDF against a rolling corpus
//   4. Project into fixed-dimension dense vector using seeded random projection
//   5. L2 normalize
//
// Random projection (Johnson-Lindenstrauss) preserves cosine similarity
// with high probability. Seeded by term hash for determinism.
// ---------------------------------------------------------------------------

/** Common English stop words */
const STOP_WORDS = new Set([
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
  'its', 'our', 'their', 'what', 'which', 'about', 'also', 'like',
]);

/** Lightweight stemmer: strip common English suffixes. */
function stemLite(word: string): string {
  if (word.length < 4) return word;
  // Order matters — check longer suffixes first
  if (word.endsWith('ation')) return word.slice(0, -5);
  if (word.endsWith('ment')) return word.slice(0, -4);
  if (word.endsWith('ness')) return word.slice(0, -4);
  if (word.endsWith('ting')) return word.slice(0, -3);
  if (word.endsWith('ing')) return word.slice(0, -3);
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ted')) return word.slice(0, -2);
  if (word.endsWith('ed')) return word.slice(0, -2);
  if (word.endsWith('ly')) return word.slice(0, -2);
  if (word.endsWith('er')) return word.slice(0, -2);
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Tokenize text into stemmed, filtered tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .map(stemLite);
}

/** FNV-1a hash. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned
}

/**
 * Seeded pseudo-random number generator (xorshift32).
 * Returns values in [-1, 1].
 */
function seededRandom(seed: number): () => number {
  let state = seed | 1; // must be non-zero
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xFFFFFFFF) * 2 - 1;
  };
}

/**
 * Project a term into the dense vector using random projection.
 * Each term gets a deterministic random vector based on its hash.
 * We add weight * randomProjection to the output vector.
 */
function projectTerm(vec: Float32Array, term: string, weight: number): void {
  const seed = fnv1a(term);
  const rand = seededRandom(seed);
  // Sparse random projection: only touch ~sqrt(dims) dimensions
  // This is faster and preserves distance as well as dense projection
  const numDims = Math.max(20, Math.floor(Math.sqrt(EMBED_DIMS)));
  for (let i = 0; i < numDims; i++) {
    const dim = (seed + Math.imul(i, 2654435761)) % EMBED_DIMS;
    vec[dim] += weight * rand();
  }
}

function localEmbed(text: string): EmbeddingVector {
  const vec = new Float32Array(EMBED_DIMS);
  const tokens = tokenize(text);

  if (tokens.length === 0) return vec;

  // Update rolling corpus with unique terms from this document
  const uniqueTerms = new Set<string>();

  // Count term frequencies (unigrams)
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
    uniqueTerms.add(t);
  }

  // Add bigrams for phrase awareness
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + '_' + tokens[i + 1];
    tf.set(bigram, (tf.get(bigram) ?? 0) + 1);
    uniqueTerms.add(bigram);
  }

  // Update rolling IDF corpus
  updateCorpus(uniqueTerms);

  // Find max TF for normalization
  let maxTf = 0;
  for (const f of tf.values()) {
    if (f > maxTf) maxTf = f;
  }

  // Compute TF-IDF weights and project into dense vector
  for (const [term, freq] of tf) {
    const tfNorm = 0.5 + 0.5 * (freq / maxTf); // augmented TF
    const idfWeight = idf(term);
    const weight = tfNorm * idfWeight;
    projectTerm(vec, term, weight);
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;

  return vec;
}
