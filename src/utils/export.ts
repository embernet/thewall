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
    const colCards = (state.cards || [])
      .filter((c) => c.columnId === col.id && !c.isDeleted)
      .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
    if (colCards.length === 0) continue;

    md += '## ' + col.title + ' (' + colCards.length + ')\n\n';
    for (const card of colCards) {
      const prefix = card.speaker ? '**' + card.speaker + ':** ' : '';
      const agent = card.sourceAgentName ? ' _(' + card.sourceAgentName + ')_' : '';
      md += '- ' + prefix + card.content + agent + '\n';
    }
    md += '\n';
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  triggerDownload(blob, 'wall_' + safeName(state.session.title) + '.md');
}

/**
 * Export the session as a CSV file and trigger download.
 */
export function exportSessionCSV(state: ExportState): void {
  if (!state?.session) return;

  const rows: string[][] = [
    ['Column', 'Speaker', 'Source', 'Agent', 'Content', 'Highlighted', 'Created'],
  ];

  const sortedCols = (state.columns || []).sort((a, b) =>
    (a.sortOrder || '').localeCompare(b.sortOrder || ''),
  );

  for (const col of sortedCols) {
    const colCards = (state.cards || [])
      .filter((c) => c.columnId === col.id && !c.isDeleted)
      .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));
    for (const card of colCards) {
      rows.push([
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
  triggerDownload(blob, 'wall_' + safeName(state.session.title) + '.csv');
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
  downloadJSON(data, 'wall_' + name + '_' + dateSuffix + '.json');
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
