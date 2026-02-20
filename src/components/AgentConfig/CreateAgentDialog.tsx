import React, { useState, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { AGENT_TARGET_COL_TYPES } from '@/types';
import type { CustomAgentConfig } from '@/types';
import { personaRegistry } from '@/personas/base';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (agent: CustomAgentConfig) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CreateAgentDialog: React.FC<CreateAgentDialogProps> = ({ open, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [sysPrompt, setSysPrompt] = useState('');
  const [usrPrompt, setUsrPrompt] = useState('{{transcript}}');
  const [targetCol, setTargetCol] = useState('observations');
  const [priority, setPriority] = useState(5);
  const [triggerOnTranscript, setTriggerOnTranscript] = useState(true);

  const personas = useMemo(() => personaRegistry.list(), []);
  const selectedPersona = personaId ? personaRegistry.get(personaId) : null;

  if (!open) return null;

  function handleCreate() {
    if (!name.trim()) return;

    // Build the effective system prompt: persona prefix + user's additional instructions
    const personaPrefix = selectedPersona?.systemPromptPrefix || '';
    const effectiveSystemPrompt = personaPrefix && sysPrompt.trim()
      ? personaPrefix + '\n\n' + sysPrompt.trim()
      : personaPrefix || sysPrompt.trim();

    if (!effectiveSystemPrompt) return;

    const agent: CustomAgentConfig = {
      id: `custom-${uuid().slice(0, 8)}`,
      name: name.trim(),
      description: description.trim(),
      personaId,
      systemPrompt: effectiveSystemPrompt,
      userPrompt: usrPrompt,
      targetColumn: targetCol,
      priority,
      triggerOnTranscript,
      dependsOn: [],
      inputColumns: [],
      toolIds: [],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(agent);
    // Reset form
    setName('');
    setDescription('');
    setPersonaId(null);
    setSysPrompt('');
    setUsrPrompt('{{transcript}}');
    setTargetCol('observations');
    setPriority(5);
    setTriggerOnTranscript(true);
    onClose();
  }

  const hasValidPrompt = !!(selectedPersona?.systemPromptPrefix || sysPrompt.trim());

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'var(--modal-overlay)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[480px] rounded-xl border border-wall-border bg-wall-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-wall-border">
          <span className="text-sm font-semibold text-wall-text">Create Custom Agent</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm text-wall-subtle hover:text-wall-text hover:bg-wall-border"
          ><span className="pointer-events-none">{'\u2715'}</span></button>
        </div>

        {/* Form */}
        <div className="px-4 py-3 space-y-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Agent Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Competitive Analyst"
              className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1.5 text-[11px] text-wall-text outline-none placeholder:text-wall-subtle focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of what this agent does"
              className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1.5 text-[11px] text-wall-text outline-none placeholder:text-wall-subtle focus:border-indigo-500"
            />
          </div>

          {/* Persona */}
          <div>
            <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Persona</label>
            <p className="text-[8px] text-wall-subtle mb-1">
              Select a persona to use as the basis for this agent's system prompt. Additional instructions below will be appended.
            </p>
            <select
              value={personaId || ''}
              onChange={e => setPersonaId(e.target.value || null)}
              className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1.5 text-[11px] text-wall-text outline-none focus:border-indigo-500"
            >
              <option value="">No persona (write custom system prompt)</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.icon} {p.name} — {p.description}</option>
              ))}
            </select>
            {selectedPersona && (
              <div className="mt-1 rounded-md border border-indigo-500/20 bg-indigo-950/20 px-2 py-1.5">
                <div className="text-[9px] font-semibold text-indigo-300 mb-0.5">
                  {selectedPersona.icon} {selectedPersona.name} persona prompt:
                </div>
                <div className="text-[8px] text-wall-text-dim leading-relaxed max-h-[60px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-wall-muted">
                  {selectedPersona.systemPromptPrefix}
                </div>
              </div>
            )}
          </div>

          {/* System Prompt (additional or full) */}
          <div>
            <label className="block text-[10px] font-semibold text-wall-text mb-0.5">
              {selectedPersona ? 'Additional System Instructions' : 'System Prompt *'}
            </label>
            <textarea
              value={sysPrompt}
              onChange={e => setSysPrompt(e.target.value)}
              rows={4}
              placeholder={selectedPersona
                ? 'Additional instructions appended to the persona prompt (optional).'
                : 'Instructions for the LLM. Describe what insights to extract and output format.'
              }
              className="w-full rounded-md border border-wall-muted bg-wall-border/40 px-2 py-1.5 text-[11px] text-wall-text font-mono outline-none resize-y placeholder:text-wall-subtle focus:border-indigo-500"
            />
          </div>

          {/* User Prompt */}
          <div>
            <label className="block text-[10px] font-semibold text-wall-text mb-0.5">User Prompt</label>
            <textarea
              value={usrPrompt}
              onChange={e => setUsrPrompt(e.target.value)}
              rows={2}
              placeholder="The user message sent to the LLM. Use {{transcript}} for transcript text."
              className="w-full rounded-md border border-wall-muted bg-wall-border/40 px-2 py-1.5 text-[11px] text-wall-text font-mono outline-none resize-y placeholder:text-wall-subtle focus:border-indigo-500"
            />
            <div className="mt-0.5 text-[8px] text-wall-subtle">
              Variables: {'{{transcript}}'}, {'{{cards}}'}, {'{{previousOutput}}'}
            </div>
          </div>

          {/* Settings row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Target Column</label>
              <select
                value={targetCol}
                onChange={e => setTargetCol(e.target.value)}
                className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-[11px] text-wall-text outline-none focus:border-indigo-500"
              >
                {AGENT_TARGET_COL_TYPES.map(c => (
                  <option key={c.type} value={c.type}>{c.icon} {c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-wall-text mb-0.5">Priority: {priority}</label>
              <input
                type="range"
                min={0}
                max={10}
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          {/* Trigger */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={triggerOnTranscript}
                onChange={e => setTriggerOnTranscript(e.target.checked)}
                className="accent-indigo-500"
              />
              <span className="text-[10px] text-wall-text">Trigger on new transcript</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-wall-border px-4 py-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-3 py-1 text-[10px] font-semibold text-wall-text-dim hover:text-wall-text"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !hasValidPrompt}
            className={`cursor-pointer rounded-md border px-3 py-1 text-[10px] font-semibold ${
              name.trim() && hasValidPrompt
                ? 'border-indigo-500 bg-indigo-950 text-indigo-300 hover:bg-indigo-900'
                : 'border-wall-muted bg-wall-border text-wall-subtle cursor-not-allowed'
            }`}
          >
            Create Agent
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAgentDialog;
