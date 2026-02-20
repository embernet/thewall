import React, { useState, useRef, useEffect } from 'react';
import type { Column, Card as CardType, SourceLink } from '@/types';
import { COL_TYPES } from '@/types';
import { useSessionStore } from '@/store/session';
import { uid, now, mid } from '@/utils/ids';
import { askClaude } from '@/utils/llm';
import { findSimilar } from '@/utils/embeddings';
import Card from '@/components/Card/Card';

interface InquiryColumnProps {
  column: Column;
  cards: CardType[];
  allCards: CardType[];
  onNavigate?: (cardId: string) => void;
}

const InquiryColumn: React.FC<InquiryColumnProps> = ({
  column,
  cards,
  allCards,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const addCard = useSessionStore((s) => s.addCard);
  const deleteCard = useSessionStore((s) => s.deleteCard);
  const toggleHighlight = useSessionStore((s) => s.toggleHighlight);
  const updateCard = useSessionStore((s) => s.updateCard);
  const speakerColors = useSessionStore((s) => s.speakerColors);
  const storeColumns = useSessionStore((s) => s.columns);

  const iCards = [...cards].sort((a, b) =>
    (a.sortOrder || '').localeCompare(b.sortOrder || ''),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [cards.length]);

  const ask = async () => {
    if (!query.trim() || loading) return;
    const q = query.trim();
    setQuery('');
    setLoading(true);

    // Add user question card
    const last = iCards[iCards.length - 1];
    addCard({
      id: uid(),
      columnId: column.id,
      sessionId: column.sessionId,
      content: '\u2753 ' + q,
      source: 'user',
      sourceCardIds: [],
      aiTags: [],
      userTags: [],
      highlightedBy: 'none',
      isDeleted: false,
      createdAt: now(),
      updatedAt: now(),
      sortOrder: last ? mid(last.sortOrder) : 'n',
    });

    // RAG: find relevant cards
    const searchable = allCards.filter(
      (c) => !c.isDeleted && c.columnId !== column.id,
    );
    const relevant = findSimilar(q, searchable, 8);
    const context = relevant
      .map((r) => {
        const prefix = r.card.speaker
          ? r.card.speaker + ': '
          : r.card.sourceAgentName
            ? '[' + r.card.sourceAgentName + '] '
            : '';
        return prefix + r.card.content;
      })
      .join('\n\n');

    const sys =
      'You are an AI research assistant analyzing a meeting/session. Answer the user\'s question based on the provided context. Be specific, reference details from the context. If the context doesn\'t contain enough info, say so. Be concise but thorough.';
    const msg =
      'Context from the session:\n\n' +
      (context || '(No relevant context found)') +
      '\n\n---\nQuestion: ' +
      q;

    const result = await askClaude(sys, msg);
    setLoading(false);
    if (!result) return;

    // Build source references from the top relevant cards
    const sourceLinks: SourceLink[] = relevant.slice(0, 5).map((r) => {
      const col = storeColumns.find((c) => c.id === r.card.columnId);
      const meta = col ? COL_TYPES.find((m) => m.type === col.type) : null;
      const label = r.card.content.slice(0, 60) + (r.card.content.length > 60 ? '...' : '');
      return {
        id: r.card.id,
        label,
        icon: meta?.icon || '\uD83D\uDCCB',
        color: meta?.color || '#6b7280',
      };
    });

    // Get the latest sorted cards to find the correct last sortOrder
    // (a new card was just added above, so we need the store's current state)
    const last2 = iCards[iCards.length - 1];
    addCard({
      id: uid(),
      columnId: column.id,
      sessionId: column.sessionId,
      content: result,
      source: 'inquiry',
      sourceAgentName: 'Inquiry AI',
      promptUsed:
        'Scope: ' +
        scope +
        '\nRelevant cards: ' +
        relevant.length +
        '\n\nContext:\n' +
        context.slice(0, 500),
      sourceCardIds: sourceLinks,
      aiTags: [],
      userTags: [],
      highlightedBy: 'none',
      isDeleted: false,
      createdAt: now(),
      updatedAt: now(),
      sortOrder: last2 ? mid(last2.sortOrder) : 'n',
    });
  };

  return (
    <div className="flex h-full min-w-[340px] w-[340px] flex-col border-r border-wall-border bg-wall-surface">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-wall-border px-2.5 pt-2 pb-1.5">
        <div className="flex items-center gap-[5px]">
          <span className="text-sm">{'\uD83D\uDD2E'}</span>
          <span className="text-xs font-semibold text-wall-text">Inquiry</span>
          <span className="rounded-lg bg-wall-border px-[5px] text-[10px] text-wall-text-muted font-medium">
            {cards.length}
          </span>
          {loading && (
            <span className="animate-pulse text-[10px] text-cyan-500">
              {'\u25CF'} thinking
            </span>
          )}
        </div>
        <div className="mt-[5px] flex gap-[3px]">
          {(['all', 'transcript', 'agents'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="cursor-pointer rounded-md border-none px-[7px] py-0.5 text-[9px] font-medium capitalize"
              style={{
                background: scope === s ? '#06b6d4' : 'var(--wall-border-hex)',
                color: scope === s ? '#fff' : 'var(--wall-text-dim-hex)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Card list ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-2 py-1.5"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--scrollbar-thumb) transparent',
        }}
      >
        {iCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            colType="inquiry"
            speakerColors={speakerColors}
            onNavigate={onNavigate}
            onDelete={(id) => deleteCard(id)}
            onHighlight={(id) => toggleHighlight(id)}
            onEdit={(id, c) => updateCard(id, { content: c })}
          />
        ))}
        {cards.length === 0 && !loading && (
          <div className="p-5 text-center text-xs text-wall-muted">
            Ask questions about your session.
            <br />
            AI uses embeddings to find relevant context.
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-wall-border px-2 py-1.5">
        <div className="flex gap-1">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about this session..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            className="flex-1 resize-none rounded-md border border-wall-muted bg-wall-border px-2 py-1.5 font-inherit text-xs text-wall-text outline-none"
            style={{ boxSizing: 'border-box' }}
          />
          <button
            onClick={ask}
            disabled={loading || !query.trim()}
            className="shrink-0 rounded-md border-none px-2.5 text-xs font-bold text-white"
            style={{
              background: loading ? 'var(--wall-muted-hex)' : '#06b6d4',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '...' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InquiryColumn;
