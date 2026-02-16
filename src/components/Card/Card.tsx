import { useState } from 'react';
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
  linkingFrom,
  onStartLink,
  onCompleteLink,
}: CardProps) {
  const [editing, setEditing] = useState(false);
  const [txt, setTxt] = useState(card.content);
  const [hov, setHov] = useState(false);
  const { menu, show: showMenu, close: closeMenu } = useContextMenu();

  const badge = SOURCE_BADGES[card.source] || SOURCE_BADGES.user;
  const borderColor = HIGHLIGHT_COLORS[card.highlightedBy] || 'transparent';
  const highlighted = borderColor !== 'transparent';

  const isLinkSource = linkingFrom === card.id;
  const isLinkTarget = linkingFrom != null && linkingFrom !== card.id;

  const save = () => {
    onEdit(card.id, txt);
    setEditing(false);
  };

  const hasLinks = card.sourceCardIds && card.sourceCardIds.length > 0;

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

  // Speaker color (dynamic per-session, must use inline style)
  const spkColor = speakerColors?.[card.speaker ?? ''] || '#64748b';

  return (
    <div
      id={`card-${card.id}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={isLinkTarget ? () => onCompleteLink?.(card.id) : undefined}
      onContextMenu={(e) => {
        if (isLinkTarget) return; // No context menu during linking
        const items: MenuItem[] = [
          { label: 'Copy', icon: '\uD83D\uDCCB', onClick: () => navigator.clipboard?.writeText(card.content) },
          { label: 'Edit', icon: '\u270F\uFE0F', onClick: () => { setTxt(card.content); setEditing(true); } },
          { label: card.highlightedBy === 'user' || card.highlightedBy === 'both' ? 'Remove Highlight' : 'Highlight', icon: '\u2B50', onClick: () => onHighlight(card.id) },
          ...(onPin ? [{ label: card.pinned ? 'Unpin' : 'Pin to Top', icon: '\uD83D\uDCCC', onClick: () => onPin(card.id) }] : []),
          ...(onStartLink ? [{ label: 'Link to...', icon: '\uD83D\uDD17', onClick: () => onStartLink(card.id) }] : []),
          { label: '', icon: '', separator: true, onClick: () => {} },
          ...(colType !== 'trash' ? [{ label: 'Delete', icon: '\uD83D\uDDD1\uFE0F', danger: true, onClick: () => onDelete(card.id) }] : []),
        ];
        showMenu(e, items);
      }}
      className={`bg-wall-surface rounded-lg px-2.5 py-2 mb-1.5 transition-all duration-150 ${card.pinned ? 'ring-1 ring-amber-600/40' : ''} ${isLinkSource ? 'ring-2 ring-purple-500' : ''} ${isLinkTarget ? 'cursor-crosshair hover:ring-1 hover:ring-purple-400' : ''}`}
      style={{
        border: `1px solid ${highlighted ? borderColor : isLinkSource ? '#a855f7' : '#1e293b'}`,
        borderLeft: highlighted ? `3px solid ${borderColor}` : undefined,
      }}
    >
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

      {/* ── Source links ─────────────────────────────────────────────── */}
      {hasLinks && (
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

      {/* ── Hover action buttons ─────────────────────────────────────── */}
      {hov && !editing && (
        <div className="flex gap-0.5 mt-1 flex-wrap">
          {[
            {
              icon: '\uD83D\uDCCB',
              label: 'Copy',
              fn: () => navigator.clipboard?.writeText(card.content),
            },
            {
              icon: '\u270F\uFE0F',
              label: 'Edit',
              fn: () => {
                setTxt(card.content);
                setEditing(true);
              },
            },
            {
              icon: '\u2B50',
              label:
                card.highlightedBy === 'user' || card.highlightedBy === 'both'
                  ? 'Unhl'
                  : 'Hl',
              fn: () => onHighlight(card.id),
            },
            ...(onPin
              ? [
                  {
                    icon: '\uD83D\uDCCC',
                    label: card.pinned ? 'Unpin' : 'Pin',
                    fn: () => onPin(card.id),
                  },
                ]
              : []),
            ...(onStartLink
              ? [
                  {
                    icon: '\uD83D\uDD17',
                    label: 'Link',
                    fn: () => onStartLink(card.id),
                  },
                ]
              : []),
            ...(colType !== 'trash'
              ? [
                  {
                    icon: '\uD83D\uDDD1\uFE0F',
                    label: 'Del',
                    fn: () => onDelete(card.id),
                  },
                ]
              : []),
          ].map((a, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                a.fn();
              }}
              className="text-[9px] bg-wall-border text-wall-text-muted border border-wall-muted rounded px-1.5 py-px cursor-pointer"
            >
              {a.icon + ' ' + a.label}
            </button>
          ))}
        </div>
      )}

      {/* Context menu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </div>
  );
}
