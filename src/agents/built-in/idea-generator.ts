import { BaseAgent, AgentContext } from '../base';

class IdeaGeneratorAgent extends BaseAgent {
  readonly id = 'ideas';
  readonly name = 'Idea Generator';
  readonly description = 'Generate actionable ideas from meeting analysis';
  readonly targetColumn = 'ideas';
  readonly priority = 4;
  readonly maxTokens = 800;
  readonly inputSummary = 'All cards from dependent columns (concepts, questions, claims, gaps, actions) as numbered list';
  readonly agentType: '2nd-pass' = '2nd-pass';

  readonly triggersOnTranscript = false;
  readonly dependsOn = ['concepts', 'questions', 'claims', 'gaps', 'actions'];

  shouldActivate(ctx: AgentContext): boolean {
    return !!ctx.previousOutput;
  }

  systemPrompt(_ctx: AgentContext): string {
    return 'You are a creative problem-solver and idea generator. Given analysis from a meeting, generate actionable ideas. For each idea, start the line with the NUMBER of the source item it addresses (from the numbered list below), then a pipe |, then the idea. Format: NUMBER|idea text. One idea per line. Be specific and actionable. Generate 2-5 ideas total.';
  }

  userPrompt(ctx: AgentContext): string {
    if (ctx.previousOutput) {
      return ctx.previousOutput;
    }

    // Fallback: gather cards from dependent columns as a numbered list
    const items = this.dependentCards(ctx)
      .map((c, i) => `${i + 1}. ${c.content}`);

    return items.length > 0
      ? `Generate ideas from this analysis:\n\n${items.join('\n')}`
      : 'No analysis available yet.';
  }

  parseOutput(
    raw: string,
    _ctx: AgentContext,
  ): { content: string; columnType: string; sourceCardIds?: { cardId: string; similarity: number }[] }[] {
    // Collect dependent-column cards for source ID mapping
    const sourceCards = this.dependentCards(_ctx);

    return raw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('|'))
      .map(line => {
        const pipeIdx = line.indexOf('|');
        const numStr = line.slice(0, pipeIdx).replace(/[^0-9]/g, '');
        const content = line.slice(pipeIdx + 1).trim();
        const num = parseInt(numStr, 10);

        const sourceCardIds: { cardId: string; similarity: number }[] = [];
        if (!isNaN(num) && num >= 1 && num <= sourceCards.length) {
          sourceCardIds.push({ cardId: sourceCards[num - 1].id, similarity: 1 });
        }

        return { content, columnType: this.targetColumn, sourceCardIds };
      })
      .filter(item => item.content.length > 5);
  }

  /** Get cards belonging to columns whose type matches a dependent agent id. */
  private dependentCards(ctx: AgentContext) {
    const depTypes = new Set(this.dependsOn);
    // Build a set of column IDs whose type matches a dependent agent
    const columnIds = new Set(
      ctx.columns.filter(col => depTypes.has(col.type)).map(col => col.id),
    );
    return ctx.allCards.filter(c => columnIds.has(c.columnId));
  }
}

export const ideaGenerator = new IdeaGeneratorAgent();
