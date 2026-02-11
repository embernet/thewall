import { BaseAgent, AgentContext } from '../base';

class GapFinderAgent extends BaseAgent {
  readonly id = 'gaps';
  readonly name = 'Gap Finder';
  readonly description = 'Identify gaps, risks, and unstated assumptions';
  readonly targetColumn = 'gaps';
  readonly priority = 6;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify gaps, risks, unstated assumptions. Output 1-2 items, each on a new line starting with \u2022. Only bullets.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What gaps or risks exist?\n\n${ctx.recentTranscript}`;
  }
}

export const gapFinder = new GapFinderAgent();
