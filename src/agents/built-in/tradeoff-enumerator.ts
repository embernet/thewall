import { BaseAgent, AgentContext } from '../base';

class TradeoffEnumeratorAgent extends BaseAgent {
  readonly id = 'tradeoff-enumerator';
  readonly name = 'Trade-off Enumerator';
  readonly description = 'Identify trade-offs between different options and approaches';
  readonly targetColumn = 'observations';
  readonly priority = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify trade-offs between different options and approaches discussed. Explain what is gained and lost with each choice. Output 1-2 items, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What trade-offs exist?\n\n${ctx.recentTranscript}`;
  }
}

export const tradeoffEnumerator = new TradeoffEnumeratorAgent();
