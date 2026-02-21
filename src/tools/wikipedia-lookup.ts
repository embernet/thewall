import type { Tool, ToolResult } from './adapter';

// ---------------------------------------------------------------------------
// Wikipedia Lookup Tool — Wikipedia article search and summary via IPC proxy
// ---------------------------------------------------------------------------

export const wikipediaLookupTool: Tool = {
  manifest: {
    id: 'wikipedia_lookup',
    name: 'Wikipedia Lookup',
    description: 'Look up a topic on Wikipedia. Returns article title, summary extract, and URL. Fast, free baseline for fact-checking.',
    parameters: [
      { name: 'query', type: 'string', description: 'Topic to look up on Wikipedia', required: true },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const query = (params.query as string || '').trim();
    if (!query) return { success: false, data: '', error: 'Query is required' };

    if (!window.electronAPI?.tools?.wikipediaLookup) {
      return { success: false, data: '', error: 'Wikipedia lookup IPC not available' };
    }

    try {
      const response = await window.electronAPI.tools.wikipediaLookup(query);
      if (response.error) {
        return { success: false, data: '', error: response.error };
      }
      if (!response.result) {
        return { success: true, data: `No Wikipedia article found for: ${query}` };
      }

      const { title, extract, url } = response.result;
      return {
        success: true,
        data: `Wikipedia: ${title}\nURL: ${url}\n\n${extract}`,
      };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
