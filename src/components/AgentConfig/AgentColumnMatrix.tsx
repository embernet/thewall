import React, { useMemo, useState } from 'react';
import { builtInAgents } from '@/agents/built-in';
import type { BaseAgent } from '@/agents/base';
import type { AgentConfigOverride, CustomAgentConfig, ColumnType, ColumnMeta } from '@/types';
import { AGENT_TARGET_COL_TYPES } from '@/types';
import { SvgIcon } from '@/components/Icons';

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------

type MatrixFilter = 'all' | 'session';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentColumnMatrixProps {
  configs: Record<string, AgentConfigOverride>;
  customAgents: CustomAgentConfig[];
  onChangeTarget: (agentId: string, newColumn: string) => void;
  /** Agent IDs enabled for the current session (from template). null/undefined = all */
  sessionEnabledAgentIds?: string[] | null;
  /** Column types visible in the current session. null/undefined = all */
  sessionVisibleColumnTypes?: ColumnType[] | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AgentColumnMatrix: React.FC<AgentColumnMatrixProps> = ({
  configs, customAgents, onChangeTarget, sessionEnabledAgentIds, sessionVisibleColumnTypes,
}) => {
  const [filter, setFilter] = useState<MatrixFilter>('session');

  // Whether session filtering is available (there's an active session with constraints)
  const hasSessionFilter = !!(
    (sessionEnabledAgentIds && sessionEnabledAgentIds.length > 0) ||
    (sessionVisibleColumnTypes && sessionVisibleColumnTypes.length > 0)
  );

  // Build unified agent list: built-in + custom
  const allAgents = useMemo(() => {
    const builtIns = (builtInAgents as BaseAgent[]).map(a => ({
      id: a.id,
      name: a.name,
      defaultColumn: a.targetColumn,
      isCustom: false,
      enabled: configs[a.id]?.enabled !== false,
    }));
    const customs = customAgents.map(a => ({
      id: a.id,
      name: a.name,
      defaultColumn: a.targetColumn,
      isCustom: true,
      enabled: a.enabled,
    }));
    return [...builtIns, ...customs];
  }, [configs, customAgents]);

  // Resolve effective target column for each agent
  const effectiveColumn = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of allAgents) {
      if (a.isCustom) {
        const custom = customAgents.find(c => c.id === a.id);
        map[a.id] = custom?.targetColumn ?? a.defaultColumn;
      } else {
        map[a.id] = configs[a.id]?.targetColumn ?? a.defaultColumn;
      }
    }
    return map;
  }, [allAgents, configs, customAgents]);

  const allColumns = AGENT_TARGET_COL_TYPES;

  // Apply session filter
  const sessionAgentSet = useMemo(
    () => sessionEnabledAgentIds?.length ? new Set(sessionEnabledAgentIds) : null,
    [sessionEnabledAgentIds],
  );
  const sessionColumnSet = useMemo(
    () => sessionVisibleColumnTypes?.length ? new Set(sessionVisibleColumnTypes) : null,
    [sessionVisibleColumnTypes],
  );

  const agents = useMemo(() => {
    if (filter !== 'session' || !sessionAgentSet) return allAgents;
    return allAgents.filter(a => sessionAgentSet.has(a.id));
  }, [filter, allAgents, sessionAgentSet]);

  const columns: readonly ColumnMeta[] = useMemo(() => {
    if (filter !== 'session' || !sessionColumnSet) return allColumns;
    return allColumns.filter(c => sessionColumnSet.has(c.type));
  }, [filter, allColumns, sessionColumnSet]);

  return (
    <div className="flex-1 overflow-auto p-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-wall-subtle">
          Click a cell to assign an agent&rsquo;s output to that column. Each agent outputs to exactly one column.
        </div>
        {hasSessionFilter && (
          <div className="flex items-center gap-1 shrink-0 ml-3">
            <span className="text-[9px] text-wall-subtle mr-0.5">Show:</span>
            <button
              onClick={() => setFilter('all')}
              className={`cursor-pointer rounded-md px-2 py-0.5 text-[9px] font-semibold border transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-500/50'
                  : 'bg-wall-border text-wall-text-dim border-wall-muted hover:text-wall-text'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('session')}
              className={`cursor-pointer rounded-md px-2 py-0.5 text-[9px] font-semibold border transition-colors ${
                filter === 'session'
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-500/50'
                  : 'bg-wall-border text-wall-text-dim border-wall-muted hover:text-wall-text'
              }`}
            >
              Session Enabled
            </button>
          </div>
        )}
      </div>

      <div className="overflow-auto rounded-lg border border-wall-border">
        <table className="border-collapse text-[10px] w-full" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-wall-surface border-b border-r border-wall-border px-2 text-left font-semibold text-wall-text whitespace-nowrap" style={{ height: 90 }}>
                Agent
                {filter === 'session' && (
                  <div className="font-normal text-[8px] text-indigo-400 mt-0.5">session only</div>
                )}
              </th>
              {columns.map(col => (
                <th
                  key={col.type}
                  className="border-b border-r border-wall-border text-center font-semibold text-wall-text"
                  style={{ minWidth: 32, height: 90, padding: 0, verticalAlign: 'bottom', paddingBottom: 4 }}
                >
                  <div className="flex flex-col items-center gap-0.5 h-full justify-end">
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: 9, lineHeight: 1 }} className="flex-1 flex items-start text-wall-text-dim">
                      {col.title}
                    </div>
                    <SvgIcon name={col.icon} size={12} className="shrink-0" style={{ color: col.color }} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => {
              const currentCol = effectiveColumn[agent.id];
              return (
                <tr
                  key={agent.id}
                  className={`${!agent.enabled ? 'opacity-40' : ''} hover:bg-wall-border/20`}
                >
                  <td
                    className="sticky left-0 z-10 bg-wall-surface border-b border-r border-wall-border px-2 py-1 font-medium text-wall-text whitespace-nowrap"
                    title={agent.id}
                  >
                    <span className="flex items-center gap-1.5">
                      <SvgIcon name={agent.id} size={12} className="shrink-0 text-wall-subtle" />
                      {agent.isCustom && (
                        <span className="text-[8px] text-amber-400 font-semibold">usr</span>
                      )}
                      {agent.name}
                    </span>
                  </td>
                  {columns.map(col => {
                    const isActive = currentCol === col.type;
                    return (
                      <td
                        key={col.type}
                        className={`border-b border-r border-wall-border text-center cursor-pointer transition-colors ${
                          isActive
                            ? ''
                            : 'hover:bg-wall-border/40'
                        }`}
                        style={isActive ? { background: col.color + '30' } : undefined}
                        onClick={() => {
                          if (!isActive) onChangeTarget(agent.id, col.type);
                        }}
                        title={`${agent.name} → ${col.title}`}
                      >
                        {isActive && (
                          <span style={{ color: col.color }} className="text-sm font-bold">
                            {'\u25CF'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {agents.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="py-6 text-center text-[10px] text-wall-subtle">
                  No agents match the current filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default AgentColumnMatrix;
