import type { Tool, ToolResult } from './adapter';
import { addNode, addEdge } from '@/graph/graph-service';
import type { KGNodeType } from '@/types';

// ---------------------------------------------------------------------------
// Knowledge Graph Add Tool
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set(['concept', 'entity', 'topic', 'claim']);

export const graphAddTool: Tool = {
  manifest: {
    id: 'knowledge_graph_add',
    name: 'Knowledge Graph Add',
    description: 'Add nodes and edges to the knowledge graph',
    parameters: [
      { name: 'node_label', type: 'string', description: 'Label for a new node', required: true },
      { name: 'node_type', type: 'string', description: 'Node type: concept, entity, topic, claim' },
      { name: 'edge_target', type: 'string', description: 'Label of a target node to create an edge to' },
      { name: 'edge_relationship', type: 'string', description: 'Relationship label for the edge' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const label = params.node_label as string;
    if (!label) return { success: false, data: '', error: 'node_label is required' };

    const type = VALID_TYPES.has(params.node_type as string)
      ? (params.node_type as KGNodeType)
      : 'concept';

    const nodeId = await addNode(label, type);

    let edgeInfo = '';
    if (params.edge_target && params.edge_relationship) {
      const targetId = await addNode(params.edge_target as string, type);
      const edgeId = await addEdge(nodeId, targetId, params.edge_relationship as string);
      if (edgeId) {
        edgeInfo = ` Edge created: ${label} --${params.edge_relationship}--> ${params.edge_target}`;
      }
    }

    return { success: true, data: `Node added: ${label} (${type})${edgeInfo}` };
  },
};
