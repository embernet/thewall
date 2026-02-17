// ============================================================================
// The Wall — Agents Tab (sidebar panel for agent management)
// ============================================================================

import React, { useMemo, useCallback, useState } from 'react';
import { agentRegistry } from '@/agents/registry';
import { COL_TYPES } from '@/types';
import type { AgentConfigOverride } from '@/types';

interface AgentsTabProps {
  agentConfigs: Record<string, AgentConfigOverride>;
  onToggleAgent: (agentId: string, enabled: boolean) => void;
  concurrency: number;
  onConcurrencyChange: (n: number) => void;
}

/** Badge for agent type: 1st-pass, 2nd-pass, utility */
const AgentTypeBadge: React.FC<{ agentType: string }> = ({ agentType }) => {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    '1st-pass': { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', label: '1st' },
    '2nd-pass': { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', label: '2nd' },
    utility: { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', label: 'util' },
  };
  const s = styles[agentType] ?? styles['1st-pass'];
  return (
    <span
      className="rounded-full px-1 text-[8px]"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
};

/** Expandable detail panel for a single agent */
const AgentDetailPanel: React.FC<{
  agent: {
    id: string;
    name: string;
    description: string;
    targetColumn: string;
    triggersOnTranscript: boolean;
    inputSummary: string;
    behaviorType: string;
    agentType: string;
    dedupThreshold: number;
    maxTokens: number;
    dependsOn: string[];
    priority: number;
  };
}> = ({ agent }) => {
  const triggerLabel = agent.triggersOnTranscript
    ? 'Every transcript batch'
    : agent.agentType === 'utility'
      ? 'Manual (methodology system)'
      : 'After dependencies';

  const behaviorLabel =
    agent.behaviorType === 'prompt-plus-code'
      ? 'Prompt + code logic'
      : 'Prompt-governed';

  return (
    <div className="ml-[18px] mr-1 mt-0.5 mb-1.5 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5">
      {/* Description */}
      <div className="mb-1 text-[9px] text-wall-muted">{agent.description}</div>

      {/* Detail rows */}
      <div className="space-y-[2px]">
        <DetailRow label="Target" value={agent.targetColumn} />
        <DetailRow label="Trigger" value={triggerLabel} />
        <DetailRow label="Input" value={agent.inputSummary} />
        <DetailRow label="Behavior" value={behaviorLabel} />
        <DetailRow label="Dedup" value={`${Math.round(agent.dedupThreshold * 100)}%`} />
        <DetailRow label="Max tokens" value={String(agent.maxTokens)} />
        {agent.dependsOn.length > 0 && (
          <DetailRow label="Depends on" value={agent.dependsOn.join(', ')} />
        )}
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex gap-1.5 text-[8px] leading-tight">
    <span className="shrink-0 text-wall-muted" style={{ minWidth: 52 }}>
      {label}
    </span>
    <span className="text-wall-subtle">{value}</span>
  </div>
);

const AgentsTab: React.FC<AgentsTabProps> = ({
  agentConfigs,
  onToggleAgent,
  concurrency,
  onConcurrencyChange,
}) => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = agentRegistry.listGroupedByColumn();
    // Sort groups by the COL_TYPES order
    const colOrder: string[] = COL_TYPES.map(c => c.type as string);
    const entries = Array.from(map.entries()).sort(
      (a, b) => colOrder.indexOf(a[0]) - colOrder.indexOf(b[0]),
    );
    return entries;
  }, []);

  const getColMeta = useCallback((colType: string) => {
    return COL_TYPES.find(c => c.type === colType) || { icon: '\uD83D\uDCCB', title: colType, color: '#6b7280' };
  }, []);

  const isEnabled = useCallback(
    (agentId: string): boolean => {
      const override = agentConfigs[agentId];
      if (override) return override.enabled;
      return true; // default enabled if no override
    },
    [agentConfigs],
  );

  const enabledCount = useCallback(
    (agents: { id: string }[]): number => {
      return agents.filter(a => isEnabled(a.id)).length;
    },
    [isEnabled],
  );

  const toggleExpand = useCallback((agentId: string) => {
    setExpandedAgent(prev => (prev === agentId ? null : agentId));
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Concurrency control — pinned at top */}
      <div className="shrink-0 border-b border-wall-border px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-[9px] text-wall-muted">Workers</span>
          <input
            type="range"
            min={1}
            max={99}
            value={concurrency}
            onChange={e => onConcurrencyChange(parseInt(e.target.value, 10))}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-indigo-500"
          />
          <input
            type="number"
            min={1}
            max={99}
            value={concurrency}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (v >= 1 && v <= 99) onConcurrencyChange(v);
            }}
            className="w-7 shrink-0 rounded border border-wall-border bg-wall-bg py-0 text-center text-[9px] text-wall-text [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Agent groups */}
      <div
        className="flex-1 overflow-auto px-1 py-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
      >
        {grouped.map(([colType, agents]) => {
          const meta = getColMeta(colType);
          const enabled = enabledCount(agents);
          return (
            <div key={colType} className="mb-1.5">
              {/* Group header */}
              <div className="flex items-center gap-1 px-1.5 py-1">
                <span className="text-[10px]">{meta.icon}</span>
                <span className="text-[9px] font-semibold text-wall-subtle">
                  {meta.title}
                </span>
                <span className="text-[8px] text-wall-muted">
                  ({enabled}/{agents.length})
                </span>
              </div>

              {/* Agent rows */}
              {agents.map(agent => {
                const enabled = isEnabled(agent.id);
                const isExpanded = expandedAgent === agent.id;
                return (
                  <div key={agent.id}>
                    <div
                      className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-[3px] hover:bg-white/5"
                      onClick={() => toggleExpand(agent.id)}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => {
                          e.stopPropagation();
                          onToggleAgent(agent.id, !enabled);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="h-3 w-3 cursor-pointer accent-indigo-500"
                      />
                      <span
                        className="min-w-0 flex-1 truncate text-[10px]"
                        style={{
                          color: enabled ? '#e2e8f0' : '#64748b',
                          fontWeight: enabled ? 500 : 400,
                        }}
                      >
                        {agent.name}
                      </span>
                      <AgentTypeBadge agentType={agent.agentType} />
                      <span
                        className="rounded-full px-1 text-[8px]"
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                        }}
                      >
                        p{agent.priority}
                      </span>
                      <span className="text-[8px] text-wall-muted">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>

                    {/* Expandable detail panel */}
                    {isExpanded && <AgentDetailPanel agent={agent} />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentsTab;
