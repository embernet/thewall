import { useSessionStore } from '@/store/session';
import {
  exportSessionToFile,
  exportSessionMarkdown,
  exportSessionCSV,
} from '@/utils/export';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportMenuProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExportMenu({ onClose }: ExportMenuProps) {
  const session = useSessionStore((s) => s.session);
  const cards = useSessionStore((s) => s.cards);
  const columns = useSessionStore((s) => s.columns);
  const speakerColors = useSessionStore((s) => s.speakerColors);
  const agentTasks = useSessionStore((s) => s.agentTasks);

  if (!session) return null;

  const cardCount = cards.filter((c) => !c.isDeleted).length;

  const state = { session, columns, cards, speakerColors, agentTasks };

  const opts: { icon: string; label: string; desc: string; fn: () => void }[] = [
    {
      icon: '\uD83D\uDCBE',
      label: 'Save as JSON (full data, re-importable)',
      desc: 'Complete session data including all cards, columns, agent tasks, and metadata. Can be imported back.',
      fn: () => {
        exportSessionToFile(state);
        onClose();
      },
    },
    {
      icon: '\uD83D\uDCDD',
      label: 'Export as Markdown',
      desc: 'Human-readable document with all columns and cards.',
      fn: () => {
        exportSessionMarkdown(state);
        onClose();
      },
    },
    {
      icon: '\uD83D\uDCCA',
      label: 'Export as CSV',
      desc: 'Spreadsheet-compatible tabular format.',
      fn: () => {
        exportSessionCSV(state);
        onClose();
      },
    },
    {
      icon: '\uD83D\uDCCB',
      label: 'Copy all to clipboard',
      desc: 'Plain text of all cards, grouped by column.',
      fn: () => {
        let txt = '';
        const visCols = columns
          .filter((c) => c.visible && c.type !== 'trash')
          .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
        for (const col of visCols) {
          const colCards = cards
            .filter((c) => c.columnId === col.id && !c.isDeleted)
            .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
          if (!colCards.length) continue;
          txt += '=== ' + col.title + ' ===\n';
          for (const card of colCards) {
            txt += (card.speaker ? card.speaker + ': ' : '') + card.content + '\n';
          }
          txt += '\n';
        }
        navigator.clipboard?.writeText(txt);
        onClose();
      },
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[420px] max-w-[90vw] rounded-xl border border-wall-border bg-wall-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="m-0 text-[15px] font-semibold text-wall-text">Export Session</h3>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-base text-wall-text-dim hover:text-wall-text-muted"
          >
            {'\u2715'}
          </button>
        </div>

        {/* ── Subtitle ── */}
        <div className="mb-3 text-[11px] text-wall-text-dim">
          {session.title} &bull; {cardCount} cards
        </div>

        {/* ── Options ── */}
        {opts.map((o, i) => (
          <button
            key={i}
            onClick={o.fn}
            className="mb-1.5 block w-full cursor-pointer rounded-lg border border-wall-muted bg-wall-border p-3 text-left hover:bg-wall-muted"
          >
            <div className="text-[13px] font-semibold text-wall-text">
              {o.icon} {o.label}
            </div>
            <div className="mt-0.5 text-[11px] text-wall-text-dim">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
