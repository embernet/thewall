import { v4 as uuid } from 'uuid';
import type { ApiKeyStatus, ApiKeyConfig, ApiProvider } from '@/types';
import { getModelDef } from '@/utils/providers';
import type { ModelDef } from '@/utils/providers';

export interface LLMMessage {
  role: string;
  content: string;
}

export interface LLMCompleteParams {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Optional: link this call to an agent task for usage tracking */
  agentTaskId?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  complete(params: LLMCompleteParams): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Cached chat configuration — loaded from DB on startup
// ---------------------------------------------------------------------------

let cachedKey = '';
let cachedProvider: ApiProvider = 'anthropic';
let cachedModelId = 'claude-sonnet-4-20250514';

// ---------------------------------------------------------------------------
// Public getters
// ---------------------------------------------------------------------------

export const getApiKey = (): string => cachedKey;

export const getModel = (): string => cachedModelId;

export const getChatProvider = (): ApiProvider => cachedProvider;

export const getModelOption = (): ModelDef => {
  return getModelDef('chat', cachedProvider, cachedModelId) ?? {
    id: cachedModelId,
    label: cachedModelId,
    inputCost: 0,
    outputCost: 0,
  };
};

/** Directly set key + config in memory (called after settings save). */
export const setChatConfig = (provider: ApiProvider, modelId: string, key: string): void => {
  cachedProvider = provider;
  cachedModelId = modelId;
  cachedKey = key;
};

// ---------------------------------------------------------------------------
// Load from encrypted DB via IPC
// ---------------------------------------------------------------------------

/**
 * Load chat slot configuration from the database.
 * Returns true if a valid key was found.
 */
export const loadChatConfig = async (): Promise<boolean> => {
  try {
    const configs: ApiKeyConfig[] = await window.electronAPI?.db?.getApiKeyConfigs() ?? [];
    const chatConfig = configs.find(c => c.slot === 'chat');
    if (chatConfig) {
      cachedProvider = chatConfig.provider;
      cachedModelId = chatConfig.modelId;
      if (chatConfig.hasKey) {
        cachedKey = await window.electronAPI?.db?.getDecryptedKey('chat') ?? '';
        return !!cachedKey;
      }
    }
  } catch (e) {
    console.warn('Failed to load chat config:', e);
  }
  return false;
};

/**
 * Alias for loadChatConfig — call after changing settings to refresh.
 */
export const refreshChatConfig = loadChatConfig;

// Backward-compat shim: setApiKey writes to memory only (Settings panel also persists to DB)
export const setApiKey = (key: string): void => {
  cachedKey = key;
};

// Backward-compat shim: setModel writes to memory only
export const setModel = (id: string): void => {
  cachedModelId = id;
};

// ---------------------------------------------------------------------------
// API key validation
// ---------------------------------------------------------------------------

/**
 * Send a tiny request to validate the current chat API key.
 * Returns 'valid' or 'invalid'.
 */
export const validateApiKey = async (): Promise<ApiKeyStatus> => {
  if (!cachedKey) {
    console.warn('validateApiKey: No key cached');
    return 'invalid';
  }
  try {
    if (cachedProvider === 'anthropic') {
      return await validateAnthropicKey(cachedKey, cachedModelId);
    } else if (cachedProvider === 'openai') {
      return await validateOpenAIKey(cachedKey, cachedModelId);
    }
    return 'invalid';
  } catch (e) {
    console.warn('validateApiKey: Error:', e);
    return 'invalid';
  }
};

async function validateAnthropicKey(key: string, model: string): Promise<ApiKeyStatus> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });
  return r.ok || r.status === 429 ? 'valid' : 'invalid';
}

async function validateOpenAIKey(key: string, model: string): Promise<ApiKeyStatus> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });
  return r.ok || r.status === 429 ? 'valid' : 'invalid';
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  async complete({ system, messages, maxTokens = 1000, agentTaskId }) {
    if (!cachedKey) {
      console.error('No API key set. Configure your key in Settings > API Keys.');
      return null;
    }
    const model = getModelOption();
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cachedKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: maxTokens,
          system,
          messages,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error('LLM API error:', r.status, err);
        return null;
      }
      const d = await r.json();
      logUsage(d, model, agentTaskId, 'anthropic');
      return d.content?.map((b: { text?: string }) => b.text || '').join('\n') || '';
    } catch (e) {
      console.error('LLM API error:', e);
      return null;
    }
  },
};

const openaiChatProvider: LLMProvider = {
  id: 'openai',
  name: 'OpenAI',
  async complete({ system, messages, maxTokens = 1000, agentTaskId }) {
    if (!cachedKey) {
      console.error('No API key set. Configure your key in Settings > API Keys.');
      return null;
    }
    const model = getModelOption();
    try {
      const oaiMessages = [
        { role: 'system', content: system },
        ...messages,
      ];
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cachedKey}`,
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: maxTokens,
          messages: oaiMessages,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error('LLM API error:', r.status, err);
        return null;
      }
      const d = await r.json();

      // Log usage
      const usage = d.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      if (usage && window.electronAPI?.db?.logApiUsage) {
        const inputTokens = usage.prompt_tokens ?? 0;
        const outputTokens = usage.completion_tokens ?? 0;
        const costUsd = inputTokens * model.inputCost + outputTokens * model.outputCost;
        window.electronAPI.db.logApiUsage({
          id: uuid(),
          agentTaskId,
          provider: 'openai',
          model: model.id,
          inputTokens,
          outputTokens,
          costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
          createdAt: new Date().toISOString(),
        }).catch((e: unknown) => console.warn('Failed to log API usage:', e));
      }

      return d.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.error('LLM API error:', e);
      return null;
    }
  },
};

// ---------------------------------------------------------------------------
// Usage logging helper
// ---------------------------------------------------------------------------

function logUsage(
  response: any,
  model: ModelDef,
  agentTaskId: string | undefined,
  provider: string,
): void {
  const usage = response.usage as { input_tokens?: number; output_tokens?: number } | undefined;
  if (usage && window.electronAPI?.db?.logApiUsage) {
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const costUsd = inputTokens * model.inputCost + outputTokens * model.outputCost;
    window.electronAPI.db.logApiUsage({
      id: uuid(),
      agentTaskId,
      provider,
      model: model.id,
      inputTokens,
      outputTokens,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      createdAt: new Date().toISOString(),
    }).catch((e: unknown) => console.warn('Failed to log API usage:', e));
  }
}

// ---------------------------------------------------------------------------
// Active provider management
// ---------------------------------------------------------------------------

function getActiveProvider(): LLMProvider {
  if (cachedProvider === 'openai') return openaiChatProvider;
  return anthropicProvider;
}

export const setLLMProvider = (_p: LLMProvider): void => {
  // No-op — provider is now determined by config
};

export const getLLMProvider = (): LLMProvider => getActiveProvider();

/**
 * Convenience wrapper matching the prototype's askClaude(sys, msg) signature.
 * Delegates to whatever LLMProvider is currently active.
 */
export const askClaude = async (
  system: string,
  userMessage: string,
  maxTokens?: number,
): Promise<string | null> => {
  return getActiveProvider().complete({
    system,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens,
  });
};
