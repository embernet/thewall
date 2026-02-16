import { BaseAgent, AgentContext } from '../base';

class ChallengerAgent extends BaseAgent {
  readonly id = 'challenger';
  readonly name = 'Challenger';
  readonly description = 'Challenge arguments, assumptions, and unsubstantiated claims';
  readonly targetColumn = 'questions';
  readonly priority = 4;
  readonly maxTokens = 500;

  systemPrompt(_ctx: AgentContext): string {
    return 'Challenge arguments, assumptions, and unsubstantiated claims. Ask tough questions: "What evidence supports this?", "What if the opposite is true?". Output 1 item starting with \u2022. Only output if there is a challengeable claim or assumption. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Challenge these arguments:\n\n${ctx.recentTranscript}`;
  }
}

export const challenger = new ChallengerAgent();
