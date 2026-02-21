import type { Tool, ToolResult } from './adapter';
import { v4 as uuid } from 'uuid';
import { embed, vectorToBlob } from '@/utils/embedding-service';
import { useSessionStore } from '@/store/session';
import type { Card } from '@/types';

// ---------------------------------------------------------------------------
// Embeddings Ingest Tool — Chunk text and add to embeddings database
// ---------------------------------------------------------------------------

export const embeddingsIngestTool: Tool = {
  manifest: {
    id: 'embeddings_ingest',
    name: 'Embeddings Ingest',
    description: 'Split content into chunks and add each to the embeddings database as cards in a research column. Use this to ingest web pages, PDFs, or other reference material for future semantic search.',
    parameters: [
      { name: 'content', type: 'string', description: 'The text content to chunk and ingest', required: true },
      { name: 'source', type: 'string', description: 'Source label or URL for attribution', required: true },
      { name: 'chunk_size', type: 'number', description: 'Target characters per chunk (default 500)' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const content = (params.content as string || '').trim();
    if (!content) return { success: false, data: '', error: 'Content is required' };

    const source = (params.source as string || 'unknown source').trim();
    const chunkSize = (params.chunk_size as number) || 500;

    const store = useSessionStore.getState();
    const sessionId = store.session?.id;
    if (!sessionId) {
      return { success: false, data: '', error: 'No active session' };
    }

    // Find or identify a deep_research column for ingested content
    const targetCol = store.columns.find(c => c.type === 'deep_research');
    if (!targetCol) {
      return { success: false, data: '', error: 'No deep_research column found in session' };
    }

    try {
      // Split into chunks at paragraph/sentence boundaries
      const chunks = chunkText(content, chunkSize);

      let created = 0;
      for (const chunk of chunks) {
        if (chunk.trim().length < 20) continue; // Skip tiny fragments

        const cardId = uuid();
        const cardContent = `[Source: ${source}]\n${chunk.trim()}`;
        const now = new Date().toISOString();

        // Create a full Card object
        const card: Card = {
          id: cardId,
          columnId: targetCol.id,
          sessionId,
          content: cardContent,
          source: 'agent',
          sourceCardIds: [],
          aiTags: [],
          userTags: [],
          highlightedBy: 'none',
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
          sortOrder: now,
        };

        // Create card in store
        store.addCard(card);

        // Embed and store (fire-and-forget)
        embed(cardContent)
          .then(vector => {
            const blob = vectorToBlob(vector);
            return window.electronAPI?.db?.storeEmbedding(cardId, blob);
          })
          .catch(e => console.warn('Embedding ingest failed for chunk:', e));

        created++;
      }

      return {
        success: true,
        data: `Ingested ${created} chunks (${content.length} chars total) from ${source}`,
      };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};

// ---------------------------------------------------------------------------
// Text chunking
// ---------------------------------------------------------------------------

function chunkText(text: string, targetSize: number): string[] {
  const chunks: string[] = [];

  // Split on double newlines (paragraphs) first
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= targetSize) {
      current += (current ? '\n\n' : '') + para;
    } else {
      if (current) chunks.push(current);
      // If a single paragraph exceeds target, split by sentences
      if (para.length > targetSize) {
        const sentences = para.match(/[^.!?]+[.!?]+\s*/g) ?? [para];
        current = '';
        for (const sentence of sentences) {
          if (current.length + sentence.length <= targetSize) {
            current += sentence;
          } else {
            if (current) chunks.push(current);
            current = sentence;
          }
        }
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
