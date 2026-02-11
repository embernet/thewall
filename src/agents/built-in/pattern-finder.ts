import { BaseAgent, AgentContext } from '../base';

class PatternFinderAgent extends BaseAgent {
  readonly id = 'pattern-finder';
  readonly name = 'Pattern Finder';
  readonly description = 'Identify recurring themes, patterns, and connections across the discussion';
  readonly targetColumn = 'concepts';
  readonly priority = 4;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify recurring themes, patterns, and connections across the discussion. Look for repeated ideas or underlying structures. Output 1-2 items, each on a new line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What patterns or recurring themes exist?\n\n${ctx.recentTranscript}`;
  }
}

export const patternFinder = new PatternFinderAgent();
