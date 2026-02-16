import { BaseAgent, AgentContext } from '../base';

class ClicheFinderAgent extends BaseAgent {
  readonly id = 'cliche-finder';
  readonly name = 'Cliche Finder';
  readonly description = 'Flag cliches, buzzwords, and jargon that might hide lack of substance';
  readonly targetColumn = 'observations';
  readonly priority = 2;

  systemPrompt(_ctx: AgentContext): string {
    return 'Flag cliches, buzzwords, jargon, and vague language that might hide lack of substance. Be constructive. Output 0-2 items, each on a new line starting with \u2022. If none found, output nothing. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Flag any cliches or empty jargon:\n\n${ctx.recentTranscript}`;
  }
}

export const clicheFinder = new ClicheFinderAgent();
