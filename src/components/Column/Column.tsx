import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Column as ColumnType, Card as CardType, AudioState } from '@/types';
import { COL_TYPES } from '@/types';
import { useSessionStore } from '@/store/session';
import { uid, now, mid } from '@/utils/ids';
import { fmtTime } from '@/utils/ids';
import Card from '@/components/Card/Card';
import AudioVisualizer from './AudioVisualizer';
import TranscriptInput from './TranscriptInput';
import { askClaude } from '@/utils/llm';

interface ColumnProps {
  column: ColumnType;
  cards: CardType[];
  audio?: AudioState | null;
  onToggleRecord?: () => void;
  onPauseRecord?: () => void;
  simRunning?: boolean;
  onNavigate?: (cardId: string) => void;
  linkingFrom?: string | null;
  onStartLink?: (cardId: string) => void;
  onCompleteLink?: (cardId: string) => void;
}

const Column: React.FC<ColumnProps> = ({
  column,
  cards,
  audio,
  onToggleRecord,
  onPauseRecord,
  simRunning,
  onNavigate,
  linkingFrom,
  onStartLink,
  onCompleteLink,
}) => {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [hlF, setHlF] = useState('all');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const meta = COL_TYPES.find((c) => c.type === column.type) || COL_TYPES[0];
  const prevLen = useRef(cards.length);

  const deleteCard = useSessionStore((s) => s.deleteCard);
  const toggleHighlight = useSessionStore((s) => s.toggleHighlight);
  const togglePin = useSessionStore((s) => s.togglePin);
  const updateCard = useSessionStore((s) => s.updateCard);
  const toggleColumnCollapsed = useSessionStore((s) => s.toggleColumnCollapsed);
  const emptyTrash = useSessionStore((s) => s.emptyTrash);
  const moveCard = useSessionStore((s) => s.moveCard);
  const addCard = useSessionStore((s) => s.addCard);
  const agentBusy = useSessionStore((s) => s.agentBusy);
  const speakerColors = useSessionStore((s) => s.speakerColors);
  const storeUpdateColumn = useSessionStore((s) => s.updateColumn);

  const isBusy = agentBusy?.[column.type];

  const [summary, setSummary] = useState<string | null>(
    (column.config?.summary as string) ?? null,
  );
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');

  // Change tracking: compute a content hash from visible cards
  const computeContentHash = (cardList: CardType[]): string => {
    const visible = cardList.filter((c) => !c.isDeleted);
    if (column.type === 'transcript') {
      // For transcript, exclude processed raw cards
      const filtered = visible.filter((c) => !c.userTags.includes('transcript:processed'));
      return filtered.length + ':' + filtered.map(c => c.id).join(',');
    }
    return visible.length + ':' + visible.map(c => c.id).join(',');
  };

  const currentHash = computeContentHash(cards);
  const lastSummaryHash = (column.config?.summaryHash as string) ?? '';
  const summaryUpToDate = !!summary && lastSummaryHash === currentHash;

  const handleSummarize = async () => {
    if (summarizing || cards.length === 0) return;
    setSummarizing(true);
    try {
      let visibleCards = cards.filter((c) => !c.isDeleted);
      if (column.type === 'transcript') {
        visibleCards = visibleCards.filter((c) => !c.userTags.includes('transcript:processed'));
      }
      const cardTexts = visibleCards
        .map((c) => c.content)
        .join('\n---\n');
      const result = await askClaude(
        `You are a concise summarizer. Summarize the following cards from a "${column.title}" column in 2-4 sentences. Focus on key themes and insights.`,
        cardTexts,
      );
      setSummary(result);
      setSummaryOpen(true);
      // Persist summary + content hash to column config
      if (result) {
        const hash = computeContentHash(cards);
        storeUpdateColumn(column.id, {
          config: { ...column.config, summary: result, summaryHash: hash },
        });
      }
    } catch (e) {
      console.error('Summary failed:', e);
    } finally {
      setSummarizing(false);
    }
  };

  useEffect(() => {
    if (cards.length > prevLen.current)
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    prevLen.current = cards.length;
  }, [cards.length]);

  // Unique speakers for filter dropdown
  const speakers = Array.from(new Set(cards.map(c => c.speaker).filter(Boolean) as string[]));

  let filtered = cards;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.content.toLowerCase().includes(q) ||
        c.speaker?.toLowerCase().includes(q),
    );
  }
  if (speakerFilter) {
    filtered = filtered.filter((c) => c.speaker === speakerFilter);
  }
  if (sourceFilter) {
    filtered = filtered.filter((c) => c.source === sourceFilter);
  }
  // Hide processed raw transcript cards — they've been merged into clean cards
  if (column.type === 'transcript') {
    filtered = filtered.filter((c) => !c.userTags.includes('transcript:processed'));
  }
  if (column.type === 'highlights') {
    if (hlF === 'user')
      filtered = filtered.filter(
        (c) => c.highlightedBy === 'user' || c.highlightedBy === 'both',
      );
    else if (hlF === 'ai')
      filtered = filtered.filter(
        (c) => c.highlightedBy === 'ai' || c.highlightedBy === 'both',
      );
  }

  const handleAddCard = () => {
    if (!input.trim()) return;
    const last = cards[cards.length - 1];
    addCard({
      id: uid(),
      columnId: column.id,
      sessionId: column.sessionId,
      content: input.trim(),
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
    setInput('');
  };

  const handleDrop = (columnId: string, cardId: string) => {
    const colCards = cards.filter((c) => c.columnId === columnId);
    const last = colCards[colCards.length - 1];
    moveCard(cardId, columnId, last ? mid(last.sortOrder) : 'n');
  };

  /* ── Collapsed view ── */
  if (column.collapsed) {
    return (
      <div
        className="flex min-w-[44px] w-[44px] cursor-pointer flex-col items-center border-r border-wall-border bg-wall-surface pt-2.5"
        onClick={() => toggleColumnCollapsed(column.id)}
      >
        <span className="text-sm">{meta.icon}</span>
        <span
          className="mt-1.5 text-[10px] text-wall-text-dim"
          style={{ writingMode: 'vertical-rl', letterSpacing: 1 }}
        >
          {column.title}
        </span>
        <span className="mt-[3px] rounded-[7px] bg-wall-border px-1 py-[1px] text-[9px] text-wall-subtle">
          {cards.length}
        </span>
      </div>
    );
  }

  /* ── Expanded view ── */
  return (
    <div
      className="flex h-full min-w-[340px] w-[340px] flex-col border-r border-wall-border bg-wall-surface"
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.style.background = '#1a1f35';
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.background = '#0f172a';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.style.background = '#0f172a';
        const cid = e.dataTransfer.getData('text/plain');
        if (cid) handleDrop(column.id, cid);
      }}
    >
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-wall-border px-2.5 pt-2 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[5px]">
            <span className="text-sm">{meta.icon}</span>
            <span className="text-xs font-semibold text-wall-text">
              {column.title}
            </span>
            <span className="rounded-lg bg-wall-border px-[5px] text-[10px] text-wall-subtle">
              {cards.length}
            </span>
            {isBusy && (
              <span className="animate-pulse text-[10px] text-cyan-600">
                {'\u25CF'}
              </span>
            )}
          </div>
          <div className="flex gap-0.5">
            {column.type === 'trash' && cards.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Empty trash?')) emptyTrash();
                }}
                className="cursor-pointer rounded border-none bg-red-900 px-1.5 py-0.5 text-[9px] text-red-300"
              >
                Empty
              </button>
            )}
            {column.type !== 'trash' && column.type !== 'summary' && cards.length > 0 && (
              <button
                onClick={handleSummarize}
                disabled={summarizing}
                className={`cursor-pointer border-none bg-transparent text-[11px] ${
                  summaryUpToDate
                    ? 'text-green-400 hover:text-green-300'
                    : 'text-wall-subtle hover:text-amber-400'
                }`}
                title={summaryUpToDate ? 'Summary up to date (click to regenerate)' : 'Summarize cards'}
              >
                {summarizing ? '\u23F3' : '\u2728'}
              </button>
            )}
            {cards.length > 3 && (
              <button
                onClick={() => setShowFilters(o => !o)}
                className={`cursor-pointer border-none bg-transparent text-[11px] ${showFilters || speakerFilter || sourceFilter ? 'text-indigo-400' : 'text-wall-subtle'} hover:text-indigo-300`}
                title="Filter cards"
              >
                {'\uD83D\uDD0D'}
              </button>
            )}
            <button
              onClick={() => toggleColumnCollapsed(column.id)}
              className="cursor-pointer border-none bg-transparent text-[11px] text-wall-subtle"
            >
              {'\u25C0'}
            </button>
          </div>
        </div>

        {/* ── Column filters ── */}
        {showFilters && (
          <div className="flex flex-wrap gap-1 mt-1 px-0.5">
            {speakers.length > 0 && (
              <select
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value)}
                className="rounded-md border border-wall-muted bg-wall-border px-1.5 py-0.5 text-[9px] text-wall-text outline-none"
              >
                <option value="">All speakers</option>
                {speakers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-md border border-wall-muted bg-wall-border px-1.5 py-0.5 text-[9px] text-wall-text outline-none"
            >
              <option value="">All sources</option>
              <option value="user">User</option>
              <option value="agent">Agent</option>
              <option value="transcription">Transcript</option>
            </select>
            {(speakerFilter || sourceFilter) && (
              <button
                onClick={() => { setSpeakerFilter(''); setSourceFilter(''); }}
                className="cursor-pointer border-none bg-transparent text-[9px] text-indigo-400 hover:text-indigo-300"
              >Clear</button>
            )}
          </div>
        )}

        {/* ── Transcript record controls ── */}
        {column.type === 'transcript' && (
          <div className="py-[5px] pb-0.5">
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleRecord}
                className="relative flex shrink-0 cursor-pointer items-center justify-center rounded-full"
                style={{
                  width: 30,
                  height: 30,
                  border:
                    audio?.recording || simRunning
                      ? '2px solid #ef4444'
                      : '2px solid #334155',
                  background:
                    audio?.recording || simRunning ? '#7f1d1d' : '#1e293b',
                }}
              >
                {(audio?.recording || simRunning) && !audio?.paused && (
                  <div
                    className="animate-pulse-slow absolute rounded-full opacity-40"
                    style={{
                      inset: -4,
                      border: '2px solid #ef4444',
                    }}
                  />
                )}
                <div
                  style={{
                    width: audio?.recording || simRunning ? 9 : 11,
                    height: audio?.recording || simRunning ? 9 : 11,
                    borderRadius:
                      audio?.recording || simRunning ? 2 : '50%',
                    background:
                      audio?.recording || simRunning ? '#ef4444' : '#64748b',
                  }}
                />
              </button>
              {audio?.recording && (
                <button
                  onClick={onPauseRecord}
                  className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-md border border-wall-muted bg-wall-border text-sm text-wall-text-muted"
                >
                  {audio?.paused ? '\u25B6' : '\u23F8'}
                </button>
              )}
              <div className="flex-1">
                <AudioVisualizer
                  active={
                    !!(audio?.recording || simRunning) && !audio?.paused
                  }
                  level={audio?.level || 0}
                />
              </div>
              {(audio?.recording || simRunning) && (
                <span className="font-mono text-[10px] font-semibold text-red-500">
                  {fmtTime(audio?.elapsed || 0)}
                </span>
              )}
            </div>
            {(audio?.recording || simRunning) && (
              <div className="mt-[3px] flex items-center gap-[3px]">
                <div
                  className="h-[5px] w-[5px] rounded-full"
                  style={{
                    background: audio?.paused ? '#f59e0b' : '#ef4444',
                    animation: audio?.paused
                      ? 'none'
                      : 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <span
                  className="text-[9px] font-semibold"
                  style={{
                    color: audio?.paused ? '#f59e0b' : '#ef4444',
                  }}
                >
                  {audio?.paused
                    ? 'PAUSED'
                    : simRunning
                      ? 'SIMULATING'
                      : 'LIVE'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Search bar (when >5 cards) ── */}
        {cards.length > 5 && (
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-[3px] w-full rounded-md border border-wall-muted bg-wall-border px-[7px] py-[3px] text-[11px] text-wall-text outline-none"
            style={{ boxSizing: 'border-box' }}
          />
        )}

        {/* ── Highlights filter tabs ── */}
        {column.type === 'highlights' && (
          <div className="mt-1 flex gap-[3px]">
            {(['all', 'user', 'ai'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHlF(f)}
                className="cursor-pointer rounded-lg border-none px-[7px] py-0.5 text-[9px] font-medium"
                style={{
                  background:
                    hlF === f
                      ? f === 'user'
                        ? '#f59e0b'
                        : f === 'ai'
                          ? '#3b82f6'
                          : '#6366f1'
                      : '#1e293b',
                  color: hlF === f ? '#fff' : '#64748b',
                }}
              >
                {f === 'all' ? 'All' : f === 'user' ? '\u2B50 User' : '\uD83E\uDD16 AI'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary panel ── */}
      {summary && (
        <div className="mx-2 mt-1.5 rounded-md border border-amber-800/40 bg-amber-950/30 px-2.5 py-2 max-h-[33%] flex flex-col">
          <div className="mb-1 flex items-center justify-between shrink-0">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400">
              Summary
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => navigator.clipboard?.writeText(summary)}
                className="cursor-pointer border-none bg-transparent text-[9px] text-amber-500 hover:text-amber-300"
                title="Copy"
              >
                {'\uD83D\uDCCB'}
              </button>
              <button
                onClick={() => {
                  setSummaryDraft(summary);
                  setEditingSummary(true);
                }}
                className="cursor-pointer border-none bg-transparent text-[9px] text-amber-500 hover:text-amber-300"
                title="Edit"
              >
                {'\u270F\uFE0F'}
              </button>
              <button
                onClick={handleSummarize}
                disabled={summarizing}
                className="cursor-pointer border-none bg-transparent text-[9px] text-amber-500 hover:text-amber-300"
                title="Regenerate"
              >
                {summarizing ? '\u23F3' : '\uD83D\uDD04'}
              </button>
              <button
                onClick={() => setSummaryOpen((o) => !o)}
                className="cursor-pointer border-none bg-transparent text-[9px] text-amber-500 hover:text-amber-300"
                title={summaryOpen ? 'Collapse' : 'Expand'}
              >
                {summaryOpen ? '\u25B2' : '\u25BC'}
              </button>
              <button
                onClick={() => {
                  setSummary(null);
                  setEditingSummary(false);
                  storeUpdateColumn(column.id, {
                    config: { ...column.config, summary: undefined, summaryHash: undefined },
                  });
                }}
                className="cursor-pointer border-none bg-transparent text-[9px] text-amber-500 hover:text-amber-300"
                title="Delete"
              >
                {'\uD83D\uDDD1\uFE0F'}
              </button>
            </div>
          </div>
          {summaryOpen && editingSummary ? (
            <div className="overflow-y-auto min-h-0">
              <textarea
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                className="w-full rounded-md border border-amber-800/40 bg-amber-950/60 p-1.5 text-[11px] text-amber-200/80 resize-y font-[inherit] outline-none"
                style={{ minHeight: 60, boxSizing: 'border-box' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    setSummary(summaryDraft);
                    setEditingSummary(false);
                    storeUpdateColumn(column.id, {
                      config: { ...column.config, summary: summaryDraft },
                    });
                  }
                  if (e.key === 'Escape') setEditingSummary(false);
                }}
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => {
                    setSummary(summaryDraft);
                    setEditingSummary(false);
                    storeUpdateColumn(column.id, {
                      config: { ...column.config, summary: summaryDraft },
                    });
                  }}
                  className="text-[10px] bg-amber-700 text-white border-none rounded px-2 py-0.5 cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingSummary(false)}
                  className="text-[10px] bg-wall-muted text-wall-text-muted border-none rounded px-2 py-0.5 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : summaryOpen ? (
            <div className="card-markdown text-[11px] leading-relaxed text-amber-200/80 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#92400e transparent' }}>
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Card list ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-2 py-1.5"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#334155 transparent',
        }}
      >
        {filtered
          .sort((a, b) => {
            // Pinned cards float to top
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (a.sortOrder || '').localeCompare(b.sortOrder || '');
          })
          .map((card) => (
            <div
              key={card.id}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData('text/plain', card.id)
              }
            >
              <Card
                card={card}
                colType={column.type}
                speakerColors={speakerColors}
                onNavigate={onNavigate}
                onDelete={(id) => deleteCard(id)}
                onHighlight={(id) => toggleHighlight(id)}
                onPin={(id) => togglePin(id)}
                onEdit={(id, c) => updateCard(id, { content: c })}
                linkingFrom={linkingFrom}
                onStartLink={onStartLink}
                onCompleteLink={onCompleteLink}
              />
            </div>
          ))}
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-wall-muted" style={{ padding: 16 }}>
            {column.type === 'transcript'
              ? 'Type transcript segments below.\nTag speakers and press Enter.\nAgents will auto-analyse your input.'
              : 'Cards will appear here'}
          </div>
        )}
      </div>

      {/* ── Bottom input (not transcript, not trash) ── */}
      {column.type !== 'trash' && column.type !== 'transcript' && (
        <div className="shrink-0 border-t border-wall-border px-2 py-[5px]">
          <div className="flex gap-[3px]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Add to ${column.title}...`}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddCard();
                }
              }}
              className="min-h-[26px] flex-1 resize-none rounded-md border border-wall-muted bg-wall-border px-[7px] py-[5px] font-inherit text-[11px] text-wall-text outline-none"
              style={{ boxSizing: 'border-box' }}
            />
            <button
              onClick={handleAddCard}
              className="shrink-0 cursor-pointer rounded-md border-none bg-indigo-600 px-[9px] text-xs font-bold text-white"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* ── TranscriptInput for transcript column ── */}
      {column.type === 'transcript' && (
        <TranscriptInput
          columnId={column.id}
          sessionId={column.sessionId}
          cards={cards}
          speakers={Object.keys(speakerColors)}
        />
      )}
    </div>
  );
};

export default Column;
