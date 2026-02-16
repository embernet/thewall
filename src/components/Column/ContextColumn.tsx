// ============================================================================
// The Wall — Context Column (documents + manual text)
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import type { Column, Card as CardType, FileChunk } from '@/types';
import { useSessionStore } from '@/store/session';
import { uid, now, mid } from '@/utils/ids';
import { getFileType, getFileIcon } from '@/utils/document-cards';
import { bus } from '@/events/bus';
import Card from '@/components/Card/Card';

interface ContextColumnProps {
  column: Column;
  cards: CardType[];                // pre-filtered: no chunk cards
  onNavigate?: (cardId: string) => void;
}

const ContextColumn: React.FC<ContextColumnProps> = ({
  column,
  cards,
  onNavigate,
}) => {
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addCard = useSessionStore((s) => s.addCard);
  const deleteCard = useSessionStore((s) => s.deleteCard);
  const toggleHighlight = useSessionStore((s) => s.toggleHighlight);
  const updateCard = useSessionStore((s) => s.updateCard);
  const speakerColors = useSessionStore((s) => s.speakerColors);
  const toggleColumnCollapsed = useSessionStore((s) => s.toggleColumnCollapsed);

  const sorted = [...cards].sort((a, b) =>
    (a.sortOrder || '').localeCompare(b.sortOrder || ''),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [cards.length]);

  // ── Listen for viewChunks events (forwarded from navigateToCard) ──
  useEffect(() => {
    const handler = ({ docCardId }: { docCardId: string; highlightChunkId?: string }) => {
      // Make sure context column is visible + expanded
      const col = useSessionStore.getState().columns.find((c) => c.id === column.id);
      if (col && !col.visible) useSessionStore.getState().toggleColumnVisibility(column.id);
      if (col && col.collapsed) useSessionStore.getState().toggleColumnCollapsed(column.id);

      // Scroll to the document card
      setTimeout(() => {
        const el = document.getElementById('card-' + docCardId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.outline = '2px solid #a855f7';
          el.style.outlineOffset = '2px';
          setTimeout(() => {
            el.style.outline = 'none';
            el.style.outlineOffset = '0';
          }, 2000);
        }
      }, 100);
    };
    bus.on('document:viewChunks', handler);
    return () => { bus.off('document:viewChunks', handler); };
  }, [column.id]);

  // ── Manual text card ──
  const handleAddCard = () => {
    if (!input.trim()) return;
    const last = sorted[sorted.length - 1];
    addCard({
      id: uid(),
      columnId: column.id,
      sessionId: column.sessionId,
      content: input.trim(),
      source: 'user',
      sourceCardIds: [],
      aiTags: [],
      userTags: ['manual'],
      highlightedBy: 'none',
      isDeleted: false,
      createdAt: now(),
      updatedAt: now(),
      sortOrder: last ? mid(last.sortOrder) : 'n',
    });
    setInput('');
  };

  // ── File upload — creates doc card + hidden chunk cards ──
  const handleUpload = async () => {
    if (uploading || !window.electronAPI?.db?.processContextFile) return;
    setUploading(true);
    setUploadStatus('Opening file dialog\u2026');

    try {
      const chunks: FileChunk[] =
        await window.electronAPI.db.processContextFile();

      if (chunks.length === 0) {
        setUploadStatus(null);
        setUploading(false);
        return;
      }

      setUploadStatus(`Processing ${chunks.length} chunks\u2026`);

      // Group chunks by file
      const byFile = new Map<string, { chunks: FileChunk[]; filePath: string }>();
      for (const chunk of chunks) {
        if (!byFile.has(chunk.fileName)) {
          byFile.set(chunk.fileName, { chunks: [], filePath: chunk.filePath });
        }
        byFile.get(chunk.fileName)!.chunks.push(chunk);
      }

      let lastCard = sorted[sorted.length - 1] as CardType | undefined;

      for (const [fileName, { chunks: fileChunks, filePath }] of byFile) {
        const docCardId = uid();
        const chunkCardIds: string[] = [];

        // Create hidden chunk cards
        for (const chunk of fileChunks) {
          const chunkId = uid();
          chunkCardIds.push(chunkId);

          const card: CardType = {
            id: chunkId,
            columnId: column.id,
            sessionId: column.sessionId,
            content: chunk.content,
            source: 'user',
            sourceCardIds: [
              {
                id: docCardId,
                label: fileName,
                icon: getFileIcon(fileName),
                color: '#10b981',
              },
            ],
            aiTags: [],
            userTags: [
              `file:${fileName}`,
              `chunk:${chunk.chunkIndex + 1}/${chunk.totalChunks}`,
              `parentDoc:${docCardId}`,
            ],
            highlightedBy: 'none',
            isDeleted: false,
            createdAt: now(),
            updatedAt: now(),
            sortOrder: lastCard ? mid(lastCard.sortOrder) : 'n',
          };
          addCard(card);
          lastCard = card;
        }

        // Create visible document card
        const fileType = getFileType(fileName);
        const docCard: CardType = {
          id: docCardId,
          columnId: column.id,
          sessionId: column.sessionId,
          content: `${fileName} (${fileType}, ${fileChunks.length} chunk${fileChunks.length !== 1 ? 's' : ''})`,
          source: 'user',
          sourceCardIds: [],
          aiTags: [],
          userTags: [
            'doc:true',
            `file:${fileName}`,
            `filepath:${filePath}`,
            `chunks:${chunkCardIds.join(',')}`,
          ],
          highlightedBy: 'none',
          isDeleted: false,
          createdAt: now(),
          updatedAt: now(),
          sortOrder: lastCard ? mid(lastCard.sortOrder) : 'n',
        };
        addCard(docCard);
        lastCard = docCard;
      }

      setUploadStatus(
        `Added ${byFile.size} document${byFile.size > 1 ? 's' : ''}`,
      );
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      console.error('File upload failed:', err);
      setUploadStatus('Upload failed: ' + (err as Error).message);
      setTimeout(() => setUploadStatus(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  // ── Collapsed view ──
  if (column.collapsed) {
    return (
      <div
        className="flex min-w-[44px] w-[44px] cursor-pointer flex-col items-center border-r border-wall-border bg-wall-surface pt-2.5"
        onClick={() => toggleColumnCollapsed(column.id)}
      >
        <span className="text-sm">{'\uD83D\uDCC2'}</span>
        <span
          className="mt-1.5 text-[10px] text-wall-text-dim"
          style={{ writingMode: 'vertical-rl', letterSpacing: 1 }}
        >
          {column.title}
        </span>
        <span className="mt-[3px] rounded-[7px] bg-wall-border px-1 py-[1px] text-[9px] text-wall-subtle">
          {cards.length}
        </span>
      </div>
    );
  }

  // ── Expanded view ──
  return (
    <div className="flex h-full min-w-[340px] w-[340px] flex-col border-r border-wall-border bg-wall-surface">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-wall-border px-2.5 pt-2 pb-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[5px]">
            <span className="text-sm">{'\uD83D\uDCC2'}</span>
            <span className="text-xs font-semibold text-wall-text">
              Context
            </span>
            <span className="rounded-lg bg-wall-border px-[5px] text-[10px] text-wall-subtle">
              {cards.length}
            </span>
            {uploading && (
              <span className="animate-pulse text-[10px] text-emerald-500">
                {'\u25CF'}
              </span>
            )}
          </div>
          <div className="flex gap-0.5">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="cursor-pointer rounded-md border-none px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ background: uploading ? '#334155' : '#10b981' }}
              title="Upload PDF, CSV, MD, or TXT files"
            >
              {uploading ? '\u23F3' : '\uD83D\uDCC4'} Upload
            </button>
            <button
              onClick={() => toggleColumnCollapsed(column.id)}
              className="cursor-pointer border-none bg-transparent text-[11px] text-wall-subtle"
            >
              {'\u25C0'}
            </button>
          </div>
        </div>

        {/* Upload status */}
        {uploadStatus && (
          <div className="mt-1 text-[10px] text-emerald-400">
            {uploadStatus}
          </div>
        )}
      </div>

      {/* ── Card list ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-2 py-1.5"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#334155 transparent',
        }}
      >
        {sorted.map((card) => (
          <div
            key={card.id}
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData('text/plain', card.id)
            }
          >
            <Card
              card={card}
              colType="context"
              speakerColors={speakerColors}
              onNavigate={onNavigate}
              onDelete={(id) => deleteCard(id)}
              onHighlight={(id) => toggleHighlight(id)}
              onEdit={(id, c) => updateCard(id, { content: c })}
            />
          </div>
        ))}
        {cards.length === 0 && !uploading && (
          <div
            className="text-center text-[11px] text-wall-muted"
            style={{ padding: 16 }}
          >
            Upload files or add text to provide context.
            <br />
            Cards here are embedded and available to Inquiry and all agents.
          </div>
        )}
      </div>

      {/* ── Bottom input ── */}
      <div className="shrink-0 border-t border-wall-border px-2 py-[5px]">
        <div className="flex gap-[3px]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add context text..."
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddCard();
              }
            }}
            className="min-h-[26px] flex-1 resize-none rounded-md border border-wall-muted bg-wall-border px-[7px] py-[5px] font-inherit text-[11px] text-wall-text outline-none"
            style={{ boxSizing: 'border-box' }}
          />
          <button
            onClick={handleAddCard}
            className="shrink-0 cursor-pointer rounded-md border-none bg-emerald-600 px-[9px] text-xs font-bold text-white"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextColumn;
