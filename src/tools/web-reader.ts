import type { Tool, ToolResult } from './adapter';

// ---------------------------------------------------------------------------
// Web Reader Tool — Fetch and extract readable content from a URL
// ---------------------------------------------------------------------------

export const webReaderTool: Tool = {
  manifest: {
    id: 'web_reader',
    name: 'Web Reader',
    description: 'Fetch a web page and extract its readable text content. Uses Mozilla Readability for clean extraction.',
    parameters: [
      { name: 'url', type: 'string', description: 'URL of the web page to read', required: true },
      { name: 'max_chars', type: 'number', description: 'Maximum characters to return (default 8000)' },
    ],
  },
  async execute(params): Promise<ToolResult> {
    const url = (params.url as string || '').trim();
    if (!url) return { success: false, data: '', error: 'URL is required' };

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return { success: false, data: '', error: `Invalid URL: ${url}` };
    }

    const maxChars = (params.max_chars as number) || 8000;

    if (!window.electronAPI?.tools?.fetchUrl) {
      return { success: false, data: '', error: 'Web reader IPC not available' };
    }

    try {
      const response = await window.electronAPI.tools.fetchUrl(url);
      if (response.error) {
        return { success: false, data: '', error: response.error };
      }
      if (!response.result) {
        return { success: true, data: 'No content extracted from the page.' };
      }

      let content = response.result.content;
      if (content.length > maxChars) {
        content = content.slice(0, maxChars) + `\n... [truncated, ${content.length - maxChars} chars omitted]`;
      }

      return {
        success: true,
        data: `Title: ${response.result.title}\nURL: ${response.result.url}\n\n${content}`,
      };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
