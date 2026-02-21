import type { Tool, ToolResult } from './adapter';
import { askClaude } from '@/utils/llm';

// ---------------------------------------------------------------------------
// Extract Structured Data Tool — LLM-powered fact/entity extraction
// ---------------------------------------------------------------------------

export const extractStructuredDataTool: Tool = {
  manifest: {
    id: 'extract_structured_data',
    name: 'Extract Structured Data',
    description: 'Extract structured facts, entities, claims, or relationships from text. Use this to pull specific information from fetched web content or PDFs.',
    parameters: [
      { name: 'text', type: 'string', description: 'Source text to extract from', required: true },
      { name: 'schema', type: 'string', description: 'What to extract (e.g. "claims with evidence", "entities and relationships", "statistics with sources", "key findings")', required: true },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const text = (params.text as string || '').trim();
    if (!text) return { success: false, data: '', error: 'Text is required' };

    const schema = (params.schema as string || '').trim();
    if (!schema) return { success: false, data: '', error: 'Schema description is required' };

    // Truncate input to avoid token overflow
    const inputText = text.length > 12000 ? text.slice(0, 12000) + '\n... [truncated]' : text;

    const systemPrompt = `You are a precise information extractor. Extract structured data from the given text.

EXTRACTION TARGET: ${schema}

Rules:
- Only extract what is explicitly stated in the text. Do not infer or speculate.
- Output one item per line in the format: TYPE: content [source: brief citation if available]
- Use these TYPEs based on what you find: CLAIM, FACT, ENTITY, STATISTIC, FINDING, RELATIONSHIP, EVIDENCE
- If the text contains no relevant items, output "No relevant items found."
- Be precise and concise — each item should be self-contained.`;

    try {
      const result = await askClaude(systemPrompt, inputText, 800);
      if (!result) {
        return { success: false, data: '', error: 'LLM returned no response' };
      }
      return { success: true, data: result };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
