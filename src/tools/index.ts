import { toolRegistry } from './adapter';
import { graphSearchTool } from './graph-search';
import { graphAddTool } from './graph-add';

// New tools
import { webSearchTool } from './web-search';
import { patentSearchTool } from './patent-search';
import { arxivSearchTool } from './arxiv-search';
import { webReaderTool } from './web-reader';
import { pdfToMarkdownTool } from './pdf-to-markdown';
import { embeddingsIngestTool } from './embeddings-ingest';
import { sessionSearchTool } from './session-search';
import { academicSearchTool } from './academic-search';
import { wikipediaLookupTool } from './wikipedia-lookup';
import { textSummarizerTool } from './text-summarizer';
import { extractStructuredDataTool } from './extract-structured';

export function registerBuiltInTools(): void {
  // Knowledge graph tools (existing)
  toolRegistry.register(graphSearchTool);
  toolRegistry.register(graphAddTool);

  // Local tools (no external API calls)
  toolRegistry.register(sessionSearchTool);
  toolRegistry.register(textSummarizerTool);
  toolRegistry.register(extractStructuredDataTool);
  toolRegistry.register(embeddingsIngestTool);

  // External search tools (IPC-proxied)
  toolRegistry.register(webSearchTool);
  toolRegistry.register(patentSearchTool);
  toolRegistry.register(arxivSearchTool);
  toolRegistry.register(academicSearchTool);
  toolRegistry.register(wikipediaLookupTool);

  // External content tools (IPC-proxied)
  toolRegistry.register(webReaderTool);
  toolRegistry.register(pdfToMarkdownTool);
}

export { toolRegistry } from './adapter';
