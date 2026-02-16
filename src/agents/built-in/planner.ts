import { BaseAgent, AgentContext } from '../base';

class PlannerAgent extends BaseAgent {
  readonly id = 'planner';
  readonly name = 'Planner';
  readonly description = 'Create structured plans from action items and decisions';
  readonly targetColumn = 'actions';
  readonly priority = 4;
  readonly maxTokens = 800;
  readonly inputSummary = 'All cards from Actions column as numbered list';
  readonly agentType: '2nd-pass' = '2nd-pass';

  readonly triggersOnTranscript = false;
  readonly dependsOn = ['actions'];

  shouldActivate(ctx: AgentContext): boolean {
    if (ctx.previousOutput) return true;
    const actionColIds = new Set(
      ctx.columns.filter(col => col.type === 'actions').map(col => col.id),
    );
    return ctx.allCards.some(c => actionColIds.has(c.columnId));
  }

  systemPrompt(_ctx: AgentContext): string {
    return 'Create structured plans from action items and decisions. Break down high-level actions into concrete steps with owners and timelines. Output 1-3 items, each on a new line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    if (ctx.previousOutput) {
      return ctx.previousOutput;
    }

    const items = this.dependentCards(ctx)
      .map((c, i) => `${i + 1}. ${c.content}`);

    return items.length > 0
      ? `Create plans for these action items:\n\n${items.join('\n')}`
      : 'No action items available yet.';
  }

  private dependentCards(ctx: AgentContext) {
    const depTypes = new Set(this.dependsOn);
    const columnIds = new Set(
      ctx.columns.filter(col => depTypes.has(col.type)).map(col => col.id),
    );
    return ctx.allCards.filter(c => columnIds.has(c.columnId));
  }
}

export const planner = new PlannerAgent();
