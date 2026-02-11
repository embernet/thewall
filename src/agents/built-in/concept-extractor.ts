import { BaseAgent, AgentContext } from '../base';

class ConceptExtractorAgent extends BaseAgent {
  readonly id = 'concepts';
  readonly name = 'Concept Extractor';
  readonly description = 'Extract key concepts, ideas, and themes from conversation';
  readonly targetColumn = 'concepts';
  readonly priority = 6;

  systemPrompt(_ctx: AgentContext): string {
    return 'Extract key concepts from meeting transcript. Output 1-3 items, each on its own line starting with \u2022. One sentence each. Only bullets.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Extract key concepts:\n\n${ctx.recentTranscript}`;
  }
}

export const conceptExtractor = new ConceptExtractorAgent();
