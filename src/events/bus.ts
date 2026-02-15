import mitt from 'mitt';
import type { Card, AgentTask, SessionMode, ApiKeyStatus, QueuePauseReason } from '@/types';

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

export type AppEvents = {
  'transcript:segment': { cardId: string; text: string; speaker?: string };
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
};

// ---------------------------------------------------------------------------
// Singleton bus instance
// ---------------------------------------------------------------------------

export const bus = mitt<AppEvents>();
