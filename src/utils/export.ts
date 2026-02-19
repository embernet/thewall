import { now } from '@/utils/ids';
import type { Session, Column, Card, AgentTask } from '@/types';

// ---------------------------------------------------------------------------
// Types describing the session state shape used by export functions.
// ---------------------------------------------------------------------------

export interface ExportState {
  session: Session;
  columns: Column[];
  cards: Card[];
  speakerColors?: Record<string, string>;
  agentTasks?: AgentTask[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Trigger a browser download for a Blob */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Sanitise a string for use in a filename */
function safeName(raw: string): string {
  return (raw || 'session').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
}

/** Escape a value for CSV (double-quote wrapping) */
function csvEscape(s: string | undefined | null): string {
  return '"' + (s || '').replace(/"/g, '""') + '"';
}

/**
 * Filter cards for a column matching the UI's visible-card logic.
 * - Always excludes deleted cards.
 * - For transcript columns, also excludes cards tagged 'transcript:processed'
 *   (raw cards consumed by the pipeline and hidden in the UI).
 */
export function filterVisibleCards(cards: Card[], col: Column): Card[] {
  return cards.filter((c) => {
    if (c.columnId !== col.id) return false;
    if (c.isDeleted) return false;
    if (col.type === 'transcript' && c.userTags.includes('transcript:processed')) return false;
    return true;
  });
}

/** Format a card number for display: R-prefix for raw transcript, # for everything else. */
function fmtCardNum(card: Card): string {
  if (card.cardNumber == null) return '';
  const prefix = card.userTags.includes('transcript:raw') ? 'R' : '#';
  return prefix + card.cardNumber;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export the session as a human-readable Markdown file and trigger download.
 */
export function exportSessionMarkdown(state: ExportState): void {
  if (!state?.session) return;

  let md = '# ' + state.session.title + '\n\n';
  md +=
    '**Mode:** ' +
    state.session.mode +
    ' | **Created:** ' +
    new Date(state.session.createdAt).toLocaleString() +
    '\n\n---\n\n';

  const visCols = (state.columns || [])
    .filter((c) => c.visible && c.type !== 'trash' && c.type !== 'agent_queue')
    .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));

  for (const col of visCols) {
    const colCards = filterVisibleCards(state.cards || [], col)
      .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
    if (colCards.length === 0) continue;

    md += '## ' + col.title + ' (' + colCards.length + ')\n\n';
    for (const card of colCards) {
      const num = fmtCardNum(card);
      const numStr = num ? num + ' ' : '';
      const prefix = card.speaker ? '**' + card.speaker + ':** ' : '';
      const agent = card.sourceAgentName ? ' _(' + card.sourceAgentName + ')_' : '';
      md += '- ' + numStr + prefix + card.content + agent + '\n';
    }
    md += '\n';
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  triggerDownload(blob, 'thewall_' + safeName(state.session.title) + '.md');
}

/**
 * Export the session as a CSV file and trigger download.
 */
export function exportSessionCSV(state: ExportState): void {
  if (!state?.session) return;

  const rows: string[][] = [
    ['Card #', 'Column', 'Speaker', 'Source', 'Agent', 'Content', 'Highlighted', 'Created'],
  ];

  const sortedCols = (state.columns || []).sort((a, b) =>
    (a.sortOrder || '').localeCompare(b.sortOrder || ''),
  );

  for (const col of sortedCols) {
    const colCards = filterVisibleCards(state.cards || [], col)
      .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
    for (const card of colCards) {
      rows.push([
        fmtCardNum(card),
        csvEscape(col.title),
        csvEscape(card.speaker),
        csvEscape(card.source),
        csvEscape(card.sourceAgentName),
        csvEscape(card.content),
        card.highlightedBy || 'none',
        card.createdAt || '',
      ]);
    }
  }

  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  triggerDownload(blob, 'thewall_' + safeName(state.session.title) + '.csv');
}

/**
 * Download an arbitrary data object as a pretty-printed JSON file.
 */
export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

/**
 * Export the full session state as a re-importable JSON file
 * with _format metadata.
 */
export function exportSessionToFile(state: ExportState): void {
  if (!state?.session) return;

  const data = {
    _format: 'the-wall-session',
    _version: 1,
    _exportedAt: now(),
    session: state.session,
    columns: state.columns,
    cards: state.cards,
    speakerColors: state.speakerColors || {},
    agentTasks: state.agentTasks || [],
  };

  const name = safeName(state.session.title);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadJSON(data, 'thewall_' + name + '_' + dateSuffix + '.json');
}

/**
 * Export the session as a re-importable JSON file, but without the raw
 * transcript cards that were consumed during processing. This produces a
 * smaller file that keeps only the cards actually displayed in the UI.
 */
export function exportSessionToFileCompact(state: ExportState): void {
  if (!state?.session) return;

  const filteredCards = state.cards.filter(
    (c) => !c.userTags.includes('transcript:raw') && !c.userTags.includes('transcript:processed'),
  );

  const data = {
    _format: 'the-wall-session',
    _version: 1,
    _exportedAt: now(),
    session: state.session,
    columns: state.columns,
    cards: filteredCards,
    speakerColors: state.speakerColors || {},
    agentTasks: state.agentTasks || [],
  };

  const name = safeName(state.session.title);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadJSON(data, 'thewall_' + name + '_compact_' + dateSuffix + '.json');
}

/**
 * Export the session as a self-contained HTML file and trigger download.
 */
export function exportSessionHTML(state: ExportState): void {
  if (!state?.session) return;

  const visCols = (state.columns || [])
    .filter(c => c.visible && c.type !== 'trash' && c.type !== 'agent_queue')
    .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));

  let body = '';
  for (const col of visCols) {
    const colCards = filterVisibleCards(state.cards || [], col)
      .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
    if (colCards.length === 0) continue;

    body += `<section class="column"><h2>${esc(col.title)} <span class="count">(${colCards.length})</span></h2>`;
    for (const card of colCards) {
      const cn = fmtCardNum(card);
      const num = cn ? `<span class="card-num">${cn}</span>` : '';
      const spk = card.speaker ? `<span class="speaker">${esc(card.speaker)}</span>` : '';
      const agent = card.sourceAgentName ? `<span class="agent">${esc(card.sourceAgentName)}</span>` : '';
      body += `<div class="card">${num}${spk}<p>${esc(card.content)}</p>${agent}</div>`;
    }
    body += '</section>';
  }

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(state.session.title)} — The Wall</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem}
h1{font-size:1.4rem;margin-bottom:.5rem;background:linear-gradient(135deg,#6366f1,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.meta{font-size:.75rem;color:#64748b;margin-bottom:2rem}
.columns{display:flex;gap:1rem;overflow-x:auto;padding-bottom:1rem}
.column{min-width:300px;max-width:350px;flex-shrink:0;background:#1e293b;border-radius:12px;padding:1rem;border:1px solid #334155}
h2{font-size:.85rem;margin-bottom:.75rem;color:#94a3b8}.count{font-size:.7rem;color:#475569}
.card{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:.6rem;margin-bottom:.5rem;font-size:.8rem;line-height:1.4}
.card-num{display:inline-block;font-size:.6rem;font-family:monospace;color:#64748b;margin-bottom:.25rem;margin-right:.4rem}
.speaker{display:inline-block;font-size:.65rem;font-weight:700;color:#f59e0b;margin-bottom:.25rem}
.agent{display:block;font-size:.6rem;color:#06b6d4;margin-top:.25rem}
@media(prefers-color-scheme:light){body{background:#f8fafc;color:#1e293b}.column{background:#fff;border-color:#e2e8f0}.card{background:#f1f5f9;border-color:#e2e8f0}}
</style></head><body>
<h1>${esc(state.session.title)}</h1>
<div class="meta">Mode: ${state.session.mode} | Created: ${new Date(state.session.createdAt).toLocaleString()} | Exported: ${new Date().toLocaleString()}</div>
<div class="columns">${body}</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  triggerDownload(blob, 'thewall_' + safeName(state.session.title) + '.html');
}

/**
 * Export as Obsidian-compatible markdown with [[wiki-links]] and frontmatter.
 */
export function exportSessionObsidian(state: ExportState): void {
  if (!state?.session) return;

  let md = '---\n';
  md += `title: "${state.session.title}"\n`;
  md += `mode: ${state.session.mode}\n`;
  md += `created: ${state.session.createdAt}\n`;
  md += `tags: [the-wall, ${state.session.mode}]\n`;
  md += '---\n\n';
  md += '# ' + state.session.title + '\n\n';

  const visCols = (state.columns || [])
    .filter(c => c.visible && c.type !== 'trash' && c.type !== 'agent_queue')
    .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));

  // Collect all concepts for wiki-linking
  const conceptCol = state.columns.find(c => c.type === 'concepts');
  const concepts = conceptCol
    ? filterVisibleCards(state.cards || [], conceptCol).map(c => c.content)
    : [];

  for (const col of visCols) {
    const colCards = filterVisibleCards(state.cards || [], col)
      .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
    if (colCards.length === 0) continue;

    md += '## ' + col.title + '\n\n';
    for (const card of colCards) {
      let content = card.content;
      // Add wiki-links for concepts
      for (const concept of concepts) {
        if (content.includes(concept) && content !== concept) {
          content = content.replace(concept, `[[${concept}]]`);
        }
      }
      const cn = fmtCardNum(card);
      const numStr = cn ? cn + ' ' : '';
      const prefix = card.speaker ? `**${card.speaker}:** ` : '';
      const tags = card.aiTags?.length ? ' ' + card.aiTags.map(t => `#${t.replace(/\s/g, '-')}`).join(' ') : '';
      md += `- ${numStr}${prefix}${content}${tags}\n`;
    }
    md += '\n';
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  triggerDownload(blob, 'thewall_' + safeName(state.session.title) + '_obsidian.md');
}

/** HTML-escape helper */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Open a file-picker for a .json file and return its parsed contents.
 * Rejects if the user cancels or the file is not valid JSON.
 */
export function readFileAsJSON<T = unknown>(): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          resolve(JSON.parse(ev.target?.result as string) as T);
        } catch (err) {
          reject(new Error('Invalid JSON: ' + (err as Error).message));
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    };
    input.click();
  });
}
