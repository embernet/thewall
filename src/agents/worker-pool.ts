// ============================================================================
// The Wall -- Agent Worker Pool with Priority Queue & Circuit Breaker
// ============================================================================

import type { AgentTask, AgentTaskStatus, Card } from '@/types';
import { v4 as uuid } from 'uuid';
import { BaseAgent, AgentContext, AgentResult } from './base';
import { agentRegistry } from './registry';
import { AGENT_RELEVANCE } from './relevance-map';
import { deduplicateResults, findSimilarExisting } from './dedup-gate';
import { useSessionStore } from '@/store/session';
import { bus } from '@/events/bus';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

export interface WorkerPoolConfig {
  /** Maximum number of tasks running in parallel. */
  concurrency: number;
  /** Consecutive failures before an agent is circuit-broken. */
  maxRetries: number;
  /** Base delay (ms) for exponential back-off on retries. */
  retryDelayMs: number;
}

const DEFAULT_CONFIG: WorkerPoolConfig = {
  concurrency: 3,
  maxRetries: 3,
  retryDelayMs: 1000,
};

// ----------------------------------------------------------------------------
// Internal queue entry
// ----------------------------------------------------------------------------

interface QueuedTask {
  id: string;
  agent: BaseAgent;
  context: AgentContext;
  priority: number;
  createdAt: number;
  retryCount: number;
}

// ----------------------------------------------------------------------------
// WorkerPool
// ----------------------------------------------------------------------------

export class WorkerPool {
  /** Priority queue -- higher priority first, then FIFO by creation time. */
  private queue: QueuedTask[] = [];

  /** Currently executing tasks keyed by task id. */
  private running: Map<string, QueuedTask> = new Map();

  /** Consecutive failure count per agent id. */
  private circuitBreaker: Map<string, number> = new Map();

  /** Agent ids disabled by the circuit breaker. */
  private disabledAgents: Set<string> = new Set();

  /** When true, the queue won't dequeue new tasks (in-flight tasks finish). */
  private _paused = false;

  readonly config: WorkerPoolConfig;

  constructor(config?: Partial<WorkerPoolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Whether the pool is currently paused. */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Pause the queue: in-flight tasks finish, but no new tasks are dequeued.
   */
  setPaused(paused: boolean): void {
    this._paused = paused;
    if (!paused) this.processQueue();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Submit a single agent for execution.
   * Creates an AgentTask in the store and enqueues the work.
   * Returns the generated task id.
   */
  submit(agent: BaseAgent, context: AgentContext, priority?: number): string {
    const taskId = uuid();
    const effectivePriority = priority ?? agent.priority;

    // Persist task in store
    const store = useSessionStore.getState();
    const agentTask: AgentTask = {
      id: taskId,
      agentId: agent.id,
      agentName: agent.name,
      agentKey: agent.id,
      sessionId: context.sessionId,
      status: 'queued',
      priority: effectivePriority,
      cardsCreated: 0,
      createdAt: new Date().toISOString(),
    };
    store.addAgentTask(agentTask);

    // Enqueue
    const queued: QueuedTask = {
      id: taskId,
      agent,
      context,
      priority: effectivePriority,
      createdAt: Date.now(),
      retryCount: 0,
    };
    this.enqueue(queued);

    // Kick the queue
    this.processQueue();

    return taskId;
  }

  /**
   * Submit all eligible agents from the registry.
   * Eligible means the agent passes `shouldActivate` and isn't circuit-broken.
   * Returns an array of task ids.
   */
  submitAll(context: AgentContext): string[] {
    const agents = agentRegistry.listByPriority();
    const ids: string[] = [];

    // Congestion control: when queue is backed up, skip low-priority agents
    const congested = this.queue.length > 10;

    // Session-level agent filter: if a template specified enabled agents, only run those
    const sessionAgentSet = context.enabledAgentIds?.length
      ? new Set(context.enabledAgentIds)
      : null;

    for (const agent of agents) {
      if (this.isAgentDisabled(agent.id)) continue;
      // Skip agents not enabled for this session's template
      if (sessionAgentSet && !sessionAgentSet.has(agent.id)) continue;
      if (!agent.shouldActivate(context)) continue;

      // Congestion control: skip low-priority agents when queue is backed up
      if (congested && agent.priority < 4) continue;

      // Relevance gate: skip agents whose topics don't match the batch
      if (context.relevanceTags && AGENT_RELEVANCE[agent.id]) {
        const agentTopics = AGENT_RELEVANCE[agent.id];
        if (!agentTopics.some(t => context.relevanceTags!.has(t))) continue;
      }

      ids.push(this.submit(agent, context));
    }

    return ids;
  }

  /**
   * Update the concurrency limit at runtime (from sidebar slider).
   * Clamped to [1, 20].
   */
  setConcurrency(n: number): void {
    (this.config as { concurrency: number }).concurrency = Math.max(1, Math.min(20, n));
    this.processQueue();
  }

  /**
   * Pause a running task (move it back to the queue as paused).
   * If the task is not currently running this is a no-op.
   */
  pause(taskId: string): void {
    const task = this.running.get(taskId);
    if (!task) return;

    this.running.delete(taskId);

    const store = useSessionStore.getState();
    store.updateAgentTask(taskId, { status: 'paused' as AgentTaskStatus });
    store.setAgentBusy(task.agent.id, false);

    // Do not re-enqueue -- the task sits in a paused state.
    // Use retry() to re-queue it later.
  }

  /**
   * Cancel a task, removing it from the queue or running set and marking it
   * failed in the store.
   */
  cancel(taskId: string): void {
    // Try to remove from queue first
    const queueIdx = this.queue.findIndex((t) => t.id === taskId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
      const store = useSessionStore.getState();
      store.updateAgentTask(taskId, {
        status: 'failed' as AgentTaskStatus,
        error: 'Cancelled by user',
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // Try running set
    const task = this.running.get(taskId);
    if (task) {
      this.running.delete(taskId);
      const store = useSessionStore.getState();
      store.updateAgentTask(taskId, {
        status: 'failed' as AgentTaskStatus,
        error: 'Cancelled by user',
        completedAt: new Date().toISOString(),
      });
      store.setAgentBusy(task.agent.id, false);
      this.processQueue();
    }
  }

  /**
   * Re-queue a failed or paused task for another attempt.
   */
  retry(taskId: string): void {
    const store = useSessionStore.getState();
    const agentTask = store.agentTasks.find((t) => t.id === taskId);
    if (!agentTask) return;

    const agent = agentRegistry.get(agentTask.agentKey);
    if (!agent) return;

    // Build a minimal re-queue entry.  We rebuild context from current store
    // state since the original context is not persisted.
    const state = store;
    const context: AgentContext = {
      sessionId: agentTask.sessionId,
      mode: state.session?.mode ?? 'silent',
      recentTranscript: agentTask.inputText ?? '',
      relatedCards: [],
      allCards: state.cards,
      columns: state.columns,
    };

    const queued: QueuedTask = {
      id: taskId,
      agent,
      context,
      priority: agentTask.priority ?? agent.priority,
      createdAt: Date.now(),
      retryCount: 0,
    };

    store.updateAgentTask(taskId, { status: 'queued' as AgentTaskStatus });
    this.enqueue(queued);
    this.processQueue();
  }

  /**
   * Re-enable an agent that was disabled by the circuit breaker.
   */
  enableAgent(agentId: string): void {
    this.disabledAgents.delete(agentId);
    this.circuitBreaker.set(agentId, 0);
  }

  /** Check whether an agent is currently disabled by the circuit breaker. */
  isAgentDisabled(agentId: string): boolean {
    return this.disabledAgents.has(agentId);
  }

  /** Return the ids of all circuit-broken agents. */
  getDisabledAgents(): string[] {
    return Array.from(this.disabledAgents);
  }

  // --------------------------------------------------------------------------
  // Private -- queue management
  // --------------------------------------------------------------------------

  /**
   * Insert a task into the priority queue.
   * Higher priority comes first; ties broken by creation time (FIFO).
   */
  private enqueue(task: QueuedTask): void {
    this.queue.push(task);
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Dequeue and execute tasks up to the concurrency limit.
   * Respects the paused flag -- won't start new tasks while paused.
   */
  private processQueue(): void {
    if (this._paused) return;
    while (this.running.size < this.config.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running.set(task.id, task);
      // Fire-and-forget -- errors handled inside executeTask
      this.executeTask(task);
    }
  }

  // --------------------------------------------------------------------------
  // Private -- task execution
  // --------------------------------------------------------------------------

  /**
   * Execute a single queued task: run the agent, create cards on success,
   * handle failures with circuit-breaker logic.
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    const store = useSessionStore.getState();
    const startTime = Date.now();

    // 1. Mark running
    store.updateAgentTask(task.id, {
      status: 'running' as AgentTaskStatus,
      startedAt: new Date().toISOString(),
    });
    store.setAgentBusy(task.agent.id, true);

    try {
      // 2. Pre-LLM similarity search — find most relevant existing cards
      //    Only for 1st-pass (transcript-triggered) agents. 2nd-pass agents
      //    already have full context via previousOutput.
      if (task.agent.triggersOnTranscript && task.context.recentTranscript) {
        try {
          const similarCards = await findSimilarExisting(
            task.context.recentTranscript,
            task.agent.targetColumn,
            5,    // topK
            0.4,  // minScore — show topically related, not just near-dupes
          );
          task.context.similarExistingCards = similarCards;
        } catch (e) {
          console.warn('Pre-LLM similarity search failed, proceeding without:', e);
          // Graceful fallback: agent runs without similarity context
        }
      }

      // 3. Execute the agent
      const result = await task.agent.execute(task.context);

      // 4. Deduplication gate: filter out semantically similar cards
      const threshold = task.agent.dedupThreshold ?? 0.85;
      const dedupedCards = await deduplicateResults(
        result.cards,
        task.agent.targetColumn,
        threshold,
      );
      const dedupedResult: AgentResult = { ...result, cards: dedupedCards };

      // 5. Success path
      const cardsCreated = this.createCards(dedupedResult, task);
      const duration = Date.now() - startTime;

      store.updateAgentTask(task.id, {
        status: 'completed' as AgentTaskStatus,
        result: result.raw,
        resultPreview: result.raw.slice(0, 200),
        cardsCreated,
        duration,
        completedAt: new Date().toISOString(),
      });

      // Reset circuit breaker on success
      this.circuitBreaker.set(task.agent.id, 0);
    } catch (err: unknown) {
      // 4. Failure path
      const errorMessage = err instanceof Error ? err.message : String(err);
      const duration = Date.now() - startTime;

      // Increment circuit breaker
      const failures = (this.circuitBreaker.get(task.agent.id) ?? 0) + 1;
      this.circuitBreaker.set(task.agent.id, failures);

      if (failures >= this.config.maxRetries) {
        this.disabledAgents.add(task.agent.id);
      }

      store.updateAgentTask(task.id, {
        status: 'failed' as AgentTaskStatus,
        error: errorMessage,
        duration,
        completedAt: new Date().toISOString(),
      });
    } finally {
      // 5. Cleanup
      store.setAgentBusy(task.agent.id, false);
      this.running.delete(task.id);
      this.processQueue();
    }
  }

  // --------------------------------------------------------------------------
  // Private -- card creation from agent results
  // --------------------------------------------------------------------------

  /**
   * Create Card objects from agent result and add them to the store.
   * Returns the number of cards created.
   */
  private createCards(result: AgentResult, task: QueuedTask): number {
    const store = useSessionStore.getState();
    let count = 0;

    for (const cardDef of result.cards) {
      const col = store.columns.find((c) => c.type === cardDef.columnType);
      if (!col) continue;

      const existing = store.cards.filter((c) => c.columnId === col.id);
      const sortOrder =
        existing.length > 0
          ? String.fromCharCode(
              existing[existing.length - 1].sortOrder.charCodeAt(0) + 1,
            )
          : 'n';

      const card: Card = {
        id: uuid(),
        columnId: col.id,
        sessionId: task.context.sessionId,
        content: cardDef.content,
        source: 'agent',
        sourceAgentName: task.agent.name,
        sourceCardIds: cardDef.sourceCardIds
          ? cardDef.sourceCardIds.map((sc) => ({
              id: uuid(),
              label: sc.cardId,
              icon: 'link',
              color: '#6b7280',
            }))
          : [],
        aiTags: [],
        userTags: [],
        highlightedBy: 'none',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sortOrder,
      };

      store.addCard(card);
      count++;
    }

    return count;
  }
}

// ----------------------------------------------------------------------------
// Singleton
// ----------------------------------------------------------------------------

export const workerPool = new WorkerPool();
