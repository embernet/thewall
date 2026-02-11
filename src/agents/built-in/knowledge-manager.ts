import { BaseAgent, AgentContext, AgentResult } from '../base';
import { addEntitiesAndRelations } from '@/graph/graph-service';
import type { ExtractedEntity, ExtractedRelation } from '@/graph/graph-service';
import type { KGNodeType } from '@/types';

class KnowledgeManagerAgent extends BaseAgent {
  readonly id = 'knowledge-manager';
  readonly name = 'Knowledge Manager';
  readonly description = 'Extract entities, relationships, and connections for the knowledge graph';
  readonly targetColumn = 'notes';
  readonly priority = 6;

  systemPrompt(_ctx: AgentContext): string {
    return `Extract entities and their relationships from the text. For each entity, classify it as one of: concept, entity, topic, claim.

Output format — one line per relationship:
TYPE: Name1 -- relationship --> Name2

Examples:
CONCEPT: Machine Learning -- enables --> Predictive Analytics
ENTITY: OpenAI -- develops --> GPT
TOPIC: Climate Change -- causes --> Sea Level Rise
CLAIM: Remote work increases productivity -- contradicts --> Office work is more efficient

Output 2-5 relationships. Only output in the specified format. No explanations.`;
  }

  userPrompt(ctx: AgentContext): string {
    return `Extract entities and relationships:\n\n${ctx.recentTranscript}`;
  }

  override parseOutput(raw: string): AgentResult['cards'] {
    const entities: ExtractedEntity[] = [];
    const relations: ExtractedRelation[] = [];
    const cardLines: string[] = [];
    const entitySet = new Set<string>();

    const lines = raw.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
      // Parse: TYPE: Name1 -- relationship --> Name2
      const match = line.match(/^(CONCEPT|ENTITY|TOPIC|CLAIM):\s*(.+?)\s*--\s*(.+?)\s*-->\s*(.+)$/i);
      if (match) {
        const type = match[1].toLowerCase() as KGNodeType;
        const source = match[2].trim();
        const relationship = match[3].trim();
        const target = match[4].trim();

        if (!entitySet.has(source.toLowerCase())) {
          entities.push({ label: source, type });
          entitySet.add(source.toLowerCase());
        }
        if (!entitySet.has(target.toLowerCase())) {
          entities.push({ label: target, type });
          entitySet.add(target.toLowerCase());
        }

        relations.push({ source, target, relationship });
        cardLines.push(`${source} \u2192 ${relationship} \u2192 ${target}`);
      } else {
        const bullet = line.replace(/^[\u2022\-*]\s*/, '').trim();
        if (bullet.length > 5) {
          cardLines.push(bullet);
        }
      }
    }

    // Populate graph (fire-and-forget)
    if (entities.length > 0 && relations.length > 0) {
      addEntitiesAndRelations(entities, relations).catch(e =>
        console.warn('Knowledge graph update failed:', e)
      );
    }

    return cardLines.map(content => ({
      content,
      columnType: this.targetColumn as 'notes',
    }));
  }
}

export const knowledgeManager = new KnowledgeManagerAgent();
