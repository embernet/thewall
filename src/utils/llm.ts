export interface LLMMessage {
  role: string;
  content: string;
}

export interface LLMCompleteParams {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
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

/** Claude / Anthropic provider */
const claudeProvider: LLMProvider = {
  id: 'anthropic',
  name: 'Claude',
  async complete({ system, messages, maxTokens = 1000 }) {
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
          model: 'claude-sonnet-4-20250514',
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
