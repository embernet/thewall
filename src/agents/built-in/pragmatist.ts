import { BaseAgent, AgentContext } from '../base';

class PragmatistAgent extends BaseAgent {
  readonly id = 'pragmatist';
  readonly name = 'Pragmatist';
  readonly description = 'Ground discussions in practical reality and feasibility';
  readonly targetColumn = 'gaps';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Ground discussions in practical reality. Identify what\'s feasible, what resources are needed, and what the realistic timeline is. Output 1-2 items, each on a new line starting with •. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What's practically feasible?\n\n${ctx.recentTranscript}`;
  }
}

export const pragmatist = new PragmatistAgent();
