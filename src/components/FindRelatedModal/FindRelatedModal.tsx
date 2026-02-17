import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Card } from '@/types';
import { SOURCE_BADGES, COL_TYPES } from '@/types';
import { useSessionStore } from '@/store/session';
import { embed, searchSimilar, blobToVector } from '@/utils/embedding-service';
import type { EmbeddingVector } from '@/utils/embedding-service';
import { getNodes, getEdges } from '@/graph/graph-service';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FindRelatedViewProps {
  open: boolean;
  /** If set, opens directly into focus-card mode for this card */
  initialCard?: Card | null;
  onClose: () => void;
  onNavigate?: (cardId: string) => void;
}

// ---------------------------------------------------------------------------
// Related card item (embedding or graph)
// ---------------------------------------------------------------------------

interface RelatedCard {
  card: Card;
  score?: number;
  relationship?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FindRelatedView({ open, initialCard, onClose, onNavigate }: FindRelatedViewProps) {
  // ── Search state ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RelatedCard[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Focus card state ────────────────────────────────────────────────────
  const [focusCard, setFocusCard] = useState<Card | null>(null);
  const [history, setHistory] = useState<Card[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // ── Results state ───────────────────────────────────────────────────────
  const [embeddingResults, setEmbeddingResults] = useState<RelatedCard[]>([]);
  const [graphResults, setGraphResults] = useState<RelatedCard[]>([]);
  const [loadingEmbeddings, setLoadingEmbeddings] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);

  const cards = useSessionStore((s) => s.cards);
  const columns = useSessionStore((s) => s.columns);
  const session = useSessionStore((s) => s.session);

  // Column lookup
  const colMap = useMemo(() => {
    const m = new Map<string, { title: string; icon: string; color: string }>();
    for (const col of columns) {
      const meta = COL_TYPES.find(ct => ct.type === col.type);
      m.set(col.id, { title: col.title, icon: meta?.icon || '', color: meta?.color || '#64748b' });
    }
    return m;
  }, [columns]);

  const getColumnName = (columnId: string) => colMap.get(columnId)?.title || 'Unknown';

  // ── Reset on open ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (initialCard) {
      navigateToFocus(initialCard, true);
    } else {
      setFocusCard(null);
      setSearchQuery('');
      setSearchResults([]);
      setHistory([]);
      setHistoryIdx(-1);
      setEmbeddingResults([]);
      setGraphResults([]);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCard]);

  // ── Escape to close ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Navigate to focus card (with history) ───────────────────────────────
  const navigateToFocus = useCallback((card: Card, replace = false) => {
    setFocusCard(card);
    if (replace) {
      setHistory([card]);
      setHistoryIdx(0);
    } else {
      setHistory(h => {
        const trimmed = h.slice(0, historyIdx + 1);
        return [...trimmed, card];
      });
      setHistoryIdx(i => i + 1);
    }
  }, [historyIdx]);

  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < history.length - 1;

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    setFocusCard(history[newIdx]);
  }, [canGoBack, historyIdx, history]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    setFocusCard(history[newIdx]);
  }, [canGoForward, historyIdx, history]);

  // ── Semantic search ─────────────────────────────────────────────────────
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || focusCard) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const queryVec = await embed(searchQuery);
        const vectors = await gatherEmbeddings(session?.id || null, cards, null);
        const results = searchSimilar(queryVec, vectors, 20, 0.1);
        const cardMap = new Map(cards.map(c => [c.id, c]));
        const related: RelatedCard[] = [];
        for (const r of results) {
          const c = cardMap.get(r.id);
          if (c) related.push({ card: c, score: r.score });
        }
        setSearchResults(related);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, open, focusCard, cards, session]);

  // ── Load embedding-based similar cards for focus card ───────────────────
  useEffect(() => {
    if (!focusCard) return;
    let cancelled = false;

    setLoadingEmbeddings(true);
    setEmbeddingResults([]);

    (async () => {
      try {
        const queryVec = await embed(focusCard.content);
        const vectors = await gatherEmbeddings(session?.id || null, cards, focusCard.id);
        const results = searchSimilar(queryVec, vectors, 12, 0.15);
        if (cancelled) return;
        const cardMap = new Map(cards.map(c => [c.id, c]));
        const related: RelatedCard[] = [];
        for (const r of results) {
          const c = cardMap.get(r.id);
          if (c) related.push({ card: c, score: r.score });
        }
        setEmbeddingResults(related);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingEmbeddings(false);
      }
    })();

    return () => { cancelled = true; };
  }, [focusCard, cards, session]);

  // ── Load graph-connected cards for focus card ───────────────────────────
  useEffect(() => {
    if (!focusCard) return;

    setLoadingGraph(true);
    setGraphResults([]);

    try {
      const cardMap = new Map(cards.map(c => [c.id, c]));
      const directLinked = new Set<string>();
      const linkedResults: RelatedCard[] = [];

      // Cards this card links TO
      if (focusCard.sourceCardIds) {
        for (const link of focusCard.sourceCardIds) {
          const linked = cardMap.get(link.id);
          if (linked && !directLinked.has(linked.id)) {
            directLinked.add(linked.id);
            linkedResults.push({ card: linked, relationship: link.label || 'linked' });
          }
        }
      }

      // Cards that link TO this card
      for (const c of cards) {
        if (c.id === focusCard.id || c.isDeleted || directLinked.has(c.id)) continue;
        if (c.sourceCardIds?.some(s => s.id === focusCard.id)) {
          directLinked.add(c.id);
          linkedResults.push({ card: c, relationship: 'links here' });
        }
      }

      // Knowledge graph concept connections
      const nodes = getNodes();
      const edges = getEdges();
      const contentLower = focusCard.content.toLowerCase();

      const matchingNodeIds = new Set<string>();
      for (const node of nodes) {
        if (node.label.length >= 3 && contentLower.includes(node.label.toLowerCase())) {
          matchingNodeIds.add(node.id);
        }
      }

      const neighborLabels = new Set<string>();
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      for (const edge of edges) {
        if (matchingNodeIds.has(edge.sourceId)) {
          const target = nodeMap.get(edge.targetId);
          if (target) neighborLabels.add(target.label.toLowerCase());
        }
        if (matchingNodeIds.has(edge.targetId)) {
          const source = nodeMap.get(edge.sourceId);
          if (source) neighborLabels.add(source.label.toLowerCase());
        }
      }

      const graphConnected: RelatedCard[] = [];
      if (neighborLabels.size > 0) {
        for (const c of cards) {
          if (c.id === focusCard.id || c.isDeleted || directLinked.has(c.id)) continue;
          const cLower = c.content.toLowerCase();
          const matchingLabel = [...neighborLabels].find(label => cLower.includes(label));
          if (matchingLabel) {
            graphConnected.push({ card: c, relationship: `via "${matchingLabel}"` });
            if (graphConnected.length >= 12) break;
          }
        }
      }

      setGraphResults([...linkedResults, ...graphConnected]);
    } catch {
      // ignore
    } finally {
      setLoadingGraph(false);
    }
  }, [focusCard, cards]);

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9995] flex flex-col bg-wall-bg">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-2 h-[42px] min-h-[42px] border-b border-wall-border bg-wall-surface px-4">
        {/* Navigation buttons */}
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-[3px] text-[12px] text-wall-text-dim hover:bg-wall-muted disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go back"
        >
          ◀
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-[3px] text-[12px] text-wall-text-dim hover:bg-wall-muted disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go forward"
        >
          ▶
        </button>

        <div className="h-[18px] w-px bg-wall-border mx-1" />

        {/* Title */}
        <span className="text-xs font-semibold text-wall-text flex items-center gap-1.5">
          <span className="text-sm">🔍</span>
          Find Related
        </span>

        {/* Back to search (when in focus mode) */}
        {focusCard && (
          <>
            <div className="h-[18px] w-px bg-wall-border mx-1" />
            <button
              onClick={() => {
                setFocusCard(null);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2.5 py-[3px] text-[10px] font-semibold text-wall-text-dim hover:bg-wall-muted"
            >
              ← Back to Search
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Keyboard hint */}
        <kbd className="rounded border border-wall-muted bg-wall-border px-1.5 py-0.5 text-[9px] text-wall-subtle">ESC</kbd>

        {/* Close */}
        <button
          onClick={onClose}
          className="cursor-pointer border-none bg-transparent text-wall-subtle hover:text-wall-text text-sm ml-1"
        >
          ✕
        </button>
      </div>

      {/* ── Main content ── */}
      {!focusCard ? (
        /* ═══════ SEARCH MODE ═══════ */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search input */}
          <div className="shrink-0 px-6 pt-8 pb-4">
            <div className="max-w-[640px] mx-auto flex items-center gap-3 border border-wall-muted rounded-xl bg-wall-surface px-4 py-3 shadow-lg focus-within:border-indigo-500/50 transition-colors">
              <span className="text-lg text-wall-text-dim">🔍</span>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
                placeholder="Search cards semantically..."
                className="flex-1 bg-transparent text-sm text-wall-text outline-none placeholder:text-wall-muted"
                autoFocus
              />
              {searching && (
                <span className="text-[10px] text-wall-subtle animate-pulse">searching...</span>
              )}
            </div>
            <div className="max-w-[640px] mx-auto mt-2 text-[10px] text-wall-subtle text-center">
              Uses embeddings to find semantically similar cards. Click any result to explore its connections.
            </div>
          </div>

          {/* Search results */}
          <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
            <div className="max-w-[640px] mx-auto flex flex-col gap-1">
              {!searchQuery.trim() && (
                <div className="text-center text-[11px] text-wall-muted py-12">
                  Type to search across all cards using semantic similarity
                </div>
              )}
              {searchQuery.trim() && !searching && searchResults.length === 0 && (
                <div className="text-center text-[11px] text-wall-muted py-12">
                  No matching cards found
                </div>
              )}
              {searchResults.map((r) => (
                <CardRow
                  key={r.card.id}
                  card={r.card}
                  badge={r.score !== undefined ? `${Math.round(r.score * 100)}%` : undefined}
                  badgeColor="#6366f1"
                  columnName={getColumnName(r.card.columnId)}
                  columnIcon={colMap.get(r.card.columnId)?.icon}
                  onClick={() => navigateToFocus(r.card, history.length === 0)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ═══════ FOCUS MODE ═══════ */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Focus card header */}
          <div className="shrink-0 px-6 py-3 border-b border-wall-border bg-indigo-950/15">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-wider text-indigo-400 font-semibold mb-1">Focus Card</div>
                <div className="bg-wall-border/60 rounded-lg px-3 py-2 border border-indigo-500/20">
                  <div className="card-markdown text-xs text-wall-text leading-normal break-words line-clamp-4">
                    <ReactMarkdown>{focusCard.content}</ReactMarkdown>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className="text-[8px] text-white px-1.5 py-px rounded-[7px] font-semibold uppercase tracking-wide"
                      style={{ background: (SOURCE_BADGES[focusCard.source] || SOURCE_BADGES.user).bg }}
                    >
                      {(SOURCE_BADGES[focusCard.source] || SOURCE_BADGES.user).label}
                    </span>
                    <span className="text-[9px] text-wall-subtle">{getColumnName(focusCard.columnId)}</span>
                    {focusCard.sourceAgentName && (
                      <span className="text-[9px] text-cyan-500">{focusCard.sourceAgentName}</span>
                    )}
                    {onNavigate && (
                      <button
                        onClick={() => { onNavigate(focusCard.id); onClose(); }}
                        className="text-[9px] text-indigo-400 hover:text-indigo-300 cursor-pointer border-none bg-transparent ml-1"
                      >
                        Go to card →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="shrink-0 mx-6 mt-3 rounded-lg border border-wall-border/60 bg-wall-surface/50 px-3 py-2 flex items-center gap-2">
            <span className="text-[11px]">💡</span>
            <span className="text-[10px] text-wall-subtle">
              Click on any card below to make it the focus card and explore its connections. Use ◀ ▶ to navigate back and forward.
            </span>
          </div>

          {/* Two-panel layout */}
          <div className="flex-1 flex gap-0 overflow-hidden mt-3">
            {/* Left panel — Semantic similarity */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-wall-border">
              <div className="shrink-0 px-4 py-2 border-b border-wall-border/60 bg-wall-surface/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🧠</span>
                  <span className="text-[10px] font-semibold text-wall-text uppercase tracking-wider">Semantically Similar</span>
                  {loadingEmbeddings && (
                    <span className="text-[9px] text-wall-subtle animate-pulse">computing...</span>
                  )}
                  {!loadingEmbeddings && (
                    <span className="text-[9px] text-wall-subtle">{embeddingResults.length} found</span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
                {!loadingEmbeddings && embeddingResults.length === 0 && (
                  <div className="text-[10px] text-wall-muted py-8 text-center">No similar cards found</div>
                )}
                <div className="flex flex-col gap-1">
                  {embeddingResults.map((r) => (
                    <CardRow
                      key={r.card.id}
                      card={r.card}
                      badge={r.score !== undefined ? `${Math.round(r.score * 100)}%` : undefined}
                      badgeColor="#6366f1"
                      columnName={getColumnName(r.card.columnId)}
                      columnIcon={colMap.get(r.card.columnId)?.icon}
                      onClick={() => navigateToFocus(r.card)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right panel — Graph connections */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-2 border-b border-wall-border/60 bg-wall-surface/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🕸️</span>
                  <span className="text-[10px] font-semibold text-wall-text uppercase tracking-wider">Graph Connections</span>
                  {loadingGraph && (
                    <span className="text-[9px] text-wall-subtle animate-pulse">searching...</span>
                  )}
                  {!loadingGraph && (
                    <span className="text-[9px] text-wall-subtle">{graphResults.length} found</span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
                {!loadingGraph && graphResults.length === 0 && (
                  <div className="text-[10px] text-wall-muted py-8 text-center">No graph connections found</div>
                )}
                <div className="flex flex-col gap-1">
                  {graphResults.map((r) => (
                    <CardRow
                      key={r.card.id}
                      card={r.card}
                      badge={r.relationship}
                      badgeColor="#a855f7"
                      columnName={getColumnName(r.card.columnId)}
                      columnIcon={colMap.get(r.card.columnId)?.icon}
                      onClick={() => navigateToFocus(r.card)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: gather embeddings from DB or compute on the fly
// ---------------------------------------------------------------------------

async function gatherEmbeddings(
  sessionId: string | null,
  cards: Card[],
  excludeId: string | null,
): Promise<{ id: string; vector: EmbeddingVector }[]> {
  const vectors: { id: string; vector: EmbeddingVector }[] = [];

  // Try loading from DB
  if (sessionId && window.electronAPI?.db?.getEmbeddings) {
    try {
      const rows = await window.electronAPI.db.getEmbeddings(sessionId);
      for (const row of rows) {
        if (row.id !== excludeId && row.embedding) {
          const vec = blobToVector(row.embedding);
          vectors.push({ id: row.id, vector: vec });
        }
      }
    } catch {
      // fall through
    }
  }

  // If no stored embeddings, compute for cards
  if (vectors.length === 0) {
    const otherCards = cards.filter(c => c.id !== excludeId && !c.isDeleted && c.content.length > 10);
    for (const c of otherCards.slice(0, 100)) {
      try {
        const vec = await embed(c.content);
        vectors.push({ id: c.id, vector: vec });
      } catch {
        // skip
      }
    }
  }

  return vectors;
}

// ---------------------------------------------------------------------------
// Card row subcomponent
// ---------------------------------------------------------------------------

function CardRow({
  card,
  badge,
  badgeColor,
  columnName,
  columnIcon,
  onClick,
  onNavigate,
}: {
  card: Card;
  badge?: string;
  badgeColor: string;
  columnName: string;
  columnIcon?: string;
  onClick: () => void;
  onNavigate?: (cardId: string) => void;
}) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-2.5 py-2 cursor-pointer bg-wall-border/30 hover:bg-wall-border border border-transparent hover:border-wall-muted transition-colors"
      onClick={onClick}
    >
      {columnIcon && (
        <span className="text-[11px] mt-0.5 shrink-0">{columnIcon}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="card-markdown text-[11px] text-wall-text leading-snug break-words line-clamp-2">
          <ReactMarkdown>{card.content}</ReactMarkdown>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="text-[7px] text-white px-1 py-px rounded font-semibold uppercase"
            style={{ background: (SOURCE_BADGES[card.source] || SOURCE_BADGES.user).bg }}
          >
            {(SOURCE_BADGES[card.source] || SOURCE_BADGES.user).label}
          </span>
          <span className="text-[8px] text-wall-subtle">{columnName}</span>
          {card.sourceAgentName && (
            <span className="text-[8px] text-cyan-500">{card.sourceAgentName}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {badge && (
          <span
            className="text-[8px] font-semibold px-1.5 py-px rounded-full text-white whitespace-nowrap"
            style={{ background: badgeColor }}
          >
            {badge}
          </span>
        )}
        {onNavigate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(card.id);
            }}
            className="text-[8px] text-indigo-400 hover:text-indigo-300 cursor-pointer border-none bg-transparent"
            title="Go to card in column"
          >
            → go to
          </button>
        )}
      </div>
    </div>
  );
}
