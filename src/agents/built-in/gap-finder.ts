import { BaseAgent, AgentContext } from '../base';

class GapFinderAgent extends BaseAgent {
  readonly id = 'gaps';
  readonly name = 'Gap Finder';
  readonly description = 'Identify gaps, risks, problems, and unstated assumptions';
  readonly targetColumn = 'gaps';
  readonly priority = 7;
  readonly maxTokens = 300;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify gaps, risks, problems, unstated assumptions, and red flags. Focus on what is missing, what could go wrong, and what has not been addressed. Output 1-2 items, each on a new line starting with \u2022. One sentence each. Check the SIMILAR EXISTING ITEMS above (if any) and skip anything already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What gaps, risks, or problems exist?\n\n${ctx.recentTranscript}`;
  }
}

export const gapFinder = new GapFinderAgent();
