// ---------------------------------------------------------------------------
// TtsTransport — Audio transport controls for TTS playback
//
// Renders a compact bar with: skip-to-start, rewind 5s, stop, play/pause,
// fast-forward 5s, skip-to-end, plus a seekable progress slider.
// Subscribes to tts.ts change events for live time/state updates.
//
// Usage:
//   <TtsTransport onClose={() => setTtsActive(false)} />
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from 'react';
import { SvgIcon } from '@/components/Icons';
import {
  getTtsAudio,
  isSpeaking,
  isTtsPaused,
  pauseSpeaking,
  resumeSpeaking,
  stopSpeaking,
  seekTo,
  seekToStart,
  seekToEnd,
  skipForward,
  skipBackward,
  onTtsChange,
} from '@/utils/tts';

interface TtsTransportProps {
  /** Called when playback is stopped or ends (so the parent can reset its state). */
  onClose: () => void;
}

/** Format seconds as m:ss */
function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TtsTransport({ onClose }: TtsTransportProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  // Track whether we ever had an audio element — only auto-close if we
  // had one and it was destroyed (i.e. playback ended), not during the
  // initial loading period when the API call is in flight.
  const hadAudioRef = useRef(false);
  const sliderRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Sync state from the TTS audio element
  const syncState = useCallback(() => {
    const audio = getTtsAudio();
    if (audio) {
      hadAudioRef.current = true;
      setLoading(false);
      if (!dragging) {
        setCurrentTime(audio.currentTime);
      }
      if (isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setPlaying(!audio.paused);
    } else if (hadAudioRef.current) {
      // Audio was destroyed after it existed → playback ended or was stopped
      setPlaying(false);
      setLoading(false);
      onCloseRef.current();
    }
    // If audio is null and we never had it, we're still loading — do nothing
  }, [dragging]);

  // Subscribe to TTS change events
  useEffect(() => {
    const unsub = onTtsChange(syncState);
    // Initial sync
    syncState();
    return unsub;
  }, [syncState]);

  // Also poll at a regular interval for smooth slider updates
  // (timeupdate fires ~4x/sec which can feel choppy on the slider)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const audio = getTtsAudio();
      if (audio && !dragging) {
        setCurrentTime(audio.currentTime);
      }
    }, 100);
    return () => clearInterval(id);
  }, [playing, dragging]);

  const handlePlayPause = () => {
    if (isSpeaking()) {
      pauseSpeaking();
    } else if (isTtsPaused()) {
      resumeSpeaking();
    }
  };

  const handleStop = () => {
    stopSpeaking();
    onCloseRef.current();
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    seekTo(val);
  };

  const handleSliderMouseDown = () => setDragging(true);
  const handleSliderMouseUp = () => setDragging(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const btnClass = 'cursor-pointer border-none bg-transparent p-0.5 rounded hover:bg-white/10 transition-colors flex items-center justify-center';

  return (
    <div
      className="flex flex-col gap-1 w-full rounded-md px-2 py-1.5 mt-1"
      style={{
        backgroundColor: 'var(--wall-surface-hex, #1e1e2e)',
        border: '1px solid var(--wall-border-hex, #333)',
      }}
    >
      {/* Transport buttons */}
      <div className="flex items-center justify-center gap-0.5">
        <button
          onClick={seekToStart}
          className={btnClass}
          title="Skip to start"
          disabled={loading}
          style={{ color: 'var(--wall-text-dim-hex, #aaa)', opacity: loading ? 0.3 : 1 }}
        >
          <SvgIcon name="skip-start" size={12} />
        </button>
        <button
          onClick={() => skipBackward(5)}
          className={btnClass}
          title="Rewind 5s"
          disabled={loading}
          style={{ color: 'var(--wall-text-dim-hex, #aaa)', opacity: loading ? 0.3 : 1 }}
        >
          <SvgIcon name="rewind" size={12} />
        </button>
        <button
          onClick={handleStop}
          className={btnClass}
          title="Stop"
          style={{ color: 'var(--wall-text-dim-hex, #aaa)' }}
        >
          <SvgIcon name="stop" size={12} />
        </button>
        <button
          onClick={handlePlayPause}
          className={btnClass}
          title={loading ? 'Loading...' : playing ? 'Pause' : 'Play'}
          disabled={loading}
          style={{ color: 'var(--wall-text-hex, #eee)', opacity: loading ? 0.3 : 1 }}
        >
          {loading ? (
            <span className="text-[10px]">{'\u23F3'}</span>
          ) : (
            <SvgIcon name={playing ? 'pause' : 'play'} size={14} />
          )}
        </button>
        <button
          onClick={() => skipForward(5)}
          className={btnClass}
          title="Fast forward 5s"
          disabled={loading}
          style={{ color: 'var(--wall-text-dim-hex, #aaa)', opacity: loading ? 0.3 : 1 }}
        >
          <SvgIcon name="fast-forward" size={12} />
        </button>
        <button
          onClick={seekToEnd}
          className={btnClass}
          title="Skip to end"
          disabled={loading}
          style={{ color: 'var(--wall-text-dim-hex, #aaa)', opacity: loading ? 0.3 : 1 }}
        >
          <SvgIcon name="skip-end" size={12} />
        </button>
      </div>

      {/* Progress slider + time display */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] tabular-nums w-6 text-right shrink-0" style={{ color: 'var(--wall-text-dim-hex, #aaa)' }}>
          {fmtTime(currentTime)}
        </span>
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSliderChange}
          onMouseDown={handleSliderMouseDown}
          onMouseUp={handleSliderMouseUp}
          onTouchStart={handleSliderMouseDown}
          onTouchEnd={handleSliderMouseUp}
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
    </div>
  );
}
