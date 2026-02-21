// ============================================================================
// The Wall — Chat Panel Message Renderer
// ============================================================================

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { safeMarkdownComponents } from '@/utils/safe-markdown';
import type { ChatMessage as ChatMessageType, ImageAttachment } from '@/types';
import ImagePromptCard from './ImagePromptCard';

interface ChatMessageProps {
  message: ChatMessageType;
  onGenerate: (
    messageId: string,
    finalizedPrompt: string,
    inputImage?: ImageAttachment,
    modelId?: string,
  ) => void;
  generatingImageId: string | null;
  generatingError: Record<string, string>;
  pendingAttachments: ImageAttachment[];
  onToggleHidden: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onDelete: (id: string) => void;
}

// ── Action toolbar shown on hover ────────────────────────────────────────────

interface ActionBarProps {
  message: ChatMessageType;
  onCopy: () => void;
  onToggleCollapsed: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}

const ActionBar: React.FC<ActionBarProps> = ({
  message,
  onCopy,
  onToggleCollapsed,
  onToggleHidden,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const btnCls =
    'flex items-center justify-center w-5 h-5 rounded cursor-pointer border-none bg-transparent text-wall-muted hover:text-wall-text hover:bg-wall-border/40 transition-colors text-[10px] leading-none';

  return (
    <div className="flex items-center gap-0.5">
      {/* Copy */}
      <button className={btnCls} onClick={handleCopy} title="Copy to clipboard">
        {copied ? '✓' : '⎘'}
      </button>

      {/* Collapse / Expand */}
      {message.content && (
        <button
          className={btnCls}
          onClick={onToggleCollapsed}
          title={message.collapsed ? 'Expand' : 'Collapse to 3 lines'}
        >
          {message.collapsed ? '⤢' : '⤡'}
        </button>
      )}

      {/* Hide from LLM */}
      <button
        className={`${btnCls} ${message.hiddenFromLlm ? 'text-amber-500 hover:text-amber-400' : ''}`}
        onClick={onToggleHidden}
        title={message.hiddenFromLlm ? 'Unhide from LLM context' : 'Hide from LLM context'}
      >
        {message.hiddenFromLlm ? '👁' : '🚫'}
      </button>

      {/* Delete */}
      <button
        className={`${btnCls} hover:text-red-400`}
        onClick={onDelete}
        title="Delete message"
      >
        ✕
      </button>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  onGenerate,
  generatingImageId,
  generatingError,
  pendingAttachments,
  onToggleHidden,
  onToggleCollapsed,
  onDelete,
}) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = () => {
    const text = message.content || message.structuredPromptText || message.finalPrompt || '';
    navigator.clipboard.writeText(text).catch(console.error);
  };

  // Dim hidden messages
  const hiddenOpacity = message.hiddenFromLlm ? 'opacity-40' : '';

  // ── Generated image card ───────────────────────────────────────────────────
  if (message.imageData) {
    const src = `data:${message.imageMimeType ?? 'image/png'};base64,${message.imageData}`;
    return (
      <>
        <div
          className={`relative flex flex-col gap-1.5 px-3 py-2 group ${hiddenOpacity}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-indigo-400">Generated Image</span>
            <span className="ml-auto text-[9px] text-wall-muted">{timestamp}</span>
            {hovered && (
              <ActionBar
                message={message}
                onCopy={handleCopy}
                onToggleCollapsed={() => onToggleCollapsed(message.id)}
                onToggleHidden={() => onToggleHidden(message.id)}
                onDelete={() => onDelete(message.id)}
              />
            )}
          </div>
          {message.content && (
            <p className="text-[10px] text-wall-subtle italic line-clamp-2">{message.content}</p>
          )}
          <img
            src={src}
            alt="Generated image"
            className="w-full cursor-zoom-in rounded-lg border border-wall-border object-contain"
            style={{ maxHeight: '280px' }}
            onClick={() => setLightboxSrc(src)}
          />
          <button
            className="self-end cursor-pointer rounded border border-wall-border bg-transparent px-2 py-0.5 text-[9px] text-wall-subtle hover:text-wall-text transition-colors"
            onClick={() => {
              const a = document.createElement('a');
              a.href = src;
              a.download = 'generated-image.png';
              a.click();
            }}
          >
            ↓ Save
          </button>
        </div>

        {/* Lightbox */}
        {lightboxSrc && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 cursor-zoom-out"
            onClick={() => setLightboxSrc(null)}
          >
            <img
              src={lightboxSrc}
              alt="Generated image"
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            />
          </div>
        )}
      </>
    );
  }

  // ── Image prompt card (review/edit before generating) ─────────────────────
  if (message.isImagePromptCard && message.structuredPromptText && message.finalPrompt) {
    return (
      <div
        className={`relative px-3 py-2 group ${hiddenOpacity}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-semibold text-indigo-400">Image Generator</span>
          <span className="ml-auto text-[9px] text-wall-muted">{timestamp}</span>
          {hovered && (
            <ActionBar
              message={message}
              onCopy={handleCopy}
              onToggleCollapsed={() => onToggleCollapsed(message.id)}
              onToggleHidden={() => onToggleHidden(message.id)}
              onDelete={() => onDelete(message.id)}
            />
          )}
        </div>
        <ImagePromptCard
          structuredText={message.structuredPromptText}
          initialFinalPrompt={message.finalPrompt}
          onGenerate={(prompt, img, modelId) => onGenerate(message.id, prompt, img, modelId)}
          attachedImages={pendingAttachments}
          loading={generatingImageId === message.id}
          error={generatingError[message.id]}
        />
      </div>
    );
  }

  // ── Regular user / assistant message ──────────────────────────────────────
  return (
    <>
      <div
        className={`relative flex flex-col gap-1 px-3 py-2 group ${isUser ? 'items-end' : 'items-start'} ${hiddenOpacity}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Sender label + action bar */}
        <div className="flex items-center gap-1.5 w-full">
          {!isUser && (
            <span className="text-[9px] font-semibold" style={{ color: message.agentName ? '#a78bfa' : '#7dd3fc' }}>
              {message.agentName ?? 'Chat AI'}
            </span>
          )}
          {isUser && <span className="ml-auto text-[9px] font-semibold text-indigo-300">You</span>}

          {/* Action bar (shown on hover) */}
          {hovered && (
            <div className={`flex items-center gap-0.5 ${isUser ? 'order-first mr-auto' : 'ml-auto'}`}>
              <ActionBar
                message={message}
                onCopy={handleCopy}
                onToggleCollapsed={() => onToggleCollapsed(message.id)}
                onToggleHidden={() => onToggleHidden(message.id)}
                onDelete={() => onDelete(message.id)}
              />
            </div>
          )}

          <span className={`text-[9px] text-wall-muted ${isUser ? '' : 'ml-auto'}`}>{timestamp}</span>
        </div>

        {/* Hidden-from-LLM badge */}
        {message.hiddenFromLlm && (
          <span className="self-start text-[8px] text-amber-500/70 italic">hidden from LLM</span>
        )}

        {/* User-attached images */}
        {isUser && message.imageAttachments && message.imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {message.imageAttachments.map((att, i) => (
              <img
                key={i}
                src={`data:${att.mimeType};base64,${att.data}`}
                alt={att.name ?? `Image ${i + 1}`}
                className="h-16 w-16 cursor-zoom-in rounded-md object-cover border border-wall-border"
                onClick={() => setLightboxSrc(`data:${att.mimeType};base64,${att.data}`)}
              />
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div
            className={`max-w-[95%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
              isUser
                ? 'bg-indigo-900/50 text-indigo-100 self-end'
                : 'bg-wall-surface text-wall-text self-start'
            } ${message.collapsed ? 'overflow-hidden' : ''}`}
            style={message.collapsed ? { maxHeight: '4.5em', WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            ) : (
              <div className="card-markdown">
                <ReactMarkdown components={safeMarkdownComponents}>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Expand hint when collapsed */}
        {message.collapsed && message.content && (
          <button
            className="self-start text-[9px] text-wall-muted hover:text-wall-subtle cursor-pointer border-none bg-transparent"
            onClick={() => onToggleCollapsed(message.id)}
          >
            Show more…
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
};

export default ChatMessageComponent;
