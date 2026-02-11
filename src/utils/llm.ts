import { v4 as uuid } from 'uuid';

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

let apiKey: string = '';

export const setApiKey = (key: string): void => {
  apiKey = key;
};

export const getApiKey = (): string => apiKey;

// Approximate cost per token for Sonnet (input/output) in USD
const SONNET_INPUT_COST = 3.0 / 1_000_000;
const SONNET_OUTPUT_COST = 15.0 / 1_000_000;
const MODEL_ID = 'claude-sonnet-4-20250514';

/** Claude / Anthropic provider */
const claudeProvider: LLMProvider = {
  id: 'anthropic',
  name: 'Claude',
  async complete({ system, messages, maxTokens = 1000, agentTaskId }) {
    if (!apiKey) {
      console.error('No API key set. Call setApiKey() or enter your key in Settings.');
      return null;
    }
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL_ID,
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

      // Log usage if available
      const usage = d.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      if (usage && window.electronAPI?.db?.logApiUsage) {
        const inputTokens = usage.input_tokens ?? 0;
        const outputTokens = usage.output_tokens ?? 0;
        const costUsd = inputTokens * SONNET_INPUT_COST + outputTokens * SONNET_OUTPUT_COST;
        window.electronAPI.db.logApiUsage({
          id: uuid(),
          agentTaskId,
          provider: 'anthropic',
          model: MODEL_ID,
          inputTokens,
          outputTokens,
          costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
          createdAt: new Date().toISOString(),
        }).catch((e: unknown) => console.warn('Failed to log API usage:', e));
      }

      return d.content?.map((b: { text?: string }) => b.text || '').join('\n') || '';
    } catch (e) {
      console.error('LLM API error:', e);
      return null;
    }
  },
};

let currentProvider: LLMProvider = claudeProvider;

export const setLLMProvider = (p: LLMProvider): void => {
  currentProvider = p;
};

export const getLLMProvider = (): LLMProvider => currentProvider;

/**
 * Convenience wrapper matching the prototype's askClaude(sys, msg) signature.
 * Delegates to whatever LLMProvider is currently active.
 */
export const askClaude = async (
  system: string,
  userMessage: string,
): Promise<string | null> => {
  return currentProvider.complete({
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
};
