// ============================================================================
// The Wall -- File Processing IPC Handlers (Context Column)
// ============================================================================

import { ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';

interface FileChunk {
  content: string;
  fileName: string;
  filePath: string;
  chunkIndex: number;
  totalChunks: number;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFileHandlers(): void {
  ipcMain.handle('file:processContextFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add Context Files',
      filters: [
        { name: 'Documents', extensions: ['pdf', 'csv', 'md', 'txt'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    const allChunks: FileChunk[] = [];

    for (const filePath of result.filePaths) {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      let text = '';

      try {
        if (ext === '.pdf') {
          text = await parsePDF(filePath);
        } else if (ext === '.csv') {
          text = await parseCSV(filePath);
        } else {
          // .md, .txt, or any other text file
          text = fs.readFileSync(filePath, 'utf-8');
        }
      } catch (err) {
        console.error(`Failed to parse ${fileName}:`, err);
        allChunks.push({
          content: `[Error reading ${fileName}: ${(err as Error).message}]`,
          fileName,
          filePath,
          chunkIndex: 0,
          totalChunks: 1,
        });
        continue;
      }

      if (!text.trim()) {
        allChunks.push({
          content: `[${fileName} — empty or unreadable]`,
          fileName,
          filePath,
          chunkIndex: 0,
          totalChunks: 1,
        });
        continue;
      }

      const chunks = chunkText(text, 500, 50);
      for (let i = 0; i < chunks.length; i++) {
        allChunks.push({
          content: chunks[i],
          fileName,
          filePath,
          chunkIndex: i,
          totalChunks: chunks.length,
        });
      }
    }

    return allChunks;
  });

  // Open a file in the system default application
  ipcMain.handle('file:openPath', async (_e, filePath: string) => {
    return shell.openPath(filePath);
  });
}

// ---------------------------------------------------------------------------
// File Parsers
// ---------------------------------------------------------------------------

async function parsePDF(filePath: string): Promise<string> {
  // pdf-parse v2 uses a class-based API: new PDFParse({ data }) → .getText()
  const { PDFParse } = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function parseCSV(filePath: string): Promise<string> {
  const csvModule = require('csv-parse/sync');
  const parse = csvModule.parse || csvModule.default?.parse || csvModule;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const records: string[][] = parse(raw, {
    skip_empty_lines: true,
    relax_column_count: true,
  });
  if (records.length === 0) return '';

  // Convert rows to "Header: Value" text for better semantic embedding
  const headers = records[0];
  const lines: string[] = [];
  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    const parts = row.map((val: string, j: number) => {
      const header = headers[j] || `Col${j}`;
      return `${header}: ${val}`;
    });
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Text Chunking
// ---------------------------------------------------------------------------

/**
 * Split text into chunks of roughly `targetWords` words with `overlapWords`
 * overlap between consecutive chunks for context continuity.
 */
function chunkText(
  text: string,
  targetWords = 500,
  overlapWords = 50,
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  if (words.length <= targetWords) return [words.join(' ')];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + targetWords, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}
