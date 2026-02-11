import type { Tool, ToolResult } from './adapter';
import { getNodes, getEdges, getNeighbors, findNodeByLabel } from '@/graph/graph-service';

// ---------------------------------------------------------------------------
// Knowledge Graph Search Tool
// ---------------------------------------------------------------------------

export const graphSearchTool: Tool = {
  manifest: {
    id: 'knowledge_graph_search',
    name: 'Knowledge Graph Search',
    description: 'Search the knowledge graph for nodes by label or get neighbors of a node',
    parameters: [
      { name: 'query', type: 'string', description: 'Search term to find in node labels', required: true },
      { name: 'type', type: 'string', description: 'Filter by node type: concept, entity, topic, claim' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const query = (params.query as string || '').toLowerCase().trim();
    if (!query) return { success: false, data: '', error: 'Query is required' };

    const nodes = getNodes();
    const matching = nodes.filter(n => {
      const matchLabel = n.label.toLowerCase().includes(query);
      const matchType = params.type ? n.type === params.type : true;
      return matchLabel && matchType;
    });

    if (matching.length === 0) {
      return { success: true, data: 'No matching nodes found.' };
    }

    const results = matching.map(n => {
      const neighbors = getNeighbors(n.id);
      return `[${n.type}] ${n.label} (${neighbors.length} connections)`;
    });

    return { success: true, data: results.join('\n') };
  },
};
