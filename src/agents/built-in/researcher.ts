import { BaseAgent, AgentContext } from '../base';

class ResearcherAgent extends BaseAgent {
  readonly id = 'researcher';
  readonly name = 'Researcher';
  readonly description = 'Identify topics needing deeper research or fact-checking';
  readonly targetColumn = 'deep_research';
  readonly priority = 5;

  systemPrompt(_ctx: AgentContext): string {
    return 'Identify topics that need deeper research or fact-checking. Suggest specific research questions and potential sources. Output 1-3 items, each on a new line starting with •.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What needs deeper research?\n\n${ctx.recentTranscript}`;
  }
}

export const researcher = new ResearcherAgent();
