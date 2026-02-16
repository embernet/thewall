// ============================================================================
// The Wall -- BaseAgent Abstract Class & Agent Context Types
// ============================================================================

import type { Card, AgentTask, SessionMode, Column } from '@/types';
import { bus } from '@/events/bus';
import { askClaude } from '@/utils/llm';

// ----------------------------------------------------------------------------
// Agent Context -- everything an agent receives when it runs
// ----------------------------------------------------------------------------

export interface AgentContext {
  sessionId: string;
  mode: SessionMode;
  /** The batched text that triggered this agent run. */
  recentTranscript: string;
  /** Specific card that triggered (for chaining). */
  triggerCard?: Card;
  /** Embedding-similar cards retrieved for context. */
  relatedCards: Card[];
  /** Full card array for cross-referencing. */
  allCards: Card[];
  columns: Column[];
  /** Output from upstream agent in a chain. */
  previousOutput?: string;

  // -- Added by orchestrator for context-aware prompts --

  /** Current meeting phase based on elapsed time. */
  meetingPhase?: 'early' | 'mid' | 'late';
  /** Recent card contents already in this agent's target column (last 10). */
  existingColumnCards?: string[];
  /** Rolling transcript window (~last 40 seconds) for background context. */
  rollingContext?: string;
  /** Topic tags assigned by the relevance gate for this batch. */
  relevanceTags?: Set<string>;
  /** True when a 2nd-pass agent is re-running (not its first invocation). */
  isRefresh?: boolean;
  /** Pre-LLM similarity hits: most similar existing cards to the current batch. */
  similarExistingCards?: { content: string; score: number }[];
}

// ----------------------------------------------------------------------------
// Agent Result -- what an agent produces
// ----------------------------------------------------------------------------

export interface AgentResult {
  cards: {
    content: string;
    columnType: string;
    sourceCardIds?: { cardId: string; similarity: number }[];
  }[];
  /** Raw LLM output before parsing. */
  raw: string;
}

// ----------------------------------------------------------------------------
// BaseAgent -- abstract class all agents extend
// ----------------------------------------------------------------------------

export abstract class BaseAgent {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  /** Column type key this agent writes into. */
  abstract readonly targetColumn: string;

  /** Priority 0-10, higher = more important. Default 5. */
  readonly priority: number = 5;

  /** Which agents must complete before this one runs (agent ids). */
  readonly dependsOn: string[] = [];

  /** Whether this agent should trigger on each new transcript batch. */
  readonly triggersOnTranscript: boolean = true;

  /** Maximum tokens for LLM response. Simple extractors use 300, synthesizers 800. */
  readonly maxTokens: number = 500;

  /** Cosine similarity threshold for deduplication (0-1). Higher = less aggressive. */
  readonly dedupThreshold: number = 0.85;

  /** Human-readable summary of what data this agent receives as input. */
  readonly inputSummary: string = 'Transcript fragment (~4 sec) + similar existing items from target column';

  /** Whether this agent's behavior is primarily prompt-governed or has hard-coded logic. */
  readonly behaviorType: 'prompt-only' | 'prompt-plus-code' = 'prompt-only';

  /** Agent category for UI grouping: 1st-pass fires on transcript, 2nd-pass on dependencies, utility is manual. */
  readonly agentType: '1st-pass' | '2nd-pass' | 'utility' = '1st-pass';

  // --------------------------------------------------------------------------
  // Abstract methods -- subclasses must implement
  // --------------------------------------------------------------------------

  /** Build the system prompt. */
  abstract systemPrompt(ctx: AgentContext): string;

  /** Build the user message. */
  abstract userPrompt(ctx: AgentContext): string;

  // --------------------------------------------------------------------------
  // Virtual methods -- subclasses may override
  // --------------------------------------------------------------------------

  /**
   * Whether this agent should activate given the current context.
   * Default: true if triggersOnTranscript and transcript has substance.
   */
  shouldActivate(ctx: AgentContext): boolean {
    return this.triggersOnTranscript && ctx.recentTranscript.length > 10;
  }

  /**
   * Parse LLM output into card contents.
   * Default: split by newlines, strip leading bullets/numbers.
   */
  parseOutput(raw: string, _ctx: AgentContext): { content: string; columnType: string }[] {
    return raw
      .split('\n')
      .map(l => l.replace(/^[•\-*\d.)\]]+\s*/, '').trim())
      .filter(l => l.length > 5)
      .map(content => ({ content, columnType: this.targetColumn }));
  }

  /**
   * Execute the full agent pipeline: build prompts -> call LLM -> parse.
   * Can be overridden for custom logic (tool use, multi-turn, etc.).
   */
  async execute(ctx: AgentContext): Promise<AgentResult> {
    const preamble = buildPreamble(ctx);
    const sys = preamble + this.systemPrompt(ctx);
    const usr = this.userPrompt(ctx);
    const raw = await askClaude(sys, usr, this.maxTokens);
    if (!raw) throw new Error('LLM returned no response — check API key and network.');
    const cards = this.parseOutput(raw, ctx);
    return { cards, raw };
  }
}

// ---------------------------------------------------------------------------
// Context preamble — injected before every agent's system prompt
// ---------------------------------------------------------------------------

function buildPreamble(ctx: AgentContext): string {
  const parts: string[] = [];

  // 1. Honest scope declaration
  parts.push(
    'You are analyzing a short transcript fragment (~4 seconds) from a live meeting. ' +
    'You do NOT have access to the full transcript or all previous outputs.\n',
  );

  // 2. Pre-LLM similarity hits (primary dedup mechanism)
  if (ctx.similarExistingCards && ctx.similarExistingCards.length > 0) {
    parts.push(
      'SIMILAR EXISTING ITEMS in this column (ranked by relevance to the current fragment):\n' +
      ctx.similarExistingCards
        .map((c, i) => `  ${i + 1}. [${Math.round(c.score * 100)}%] ${c.content}`)
        .join('\n') +
      '\n',
    );
    parts.push(
      'If the current fragment covers the same ground as any item above, output nothing. ' +
      'Only output genuinely new insights that are NOT already captured above.\n',
    );
  } else {
    // No similar items found — this is probably novel content
    parts.push(
      'No closely related items were found in this column yet. ' +
      'Output new insights if the fragment contains relevant content.\n',
    );
  }

  // 3. Meeting phase (keep existing behavior)
  if (ctx.meetingPhase) {
    const phaseHint: Record<string, string> = {
      early: 'Meeting phase: EARLY — capture foundational concepts and initial framing.',
      mid: 'Meeting phase: MID — focus on emerging themes, connections, and evolving arguments.',
      late: 'Meeting phase: LATE — prioritize decisions, action items, and final synthesis.',
    };
    parts.push(phaseHint[ctx.meetingPhase] + '\n');
  }

  // 4. Honest output instruction
  parts.push(
    'If nothing new and distinct is worth noting from this fragment, output NOTHING (empty response).\n\n',
  );

  return parts.join('\n');
}
