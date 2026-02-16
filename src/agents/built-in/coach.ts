import { BaseAgent, AgentContext } from '../base';

class CoachAgent extends BaseAgent {
  readonly id = 'coach';
  readonly name = 'Coach';
  readonly description = 'Provide coaching guidance and Socratic questions';
  readonly targetColumn = 'observations';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Provide coaching guidance and Socratic questions to help deepen understanding. Encourage reflection and growth. Output 1-2 items, each on a new line starting with •. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What coaching insights apply?\n\n${ctx.recentTranscript}`;
  }
}

export const coach = new CoachAgent();
