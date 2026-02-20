import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSessionStore } from '@/store/session';
import { COL_TYPES } from '@/types';
import type { Card } from '@/types';
import { SvgIcon } from '@/components/Icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (cardId: string) => void;
}

// ---------------------------------------------------------------------------
// Lightweight substring + token match scorer (instant, no TF-IDF overhead)
// ---------------------------------------------------------------------------

function scoreCard(query: string, card: Card, colTitle: string): number {
  const q = query.toLowerCase();
  const content = card.content.toLowerCase();
  const speaker = (card.speaker || '').toLowerCase();
  const col = colTitle.toLowerCase();

  // Exact phrase match in content — highest signal
  if (content.includes(q)) return 100;
  // Speaker match
  if (speaker.includes(q)) return 80;
  // Column match
  if (col.includes(q)) return 60;

  // Token overlap scoring
  const qTokens = q.split(/\s+/).filter(t => t.length > 1);
  if (qTokens.length === 0) return 0;
  let hits = 0;
  for (const t of qTokens) {
    if (content.includes(t)) hits++;
    else if (speaker.includes(t)) hits++;
    else if (col.includes(t)) hits += 0.5;
  }
  return (hits / qTokens.length) * 50;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SearchOverlay: React.FC<SearchOverlayProps> = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const cards = useSessionStore((s) => s.cards);
  const columns = useSessionStore((s) => s.columns);

  // Column lookup map
  const colMap = useMemo(() => {
    const m = new Map<string, { title: string; icon: string; color: string }>();
    for (const col of columns) {
      const meta = COL_TYPES.find(ct => ct.type === col.type);
      m.set(col.id, { title: col.title, icon: meta?.icon || '', color: meta?.color || '#64748b' });
    }
    return m;
  }, [columns]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const active = cards.filter(c => !c.isDeleted);
    const scored = active.map(card => {
      const col = colMap.get(card.columnId);
      return { card, score: scoreCard(query, card, col?.title || ''), col };
    });
    return scored
      .filter(r => r.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [query, cards, colMap]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keep selected in view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      e.preventDefault();
      onNavigate(results[selected].card.id);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selected, onNavigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[560px] max-h-[60vh] rounded-xl border border-wall-border bg-wall-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-wall-border px-4 py-3">
          <span className="text-lg text-wall-text-dim">{'\uD83D\uDD0D'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKey}
            placeholder="Search all cards..."
            className="flex-1 bg-transparent text-sm text-wall-text outline-none placeholder:text-wall-muted"
            autoFocus
          />
          <kbd className="rounded border border-wall-muted bg-wall-border px-1.5 py-0.5 text-[9px] text-wall-subtle">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-[11px] text-wall-muted">No matches found</div>
          )}
          {results.map((r, i) => {
            const col = r.col;
            const snippet = r.card.content.length > 120
              ? r.card.content.slice(0, 120) + '...'
              : r.card.content;
            return (
              <button
                key={r.card.id}
                onClick={() => { onNavigate(r.card.id); onClose(); }}
                className={`w-full text-left px-4 py-2.5 border-none cursor-pointer flex items-start gap-3 ${
                  i === selected ? 'bg-indigo-900/40' : 'bg-transparent hover:bg-wall-border/50'
                }`}
              >
                <SvgIcon name={col?.icon || 'pin'} size={14} className="mt-0.5 shrink-0" style={{ color: col?.color || '#64748b' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-wall-text leading-snug line-clamp-2">{snippet}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[9px] text-wall-subtle">
                    <span style={{ color: col?.color }}>{col?.title}</span>
                    {r.card.speaker && <span>{'\u00B7'} {r.card.speaker}</span>}
                    {r.card.highlightedBy !== 'none' && <span>{'\u2B50'}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="shrink-0 border-t border-wall-border px-4 py-1.5 flex gap-3 text-[9px] text-wall-subtle">
            <span><kbd className="rounded border border-wall-muted bg-wall-border px-1 text-[8px]">{'\u2191\u2193'}</kbd> navigate</span>
            <span><kbd className="rounded border border-wall-muted bg-wall-border px-1 text-[8px]">{'\u21B5'}</kbd> open</span>
            <span><kbd className="rounded border border-wall-muted bg-wall-border px-1 text-[8px]">esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchOverlay;
