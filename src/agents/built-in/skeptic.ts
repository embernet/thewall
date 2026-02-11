import { BaseAgent, AgentContext } from '../base';

class SkepticAgent extends BaseAgent {
  readonly id = 'skeptic';
  readonly name = 'Skeptic';
  readonly description = 'Raise doubts and demand evidence for claims and proposals';
  readonly targetColumn = 'questions';
  readonly priority = 4;

  systemPrompt(_ctx: AgentContext): string {
    return 'Raise doubts and demand evidence for claims and proposals. Ask \'how do we know this?\' and \'what\'s the evidence?\'. Output 1-2 questions, each on a new line starting with •.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What requires evidence?\n\n${ctx.recentTranscript}`;
  }
}

export const skeptic = new SkepticAgent();
