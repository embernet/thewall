import { BaseAgent, AgentContext } from '../base';

class ProblemFinderAgent extends BaseAgent {
  readonly id = 'problem-finder';
  readonly name = 'Problem Finder';
  readonly description = 'Identify potential problems, risks, and red flags in the discussion';
  readonly targetColumn = 'gaps';
  readonly priority = 5;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify potential problems, risks, and red flags in the discussion. Focus on what could go wrong. Output 1-2 items, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What problems or risks exist?\n\n${ctx.recentTranscript}`;
  }
}

export const problemFinder = new ProblemFinderAgent();
