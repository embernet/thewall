// ============================================================================
// The Wall -- Shared TypeScript Types
// ============================================================================

// ----------------------------------------------------------------------------
// Enums & Union Types
// ----------------------------------------------------------------------------

export type SessionMode = 'silent' | 'active' | 'sidekick';

export type SessionStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';

export type ColumnType =
  | 'transcript'
  | 'observations'
  | 'notes'
  | 'context'
  | 'concepts'
  | 'ideas'
  | 'questions'
  | 'claims'
  | 'gaps'
  | 'actions'
  | 'alternatives'
  | 'deep_research'
  | 'inquiry'
  | 'agent_queue'
  | 'highlights'
  | 'trash';

export type CardSource = 'transcription' | 'user' | 'agent' | 'inquiry';

export type HighlightState = 'none' | 'user' | 'ai' | 'both';

export type AgentTaskStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export type AgentType = 'built-in' | 'methodology' | 'persona' | 'custom';

export type AppView = 'launcher' | 'session';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ----------------------------------------------------------------------------
// Core Domain Interfaces
// ----------------------------------------------------------------------------

/** A session represents a single meeting, research, or collaboration workspace. */
export interface Session {
  id: string;
  title: string;
  mode: SessionMode;
  goal: string;
  approach?: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

/** A column is a vertical lane within a session holding cards of a specific type. */
export interface Column {
  id: string;
  sessionId: string;
  type: ColumnType;
  title: string;
  sortOrder: string;
  visible: boolean;
  collapsed: boolean;
  agentId?: string;
  config?: Record<string, unknown>;
}

/** A source link embedded on a card, pointing back to a card that inspired it. */
export interface SourceLink {
  id: string;
  label: string;
  icon: string;
  color: string;
}

/** A card is an individual insight, note, transcript chunk, or agent output. */
export interface Card {
  id: string;
  columnId: string;
  sessionId: string;
  content: string;
  source: CardSource;
  sourceAgentId?: string;
  sourceAgentName?: string;
  sourceCardIds: SourceLink[];
  promptUsed?: string;
  embedding?: number[];
  aiTags: string[];
  userTags: string[];
  speaker?: string;
  /** Timestamp in milliseconds relative to session start. */
  timestamp?: number;
  highlightedBy: HighlightState;
  pinned?: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sortOrder: string;
}

// ----------------------------------------------------------------------------
// Column Metadata
// ----------------------------------------------------------------------------

/** Static metadata describing a column type (icon, color, default title). */
export interface ColumnMeta {
  type: ColumnType;
  title: string;
  icon: string;
  color: string;
}

// ----------------------------------------------------------------------------
// Agent System
// ----------------------------------------------------------------------------

/**
 * A built-in agent definition used by the prototype's lightweight agent runner.
 * `prompt` is a function that wraps input text in the agent-specific instruction.
 */
export interface AgentDefinition {
  key: string;
  col: ColumnType;
  name: string;
  sys: string;
  prompt: (text: string) => string;
}

/**
 * A persisted agent record stored in the database (richer than AgentDefinition).
 */
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  systemPrompt: string;
  tools: string[];
  enabled: boolean;
  inputSources: string[];
  config: Record<string, unknown>;
  createdAt: string;
}

/**
 * A single queued/running/completed agent task, tracked in the Agent Queue column.
 */
export interface AgentTask {
  id: string;
  agentId?: string;
  agentName: string;
  agentKey: string;
  sessionId: string;
  status: AgentTaskStatus;
  priority?: number;
  prompt?: string;
  systemPrompt?: string;
  inputText?: string;
  result?: string;
  resultPreview?: string;
  error?: string;
  cardsCreated: number;
  /** Duration in milliseconds. */
  duration?: number;
  targetColumnId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ----------------------------------------------------------------------------
// Audio & Recording
// ----------------------------------------------------------------------------

/** Runtime state of the audio recording subsystem. */
export interface AudioState {
  recording: boolean;
  paused: boolean;
  /** Normalised microphone input level 0..1. */
  level: number;
  /** Elapsed recording time in milliseconds. */
  elapsed: number;
  autoScroll: boolean;
}

// ----------------------------------------------------------------------------
// Simulation
// ----------------------------------------------------------------------------

export interface SimParticipant {
  name: string;
  role: string;
  /** Built-in persona ID, or null for a custom description. */
  personaId: string | null;
  /** Custom persona system prompt (used when personaId is null or as override). */
  personaPrompt: string;
}

/** Configuration for a simulated meeting. */
export interface SimConfig {
  context: string;
  participants: SimParticipant[];
  turns: number;
}

// ----------------------------------------------------------------------------
// Session Index (Launcher)
// ----------------------------------------------------------------------------

/** Lightweight entry shown in the session launcher / picker. */
export interface SessionIndexEntry {
  id: string;
  title: string;
  mode: SessionMode;
  updatedAt: string;
  cardCount: number;
}

// ----------------------------------------------------------------------------
// Knowledge Graph
// ----------------------------------------------------------------------------

export type KGNodeType = 'concept' | 'entity' | 'topic' | 'claim';

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type?: KGNodeType;
  metadata: Record<string, unknown>;
  embedding?: number[];
  sessionId?: string;
  createdAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: string;
  weight: number;
  sessionId?: string;
}

// ----------------------------------------------------------------------------
// Agent Configuration (user overrides for built-in + custom agents)
// ----------------------------------------------------------------------------

/** Persisted override for a built-in agent. NULL fields = use default. */
export interface AgentConfigOverride {
  agentId: string;
  enabled: boolean;
  systemPrompt: string | null;
  userPrompt: string | null;
  priority: number | null;
  targetColumn: string | null;
  triggerOnTranscript: boolean | null;
  inputColumns: string[] | null;
  toolIds: string[] | null;
  /** Max tokens for LLM response. NULL = use agent default. */
  maxTokens: number | null;
  /** Cosine similarity threshold for dedup. NULL = use agent default (0.85). */
  dedupThreshold: number | null;
  updatedAt: string;
}

/** A user-created custom agent stored in the database. */
export interface CustomAgentConfig {
  id: string;
  name: string;
  description: string;
  /** Built-in persona ID used as basis for system prompt, or null. */
  personaId: string | null;
  systemPrompt: string;
  userPrompt: string;
  targetColumn: string;
  priority: number;
  triggerOnTranscript: boolean;
  dependsOn: string[];
  inputColumns: string[];
  toolIds: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Assets
// ----------------------------------------------------------------------------

export interface Asset {
  id: string;
  type: string;
  filename: string;
  path: string;
  mimeType?: string;
  sourceAgentId?: string;
  sourceCardId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// API Usage Tracking
// ----------------------------------------------------------------------------

export interface ApiUsageRecord {
  id: string;
  agentTaskId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Session Export / Import Formats
// ----------------------------------------------------------------------------

export interface SessionExport {
  _format: 'the-wall-session';
  _version: number;
  _exportedAt: string;
  session: Session;
  columns: Column[];
  cards: Card[];
  speakerColors: Record<string, string>;
  agentTasks?: AgentTask[];
}

export interface BackupExport {
  _format: 'the-wall-backup';
  _version: number;
  _exportedAt: string;
  _count: number;
  sessions: SessionExport[];
}

// ----------------------------------------------------------------------------
// Source Badge Descriptor
// ----------------------------------------------------------------------------

export interface SourceBadge {
  label: string;
  bg: string;
}

// ----------------------------------------------------------------------------
// API Key Management
// ----------------------------------------------------------------------------

/** Functional slot — each capability has its own provider/model/key. */
export type ApiSlot = 'chat' | 'embeddings' | 'image_gen' | 'transcription';

/** Supported API providers. */
export type ApiProvider = 'anthropic' | 'openai' | 'voyage' | 'google' | 'local' | 'wispr';

/** Renderer-safe config: no raw key, just whether one exists. */
export interface ApiKeyConfig {
  slot: ApiSlot;
  provider: ApiProvider;
  modelId: string;
  hasKey: boolean;
}

// ----------------------------------------------------------------------------
// Electron IPC -- File Processing
// ----------------------------------------------------------------------------

/** Chunk returned from file processing in the main process. */
export interface FileChunk {
  content: string;
  fileName: string;
  filePath: string;
  chunkIndex: number;
  totalChunks: number;
}

// ----------------------------------------------------------------------------
// Electron IPC -- Database API
// ----------------------------------------------------------------------------

export interface ElectronDbApi {
  // Sessions
  getSessions: () => Promise<SessionIndexEntry[]>;
  getSession: (id: string) => Promise<Session | null>;
  createSession: (session: Session) => Promise<Session>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  // Columns
  getColumns: (sessionId: string) => Promise<Column[]>;
  createColumn: (column: Column) => Promise<Column>;
  updateColumn: (id: string, updates: Partial<Column>) => Promise<void>;

  // Cards
  getCards: (sessionId: string) => Promise<Card[]>;
  createCard: (card: Card) => Promise<Card>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (id: string, columnId: string, sortOrder: string) => Promise<void>;

  // Agents
  getAgents: () => Promise<Agent[]>;
  createAgent: (agent: Agent) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;

  // Agent Tasks
  getAgentTasks: (sessionId: string) => Promise<AgentTask[]>;
  createAgentTask: (task: AgentTask) => Promise<AgentTask>;
  updateAgentTask: (id: string, updates: Partial<AgentTask>) => Promise<void>;

  // API Usage
  logApiUsage: (usage: ApiUsageRecord) => Promise<void>;
  getApiUsageSummary: () => Promise<{
    byModel: {
      provider: string; model: string;
      input_tokens: number; output_tokens: number;
      cost_usd: number; call_count: number;
      first_call: string; last_call: string;
    }[];
    totals: { total_cost: number; total_input: number; total_output: number; total_calls: number };
  }>;

  // API Key Management
  getApiKeyConfigs: () => Promise<ApiKeyConfig[]>;
  setApiKeyConfig: (slot: ApiSlot, provider: ApiProvider, modelId: string, rawKey: string) => Promise<void>;
  getDecryptedKey: (slot: ApiSlot) => Promise<string>;
  deleteApiKeyConfig: (slot: ApiSlot) => Promise<void>;

  // Embeddings
  storeEmbedding: (cardId: string, blob: ArrayBuffer) => Promise<void>;
  getEmbedding: (cardId: string) => Promise<ArrayBuffer | null>;
  getEmbeddings: (sessionId: string) => Promise<{ id: string; embedding: ArrayBuffer }[]>;

  // Knowledge Graph
  getGraphNodes: (sessionId: string) => Promise<KnowledgeGraphNode[]>;
  getGraphEdges: (sessionId: string) => Promise<KnowledgeGraphEdge[]>;
  createGraphNode: (node: KnowledgeGraphNode) => Promise<void>;
  createGraphEdge: (edge: KnowledgeGraphEdge) => Promise<void>;
  deleteGraphNode: (nodeId: string) => Promise<void>;

  // Bulk operations
  importSession: (data: SessionExport) => Promise<boolean>;
  exportSession: (sessionId: string) => Promise<SessionExport | null>;
  exportAllSessions: () => Promise<BackupExport>;

  // File processing (Context column)
  processContextFile: () => Promise<FileChunk[]>;

  // Agent Configuration
  getAgentConfigs: () => Promise<AgentConfigOverride[]>;
  saveAgentConfig: (agentId: string, config: Partial<AgentConfigOverride>) => Promise<void>;
  deleteAgentConfig: (agentId: string) => Promise<void>;
  getCustomAgents: () => Promise<CustomAgentConfig[]>;
  saveCustomAgent: (agent: CustomAgentConfig) => Promise<void>;
  deleteCustomAgent: (id: string) => Promise<void>;
}

export type EmbeddingProvider = 'openai' | 'local';

export interface ElectronAPI {
  db: ElectronDbApi;

  /** Proxy transcription API calls through the main process (bypasses CORS). */
  transcribe: (audioBase64: string) => Promise<{ text?: string; error?: string }>;

  shell: {
    openPath: (filePath: string) => Promise<string>;
  };
}

export type ApiKeyStatus = 'unchecked' | 'checking' | 'valid' | 'invalid';

/** Reason the agent queue is paused. `null` means the queue is running. */
export type QueuePauseReason = 'api_not_ready' | 'api_invalid' | 'user' | null;

// ----------------------------------------------------------------------------
// Window Augmentation
// ----------------------------------------------------------------------------

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** All column types with their display metadata, in default sort order. */
export const COL_TYPES: readonly ColumnMeta[] = [
  { type: 'transcript',    title: 'Transcript',    icon: '\uD83C\uDF99\uFE0F', color: '#ef4444' },
  { type: 'notes',        title: 'Notes',         icon: '\uD83D\uDCDD',       color: '#8b9cf6' },
  { type: 'context',      title: 'Context',       icon: '\uD83D\uDCC2',       color: '#10b981' },
  { type: 'observations', title: 'Observations',  icon: '\uD83D\uDD0D',       color: '#6366f1' },
  { type: 'concepts',     title: 'Key Concepts',  icon: '\uD83D\uDCA1',       color: '#8b5cf6' },
  { type: 'ideas',       title: 'Ideas',         icon: '\uD83E\uDDE0',       color: '#a855f7' },
  { type: 'questions',   title: 'Questions',      icon: '\u2753',             color: '#ec4899' },
  { type: 'claims',      title: 'Claims',         icon: '\uD83D\uDCCC',       color: '#14b8a6' },
  { type: 'gaps',        title: 'Gaps & Risks',   icon: '\u26A0\uFE0F',       color: '#f97316' },
  { type: 'actions',     title: 'Actions',        icon: '\u2705',             color: '#22c55e' },
  { type: 'alternatives', title: 'Alternatives',  icon: '\uD83D\uDD00',       color: '#0ea5e9' },
  { type: 'deep_research', title: 'Deep Research', icon: '\uD83D\uDD2C',      color: '#7c3aed' },
  { type: 'inquiry',     title: 'Inquiry',        icon: '\uD83D\uDD2E',       color: '#06b6d4' },
  { type: 'agent_queue', title: 'Agent Queue',    icon: '\u26A1',             color: '#eab308' },
  { type: 'highlights',  title: 'Highlights',     icon: '\u2B50',             color: '#fbbf24' },
  { type: 'trash',       title: 'Trash',          icon: '\uD83D\uDDD1\uFE0F', color: '#6b7280' },
] as const;

/**
 * Badge display info keyed by CardSource.
 * `label` is the user-visible short name; `bg` is the badge background color.
 */
export const SOURCE_BADGES: Readonly<Record<CardSource, SourceBadge>> = {
  user:          { label: 'User',       bg: '#4f46e5' },
  agent:         { label: 'Agent',      bg: '#0891b2' },
  transcription: { label: 'Transcript', bg: '#dc2626' },
  inquiry:       { label: 'Inquiry',    bg: '#06b6d4' },
} as const;

/** Background accent color per session mode. */
export const MODE_COLORS: Readonly<Record<SessionMode, string>> = {
  silent:  '#6366f1',
  active:  '#22c55e',
  sidekick: '#f59e0b',
} as const;

/** Built-in agent definitions matching the prototype's AGENTS array. */
export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  {
    key: 'concepts', col: 'concepts', name: 'Concept Extractor',
    sys: 'Extract key concepts from meeting transcript. Output 1-3 items, each on its own line starting with \u2022. One sentence each. Only bullets.',
    prompt: (t: string) => 'Extract key concepts:\n\n' + t,
  },
  {
    key: 'questions', col: 'questions', name: 'Questioner',
    sys: 'Generate probing questions from meeting discussion. Output 1-2 questions, each on a new line starting with \u2022. Only bullets.',
    prompt: (t: string) => 'What questions arise?\n\n' + t,
  },
  {
    key: 'claims', col: 'claims', name: 'Claim Identifier',
    sys: 'Identify factual claims and assertions. Output 1-2 items, each on a new line starting with \u2022. Only bullets.',
    prompt: (t: string) => 'Identify claims:\n\n' + t,
  },
  {
    key: 'gaps', col: 'gaps', name: 'Gap Finder',
    sys: 'Identify gaps, risks, unstated assumptions. Output 1-2 items, each on a new line starting with \u2022. Only bullets.',
    prompt: (t: string) => 'What gaps or risks exist?\n\n' + t,
  },
  {
    key: 'actions', col: 'actions', name: 'Action Tracker',
    sys: 'Extract action items and decisions. Output 0-2 items starting with \u2022. Include who is responsible. If none, output nothing.',
    prompt: (t: string) => 'Extract action items:\n\n' + t,
  },
];

/** Rotating palette used to assign distinct colors to speakers. */
export const SPEAKER_COLORS: readonly string[] = [
  '#f59e0b',
  '#6366f1',
  '#22c55e',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#a855f7',
  '#14b8a6',
] as const;
