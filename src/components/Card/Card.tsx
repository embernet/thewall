import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Card as CardType, ColumnType } from '@/types';
import { SOURCE_BADGES } from '@/types';
import { fmtTime } from '@/utils/ids';
import {
  isDocumentCard,
  getFileName,
  getFileType,
  getFileIcon,
  getFilePath,
  getChunkIds,
} from '@/utils/document-cards';
import { bus } from '@/events/bus';
import { useSessionStore } from '@/store/session';
import ContextMenu, { useContextMenu } from '@/components/ContextMenu/ContextMenu';
import type { MenuItem } from '@/components/ContextMenu/ContextMenu';

// ---------------------------------------------------------------------------
// Highlight border color lookup (dynamic -- must remain inline styles)
// ---------------------------------------------------------------------------
const HIGHLIGHT_COLORS: Record<string, string> = {
  none: 'transparent',
  user: '#f59e0b',
  ai: '#3b82f6',
  both: '#22c55e',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CardProps {
  card: CardType;
  colType: ColumnType;
  speakerColors?: Record<string, string>;
  knownSpeakers?: string[];
  onDelete: (id: string) => void;
  onHighlight: (id: string) => void;
  onPin?: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onSpeakerChange?: (id: string, speaker: string | undefined) => void;
  onAddSpeaker?: (id: string, name: string) => void;
  onSplit?: (id: string, splitIndex: number) => void;
  onNavigate?: (cardId: string) => void;
  onFindRelated?: (card: CardType) => void; // Optional: if not provided, uses event bus
  linkingFrom?: string | null;
  onStartLink?: (cardId: string) => void;
  onCompleteLink?: (cardId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Card({
  card,
  colType,
  speakerColors,
  knownSpeakers,
  onDelete,
  onHighlight,
  onPin,
  onEdit,
  onSpeakerChange,
  onAddSpeaker,
  onSplit,
  onNavigate,
  onFindRelated,
  linkingFrom,
  onStartLink,
  onCompleteLink,
}: CardProps) {
  const [editing, setEditing] = useState(false);
  const [txt, setTxt] = useState(card.content);
  const [hov, setHov] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [rawSourcesOpen, setRawSourcesOpen] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [splitHover, setSplitHover] = useState<number | null>(null);
  const [speakerDropOpen, setSpeakerDropOpen] = useState(false);
  const hamburgerRef = useRef<HTMLDivElement>(null);
  const rawSourcesRef = useRef<HTMLDivElement>(null);
  const speakerDropRef = useRef<HTMLDivElement>(null);
  const { menu, show: showMenu, close: closeMenu } = useContextMenu();

  // Transcript phase detection
  const isRawTranscript = card.userTags.includes('transcript:raw');
  const isCleanTranscript = card.userTags.includes('transcript:clean');

  // Badge override for transcript phases
  const badge = isRawTranscript
    ? { label: 'Raw', bg: '#f97316' }
    : isCleanTranscript
      ? { label: 'Transcript', bg: '#22c55e' }
      : SOURCE_BADGES[card.source] || SOURCE_BADGES.user;
  const borderColor = HIGHLIGHT_COLORS[card.highlightedBy] || 'transparent';
  const highlighted = borderColor !== 'transparent';

  const isLinkSource = linkingFrom === card.id;
  const isLinkTarget = linkingFrom != null && linkingFrom !== card.id;

  const save = () => {
    onEdit(card.id, txt);
    setEditing(false);
  };

  const hasLinks = card.sourceCardIds && card.sourceCardIds.length > 0;

  // For clean transcript cards, source links point to raw cards —
  // show them via a single "Raw" toolbar button dropdown instead of inline link pills.
  const isTranscriptSourceLinks = isCleanTranscript && hasLinks &&
    card.sourceCardIds.some((s) => s.label === 'Raw');
  const hasNonTranscriptLinks = hasLinks && !isTranscriptSourceLinks;

  // Document card detection (tag-based)
  const isDoc = isDocumentCard(card);
  const docFileName = isDoc ? getFileName(card) || 'Unknown file' : null;
  const docFileType = isDoc && docFileName ? getFileType(docFileName) : null;
  const docIcon = isDoc && docFileName ? getFileIcon(docFileName) : null;
  const docFilePath = isDoc ? getFilePath(card) : null;
  const docChunkIds = isDoc ? getChunkIds(card) : [];

  const handleOpenFile = async () => {
    if (docFilePath && window.electronAPI?.shell?.openPath) {
      const error = await window.electronAPI.shell.openPath(docFilePath);
      if (error) console.error('Failed to open file:', error);
    }
  };

  const handleViewChunks = () => {
    bus.emit('document:viewChunks', { docCardId: card.id });
  };

  // Find related handler (prop or event bus)
  const handleFindRelated = (c: CardType) => {
    if (onFindRelated) {
      onFindRelated(c);
    } else {
      bus.emit('card:findRelated', { card: c });
    }
  };

  // Close hamburger menu on outside click
  useEffect(() => {
    if (!hamburgerOpen) return;
    const handler = (e: MouseEvent) => {
      if (hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)) {
        setHamburgerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [hamburgerOpen]);

  // Close raw sources dropdown on outside click
  useEffect(() => {
    if (!rawSourcesOpen) return;
    const handler = (e: MouseEvent) => {
      if (rawSourcesRef.current && !rawSourcesRef.current.contains(e.target as Node)) {
        setRawSourcesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rawSourcesOpen]);

  // Close speaker dropdown on outside click
  useEffect(() => {
    if (!speakerDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (speakerDropRef.current && !speakerDropRef.current.contains(e.target as Node)) {
        setSpeakerDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [speakerDropOpen]);

  // Speaker color (dynamic per-session, must use inline style)
  const spkColor = speakerColors?.[card.speaker ?? ''] || '#64748b';

  // ── Action buttons for the toolbar (icon-only, always present) ──────────
  const toolbarActions = [
    {
      icon: '\uD83D\uDCCB',
      tooltip: 'Copy',
      fn: () => navigator.clipboard?.writeText(card.content),
    },
    {
      icon: '\u270F\uFE0F',
      tooltip: 'Edit',
      fn: () => {
        setTxt(card.content);
        setEditing(true);
      },
    },
    {
      icon: '\u2B50',
      tooltip:
        card.highlightedBy === 'user' || card.highlightedBy === 'both'
          ? 'Remove Highlight'
          : 'Highlight',
      fn: () => onHighlight(card.id),
    },
    ...(onPin
      ? [
          {
            icon: '\uD83D\uDCCC',
            tooltip: card.pinned ? 'Unpin' : 'Pin to Top',
            fn: () => onPin(card.id),
          },
        ]
      : []),
    ...(onStartLink
      ? [
          {
            icon: '\uD83D\uDD17',
            tooltip: 'Link to...',
            fn: () => onStartLink(card.id),
          },
        ]
      : []),
    ...(isTranscriptSourceLinks
      ? [
          {
            icon: '\uD83D\uDCC4',
            tooltip: 'View raw transcript sources',
            fn: () => setRawSourcesOpen((o) => !o),
          },
        ]
      : []),
  ];

  return (
    <div
      id={`card-${card.id}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setHamburgerOpen(false); setRawSourcesOpen(false); setSpeakerDropOpen(false); }}
      onClick={isLinkTarget ? () => onCompleteLink?.(card.id) : undefined}
      onContextMenu={(e) => {
        if (isLinkTarget) return;
        const addNewItem: MenuItem = {
          label: 'Add new...',
          inputPlaceholder: 'Speaker name',
          onInput: (name: string) => onAddSpeaker?.(card.id, name),
          onClick: () => {},
        };
        const speakerChildren: MenuItem[] = knownSpeakers && knownSpeakers.length > 0
          ? [
              // "None" option
              { label: 'None', checked: !card.speaker, onClick: () => onSpeakerChange?.(card.id, undefined) },
              { label: '', separator: true, onClick: () => {} },
              ...knownSpeakers.map((s) => ({
                label: s,
                checked: card.speaker === s,
                onClick: () => onSpeakerChange?.(card.id, s),
              })),
              { label: '', separator: true, onClick: () => {} },
              addNewItem,
            ]
          : [
              { label: 'None', checked: !card.speaker, onClick: () => onSpeakerChange?.(card.id, undefined) },
              { label: '', separator: true, onClick: () => {} },
              addNewItem,
            ];
        const items: MenuItem[] = [
          { label: 'Copy', icon: '\uD83D\uDCCB', onClick: () => navigator.clipboard?.writeText(card.content) },
          { label: 'Edit', icon: '\u270F\uFE0F', onClick: () => { setTxt(card.content); setEditing(true); } },
          { label: card.highlightedBy === 'user' || card.highlightedBy === 'both' ? 'Remove Highlight' : 'Highlight', icon: '\u2B50', onClick: () => onHighlight(card.id) },
          ...(onPin ? [{ label: card.pinned ? 'Unpin' : 'Pin to Top', icon: '\uD83D\uDCCC', onClick: () => onPin(card.id) }] : []),
          ...(onStartLink ? [{ label: 'Link to...', icon: '\uD83D\uDD17', onClick: () => onStartLink(card.id) }] : []),
          ...(onSpeakerChange ? [{ label: 'Speaker', icon: '\uD83D\uDDE3\uFE0F', children: speakerChildren, onClick: () => {} }] : []),
          ...(onSplit ? [{ label: 'Split', icon: '\u2702\uFE0F', onClick: () => setSplitting(true) }] : []),
          { label: 'Find Related', icon: '\uD83D\uDD0D', onClick: () => handleFindRelated(card) },
          { label: '', icon: '', separator: true, onClick: () => {} },
          ...(colType !== 'trash' ? [{ label: 'Delete', icon: '\uD83D\uDDD1\uFE0F', danger: true, onClick: () => onDelete(card.id) }] : []),
        ];
        showMenu(e, items);
      }}
      className={`bg-wall-surface rounded-lg px-2.5 py-2 mb-1.5 transition-all duration-150 ${card.pinned ? 'ring-1 ring-amber-600/40' : ''} ${isLinkSource ? 'ring-2 ring-purple-500' : ''} ${isLinkTarget ? 'cursor-crosshair hover:ring-1 hover:ring-purple-400' : ''} `}
      style={{
        border: `1px solid ${highlighted ? borderColor : isLinkSource ? '#a855f7' : 'var(--wall-border-hex)'}`,
        borderLeft: isRawTranscript
          ? '3px solid #f97316'
          : highlighted
            ? `3px solid ${borderColor}`
            : undefined,
      }}
    >
      {/* ── Top toolbar (always present to avoid layout shift) ────────── */}
      {!editing && (
        <div className="flex items-center gap-0.5 mb-1 h-[18px]">
          {/* Hamburger menu (left) */}
          <div className="relative" ref={hamburgerRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setHamburgerOpen(o => !o); }}
              title="More actions"
              className={`text-[9px] bg-wall-border border border-wall-muted rounded w-[22px] h-[18px] flex items-center justify-center cursor-pointer transition-opacity duration-100 ${hov ? 'opacity-70 hover:opacity-100' : 'opacity-0'}`}
            >
              {'\u2630'}
            </button>
            {/* Hamburger dropdown */}
            {hamburgerOpen && (
              <div className="absolute top-[20px] left-0 z-[100] min-w-[140px] rounded-lg border border-wall-border bg-wall-surface shadow-xl py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHamburgerOpen(false);
                    handleFindRelated(card);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-wall-text hover:bg-wall-border cursor-pointer border-none bg-transparent flex items-center gap-2"
                >
                  <span>🔍</span>
                  <span>Find Related</span>
                </button>
              </div>
            )}
          </div>

          {/* Action buttons (center) */}
          {toolbarActions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                a.fn();
              }}
              title={a.tooltip}
              className={`text-[9px] bg-wall-border border border-wall-muted rounded w-[22px] h-[18px] flex items-center justify-center cursor-pointer transition-opacity duration-100 ${hov ? 'opacity-70 hover:opacity-100' : 'opacity-0'}`}
            >
              {a.icon}
            </button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Close / Delete button (right) */}
          {colType !== 'trash' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(card.id);
              }}
              title="Delete"
              className={`text-[10px] bg-wall-border border border-wall-muted rounded w-[22px] h-[18px] flex items-center justify-center cursor-pointer transition-opacity duration-100 hover:bg-red-900/40 hover:border-red-700/50 hover:text-red-400 ${hov ? 'opacity-70 hover:opacity-100' : 'opacity-0'}`}
            >
              {'\u2715'}
            </button>
          )}
        </div>
      )}

      {/* ── Pinned indicator ──────────────────────────────────────────── */}
      {card.pinned && (
        <div className="text-[9px] text-amber-500 font-semibold mb-0.5">{'\uD83D\uDCCC'} Pinned</div>
      )}

      {/* ── Document header (file cards only) ─────────────────────────── */}
      {isDoc && (
        <div className="mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">{docIcon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-wall-text">
                {docFileName}
              </div>
              <div className="text-[10px] text-wall-subtle">
                {docFileType} · {docChunkIds.length} chunk{docChunkIds.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="mt-1.5 flex gap-1">
            {docFilePath && (
              <button
                onClick={handleOpenFile}
                className="cursor-pointer rounded-md border-none px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ background: 'var(--wall-muted-hex)' }}
                title="Open in default application"
              >
                {'\uD83D\uDCC1'} Open
              </button>
            )}
            {docChunkIds.length > 0 && (
              <button
                onClick={handleViewChunks}
                className="cursor-pointer rounded-md border-none px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ background: '#10b981' }}
                title="View parsed chunks as a column"
              >
                {'\uD83D\uDDC2\uFE0F'} Chunks
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Speaker label (clickable to change) ───────────────────── */}
      {card.speaker && (
        <div className="mb-0.5 relative" ref={speakerDropRef}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (onSpeakerChange) setSpeakerDropOpen((o) => !o);
            }}
            className="text-[10px] font-bold rounded-lg px-1.5 py-px cursor-pointer hover:brightness-125 transition-all duration-75"
            style={{
              color: spkColor,
              background: `${spkColor}18`,
            }}
          >
            {card.speaker}
          </span>
          {speakerDropOpen && onSpeakerChange && (
            <div className="absolute left-0 top-[20px] z-[100] flex flex-wrap gap-[3px] rounded-lg border border-wall-border bg-wall-surface p-1.5 shadow-xl min-w-[120px] max-w-[240px]">
              {/* "None" pill to remove speaker */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeakerChange(card.id, undefined);
                  setSpeakerDropOpen(false);
                }}
                className="text-[10px] font-bold rounded-lg px-1.5 py-px cursor-pointer hover:brightness-125 transition-all duration-75"
                style={{
                  color: '#94a3b8',
                  background: '#94a3b818',
                  border: '1px solid var(--wall-muted-hex)',
                }}
              >
                {'\u2715'} None
              </span>
              {knownSpeakers?.filter((s) => s !== card.speaker).map((s) => {
                const c = speakerColors?.[s] || '#64748b';
                return (
                  <span
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSpeakerChange(card.id, s);
                      setSpeakerDropOpen(false);
                    }}
                    className="text-[10px] font-bold rounded-lg px-1.5 py-px cursor-pointer hover:brightness-125 transition-all duration-75"
                    style={{
                      color: c,
                      background: `${c}18`,
                    }}
                  >
                    {s}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Agent name (shown above content like speaker labels) ───── */}
      {card.sourceAgentName && (
        <div className="mb-0.5">
          <span className="text-[10px] font-bold text-cyan-500">{card.sourceAgentName}</span>
        </div>
      )}

      {/* ── Content / edit / split mode ────────────────────────────── */}
      {splitting ? (
        <div>
          <div className="text-[9px] text-amber-400 mb-1">{'\u2702\uFE0F'} Click between words to split this card:</div>
          <div
            className="text-xs leading-relaxed break-words select-none cursor-pointer"
            onMouseLeave={() => setSplitHover(null)}
          >
            {(() => {
              // Build word boundaries for split points
              const text = card.content;
              const words: { text: string; start: number }[] = [];
              const regex = /\S+/g;
              let match;
              while ((match = regex.exec(text)) !== null) {
                words.push({ text: match[0], start: match.index });
              }
              // For each word, compute the split-point index (the char index where the
              // second card would start). The split point is at the start of each word
              // (except the first). We render the space before each word as part of
              // the clickable zone.
              const elements: React.ReactNode[] = [];
              for (let w = 0; w < words.length; w++) {
                const word = words[w];
                const isFirst = w === 0;
                // Gap text (space) between previous word end and this word start
                const prevEnd = isFirst ? 0 : words[w - 1].start + words[w - 1].text.length;
                const gap = text.slice(prevEnd, word.start);
                const splitIdx = word.start; // split at start of this word

                // Determine highlight colours based on hover
                const inFirstHalf = splitHover !== null && word.start < splitHover;
                const inSecondHalf = splitHover !== null && word.start >= splitHover;
                const wordBg = inFirstHalf
                  ? 'rgba(59, 130, 246, 0.15)'
                  : inSecondHalf
                    ? 'rgba(245, 158, 11, 0.15)'
                    : undefined;
                const wordColor = inFirstHalf
                  ? '#93c5fd'
                  : inSecondHalf
                    ? '#fbbf24'
                    : '#e2e8f0';

                if (!isFirst) {
                  // Render gap + split indicator
                  elements.push(
                    <span
                      key={`gap-${w}`}
                      onMouseEnter={() => setSplitHover(splitIdx)}
                      onClick={() => {
                        setSplitting(false);
                        setSplitHover(null);
                        onSplit?.(card.id, splitIdx);
                      }}
                      style={{
                        position: 'relative',
                        borderLeft: splitHover === splitIdx ? '2px solid #f59e0b' : undefined,
                        paddingLeft: splitHover === splitIdx ? 1 : undefined,
                        color: wordColor,
                      }}
                    >
                      {gap}
                    </span>,
                  );
                } else if (gap) {
                  elements.push(<span key="gap-0">{gap}</span>);
                }

                elements.push(
                  <span
                    key={`word-${w}`}
                    onMouseEnter={() => {
                      if (!isFirst) setSplitHover(splitIdx);
                    }}
                    onClick={!isFirst ? () => {
                      setSplitting(false);
                      setSplitHover(null);
                      onSplit?.(card.id, splitIdx);
                    } : undefined}
                    className="rounded-sm"
                    style={{
                      background: wordBg,
                      color: wordColor,
                      transition: 'background 75ms, color 75ms',
                    }}
                  >
                    {word.text}
                  </span>,
                );
              }
              // Trailing text
              if (words.length > 0) {
                const lastEnd = words[words.length - 1].start + words[words.length - 1].text.length;
                if (lastEnd < text.length) {
                  elements.push(<span key="trail">{text.slice(lastEnd)}</span>);
                }
              }
              return elements;
            })()}
          </div>
          <div className="flex gap-1 mt-1.5">
            <button
              onClick={() => { setSplitting(false); setSplitHover(null); }}
              className="text-[10px] bg-wall-muted text-wall-text-muted border-none rounded px-2 py-0.5 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : editing ? (
        <div>
          <textarea
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            className="w-full bg-wall-border text-wall-text border border-wall-muted rounded-md p-1.5 text-xs resize-y font-[inherit] box-border"
            style={{ minHeight: 50 }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={save}
              className="text-[10px] bg-indigo-600 text-white border-none rounded px-2 py-0.5 cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-[10px] bg-wall-muted text-wall-text-muted border-none rounded px-2 py-0.5 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="card-markdown text-xs text-wall-text leading-normal break-words">
          <ReactMarkdown>{card.content}</ReactMarkdown>
        </div>
      )}

      {/* ── Source links (non-transcript) ──────────────────────────── */}
      {hasNonTranscriptLinks && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {card.sourceCardIds.map((src, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.(src.id);
              }}
              className="text-[9px] text-white border-none rounded-[5px] px-[7px] py-0.5 cursor-pointer flex items-center gap-0.5 opacity-85"
              style={{ background: src.color || 'var(--wall-border-hex)' }}
            >
              <span>{src.icon || '\uD83D\uDCCC'}</span>
              <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                {src.label || 'Source'}
              </span>
              <span className="opacity-60">{'\u2192'}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Raw sources dropdown (clean transcript cards) ─────────── */}
      {rawSourcesOpen && isTranscriptSourceLinks && (
        <RawSourcesDropdown
          ref={rawSourcesRef}
          sourceIds={card.sourceCardIds.map((s) => s.id)}
          onClose={() => setRawSourcesOpen(false)}
        />
      )}

      {/* ── Metadata row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {card.cardNumber != null && (
          <span className="text-[9px] font-mono text-wall-subtle">
            {isRawTranscript ? 'R' : '#'}{card.cardNumber}
          </span>
        )}
        <span
          className="text-[8px] text-white px-1.5 py-px rounded-[7px] font-semibold uppercase tracking-wide"
          style={{ background: badge.bg }}
        >
          {badge.label}
        </span>
        {card.timestamp !== undefined && card.timestamp !== null && (
          <span className="text-[9px] text-wall-subtle">
            {'\u23F1' + fmtTime(card.timestamp)}
          </span>
        )}
        <span className="text-[9px] text-wall-subtle">
          {new Date(card.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Context menu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raw Sources Dropdown — shown on clean transcript cards
// ---------------------------------------------------------------------------

import { forwardRef } from 'react';

interface RawSourcesDropdownProps {
  sourceIds: string[];
  onClose: () => void;
}

const RawSourcesDropdown = forwardRef<HTMLDivElement, RawSourcesDropdownProps>(
  function RawSourcesDropdown({ sourceIds, onClose }, ref) {
    // Look up raw card content from the store
    const allCards = useSessionStore((s) => s.cards);
    const rawCards = sourceIds
      .map((id) => allCards.find((c) => c.id === id))
      .filter(Boolean) as CardType[];

    return (
      <div
        ref={ref}
        className="mt-1.5 rounded-lg border border-orange-700/40 bg-wall-bg overflow-hidden"
      >
        {/* Header */}
        <div className="px-2.5 py-1.5 border-b border-orange-700/30 bg-orange-950/30">
          <div className="text-[10px] text-orange-300 font-medium">
            {'\uD83C\uDF10'} Raw transcript input
          </div>
          <div className="text-[9px] text-orange-400/70 mt-0.5">
            These raw segments were analysed to create this and surrounding cards.
          </div>
        </div>

        {/* Scrollable raw card list */}
        <div className="max-h-[200px] overflow-y-auto">
          {rawCards.length === 0 && (
            <div className="px-2.5 py-2 text-[10px] text-wall-subtle italic">
              Source cards no longer available.
            </div>
          )}
          {rawCards.map((rc, i) => (
            <div
              key={rc.id}
              className={`px-2.5 py-1.5 ${i > 0 ? 'border-t border-wall-border' : ''}`}
            >
              {rc.speaker && (
                <span className="text-[9px] font-bold text-orange-400 mr-1">
                  {rc.speaker}:
                </span>
              )}
              <span className="text-[10px] text-wall-text/80 leading-snug">
                {rc.content}
              </span>
            </div>
          ))}
        </div>

        {/* Close */}
        <div className="px-2.5 py-1 border-t border-wall-border flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-[9px] text-wall-subtle hover:text-wall-text cursor-pointer bg-transparent border-none"
          >
            Close
          </button>
        </div>
      </div>
    );
  },
);
