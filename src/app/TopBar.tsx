import { useState, useRef, useEffect } from 'react';
import { MODE_COLORS } from '@/types';
import type { SessionMode, QueuePauseReason } from '@/types';
import { useSessionStore } from '@/store/session';
import { workerPool } from '@/agents/worker-pool';
import { exportSessionToFile } from '@/utils/export';
import { fmtTime } from '@/utils/ids';
import {
  IconMenu, IconPause, IconPlay, IconBell, IconSearch, IconDollar, IconBot,
  IconClipboard, IconGraph, IconSave, IconExport, IconSun, IconMoon,
  IconHelp, IconGear, IconInfo,
} from '@/components/Icons';

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
  onOpenSearch: () => void;
  onOpenCost: () => void;
  onOpenAgentConfig: () => void;
  onToggleNotifications: () => void;
  onToggleSummary: () => void;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
  summaryVisible: boolean;
  notificationCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

// ---------------------------------------------------------------------------
// Shared toolbar button style
// ---------------------------------------------------------------------------

const TB = 'cursor-pointer rounded-md border border-wall-muted/60 bg-wall-border/50 p-[5px] text-wall-text-dim hover:bg-wall-muted hover:text-wall-text transition-colors';

// ---------------------------------------------------------------------------
// Mode options
// ---------------------------------------------------------------------------

const MODES: SessionMode[] = ['silent', 'active', 'sidekick'];

export default function TopBar({
  simRunning,
  onStopSim,
  onToggleRecord,
  onOpenSettings,
  onOpenExport,
  onToggleGraph,
  onOpenSearch,
  onOpenCost,
  onOpenAgentConfig,
  onToggleNotifications,
  onToggleSummary,
  onOpenHelp,
  onOpenAbout,
  summaryVisible,
  notificationCount,
  darkMode,
  onToggleDarkMode,
}: TopBarProps) {
  const session = useSessionStore((s) => s.session);
  const cards = useSessionStore((s) => s.cards);
  const audio = useSessionStore((s) => s.audio);
  const agentBusy = useSessionStore((s) => s.agentBusy);
  const agentTasks = useSessionStore((s) => s.agentTasks);
  const speakerColors = useSessionStore((s) => s.speakerColors);
  const columns = useSessionStore((s) => s.columns);
  const queuePauseReason = useSessionStore((s) => s.queuePauseReason);

  const setTitle = useSessionStore((s) => s.setTitle);
  const setMode = useSessionStore((s) => s.setMode);
  const goToLauncher = useSessionStore((s) => s.goToLauncher);
  const setQueuePaused = useSessionStore((s) => s.setQueuePaused);

  const [editTitle, setEditTitle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close hamburger menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

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
      setQueuePaused(null);
      workerPool.setPaused(false);
    } else if (!isAutoPaused) {
      setQueuePaused('user');
      workerPool.setPaused(true);
    }
  };

  if (!session) return null;

  // Derived agent stats
  const agentCount = cards.filter((c) => c.source === 'agent').length;
  const runningAgents = Object.values(agentBusy).filter(Boolean).length;
  const queuedAgents = agentTasks.filter((t) => t.status === 'queued').length;

  // Hamburger menu items use SVG components for consistency
  const menuItems: Array<{ divider: true } | { label: string; icon: React.ReactNode; action: () => void; disabled?: boolean }> = [
    { label: summaryVisible ? 'Hide Summary' : 'Show Summary', icon: <IconClipboard className="text-wall-text-muted" width={14} height={14} />, action: () => { onToggleSummary(); setMenuOpen(false); } },
    { label: 'Knowledge Graph', icon: <IconGraph className="text-purple-400" width={14} height={14} />, action: () => { onToggleGraph(); setMenuOpen(false); } },
    { label: 'Export', icon: <IconExport className="text-indigo-300" width={14} height={14} />, action: () => { onOpenExport(); setMenuOpen(false); } },
    { label: isQueuePaused ? 'Resume Queue' : 'Pause Queue', icon: isQueuePaused ? <IconPlay width={14} height={14} /> : <IconPause width={14} height={14} />, action: () => { toggleUserPause(); setMenuOpen(false); }, disabled: isAutoPaused },
    { divider: true },
    { label: 'Search (Cmd+K)', icon: <IconSearch width={14} height={14} />, action: () => { onOpenSearch(); setMenuOpen(false); } },
    { label: 'Notifications', icon: <IconBell width={14} height={14} />, action: () => { onToggleNotifications(); setMenuOpen(false); } },
    { label: 'API Costs', icon: <IconDollar className="text-amber-400" width={14} height={14} />, action: () => { onOpenCost(); setMenuOpen(false); } },
    { label: 'Agent Config', icon: <IconBot className="text-cyan-400" width={14} height={14} />, action: () => { onOpenAgentConfig(); setMenuOpen(false); } },
    { divider: true },
    { label: 'Help', icon: <IconHelp width={14} height={14} />, action: () => { onOpenHelp(); setMenuOpen(false); } },
    { label: 'About', icon: <IconInfo width={14} height={14} />, action: () => { onOpenAbout(); setMenuOpen(false); } },
    { label: 'Settings', icon: <IconGear width={14} height={14} />, action: () => { onOpenSettings(); setMenuOpen(false); } },
  ];

  return (
    <div className="drag-region flex h-[42px] min-h-[42px] shrink-0 items-center gap-1.5 border-b border-wall-border bg-wall-surface pr-3 pl-[70px]">
      {/* ── Hamburger menu ── */}
      <div className="relative" ref={menuRef}>
        <button onClick={() => setMenuOpen((o) => !o)} className={TB} title="Menu">
          <IconMenu />
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-[34px] z-50 min-w-[190px] rounded-lg border border-wall-border bg-wall-surface py-1 shadow-xl shadow-black/40">
            {menuItems.map((item, i) =>
              'divider' in item ? (
                <div key={i} className="my-1 border-t border-wall-border" />
              ) : (
                <button
                  key={i}
                  onClick={item.action}
                  disabled={item.disabled}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent px-3 py-1.5 text-left text-[11px] text-wall-text hover:bg-wall-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex w-[16px] items-center justify-center">{item.icon}</span>
                  {item.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Logo ── */}
      <button onClick={goToLauncher} className="cursor-pointer border-none bg-transparent p-0">
        <span
          className="whitespace-nowrap text-[15px] font-extrabold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          THE WALL
        </span>
      </button>

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
              background: session.mode === m ? MODE_COLORS[m] : 'var(--wall-border-hex)',
              color: session.mode === m ? '#fff' : 'var(--wall-text-dim-hex)',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Session agent filter badge ── */}
      {session.enabledAgentIds && session.enabledAgentIds.length > 0 && (
        <span
          className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[8px] font-medium text-cyan-300"
          title={`Session has ${session.enabledAgentIds.length} agents enabled (template-configured)`}
        >
          {session.enabledAgentIds.length} agents
        </span>
      )}

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
          {isAutoPaused
            ? <IconPause width={10} height={10} className="text-amber-400" />
            : <span className="text-[10px]">{'\u270B'}</span>
          }
          <span className="text-[9px] font-medium text-amber-300">
            {PAUSE_LABELS[queuePauseReason!]}
          </span>
        </div>
      )}

      {/* ── Agent status infographic ── */}
      {(agentCount > 0 || runningAgents > 0 || queuedAgents > 0) && (
        <div className="flex items-center gap-1.5 rounded-lg border border-cyan-700/20 bg-cyan-700/10 px-2.5 py-0.5">
          <IconBot width={12} height={12} className="text-cyan-400" />
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

      {/* ── Queue pause toggle ── */}
      <button
        onClick={toggleUserPause}
        disabled={isAutoPaused}
        className="cursor-pointer rounded-md border p-[5px] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        style={{
          borderColor: isQueuePaused ? '#b45309' : 'rgb(var(--wall-muted) / 0.6)',
          backgroundColor: isQueuePaused ? (isAutoPaused ? '#451a03' : '#78350f') : 'rgb(var(--wall-border) / 0.5)',
          color: isQueuePaused ? '#fbbf24' : 'var(--wall-text-dim-hex)',
        }}
        title={
          isAutoPaused
            ? `Queue auto-paused: ${PAUSE_LABELS[queuePauseReason!]}`
            : isQueuePaused ? 'Resume agent queue' : 'Pause agent queue'
        }
      >
        {isQueuePaused ? <IconPlay /> : <IconPause />}
      </button>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Notifications ── */}
      <button onClick={onToggleNotifications} className={`relative ${TB}`} title="Notifications">
        <IconBell />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[7px] font-bold text-white">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>

      {/* ── Search ── */}
      <button onClick={onOpenSearch} className={TB} title="Search all cards (Cmd+K)">
        <IconSearch />
      </button>

      {/* ── Cost Dashboard ── */}
      <button onClick={onOpenCost} className={`${TB} text-amber-400 hover:text-amber-300`} title="API Cost Dashboard">
        <IconDollar />
      </button>

      {/* ── Agent Config ── */}
      <button onClick={onOpenAgentConfig} className={`${TB} text-cyan-400 hover:text-cyan-300`} title="Agent Configuration">
        <IconBot />
      </button>

      {/* ── Summary toggle ── */}
      <button
        onClick={onToggleSummary}
        className={`cursor-pointer rounded-md border p-[5px] transition-colors ${
          summaryVisible
            ? 'border-indigo-500/60 bg-indigo-950/30 text-wall-text hover:bg-indigo-950/50'
            : 'border-wall-muted/60 bg-wall-border/50 text-wall-text-dim hover:bg-wall-muted hover:text-wall-text'
        }`}
        title={summaryVisible ? 'Hide Summary' : 'Show Summary'}
      >
        <IconClipboard />
      </button>

      {/* ── Knowledge Graph ── */}
      <button onClick={onToggleGraph} className={`${TB} text-purple-400 hover:text-purple-300`} title="Knowledge Graph">
        <IconGraph />
      </button>

      {/* ── Quick save ── */}
      <button
        onClick={() =>
          exportSessionToFile({ session, columns, cards, speakerColors, agentTasks })
        }
        className={`${TB} text-green-500 hover:text-green-400`}
        title="Quick save to disk"
      >
        <IconSave />
      </button>

      {/* ── Export ── */}
      <button onClick={onOpenExport} className={`${TB} text-indigo-300 hover:text-indigo-200`} title="Export options">
        <IconExport />
      </button>

      {/* ── Dark / Light mode ── */}
      <button onClick={onToggleDarkMode} className={TB} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
        {darkMode ? <IconSun /> : <IconMoon />}
      </button>

      {/* ── Help ── */}
      <button onClick={onOpenHelp} className={TB} title="Help">
        <IconHelp />
      </button>

      {/* ── Settings ── */}
      <button onClick={onOpenSettings} className={TB} title="Settings">
        <IconGear />
      </button>
    </div>
  );
}
