// ============================================================================
// The Wall — Document Card Helpers
// ============================================================================
// Tag-based classification for document/chunk/manual cards in the Context col.
// Document cards show a file entry; chunk cards are hidden but searchable.

import type { Card } from '@/types';

/** True if this card represents an uploaded file (has `doc:true` tag). */
export const isDocumentCard = (card: Card): boolean =>
  card.userTags.some((t) => t === 'doc:true');

/** True if this card is a text chunk belonging to a document. */
export const isChunkCard = (card: Card): boolean =>
  card.userTags.some((t) => t.startsWith('parentDoc:'));

/** Return the parent document card ID, or null. */
export const getParentDocId = (card: Card): string | null => {
  const tag = card.userTags.find((t) => t.startsWith('parentDoc:'));
  return tag ? tag.slice('parentDoc:'.length) : null;
};

/** Return array of chunk card IDs stored on a document card. */
export const getChunkIds = (card: Card): string[] => {
  const tag = card.userTags.find((t) => t.startsWith('chunks:'));
  return tag ? tag.slice('chunks:'.length).split(',').filter(Boolean) : [];
};

/** Return original file path stored on a document card. */
export const getFilePath = (card: Card): string | null => {
  const tag = card.userTags.find((t) => t.startsWith('filepath:'));
  return tag ? tag.slice('filepath:'.length) : null;
};

/** Return the file name from tags. */
export const getFileName = (card: Card): string | null => {
  const tag = card.userTags.find((t) => t.startsWith('file:'));
  return tag ? tag.slice('file:'.length) : null;
};

const EXT_MAP: Record<string, string> = {
  pdf: 'PDF',
  csv: 'CSV',
  md: 'Markdown',
  txt: 'Text',
};

/** Map a file name to a human-readable type string. */
export const getFileType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXT_MAP[ext] || ext.toUpperCase();
};

/** File-type emoji icon. */
export const FILE_ICONS: Record<string, string> = {
  pdf: '\uD83D\uDCC4',
  csv: '\uD83D\uDCCA',
  md: '\uD83D\uDCDD',
  txt: '\uD83D\uDCC3',
};

export const getFileIcon = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || '\uD83D\uDCC4';
};
