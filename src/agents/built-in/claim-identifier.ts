import { BaseAgent, AgentContext } from '../base';

class ClaimIdentifierAgent extends BaseAgent {
  readonly id = 'claims';
  readonly name = 'Claim Identifier';
  readonly description = 'Identify factual claims and assertions';
  readonly targetColumn = 'claims';
  readonly priority = 6;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify factual claims and assertions. Output 1-2 items, each on a new line starting with \u2022. Only bullets.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Identify claims:\n\n${ctx.recentTranscript}`;
  }
}

export const claimIdentifier = new ClaimIdentifierAgent();
