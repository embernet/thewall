import { BaseAgent, AgentContext } from '../base';

class SupporterAgent extends BaseAgent {
  readonly id = 'supporter';
  readonly name = 'Supporter';
  readonly description = 'Identify the strongest arguments and most promising directions';
  readonly targetColumn = 'highlights';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify the strongest arguments, best ideas, and most promising directions in the discussion. Explain why they are strong. Output 1-2 items, each on a new line starting with •.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What are the strengths?\n\n${ctx.recentTranscript}`;
  }
}

export const supporter = new SupporterAgent();
