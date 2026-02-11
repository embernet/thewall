import { useState } from 'react';
import { MODE_COLORS } from '@/types';
import type { SessionMode } from '@/types';
import { useSessionStore } from '@/store/session';
import { exportSessionToFile } from '@/utils/export';
import { fmtTime } from '@/utils/ids';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TopBarProps {
  simRunning: boolean;
  onStopSim: () => void;
  onToggleRecord: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onToggleGraph: () => void;
}

// ---------------------------------------------------------------------------
// Mode options
// ---------------------------------------------------------------------------

const MODES: SessionMode[] = ['silent', 'active', 'sidekick'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TopBar({
  simRunning,
  onStopSim,
  onToggleRecord,
  onOpenSettings,
  onOpenExport,
  onToggleGraph,
}: TopBarProps) {
  const session = useSessionStore((s) => s.session);
  const cards = useSessionStore((s) => s.cards);
  const audio = useSessionStore((s) => s.audio);
  const agentBusy = useSessionStore((s) => s.agentBusy);
  const agentTasks = useSessionStore((s) => s.agentTasks);
  const saveStatus = useSessionStore((s) => s.saveStatus);
  const speakerColors = useSessionStore((s) => s.speakerColors);
  const columns = useSessionStore((s) => s.columns);

  const setTitle = useSessionStore((s) => s.setTitle);
  const setMode = useSessionStore((s) => s.setMode);
  const goToLauncher = useSessionStore((s) => s.goToLauncher);
  const setSaveStatus = useSessionStore((s) => s.setSaveStatus);

  const [editTitle, setEditTitle] = useState(false);

  if (!session) return null;

  // Derived agent stats
  const agentCount = cards.filter((c) => c.source === 'agent').length;
  const runningAgents = Object.values(agentBusy).filter(Boolean).length;
  const queuedAgents = Math.max(
    0,
    agentTasks.filter((t) => t.status === 'running').length - runningAgents,
  );

  return (
    <div className="flex h-[42px] min-h-[42px] shrink-0 items-center gap-2 border-b border-wall-border bg-wall-surface px-3">
      {/* ── Logo (click to return to launcher) ── */}
      <button
        onClick={goToLauncher}
        className="cursor-pointer border-none bg-transparent p-0"
      >
        <span
          className="text-[15px] font-extrabold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          THE WALL
        </span>
      </button>

      {/* Divider */}
      <div className="h-[18px] w-px bg-wall-border" />

      {/* ── Editable title ── */}
      {editTitle ? (
        <input
          value={session.title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setEditTitle(false)}
          onKeyDown={(e) => e.key === 'Enter' && setEditTitle(false)}
          autoFocus
          className="w-[180px] rounded border border-wall-muted bg-wall-border px-[7px] py-0.5 text-xs text-wall-text outline-none focus:border-indigo-500"
        />
      ) : (
        <span
          onClick={() => setEditTitle(true)}
          className="max-w-[180px] cursor-pointer truncate text-xs font-medium text-wall-text hover:text-indigo-300"
        >
          {session.title}
        </span>
      )}

      {/* ── Mode switcher ── */}
      <div className="flex gap-0.5">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="cursor-pointer rounded-[7px] border-none px-[7px] py-0.5 text-[9px] font-semibold capitalize"
            style={{
              background: session.mode === m ? MODE_COLORS[m] : '#1e293b',
              color: session.mode === m ? '#fff' : '#64748b',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Sim status ── */}
      {simRunning && (
        <div className="flex items-center gap-1 rounded-md border border-red-900/30 bg-red-900/10 px-[7px] py-0.5">
          <div className="h-[5px] w-[5px] animate-pulse-slow rounded-full bg-red-500" />
          <span className="font-mono text-[9px] text-red-300">
            SIM {fmtTime(audio?.elapsed || 0)}
          </span>
          <button
            onClick={onStopSim}
            className="cursor-pointer rounded-[3px] border-none bg-red-900 px-[5px] py-px text-[8px] text-red-300 hover:bg-red-800"
          >
            Stop
          </button>
        </div>
      )}

      {/* ── Recording status (non-sim) ── */}
      {audio?.recording && !simRunning && (
        <div className="flex items-center gap-1 rounded-md bg-red-900/10 px-[7px] py-0.5">
          <div className="h-[5px] w-[5px] animate-pulse-slow rounded-full bg-red-500" />
          <span className="font-mono text-[9px] text-red-300">
            REC {fmtTime(audio?.elapsed || 0)}
          </span>
        </div>
      )}

      {/* ── Agent status infographic ── */}
      {(agentCount > 0 || runningAgents > 0 || queuedAgents > 0) && (
        <div className="flex items-center gap-1.5 rounded-lg border border-cyan-700/20 bg-cyan-700/10 px-2.5 py-0.5">
          <span className="text-[11px]">{'\uD83E\uDD16'}</span>
          <span className="text-[10px] font-semibold text-cyan-300">{agentCount}</span>
          <span className="text-[9px] text-wall-subtle">insights</span>
          {runningAgents > 0 && (
            <>
              <div className="h-3 w-px bg-wall-border" />
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
              <span className="text-[10px] font-semibold text-yellow-500">{runningAgents}</span>
              <span className="text-[9px] text-wall-subtle">active</span>
            </>
          )}
          {queuedAgents > 0 && (
            <>
              <div className="h-3 w-px bg-wall-border" />
              <span className="text-[10px] font-semibold text-wall-text-dim">{queuedAgents}</span>
              <span className="text-[9px] text-wall-subtle">queued</span>
            </>
          )}
        </div>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Knowledge Graph toggle ── */}
      <button
        onClick={onToggleGraph}
        className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-[3px] text-[10px] font-semibold text-purple-400 hover:bg-wall-muted"
        title="Knowledge Graph"
      >
        {'\uD83D\uDD78\uFE0F'} Graph
      </button>

      {/* ── Quick save ── */}
      <button
        onClick={() =>
          exportSessionToFile({
            session,
            columns,
            cards,
            speakerColors,
            agentTasks,
          })
        }
        className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-[3px] text-[10px] font-semibold text-green-500 hover:bg-wall-muted"
        title="Quick save to disk"
      >
        {'\uD83D\uDCBE'}
      </button>

      {/* ── Export button ── */}
      <button
        onClick={onOpenExport}
        className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-[3px] text-[10px] font-semibold text-indigo-300 hover:bg-wall-muted"
        title="Export options"
      >
        {'\uD83D\uDCE4'} Export
      </button>

      {/* ── Save status indicator ── */}
      <span
        className="text-[9px] font-medium"
        style={{
          color:
            saveStatus === 'saved'
              ? '#22c55e'
              : saveStatus === 'saving'
                ? '#f59e0b'
                : saveStatus === 'error'
                  ? '#ef4444'
                  : '#475569',
        }}
      >
        {saveStatus === 'saved'
          ? '\u25CF synced'
          : saveStatus === 'saving'
            ? '\u25CF syncing...'
            : saveStatus === 'error'
              ? '\u25CF sync error'
              : '\u25CB unsaved'}
      </span>

      {/* ── Settings ── */}
      <button
        onClick={onOpenSettings}
        className="cursor-pointer border-none bg-transparent text-[13px] text-wall-text-dim hover:text-wall-text-muted"
      >
        {'\u2699\uFE0F'}
      </button>
    </div>
  );
}
