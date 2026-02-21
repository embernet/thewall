import type { Tool, ToolResult } from './adapter';

// ---------------------------------------------------------------------------
// Patent Search Tool — Google Patents via Custom Search IPC proxy
// ---------------------------------------------------------------------------

export const patentSearchTool: Tool = {
  manifest: {
    id: 'patent_search',
    name: 'Patent Search',
    description: 'Search Google Patents for relevant patents. Returns patent titles, URLs, and excerpts.',
    parameters: [
      { name: 'query', type: 'string', description: 'Patent search query (technology, invention, or concept)', required: true },
      { name: 'num_results', type: 'number', description: 'Number of results (default 5, max 10)' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const query = (params.query as string || '').trim();
    if (!query) return { success: false, data: '', error: 'Query is required' };

    const numResults = Math.min((params.num_results as number) || 5, 10);

    if (!window.electronAPI?.tools?.searchPatents) {
      return { success: false, data: '', error: 'Patent search IPC not available' };
    }

    try {
      const response = await window.electronAPI.tools.searchPatents(query, numResults);
      if (response.error) {
        return { success: false, data: '', error: response.error };
      }
      if (response.results.length === 0) {
        return { success: true, data: 'No patent results found.' };
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
