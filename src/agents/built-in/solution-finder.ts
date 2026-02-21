import { ToolEnabledAgent } from '../tool-enabled-base';
import type { AgentContext } from '../base';

class SolutionFinderAgent extends ToolEnabledAgent {
  readonly id = 'solution-finder';
  readonly name = 'Solution Finder';
  readonly description = 'Propose practical solutions to problems and gaps, informed by external research';
  readonly targetColumn = 'ideas';
  readonly priority = 4;
  readonly maxTokens = 800;
  readonly inputSummary = 'All cards from Gaps column as numbered list';
  readonly agentType: '2nd-pass' = '2nd-pass';

  readonly triggersOnTranscript = false;
  readonly dependsOn = ['gaps'];

  readonly tools = [
    'session_search',
    'web_search',
  ];
  readonly maxToolCalls = 2;

  shouldActivate(ctx: AgentContext): boolean {
    if (ctx.previousOutput) return true;
    const depTypes = new Set(this.dependsOn);
    const columnIds = new Set(
      ctx.columns.filter(col => depTypes.has(col.type)).map(col => col.id),
    );
    return ctx.allCards.some(c => columnIds.has(c.columnId));
  }

  systemPrompt(_ctx: AgentContext): string {
    return 'Propose practical solutions to problems and gaps identified in the discussion. Use tool results to find existing solutions or best practices. Be specific and actionable. Output 1-3 items, each on a new line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    if (ctx.previousOutput) {
      return ctx.previousOutput;
    }

    const items = this.dependentCards(ctx)
      .map((c, i) => `${i + 1}. ${c.content}`);

    return items.length > 0
      ? `Propose solutions for these problems:\n\n${items.join('\n')}`
      : 'No problems or gaps available yet.';
  }

  private dependentCards(ctx: AgentContext) {
    const depTypes = new Set(this.dependsOn);
    const columnIds = new Set(
      ctx.columns.filter(col => depTypes.has(col.type)).map(col => col.id),
    );
    return ctx.allCards.filter(c => columnIds.has(c.columnId));
  }
}

export const solutionFinder = new SolutionFinderAgent();
