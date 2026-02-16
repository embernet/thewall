// ---------------------------------------------------------------------------
// CustomRuntimeAgent — agent created entirely from user config (no code class)
// ---------------------------------------------------------------------------

import { BaseAgent, AgentContext } from './base';
import type { CustomAgentConfig } from '@/types';

export class CustomRuntimeAgent extends BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly targetColumn: string;
  readonly priority: number;
  readonly dependsOn: string[];
  readonly triggersOnTranscript: boolean;

  private _systemPrompt: string;
  private _userPrompt: string;

  constructor(config: CustomAgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.targetColumn = config.targetColumn;
    this.priority = config.priority;
    this.dependsOn = config.dependsOn || [];
    this.triggersOnTranscript = config.triggerOnTranscript;
    this._systemPrompt = config.systemPrompt;
    this._userPrompt = config.userPrompt;
  }

  systemPrompt(_ctx: AgentContext): string {
    return this._systemPrompt;
  }

  userPrompt(ctx: AgentContext): string {
    // Support template variables in user prompt
    return this._userPrompt
      .replace(/\{\{transcript\}\}/g, ctx.recentTranscript)
      .replace(/\{\{cards\}\}/g, ctx.allCards.map(c => c.content).join('\n'))
      .replace(/\{\{previousOutput\}\}/g, ctx.previousOutput || '');
  }

  shouldActivate(ctx: AgentContext): boolean {
    if (this.dependsOn.length > 0) {
      // Second-pass agent — activation handled by orchestrator dependency check
      return true;
    }
    return this.triggersOnTranscript && ctx.recentTranscript.length > 10;
  }
}
