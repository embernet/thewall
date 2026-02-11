import { getApiKey } from './llm';

// ---------------------------------------------------------------------------
// Embedding Service
//
// Computes text embeddings using OpenAI API (text-embedding-3-small) when an
// API key is available, otherwise falls back to a simple local hash-based
// embedding for basic similarity search.
// ---------------------------------------------------------------------------

const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMS = 256; // use small dimension for efficiency
const OPENAI_URL = 'https://api.openai.com/v1/embeddings';

export type EmbeddingVector = Float32Array;

interface EmbedCache {
  text: string;
  vector: EmbeddingVector;
}

const cache = new Map<string, EmbedCache>();
const MAX_CACHE = 2000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Compute embedding for a single text string. */
export async function embed(text: string): Promise<EmbeddingVector> {
  const trimmed = text.trim().slice(0, 8000); // limit input
  const cacheKey = trimmed.slice(0, 200);

  const cached = cache.get(cacheKey);
  if (cached && cached.text === trimmed) return cached.vector;

  let vector: EmbeddingVector;

  // Try OpenAI API if key is available
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      vector = await embedViaAPI(trimmed, apiKey);
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
  const apiKey = getApiKey();
  if (!apiKey || texts.length === 0) {
    return texts.map(t => localEmbed(t.trim().slice(0, 8000)));
  }

  try {
    return await embedBatchViaAPI(texts.map(t => t.trim().slice(0, 8000)), apiKey);
  } catch (e) {
    console.warn('OpenAI batch embedding failed, using local fallback:', e);
    return texts.map(t => localEmbed(t.trim().slice(0, 8000)));
  }
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
  // Node Buffer
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
// OpenAI API
// ---------------------------------------------------------------------------

async function embedViaAPI(text: string, apiKey: string): Promise<EmbeddingVector> {
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
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

async function embedBatchViaAPI(texts: string[], apiKey: string): Promise<EmbeddingVector[]> {
  // OpenAI supports batch of up to 2048 inputs
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      dimensions: EMBED_DIMS,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI embedding API error: ${r.status}`);
  const d = await r.json();
  return (d.data as { embedding: number[] }[])
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: { embedding: number[] }) => new Float32Array(item.embedding));
}

// ---------------------------------------------------------------------------
// Local Fallback (deterministic hash-based pseudo-embeddings)
//
// Not great quality but provides basic similarity search without any API.
// Uses character n-gram hashing to create a fixed-dimension vector.
// ---------------------------------------------------------------------------

function localEmbed(text: string): EmbeddingVector {
  const vec = new Float32Array(EMBED_DIMS);
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = lower.split(/\s+/).filter(w => w.length > 1);

  // Character trigram hashing
  for (const word of words) {
    for (let i = 0; i <= word.length - 3; i++) {
      const trigram = word.slice(i, i + 3);
      const h = hashStr(trigram);
      const idx = Math.abs(h) % EMBED_DIMS;
      vec[idx] += h > 0 ? 1 : -1;
    }
    // Also hash whole words
    const wh = hashStr(word);
    const idx = Math.abs(wh) % EMBED_DIMS;
    vec[idx] += wh > 0 ? 1.5 : -1.5;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;

  return vec;
}

/** Simple string hash (FNV-1a inspired). */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h;
}
