// ============================================================================
// The Wall -- Provider & Model Registry
//
// Defines the available providers and models for each functional slot.
// ============================================================================

import type { ApiSlot, ApiProvider } from '@/types';

// ---------------------------------------------------------------------------
// Model definition
// ---------------------------------------------------------------------------

export interface ModelDef {
  id: string;
  label: string;
  /** Cost per input token in USD (0 for free/local). */
  inputCost: number;
  /** Cost per output token in USD (0 for free/local). */
  outputCost: number;
}

export interface ProviderDef {
  id: ApiProvider;
  label: string;
  models: readonly ModelDef[];
}

export interface SlotDef {
  slot: ApiSlot;
  label: string;
  description: string;
  providers: readonly ProviderDef[];
}

// ---------------------------------------------------------------------------
// Provider definitions per slot
// ---------------------------------------------------------------------------

export const SLOT_PROVIDERS: readonly SlotDef[] = [
  {
    slot: 'chat',
    label: 'Chat (LLM)',
    description: 'Powers AI agents, simulation, and inquiry',
    providers: [
      {
        id: 'anthropic',
        label: 'Anthropic',
        models: [
          { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4.5', inputCost: 3.0 / 1_000_000, outputCost: 15.0 / 1_000_000 },
          { id: 'claude-opus-4-20250918', label: 'Claude Opus 4.6', inputCost: 15.0 / 1_000_000, outputCost: 75.0 / 1_000_000 },
        ],
      },
      {
        id: 'openai',
        label: 'OpenAI',
        models: [
          { id: 'gpt-4o', label: 'GPT-4o', inputCost: 2.5 / 1_000_000, outputCost: 10.0 / 1_000_000 },
          { id: 'gpt-4o-mini', label: 'GPT-4o Mini', inputCost: 0.15 / 1_000_000, outputCost: 0.6 / 1_000_000 },
        ],
      },
    ],
  },
  {
    slot: 'embeddings',
    label: 'Embeddings',
    description: 'Text similarity search for cards and knowledge graph',
    providers: [
      {
        id: 'openai',
        label: 'OpenAI',
        models: [
          { id: 'text-embedding-3-small', label: 'text-embedding-3-small', inputCost: 0.02 / 1_000_000, outputCost: 0 },
          { id: 'text-embedding-3-large', label: 'text-embedding-3-large', inputCost: 0.13 / 1_000_000, outputCost: 0 },
        ],
      },
      {
        id: 'voyage',
        label: 'Voyage AI',
        models: [
          { id: 'voyage-3-lite', label: 'Voyage 3 Lite', inputCost: 0.02 / 1_000_000, outputCost: 0 },
        ],
      },
      {
        id: 'local',
        label: 'Local (TF-IDF)',
        models: [
          { id: 'local-tfidf', label: 'Built-in TF-IDF', inputCost: 0, outputCost: 0 },
        ],
      },
    ],
  },
  {
    slot: 'image_gen',
    label: 'Image Generation',
    description: 'Generate infographics, diagrams, and visual assets',
    providers: [
      {
        id: 'google',
        label: 'Google',
        models: [
          { id: 'imagen-3.0-generate-002', label: 'Imagen 3', inputCost: 0, outputCost: 0.04 },
        ],
      },
    ],
  },
  {
    slot: 'transcription',
    label: 'Voice Transcription',
    description: 'Live speech-to-text for transcript recording',
    providers: [
      {
        id: 'openai',
        label: 'OpenAI Whisper',
        models: [
          { id: 'whisper-1', label: 'Whisper v1', inputCost: 0.006 / 60, outputCost: 0 },
        ],
      },
      {
        id: 'wispr',
        label: 'WISPR Flow',
        models: [
          { id: 'wispr-flow', label: 'WISPR Flow', inputCost: 0, outputCost: 0 },
        ],
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getSlotDef(slot: ApiSlot): SlotDef | undefined {
  return SLOT_PROVIDERS.find((s) => s.slot === slot);
}

export function getProviderDef(slot: ApiSlot, provider: ApiProvider): ProviderDef | undefined {
  return getSlotDef(slot)?.providers.find((p) => p.id === provider);
}

export function getModelDef(slot: ApiSlot, provider: ApiProvider, modelId: string): ModelDef | undefined {
  return getProviderDef(slot, provider)?.models.find((m) => m.id === modelId);
}

/** Returns the default provider for a slot (first in the list). */
export function defaultProvider(slot: ApiSlot): ProviderDef {
  const slotDef = getSlotDef(slot);
  return slotDef!.providers[0] as ProviderDef;
}

/** Returns the default model for a slot+provider (first in the list). */
export function defaultModel(slot: ApiSlot, provider?: ApiProvider): ModelDef {
  const prov = provider ? getProviderDef(slot, provider) : defaultProvider(slot);
  return prov!.models[0] as ModelDef;
}

/** Whether a provider requires an API key (local does not). */
export function providerNeedsKey(provider: ApiProvider): boolean {
  return provider !== 'local';
}
