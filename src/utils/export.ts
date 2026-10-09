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
      const agent = card.sourceAgentName ? '**' + card.sourceAgentName + ':** ' : '';
      md += '- ' + numStr + agent + prefix + card.content + '\n';
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
      body += `<div class="card">${num}${agent}${spk}<p>${esc(card.content)}</p></div>`;
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

/**
 * Compute word-level Jaccard similarity between two strings.
 */
function textSimilarity(a: string, b: string): number {
  const cleanA = a.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const cleanB = b.toLowerCase().replace(/[^\w\s]/g, '').trim();
  if (!cleanA || !cleanB) return 0;
  if (cleanA === cleanB) return 1.0;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    const minLen = Math.min(cleanA.length, cleanB.length);
    const maxLen = Math.max(cleanA.length, cleanB.length);
    if (minLen / maxLen > 0.75) return 0.9;
  }

  const wordsA = new Set(cleanA.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(cleanB.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Clean and normalize card text for summary inclusion.
 */
function cleanCardContent(text: string): string {
  let cleaned = (text || '').trim();
  // Strip (Source: Tool) or (Source: ...)
  cleaned = cleaned.replace(/\s*\(Source:\s*[^)]+\)/gi, '');
  // Format Knowledge Graph arrows "A -> B -> C" into natural sentences
  if (cleaned.includes('→') || cleaned.includes('->')) {
    const parts = cleaned.split(/\s*(?:→|->)\s*/);
    if (parts.length === 3) {
      cleaned = `${parts[0]} ${parts[1]} ${parts[2]}.`;
    }
  }
  return cleaned;
}

/** Helper for basic inline formatting (bold, italic, code, links) */
function formatInline(str: string): string {
  return esc(str)
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Generate a cohesive, deduplicated, and transformed Markdown summary of the session.
 */
export function generateStructuredSummaryMarkdown(state: ExportState): string {
  if (!state?.session) return '';

  const { session, columns = [], cards = [] } = state;
  const visCols = columns
    .filter((c) => c.visible && c.type !== 'trash' && c.type !== 'agent_queue')
    .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));

  let md = `# ${session.title}\n\n`;
  md += `**Session Mode:** ${session.mode || 'standard'} | **Created:** ${new Date(session.createdAt).toLocaleDateString()} | **Exported:** ${new Date().toLocaleDateString()}\n\n`;
  md += `---\n\n`;

  // Executive Overview
  md += `### Executive Overview\n\n`;
  if (session.goal?.trim()) {
    md += `${session.goal.trim()}\n\n`;
  } else {
    const colNames = visCols.map((c) => c.title).join(', ');
    md += `This document provides a synthesized, deduplicated summary of the session "${session.title}". It brings together the complete transcript of discussions alongside thematic analyses across key areas: ${colNames}.\n\n`;
  }
  md += `---\n\n`;

  let sectionIdx = 1;
  for (const col of visCols) {
    const summaryText = typeof col.config?.summary === 'string' ? col.config.summary.trim() : '';
    const colCards = filterVisibleCards(cards, col).sort((a, b) =>
      (a.sortOrder || '').localeCompare(b.sortOrder || ''),
    );
    if (colCards.length === 0 && !summaryText) continue;

    md += `## ${sectionIdx}. ${col.title}\n\n`;
    sectionIdx++;

    // Include Column Config Summary if available
    if (summaryText) {
      md += `### Column Summary\n\n> ${summaryText}\n\n`;
    }

    if (col.type === 'transcript') {
      md += `### Conversation Dialogue\n\n`;
      let prevSpeaker = '';
      let prevText = '';

      for (const card of colCards) {
        const text = card.content.trim();
        const speaker = card.speaker?.trim() || 'Speaker';
        if (text === prevText && speaker === prevSpeaker) continue;

        md += `**${speaker}:** ${text}\n\n`;
        prevSpeaker = speaker;
        prevText = text;
      }
    } else if (col.type === 'artefacts') {
      md += `### Curated Reference Artefacts\n\n`;
      const seenQueries = new Set<string>();

      for (const card of colCards) {
        const content = card.content.trim();
        const queryMatch = content.match(/Query:\s*([^\n\r]+)/i);
        const queryKey = queryMatch ? queryMatch[1].trim().toLowerCase() : content.slice(0, 80).toLowerCase();

        if (seenQueries.has(queryKey)) continue;
        seenQueries.add(queryKey);

        if (content.startsWith('**') || content.startsWith('#')) {
          md += `${content}\n\n`;
        } else {
          md += `- ${content}\n\n`;
        }
      }
    } else {
      md += `### Key Elements & Thematic Synthesis\n\n`;
      const acceptedCards: string[] = [];

      for (const card of colCards) {
        const cleanText = cleanCardContent(card.content);
        if (!cleanText || cleanText.length < 5) continue;

        let isDuplicate = false;
        for (const existing of acceptedCards) {
          if (textSimilarity(cleanText, existing) > 0.60) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) continue;
        acceptedCards.push(cleanText);

        md += `${cleanText}\n\n`;
      }
    }

    md += `---\n\n`;
  }

  md += `*Document generated by The Wall with multi-agent deduplication, thematic synthesis, and full dialogue preservation.*\n`;
  return md;
}

/**
 * Export the session as a synthesized, deduplicated Markdown summary document.
 */
export function exportSessionStructuredMarkdown(state: ExportState): void {
  if (!state?.session) return;
  const md = generateStructuredSummaryMarkdown(state);
  const blob = new Blob([md], { type: 'text/markdown' });
  triggerDownload(blob, 'thewall_' + safeName(state.session.title) + '_summary.md');
}

/**
 * Convert Markdown text to styled print-ready HTML for PDF rendering.
 */
export function generateStructuredSummaryHTML(state: ExportState): string {
  if (!state?.session) return '';

  const md = generateStructuredSummaryMarkdown(state);

  // Convert structured markdown lines into HTML
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inBlockquote = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle horizontal rule
    if (line.trim() === '---') {
      if (inList) { html += '</ul>\n'; inList = false; }
      if (inBlockquote) { html += '</blockquote>\n'; inBlockquote = false; }
      html += '<hr />\n';
      continue;
    }

    // Handle blockquote
    if (line.startsWith('> ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      if (!inBlockquote) {
        html += '<blockquote>\n';
        inBlockquote = true;
      }
      const bqContent = line.slice(2).trim();
      html += `<p>${formatInline(bqContent)}</p>\n`;
      continue;
    } else if (inBlockquote) {
      html += '</blockquote>\n';
      inBlockquote = false;
    }

    // Handle headers
    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<h1>${formatInline(line.slice(2))}</h1>\n`;
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<h2>${formatInline(line.slice(3))}</h2>\n`;
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<h3>${formatInline(line.slice(4))}</h3>\n`;
      continue;
    }

    // Handle list items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        html += '<ul>\n';
        inList = true;
      }
      html += `<li>${formatInline(line.slice(2))}</li>\n`;
      continue;
    } else if (inList && line.trim() === '') {
      html += '</ul>\n';
      inList = false;
      continue;
    }

    // Handle blank lines
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraphs
    const pContent = formatInline(line.trim());
    html += `<p>${pContent}</p>\n`;
  }

  if (inList) html += '</ul>\n';
  if (inBlockquote) html += '</blockquote>\n';

  // Replace speaker patterns with styled badges
  html = html.replace(
    /<strong>([^:]+):<\/strong>/g,
    (_match, spk) => {
      const spkLower = spk.toLowerCase();
      let badgeClass = 'speaker-badge';
      if (spkLower.includes('karima')) badgeClass += ' speaker-karima';
      else if (spkLower.includes('mark')) badgeClass += ' speaker-mark';
      return `<span class="${badgeClass}">${esc(spk)}</span>`;
    }
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(state.session.title)}</title>
<style>
  @page {
    size: A4;
    margin: 20mm 18mm 20mm 18mm;
    @bottom-right {
      content: counter(page);
    }
  }

  *, *:before, *:after {
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: #1e293b;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
  }

  h1 {
    font-size: 18pt;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.25;
    margin-top: 0;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #1e3a8a;
    border-bottom: 1.5px solid #cbd5e1;
    padding-bottom: 4px;
    margin-top: 24px;
    margin-bottom: 10px;
    page-break-after: avoid;
    break-after: avoid;
  }

  h3 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #334155;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
    break-after: avoid;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  p {
    margin-top: 0;
    margin-bottom: 10px;
    text-align: justify;
  }

  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 16px 0;
  }

  blockquote {
    background-color: #f1f5f9;
    border-left: 4px solid #6366f1;
    margin: 8px 0 14px 0;
    padding: 10px 14px;
    color: #334155;
    font-style: italic;
    font-size: 9.5pt;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  blockquote p {
    margin: 0;
  }

  .speaker-badge {
    display: inline-block;
    font-weight: 700;
    font-size: 8.5pt;
    padding: 2px 7px;
    border-radius: 4px;
    margin-right: 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    vertical-align: baseline;
    background-color: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
  }

  .speaker-karima {
    background-color: #e0e7ff;
    color: #3730a3;
    border-color: #c7d2fe;
  }

  .speaker-mark {
    background-color: #d1fae5;
    color: #065f46;
    border-color: #a7f3d0;
  }

  ul, ol {
    margin-top: 4px;
    margin-bottom: 10px;
    padding-left: 20px;
  }

  li {
    margin-bottom: 4px;
  }

  p, li {
    page-break-inside: auto;
  }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Export the session as a styled PDF document.
 * In Electron, saves to disk via native dialog and printToPDF.
 * In Web, opens styled print view and triggers window.print().
 */
export async function exportSessionPDF(state: ExportState): Promise<void> {
  if (!state?.session) return;
  const html = generateStructuredSummaryHTML(state);
  const defaultName = 'thewall_' + safeName(state.session.title) + '_summary.pdf';

  if (window.electronAPI?.exportPDF) {
    try {
      const res = await window.electronAPI.exportPDF(html, defaultName);
      if (res.success && res.filePath) {
        console.log('PDF exported successfully to:', res.filePath);
      }
    } catch (err) {
      console.error('Electron PDF export failed:', err);
    }
  } else {
    // Browser fallback: open print-ready window and trigger print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } else {
      // If popup blocked, download as printable HTML
      const blob = new Blob([html], { type: 'text/html' });
      triggerDownload(blob, 'thewall_' + safeName(state.session.title) + '_printable.html');
    }
  }
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
