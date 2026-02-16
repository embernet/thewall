import { BaseAgent, AgentContext } from '../base';

class VisionaryAgent extends BaseAgent {
  readonly id = 'visionary';
  readonly name = 'Visionary';
  readonly description = 'Explore future implications and transformative possibilities';
  readonly targetColumn = 'ideas';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Explore future implications, long-term consequences, and transformative possibilities of what\'s being discussed. Think big and long-term. Output 1-2 items, each on a new line starting with •. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What are the future implications?\n\n${ctx.recentTranscript}`;
  }
}

export const visionary = new VisionaryAgent();
