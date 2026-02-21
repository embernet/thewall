import type { Tool, ToolResult } from './adapter';
import { embed, searchSimilar, blobToVector } from '@/utils/embedding-service';
import { useSessionStore } from '@/store/session';

// ---------------------------------------------------------------------------
// Session Search Tool — Semantic search across existing session cards
// ---------------------------------------------------------------------------

export const sessionSearchTool: Tool = {
  manifest: {
    id: 'session_search',
    name: 'Session Search',
    description: 'Semantic search across all cards in the current session. Use this to check what is already known before making external API calls.',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query text', required: true },
      { name: 'column_type', type: 'string', description: 'Filter results to a specific column type (e.g. concepts, claims, ideas)' },
      { name: 'limit', type: 'number', description: 'Maximum results to return (default 5)' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const query = (params.query as string || '').trim();
    if (!query) return { success: false, data: '', error: 'Query is required' };

    const limit = (params.limit as number) || 5;
    const columnType = params.column_type as string | undefined;

    try {
      const store = useSessionStore.getState();
      const sessionId = store.session?.id;
      if (!sessionId) {
        return { success: false, data: '', error: 'No active session' };
      }

      // Embed the query text
      const queryVector = await embed(query);

      // Load all stored embeddings for this session
      const rawEmbeddings = await window.electronAPI?.db?.getEmbeddings(sessionId) ?? [];
      const vectors = rawEmbeddings
        .filter(e => e.embedding != null)
        .map(e => ({
          id: e.id,
          vector: blobToVector(e.embedding),
        }));

      // Search by cosine similarity
      const results = searchSimilar(queryVector, vectors, limit * 2, 0.3);

      // Filter by column type if specified
      let filtered = results;
      if (columnType) {
        const columnIds = new Set(
          store.columns.filter(c => c.type === columnType).map(c => c.id),
        );
        filtered = results.filter(r => {
          const card = store.cards.find(c => c.id === r.id);
          return card && columnIds.has(card.columnId);
        });
      }

      const topResults = filtered.slice(0, limit);

      if (topResults.length === 0) {
        return { success: true, data: 'No matching cards found in this session.' };
      }

      const lines = topResults.map(r => {
        const card = store.cards.find(c => c.id === r.id);
        const col = card ? store.columns.find(c => c.id === card.columnId) : undefined;
        const colLabel = col?.type ?? 'unknown';
        return `[${colLabel}] (${Math.round(r.score * 100)}% match) ${card?.content ?? ''}`;
      });

      return { success: true, data: lines.join('\n') };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
