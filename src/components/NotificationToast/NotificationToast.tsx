import React, { useState, useEffect, useCallback } from 'react';
import { bus } from '@/events/bus';
import { COL_TYPES } from '@/types';
import { useSessionStore } from '@/store/session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  icon: string;
  title: string;
  body: string;
  color: string;
  cardId?: string;
  ts: number;
}

interface NotificationToastProps {
  onNavigate?: (cardId: string) => void;
}

// High-signal agent types that warrant notifications
const NOTIFY_AGENTS = new Set([
  'claim-verifier', 'claim-challenger', 'challenger',
  'tension-finder', 'problem-finder', 'gap-finder',
  'pattern-finder', 'solution-finder',
]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const NotificationToast: React.FC<NotificationToastProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [history, setHistory] = useState<Notification[]>([]);
  const columns = useSessionStore((s) => s.columns);
  const cards = useSessionStore((s) => s.cards);

  const dismiss = useCallback((id: string) => {
    setNotifications(ns => ns.filter(n => n.id !== id));
  }, []);

  // Auto-dismiss toasts after 6s
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications(ns => ns.slice(1));
    }, 6000);
    return () => clearTimeout(timer);
  }, [notifications]);

  // Listen for high-signal agent completions
  useEffect(() => {
    const handler = ({ taskId, agentKey, cardsCreated }: { taskId: string; agentKey: string; cardsCreated: number }) => {
      if (!NOTIFY_AGENTS.has(agentKey) || cardsCreated === 0) return;

      // Find the agent's target column for icon/color
      const agent = agentKey.replace(/-/g, ' ');
      const col = columns.find(c => {
        const meta = COL_TYPES.find(ct => ct.type === c.type);
        return meta && meta.type === agentKey.split('-')[0];
      });
      const meta = col ? COL_TYPES.find(ct => ct.type === col.type) : null;

      // Find the most recently created card by this agent
      const agentCards = cards
        .filter(c => c.sourceAgentId === agentKey || c.sourceAgentName?.toLowerCase().includes(agentKey.split('-')[0]))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latestCard = agentCards[0];

      const n: Notification = {
        id: taskId,
        icon: meta?.icon || '\u26A0\uFE0F',
        title: agent.charAt(0).toUpperCase() + agent.slice(1),
        body: latestCard
          ? latestCard.content.slice(0, 100) + (latestCard.content.length > 100 ? '...' : '')
          : `${cardsCreated} new insight${cardsCreated > 1 ? 's' : ''} generated`,
        color: meta?.color || '#f59e0b',
        cardId: latestCard?.id,
        ts: Date.now(),
      };

      setNotifications(ns => [...ns.slice(-2), n]); // Keep max 3 toasts
      setHistory(h => [n, ...h].slice(0, 50)); // Keep 50 in history
    };

    bus.on('agent:completed', handler);
    return () => { bus.off('agent:completed', handler); };
  }, [columns, cards]);

  return (
    <>
      {/* ── Toast stack (bottom-right) ── */}
      <div className="fixed bottom-12 right-4 z-[9990] flex flex-col gap-2 pointer-events-none"
           style={{ maxWidth: 340 }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto rounded-lg border border-wall-border bg-wall-surface shadow-xl px-3 py-2.5 flex items-start gap-2 animate-slide-in-right cursor-pointer"
            onClick={() => {
              if (n.cardId && onNavigate) onNavigate(n.cardId);
              dismiss(n.id);
            }}
          >
            <span className="text-base shrink-0">{n.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold" style={{ color: n.color }}>{n.title}</div>
              <div className="text-[11px] text-wall-text-dim leading-snug line-clamp-2">{n.body}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
              className="shrink-0 cursor-pointer border-none bg-transparent text-[10px] text-wall-subtle hover:text-wall-text"
            >{'\u2715'}</button>
          </div>
        ))}
      </div>

      {/* ── Notification bell (in TopBar area, rendered absolutely) ── */}
      <div className="fixed top-[10px] right-[180px] z-[9989]">
        <button
          onClick={() => setPanelOpen(o => !o)}
          className="relative cursor-pointer border-none bg-transparent text-[13px] text-wall-text-dim hover:text-wall-text-muted"
          title="Notifications"
        >
          {'\uD83D\uDD14'}
          {history.length > 0 && (
            <span className="absolute -top-0.5 -right-1.5 h-[10px] w-[10px] rounded-full bg-amber-500 text-[7px] text-white flex items-center justify-center font-bold">
              {history.length > 9 ? '9+' : history.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Notification history panel ── */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-[9991]"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="absolute top-[42px] right-[160px] w-[340px] max-h-[400px] rounded-lg border border-wall-border bg-wall-surface shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-wall-border">
              <span className="text-[10px] font-semibold text-wall-text">Notifications</span>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="cursor-pointer border-none bg-transparent text-[9px] text-wall-subtle hover:text-wall-text"
                >Clear all</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
              {history.length === 0 ? (
                <div className="px-3 py-8 text-center text-[11px] text-wall-muted">No notifications yet</div>
              ) : (
                history.map((n) => (
                  <button
                    key={n.id + n.ts}
                    onClick={() => {
                      if (n.cardId && onNavigate) onNavigate(n.cardId);
                      setPanelOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 border-none border-b border-wall-border/50 cursor-pointer bg-transparent hover:bg-wall-border/30 flex items-start gap-2"
                  >
                    <span className="text-sm shrink-0">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-semibold" style={{ color: n.color }}>{n.title}</div>
                      <div className="text-[10px] text-wall-text-dim leading-snug line-clamp-2">{n.body}</div>
                      <div className="text-[8px] text-wall-subtle mt-0.5">
                        {new Date(n.ts).toLocaleTimeString()}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationToast;
