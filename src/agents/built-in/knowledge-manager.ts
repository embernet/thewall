import { BaseAgent, AgentContext } from '../base';

class KnowledgeManagerAgent extends BaseAgent {
  readonly id = 'knowledge-manager';
  readonly name = 'Knowledge Manager';
  readonly description = 'Extract entities, relationships, and connections for the knowledge graph';
  readonly targetColumn = 'notes';
  readonly priority = 6;

  systemPrompt(_ctx: AgentContext): string {
    return 'Extract entities, relationships, and connections that should be tracked in the knowledge graph. Format: ENTITY_TYPE: entity_name \u2014 relationship \u2014 related_entity. Output 1-3 items, each on a new line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Extract entities and relationships:\n\n${ctx.recentTranscript}`;
  }
}

export const knowledgeManager = new KnowledgeManagerAgent();
