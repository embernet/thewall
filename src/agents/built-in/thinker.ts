import { BaseAgent, AgentContext } from '../base';

class ThinkerAgent extends BaseAgent {
  readonly id = 'thinker';
  readonly name = 'Thinker';
  readonly description = 'Provide deeper philosophical or strategic reflection';
  readonly targetColumn = 'observations';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Provide deeper philosophical or strategic reflection on the discussion topics. Connect to broader principles and frameworks. Output 1-2 items, each on a new line starting with •. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What deeper insights emerge?\n\n${ctx.recentTranscript}`;
  }
}

export const thinker = new ThinkerAgent();
