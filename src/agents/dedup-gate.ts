// ---------------------------------------------------------------------------
// Deduplication Gate — embedding-based duplicate prevention
//
// Before creating cards, checks if semantically similar content already exists
// in the target column. Maintains an in-memory session embedding cache so we
// avoid re-embedding existing cards on every check.
//
// Uses the same embed() + cosineSimilarity() infrastructure from embedding-service.
// ---------------------------------------------------------------------------

import { embed, cosineSimilarity, searchSimilar } from '@/utils/embedding-service';
import type { EmbeddingVector } from '@/utils/embedding-service';
import { useSessionStore } from '@/store/session';

// ---------------------------------------------------------------------------
// Session embedding cache — cardId → vector
// ---------------------------------------------------------------------------

const sessionEmbeddings = new Map<string, EmbeddingVector>();

/** Cache an embedding vector for a card (called when cards are created). */
export function cacheEmbedding(cardId: string, vector: EmbeddingVector): void {
  sessionEmbeddings.set(cardId, vector);
}

/** Clear the session embedding cache (called on orchestrator destroy). */
export function clearEmbeddingCache(): void {
  sessionEmbeddings.clear();
}

/** Get the number of cached embeddings. */
export function getCacheSize(): number {
  return sessionEmbeddings.size;
}

// ---------------------------------------------------------------------------
// Pre-LLM Similarity Search — find existing cards similar to the input
// ---------------------------------------------------------------------------

/**
 * Find existing cards in a target column that are semantically similar to the
 * given query text. Used BEFORE the LLM call so the agent prompt can include
 * relevant near-hits and the LLM can make informed uniqueness decisions.
 *
 * Unlike post-LLM dedup (threshold ~0.85), this uses a lower minScore (0.4)
 * to surface topically related items, not just near-duplicates.
 */
export async function findSimilarExisting(
  queryText: string,
  targetColumnType: string,
  topK = 5,
  minScore = 0.4,
): Promise<{ content: string; score: number }[]> {
  if (!queryText || queryText.length < 10) return [];

  // 1. Embed the query text (the transcript batch)
  let queryVec: EmbeddingVector;
  try {
    queryVec = await embed(queryText);
  } catch {
    return []; // If embedding fails, proceed without similarity context
  }

  // 2. Find card IDs in the target column
  const store = useSessionStore.getState();
  const targetCol = store.columns.find(c => c.type === targetColumnType);
  if (!targetCol) return [];

  const existingCards = store.cards.filter(
    c => c.columnId === targetCol.id && !c.isDeleted,
  );

  // 3. Build vector list from cache
  const vectors: { id: string; vector: EmbeddingVector }[] = [];
  const contentMap = new Map<string, string>();
  for (const card of existingCards) {
    const vec = sessionEmbeddings.get(card.id);
    if (vec) {
      vectors.push({ id: card.id, vector: vec });
      contentMap.set(card.id, card.content);
    }
  }

  if (vectors.length === 0) return [];

  // 4. Use searchSimilar to get top-K
  const results = searchSimilar(queryVec, vectors, topK, minScore);

  // 5. Map back to content + score
  return results
    .map(r => ({ content: contentMap.get(r.id) ?? '', score: r.score }))
    .filter(r => r.content.length > 0);
}

// ---------------------------------------------------------------------------
// Deduplication (post-LLM safety net)
// ---------------------------------------------------------------------------

interface ParsedCard {
  content: string;
  columnType: string;
  sourceCardIds?: { cardId: string; similarity: number }[];
}

/**
 * Filter out candidate cards that are semantically too similar to existing
 * cards in the same target column.
 *
 * For each candidate:
 *   1. Compute its embedding
 *   2. Compare against all cached embeddings for cards in the target column
 *   3. If max(cosineSimilarity) >= threshold → skip as duplicate
 *
 * Returns only non-duplicate cards.
 */
export async function deduplicateResults(
  cards: ParsedCard[],
  targetColumnType: string,
  threshold = 0.85,
): Promise<ParsedCard[]> {
  if (cards.length === 0) return cards;

  // Find existing card IDs in the target column
  const store = useSessionStore.getState();
  const targetCol = store.columns.find(c => c.type === targetColumnType);
  if (!targetCol) return cards; // no column → can't dedup, let them through

  const existingCards = store.cards.filter(
    c => c.columnId === targetCol.id && !c.isDeleted,
  );

  // Gather vectors for existing cards from the cache
  const existingVectors: EmbeddingVector[] = [];
  for (const card of existingCards) {
    const vec = sessionEmbeddings.get(card.id);
    if (vec) existingVectors.push(vec);
  }

  // If no existing vectors, nothing to dedup against
  if (existingVectors.length === 0) return cards;

  const kept: ParsedCard[] = [];

  for (const candidate of cards) {
    try {
      const candidateVec = await embed(candidate.content);

      // Check against all existing vectors in target column
      let maxSim = 0;
      for (const existingVec of existingVectors) {
        const sim = cosineSimilarity(candidateVec, existingVec);
        if (sim > maxSim) maxSim = sim;
      }

      if (maxSim < threshold) {
        kept.push(candidate);
        // Also add to existingVectors so later candidates in the same batch
        // are checked against earlier ones (intra-batch dedup)
        existingVectors.push(candidateVec);
      }
    } catch {
      // If embedding fails, let the card through
      kept.push(candidate);
    }
  }

  return kept;
}
