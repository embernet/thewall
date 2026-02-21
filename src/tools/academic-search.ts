import type { Tool, ToolResult } from './adapter';

// ---------------------------------------------------------------------------
// Academic Search Tool — Semantic Scholar paper search via IPC proxy
// ---------------------------------------------------------------------------

export const academicSearchTool: Tool = {
  manifest: {
    id: 'academic_search',
    name: 'Academic Search',
    description: 'Search Semantic Scholar for academic papers. Returns titles, authors, abstracts, citation counts, and URLs. Free, no API key required.',
    parameters: [
      { name: 'query', type: 'string', description: 'Academic search query', required: true },
      { name: 'num_results', type: 'number', description: 'Number of results (default 5, max 20)' },
      { name: 'year_from', type: 'number', description: 'Only return papers from this year onward' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const query = (params.query as string || '').trim();
    if (!query) return { success: false, data: '', error: 'Query is required' };

    const numResults = Math.min((params.num_results as number) || 5, 20);
    const yearFrom = params.year_from as number | undefined;

    if (!window.electronAPI?.tools?.searchAcademic) {
      return { success: false, data: '', error: 'Academic search IPC not available' };
    }

    try {
      const response = await window.electronAPI.tools.searchAcademic(query, numResults, yearFrom);
      if (response.error) {
        return { success: false, data: '', error: response.error };
      }
      if (response.results.length === 0) {
        return { success: true, data: 'No academic papers found.' };
      }
      const lines = response.results.map((r, i) => {
        const parts = [`${i + 1}. ${r.title}`];
        if (r.authors) parts.push(`   Authors: ${r.authors}`);
        if (r.year) parts.push(`   Year: ${r.year}`);
        if (r.venue) parts.push(`   Venue: ${r.venue}`);
        if (r.citationCount) parts.push(`   Citations: ${r.citationCount}`);
        if (r.url) parts.push(`   URL: ${r.url}`);
        if (r.abstract) parts.push(`   Abstract: ${r.abstract.slice(0, 300)}${r.abstract.length > 300 ? '...' : ''}`);
        return parts.join('\n');
      });
      return { success: true, data: lines.join('\n\n') };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
