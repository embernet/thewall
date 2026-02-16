import React, { useState, useEffect, useMemo } from 'react';
import { builtInAgents } from '@/agents/built-in';
import type { BaseAgent, AgentContext } from '@/agents/base';
import type { AgentConfigOverride, CustomAgentConfig } from '@/types';
import { COL_TYPES } from '@/types';
import type { ToolManifest } from '@/tools/adapter';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentDetailProps {
  agentId: string;
  config: AgentConfigOverride | undefined;
  customAgent: CustomAgentConfig | undefined;
  tools: ToolManifest[];
  onSaveConfig: (agentId: string, config: Partial<AgentConfigOverride>) => void;
  onResetConfig: (agentId: string) => void;
  onSaveCustomAgent: (agent: CustomAgentConfig) => void;
  onDeleteCustomAgent: (id: string) => void;
}

// Dummy context for extracting default prompts
const DUMMY_CTX: AgentContext = {
  sessionId: '',
  mode: 'sidekick',
  recentTranscript: '{{transcript}}',
  relatedCards: [],
  allCards: [],
  columns: [],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AgentDetail: React.FC<AgentDetailProps> = ({
  agentId, config, customAgent, tools,
  onSaveConfig, onResetConfig, onSaveCustomAgent, onDeleteCustomAgent,
}) => {
  // Find the built-in agent (if it is one)
  const builtIn = useMemo(
    () => (builtInAgents as BaseAgent[]).find(a => a.id === agentId),
    [agentId]
  );

  const isCustom = !!customAgent && !builtIn;
  const isBuiltIn = !!builtIn;

  // Local state for editing
  const [sysPrompt, setSysPrompt] = useState('');
  const [usrPrompt, setUsrPrompt] = useState('');
  const [priority, setPriority] = useState(5);
  const [targetCol, setTargetCol] = useState('');
  const [triggerOnTranscript, setTriggerOnTranscript] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);

  // Default prompts for built-in agents
  const defaultSysPrompt = builtIn ? builtIn.systemPrompt(DUMMY_CTX) : '';
  const defaultUsrPrompt = builtIn ? builtIn.userPrompt(DUMMY_CTX) : '';

  // Initialize from config/customAgent/builtIn
  useEffect(() => {
    if (isCustom && customAgent) {
      setSysPrompt(customAgent.systemPrompt);
      setUsrPrompt(customAgent.userPrompt);
      setPriority(customAgent.priority);
      setTargetCol(customAgent.targetColumn);
      setTriggerOnTranscript(customAgent.triggerOnTranscript);
      setEnabled(customAgent.enabled);
    } else if (builtIn) {
      setSysPrompt(config?.systemPrompt ?? defaultSysPrompt);
      setUsrPrompt(config?.userPrompt ?? defaultUsrPrompt);
      setPriority(config?.priority ?? builtIn.priority);
      setTargetCol(config?.targetColumn ?? builtIn.targetColumn);
      setTriggerOnTranscript(config?.triggerOnTranscript ?? builtIn.triggersOnTranscript);
      setEnabled(config?.enabled ?? true);
    }
    setDirty(false);
  }, [agentId, config, customAgent, builtIn, isCustom, defaultSysPrompt, defaultUsrPrompt]);

  const name = isCustom ? customAgent!.name : builtIn?.name || agentId;
  const description = isCustom ? customAgent!.description : builtIn?.description || '';
  const dependsOn = isCustom ? customAgent!.dependsOn : builtIn?.dependsOn || [];
  const isSecondPass = dependsOn.length > 0;

  const hasOverride = isBuiltIn && !!config;

  function handleSave() {
    if (isCustom && customAgent) {
      onSaveCustomAgent({
        ...customAgent,
        systemPrompt: sysPrompt,
        userPrompt: usrPrompt,
        priority,
        targetColumn: targetCol,
        triggerOnTranscript,
        enabled,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onSaveConfig(agentId, {
        systemPrompt: sysPrompt !== defaultSysPrompt ? sysPrompt : null,
        userPrompt: usrPrompt !== defaultUsrPrompt ? usrPrompt : null,
        priority: priority !== builtIn?.priority ? priority : null,
        targetColumn: targetCol !== builtIn?.targetColumn ? targetCol : null,
        triggerOnTranscript: triggerOnTranscript !== builtIn?.triggersOnTranscript ? triggerOnTranscript : null,
        enabled,
      });
    }
    setDirty(false);
  }

  function handleReset() {
    if (isCustom) return;
    onResetConfig(agentId);
    if (builtIn) {
      setSysPrompt(defaultSysPrompt);
      setUsrPrompt(defaultUsrPrompt);
      setPriority(builtIn.priority);
      setTargetCol(builtIn.targetColumn);
      setTriggerOnTranscript(builtIn.triggersOnTranscript);
      setEnabled(true);
    }
    setDirty(false);
  }

  function markDirty() {
    setDirty(true);
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-3"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-wall-text">{name}</div>
          <div className="text-[10px] text-wall-subtle">{description}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {isSecondPass && (
            <span className="rounded-full px-1.5 py-px text-[8px] font-semibold text-purple-400 bg-purple-900/30">
              2nd Pass
            </span>
          )}
          {!isSecondPass && isBuiltIn && (
            <span className="rounded-full px-1.5 py-px text-[8px] font-semibold text-cyan-400 bg-cyan-900/30">
              1st Pass
            </span>
          )}
          {isCustom && (
            <span className="rounded-full px-1.5 py-px text-[8px] font-semibold text-amber-400 bg-amber-900/30">
              Custom
            </span>
          )}
        </div>
      </div>

      {/* Enable/Disable toggle */}
      <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border border-wall-muted bg-wall-border/20">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => { setEnabled(e.target.checked); markDirty(); }}
            className="accent-indigo-500"
          />
          <span className={`text-[11px] font-semibold ${enabled ? 'text-green-400' : 'text-red-400'}`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {/* System Prompt */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-wall-text">System Prompt</label>
          {isBuiltIn && sysPrompt !== defaultSysPrompt && (
            <button
              onClick={() => { setSysPrompt(defaultSysPrompt); markDirty(); }}
              className="cursor-pointer border-none bg-transparent text-[9px] text-indigo-400 hover:text-indigo-300"
            >
              Reset to default
            </button>
          )}
        </div>
        <textarea
          value={sysPrompt}
          onChange={e => { setSysPrompt(e.target.value); markDirty(); }}
          rows={4}
          className="w-full rounded-md border border-wall-muted bg-wall-border/40 px-2 py-1.5 text-[11px] text-wall-text font-mono outline-none resize-y placeholder:text-wall-subtle focus:border-indigo-500"
          placeholder="System prompt..."
        />
      </div>

      {/* User Prompt */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-wall-text">User Prompt</label>
          {isBuiltIn && usrPrompt !== defaultUsrPrompt && (
            <button
              onClick={() => { setUsrPrompt(defaultUsrPrompt); markDirty(); }}
              className="cursor-pointer border-none bg-transparent text-[9px] text-indigo-400 hover:text-indigo-300"
            >
              Reset to default
            </button>
          )}
        </div>
        <textarea
          value={usrPrompt}
          onChange={e => { setUsrPrompt(e.target.value); markDirty(); }}
          rows={3}
          className="w-full rounded-md border border-wall-muted bg-wall-border/40 px-2 py-1.5 text-[11px] text-wall-text font-mono outline-none resize-y placeholder:text-wall-subtle focus:border-indigo-500"
          placeholder="User prompt (use {{transcript}} for transcript text)..."
        />
        <div className="mt-0.5 text-[8px] text-wall-subtle">
          Variables: {'{{transcript}}'}, {'{{cards}}'}, {'{{previousOutput}}'}
        </div>
      </div>

      {/* Settings row */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {/* Target Column */}
        <div>
          <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Target Column</label>
          <select
            value={targetCol}
            onChange={e => { setTargetCol(e.target.value); markDirty(); }}
            className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-[11px] text-wall-text outline-none focus:border-indigo-500"
          >
            {COL_TYPES.map(c => (
              <option key={c.type} value={c.type}>{c.icon} {c.title}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[10px] font-semibold text-wall-text mb-0.5">
            Priority: {priority}
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={priority}
            onChange={e => { setPriority(Number(e.target.value)); markDirty(); }}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[8px] text-wall-subtle">
            <span>Low</span><span>High</span>
          </div>
        </div>

        {/* Trigger */}
        <div>
          <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Trigger</label>
          <select
            value={triggerOnTranscript ? 'transcript' : 'dependency'}
            onChange={e => { setTriggerOnTranscript(e.target.value === 'transcript'); markDirty(); }}
            className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-[11px] text-wall-text outline-none focus:border-indigo-500"
          >
            <option value="transcript">On Transcript</option>
            <option value="dependency">On Dependency</option>
          </select>
        </div>

        {/* Dependencies */}
        <div>
          <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Depends On</label>
          <div className="text-[10px] text-wall-text-dim px-2 py-1 rounded-md border border-wall-muted bg-wall-border/20">
            {dependsOn.length > 0 ? dependsOn.join(', ') : 'None'}
          </div>
        </div>
      </div>

      {/* Tools section */}
      {tools.length > 0 && (
        <div className="mb-3">
          <label className="block text-[10px] font-semibold text-wall-text mb-1">Available Tools</label>
          <div className="rounded-md border border-wall-muted bg-wall-border/20 p-2 space-y-1">
            {tools.map(tool => (
              <div key={tool.id} className="flex items-center gap-2">
                <span className="text-[10px] text-wall-text">{'\uD83D\uDD27'}</span>
                <div className="flex-1">
                  <span className="text-[10px] font-semibold text-wall-text">{tool.name}</span>
                  <span className="ml-1 text-[9px] text-wall-subtle">{tool.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-wall-border/50">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`cursor-pointer rounded-md border px-3 py-1 text-[10px] font-semibold ${
            dirty
              ? 'border-indigo-500 bg-indigo-950 text-indigo-300 hover:bg-indigo-900'
              : 'border-wall-muted bg-wall-border text-wall-subtle cursor-not-allowed'
          }`}
        >
          Save Changes
        </button>

        {isBuiltIn && hasOverride && (
          <button
            onClick={handleReset}
            className="cursor-pointer rounded-md border border-amber-700 bg-amber-900/20 px-3 py-1 text-[10px] font-semibold text-amber-400 hover:bg-amber-800/30"
          >
            Reset All to Default
          </button>
        )}

        {isCustom && (
          <button
            onClick={() => onDeleteCustomAgent(agentId)}
            className="cursor-pointer rounded-md border border-red-700 bg-red-900/20 px-3 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-800/30"
          >
            Delete Agent
          </button>
        )}

        {dirty && (
          <span className="text-[9px] text-amber-400">Unsaved changes</span>
        )}
      </div>
    </div>
  );
};

export default AgentDetail;
