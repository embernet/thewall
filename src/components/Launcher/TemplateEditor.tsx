// ============================================================================
// Template Editor — inline form for creating / editing custom session templates
// ============================================================================

import { useState } from 'react';
import { v4 as uid } from 'uuid';
import type { SessionTemplate, ColumnType, SessionMode } from '@/types';
import { COL_TYPES } from '@/types';
import { builtInAgents } from '@/agents/built-in';
import { SvgIcon } from '@/components/Icons';

const MODES: SessionMode[] = ['silent', 'active', 'sidekick'];

const COLUMN_OPTIONS = COL_TYPES.filter(c => c.type !== 'trash' && c.type !== 'summary');

const AGENT_OPTIONS = builtInAgents
  .filter(a => a.id !== 'image-generator')
  .map(a => ({ id: a.id, name: a.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

interface TemplateEditorProps {
  initial?: SessionTemplate | null;
  onSave: (template: SessionTemplate) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

export default function TemplateEditor({ initial, onSave, onCancel, onDelete }: TemplateEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [mode, setMode] = useState<SessionMode>(initial?.defaultMode ?? 'active');
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
  const [goalPlaceholder, setGoalPlaceholder] = useState(initial?.goalPlaceholder ?? '');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(
    new Set(initial?.enabledAgentIds ?? []),
  );
  const [selectedColumns, setSelectedColumns] = useState<Set<ColumnType>>(
    new Set(initial?.visibleColumnTypes ?? COLUMN_OPTIONS.map(c => c.type)),
  );

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleColumn = (type: ColumnType) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const template: SessionTemplate = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      icon: icon || '\u{1F4CB}',
      description: description.trim(),
      enabledAgentIds: Array.from(selectedAgents),
      visibleColumnTypes: Array.from(selectedColumns),
      defaultMode: mode,
      systemPrompt: systemPrompt.trim(),
      goalPlaceholder: goalPlaceholder.trim(),
      isBuiltIn: false,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(template);
  };

  return (
    <div className="rounded-lg border border-wall-muted bg-wall-border/30 p-3">
      <div className="mb-2 text-[11px] font-semibold text-wall-text">
        {initial ? 'Edit Template' : 'Create Custom Template'}
      </div>

      {/* Name + Icon */}
      <div className="mb-2 flex gap-2">
        <input
          value={icon}
          onChange={e => setIcon(e.target.value)}
          placeholder="Icon"
          className="w-12 rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] text-center text-sm text-wall-text outline-none focus:border-indigo-500"
          maxLength={4}
        />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Template name"
          className="flex-1 rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] text-[11px] text-wall-text outline-none focus:border-indigo-500"
        />
      </div>

      {/* Description */}
      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Short description"
        className="mb-2 w-full rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] text-[11px] text-wall-text outline-none focus:border-indigo-500"
      />

      {/* Mode */}
      <div className="mb-2">
        <label className="mb-1 block text-[10px] text-wall-text-muted">Default Mode</label>
        <div className="flex gap-1">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-medium ${
                mode === m
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                  : 'bg-wall-muted text-wall-text-muted border border-transparent'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* System Prompt */}
      <label className="mb-1 block text-[10px] text-wall-text-muted">System Prompt</label>
      <textarea
        value={systemPrompt}
        onChange={e => setSystemPrompt(e.target.value)}
        placeholder="Guiding context for Chat and agents..."
        rows={3}
        className="mb-2 box-border w-full resize-y rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] font-sans text-[11px] text-wall-text outline-none focus:border-indigo-500"
      />

      {/* Goal Placeholder */}
      <input
        value={goalPlaceholder}
        onChange={e => setGoalPlaceholder(e.target.value)}
        placeholder="Goal placeholder (e.g. 'What are we brainstorming?')"
        className="mb-2 w-full rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] text-[11px] text-wall-text outline-none focus:border-indigo-500"
      />

      {/* Columns */}
      <label className="mb-1 block text-[10px] text-wall-text-muted">
        Visible Columns ({selectedColumns.size})
      </label>
      <div className="mb-2 flex flex-wrap gap-1">
        {COLUMN_OPTIONS.map(c => (
          <button
            key={c.type}
            onClick={() => toggleColumn(c.type)}
            className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
              selectedColumns.has(c.type)
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50'
                : 'bg-wall-muted text-wall-text-dim border border-transparent'
            }`}
          >
            <SvgIcon name={c.icon} size={12} /> {c.title}
          </button>
        ))}
      </div>

      {/* Agents */}
      <label className="mb-1 block text-[10px] text-wall-text-muted">
        Agents ({selectedAgents.size})
        <button
          onClick={() => setSelectedAgents(new Set(AGENT_OPTIONS.map(a => a.id)))}
          className="ml-2 cursor-pointer text-[9px] text-indigo-400 hover:underline"
        >
          all
        </button>
        <button
          onClick={() => setSelectedAgents(new Set())}
          className="ml-1 cursor-pointer text-[9px] text-indigo-400 hover:underline"
        >
          none
        </button>
      </label>
      <div className="mb-3 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
        {AGENT_OPTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => toggleAgent(a.id)}
            className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
              selectedAgents.has(a.id)
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50'
                : 'bg-wall-muted text-wall-text-dim border border-transparent'
            }`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="flex-1 cursor-pointer rounded-lg border-none py-[7px] text-[11px] font-bold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
        >
          {initial ? 'Save Changes' : 'Create Template'}
        </button>
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-wall-muted bg-wall-border px-4 py-[7px] text-[11px] text-wall-text-muted hover:text-wall-text"
        >
          Cancel
        </button>
        {initial && onDelete && (
          <button
            onClick={() => onDelete(initial.id)}
            className="cursor-pointer rounded-lg border border-red-500/30 bg-wall-border px-3 py-[7px] text-[11px] text-red-400 hover:bg-red-500/10"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
