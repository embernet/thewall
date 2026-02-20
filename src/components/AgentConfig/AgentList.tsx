import React, { useState, useMemo } from 'react';
import { builtInAgents } from '@/agents/built-in';
import type { BaseAgent } from '@/agents/base';
import type { AgentConfigOverride, CustomAgentConfig } from '@/types';
import { COL_TYPES as COL_META_LIST } from '@/types';
import { SvgIcon } from '@/components/Icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  configs: Record<string, AgentConfigOverride>;
  customAgents: CustomAgentConfig[];
}

type Filter = 'all' | 'first' | 'second' | 'custom' | 'disabled';

const COL_META = new Map<string, (typeof COL_META_LIST)[number]>(COL_META_LIST.map(c => [c.type, c]));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AgentList: React.FC<AgentListProps> = ({ selectedId, onSelect, configs, customAgents }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const agents = useMemo(() => {
    let list = builtInAgents as BaseAgent[];

    // Apply filter
    if (filter === 'first') list = list.filter(a => a.dependsOn.length === 0);
    if (filter === 'second') list = list.filter(a => a.dependsOn.length > 0);
    if (filter === 'disabled') list = list.filter(a => configs[a.id]?.enabled === false);
    if (filter === 'custom') list = [];

    // Apply search to built-in agents
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [filter, search, configs]);

  // Filtered custom agents
  const filteredCustom = useMemo(() => {
    if (filter !== 'all' && filter !== 'custom') return [];
    if (!search.trim()) return customAgents;
    const q = search.toLowerCase();
    return customAgents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    );
  }, [filter, search, customAgents]);

  const filters: { k: Filter; l: string }[] = [
    { k: 'all', l: 'All' },
    { k: 'first', l: '1st Pass' },
    { k: 'second', l: '2nd Pass' },
    { k: 'custom', l: 'Custom' },
    { k: 'disabled', l: 'Disabled' },
  ];

  return (
    <div className="flex flex-col h-full border-r border-wall-border">
      {/* Search */}
      <div className="shrink-0 px-2 pt-2 pb-1">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] text-[11px] text-wall-text outline-none placeholder:text-wall-subtle focus:border-indigo-500"
        />
      </div>

      {/* Filter tabs */}
      <div className="shrink-0 flex gap-0.5 px-2 py-1 flex-wrap">
        {filters.map(f => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`cursor-pointer rounded-md px-1.5 py-[2px] text-[9px] font-semibold border ${
              filter === f.k
                ? 'border-indigo-500 bg-indigo-950 text-indigo-300'
                : 'border-wall-muted bg-wall-border text-wall-text-dim hover:text-wall-text'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Agent list */}
      <div
        className="flex-1 overflow-y-auto px-1 py-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}
      >
        {/* Built-in agents */}
        {agents.map(agent => {
          const meta = COL_META.get(agent.targetColumn);
          const isDisabled = configs[agent.id]?.enabled === false;
          const isSelected = selectedId === agent.id;
          const isSecondPass = agent.dependsOn.length > 0;

          return (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={`w-full text-left rounded-md px-2 py-1.5 mb-0.5 flex items-center gap-1.5 cursor-pointer border-none transition-colors ${
                isSelected
                  ? 'bg-indigo-950/60 text-wall-text'
                  : 'bg-transparent text-wall-text-dim hover:bg-wall-border/40 hover:text-wall-text'
              } ${isDisabled ? 'opacity-40' : ''}`}
            >
              <SvgIcon name={meta?.icon || 'bot'} size={12} className="shrink-0" style={{ color: meta?.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold truncate">{agent.name}</div>
              </div>
              <span className={`text-[8px] font-semibold shrink-0 ${
                isSecondPass ? 'text-purple-400' : 'text-cyan-400'
              }`}>
                {isSecondPass ? '2nd' : '1st'}
              </span>
            </button>
          );
        })}

        {/* Custom agents section */}
        {filteredCustom.length > 0 && (
          <>
            <div className="px-2 py-1 mt-1 text-[8px] font-bold text-wall-subtle uppercase tracking-wider">
              Custom Agents
            </div>
            {filteredCustom.map(agent => {
              const isSelected = selectedId === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelect(agent.id)}
                  className={`w-full text-left rounded-md px-2 py-1.5 mb-0.5 flex items-center gap-1.5 cursor-pointer border-none transition-colors ${
                    isSelected
                      ? 'bg-indigo-950/60 text-wall-text'
                      : 'bg-transparent text-wall-text-dim hover:bg-wall-border/40 hover:text-wall-text'
                  } ${!agent.enabled ? 'opacity-40' : ''}`}
                >
                  <span className="text-xs shrink-0">{'\u2699\uFE0F'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold truncate">{agent.name}</div>
                  </div>
                  <span className="text-[8px] font-semibold text-amber-400 shrink-0">usr</span>
                </button>
              );
            })}
          </>
        )}

        {agents.length === 0 && filteredCustom.length === 0 && (
          <div className="py-6 text-center text-[10px] text-wall-muted">
            No agents match your filter
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentList;
