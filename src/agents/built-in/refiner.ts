import { BaseAgent, AgentContext } from '../base';

class RefinerAgent extends BaseAgent {
  readonly id = 'refiner';
  readonly name = 'Refiner';
  readonly description = 'Improve and refine ideas from the discussion';
  readonly targetColumn = 'notes';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Improve and refine ideas from the discussion. Make vague ideas more specific, strengthen weak arguments, and add detail. Output 1-2 items, each on a new line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Refine and improve these ideas:\n\n${ctx.recentTranscript}`;
  }
}

export const refiner = new RefinerAgent();
