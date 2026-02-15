import { MODE_COLORS } from '@/types';
import type { EmbeddingProvider } from '@/types';
import { useSessionStore } from '@/store/session';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StatusBarProps {
  simRunning: boolean;
  embeddingProvider: EmbeddingProvider;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatusBar({ simRunning, embeddingProvider }: StatusBarProps) {
  const session = useSessionStore((s) => s.session);
  const cards = useSessionStore((s) => s.cards);
  const agentBusy = useSessionStore((s) => s.agentBusy);

  if (!session) return null;

  const activeCards = cards.filter((c) => !c.isDeleted).length;
  const runningAgents = Object.values(agentBusy).filter(Boolean).length;

  return (
    <div className="flex h-[22px] min-h-[22px] shrink-0 items-center gap-2.5 border-t border-wall-border bg-wall-surface px-3 text-[9px] text-wall-subtle">
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
        <span className="text-cyan-700">
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

      <span>The Wall &mdash; v0.1.0</span>
    </div>
  );
}
