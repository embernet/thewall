import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { safeMarkdownComponents } from '@/utils/safe-markdown';
import type { Column as ColumnType, Card as CardType } from '@/types';
import { COL_TYPES } from '@/types';
import { useSessionStore } from '@/store/session';
import { askClaude } from '@/utils/llm';
import { loadSummaryPrompts } from '@/utils/summary-prompts';
import type { SummaryPrompt } from '@/utils/summary-prompts';
import { SvgIcon } from '@/components/Icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SummaryColumnProps {
  column: ColumnType;
  /** All session columns (to iterate for per-column summaries) */
  allColumns: ColumnType[];
  /** All session cards */
  allCards: CardType[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Columns that support summarization */
const SUMMARIZABLE_TYPES = new Set([
  'transcript', 'observations', 'notes', 'context', 'concepts', 'ideas',
  'questions', 'claims', 'gaps', 'actions', 'alternatives', 'deep_research',
  'highlights',
]);

function getVisibleCards(col: ColumnType, allCards: CardType[], allHlCards: CardType[]): CardType[] {
  if (col.type === 'highlights') return allHlCards;
  let cards = allCards.filter(c => c.columnId === col.id && !c.isDeleted);
  if (col.type === 'transcript') {
    cards = cards.filter(c => !c.userTags.includes('transcript:processed'));
  }
  return cards;
}

function computeContentHash(cards: CardType[]): string {
  return cards.length + ':' + cards.map(c => c.id).join(',');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SummaryColumn: React.FC<SummaryColumnProps> = ({
  column,
  allColumns,
  allCards,
}) => {
  const toggleColumnCollapsed = useSessionStore(s => s.toggleColumnCollapsed);
  const storeUpdateColumn = useSessionStore(s => s.updateColumn);
  const meta = COL_TYPES.find(c => c.type === 'summary') || COL_TYPES[0];

  // Summary prompts
  const [prompts, setPrompts] = useState<SummaryPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(
    (column.config?.summaryPromptId as string) ?? 'simple-summary',
  );
  const [customPrompt, setCustomPrompt] = useState<string>(
    (column.config?.customSummaryPrompt as string) ?? '',
  );
  const [overallSummary, setOverallSummary] = useState<string>(
    (column.config?.overallSummary as string) ?? '',
  );
  const [summarizing, setSummarizing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load prompts on mount and seed customPrompt if using a preset
  useEffect(() => {
    const loaded = loadSummaryPrompts();
    setPrompts(loaded);
    // If a preset is selected and no custom text saved, seed from the preset
    if (selectedPromptId !== 'custom' && !customPrompt) {
      const preset = loaded.find(p => p.id === selectedPromptId);
      if (preset) setCustomPrompt(preset.prompt);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh prompts when column becomes visible (in case settings changed them)
  useEffect(() => {
    if (column.visible) {
      const loaded = loadSummaryPrompts();
      setPrompts(loaded);
      // Re-seed if still on a preset and user hasn't gone custom
      if (selectedPromptId !== 'custom') {
        const preset = loaded.find(p => p.id === selectedPromptId);
        if (preset && customPrompt === '') setCustomPrompt(preset.prompt);
      }
    }
  }, [column.visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCustom = selectedPromptId === 'custom';
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  // The displayed prompt text: for presets show their text, for custom show the user's text
  const displayedPromptText = isCustom
    ? customPrompt
    : (selectedPrompt?.prompt ?? '');

  // Persist prompt selection — when switching to a preset, also seed customPrompt with its text
  const handlePromptChange = (id: string) => {
    setSelectedPromptId(id);
    if (id !== 'custom') {
      const preset = prompts.find(p => p.id === id);
      if (preset) {
        setCustomPrompt(preset.prompt);
        storeUpdateColumn(column.id, {
          config: { ...column.config, summaryPromptId: id, customSummaryPrompt: preset.prompt },
        });
        return;
      }
    }
    storeUpdateColumn(column.id, {
      config: { ...column.config, summaryPromptId: id },
    });
  };

  // When the user edits the textarea, switch to custom mode automatically
  const handlePromptTextEdit = (text: string) => {
    setCustomPrompt(text);
    if (!isCustom) {
      // Switching from a preset to custom because user edited the text
      setSelectedPromptId('custom');
      storeUpdateColumn(column.id, {
        config: { ...column.config, summaryPromptId: 'custom', customSummaryPrompt: text },
      });
    } else {
      storeUpdateColumn(column.id, {
        config: { ...column.config, customSummaryPrompt: text },
      });
    }
  };

  // Highlight cards for the highlights column
  const hlCards = allCards.filter(c => c.highlightedBy !== 'none' && !c.isDeleted);

  // Get summarizable columns that are visible and have cards
  const summarizableColumns = allColumns.filter(
    col => col.visible && SUMMARIZABLE_TYPES.has(col.type) && col.type !== 'summary',
  );

  // The main Summarise action
  const handleSummariseAll = async () => {
    if (summarizing) return;
    setSummarizing(true);

    try {
      // Step 1: Run per-column summaries on any column that has changed
      const columnSummaries: { title: string; type: string; summary: string }[] = [];

      for (const col of summarizableColumns) {
        const cards = getVisibleCards(col, allCards, hlCards);
        if (cards.length === 0) continue;

        const currentHash = computeContentHash(cards);
        const existingHash = (col.config?.summaryHash as string) ?? '';
        const existingSummary = (col.config?.summary as string) ?? '';

        let colSummary = existingSummary;

        // Re-summarize if the column has changed or has no summary
        if (!existingSummary || existingHash !== currentHash) {
          const cardTexts = cards.map(c => c.content).join('\n---\n');
          const result = await askClaude(
            `You are a concise summarizer. Summarize the following cards from a "${col.title}" column in 2-4 sentences. Focus on key themes and insights.`,
            cardTexts,
          );
          if (result) {
            colSummary = result;
            // Persist the per-column summary and hash
            storeUpdateColumn(col.id, {
              config: { ...col.config, summary: result, summaryHash: currentHash },
            });
          }
        }

        if (colSummary) {
          columnSummaries.push({ title: col.title, type: col.type, summary: colSummary });
        }
      }

      if (columnSummaries.length === 0) {
        setOverallSummary('No columns with content to summarize.');
        setSummarizing(false);
        return;
      }

      // Step 2: Build the overall summary prompt
      const activePromptText = customPrompt || 'Provide a concise overall summary.';

      const columnInputs = columnSummaries
        .map(cs => `### ${cs.title}\n${cs.summary}`)
        .join('\n\n');

      const systemPrompt = `You are an expert summarizer producing a comprehensive session summary. The user has provided a guiding instruction for the kind of summary they want. Follow it closely.\n\n${activePromptText}`;

      const userMessage = `Here are summaries from each column of the session:\n\n${columnInputs}\n\nNow produce the overall session summary following the instructions provided.`;

      const result = await askClaude(systemPrompt, userMessage, 2000);

      if (result) {
        setOverallSummary(result);
        setSummaryOpen(true);
        storeUpdateColumn(column.id, {
          config: { ...column.config, overallSummary: result },
        });
      }
    } catch (e) {
      console.error('Overall summary failed:', e);
    } finally {
      setSummarizing(false);
    }
  };

  // ── Collapsed view ──
  if (column.collapsed) {
    return (
      <div
        className="flex min-w-[44px] w-[44px] cursor-pointer flex-col items-center border-r border-wall-border bg-wall-surface pt-2.5"
        onClick={() => toggleColumnCollapsed(column.id)}
      >
        <SvgIcon name={meta.icon} size={14} style={{ color: meta.color }} />
        <span
          className="mt-1.5 text-[10px] text-wall-text-dim"
          style={{ writingMode: 'vertical-rl', letterSpacing: 1 }}
        >
          {column.title}
        </span>
      </div>
    );
  }

  // ── Expanded view ──
  return (
    <div className="flex h-full min-w-[380px] w-[380px] flex-col border-r border-wall-border bg-wall-surface">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-wall-border px-2.5 pt-2 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[5px]">
            <SvgIcon name={meta.icon} size={14} style={{ color: meta.color }} />
            <span className="text-xs font-semibold text-wall-text">{column.title}</span>
          </div>
          <button
            onClick={() => toggleColumnCollapsed(column.id)}
            className="cursor-pointer border-none bg-transparent text-[11px] text-wall-subtle"
          >
            {'\u25C0'}
          </button>
        </div>

        {/* ── Prompt selector ── */}
        <div className="mt-2 space-y-1.5">
          <label className="block text-[10px] font-medium text-wall-text-dim">Summary Style</label>
          <select
            value={selectedPromptId}
            onChange={(e) => handlePromptChange(e.target.value)}
            className="w-full cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-[11px] text-wall-text outline-none"
          >
            {prompts.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="custom">Custom...</option>
          </select>

          {/* Prompt text — always visible; editing switches to custom */}
          <textarea
            value={displayedPromptText}
            onChange={(e) => handlePromptTextEdit(e.target.value)}
            placeholder="Enter your summary instructions or template..."
            rows={4}
            className={`w-full resize-y rounded-md border px-2 py-1.5 text-[11px] text-wall-text outline-none font-inherit ${
              isCustom ? '' : 'border-wall-muted bg-wall-border'
            }`}
            style={{
              minHeight: 60, maxHeight: 180, boxSizing: 'border-box',
              ...(isCustom ? { borderColor: 'var(--summary-textarea-border)', backgroundColor: 'var(--summary-textarea-bg)' } : {}),
            }}
          />
          {isCustom && selectedPromptId === 'custom' && (
            <div className="text-[9px]" style={{ color: 'var(--summary-hint)' }}>
              Custom prompt — select a style above to reset
            </div>
          )}

          {/* Summarise button */}
          <button
            onClick={handleSummariseAll}
            disabled={summarizing}
            className="w-full cursor-pointer rounded-md border-none bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {summarizing ? 'Summarising...' : 'Summarise'}
          </button>
        </div>
      </div>

      {/* ── Summary output ── */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-2.5 py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
        {overallSummary ? (
          <div className="rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--summary-border)', backgroundColor: 'var(--summary-bg)' }}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--summary-heading)' }}>
                Session Summary
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => navigator.clipboard?.writeText(overallSummary)}
                  className="cursor-pointer border-none bg-transparent text-[9px] summary-action"
                  title="Copy"
                >
                  {'\uD83D\uDCCB'}
                </button>
                <button
                  onClick={handleSummariseAll}
                  disabled={summarizing}
                  className="cursor-pointer border-none bg-transparent text-[9px] summary-action"
                  title="Regenerate"
                >
                  {summarizing ? '\u23F3' : '\uD83D\uDD04'}
                </button>
                <button
                  onClick={() => setSummaryOpen(o => !o)}
                  className="cursor-pointer border-none bg-transparent text-[9px] summary-action"
                  title={summaryOpen ? 'Collapse' : 'Expand'}
                >
                  {summaryOpen ? '\u25B2' : '\u25BC'}
                </button>
                <button
                  onClick={() => {
                    setOverallSummary('');
                    storeUpdateColumn(column.id, {
                      config: { ...column.config, overallSummary: undefined },
                    });
                  }}
                  className="cursor-pointer border-none bg-transparent text-[9px] summary-action"
                  title="Clear"
                >
                  {'\uD83D\uDDD1\uFE0F'}
                </button>
              </div>
            </div>
            {summaryOpen && (
              <div className="card-markdown text-[11px] leading-relaxed summary-text" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--summary-scrollbar) transparent' }}>
                <ReactMarkdown components={safeMarkdownComponents}>{overallSummary}</ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[11px] text-wall-muted" style={{ padding: 24 }}>
            Select a summary style above and click Summarise to generate an overall session summary.
          </div>
        )}

        {/* ── Per-column summary status ── */}
        {summarizableColumns.length > 0 && (
          <div className="mt-3">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-wall-text-dim mb-1.5">
              Column Summaries
            </div>
            <div className="space-y-1">
              {summarizableColumns.map(col => {
                const cards = getVisibleCards(col, allCards, hlCards);
                const hasSummary = !!(col.config?.summary as string);
                const currentHash = computeContentHash(cards);
                const lastHash = (col.config?.summaryHash as string) ?? '';
                const upToDate = hasSummary && currentHash === lastHash;
                const colMeta = COL_TYPES.find(c => c.type === col.type);

                return (
                  <div
                    key={col.id}
                    className="flex items-center gap-1.5 rounded-md border border-wall-border bg-wall-bg px-2 py-1"
                  >
                    <SvgIcon name={colMeta?.icon || 'clipboard'} size={11} style={{ color: colMeta?.color }} />
                    <span className="flex-1 text-[10px] text-wall-text-dim truncate">
                      {col.title}
                    </span>
                    <span className="text-[9px] text-wall-subtle">
                      {cards.length} cards
                    </span>
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: cards.length === 0
                          ? '#475569'
                          : upToDate
                            ? '#22c55e'
                            : hasSummary
                              ? '#f59e0b'
                              : '#475569',
                      }}
                      title={
                        cards.length === 0
                          ? 'No cards'
                          : upToDate
                            ? 'Summary up to date'
                            : hasSummary
                              ? 'Content changed since last summary'
                              : 'Not yet summarized'
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryColumn;
