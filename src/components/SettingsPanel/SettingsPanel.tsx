import { useState, useEffect } from 'react';
import { COL_TYPES } from '@/types';
import type { ColumnMeta } from '@/types';
import { useSessionStore } from '@/store/session';
import { setApiKey, getApiKey } from '@/utils/llm';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Agent definitions displayed in the settings panel.
// These mirror the built-in agents from the prototype plus the Ideas agent.
// ---------------------------------------------------------------------------

const AGENT_DEFINITIONS: { key: string; col: string; name: string; description?: string }[] = [
  { key: 'concepts', col: 'concepts', name: 'Concept Extractor' },
  { key: 'questions', col: 'questions', name: 'Questioner' },
  { key: 'claims', col: 'claims', name: 'Claim Identifier' },
  { key: 'gaps', col: 'gaps', name: 'Gap Finder' },
  { key: 'actions', col: 'actions', name: 'Action Tracker' },
  {
    key: 'ideas',
    col: 'ideas',
    name: 'Idea Generator',
    description:
      'Runs as a second pass after other agents, generating actionable ideas from their findings',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SettingsTab = 'columns' | 'agents' | 'api';

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>('columns');
  const [key, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const columns = useSessionStore((s) => s.columns);
  const toggleColumnVisibility = useSessionStore((s) => s.toggleColumnVisibility);

  useEffect(() => {
    if (open) {
      setKey(getApiKey());
      setKeySaved(!!getApiKey());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="h-full w-[380px] overflow-auto border-l border-wall-border bg-wall-surface p-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-semibold text-wall-text">Settings</h2>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-base text-wall-text-dim hover:text-wall-text-muted"
          >
            {'\u2715'}
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="mb-3.5 flex gap-[3px]">
          {(['columns', 'agents', 'api'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'cursor-pointer rounded-md border-none px-2.5 py-[3px] text-[11px] font-medium capitalize ' +
                (tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-wall-border text-wall-text-dim hover:text-wall-text-muted')
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Columns tab ── */}
        {tab === 'columns' &&
          columns.map((col) => {
            const meta: ColumnMeta | undefined = COL_TYPES.find((c) => c.type === col.type);
            return (
              <div
                key={col.id}
                className="flex items-center justify-between border-b border-wall-border py-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <span>{meta?.icon}</span>
                  <span className="text-xs text-wall-text">{col.title}</span>
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => toggleColumnVisibility(col.id)}
                  className="relative h-[19px] w-9 cursor-pointer rounded-[10px] border-none"
                  style={{ background: col.visible ? '#4f46e5' : '#334155' }}
                >
                  <div
                    className="absolute top-[3px] h-[13px] w-[13px] rounded-full bg-white transition-[left] duration-200"
                    style={{ left: col.visible ? 20 : 3 }}
                  />
                </button>
              </div>
            );
          })}

        {/* ── Agents tab ── */}
        {tab === 'agents' &&
          AGENT_DEFINITIONS.map((a) => (
            <div key={a.key} className="border-b border-wall-border py-2">
              <span className="text-xs font-semibold text-wall-text">{a.name}</span>
              <span className="ml-1.5 text-[10px] text-wall-text-dim">
                {'\u2192'} {a.col}
              </span>
              {a.description && (
                <div className="mt-0.5 text-[10px] text-wall-subtle">{a.description}</div>
              )}
            </div>
          ))}

        {/* ── API tab ── */}
        {tab === 'api' && (
          <div>
            <div className="mb-2 text-xs text-wall-text-muted">
              Enter your Anthropic API key to enable the AI agents.
            </div>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setKeySaved(false); }}
              placeholder="sk-ant-..."
              className="mb-2 w-full rounded-md border border-wall-muted bg-wall-border px-2.5 py-1.5 font-mono text-xs text-wall-text outline-none"
              style={{ boxSizing: 'border-box' }}
            />
            <button
              onClick={() => {
                setApiKey(key.trim());
                setKeySaved(true);
              }}
              className="cursor-pointer rounded-md border-none bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
            >
              {keySaved ? 'Saved' : 'Save Key'}
            </button>
            {keySaved && (
              <span className="ml-2 text-[10px] text-green-500">Key is set</span>
            )}
            <div className="mt-3 text-[10px] text-wall-subtle">
              Your key is stored in memory only and never persisted to disk.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
