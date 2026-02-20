// ============================================================================
// The Wall — Chat Panel (right sidebar)
// ============================================================================
//
// Fixed right sidebar — mirrors the ColumnSidebar pattern on the left.
// Supports:
//   - Plain RAG-backed conversation with session context
//   - @help command listing all agents and tools
//   - @agent-id mentions to invoke agents via MCP adapter
//   - @image-generator to start the prompt-review-generate workflow
//   - Image attachments via file picker or clipboard paste
//   - Multimodal LLM calls when images are attached
//   - Persistent chat history per session (SQLite)
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uid } from 'uuid';
import type { Card, ChatMessage, ImageAttachment } from '@/types';
import { useSessionStore } from '@/store/session';
import { findSimilar } from '@/utils/embeddings';
import { askClaude, askClaudeMultimodal } from '@/utils/llm';
import { agentMCPAdapter, buildHelpContent } from '@/agents/mcp';
import { imageGenerator } from '@/agents/built-in/image-generator';
import ChatInput from './ChatInput';
import ChatMessageComponent from './ChatMessage';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  open: boolean;
  onToggle: () => void;
  allCards: Card[];
  onNavigate?: (cardId: string) => void;
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ChatPanel: React.FC<ChatPanelProps> = ({ open, onToggle, allCards, sessionId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [generatingError, setGeneratingError] = useState<Record<string, string>>({});
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const api = window.electronAPI?.db;

  // Load messages when session changes
  useEffect(() => {
    if (!sessionId || !api?.getChatMessages) return;
    if (sessionId === loadedSessionId) return;

    api.getChatMessages(sessionId).then(msgs => {
      setMessages(msgs.filter(m => !m.isDeleted));
      setLoadedSessionId(sessionId);
    }).catch(console.error);
  }, [sessionId, loadedSessionId, api]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // ── Persist a new message to DB ──────────────────────────────────────────

  const persistMessage = useCallback(async (msg: ChatMessage) => {
    if (!sessionId || !api?.createChatMessage) return;
    try {
      await api.createChatMessage({ ...msg, sessionId });
    } catch (e) {
      console.error('Failed to persist chat message:', e);
    }
  }, [sessionId, api]);

  // ── Per-message actions ──────────────────────────────────────────────────

  const handleToggleHidden = useCallback(async (id: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, hiddenFromLlm: !m.hiddenFromLlm } : m
    ));
    const msg = messages.find(m => m.id === id);
    if (msg && api?.updateChatMessage) {
      await api.updateChatMessage(id, { hiddenFromLlm: !msg.hiddenFromLlm });
    }
  }, [messages, api]);

  const handleToggleCollapsed = useCallback(async (id: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, collapsed: !m.collapsed } : m
    ));
    const msg = messages.find(m => m.id === id);
    if (msg && api?.updateChatMessage) {
      await api.updateChatMessage(id, { collapsed: !msg.collapsed });
    }
  }, [messages, api]);

  const handleDelete = useCallback(async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    if (api?.updateChatMessage) {
      await api.updateChatMessage(id, { isDeleted: true });
    }
  }, [api]);

  // ── Handle image generation from ImagePromptCard ─────────────────────────

  const handleGenerate = useCallback(
    async (messageId: string, finalizedPrompt: string, inputImage?: ImageAttachment, modelId?: string) => {
      setGeneratingImageId(messageId);
      setGeneratingError(prev => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });

      try {
        const result = await imageGenerator.generateImage(finalizedPrompt, inputImage, modelId);
        const imgMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: finalizedPrompt,
          imageData: result.imageData,
          imageMimeType: result.mimeType,
          timestamp: Date.now(),
        };
        setMessages(m => [...m, imgMsg]);
        await persistMessage(imgMsg);
      } catch (e) {
        setGeneratingError(prev => ({
          ...prev,
          [messageId]: String(e),
        }));
      } finally {
        setGeneratingImageId(null);
      }
    },
    [persistMessage],
  );

  // ── Handle send ───────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, imgs: ImageAttachment[]) => {
      const trimmed = text.trim();
      if (!trimmed && imgs.length === 0) return;
      if (loading) return;

      // Clear input immediately
      setInputText('');
      setAttachments([]);

      // --- @help command ---
      if (trimmed.toLowerCase() === '@help') {
        const helpContent = buildHelpContent();
        const helpMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: helpContent,
          timestamp: Date.now(),
          agentName: 'Help',
        };
        setMessages(m => [...m, helpMsg]);
        await persistMessage(helpMsg);
        return;
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed,
        imageAttachments: imgs.length > 0 ? imgs : undefined,
        timestamp: Date.now(),
      };
      setMessages(m => [...m, userMsg]);
      await persistMessage(userMsg);
      setLoading(true);

      try {
        // --- @image-generator or image prompt intent ---
        const imageGenMentionMatch = trimmed.match(/^@image-generator\s*/i);
        const isImageIntent =
          imageGenMentionMatch ||
          /generate.*image|create.*image|make.*image|draw\b|design.*infographic|visuali[sz]e|infographic|make.*diagram|create.*diagram|generate.*diagram|generate.*visual|create.*visual|make.*visual|make.*picture|create.*picture|image of|picture of/i.test(trimmed);

        if (isImageIntent) {
          const intent = imageGenMentionMatch
            ? trimmed.slice(imageGenMentionMatch[0].length).trim() || trimmed
            : trimmed;

          const { structuredText, finalPrompt } = await imageGenerator.buildPrompt(
            intent,
            imgs.length > 0 ? imgs : undefined,
          );
          const promptMsg: ChatMessage = {
            id: uid(),
            role: 'assistant',
            content: '',
            isImagePromptCard: true,
            structuredPromptText: structuredText,
            finalPrompt,
            timestamp: Date.now(),
            agentName: 'Image Generator',
          };
          setMessages(m => [...m, promptMsg]);
          await persistMessage(promptMsg);
          setLoading(false);
          return;
        }

        // --- @agent-id mention ---
        const agentMentionMatch = trimmed.match(/^@([\w-]+)\s*/);
        if (agentMentionMatch) {
          const mention = agentMentionMatch[1];
          const agent = agentMCPAdapter.resolveAgent(mention);
          if (agent) {
            const intent = trimmed.slice(agentMentionMatch[0].length).trim() || trimmed;
            const result = await agentMCPAdapter.execute(`agent:${agent.id}`, { intent });
            const agentMsg: ChatMessage = {
              id: uid(),
              role: 'assistant',
              content: result.success
                ? result.data || '_Agent returned no output._'
                : `Error: ${result.error}`,
              agentName: agent.name,
              timestamp: Date.now(),
            };
            setMessages(m => [...m, agentMsg]);
            await persistMessage(agentMsg);
            setLoading(false);
            return;
          }
          // Fall through if agent not found — treat as regular message
        }

        // --- Regular RAG-backed chat ---
        const relevant = findSimilar(trimmed, allCards, 8);
        const context = relevant
          .slice(0, 6)
          .map(r => {
            const prefix = r.card.speaker
              ? `${r.card.speaker}: `
              : r.card.sourceAgentName
                ? `[${r.card.sourceAgentName}] `
                : '';
            return prefix + r.card.content;
          })
          .join('\n\n');

        // Build system prompt — include session-level guiding context if set
        const sessionPrompt = useSessionStore.getState().session?.systemPrompt;
        const sessionGoal = useSessionStore.getState().session?.goal;
        let sys =
          'You are an AI assistant for The Wall, a collaborative meeting & research tool. ' +
          'Answer the user\'s question using the session context below when relevant. ' +
          'Be concise and specific. If context doesn\'t contain relevant information, say so.';
        if (sessionPrompt) {
          sys += '\n\nSession guidance: ' + sessionPrompt;
        }
        if (sessionGoal) {
          sys += '\n\nSession goal: ' + sessionGoal;
        }

        // Build conversation history for multi-turn context (exclude hidden/deleted)
        const visibleHistory = messages.filter(m => !m.hiddenFromLlm && !m.isDeleted);
        const historyPairs: Array<{ role: 'user' | 'assistant'; content: string }> = visibleHistory
          .filter(m => !m.isImagePromptCard && !m.imageData)
          .map(m => ({ role: m.role, content: m.content }));

        const userMessage =
          context
            ? `Session context:\n\n${context}\n\n---\n${trimmed}`
            : trimmed;

        let response: string | null;
        if (imgs.length > 0) {
          response = await askClaudeMultimodal(sys, userMessage, imgs, 1500);
        } else {
          // Pass history for multi-turn awareness
          response = await askClaude(sys, userMessage, 1500, historyPairs);
        }

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: response ?? '_No response received. Check your API key in Settings._',
          timestamp: Date.now(),
        };
        setMessages(m => [...m, assistantMsg]);
        await persistMessage(assistantMsg);
      } catch (e) {
        const errMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: `Error: ${String(e)}`,
          timestamp: Date.now(),
        };
        setMessages(m => [...m, errMsg]);
        await persistMessage(errMsg);
      } finally {
        setLoading(false);
      }
    },
    [loading, allCards, messages, persistMessage],
  );

  // ── Clear all messages ───────────────────────────────────────────────────

  const handleClear = useCallback(async () => {
    setMessages([]);
    if (sessionId && api?.clearChatMessages) {
      await api.clearChatMessages(sessionId);
    }
  }, [sessionId, api]);

  // ── Collapsed sidebar ─────────────────────────────────────────────────────

  if (!open) {
    return (
      <div
        className="flex w-[36px] min-w-[36px] cursor-pointer flex-col items-center border-l border-wall-border bg-wall-surface pt-2"
        onClick={onToggle}
        title="Open chat"
      >
        <span className="text-sm text-wall-subtle">💬</span>
        <span
          className="mt-2 text-[9px] text-wall-subtle"
          style={{ writingMode: 'vertical-rl', letterSpacing: 1 }}
        >
          Chat
        </span>
        {messages.length > 0 && (
          <span
            className="mt-1 rounded-full bg-indigo-600 px-1 py-0.5 text-[8px] text-white font-semibold"
            style={{ minWidth: '14px', textAlign: 'center' }}
          >
            {messages.length}
          </span>
        )}
      </div>
    );
  }

  // ── Expanded sidebar ──────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-[360px] min-w-[360px] flex-col border-l border-wall-border bg-wall-surface">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-wall-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">💬</span>
          <span className="text-[11px] font-semibold text-wall-text">Chat</span>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="cursor-pointer border-none bg-transparent text-[9px] text-wall-muted hover:text-wall-subtle transition-colors"
              title="Clear chat"
            >
              Clear
            </button>
          )}
          <button
            onClick={onToggle}
            className="cursor-pointer border-none bg-transparent text-[11px] text-wall-subtle hover:text-wall-text transition-colors"
            title="Collapse chat"
          >
            {'\u25B6'}
          </button>
        </div>
      </div>

      {/* Hint bar */}
      <div className="shrink-0 border-b border-wall-border bg-wall-bg px-3 py-1">
        <span className="text-[9px] text-wall-text-dim">
          Tip: <strong className="text-wall-text-muted">@help</strong> lists all agents ·{' '}
          <strong className="text-wall-text-muted">@agent-id</strong> invokes an agent ·{' '}
          Paste or attach images · Ask about the session
        </span>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-4xl">💬</span>
            <p className="text-[11px] text-wall-text-muted">
              Ask questions about the session, invoke agents with @mentions, or generate images.
            </p>
            <p className="text-[10px] text-wall-text-dim">
              Type <strong className="text-wall-text-muted">@help</strong> to see what&apos;s available.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-wall-border/30">
            {messages.map(msg => (
              <ChatMessageComponent
                key={msg.id}
                message={msg}
                onGenerate={handleGenerate}
                generatingImageId={generatingImageId}
                generatingError={generatingError}
                pendingAttachments={attachments}
                onToggleHidden={handleToggleHidden}
                onToggleCollapsed={handleToggleCollapsed}
                onDelete={handleDelete}
              />
            ))}
            {loading && (
              <div className="px-3 py-2 text-[11px] text-wall-muted italic animate-pulse">
                Thinking…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        attachments={attachments}
        onAddAttachments={items => setAttachments(a => [...a, ...items])}
        onRemoveAttachment={i => setAttachments(a => a.filter((_, idx) => idx !== i))}
        loading={loading}
      />
    </div>
  );
};

export default ChatPanel;
