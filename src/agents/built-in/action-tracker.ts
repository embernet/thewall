import { BaseAgent, AgentContext } from '../base';

class ActionTrackerAgent extends BaseAgent {
  readonly id = 'actions';
  readonly name = 'Action Tracker';
  readonly description = 'Extract action items and decisions';
  readonly targetColumn = 'actions';
  readonly priority = 7;
  readonly maxTokens = 300;

  systemPrompt(_ctx: AgentContext): string {
    return 'Extract action items, decisions, and commitments. Include who is responsible and any deadlines mentioned. Output 0-2 items starting with \u2022. If no action items are present, output nothing. Check the SIMILAR EXISTING ITEMS above (if any) and skip anything already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Extract action items:\n\n${ctx.recentTranscript}`;
  }
}

export const actionTracker = new ActionTrackerAgent();
