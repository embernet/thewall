import { useState } from 'react';
import { MODE_COLORS } from '@/types';
import type { SessionMode, ApiKeyStatus, QueuePauseReason } from '@/types';
import { SLOT_PROVIDERS } from '@/utils/providers';
import { getChatProvider } from '@/utils/llm';
import { useSessionStore } from '@/store/session';
import { workerPool } from '@/agents/worker-pool';
import { exportSessionToFile } from '@/utils/export';
import { fmtTime } from '@/utils/ids';
import { setModel, getModel } from '@/utils/llm';

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
  apiKeyStatus: ApiKeyStatus;
}

// ---------------------------------------------------------------------------
// Mode options
// ---------------------------------------------------------------------------

const MODES: SessionMode[] = ['silent', 'active', 'sidekick'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Status color for API key
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ApiKeyStatus, string> = {
  unchecked: '#3b82f6', // blue
  checking:  '#3b82f6', // blue
  valid:     '#22c55e', // green
  invalid:   '#ef4444', // red
};

export default function TopBar({
  simRunning,
  onStopSim,
  onToggleRecord,
  onOpenSettings,
  onOpenExport,
  onToggleGraph,
  apiKeyStatus,
}: TopBarProps) {
  const session = useSessionStore((s) => s.session);
  const cards = useSessionStore((s) => s.cards);
  const audio = useSessionStore((s) => s.audio);
  const agentBusy = useSessionStore((s) => s.agentBusy);
  const agentTasks = useSessionStore((s) => s.agentTasks);
  const saveStatus = useSessionStore((s) => s.saveStatus);
  const speakerColors = useSessionStore((s) => s.speakerColors);
  const columns = useSessionStore((s) => s.columns);
  const queuePauseReason = useSessionStore((s) => s.queuePauseReason);

  const setTitle = useSessionStore((s) => s.setTitle);
  const setMode = useSessionStore((s) => s.setMode);
  const goToLauncher = useSessionStore((s) => s.goToLauncher);
  const setSaveStatus = useSessionStore((s) => s.setSaveStatus);
  const setQueuePaused = useSessionStore((s) => s.setQueuePaused);

  const [editTitle, setEditTitle] = useState(false);
  const [selectedModel, setSelectedModel] = useState(getModel());

  // Derived pause state
  const isQueuePaused = queuePauseReason !== null;
  const isAutoPaused = queuePauseReason === 'api_not_ready' || queuePauseReason === 'api_invalid';

  const PAUSE_LABELS: Record<NonNullable<QueuePauseReason>, string> = {
    api_not_ready: 'Waiting for API',
    api_invalid:   'API unavailable',
    user:          'User paused',
  };

  const toggleUserPause = () => {
    if (queuePauseReason === 'user') {
      // Unpause
      setQueuePaused(null);
      workerPool.setPaused(false);
    } else if (!isAutoPaused) {
      // Pause
      setQueuePaused('user');
      workerPool.setPaused(true);
    }
  };

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

      {/* ── Model selector ── */}
      <div className="flex items-center gap-1">
        <div
          className="h-[7px] w-[7px] rounded-full"
          style={{
            backgroundColor: STATUS_COLORS[apiKeyStatus],
            boxShadow: apiKeyStatus === 'checking' ? '0 0 4px #3b82f6' : 'none',
            animation: apiKeyStatus === 'checking' ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
          title={
            apiKeyStatus === 'unchecked' ? 'API key not checked'
              : apiKeyStatus === 'checking' ? 'Verifying API key...'
              : apiKeyStatus === 'valid' ? 'API key valid'
              : 'API key invalid'
          }
        />
        <select
          value={selectedModel}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedModel(id);
            setModel(id);
          }}
          className="cursor-pointer appearance-none rounded-md border border-wall-muted bg-wall-border px-2 py-[2px] pr-5 text-[10px] font-semibold outline-none"
          style={{
            color: STATUS_COLORS[apiKeyStatus],
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
          }}
        >
          {(SLOT_PROVIDERS.find(s => s.slot === 'chat')?.providers.find(p => p.id === getChatProvider())?.models ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
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

      {/* ── Queue pause info banner ── */}
      {isQueuePaused && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-700/30 bg-amber-900/15 px-2 py-0.5">
          <span className="text-[10px]">{isAutoPaused ? '\u23F8\uFE0F' : '\u270B'}</span>
          <span className="text-[9px] font-medium text-amber-300">
            {PAUSE_LABELS[queuePauseReason!]}
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

      {/* ── Queue pause toggle button ── */}
      <button
        onClick={toggleUserPause}
        disabled={isAutoPaused}
        className="cursor-pointer rounded-md border px-2 py-[3px] text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: isQueuePaused ? '#b45309' : '#374151',
          backgroundColor: isQueuePaused ? (isAutoPaused ? '#451a03' : '#78350f') : '#1e293b',
          color: isQueuePaused ? '#fbbf24' : '#64748b',
        }}
        title={
          isAutoPaused
            ? `Queue auto-paused: ${PAUSE_LABELS[queuePauseReason!]}`
            : isQueuePaused
              ? 'Resume agent queue'
              : 'Pause agent queue'
        }
      >
        {isQueuePaused ? '\u25B6 Resume' : '\u23F8 Pause'} Queue
      </button>

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
