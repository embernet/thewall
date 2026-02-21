import type { Tool, ToolResult } from './adapter';

// ---------------------------------------------------------------------------
// arXiv Search Tool — Search for academic papers on arXiv.org
// ---------------------------------------------------------------------------

export const arxivSearchTool: Tool = {
  manifest: {
    id: 'arxiv_search',
    name: 'arXiv Search',
    description: 'Search arXiv.org for academic research papers, preprints, and scientific articles. Returns titles, authors, abstracts, and PDF links. Free, no API key required.',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query for papers (supports arXiv query syntax)', required: true },
      { name: 'num_results', type: 'number', description: 'Number of results (default 5, max 20)' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const query = (params.query as string || '').trim();
    if (!query) return { success: false, data: '', error: 'Query is required' };

    const numResults = Math.min((params.num_results as number) || 5, 20);

    if (!window.electronAPI?.tools?.searchArxiv) {
      return { success: false, data: '', error: 'arXiv search IPC not available' };
    }

    try {
      const response = await window.electronAPI.tools.searchArxiv(query, numResults);
      if (response.error) {
        return { success: false, data: '', error: response.error };
      }
      if (response.results.length === 0) {
        return { success: true, data: 'No papers found on arXiv.' };
      }
      const lines = response.results.map((r, i) => {
        const parts = [`${i + 1}. ${r.title}`];
        if (r.authors) parts.push(`   Authors: ${r.authors}`);
        if (r.published) parts.push(`   Published: ${r.published}`);
        parts.push(`   URL: ${r.url}`);
        if (r.summary) parts.push(`   Abstract: ${r.summary.slice(0, 300)}${r.summary.length > 300 ? '...' : ''}`);
        return parts.join('\n');
      });
      return { success: true, data: lines.join('\n\n') };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
