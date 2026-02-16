import { BaseAgent, AgentContext } from '../base';

class AlternativeFinderAgent extends BaseAgent {
  readonly id = 'alternative-finder';
  readonly name = 'Alternative Finder';
  readonly description = 'Generate alternative approaches, methods, or solutions';
  readonly targetColumn = 'alternatives';
  readonly priority = 5;
  readonly maxTokens = 500;

  systemPrompt(_ctx: AgentContext): string {
    return 'Generate alternative approaches, methods, or solutions to what is being discussed. Think outside the box. Output 1-2 items, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What alternative approaches exist?\n\n${ctx.recentTranscript}`;
  }
}

export const alternativeFinder = new AlternativeFinderAgent();
