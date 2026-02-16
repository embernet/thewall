import { BaseAgent, AgentContext } from '../base';

class ClaimIdentifierAgent extends BaseAgent {
  readonly id = 'claims';
  readonly name = 'Claim Identifier';
  readonly description = 'Identify factual claims and assertions';
  readonly targetColumn = 'claims';
  readonly priority = 7;
  readonly maxTokens = 300;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify factual claims, assertions, and data points that could be verified. Output 1-2 items, each on a new line starting with \u2022. Only output if a verifiable claim is present. Check the SIMILAR EXISTING ITEMS above (if any) and skip anything already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Identify claims:\n\n${ctx.recentTranscript}`;
  }
}

export const claimIdentifier = new ClaimIdentifierAgent();
