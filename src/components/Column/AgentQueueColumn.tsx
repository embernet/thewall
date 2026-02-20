import React, { useState } from 'react';
import type { Column, AgentTask } from '@/types';
import { useSessionStore } from '@/store/session';

interface AgentQueueColumnProps {
  column: Column;
  onRetryTask: (task: AgentTask) => void;
}

const AgentQueueColumn: React.FC<AgentQueueColumnProps> = ({
  column,
  onRetryTask,
}) => {
  const agentTasks = useSessionStore((s) => s.agentTasks);
  const agentBusy = useSessionStore((s) => s.agentBusy);

  const recent = agentTasks.slice(-50).reverse();
  const running = Object.entries(agentBusy || {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  const queuedCount = agentTasks.filter((t) => t.status === 'queued').length;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');

  const toggle = (id: string) =>
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const startEdit = (t: AgentTask) => {
    setEditingPrompt(t.id);
    setEditedPrompt(t.prompt || '');
  };

  return (
    <div className="flex h-full min-w-[340px] w-[340px] flex-col border-r border-wall-border bg-wall-surface">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-wall-border px-2.5 pt-2 pb-1.5">
        <div className="flex items-center gap-[5px]">
          <span className="text-sm">{'\u26A1'}</span>
          <span className="text-xs font-semibold text-wall-text">
            Agent Queue
          </span>
          {queuedCount > 0 && (
            <span className="rounded-lg bg-indigo-500/20 px-[5px] text-[10px] font-semibold text-indigo-300">
              {queuedCount} queued
            </span>
          )}
          {running.length > 0 && (
            <span className="animate-pulse text-[10px] text-yellow-500">
              {'\u25CF'} {running.length} active
            </span>
          )}
        </div>
        {agentTasks.length > 0 && (
          <div className="mt-[5px] flex gap-2 text-[10px] text-wall-text-dim">
            <span className="text-green-500">
              {'\u2713'}{' '}
              {agentTasks.filter((t) => t.status === 'completed').length}
            </span>
            <span className="text-red-500">
              {'\u2717'}{' '}
              {agentTasks.filter((t) => t.status === 'failed').length}
            </span>
            <span className="text-yellow-500">
              {'\u23F3'} {running.length}
            </span>
            {queuedCount > 0 && (
              <span className="text-indigo-300">
                {'\u23F1\uFE0F'} {queuedCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div
        className="flex-1 overflow-auto px-2 py-1.5"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--scrollbar-thumb) transparent',
        }}
      >
        {/* Running agents */}
        {running.length > 0 && (
          <div className="mb-2">
            <div className="mb-1 text-[10px] font-semibold text-yellow-500">
              RUNNING
            </div>
            {running.map((k) => {
              // Try to find the agent name from the most recent task with this key
              const matchingTask = agentTasks.find(
                (t) => t.agentKey === k && t.status === 'running',
              );
              return (
                <div
                  key={k}
                  className="mb-1 rounded-md bg-wall-border px-2 py-1.5"
                  style={{ borderLeft: '3px solid #eab308' }}
                >
                  <div className="text-[11px] font-semibold text-wall-text">
                    {matchingTask?.agentName || k}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-yellow-500">
                    <span className="inline-block h-2.5 w-2.5 animate-spin-fast rounded-full border-2 border-yellow-500 border-t-transparent" />
                    Processing...
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History */}
        {recent.length > 0 ? (
          <div>
            <div className="mb-1 text-[10px] font-semibold text-wall-text-dim">
              HISTORY
            </div>
            {recent.map((t) => {
              const isExp = expanded[t.id];
              const isFail = t.status === 'failed';
              const isEditing = editingPrompt === t.id;
              return (
                <div
                  key={t.id}
                  className="mb-[5px] overflow-hidden rounded-md"
                  style={{
                    background: 'var(--wall-surface-hex)',
                    border: `1px solid ${isFail ? '#7f1d1d' : 'var(--wall-border-hex)'}`,
                    borderLeft: `3px solid ${
                      t.status === 'completed'
                        ? '#22c55e'
                        : isFail
                          ? '#ef4444'
                          : 'var(--wall-text-dim-hex)'
                    }`,
                  }}
                >
                  {/* Task summary row */}
                  <div
                    className="cursor-pointer px-2 py-1.5"
                    onClick={() => toggle(t.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-wall-text">
                        {t.agentName}
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[9px] font-semibold uppercase"
                          style={{
                            color:
                              t.status === 'completed'
                                ? '#22c55e'
                                : isFail
                                  ? '#ef4444'
                                  : 'var(--wall-text-dim-hex)',
                          }}
                        >
                          {t.status}
                        </span>
                        <span
                          className="text-[10px] text-wall-subtle transition-transform duration-200"
                          style={{
                            transform: isExp
                              ? 'rotate(180deg)'
                              : 'rotate(0deg)',
                          }}
                        >
                          {'\u25BE'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-wall-subtle">
                      {t.status === 'completed' && (
                        <span className="text-green-500">
                          {t.cardsCreated || 0} cards created &bull;{' '}
                        </span>
                      )}
                      {isFail && (
                        <span className="text-red-500">Error &bull; </span>
                      )}
                      {new Date(
                        t.completedAt || t.createdAt,
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                      {t.duration && <span> &bull; {t.duration}ms</span>}
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExp && (
                    <div
                      className="border-t border-wall-border p-2"
                      style={{ background: 'var(--wall-bg-hex)' }}
                    >
                      {/* Error details */}
                      {isFail && t.error && (
                        <div className="mb-2">
                          <div className="mb-[3px] text-[10px] font-semibold text-red-500">
                            Error Details
                          </div>
                          <div
                            className="whitespace-pre-wrap break-words rounded-md font-mono text-[11px] leading-[1.4] text-red-300"
                            style={{
                              background: '#7f1d1d20',
                              border: '1px solid #7f1d1d40',
                              padding: '6px 8px',
                            }}
                          >
                            {t.error}
                          </div>
                        </div>
                      )}

                      {/* Input text */}
                      {t.inputText && (
                        <div className="mb-2">
                          <div className="mb-[3px] text-[10px] font-semibold text-wall-text-dim">
                            Input Text
                          </div>
                          <div className="max-h-20 overflow-auto whitespace-pre-wrap break-words rounded-md bg-wall-border px-2 py-1.5 text-[11px] leading-[1.4] text-wall-text-muted">
                            {t.inputText.length > 300
                              ? t.inputText.slice(0, 300) + '...'
                              : t.inputText}
                          </div>
                        </div>
                      )}

                      {/* Prompt */}
                      {t.prompt && (
                        <div className="mb-2">
                          <div className="mb-[3px] text-[10px] font-semibold text-wall-text-dim">
                            Prompt
                          </div>
                          <div className="max-h-20 overflow-auto whitespace-pre-wrap break-words rounded-md bg-wall-border px-2 py-1.5 font-mono text-[11px] leading-[1.4] text-wall-text-muted">
                            {t.prompt.length > 400
                              ? t.prompt.slice(0, 400) + '...'
                              : t.prompt}
                          </div>
                        </div>
                      )}

                      {/* Result preview */}
                      {t.status === 'completed' && t.resultPreview && (
                        <div className="mb-2">
                          <div className="mb-[3px] text-[10px] font-semibold text-wall-text-dim">
                            Result
                          </div>
                          <div className="max-h-20 overflow-auto whitespace-pre-wrap rounded-md bg-wall-border px-2 py-1.5 text-[11px] leading-[1.4] text-wall-text-muted">
                            {t.resultPreview}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-1">
                        {isFail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryTask(t);
                            }}
                            className="flex cursor-pointer items-center gap-[3px] rounded-[5px] px-2.5 py-1 text-[10px] font-semibold"
                            style={{
                              background: '#4f46e520',
                              color: '#a5b4fc',
                              border: '1px solid #4f46e540',
                            }}
                          >
                            {'\u21BB'} Retry
                          </button>
                        )}
                        {isFail && t.prompt && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(t);
                            }}
                            className="flex cursor-pointer items-center gap-[3px] rounded-[5px] px-2.5 py-1 text-[10px] font-semibold"
                            style={{
                              background: '#06b6d420',
                              color: '#67e8f9',
                              border: '1px solid #06b6d440',
                            }}
                          >
                            {'\u270F\uFE0F'} Edit & Retry
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard?.writeText(
                              JSON.stringify(t, null, 2),
                            );
                          }}
                          className="cursor-pointer rounded-[5px] border border-wall-muted bg-wall-border px-2.5 py-1 text-[10px] text-wall-text-dim"
                        >
                          {'\uD83D\uDCCB'} Copy
                        </button>
                      </div>

                      {/* Edit prompt panel */}
                      {isEditing && (
                        <div className="mt-2 border-t border-wall-border pt-2">
                          <div className="mb-1 text-[10px] font-semibold text-cyan-500">
                            Edit Prompt
                          </div>
                          <textarea
                            value={editedPrompt}
                            onChange={(e) => setEditedPrompt(e.target.value)}
                            className="min-h-[80px] w-full resize-y rounded-md border border-wall-muted bg-wall-border px-2 py-1.5 font-mono text-[11px] leading-[1.4] text-wall-text outline-none"
                            style={{ boxSizing: 'border-box' }}
                          />
                          <div className="mt-1 flex gap-1">
                            <button
                              onClick={() => {
                                onRetryTask({
                                  ...t,
                                  prompt: editedPrompt,
                                });
                                setEditingPrompt(null);
                              }}
                              className="cursor-pointer rounded-[5px] border-none bg-cyan-500 px-3 py-1 text-[10px] font-semibold text-white"
                            >
                              Run with edited prompt
                            </button>
                            <button
                              onClick={() => setEditingPrompt(null)}
                              className="cursor-pointer rounded-[5px] border-none bg-wall-muted px-2.5 py-1 text-[10px] text-wall-text-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 text-center text-xs text-wall-muted">
            Agent tasks will appear here as they run.
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentQueueColumn;
