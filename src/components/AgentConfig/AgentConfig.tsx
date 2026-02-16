import React, { useState, useMemo } from 'react';
import { agentRegistry } from '@/agents/registry';
import { workerPool } from '@/agents/worker-pool';
import { useSessionStore } from '@/store/session';
import { COL_TYPES } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentConfigProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COL_META = new Map<string, (typeof COL_TYPES)[number]>(COL_TYPES.map(c => [c.type, c]));

function getPriorityLabel(p: number): string {
  if (p >= 7) return 'Critical';
  if (p >= 5) return 'High';
  if (p >= 3) return 'Normal';
  return 'Low';
}

function getPriorityColor(p: number): string {
  if (p >= 7) return '#ef4444';
  if (p >= 5) return '#f59e0b';
  if (p >= 3) return '#3b82f6';
  return '#64748b';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AgentConfig: React.FC<AgentConfigProps> = ({ open, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'first' | 'second'>('all');
  const [search, setSearch] = useState('');

  const agentBusy = useSessionStore(s => s.agentBusy);
  const agentTasks = useSessionStore(s => s.agentTasks);

  // Get all agents from registry
  const allAgents = useMemo(() => agentRegistry.listByPriority(), []);

  // Disabled agents from circuit breaker
  const disabledSet = useMemo(() => new Set(workerPool.getDisabledAgents()), [agentBusy]); // re-derive on busy change

  // Task counts per agent
  const taskCounts = useMemo(() => {
    const counts: Record<string, { total: number; completed: number; failed: number; running: number }> = {};
    for (const t of agentTasks) {
      if (!counts[t.agentKey]) counts[t.agentKey] = { total: 0, completed: 0, failed: 0, running: 0 };
      counts[t.agentKey].total++;
      if (t.status === 'completed') counts[t.agentKey].completed++;
      if (t.status === 'failed') counts[t.agentKey].failed++;
      if (t.status === 'running') counts[t.agentKey].running++;
    }
    return counts;
  }, [agentTasks]);

  // Filtered list
  const agents = useMemo(() => {
    let list = allAgents;

    if (filter === 'first') list = list.filter(a => a.dependsOn.length === 0);
    if (filter === 'second') list = list.filter(a => a.dependsOn.length > 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.targetColumn.toLowerCase().includes(q),
      );
    }

    return list;
  }, [allAgents, filter, search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[620px] max-h-[75vh] rounded-xl border border-wall-border bg-wall-surface shadow-2xl flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-wall-border">
          <div className="flex items-center gap-2">
            <span className="text-base">{'\uD83E\uDD16'}</span>
            <span className="text-sm font-semibold text-wall-text">Agent Configuration</span>
            <span className="text-[9px] text-wall-subtle rounded-full bg-wall-border px-2 py-0.5">
              {allAgents.length} agents
            </span>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-wall-subtle hover:text-wall-text text-sm"
          >{'\u2715'}</button>
        </div>

        {/* ── Toolbar ── */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-wall-border/50">
          {/* Filter tabs */}
          <div className="flex gap-0.5">
            {([
              { k: 'all', l: 'All' },
              { k: 'first', l: '1st Pass' },
              { k: 'second', l: '2nd Pass' },
            ] as const).map(t => (
              <button
                key={t.k}
                onClick={() => setFilter(t.k)}
                className={`cursor-pointer rounded-md px-2 py-[3px] text-[10px] font-semibold border ${
                  filter === t.k
                    ? 'border-indigo-500 bg-indigo-950 text-indigo-300'
                    : 'border-wall-muted bg-wall-border text-wall-text-dim hover:text-wall-text'
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter agents..."
            className="flex-1 rounded-md border border-wall-muted bg-wall-border px-2 py-[3px] text-[11px] text-wall-text outline-none placeholder:text-wall-subtle focus:border-indigo-500"
          />

          {/* Queue status */}
          <div className="flex items-center gap-1 text-[9px]">
            <div
              className={`h-2 w-2 rounded-full ${workerPool.paused ? 'bg-amber-500' : 'bg-green-500'}`}
            />
            <span className={workerPool.paused ? 'text-amber-400' : 'text-green-400'}>
              {workerPool.paused ? 'Paused' : 'Running'}
            </span>
          </div>
        </div>

        {/* ── Agent list ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
        >
          {agents.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-wall-muted">No agents match your filter</div>
          ) : (
            <div className="space-y-1.5">
              {agents.map(agent => {
                const colMeta = COL_META.get(agent.targetColumn);
                const isBusy = agentBusy[agent.id];
                const isDisabled = disabledSet.has(agent.id);
                const counts = taskCounts[agent.id];
                const isSecondPass = agent.dependsOn.length > 0;

                return (
                  <div
                    key={agent.id}
                    className={`rounded-lg border px-3 py-2 transition-colors ${
                      isDisabled
                        ? 'border-red-900/40 bg-red-950/20 opacity-60'
                        : 'border-wall-muted bg-wall-border/30'
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-2">
                      {/* Status dot */}
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isDisabled ? 'bg-red-500' : isBusy ? 'bg-yellow-500 animate-pulse' : 'bg-green-600'
                        }`}
                        title={isDisabled ? 'Circuit-broken' : isBusy ? 'Running' : 'Idle'}
                      />

                      {/* Column icon */}
                      <span className="text-sm shrink-0">{colMeta?.icon || '\uD83D\uDCCC'}</span>

                      {/* Name + ID */}
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-wall-text">{agent.name}</span>
                        <span className="ml-1.5 text-[9px] text-wall-subtle">{agent.id}</span>
                      </div>

                      {/* Priority badge */}
                      <span
                        className="rounded-full px-1.5 py-px text-[8px] font-bold"
                        style={{ color: getPriorityColor(agent.priority), background: getPriorityColor(agent.priority) + '18' }}
                      >
                        P{agent.priority} {getPriorityLabel(agent.priority)}
                      </span>

                      {/* Pass badge */}
                      <span className={`rounded-full px-1.5 py-px text-[8px] font-semibold ${
                        isSecondPass ? 'text-purple-400 bg-purple-900/30' : 'text-cyan-400 bg-cyan-900/30'
                      }`}>
                        {isSecondPass ? '2nd' : '1st'}
                      </span>

                      {/* Circuit breaker toggle */}
                      {isDisabled && (
                        <button
                          onClick={() => workerPool.enableAgent(agent.id)}
                          className="cursor-pointer rounded-md border border-amber-700 bg-amber-900/30 px-2 py-0.5 text-[9px] font-semibold text-amber-400 hover:bg-amber-800/40"
                        >
                          Re-enable
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    <div className="mt-1 text-[10px] text-wall-text-dim leading-snug pl-[18px]">
                      {agent.description}
                    </div>

                    {/* Metadata row */}
                    <div className="mt-1 flex items-center gap-3 pl-[18px] flex-wrap">
                      {/* Target column */}
                      <span className="text-[9px] flex items-center gap-0.5" style={{ color: colMeta?.color || '#64748b' }}>
                        {'\u2192'} {colMeta?.title || agent.targetColumn}
                      </span>

                      {/* Dependencies */}
                      {isSecondPass && (
                        <span className="text-[9px] text-wall-subtle">
                          {'\u21E0'} {agent.dependsOn.join(', ')}
                        </span>
                      )}

                      {/* Task stats */}
                      {counts && (
                        <div className="flex items-center gap-1.5 text-[9px]">
                          {counts.completed > 0 && (
                            <span className="text-green-500">{'\u2713'}{counts.completed}</span>
                          )}
                          {counts.failed > 0 && (
                            <span className="text-red-400">{'\u2717'}{counts.failed}</span>
                          )}
                          {counts.running > 0 && (
                            <span className="text-yellow-500">{'\u25B6'}{counts.running}</span>
                          )}
                          <span className="text-wall-subtle">{counts.total} total</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-wall-border px-4 py-2 flex items-center justify-between">
          <div className="text-[9px] text-wall-subtle">
            {disabledSet.size > 0 && (
              <span className="text-red-400">
                {'\u26A0\uFE0F'} {disabledSet.size} agent{disabledSet.size > 1 ? 's' : ''} circuit-broken
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {disabledSet.size > 0 && (
              <button
                onClick={() => {
                  for (const id of disabledSet) workerPool.enableAgent(id);
                }}
                className="cursor-pointer rounded-md border border-amber-700 bg-amber-900/20 px-3 py-1 text-[10px] font-semibold text-amber-400 hover:bg-amber-800/30"
              >
                Re-enable All
              </button>
            )}
            <button
              onClick={onClose}
              className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-3 py-1 text-[10px] font-semibold text-wall-text-dim hover:text-wall-text"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentConfig;
