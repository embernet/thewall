import { BaseAgent, AgentContext } from '../base';

class QuestionerAgent extends BaseAgent {
  readonly id = 'questions';
  readonly name = 'Questioner';
  readonly description = 'Generate probing questions from meeting discussion';
  readonly targetColumn = 'questions';
  readonly priority = 6;

  systemPrompt(_ctx: AgentContext): string {
    return 'Generate probing questions from meeting discussion. Output 1-2 questions, each on a new line starting with \u2022. Only bullets.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What questions arise?\n\n${ctx.recentTranscript}`;
  }
}

export const questioner = new QuestionerAgent();
