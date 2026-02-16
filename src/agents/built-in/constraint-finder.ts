import { BaseAgent, AgentContext } from '../base';

class ConstraintFinderAgent extends BaseAgent {
  readonly id = 'constraint-finder';
  readonly name = 'Constraint Finder';
  readonly description = 'Identify constraints, limitations, and boundaries discussed or implied';
  readonly targetColumn = 'observations';
  readonly priority = 4;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify constraints, limitations, and boundaries discussed or implied. Include budget, time, technical, and resource constraints. Output 1-2 items, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What constraints or limitations exist?\n\n${ctx.recentTranscript}`;
  }
}

export const constraintFinder = new ConstraintFinderAgent();
