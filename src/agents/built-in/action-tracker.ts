import { BaseAgent, AgentContext } from '../base';

class ActionTrackerAgent extends BaseAgent {
  readonly id = 'actions';
  readonly name = 'Action Tracker';
  readonly description = 'Extract action items and decisions';
  readonly targetColumn = 'actions';
  readonly priority = 5;

  systemPrompt(_ctx: AgentContext): string {
    return 'Extract action items and decisions. Output 0-2 items starting with \u2022. Include who is responsible. If none, output nothing.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Extract action items:\n\n${ctx.recentTranscript}`;
  }
}

export const actionTracker = new ActionTrackerAgent();
