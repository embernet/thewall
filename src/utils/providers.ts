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
          { id: 'claude-opus-4-6-20250918', label: 'Claude Opus 4.6', inputCost: 15.0 / 1_000_000, outputCost: 75.0 / 1_000_000 },
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
          { id: 'imagen-3.0-generate-001', label: 'Imagen 3', inputCost: 0, outputCost: 0.04 },
          { id: 'imagen-3.0-fast-generate-001', label: 'Imagen 3 Fast', inputCost: 0, outputCost: 0.02 },
          { id: 'gemini-2.0-flash-preview-image-generation', label: 'Gemini 2.0 Flash Image', inputCost: 0, outputCost: 0.04 },
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
  // Check static registry first
  const staticMatch = getProviderDef(slot, provider)?.models.find((m) => m.id === modelId);
  if (staticMatch) return staticMatch;
  // Check fetched model cache
  return fetchedModelCache.get(provider)?.find((m) => m.id === modelId);
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

// ---------------------------------------------------------------------------
// Live model fetching from provider APIs
// ---------------------------------------------------------------------------

/** Module-level cache: provider → fetched ModelDef[] */
const fetchedModelCache = new Map<string, ModelDef[]>();

/** Return cached fetched models for a provider, or undefined if not fetched yet. */
export function getCachedModels(provider: ApiProvider): ModelDef[] | undefined {
  return fetchedModelCache.get(provider);
}

/**
 * Get the best available model list for a chat provider:
 * fetched models if available, otherwise static fallback from SLOT_PROVIDERS.
 */
export function getChatModels(provider: ApiProvider): readonly ModelDef[] {
  const cached = fetchedModelCache.get(provider);
  if (cached && cached.length > 0) return cached;
  const provDef = getProviderDef('chat', provider);
  return provDef?.models ?? [];
}

/**
 * Get the best available model list for the image_gen slot (Google Imagen).
 * Returns fetched models if available, otherwise static fallback.
 */
export function getImageGenModels(): readonly ModelDef[] {
  const cached = fetchedModelCache.get('google');
  if (cached && cached.length > 0) return cached;
  const provDef = getProviderDef('image_gen', 'google');
  return provDef?.models ?? [];
}

/**
 * Fetch available models from a provider's API and cache them.
 * Returns the fetched models, or falls back to static list on failure.
 */
export async function fetchProviderModels(
  provider: ApiProvider,
  apiKey: string,
): Promise<ModelDef[]> {
  if (!apiKey) return [];
  try {
    let models: ModelDef[];
    if (provider === 'anthropic') {
      models = await fetchAnthropicModels(apiKey);
    } else if (provider === 'openai') {
      models = await fetchOpenAIModels(apiKey);
    } else if (provider === 'google') {
      models = await fetchGoogleImagenModels(apiKey);
    } else {
      return [];
    }
    if (models.length > 0) {
      fetchedModelCache.set(provider, models);
    }
    return models;
  } catch (e) {
    console.warn(`Failed to fetch models for ${provider}:`, e);
    return [];
  }
}

// Anthropic model ID patterns we want to show for chat
const ANTHROPIC_CHAT_PATTERN = /^claude-/;
// Skip internal/dated variants that are just aliases
const ANTHROPIC_SKIP_PATTERN = /-(latest)$/;

async function fetchAnthropicModels(apiKey: string): Promise<ModelDef[]> {
  const allModels: Array<{ id: string; display_name?: string }> = [];
  let url: string | null = 'https://api.anthropic.com/v1/models?limit=100';

  while (url) {
    const r: Response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
    if (!r.ok) {
      console.warn('Anthropic /v1/models returned', r.status);
      return [];
    }
    const body: { data?: Array<{ id: string; display_name?: string }>; has_more?: boolean; last_id?: string } = await r.json();
    if (body.data) allModels.push(...body.data);
    // Handle pagination
    if (body.has_more && body.last_id) {
      url = `https://api.anthropic.com/v1/models?limit=100&after_id=${body.last_id}`;
    } else {
      url = null;
    }
  }

  // Filter to chat-relevant models and deduplicate
  const seen = new Set<string>();
  const models: ModelDef[] = [];
  for (const m of allModels) {
    if (!ANTHROPIC_CHAT_PATTERN.test(m.id)) continue;
    if (ANTHROPIC_SKIP_PATTERN.test(m.id)) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    models.push({
      id: m.id,
      label: m.display_name || m.id,
      inputCost: 0,
      outputCost: 0,
    });
  }

  // Sort: newer models first (longer IDs with dates tend to sort well alphabetically reversed)
  models.sort((a, b) => a.label.localeCompare(b.label));
  return models;
}

// ---------------------------------------------------------------------------
// Google Imagen model fetching
// ---------------------------------------------------------------------------
// Google's API requires CORS proxy through Electron IPC.
// Falls back to static list if IPC is unavailable.

/**
 * Fetch available Imagen models from Google's Generative AI API.
 * Proxied through Electron IPC to avoid CORS restrictions.
 */
async function fetchGoogleImagenModels(apiKey: string): Promise<ModelDef[]> {
  // Use IPC proxy if available (Electron environment)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.listImagenModels) {
    try {
      const result = await (window as any).electronAPI.listImagenModels(apiKey);
      if (result.error || !result.models?.length) return [];
      return (result.models as Array<{ name: string; displayName?: string }>)
        .filter((m) => /imagen/i.test(m.name) || /gemini.*image|image.*gemini/i.test(m.name))
        .map((m) => {
          // name is like "models/imagen-3.0-generate-001" — strip prefix
          const id = m.name.replace(/^models\//, '');
          const label = m.displayName || id;
          return { id, label, inputCost: 0, outputCost: 0.04 };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch (e) {
      console.warn('fetchGoogleImagenModels IPC error:', e);
      return [];
    }
  }
  // Fallback: try direct fetch (works in non-Electron contexts or if CORS allows)
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!r.ok) return [];
    const body = await r.json() as {
      models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
    };
    const imagenModels = (body.models ?? []).filter((m) => {
      const isImagen = /imagen/i.test(m.name) && m.supportedGenerationMethods?.includes('predict');
      const isGeminiImage = /gemini.*image|image.*gemini/i.test(m.name);
      return isImagen || isGeminiImage;
    });
    return imagenModels.map((m) => {
      const id = m.name.replace(/^models\//, '');
      return { id, label: m.displayName || id, inputCost: 0, outputCost: 0.04 };
    });
  } catch {
    return [];
  }
}
// OpenAI model patterns for chat
const OPENAI_CHAT_PATTERN = /^(gpt-4|gpt-3\.5|o[1-9]|chatgpt)/;
const OPENAI_SKIP_PATTERN = /-(realtime|audio|search)/;

async function fetchOpenAIModels(apiKey: string): Promise<ModelDef[]> {
  const r = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!r.ok) {
    console.warn('OpenAI /v1/models returned', r.status);
    return [];
  }
  const body = await r.json();
  const data = body.data as Array<{ id: string }> | undefined;
  if (!data) return [];

  const models: ModelDef[] = [];
  const seen = new Set<string>();
  for (const m of data) {
    if (!OPENAI_CHAT_PATTERN.test(m.id)) continue;
    if (OPENAI_SKIP_PATTERN.test(m.id)) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    models.push({
      id: m.id,
      label: m.id,
      inputCost: 0,
      outputCost: 0,
    });
  }

  models.sort((a, b) => a.label.localeCompare(b.label));
  return models;
}
