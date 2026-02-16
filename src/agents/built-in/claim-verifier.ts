import { BaseAgent, AgentContext } from '../base';

class ClaimVerifierAgent extends BaseAgent {
  readonly id = 'claim-verifier';
  readonly name = 'Claim Verifier';
  readonly description = 'Fact-check and verify claims from the meeting';
  readonly targetColumn = 'claims';
  readonly priority = 5;
  readonly maxTokens = 800;
  readonly inputSummary = 'All cards from Claims column as numbered list';
  readonly agentType: '2nd-pass' = '2nd-pass';

  readonly triggersOnTranscript = false;
  readonly dependsOn = ['claims'];

  shouldActivate(ctx: AgentContext): boolean {
    if (ctx.previousOutput) return true;
    const claimColIds = new Set(
      ctx.columns.filter(col => col.type === 'claims').map(col => col.id),
    );
    return ctx.allCards.some(c => claimColIds.has(c.columnId));
  }

  systemPrompt(_ctx: AgentContext): string {
    return 'Fact-check and verify claims from the meeting. For each claim, assess its accuracy and provide supporting or contradicting evidence. Output 1-3 items, each on its own line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    if (ctx.previousOutput) {
      return ctx.previousOutput;
    }

    const items = this.dependentCards(ctx)
      .map((c, i) => `${i + 1}. ${c.content}`);

    return items.length > 0
      ? `Verify these claims:\n\n${items.join('\n')}`
      : 'No claims available yet.';
  }

  private dependentCards(ctx: AgentContext) {
    const depTypes = new Set(this.dependsOn);
    const columnIds = new Set(
      ctx.columns.filter(col => depTypes.has(col.type)).map(col => col.id),
    );
    return ctx.allCards.filter(c => columnIds.has(c.columnId));
  }
}

export const claimVerifier = new ClaimVerifierAgent();
