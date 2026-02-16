import { BaseAgent, AgentContext } from '../base';

class TensionFinderAgent extends BaseAgent {
  readonly id = 'tension-finder';
  readonly name = 'Tension Finder';
  readonly description = 'Identify conflicting statements and contradictions in the discussion';
  readonly targetColumn = 'gaps';
  readonly priority = 4;
  readonly maxTokens = 500;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify conflicting statements, contradictions, and tensions between different points made in the discussion. Output 1-2 items, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What contradictions or tensions exist?\n\n${ctx.recentTranscript}`;
  }
}

export const tensionFinder = new TensionFinderAgent();
