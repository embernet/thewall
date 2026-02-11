import { BaseAgent, AgentContext } from '../base';

class MethodologyAgent extends BaseAgent {
  readonly id = 'methodology';
  readonly name = 'Methodology Agent';
  readonly description = 'Shell agent activated by the methodology system at runtime';
  readonly targetColumn = 'notes';
  readonly priority = 5;
  readonly triggersOnTranscript = false;

  shouldActivate(_ctx: AgentContext): boolean {
    return false;
  }

  systemPrompt(_ctx: AgentContext): string {
    return 'Execute the current methodology step as instructed.';
  }

  userPrompt(ctx: AgentContext): string {
    if (ctx.previousOutput) {
      return ctx.previousOutput;
    }
    return ctx.recentTranscript;
  }
}

export const methodology = new MethodologyAgent();
