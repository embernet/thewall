import type { Tool, ToolResult } from './adapter';
import { askClaude } from '@/utils/llm';

// ---------------------------------------------------------------------------
// Text Summarizer Tool — LLM-powered text compression
// ---------------------------------------------------------------------------

export const textSummarizerTool: Tool = {
  manifest: {
    id: 'text_summarizer',
    name: 'Text Summarizer',
    description: 'Compress long text (web pages, PDFs, articles) into a concise summary. Use this to make fetched content fit into agent context windows.',
    parameters: [
      { name: 'text', type: 'string', description: 'The text to summarize', required: true },
      { name: 'max_length', type: 'number', description: 'Target summary length in words (default 200)' },
      { name: 'focus', type: 'string', description: 'What to focus on in the summary (e.g. "claims and evidence", "key findings", "methodology")' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const text = (params.text as string || '').trim();
    if (!text) return { success: false, data: '', error: 'Text is required' };

    const maxLength = (params.max_length as number) || 200;
    const focus = (params.focus as string) || '';

    // Truncate input to avoid token overflow
    const inputText = text.length > 12000 ? text.slice(0, 12000) + '\n... [truncated]' : text;

    const systemPrompt = `You are a precise text summarizer. Produce a concise summary of the given text.
Rules:
- Target approximately ${maxLength} words.
- Preserve key facts, numbers, names, and conclusions.
- Do not add information not present in the source.
- Use plain text, no markdown formatting.
${focus ? `- Focus specifically on: ${focus}` : ''}`;

    try {
      const summary = await askClaude(systemPrompt, inputText, Math.min(maxLength * 3, 1000));
      if (!summary) {
        return { success: false, data: '', error: 'LLM returned no response' };
      }
      return { success: true, data: summary };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
