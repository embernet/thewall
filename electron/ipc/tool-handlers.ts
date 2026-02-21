// ============================================================================
// The Wall — IPC Tool Handlers (Electron Main Process)
// ============================================================================
//
// CORS-proxied tool implementations for external API calls.
// These run in the main process to bypass browser CORS restrictions.
// ============================================================================

import { ipcMain, safeStorage } from 'electron';
import { getDatabase } from './database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSearchApiKey(): string | null {
  const db = getDatabase();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM api_keys WHERE slot = ?').get('search') as any;
  if (!row?.encrypted_key) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(row.encrypted_key);
    }
    return row.encrypted_key.toString('utf-8');
  } catch {
    return null;
  }
}

function getSearchEngineId(): string | null {
  const db = getDatabase();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM api_keys WHERE slot = ?').get('search') as any;
  // Store search engine ID in model_id field (reuse existing schema)
  return row?.model_id || null;
}

// ---------------------------------------------------------------------------
// Register all tool IPC handlers
// ---------------------------------------------------------------------------

export function registerToolHandlers(): void {

  // ── Web Search (Google Custom Search API) ───────────────────────────────

  ipcMain.handle('tool:webSearch', async (_e, query: string, numResults = 5) => {
    const apiKey = getSearchApiKey();
    if (!apiKey) return { error: 'No search API key configured. Add a Google Custom Search key in Settings.', results: [] };

    const engineId = getSearchEngineId();
    if (!engineId) return { error: 'No search engine ID configured.', results: [] };

    try {
      const params = new URLSearchParams({
        key: apiKey,
        cx: engineId,
        q: query,
        num: String(Math.min(numResults, 10)),
      });
      const r = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
      if (!r.ok) {
        const err = await r.text().catch(() => r.statusText);
        return { error: `Google Search API error ${r.status}: ${err}`, results: [] };
      }
      const data = await r.json() as {
        items?: Array<{ title: string; link: string; snippet: string }>;
      };
      const results = (data.items ?? []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
      }));
      return { results, error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e), results: [] };
    }
  });

  // ── Patent Search (Google Custom Search, site-restricted to patents.google.com) ──

  ipcMain.handle('tool:searchPatents', async (_e, query: string, numResults = 5) => {
    const apiKey = getSearchApiKey();
    if (!apiKey) return { error: 'No search API key configured.', results: [] };

    const engineId = getSearchEngineId();
    if (!engineId) return { error: 'No search engine ID configured.', results: [] };

    try {
      const params = new URLSearchParams({
        key: apiKey,
        cx: engineId,
        q: query,
        num: String(Math.min(numResults, 10)),
        siteSearch: 'patents.google.com',
        siteSearchFilter: 'i', // include only
      });
      const r = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
      if (!r.ok) {
        const err = await r.text().catch(() => r.statusText);
        return { error: `Google Patents API error ${r.status}: ${err}`, results: [] };
      }
      const data = await r.json() as {
        items?: Array<{ title: string; link: string; snippet: string }>;
      };
      const results = (data.items ?? []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
      }));
      return { results, error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e), results: [] };
    }
  });

  // ── arXiv Search (free, no key) ──────────────────────────────────────────

  ipcMain.handle('tool:searchArxiv', async (_e, query: string, numResults = 5) => {
    try {
      const params = new URLSearchParams({
        search_query: `all:${query}`,
        start: '0',
        max_results: String(Math.min(numResults, 20)),
        sortBy: 'relevance',
        sortOrder: 'descending',
      });
      const r = await fetch(`http://export.arxiv.org/api/query?${params}`, {
        headers: { 'User-Agent': 'TheWall/1.0 (Research Assistant)' },
      });
      if (!r.ok) {
        const err = await r.text().catch(() => r.statusText);
        return { error: `arXiv API error ${r.status}: ${err}`, results: [] };
      }
      const xml = await r.text();

      // Parse Atom XML response
      const entries = xml.split('<entry>').slice(1); // skip header
      const results = entries.map(entry => {
        const get = (tag: string) => {
          const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
          return m ? m[1].trim() : '';
        };
        // Authors: <author><name>...</name></author>
        const authorMatches = [...entry.matchAll(/<author>\s*<name>([^<]*)<\/name>/g)];
        const authors = authorMatches.map(m => m[1].trim()).join(', ');
        // Published date
        const published = get('published').split('T')[0] || '';
        // URL: prefer the abstract link
        const linkMatch = entry.match(/<id>(https?:\/\/arxiv\.org\/abs\/[^<]+)<\/id>/);
        const url = linkMatch ? linkMatch[1] : get('id');
        // Summary (abstract) — clean whitespace
        const summary = get('summary').replace(/\s+/g, ' ').trim();

        return {
          title: get('title').replace(/\s+/g, ' '),
          url,
          authors,
          published,
          summary,
        };
      });
      return { results, error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e), results: [] };
    }
  });

  // ── Academic Search (Semantic Scholar, free, no key) ────────────────────

  ipcMain.handle('tool:searchAcademic', async (_e, query: string, numResults = 5, yearFrom?: number) => {
    try {
      const params = new URLSearchParams({
        query,
        limit: String(Math.min(numResults, 20)),
        fields: 'title,authors,year,abstract,url,citationCount,venue',
      });
      if (yearFrom) {
        params.set('year', `${yearFrom}-`);
      }
      const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!r.ok) {
        const err = await r.text().catch(() => r.statusText);
        return { error: `Semantic Scholar API error ${r.status}: ${err}`, results: [] };
      }
      const data = await r.json() as {
        data?: Array<{
          title: string;
          authors?: Array<{ name: string }>;
          year?: number;
          abstract?: string;
          url?: string;
          citationCount?: number;
          venue?: string;
        }>;
      };
      const results = (data.data ?? []).map(paper => ({
        title: paper.title,
        authors: (paper.authors ?? []).map(a => a.name).join(', '),
        year: paper.year ?? 0,
        abstract: paper.abstract ?? '',
        url: paper.url ?? '',
        citationCount: paper.citationCount ?? 0,
        venue: paper.venue ?? '',
      }));
      return { results, error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e), results: [] };
    }
  });

  // ── Wikipedia Lookup (free, no key) ─────────────────────────────────────

  ipcMain.handle('tool:wikipediaLookup', async (_e, query: string) => {
    try {
      // First search for the best matching article
      const searchParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: '1',
        format: 'json',
      });
      const searchR = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`);
      if (!searchR.ok) {
        return { error: `Wikipedia search error ${searchR.status}`, result: null };
      }
      const searchData = await searchR.json() as {
        query?: { search?: Array<{ title: string }> };
      };
      const firstResult = searchData.query?.search?.[0];
      if (!firstResult) {
        return { error: null, result: null };
      }

      // Fetch summary via REST API
      const title = encodeURIComponent(firstResult.title);
      const summaryR = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
      if (!summaryR.ok) {
        return { error: `Wikipedia summary error ${summaryR.status}`, result: null };
      }
      const summary = await summaryR.json() as {
        title: string;
        extract: string;
        content_urls?: { desktop?: { page?: string } };
      };
      return {
        error: null,
        result: {
          title: summary.title,
          extract: summary.extract || '',
          url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`,
        },
      };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e), result: null };
    }
  });

  // ── Web Reader (fetch URL and extract readable text) ────────────────────

  ipcMain.handle('tool:fetchUrl', async (_e, url: string) => {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'TheWall/1.0 (Research Assistant)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) {
        return { error: `HTTP ${r.status}: ${r.statusText}`, result: null };
      }
      const contentType = r.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
        return { error: `Unsupported content type: ${contentType}`, result: null };
      }
      const html = await r.text();

      // Use @mozilla/readability if available, otherwise do basic extraction
      try {
        const { JSDOM } = await import('jsdom');
        const { Readability } = await import('@mozilla/readability');
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (article) {
          return {
            error: null,
            result: {
              title: article.title,
              content: article.textContent?.trim() ?? '',
              url,
            },
          };
        }
      } catch {
        // Readability not available — fall through to basic extraction
      }

      // Basic HTML-to-text fallback: strip tags
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        error: null,
        result: {
          title: html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? url,
          content: text,
          url,
        },
      };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e), result: null };
    }
  });

  // ── PDF to Markdown (fetch and extract text from PDF) ───────────────────

  ipcMain.handle('tool:fetchPdf', async (_e, url: string) => {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'TheWall/1.0 (Research Assistant)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) {
        return { error: `HTTP ${r.status}: ${r.statusText}`, result: null };
      }
      const buffer = Buffer.from(await r.arrayBuffer());

      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse(new Uint8Array(buffer));
        const textResult = await parser.getText();
        const infoResult = await parser.getInfo();
        await parser.destroy();
        return {
          error: null,
          result: {
            title: (infoResult.info as Record<string, unknown>)?.Title as string || url.split('/').pop() || 'Unknown',
            content: textResult.text || '',
            pageCount: textResult.total || 0,
          },
        };
      } catch {
        return { error: 'pdf-parse not available. Install with: npm install pdf-parse', result: null };
      }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e), result: null };
    }
  });
}
