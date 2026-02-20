import { useState } from 'react';
import { MODE_COLORS } from '@/types';
import type { ApiKeyStatus, EmbeddingProvider } from '@/types';
import { useSessionStore } from '@/store/session';
import { getChatModels } from '@/utils/providers';
import { getChatProvider, getModel, setModel } from '@/utils/llm';

// ---------------------------------------------------------------------------
// Status color for API key indicator dot
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ApiKeyStatus, string> = {
  unchecked: '#475569',
  checking: '#f59e0b',
  valid: '#22c55e',
  invalid: '#ef4444',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StatusBarProps {
  simRunning: boolean;
  embeddingProvider: EmbeddingProvider;
  apiKeyStatus: ApiKeyStatus;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatusBar({ simRunning, embeddingProvider, apiKeyStatus }: StatusBarProps) {
  const session = useSessionStore((s) => s.session);
  const cards = useSessionStore((s) => s.cards);
  const agentBusy = useSessionStore((s) => s.agentBusy);
  const saveStatus = useSessionStore((s) => s.saveStatus);

  const [selectedModel, setSelectedModel] = useState(getModel());

  if (!session) return null;

  const activeCards = cards.filter((c) => !c.isDeleted).length;
  const runningAgents = Object.values(agentBusy).filter(Boolean).length;

  const provider = getChatProvider();
  const models = getChatModels(provider);

  return (
    <div className="flex h-[22px] min-h-[22px] shrink-0 items-center gap-2.5 border-t border-wall-border bg-wall-surface px-3 text-[9px] text-wall-text-muted">
      <span>
        Mode:{' '}
        <span
          className="font-semibold capitalize"
          style={{ color: MODE_COLORS[session.mode] }}
        >
          {session.mode}
        </span>
      </span>

      <span>Cards: {activeCards}</span>

      {simRunning && <span className="text-red-500">{'\u25CF'} Simulating</span>}

      {runningAgents > 0 && (
        <span className="text-cyan-400">
          {'\u25CF'} {runningAgents} agent{runningAgents > 1 ? 's' : ''} working
        </span>
      )}

      {/* ── Embedding provider indicator ── */}
      <span
        className="flex items-center gap-1"
        title={embeddingProvider === 'openai' ? 'Using OpenAI text-embedding-3-small' : 'Using local TF-IDF embeddings'}
      >
        <span
          className="inline-block h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: embeddingProvider === 'openai' ? '#22c55e' : '#64748b' }}
        />
        Embeddings: {embeddingProvider === 'openai' ? 'OpenAI' : 'Local'}
      </span>

      <div className="flex-1" />

      {/* ── Sync status indicator ── */}
      <span
        className="font-medium"
        style={{
          color:
            saveStatus === 'saved' ? '#22c55e'
              : saveStatus === 'saving' ? '#f59e0b'
              : saveStatus === 'error' ? '#ef4444'
              : '#64748b',
        }}
      >
        {saveStatus === 'saved' ? '\u25CF synced'
          : saveStatus === 'saving' ? '\u25CF syncing...'
          : saveStatus === 'error' ? '\u25CF sync error'
          : '\u25CB unsaved'}
      </span>

      {/* ── Model selector ── */}
      <div className="flex items-center gap-1">
        <span
          className="inline-block h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: STATUS_COLORS[apiKeyStatus] }}
          title={`API: ${apiKeyStatus}`}
        />
        <select
          value={selectedModel}
          onChange={(e) => {
            setModel(e.target.value);
            setSelectedModel(e.target.value);
          }}
          className="cursor-pointer rounded border border-wall-muted/50 bg-wall-border/50 px-1 py-0 text-[9px] text-wall-text-muted outline-none hover:border-wall-subtle focus:border-indigo-500"
          title="Chat model"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <span>The Wall &mdash; v0.2.0</span>
    </div>
  );
}
