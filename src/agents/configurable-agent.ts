// ---------------------------------------------------------------------------
// ConfigurableAgent — wraps a built-in BaseAgent with user overrides
// ---------------------------------------------------------------------------

import { BaseAgent, AgentContext, AgentResult } from './base';
import type { AgentConfigOverride } from '@/types';
import { askClaude } from '@/utils/llm';

export class ConfigurableAgent extends BaseAgent {
  /** The original built-in agent instance. */
  readonly base: BaseAgent;
  private _overrides: AgentConfigOverride;

  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly targetColumn: string;
  readonly priority: number;
  readonly dependsOn: string[];
  readonly triggersOnTranscript: boolean;
  readonly maxTokens: number;
  readonly dedupThreshold: number;
  readonly inputSummary: string;
  readonly behaviorType: 'prompt-only' | 'prompt-plus-code';
  readonly agentType: '1st-pass' | '2nd-pass' | 'utility';

  /** Whether the user has disabled this agent. */
  readonly userDisabled: boolean;

  constructor(base: BaseAgent, overrides: AgentConfigOverride) {
    super();
    this.base = base;
    this._overrides = overrides;

    this.id = base.id;
    this.name = base.name;
    this.description = base.description;
    this.targetColumn = overrides.targetColumn ?? base.targetColumn;
    this.priority = overrides.priority ?? base.priority;
    this.dependsOn = base.dependsOn;
    this.triggersOnTranscript = overrides.triggerOnTranscript ?? base.triggersOnTranscript;
    this.maxTokens = overrides.maxTokens ?? base.maxTokens;
    this.dedupThreshold = overrides.dedupThreshold ?? base.dedupThreshold;
    this.inputSummary = base.inputSummary;
    this.behaviorType = base.behaviorType;
    this.agentType = base.agentType;
    this.userDisabled = !overrides.enabled;
  }

  systemPrompt(ctx: AgentContext): string {
    return this._overrides.systemPrompt ?? this.base.systemPrompt(ctx);
  }

  userPrompt(ctx: AgentContext): string {
    return this._overrides.userPrompt ?? this.base.userPrompt(ctx);
  }

  shouldActivate(ctx: AgentContext): boolean {
    if (this.userDisabled) return false;
    return this.base.shouldActivate(ctx);
  }

  parseOutput(raw: string, ctx: AgentContext) {
    const parsed = this.base.parseOutput(raw, ctx);
    const col = this._overrides.targetColumn ?? this.base.targetColumn;
    return parsed.map(p => ({ ...p, columnType: col }));
  }

  /**
   * Override execute to inject our prompt overrides with maxTokens.
   * Since no built-in agents override execute(), we safely re-implement
   * the default pipeline with our overridden system/user prompts.
   * NOTE: We call the base class execute() which handles preamble injection.
   */
  async execute(ctx: AgentContext): Promise<AgentResult> {
    // Delegate to the base class execute() which handles preamble + maxTokens
    // but we need our overridden systemPrompt/userPrompt to be called.
    // Since `this.systemPrompt()` and `this.userPrompt()` are already overridden,
    // and BaseAgent.execute() calls `this.systemPrompt()` / `this.userPrompt()`,
    // we can just call super.execute() — BUT BaseAgent.execute calls `this.` methods
    // on the current instance, which means our overrides are used. However, since
    // ConfigurableAgent IS-A BaseAgent, super.execute() will call this.systemPrompt()
    // which is our override. So we can just delegate:
    return super.execute(ctx);
  }

  // -- Expose defaults for the UI "Reset to default" buttons --

  getDefaultSystemPrompt(ctx: AgentContext): string {
    return this.base.systemPrompt(ctx);
  }

  getDefaultUserPrompt(ctx: AgentContext): string {
    return this.base.userPrompt(ctx);
  }
}
