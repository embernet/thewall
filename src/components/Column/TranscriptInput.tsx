import React, { useState, useRef, useMemo } from 'react';
import type { Card } from '@/types';
import { SPEAKER_COLORS } from '@/types';
import { useSessionStore } from '@/store/session';
import { uid, now, mid } from '@/utils/ids';

interface TranscriptInputProps {
  columnId: string;
  sessionId: string;
  cards: Card[];
  speakers: string[];
  onAddSpeaker?: (name: string) => void;
}

const TranscriptInput: React.FC<TranscriptInputProps> = ({
  columnId,
  sessionId,
  cards,
  speakers,
  onAddSpeaker,
}) => {
  const [text, setText] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [customSpeaker, setCustomSpeaker] = useState('');
  const [showAddSpeaker, setShowAddSpeaker] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const addCard = useSessionStore((s) => s.addCard);

  // Derive known speakers from existing cards
  const knownSpeakers = useMemo(() => {
    const s = new Set(speakers || []);
    cards.forEach((c) => {
      if (c.speaker) s.add(c.speaker);
    });
    return [...s];
  }, [cards, speakers]);

  const addSegment = () => {
    if (!text.trim()) return;
    const last = cards[cards.length - 1];
    addCard({
      id: uid(),
      columnId,
      sessionId,
      content: text.trim(),
      source: 'transcription',
      speaker: speaker || undefined,
      timestamp: undefined,
      sourceCardIds: [],
      aiTags: [],
      userTags: [],
      highlightedBy: 'none',
      isDeleted: false,
      createdAt: now(),
      updatedAt: now(),
      sortOrder: last ? mid(last.sortOrder) : 'n',
    });
    setText('');
    inputRef.current?.focus();
  };

  const handleAddSpeaker = () => {
    if (!customSpeaker.trim()) return;
    const name = customSpeaker.trim();
    setSpeaker(name);
    onAddSpeaker?.(name);
    setCustomSpeaker('');
    setShowAddSpeaker(false);
  };

  const toggleSpeaker = (s: string) => {
    setSpeaker((prev) => (prev === s ? '' : s));
  };

  return (
    <div className="shrink-0 border-t border-wall-border px-2 py-1.5">
      {/* Text input row */}
      <div className="flex gap-[3px]">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            speaker
              ? `What did ${speaker} say?`
              : 'Type what was said... (Enter to add)'
          }
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addSegment();
            }
          }}
          className="flex-1 resize-none rounded-md border border-wall-muted bg-wall-border px-[7px] py-[5px] font-inherit text-xs text-wall-text outline-none"
          style={{ boxSizing: 'border-box' }}
        />
        <button
          onClick={addSegment}
          disabled={!text.trim()}
          className="shrink-0 self-stretch rounded-md border-none px-2.5 text-[11px] font-bold text-white"
          style={{
            background: text.trim() ? '#ef4444' : '#334155',
            cursor: text.trim() ? 'pointer' : 'default',
          }}
        >
          Add
        </button>
      </div>

      {/* Speaker toggles row (below input) */}
      {knownSpeakers.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-[3px]">
          {knownSpeakers.map((s, i) => {
            const color = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
            const active = speaker === s;
            return (
              <button
                key={s}
                onClick={() => toggleSpeaker(s)}
                className="cursor-pointer rounded-md px-1.5 py-0.5 text-[9px] flex items-center gap-1"
                style={{
                  border: active ? `1px solid ${color}` : '1px solid #334155',
                  background: active ? `${color}20` : 'transparent',
                  color: active ? color : '#64748b',
                }}
              >
                <span
                  className="inline-block w-[10px] h-[10px] rounded-sm border text-[8px] leading-[10px] text-center"
                  style={{
                    borderColor: active ? color : '#475569',
                    background: active ? `${color}40` : 'transparent',
                    color: active ? color : 'transparent',
                  }}
                >
                  {active ? '\u2713' : ''}
                </span>
                {s}
              </button>
            );
          })}
          {showAddSpeaker ? (
            <div className="flex items-center gap-0.5">
              <input
                value={customSpeaker}
                onChange={(e) => setCustomSpeaker(e.target.value)}
                placeholder="Name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSpeaker();
                  if (e.key === 'Escape') setShowAddSpeaker(false);
                }}
                className="w-[70px] rounded border border-wall-muted bg-wall-border px-[5px] py-0.5 text-[9px] text-wall-text outline-none"
              />
              <button
                onClick={handleAddSpeaker}
                className="cursor-pointer rounded border-none bg-green-500 px-[5px] py-0.5 text-[9px] text-white"
              >
                {'\u2713'}
              </button>
              <button
                onClick={() => setShowAddSpeaker(false)}
                className="cursor-pointer border-none bg-transparent text-[9px] text-wall-text-dim"
              >
                {'\u2715'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddSpeaker(true)}
              className="cursor-pointer rounded border border-dashed border-wall-muted bg-transparent px-[5px] py-0.5 text-[9px] text-wall-subtle"
            >
              +
            </button>
          )}
        </div>
      )}

      {/* Show just the + button when no speakers exist yet */}
      {knownSpeakers.length === 0 && (
        <div className="mt-1 flex items-center gap-[3px]">
          {showAddSpeaker ? (
            <div className="flex items-center gap-0.5">
              <input
                value={customSpeaker}
                onChange={(e) => setCustomSpeaker(e.target.value)}
                placeholder="Add speaker"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSpeaker();
                  if (e.key === 'Escape') setShowAddSpeaker(false);
                }}
                className="w-[80px] rounded border border-wall-muted bg-wall-border px-[5px] py-0.5 text-[9px] text-wall-text outline-none"
              />
              <button
                onClick={handleAddSpeaker}
                className="cursor-pointer rounded border-none bg-green-500 px-[5px] py-0.5 text-[9px] text-white"
              >
                {'\u2713'}
              </button>
              <button
                onClick={() => setShowAddSpeaker(false)}
                className="cursor-pointer border-none bg-transparent text-[9px] text-wall-text-dim"
              >
                {'\u2715'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddSpeaker(true)}
              className="cursor-pointer rounded border border-dashed border-wall-muted bg-transparent px-[5px] py-0.5 text-[9px] text-wall-subtle"
            >
              + Add speaker
            </button>
          )}
        </div>
      )}

      <div className="mt-[3px] text-[9px] text-wall-subtle">
        Enter to add segment &bull; Shift+Enter for new line &bull; Agents
        auto-analyse every few segments
      </div>
    </div>
  );
};

export default TranscriptInput;
