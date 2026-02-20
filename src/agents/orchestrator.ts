import { bus } from '@/events/bus';
import { useSessionStore } from '@/store/session';
import { workerPool } from './worker-pool';
import { agentRegistry } from './registry';
import { loadAgentConfigs, applyAgentConfigs } from './config-loader';
import { embed, vectorToBlob } from '@/utils/embedding-service';
import { cacheEmbedding, clearEmbeddingCache as clearDedupCache } from './dedup-gate';
import { loadGraph, clearGraph } from '@/graph/graph-service';
import { registerBuiltInTools } from '@/tools';
import { registerBuiltInMethodologies } from '@/methodologies';
import { registerBuiltInPersonas } from '@/personas';
import { assessBatch } from './relevance-gate';
import type { AgentContext } from './base';
import type { Card, ApiKeyStatus } from '@/types';

// ---------------------------------------------------------------------------
// Orchestrator
//
// Listens for transcript card events and dispatches agents via the worker pool.
// Replaces the inline runAgents/scheduleAgents logic from App.tsx.
// ---------------------------------------------------------------------------

/** Debounce delay per mode. Silent uses longer delay; active is fastest. */
const DEBOUNCE_MS_BY_MODE = {
  silent:   0,      // silent mode: agents don't auto-dispatch (0 = skip)
  active:   3000,   // active mode: fast dispatch
  sidekick: 6000,   // sidekick mode: slower, less intrusive
} as const;
const DEBOUNCE_MS_DEFAULT = 4000;

const ROLLING_WINDOW_SIZE = 10; // keep last ~10 batches (~40s of transcript)

let transcriptBuf: string[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let initialised = false;

/** Rolling transcript window for background context. */
const rollingTranscriptWindow: string[] = [];

/** When the session started (for meeting phase calculation). */
let sessionStartTime = Date.now();

// ---------------------------------------------------------------------------
// 2nd-pass refresh scheduler state
// ---------------------------------------------------------------------------

const SECOND_PASS_MIN_INTERVAL = 60_000; // 60s between re-runs
const SECOND_PASS_MIN_NEW_CARDS = 5;     // need 5+ new dep cards since last run
const SECOND_PASS_CHECK_INTERVAL = 30_000; // check every 30s

/** Track per-agent 2nd-pass run history. */
const secondPassHistory = new Map<string, { lastRunAt: number; cardCountAtRun: number }>();

/** Periodic timer for 2nd-pass checks. */
let secondPassTimer: ReturnType<typeof setInterval> | null = null;

/** Initialise the orchestrator: register built-in agents, wire bus listeners. */
export async function initOrchestrator(): Promise<void> {
  if (initialised) return;
  initialised = true;

  // Reset session timing
  sessionStartTime = Date.now();
  rollingTranscriptWindow.length = 0;

  // Load agent configs from DB (wraps built-in agents with user overrides)
  await loadAgentConfigs();
  registerBuiltInTools();
  registerBuiltInMethodologies();
  registerBuiltInPersonas();

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

  // Listen for API status changes → auto-pause/resume the queue
  bus.on('api:statusChanged', handleApiStatusChanged);

  // Listen for agent config changes → hot-reload
  bus.on('agentConfig:changed', handleAgentConfigChanged);

  // Listen for mode changes → flush buffer on switch to silent, adjust debounce
  bus.on('session:modeChanged', handleModeChanged);

  // Start periodic 2nd-pass refresh checker
  secondPassTimer = setInterval(checkSecondPassAgents, SECOND_PASS_CHECK_INTERVAL);
}

/** Tear down listeners (e.g. when returning to launcher). */
export function destroyOrchestrator(): void {
  bus.off('card:created', handleCardCreated);
  bus.off('agent:completed', handleAgentCompleted);
  bus.off('api:statusChanged', handleApiStatusChanged);
  bus.off('agentConfig:changed', handleAgentConfigChanged);
  bus.off('session:modeChanged', handleModeChanged);
  if (debounceTimer) clearTimeout(debounceTimer);
  if (secondPassTimer) clearInterval(secondPassTimer);
  secondPassTimer = null;
  secondPassHistory.clear();
  transcriptBuf = [];
  rollingTranscriptWindow.length = 0;
  clearDedupCache();
  clearGraph();
  initialised = false;
}

// ---------------------------------------------------------------------------
// Internal handlers
// ---------------------------------------------------------------------------

function handleAgentConfigChanged(): void {
  applyAgentConfigs().catch(e =>
    console.warn('Failed to reload agent configs:', e)
  );
}

function handleModeChanged({ mode }: { mode: string }): void {
  if (mode === 'silent') {
    // When switching to silent, clear any pending transcript dispatch
    if (debounceTimer) clearTimeout(debounceTimer);
    transcriptBuf = [];
  }
  // When switching away from silent, the next handleCardCreated will
  // start dispatching normally with the new mode's debounce timing.
}

/**
 * Auto-pause / auto-resume the agent queue based on API readiness.
 * Only overrides when the current pause reason is API-related (or null).
 * If the user manually paused, API changes don't touch it.
 */
function handleApiStatusChanged({ status }: { status: ApiKeyStatus }): void {
  const store = useSessionStore.getState();
  const currentReason = store.queuePauseReason;

  if (status === 'valid') {
    // Resume only if we were the ones who paused it
    if (currentReason === 'api_not_ready' || currentReason === 'api_invalid') {
      store.setQueuePaused(null);
      workerPool.setPaused(false);
    }
  } else if (status === 'invalid') {
    if (currentReason !== 'user') {
      store.setQueuePaused('api_invalid');
      workerPool.setPaused(true);
    }
  } else {
    // 'unchecked' | 'checking' — API not ready yet
    if (currentReason !== 'user') {
      store.setQueuePaused('api_not_ready');
      workerPool.setPaused(true);
    }
  }
}

function handleCardCreated({ card }: { card: Card }): void {
  // Compute and store embedding for every card (async, fire-and-forget)
  computeAndStoreEmbedding(card);

  // Only trigger agents on transcript cards
  if (card.source !== 'transcription') return;

  // Only dispatch agents for clean (post-processed) transcript cards.
  // Raw cards are processed by the transcript pipeline first, which
  // creates clean cards with proper sentence boundaries and no filler.
  if (!card.userTags.includes('transcript:clean')) return;

  // In silent mode, agents only run when explicitly triggered (e.g. via Chat)
  const mode = useSessionStore.getState().session?.mode ?? 'sidekick';
  if (mode === 'silent') return;

  transcriptBuf.push(card.content);

  // Debounce delay varies by mode: active is faster, sidekick is slower
  const debounceMs = DEBOUNCE_MS_BY_MODE[mode] || DEBOUNCE_MS_DEFAULT;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const batch = transcriptBuf.join('\n');
    transcriptBuf = [];
    if (batch.trim()) dispatchAgents(batch);
  }, debounceMs);
}

function handleAgentCompleted(_event: { taskId: string; agentKey: string; cardsCreated: number }): void {
  // Trigger a 2nd-pass check on every agent completion
  checkSecondPassAgents();
}

// ---------------------------------------------------------------------------
// 2nd-pass refresh scheduler
//
// Replaces one-shot handleAgentCompleted with periodic + event-driven checks.
// A 2nd-pass agent re-runs when:
//   1. All its dependsOn agents have completed at least once
//   2. At least SECOND_PASS_MIN_INTERVAL since its last run
//   3. At least SECOND_PASS_MIN_NEW_CARDS new dependency cards since last run
// ---------------------------------------------------------------------------

function checkSecondPassAgents(): void {
  const store = useSessionStore.getState();

  // In silent mode, no automatic agent runs
  if (store.session?.mode === 'silent') return;

  const completedTasks = store.agentTasks.filter(t => t.status === 'completed');
  const completedKeys = new Set(completedTasks.map(t => t.agentKey));

  const now = Date.now();
  const allCards = store.cards.filter(c => !c.isDeleted);

  // Gather dependency column cards
  const depColumnTypes = new Set(['concepts', 'questions', 'claims', 'gaps', 'actions', 'observations']);
  const depColumns = store.columns.filter(c => depColumnTypes.has(c.type));
  const depColIds = new Set(depColumns.map(c => c.id));
  const depCards = allCards.filter(c => depColIds.has(c.columnId));
  const totalDepCards = depCards.length;

  if (totalDepCards === 0) return;

  // Find eligible 2nd-pass agents, respecting session-level agent filter
  const sessionAgentIds = store.session?.enabledAgentIds;
  const sessionAgentSet = sessionAgentIds?.length ? new Set(sessionAgentIds) : null;
  const secondPassAgents = agentRegistry.list().filter(a =>
    a.dependsOn.length > 0 && (!sessionAgentSet || sessionAgentSet.has(a.id))
  );

  for (const agent of secondPassAgents) {
    // All dependencies must have completed at least once
    if (!agent.dependsOn.every(dep => completedKeys.has(dep))) continue;

    const history = secondPassHistory.get(agent.id);

    if (history) {
      // Skip if last run was too recent
      if (now - history.lastRunAt < SECOND_PASS_MIN_INTERVAL) continue;
      // Skip if not enough new cards since last run
      if (totalDepCards - history.cardCountAtRun < SECOND_PASS_MIN_NEW_CARDS) continue;
    }

    // Build context with numbered list of all dep column cards
    const numbered = depCards.map((c, i) => {
      const col = depColumns.find(dc => dc.id === c.columnId);
      return `${i + 1}. [${col?.type?.toUpperCase() || 'UNKNOWN'}] ${c.content}`;
    }).join('\n');

    const ctx = buildContext('');
    const secondPassCtx: AgentContext = {
      ...ctx,
      previousOutput: numbered,
      relatedCards: depCards,
      isRefresh: !!history, // true if agent has run before
    };

    if (agent.shouldActivate(secondPassCtx)) {
      workerPool.submit(agent, secondPassCtx, agent.priority);
      secondPassHistory.set(agent.id, { lastRunAt: now, cardCountAtRun: totalDepCards });
    }
  }
}

function dispatchAgents(batchText: string): void {
  // Relevance gate: skip filler and tag topics (zero LLM calls)
  const assessment = assessBatch(batchText);
  if (!assessment.isSubstantive) return; // skip filler entirely

  // Update rolling transcript window
  rollingTranscriptWindow.push(batchText);
  if (rollingTranscriptWindow.length > ROLLING_WINDOW_SIZE) {
    rollingTranscriptWindow.shift();
  }

  const ctx = buildContext(batchText);
  ctx.relevanceTags = assessment.tags;
  workerPool.submitAll(ctx);
}

function buildContext(recentTranscript: string): AgentContext {
  const store = useSessionStore.getState();

  // Meeting phase based on elapsed time since session start
  const elapsedMinutes = (Date.now() - sessionStartTime) / 60_000;
  const meetingPhase: 'early' | 'mid' | 'late' =
    elapsedMinutes < 5 ? 'early' : elapsedMinutes < 20 ? 'mid' : 'late';

  // Rolling context: all previous batches in the window (excluding the current one)
  const rollingContext = rollingTranscriptWindow.length > 1
    ? rollingTranscriptWindow.slice(0, -1).join('\n')
    : undefined;

  return {
    sessionId: store.session?.id || '',
    mode: store.session?.mode || 'sidekick',
    recentTranscript,
    allCards: store.cards,
    relatedCards: [],
    columns: store.columns,
    meetingPhase,
    rollingContext,
    enabledAgentIds: store.session?.enabledAgentIds ?? null,
    sessionSystemPrompt: store.session?.systemPrompt ?? '',
  };
}

// ---------------------------------------------------------------------------
// Embedding computation
// ---------------------------------------------------------------------------

async function computeAndStoreEmbedding(card: Card): Promise<void> {
  if (!card.content || card.content.length < 5) return;
  try {
    const vector = await embed(card.content);

    // Cache in dedup gate for duplicate detection
    cacheEmbedding(card.id, vector);

    // Store in SQLite for persistence
    const blob = vectorToBlob(vector);
    if (window.electronAPI?.db?.storeEmbedding) {
      await window.electronAPI.db.storeEmbedding(card.id, blob);
    }
  } catch (e) {
    console.warn('Failed to compute embedding for card', card.id, e);
  }
}
