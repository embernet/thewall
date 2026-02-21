import type { Tool, ToolResult } from './adapter';

// ---------------------------------------------------------------------------
// PDF to Markdown Tool — Fetch and extract text from PDF files
// ---------------------------------------------------------------------------

export const pdfToMarkdownTool: Tool = {
  manifest: {
    id: 'pdf_to_markdown',
    name: 'PDF to Markdown',
    description: 'Fetch a PDF file from a URL and extract its text content. Useful for reading research papers, reports, and documents.',
    parameters: [
      { name: 'url', type: 'string', description: 'URL of the PDF file to process', required: true },
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

    if (!window.electronAPI?.tools?.fetchPdf) {
      return { success: false, data: '', error: 'PDF reader IPC not available' };
    }

    try {
      const response = await window.electronAPI.tools.fetchPdf(url);
      if (response.error) {
        return { success: false, data: '', error: response.error };
      }
      if (!response.result) {
        return { success: true, data: 'No content extracted from the PDF.' };
      }

      let content = response.result.content;
      if (content.length > maxChars) {
        content = content.slice(0, maxChars) + `\n... [truncated, ${content.length - maxChars} chars omitted]`;
      }

      return {
        success: true,
        data: `Title: ${response.result.title}\nPages: ${response.result.pageCount}\n\n${content}`,
      };
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  },
};
