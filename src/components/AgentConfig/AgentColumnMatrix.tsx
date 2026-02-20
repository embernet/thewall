import React, { useMemo } from 'react';
import { builtInAgents } from '@/agents/built-in';
import type { BaseAgent } from '@/agents/base';
import type { AgentConfigOverride, CustomAgentConfig } from '@/types';
import { AGENT_TARGET_COL_TYPES } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentColumnMatrixProps {
  configs: Record<string, AgentConfigOverride>;
  customAgents: CustomAgentConfig[];
  onChangeTarget: (agentId: string, newColumn: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AgentColumnMatrix: React.FC<AgentColumnMatrixProps> = ({
  configs, customAgents, onChangeTarget,
}) => {
  // Build unified agent list: built-in + custom
  const agents = useMemo(() => {
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
    for (const a of agents) {
      if (a.isCustom) {
        const custom = customAgents.find(c => c.id === a.id);
        map[a.id] = custom?.targetColumn ?? a.defaultColumn;
      } else {
        map[a.id] = configs[a.id]?.targetColumn ?? a.defaultColumn;
      }
    }
    return map;
  }, [agents, configs, customAgents]);

  const columns = AGENT_TARGET_COL_TYPES;

  return (
    <div className="flex-1 overflow-auto p-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
      <div className="text-[10px] text-wall-subtle mb-2">
        Click a cell to assign an agent's output to that column. Each agent outputs to exactly one column.
      </div>

      <div className="overflow-auto rounded-lg border border-wall-border">
        <table className="border-collapse text-[10px] w-full" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-wall-surface border-b border-r border-wall-border px-2 text-left font-semibold text-wall-text whitespace-nowrap" style={{ height: 90 }}>
                Agent
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
                    <span className="text-xs shrink-0">{col.icon}</span>
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
                    <span className="flex items-center gap-1">
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
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default AgentColumnMatrix;
