import type { Tool, ToolResult } from './adapter';

// ---------------------------------------------------------------------------
// Web Search Tool — Google Custom Search via IPC proxy
// ---------------------------------------------------------------------------

export const webSearchTool: Tool = {
  manifest: {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the web using Google Custom Search. Returns titles, URLs, and snippets for the top results.',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'num_results', type: 'number', description: 'Number of results (default 5, max 10)' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const query = (params.query as string || '').trim();
    if (!query) return { success: false, data: '', error: 'Query is required' };

    const numResults = Math.min((params.num_results as number) || 5, 10);

    if (!window.electronAPI?.tools?.webSearch) {
      return { success: false, data: '', error: 'Web search IPC not available' };
    }

    try {
      const response = await window.electronAPI.tools.webSearch(query, numResults);
      if (response.error) {
        return { success: false, data: '', error: response.error };
      }
      if (response.results.length === 0) {
        return { success: true, data: 'No results found.' };
      }
      const lines = response.results.map((r, i) =>
        `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`,
      );
      return { success: true, data: lines.join('\n\n') };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
