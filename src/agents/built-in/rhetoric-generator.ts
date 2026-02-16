import { BaseAgent, AgentContext } from '../base';

class RhetoricGeneratorAgent extends BaseAgent {
  readonly id = 'rhetoric-generator';
  readonly name = 'Rhetoric Generator';
  readonly description = 'Generate persuasive arguments and rhetorical frameworks';
  readonly targetColumn = 'observations';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Generate persuasive arguments and rhetorical frameworks for the key points discussed. Help strengthen the case. Output 1-2 items, each on a new line starting with •. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Generate persuasive arguments for:\n\n${ctx.recentTranscript}`;
  }
}

export const rhetoricGenerator = new RhetoricGeneratorAgent();
