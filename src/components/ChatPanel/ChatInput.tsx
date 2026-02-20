// ============================================================================
// The Wall — Chat Panel Input
// ============================================================================

import React, { useRef, useCallback } from 'react';
import type { ImageAttachment } from '@/types';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string, attachments: ImageAttachment[]) => void;
  attachments: ImageAttachment[];
  onAddAttachments: (items: ImageAttachment[]) => void;
  onRemoveAttachment: (index: number) => void;
  loading: boolean;
}

function readFileAsBase64(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const [header, data] = dataUrl.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      resolve({ data, mimeType, name: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  loading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!loading && (value.trim() || attachments.length > 0)) {
          onSend(value, attachments);
        }
      }
    },
    [value, attachments, loading, onSend],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      e.preventDefault();

      const newAttachments: ImageAttachment[] = [];
      for (const item of imageItems) {
        const blob = item.getAsFile();
        if (!blob) continue;
        try {
          const attachment = await readFileAsBase64(blob);
          newAttachments.push(attachment);
        } catch (err) {
          console.warn('Failed to read pasted image:', err);
        }
      }
      if (newAttachments.length > 0) {
        onAddAttachments(newAttachments);
      }
    },
    [onAddAttachments],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const newAttachments: ImageAttachment[] = [];
      for (const file of files) {
        try {
          const attachment = await readFileAsBase64(file);
          newAttachments.push(attachment);
        } catch (err) {
          console.warn('Failed to read image file:', err);
        }
      }
      if (newAttachments.length > 0) {
        onAddAttachments(newAttachments);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [onAddAttachments],
  );

  const canSend = !loading && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div className="shrink-0 border-t border-wall-border bg-wall-surface">
      {/* Attachment thumbnails */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2 pt-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              <img
                src={`data:${att.mimeType};base64,${att.data}`}
                alt={att.name ?? `Image ${i + 1}`}
                className="h-14 w-14 rounded-md object-cover border border-wall-border"
              />
              <button
                onClick={() => onRemoveAttachment(i)}
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                title="Remove image"
              >
                ✕
              </button>
              {att.name && (
                <div className="absolute bottom-0 left-0 right-0 truncate rounded-b-md bg-black/50 px-1 py-0.5 text-[8px] text-white">
                  {att.name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-1 p-2">
        {/* Paperclip / attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="shrink-0 cursor-pointer rounded-md p-1 text-wall-subtle hover:bg-wall-border hover:text-wall-text transition-colors border-none bg-transparent"
          title="Attach image (or paste)"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Textarea */}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={loading ? 'Thinking…' : 'Ask or @agent-id…'}
          disabled={loading}
          rows={1}
          className="flex-1 resize-none rounded-md border border-wall-border bg-wall-bg px-2 py-1.5 text-[11px] text-wall-text placeholder:text-wall-text-dim focus:outline-none focus:border-indigo-500 transition-colors"
          style={{
            minHeight: '32px',
            maxHeight: '120px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--scrollbar-thumb) transparent',
          }}
          onInput={(e) => {
            // Auto-resize
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
        />

        {/* Send button */}
        <button
          onClick={() => canSend && onSend(value, attachments)}
          disabled={!canSend}
          className="shrink-0 cursor-pointer rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors border-none"
          style={{
            background: canSend ? 'rgba(99,102,241,0.85)' : 'rgba(99,102,241,0.2)',
            color: canSend ? '#e0e7ff' : '#6366f1',
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          title="Send (Enter)"
        >
          {loading ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
