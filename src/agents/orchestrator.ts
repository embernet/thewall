import { bus } from '@/events/bus';
import { useSessionStore } from '@/store/session';
import { workerPool } from './worker-pool';
import { agentRegistry } from './registry';
import { registerBuiltInAgents } from './built-in';
import { embed, vectorToBlob } from '@/utils/embedding-service';
import { loadGraph, clearGraph } from '@/graph/graph-service';
import type { AgentContext } from './base';
import type { Card } from '@/types';

// ---------------------------------------------------------------------------
// Orchestrator
//
// Listens for transcript card events and dispatches agents via the worker pool.
// Replaces the inline runAgents/scheduleAgents logic from App.tsx.
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 4000;

let transcriptBuf: string[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let initialised = false;

/** Initialise the orchestrator: register built-in agents, wire bus listeners. */
export function initOrchestrator(): void {
  if (initialised) return;
  initialised = true;

  registerBuiltInAgents();

  // Load knowledge graph for current session
  const store = useSessionStore.getState();
  if (store.session?.id) {
    loadGraph(store.session.id).catch(e =>
      console.warn('Failed to load knowledge graph:', e)
    );
  }

  // Listen for new transcript cards
  bus.on('card:created', handleCardCreated);

  // Listen for agent completions → trigger second-pass agents (Ideas)
  bus.on('agent:completed', handleAgentCompleted);
}

/** Tear down listeners (e.g. when returning to launcher). */
export function destroyOrchestrator(): void {
  bus.off('card:created', handleCardCreated);
  bus.off('agent:completed', handleAgentCompleted);
  if (debounceTimer) clearTimeout(debounceTimer);
  transcriptBuf = [];
  clearGraph();
  initialised = false;
}

// ---------------------------------------------------------------------------
// Internal handlers
// ---------------------------------------------------------------------------

function handleCardCreated({ card }: { card: Card }): void {
  // Compute and store embedding for every card (async, fire-and-forget)
  computeAndStoreEmbedding(card);

  // Only trigger agents on transcript cards
  if (card.source !== 'transcription') return;

  transcriptBuf.push(card.content);

  // Debounce: wait for 4s of silence before dispatching agents
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const batch = transcriptBuf.join('\n');
    transcriptBuf = [];
    if (batch.trim()) dispatchAgents(batch);
  }, DEBOUNCE_MS);
}

function handleAgentCompleted({ taskId, agentKey }: { taskId: string; agentKey: string; cardsCreated: number }): void {
  // Check if any second-pass agents are now ready
  const store = useSessionStore.getState();
  const recentTasks = store.agentTasks.filter(t => t.status === 'completed');
  const completedKeys = new Set(recentTasks.map(t => t.agentKey));

  // Find agents whose dependencies are now met
  const readyAgents = agentRegistry.list().filter(a => {
    if (a.dependsOn.length === 0) return false; // skip first-pass agents
    if (completedKeys.has(a.id)) return false;   // skip if already ran
    return a.dependsOn.every(dep => completedKeys.has(dep));
  });

  if (readyAgents.length === 0) return;

  const ctx = buildContext('');
  // For second-pass agents, provide the aggregated output as previousOutput
  const allCards = store.cards.filter(c => !c.isDeleted);
  const depColumns = store.columns.filter(c =>
    ['concepts', 'questions', 'claims', 'gaps', 'actions'].includes(c.type)
  );
  const depColIds = new Set(depColumns.map(c => c.id));
  const depCards = allCards.filter(c => depColIds.has(c.columnId));

  if (depCards.length === 0) return;

  // Build numbered list for ideas agent
  const numbered = depCards.map((c, i) => {
    const col = depColumns.find(dc => dc.id === c.columnId);
    return `${i + 1}. [${col?.type?.toUpperCase() || 'UNKNOWN'}] ${c.content}`;
  }).join('\n');

  const secondPassCtx: AgentContext = {
    ...ctx,
    previousOutput: numbered,
    relatedCards: depCards,
  };

  for (const agent of readyAgents) {
    if (agent.shouldActivate(secondPassCtx)) {
      workerPool.submit(agent, secondPassCtx, agent.priority);
    }
  }
}

function dispatchAgents(batchText: string): void {
  const ctx = buildContext(batchText);
  workerPool.submitAll(ctx);
}

function buildContext(recentTranscript: string): AgentContext {
  const store = useSessionStore.getState();
  return {
    sessionId: store.session?.id || '',
    mode: store.session?.mode || 'sidekick',
    recentTranscript,
    allCards: store.cards,
    relatedCards: [],
    columns: store.columns,
  };
}

// ---------------------------------------------------------------------------
// Embedding computation
// ---------------------------------------------------------------------------

async function computeAndStoreEmbedding(card: Card): Promise<void> {
  if (!card.content || card.content.length < 5) return;
  try {
    const vector = await embed(card.content);
    const blob = vectorToBlob(vector);
    if (window.electronAPI?.db?.storeEmbedding) {
      await window.electronAPI.db.storeEmbedding(card.id, blob);
    }
  } catch (e) {
    console.warn('Failed to compute embedding for card', card.id, e);
  }
}
