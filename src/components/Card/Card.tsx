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
  onDelete: (id: string) => void;
  onHighlight: (id: string) => void;
  onPin?: (id: string) => void;
  onEdit: (id: string, content: string) => void;
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
  onDelete,
  onHighlight,
  onPin,
  onEdit,
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
  const hamburgerRef = useRef<HTMLDivElement>(null);
  const rawSourcesRef = useRef<HTMLDivElement>(null);
  const { menu, show: showMenu, close: closeMenu } = useContextMenu();

  // Transcript phase detection
  const isRawTranscript = card.userTags.includes('transcript:raw');
  const isProcessedTranscript = card.userTags.includes('transcript:processed');
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
      onMouseLeave={() => { setHov(false); setHamburgerOpen(false); setRawSourcesOpen(false); }}
      onClick={isLinkTarget ? () => onCompleteLink?.(card.id) : undefined}
      onContextMenu={(e) => {
        if (isLinkTarget) return;
        const items: MenuItem[] = [
          { label: 'Copy', icon: '\uD83D\uDCCB', onClick: () => navigator.clipboard?.writeText(card.content) },
          { label: 'Edit', icon: '\u270F\uFE0F', onClick: () => { setTxt(card.content); setEditing(true); } },
          { label: card.highlightedBy === 'user' || card.highlightedBy === 'both' ? 'Remove Highlight' : 'Highlight', icon: '\u2B50', onClick: () => onHighlight(card.id) },
          ...(onPin ? [{ label: card.pinned ? 'Unpin' : 'Pin to Top', icon: '\uD83D\uDCCC', onClick: () => onPin(card.id) }] : []),
          ...(onStartLink ? [{ label: 'Link to...', icon: '\uD83D\uDD17', onClick: () => onStartLink(card.id) }] : []),
          { label: 'Find Related', icon: '\uD83D\uDD0D', onClick: () => handleFindRelated(card) },
          { label: '', icon: '', separator: true, onClick: () => {} },
          ...(colType !== 'trash' ? [{ label: 'Delete', icon: '\uD83D\uDDD1\uFE0F', danger: true, onClick: () => onDelete(card.id) }] : []),
        ];
        showMenu(e, items);
      }}
      className={`bg-wall-surface rounded-lg px-2.5 py-2 mb-1.5 transition-all duration-150 ${card.pinned ? 'ring-1 ring-amber-600/40' : ''} ${isLinkSource ? 'ring-2 ring-purple-500' : ''} ${isLinkTarget ? 'cursor-crosshair hover:ring-1 hover:ring-purple-400' : ''} ${isProcessedTranscript ? 'opacity-40 max-h-8 overflow-hidden' : ''}`}
      style={{
        border: `1px solid ${highlighted ? borderColor : isLinkSource ? '#a855f7' : '#1e293b'}`,
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
                style={{ background: '#334155' }}
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

      {/* ── Speaker label ────────────────────────────────────────────── */}
      {card.speaker && (
        <div className="mb-0.5">
          <span
            className="text-[10px] font-bold rounded-lg px-1.5 py-px"
            style={{
              color: spkColor,
              background: `${spkColor}18`,
            }}
          >
            {card.speaker}
          </span>
        </div>
      )}

      {/* ── Content / edit mode ──────────────────────────────────────── */}
      {editing ? (
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
              style={{ background: src.color || '#1e293b' }}
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
        <span
          className="text-[8px] text-white px-1.5 py-px rounded-[7px] font-semibold uppercase tracking-wide"
          style={{ background: badge.bg }}
        >
          {badge.label}
        </span>
        {card.sourceAgentName && (
          <span className="text-[9px] text-cyan-500">{card.sourceAgentName}</span>
        )}
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
