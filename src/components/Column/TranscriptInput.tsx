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
}

const TranscriptInput: React.FC<TranscriptInputProps> = ({
  columnId,
  sessionId,
  cards,
  speakers,
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
    setSpeaker(customSpeaker.trim());
    setCustomSpeaker('');
    setShowAddSpeaker(false);
  };

  return (
    <div className="shrink-0 border-t border-wall-border px-2 py-1.5">
      {/* Speaker selector row */}
      <div className="mb-1 flex flex-wrap items-center gap-[3px]">
        <span className="text-[9px] text-wall-text-dim">Speaker:</span>
        <button
          onClick={() => setSpeaker('')}
          className="cursor-pointer rounded-md px-1.5 py-0.5 text-[9px]"
          style={{
            border: !speaker ? '1px solid #6366f1' : '1px solid #334155',
            background: !speaker ? '#6366f120' : 'transparent',
            color: !speaker ? '#a5b4fc' : '#64748b',
          }}
        >
          None
        </button>
        {knownSpeakers.map((s, i) => {
          const color = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
          return (
            <button
              key={s}
              onClick={() => setSpeaker(s)}
              className="cursor-pointer rounded-md px-1.5 py-0.5 text-[9px]"
              style={{
                border:
                  speaker === s
                    ? `1px solid ${color}`
                    : '1px solid #334155',
                background: speaker === s ? `${color}20` : 'transparent',
                color: speaker === s ? color : '#64748b',
              }}
            >
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

      <div className="mt-[3px] text-[9px] text-wall-subtle">
        Enter to add segment &bull; Shift+Enter for new line &bull; Agents
        auto-analyse every few segments
      </div>
    </div>
  );
};

export default TranscriptInput;
