import { BaseAgent, AgentContext } from '../base';

class CollaboratorAgent extends BaseAgent {
  readonly id = 'collaborator';
  readonly name = 'Collaborator';
  readonly description = 'Identify areas of agreement and synthesis opportunities';
  readonly targetColumn = 'concepts';
  readonly priority = 4;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify areas of agreement, synthesis opportunities, and ways to combine different viewpoints into stronger proposals. Output 1-2 items, each on a new line starting with •. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Find synthesis and agreement:\n\n${ctx.recentTranscript}`;
  }
}

export const collaborator = new CollaboratorAgent();
