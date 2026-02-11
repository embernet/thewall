import Graph from 'graphology';
import { v4 as uuid } from 'uuid';
import { bus } from '@/events/bus';
import type { KnowledgeGraphNode, KnowledgeGraphEdge, KGNodeType } from '@/types';

// ---------------------------------------------------------------------------
// Knowledge Graph Service
//
// In-memory graphology graph synced to SQLite via IPC.
// Provides CRUD operations and query methods for the knowledge graph.
// ---------------------------------------------------------------------------

let graph = new Graph({ multi: false, type: 'directed', allowSelfLoops: false });
let currentSessionId: string | null = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Load graph for a session from SQLite. */
export async function loadGraph(sessionId: string): Promise<void> {
  graph.clear();
  currentSessionId = sessionId;

  if (!window.electronAPI?.db?.getGraphNodes) return;

  try {
    const [nodes, edges] = await Promise.all([
      window.electronAPI.db.getGraphNodes(sessionId),
      window.electronAPI.db.getGraphEdges(sessionId),
    ]);

    for (const node of nodes) {
      graph.addNode(node.id, {
        label: node.label,
        type: node.type || 'concept',
        metadata: node.metadata || {},
        createdAt: node.createdAt,
      });
    }

    for (const edge of edges) {
      if (graph.hasNode(edge.sourceId) && graph.hasNode(edge.targetId)) {
        graph.addEdge(edge.sourceId, edge.targetId, {
          id: edge.id,
          relationship: edge.relationship,
          weight: edge.weight ?? 1,
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load knowledge graph:', e);
  }
}

/** Clear in-memory graph. */
export function clearGraph(): void {
  graph.clear();
  currentSessionId = null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get the underlying graphology instance (read-only usage). */
export function getGraph(): Graph {
  return graph;
}

/** Get all nodes as typed objects. */
export function getNodes(): KnowledgeGraphNode[] {
  return graph.mapNodes((id, attrs) => ({
    id,
    label: attrs.label as string,
    type: (attrs.type as KGNodeType) || 'concept',
    metadata: (attrs.metadata as Record<string, unknown>) || {},
    createdAt: (attrs.createdAt as string) || new Date().toISOString(),
    sessionId: currentSessionId || undefined,
  }));
}

/** Get all edges as typed objects. */
export function getEdges(): KnowledgeGraphEdge[] {
  return graph.mapEdges((edgeKey, attrs, source, target) => ({
    id: (attrs.id as string) || edgeKey,
    sourceId: source,
    targetId: target,
    relationship: (attrs.relationship as string) || 'related',
    weight: (attrs.weight as number) ?? 1,
    sessionId: currentSessionId || undefined,
  }));
}

/** Find node by label (case-insensitive). */
export function findNodeByLabel(label: string): string | null {
  const lower = label.toLowerCase().trim();
  let found: string | null = null;
  graph.forEachNode((id, attrs) => {
    if ((attrs.label as string).toLowerCase().trim() === lower) {
      found = id;
    }
  });
  return found;
}

/** Get neighbors of a node. */
export function getNeighbors(nodeId: string): KnowledgeGraphNode[] {
  if (!graph.hasNode(nodeId)) return [];
  const ids = graph.neighbors(nodeId);
  return ids.map(id => {
    const attrs = graph.getNodeAttributes(id);
    return {
      id,
      label: attrs.label as string,
      type: (attrs.type as KGNodeType) || 'concept',
      metadata: (attrs.metadata as Record<string, unknown>) || {},
      createdAt: (attrs.createdAt as string) || '',
      sessionId: currentSessionId || undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Mutations (sync to DB)
// ---------------------------------------------------------------------------

/** Add a node, merging if label already exists. Returns the node ID. */
export async function addNode(
  label: string,
  type: KGNodeType = 'concept',
  metadata: Record<string, unknown> = {},
): Promise<string> {
  // Check for existing node with same label
  const existing = findNodeByLabel(label);
  if (existing) {
    // Merge metadata
    const prev = graph.getNodeAttributes(existing);
    const merged = { ...((prev.metadata as Record<string, unknown>) || {}), ...metadata };
    graph.setNodeAttribute(existing, 'metadata', merged);
    return existing;
  }

  const id = uuid();
  const now = new Date().toISOString();

  graph.addNode(id, { label, type, metadata, createdAt: now });

  // Persist to DB
  if (window.electronAPI?.db?.createGraphNode && currentSessionId) {
    window.electronAPI.db.createGraphNode({
      id,
      label,
      type,
      metadata,
      sessionId: currentSessionId,
      createdAt: now,
    }).catch(e => console.warn('Failed to persist graph node:', e));
  }

  bus.emit('graph:nodeAdded', { nodeId: id, label, type });
  return id;
}

/** Add an edge between two nodes. Returns edge ID. */
export async function addEdge(
  sourceId: string,
  targetId: string,
  relationship: string,
  weight = 1,
): Promise<string | null> {
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) return null;

  // Check if edge already exists
  if (graph.hasEdge(sourceId, targetId)) {
    // Strengthen existing edge
    const edgeKey = graph.edge(sourceId, targetId)!;
    const cur = graph.getEdgeAttribute(edgeKey, 'weight') as number;
    graph.setEdgeAttribute(edgeKey, 'weight', cur + 0.5);
    return graph.getEdgeAttribute(edgeKey, 'id') as string;
  }

  const id = uuid();
  graph.addEdge(sourceId, targetId, { id, relationship, weight });

  // Persist to DB
  if (window.electronAPI?.db?.createGraphEdge && currentSessionId) {
    window.electronAPI.db.createGraphEdge({
      id,
      sourceId,
      targetId,
      relationship,
      weight,
      sessionId: currentSessionId,
    }).catch(e => console.warn('Failed to persist graph edge:', e));
  }

  bus.emit('graph:edgeAdded', { edgeId: id, sourceId, targetId, relationship });
  return id;
}

/** Remove a node and all its edges. */
export async function removeNode(nodeId: string): Promise<void> {
  if (!graph.hasNode(nodeId)) return;
  graph.dropNode(nodeId);

  if (window.electronAPI?.db?.deleteGraphNode) {
    window.electronAPI.db.deleteGraphNode(nodeId)
      .catch(e => console.warn('Failed to delete graph node:', e));
  }
}

// ---------------------------------------------------------------------------
// Bulk operations for knowledge-manager agent
// ---------------------------------------------------------------------------

export interface ExtractedEntity {
  label: string;
  type: KGNodeType;
}

export interface ExtractedRelation {
  source: string;
  target: string;
  relationship: string;
}

/** Add entities and relations in batch. */
export async function addEntitiesAndRelations(
  entities: ExtractedEntity[],
  relations: ExtractedRelation[],
): Promise<void> {
  // Add all nodes first
  const labelToId = new Map<string, string>();
  for (const ent of entities) {
    const id = await addNode(ent.label, ent.type);
    labelToId.set(ent.label.toLowerCase().trim(), id);
  }

  // Add edges
  for (const rel of relations) {
    const srcId = labelToId.get(rel.source.toLowerCase().trim());
    const tgtId = labelToId.get(rel.target.toLowerCase().trim());
    if (srcId && tgtId) {
      await addEdge(srcId, tgtId, rel.relationship);
    }
  }
}
