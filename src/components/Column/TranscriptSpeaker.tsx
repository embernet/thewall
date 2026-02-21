// ---------------------------------------------------------------------------
// TranscriptSpeaker — Multi-card TTS playback panel for transcript columns
//
// Renders a drop-down panel at the top of the transcript (after controls,
// before summary) that:
//   1. Maps known speakers → TTS voices (with sensible defaults)
//   2. Plays through all visible cards sequentially
//   3. Tracks current card + position within card for pause/resume
//   4. Skip forward/back jumps whole cards
//   5. Highlights the active card and scrolls it into view
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Card as CardType } from '@/types';
import { SvgIcon } from '@/components/Icons';
import {
  speakText,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  getTtsAudio,
  isSpeaking,
  isTtsPaused,
  onTtsChange,
  getPreferredVoice,
  TTS_VOICES,
  preloadTts,
  playPreloaded,
  discardPreloaded,
} from '@/utils/tts';
import type { TtsVoice, PreloadedAudio } from '@/utils/tts';

interface TranscriptSpeakerProps {
  cards: CardType[];
  speakerColors: Record<string, string>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onCardChange?: (cardId: string | null) => void;
}

/** Format seconds as m:ss */
function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Build a default speaker→voice mapping. Rotate through voices, skipping the default. */
function buildDefaultVoiceMap(speakers: string[], defaultVoice: TtsVoice): Record<string, TtsVoice> {
  const available = TTS_VOICES.filter((v) => v.id !== defaultVoice);
  const map: Record<string, TtsVoice> = {};
  speakers.forEach((speaker, i) => {
    map[speaker] = available[i % available.length].id;
  });
  return map;
}

export default function TranscriptSpeaker({
  cards,
  speakerColors,
  scrollRef,
  onClose,
  onCardChange,
}: TranscriptSpeakerProps) {
  const defaultVoice = getPreferredVoice();

  // Unique speakers from visible cards
  const speakers = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => { if (c.speaker) set.add(c.speaker); });
    return [...set];
  }, [cards]);

  const hasSpeakers = speakers.length > 0;

  // Voice mapping state: speaker → voice
  const [voiceMap, setVoiceMap] = useState<Record<string, TtsVoice>>(() =>
    buildDefaultVoiceMap(speakers, defaultVoice),
  );

  // Rebuild map when speakers change (add missing, keep existing)
  useEffect(() => {
    setVoiceMap((prev) => {
      const next = { ...prev };
      const available = TTS_VOICES.filter((v) => v.id !== defaultVoice);
      let idx = Object.keys(prev).length;
      for (const s of speakers) {
        if (!next[s]) {
          next[s] = available[idx % available.length].id;
          idx++;
        }
      }
      return next;
    });
  }, [speakers, defaultVoice]);

  // Playback state
  const [currentCardIndex, setCurrentCardIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showVoiceMap, setShowVoiceMap] = useState(true);

  // Refs for stable callbacks
  const currentCardIndexRef = useRef(currentCardIndex);
  currentCardIndexRef.current = currentCardIndex;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const voiceMapRef = useRef(voiceMap);
  voiceMapRef.current = voiceMap;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  // Track whether we're in "stopped" state to prevent auto-advance after explicit stop
  const stoppedRef = useRef(false);
  const onCardChangeRef = useRef(onCardChange);
  onCardChangeRef.current = onCardChange;
  // Preloaded audio for the next card (fetched while current card plays)
  const preloadedRef = useRef<PreloadedAudio | null>(null);
  const preloadingIndexRef = useRef(-1);

  /** Resolve the TTS voice for a given card. */
  const voiceForCard = useCallback((card: CardType): TtsVoice => {
    return hasSpeakers && card.speaker
      ? voiceMapRef.current[card.speaker] || defaultVoice
      : defaultVoice;
  }, [defaultVoice, hasSpeakers]);

  /** Start preloading the next card's audio in the background. */
  const startPreload = useCallback((nextIndex: number) => {
    // Discard any existing preload
    if (preloadedRef.current) {
      discardPreloaded(preloadedRef.current);
      preloadedRef.current = null;
    }
    preloadingIndexRef.current = -1;

    if (nextIndex < 0 || nextIndex >= cardsRef.current.length) return;

    preloadingIndexRef.current = nextIndex;
    const card = cardsRef.current[nextIndex];
    const voice = voiceForCard(card);

    preloadTts(card.content, voice).then((handle) => {
      // Only keep if still relevant (user hasn't skipped/stopped)
      if (preloadingIndexRef.current === nextIndex && !stoppedRef.current) {
        preloadedRef.current = handle;
      } else if (handle) {
        discardPreloaded(handle);
      }
    }).catch(() => {
      // Preload failure is non-fatal; playCardAt will fall back to speakText
    });
  }, [voiceForCard]);

  // Clean up preloaded audio on unmount
  useEffect(() => {
    return () => {
      discardPreloaded(preloadedRef.current);
      preloadedRef.current = null;
    };
  }, []);

  // Highlight the active card and scroll to it
  useEffect(() => {
    if (currentCardIndex < 0 || currentCardIndex >= cards.length) return;
    const cardEl = document.getElementById(`card-${cards[currentCardIndex].id}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentCardIndex, cards]);

  // Sync TTS state
  const syncState = useCallback(() => {
    const audio = getTtsAudio();
    if (audio) {
      setLoading(false);
      if (!dragging) setCurrentTime(audio.currentTime);
      if (isFinite(audio.duration)) setDuration(audio.duration);
      setPlaying(!audio.paused);
      setPaused(audio.paused && audio.currentTime > 0);
    }
  }, [dragging]);

  useEffect(() => {
    const unsub = onTtsChange(syncState);
    syncState();
    return unsub;
  }, [syncState]);

  // Smooth slider polling
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const audio = getTtsAudio();
      if (audio && !dragging) setCurrentTime(audio.currentTime);
    }, 100);
    return () => clearInterval(id);
  }, [playing, dragging]);

  // Use refs for mutually-recursive playback functions
  const playCardAtRef = useRef<(index: number) => Promise<void>>();
  const advanceToNextRef = useRef<(nextIndex: number) => void>();

  advanceToNextRef.current = (nextIndex: number) => {
    if (stoppedRef.current) return;
    if (nextIndex >= cardsRef.current.length) {
      setCurrentCardIndex(-1);
      setPlaying(false);
      setLoading(false);
      onCardChangeRef.current?.(null);
      return;
    }

    // Check if we have a preloaded handle ready for this exact index
    const handle = preloadedRef.current;
    const handleReady = handle && !handle.cancelled && preloadingIndexRef.current === nextIndex;

    if (handleReady) {
      // Preloaded audio is ready — play it almost instantly with a tiny gap
      preloadedRef.current = null;
      preloadingIndexRef.current = -1;

      stoppedRef.current = false;
      setCurrentCardIndex(nextIndex);
      currentCardIndexRef.current = nextIndex;
      onCardChangeRef.current?.(cardsRef.current[nextIndex].id);
      setCurrentTime(0);
      setDuration(0);
      setLoading(false);

      // Start preloading the one after
      startPreload(nextIndex + 1);

      // Brief pause (≤ 333ms) then play the preloaded audio
      setTimeout(async () => {
        if (stoppedRef.current) {
          discardPreloaded(handle);
          return;
        }
        try {
          await playPreloaded(handle, () => setLoading(false));
          if (!stoppedRef.current) advanceToNextRef.current?.(nextIndex + 1);
        } catch (e) {
          console.warn('[transcript-speaker] Preloaded play failed:', e);
          if (!stoppedRef.current) advanceToNextRef.current?.(nextIndex + 1);
        }
      }, 250);
    } else {
      // No preload available — fall back to regular speakText (cold start)
      playCardAtRef.current?.(nextIndex);
    }
  };

  playCardAtRef.current = async (index: number) => {
    if (index < 0 || index >= cardsRef.current.length) {
      // Finished all cards
      setCurrentCardIndex(-1);
      setPlaying(false);
      setLoading(false);
      onCardChangeRef.current?.(null);
      return;
    }

    // Discard any stale preload
    if (preloadedRef.current) {
      discardPreloaded(preloadedRef.current);
      preloadedRef.current = null;
    }
    preloadingIndexRef.current = -1;

    stoppedRef.current = false;
    setCurrentCardIndex(index);
    currentCardIndexRef.current = index;
    onCardChangeRef.current?.(cardsRef.current[index].id);
    setLoading(true);
    setCurrentTime(0);
    setDuration(0);

    const card = cardsRef.current[index];
    const voice = voiceForCard(card);

    try {
      await speakText(card.content, voice, () => {
        setLoading(false);
        // Audio just started playing — kick off preload for the next card
        startPreload(index + 1);
      });
      // Card finished — advance to next (unless stopped)
      if (!stoppedRef.current) {
        advanceToNextRef.current?.(index + 1);
      }
    } catch (e) {
      console.warn('[transcript-speaker] Card speak failed:', e);
      // Try next card on error
      if (!stoppedRef.current) {
        advanceToNextRef.current?.(index + 1);
      }
    }
  };

  // Stable wrapper for external callers
  const playCardAt = useCallback((index: number) => {
    return playCardAtRef.current?.(index) ?? Promise.resolve();
  }, []);

  const handlePlay = () => {
    if (isTtsPaused()) {
      resumeSpeaking();
      setPlaying(true);
      return;
    }
    if (isSpeaking()) {
      pauseSpeaking();
      setPlaying(false);
      return;
    }
    // Start from current card or beginning
    const startIdx = currentCardIndex >= 0 ? currentCardIndex : 0;
    playCardAt(startIdx);
  };

  const handleStop = () => {
    stoppedRef.current = true;
    stopSpeaking();
    discardPreloaded(preloadedRef.current);
    preloadedRef.current = null;
    preloadingIndexRef.current = -1;
    setPlaying(false);
    setLoading(false);
    setCurrentCardIndex(-1);
    setCurrentTime(0);
    setDuration(0);
    onCardChangeRef.current?.(null);
    onClose();
  };

  const handleSkipForward = () => {
    stoppedRef.current = true; // stop current before starting next
    stopSpeaking();
    discardPreloaded(preloadedRef.current);
    preloadedRef.current = null;
    preloadingIndexRef.current = -1;
    const nextIdx = currentCardIndexRef.current + 1;
    if (nextIdx < cards.length) {
      playCardAt(nextIdx);
    } else {
      setCurrentCardIndex(-1);
      setPlaying(false);
      setLoading(false);
      onCardChangeRef.current?.(null);
    }
  };

  const handleSkipBackward = () => {
    stoppedRef.current = true;
    stopSpeaking();
    discardPreloaded(preloadedRef.current);
    preloadedRef.current = null;
    preloadingIndexRef.current = -1;
    const prevIdx = Math.max(0, currentCardIndexRef.current - 1);
    playCardAt(prevIdx);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    const audio = getTtsAudio();
    if (audio && isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(val, audio.duration));
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const btnClass = 'cursor-pointer border-none bg-transparent p-0.5 rounded hover:bg-white/10 transition-colors flex items-center justify-center';

  return (
    <div
      className="mx-2 mt-1.5 rounded-md border px-2.5 py-2 flex flex-col gap-1.5"
      style={{ borderColor: 'var(--wall-border-hex)', backgroundColor: 'var(--wall-bg-hex, #181825)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400">
          Speak Transcript
        </span>
        <div className="flex gap-1 items-center">
          {hasSpeakers && (
            <button
              onClick={() => setShowVoiceMap((o) => !o)}
              className="cursor-pointer border-none bg-transparent text-[9px] text-wall-text-muted hover:text-wall-text"
              title={showVoiceMap ? 'Hide voice mapping' : 'Show voice mapping'}
            >
              {showVoiceMap ? '\u25B2' : '\u25BC'} Voices
            </button>
          )}
          <button
            onClick={handleStop}
            className="cursor-pointer border-none bg-transparent text-[9px] text-wall-text-muted hover:text-red-400"
            title="Close"
          >
            {'\u2715'}
          </button>
        </div>
      </div>

      {/* Voice mapping (only when there are speakers) */}
      {hasSpeakers && showVoiceMap && (
        <div className="flex flex-col gap-1 px-0.5">
          {speakers.map((speaker) => (
            <div key={speaker} className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-bold rounded-lg px-1.5 py-px shrink-0"
                style={{
                  color: speakerColors[speaker] || '#64748b',
                  background: `${speakerColors[speaker] || '#64748b'}18`,
                }}
              >
                {speaker}
              </span>
              <span className="text-[9px] text-wall-text-muted">{'\u2192'}</span>
              <select
                value={voiceMap[speaker] || defaultVoice}
                onChange={(e) => {
                  setVoiceMap((prev) => ({ ...prev, [speaker]: e.target.value as TtsVoice }));
                }}
                className="rounded-md border border-wall-muted bg-wall-border px-1.5 py-0.5 text-[9px] text-wall-text outline-none flex-1 min-w-0"
              >
                {TTS_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>
          ))}
          {/* Default voice for unassigned/no-speaker cards */}
          <div className="flex items-center gap-1.5 mt-0.5 pt-0.5 border-t border-wall-border">
            <span className="text-[10px] text-wall-text-muted shrink-0 italic">Default</span>
            <span className="text-[9px] text-wall-text-muted">{'\u2192'}</span>
            <span className="text-[10px] text-wall-text-dim">
              {TTS_VOICES.find((v) => v.id === defaultVoice)?.label || defaultVoice}
            </span>
          </div>
        </div>
      )}

      {/* Card progress indicator */}
      {currentCardIndex >= 0 && (
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="text-[9px] text-wall-text-muted">
            Card {currentCardIndex + 1} / {cards.length}
          </span>
          {cards[currentCardIndex]?.speaker && (
            <span
              className="text-[9px] font-bold rounded-lg px-1 py-px"
              style={{
                color: speakerColors[cards[currentCardIndex].speaker!] || '#64748b',
                background: `${speakerColors[cards[currentCardIndex].speaker!] || '#64748b'}18`,
              }}
            >
              {cards[currentCardIndex].speaker}
            </span>
          )}
          <span className="text-[9px] text-wall-subtle truncate flex-1 min-w-0">
            {cards[currentCardIndex]?.content.slice(0, 60)}
            {(cards[currentCardIndex]?.content.length ?? 0) > 60 ? '...' : ''}
          </span>
        </div>
      )}

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-0.5">
        <button
          onClick={handleSkipBackward}
          className={btnClass}
          title="Previous card"
          disabled={loading && currentCardIndex <= 0}
          style={{ color: 'var(--wall-text-dim-hex, #aaa)', opacity: currentCardIndex <= 0 && !playing ? 0.3 : 1 }}
        >
          <SvgIcon name="skip-start" size={12} />
        </button>
        <button
          onClick={() => {
            stoppedRef.current = true;
            stopSpeaking();
            discardPreloaded(preloadedRef.current);
            preloadedRef.current = null;
            preloadingIndexRef.current = -1;
            setPlaying(false);
            setLoading(false);
            setCurrentCardIndex(-1);
            setCurrentTime(0);
            setDuration(0);
            onCardChangeRef.current?.(null);
          }}
          className={btnClass}
          title="Stop"
          style={{ color: 'var(--wall-text-dim-hex, #aaa)' }}
        >
          <SvgIcon name="stop" size={12} />
        </button>
        <button
          onClick={handlePlay}
          className={btnClass}
          title={loading ? 'Loading...' : playing ? 'Pause' : 'Play'}
          disabled={cards.length === 0}
          style={{ color: 'var(--wall-text-hex, #eee)', opacity: cards.length === 0 ? 0.3 : 1 }}
        >
          {loading ? (
            <span className="text-[10px]">{'\u23F3'}</span>
          ) : (
            <SvgIcon name={playing ? 'pause' : 'play'} size={14} />
          )}
        </button>
        <button
          onClick={handleSkipForward}
          className={btnClass}
          title="Next card"
          disabled={currentCardIndex >= cards.length - 1 && !playing}
          style={{ color: 'var(--wall-text-dim-hex, #aaa)', opacity: currentCardIndex >= cards.length - 1 && !playing ? 0.3 : 1 }}
        >
          <SvgIcon name="skip-end" size={12} />
        </button>
      </div>

      {/* Progress slider for current card */}
      {(playing || loading || paused) && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] tabular-nums w-6 text-right shrink-0" style={{ color: 'var(--wall-text-dim-hex, #aaa)' }}>
            {fmtTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => setDragging(true)}
            onMouseUp={() => setDragging(false)}
            onTouchStart={() => setDragging(true)}
            onTouchEnd={() => setDragging(false)}
            disabled={loading}
            className="tts-slider flex-1"
            style={{
              height: 4,
              appearance: 'none',
              WebkitAppearance: 'none',
              background: `linear-gradient(to right, #f59e0b ${progress}%, var(--wall-border-hex, #444) ${progress}%)`,
              borderRadius: 2,
              outline: 'none',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.3 : 1,
            }}
          />
          <span className="text-[9px] tabular-nums w-6 shrink-0" style={{ color: 'var(--wall-text-dim-hex, #aaa)' }}>
            {fmtTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
