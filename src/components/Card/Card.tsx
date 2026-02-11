import { useState } from 'react';
import type { Card as CardType, ColumnType } from '@/types';
import { SOURCE_BADGES } from '@/types';
import { fmtTime } from '@/utils/ids';
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
  onEdit: (id: string, content: string) => void;
  onNavigate?: (cardId: string) => void;
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
  onEdit,
  onNavigate,
}: CardProps) {
  const [editing, setEditing] = useState(false);
  const [txt, setTxt] = useState(card.content);
  const [hov, setHov] = useState(false);
  const { menu, show: showMenu, close: closeMenu } = useContextMenu();

  const badge = SOURCE_BADGES[card.source] || SOURCE_BADGES.user;
  const borderColor = HIGHLIGHT_COLORS[card.highlightedBy] || 'transparent';
  const highlighted = borderColor !== 'transparent';

  const save = () => {
    onEdit(card.id, txt);
    setEditing(false);
  };

  const hasLinks = card.sourceCardIds && card.sourceCardIds.length > 0;

  // Speaker color (dynamic per-session, must use inline style)
  const spkColor = speakerColors?.[card.speaker ?? ''] || '#64748b';

  return (
    <div
      id={`card-${card.id}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onContextMenu={(e) => {
        const items: MenuItem[] = [
          { label: 'Copy', icon: '\uD83D\uDCCB', onClick: () => navigator.clipboard?.writeText(card.content) },
          { label: 'Edit', icon: '\u270F\uFE0F', onClick: () => { setTxt(card.content); setEditing(true); } },
          { label: card.highlightedBy === 'user' || card.highlightedBy === 'both' ? 'Remove Highlight' : 'Highlight', icon: '\u2B50', onClick: () => onHighlight(card.id) },
          { label: '', icon: '', separator: true, onClick: () => {} },
          ...(colType !== 'trash' ? [{ label: 'Delete', icon: '\uD83D\uDDD1\uFE0F', danger: true, onClick: () => onDelete(card.id) }] : []),
        ];
        showMenu(e, items);
      }}
      className="bg-wall-surface rounded-lg px-2.5 py-2 mb-1.5 transition-all duration-150"
      style={{
        border: `1px solid ${highlighted ? borderColor : '#1e293b'}`,
        borderLeft: highlighted ? `3px solid ${borderColor}` : undefined,
      }}
    >
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
        <div className="text-xs text-wall-text leading-normal whitespace-pre-wrap break-words">
          {card.content}
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
