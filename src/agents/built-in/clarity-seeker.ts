import { BaseAgent, AgentContext } from '../base';

class ClaritySeekerAgent extends BaseAgent {
  readonly id = 'clarity-seeker';
  readonly name = 'Clarity Seeker';
  readonly description = 'Identify ambiguous language and unclear references that need clarification';
  readonly targetColumn = 'questions';
  readonly priority = 5;
  readonly maxTokens = 300;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify ambiguous language, unclear references, and vague statements that need clarification. Output 1-2 questions, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What needs clarification?\n\n${ctx.recentTranscript}`;
  }
}

export const claritySeeker = new ClaritySeekerAgent();
