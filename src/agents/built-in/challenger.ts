import { BaseAgent, AgentContext } from '../base';

class ChallengerAgent extends BaseAgent {
  readonly id = 'challenger';
  readonly name = 'Challenger';
  readonly description = 'Play devil\'s advocate and challenge arguments and assumptions';
  readonly targetColumn = 'questions';
  readonly priority = 4;

  systemPrompt(_ctx: AgentContext): string {
    return 'Play devil\'s advocate. Challenge the strongest arguments and assumptions in the discussion. Ask tough questions. Output 1-2 items, each on a new line starting with •.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Challenge these arguments:\n\n${ctx.recentTranscript}`;
  }
}

export const challenger = new ChallengerAgent();
