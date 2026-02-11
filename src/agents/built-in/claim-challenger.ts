import { BaseAgent, AgentContext } from '../base';

class ClaimChallengerAgent extends BaseAgent {
  readonly id = 'claim-challenger';
  readonly name = 'Claim Challenger';
  readonly description = 'Generate counter-arguments and alternative perspectives for claims';
  readonly targetColumn = 'claims';
  readonly priority = 4;

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
    return 'Generate counter-arguments and alternative perspectives for claims. Challenge assumptions. Output 1-2 items, each on its own line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    if (ctx.previousOutput) {
      return ctx.previousOutput;
    }

    const items = this.dependentCards(ctx)
      .map((c, i) => `${i + 1}. ${c.content}`);

    return items.length > 0
      ? `Challenge these claims:\n\n${items.join('\n')}`
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

export const claimChallenger = new ClaimChallengerAgent();
