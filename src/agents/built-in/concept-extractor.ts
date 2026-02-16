import { BaseAgent, AgentContext } from '../base';

class ConceptExtractorAgent extends BaseAgent {
  readonly id = 'concepts';
  readonly name = 'Concept Extractor';
  readonly description = 'Extract key concepts, ideas, and themes from conversation';
  readonly targetColumn = 'concepts';
  readonly priority = 7;
  readonly maxTokens = 300;

  systemPrompt(_ctx: AgentContext): string {
    return 'Extract key concepts, ideas, and themes mentioned. Output 1-2 items, each on its own line starting with \u2022. One sentence each. Check the SIMILAR EXISTING ITEMS above (if any) and skip anything already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Extract key concepts:\n\n${ctx.recentTranscript}`;
  }
}

export const conceptExtractor = new ConceptExtractorAgent();
