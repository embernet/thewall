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
    const sys = this.systemPrompt(ctx);
    const usr = this.userPrompt(ctx);
    const raw = await askClaude(sys, usr);
    if (!raw) throw new Error('LLM returned no response — check API key and network.');
    const cards = this.parseOutput(raw, ctx);
    return { cards, raw };
  }
}
