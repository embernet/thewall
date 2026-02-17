import mitt from 'mitt';
import type { Card, AgentTask, SessionMode, ApiKeyStatus, QueuePauseReason } from '@/types';

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

export type AppEvents = {
  'transcript:segment': { text: string; speaker?: string };
  'transcript:error': { error: string };
  'card:created': { card: Card };
  'card:updated': { card: Card };
  'card:deleted': { cardId: string };
  'agent:started': { taskId: string; agentKey: string };
  'agent:completed': { taskId: string; agentKey: string; cardsCreated: number };
  'agent:failed': { taskId: string; agentKey: string; error: string };
  'session:modeChanged': { mode: SessionMode };
  'session:goalChanged': { goal: string };
  'graph:nodeAdded': { nodeId: string; label: string; type: string };
  'graph:edgeAdded': { edgeId: string; sourceId: string; targetId: string; relationship: string };
  'api:statusChanged': { status: ApiKeyStatus };
  'queue:pauseChanged': { reason: QueuePauseReason };
  'document:viewChunks': { docCardId: string; highlightChunkId?: string };
  'card:findRelated': { card: Card };
  'agentConfig:changed': Record<string, never>;
  'transcript:pipeline:started': { batchId: string; rawCardCount: number };
  'transcript:pipeline:completed': { batchId: string; cleanCardCount: number };
};

// ---------------------------------------------------------------------------
// Singleton bus instance
// ---------------------------------------------------------------------------

export const bus = mitt<AppEvents>();
