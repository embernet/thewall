import React, { useState, useEffect, useCallback } from 'react';
import { useAgentConfigStore } from '@/store/agent-config';
import { builtInAgents } from '@/agents/built-in';
import type { BaseAgent } from '@/agents/base';
import AgentList from './AgentList';
import AgentDetail from './AgentDetail';
import AgentColumnMatrix from './AgentColumnMatrix';
import CreateAgentDialog from './CreateAgentDialog';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentConfigProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'agents' | 'matrix';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AgentConfig: React.FC<AgentConfigProps> = ({ open, onClose }) => {
  const { configs, customAgents, tools, loading, loadAll, saveConfig, resetConfig, saveCustomAgent, deleteCustomAgent } =
    useAgentConfigStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('agents');

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      loadAll();
      // Auto-select first agent if none selected
      if (!selectedId && builtInAgents.length > 0) {
        setSelectedId(builtInAgents[0].id);
      }
    }
  }, [open, loadAll, selectedId]);

  // Handle column change from the matrix view
  const handleMatrixChangeTarget = useCallback((agentId: string, newColumn: string) => {
    const custom = customAgents.find(a => a.id === agentId);
    if (custom) {
      saveCustomAgent({ ...custom, targetColumn: newColumn, updatedAt: new Date().toISOString() });
    } else {
      const builtIn = (builtInAgents as BaseAgent[]).find(a => a.id === agentId);
      // Only store override if different from default
      const targetColumn = builtIn && newColumn === builtIn.targetColumn ? null : newColumn;
      saveConfig(agentId, { targetColumn });
    }
  }, [customAgents, saveConfig, saveCustomAgent]);

  if (!open) return null;

  const selectedConfig = selectedId ? configs[selectedId] : undefined;
  const selectedCustom = selectedId ? customAgents.find(a => a.id === selectedId) : undefined;

  return (
    <>
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center"
        style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-[900px] max-h-[80vh] rounded-xl border border-wall-border bg-wall-surface shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-wall-border">
            <div className="flex items-center gap-2">
              <span className="text-base">{'\uD83E\uDD16'}</span>
              <span className="text-sm font-semibold text-wall-text">Agent Configuration</span>
              <span className="text-[9px] text-wall-subtle rounded-full bg-wall-border px-2 py-0.5">
                {builtInAgents.length} built-in + {customAgents.length} custom
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Tab switcher */}
              <div className="flex rounded-md border border-wall-muted overflow-hidden">
                <button
                  onClick={() => setTab('agents')}
                  className={`cursor-pointer px-2 py-0.5 text-[9px] font-semibold border-none ${
                    tab === 'agents'
                      ? 'bg-indigo-950 text-indigo-300'
                      : 'bg-wall-border text-wall-text-dim hover:text-wall-text'
                  }`}
                >
                  Agents
                </button>
                <button
                  onClick={() => setTab('matrix')}
                  className={`cursor-pointer px-2 py-0.5 text-[9px] font-semibold border-none border-l border-wall-muted ${
                    tab === 'matrix'
                      ? 'bg-indigo-950 text-indigo-300'
                      : 'bg-wall-border text-wall-text-dim hover:text-wall-text'
                  }`}
                >
                  Column Matrix
                </button>
              </div>
              {tab === 'agents' && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="cursor-pointer rounded-md border border-indigo-500 bg-indigo-950 px-2 py-1 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-900"
                >
                  + New Agent
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm text-wall-subtle hover:text-wall-text hover:bg-wall-border"
              ><span className="pointer-events-none">{'\u2715'}</span></button>
            </div>
          </div>

          {/* Body: tab-driven */}
          {tab === 'agents' ? (
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left: Agent list */}
              <div className="w-[220px] shrink-0">
                <AgentList
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  configs={configs}
                  customAgents={customAgents}
                />
              </div>

              {/* Right: Agent detail */}
              {selectedId ? (
                <AgentDetail
                  agentId={selectedId}
                  config={selectedConfig}
                  customAgent={selectedCustom}
                  tools={tools}
                  onSaveConfig={(id, cfg) => saveConfig(id, cfg)}
                  onResetConfig={id => resetConfig(id)}
                  onSaveCustomAgent={agent => saveCustomAgent(agent)}
                  onDeleteCustomAgent={id => {
                    deleteCustomAgent(id);
                    setSelectedId(builtInAgents[0]?.id || null);
                  }}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-[11px] text-wall-muted">
                  {loading ? 'Loading...' : 'Select an agent from the list'}
                </div>
              )}
            </div>
          ) : (
            <AgentColumnMatrix
              configs={configs}
              customAgents={customAgents}
              onChangeTarget={handleMatrixChangeTarget}
            />
          )}

          {/* Footer */}
          <div className="shrink-0 border-t border-wall-border px-4 py-2 flex items-center justify-between">
            <div className="text-[9px] text-wall-subtle">
              {tab === 'agents'
                ? 'Agents process conversation events and generate insights into columns'
                : 'Click a cell to change which column an agent outputs to'}
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-3 py-1 text-[10px] font-semibold text-wall-text-dim hover:text-wall-text"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Create Agent Dialog */}
      <CreateAgentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={agent => {
          saveCustomAgent(agent);
          setSelectedId(agent.id);
        }}
      />
    </>
  );
};

export default AgentConfig;
