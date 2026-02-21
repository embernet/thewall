// ---------------------------------------------------------------------------
// Text-to-Speech Service
//
// Plays card/summary content aloud via OpenAI TTS API.
// API calls are proxied through Electron's main process via IPC to avoid CORS.
//
// Usage:
//   import { speakText, stopSpeaking, isSpeaking } from '@/utils/tts';
//   await speakText('Hello world');
//
// Transport controls (seek, rewind, etc.) are exposed via getTtsAudio() which
// returns the underlying HTMLAudioElement for direct manipulation.
// ---------------------------------------------------------------------------

import type { ApiProvider, ApiKeyConfig } from '@/types';

// ── Cached TTS configuration ────────────────────────────────────────────────

let cachedProvider: ApiProvider = 'openai';
let cachedModelId = 'tts-1';
let cachedKey = '';

/** TTS voice options (OpenAI voices). */
export type TtsVoice = 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer';

export const TTS_VOICES: readonly { id: TtsVoice; label: string }[] = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'coral', label: 'Coral' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'nova', label: 'Nova' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
] as const;

const VOICE_STORAGE_KEY = 'wall:tts-voice';

/** Get the user's preferred TTS voice (from localStorage). */
export function getPreferredVoice(): TtsVoice {
  const stored = localStorage.getItem(VOICE_STORAGE_KEY);
  if (stored && TTS_VOICES.some(v => v.id === stored)) return stored as TtsVoice;
  return 'alloy';
}

/** Save the user's preferred TTS voice to localStorage. */
export function setPreferredVoice(voice: TtsVoice): void {
  localStorage.setItem(VOICE_STORAGE_KEY, voice);
}

export function setTtsConfig(provider: ApiProvider, modelId: string, key: string): void {
  cachedProvider = provider;
  cachedModelId = modelId;
  cachedKey = key;
}

export async function loadTtsConfig(): Promise<boolean> {
  try {
    const configs: ApiKeyConfig[] = await window.electronAPI?.db?.getApiKeyConfigs() ?? [];
    const cfg = configs.find(c => c.slot === 'tts');
    if (cfg) {
      cachedProvider = cfg.provider;
      cachedModelId = cfg.modelId;
      if (cfg.hasKey) {
        cachedKey = await window.electronAPI?.db?.getDecryptedKey('tts') ?? '';
        return !!cachedKey;
      }
    }
    // Fall back to transcription key if TTS not configured (both use OpenAI)
    const transcriptionCfg = configs.find(c => c.slot === 'transcription');
    if (transcriptionCfg?.hasKey && transcriptionCfg.provider === 'openai') {
      cachedKey = await window.electronAPI?.db?.getDecryptedKey('transcription') ?? '';
      return !!cachedKey;
    }
  } catch (e) {
    console.warn('[tts] Failed to load config:', e);
  }
  return false;
}

/** Check whether TTS is available (has a key configured). */
export async function isTtsAvailable(): Promise<boolean> {
  if (cachedKey) return true;
  return loadTtsConfig();
}

// ── Playback state ──────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

/**
 * Generation counter — incremented every time speakText() or stopSpeaking()
 * is called.  When the async IPC response arrives we check whether the
 * generation is still current; if not the result is stale and we discard it.
 * This prevents the race condition where:
 *   1. User clicks Speak  → generation 1, IPC call starts
 *   2. User clicks Stop   → generation 2, but nothing to pause yet
 *   3. IPC response arrives for generation 1 → would start playing
 * With the counter, step 3 sees generation !== 1 and bails.
 */
let speakGeneration = 0;

/** Whether TTS audio is currently playing or an API call is in-flight. */
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/** Whether TTS audio is loaded (playing or paused, but has content). */
export function isTtsLoaded(): boolean {
  return currentAudio !== null && currentAudio.readyState >= 2;
}

/** Whether TTS audio is paused (loaded but not playing). */
export function isTtsPaused(): boolean {
  return currentAudio !== null && currentAudio.paused && currentAudio.currentTime > 0;
}

/**
 * Get the current HTMLAudioElement for transport controls (seek, time, etc.).
 * Returns null if no audio is loaded.
 */
export function getTtsAudio(): HTMLAudioElement | null {
  return currentAudio;
}

/** Pause TTS playback without destroying the audio element. */
export function pauseSpeaking(): void {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
  }
}

/** Resume TTS playback from paused state. */
export function resumeSpeaking(): void {
  if (currentAudio && currentAudio.paused && currentAudio.currentTime > 0) {
    currentAudio.play().catch((e) => {
      console.warn('[tts] Resume failed:', e);
    });
  }
}

/** Seek to a specific time in seconds. */
export function seekTo(time: number): void {
  if (currentAudio && isFinite(currentAudio.duration)) {
    currentAudio.currentTime = Math.max(0, Math.min(time, currentAudio.duration));
  }
}

/** Skip forward by N seconds (default 5). */
export function skipForward(seconds = 5): void {
  if (currentAudio && isFinite(currentAudio.duration)) {
    currentAudio.currentTime = Math.min(currentAudio.currentTime + seconds, currentAudio.duration);
  }
}

/** Skip backward by N seconds (default 5). */
export function skipBackward(seconds = 5): void {
  if (currentAudio) {
    currentAudio.currentTime = Math.max(currentAudio.currentTime - seconds, 0);
  }
}

/** Jump to start of audio. */
export function seekToStart(): void {
  if (currentAudio) {
    currentAudio.currentTime = 0;
  }
}

/** Jump to end of audio (effectively finishes playback). */
export function seekToEnd(): void {
  if (currentAudio && isFinite(currentAudio.duration)) {
    currentAudio.currentTime = currentAudio.duration;
  }
}

/** Stop any currently playing TTS audio and release resources. */
export function stopSpeaking(): void {
  // Bump generation so any in-flight IPC response is discarded
  speakGeneration++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

// ── Preloading ───────────────────────────────────────────────────────────────
//
// preloadTts() fetches audio from the TTS API in the background and returns a
// handle that can later be played instantly via playPreloaded().  This lets the
// TranscriptSpeaker start fetching the *next* card's audio while the current
// card is still playing, eliminating the dead-air gap between cards.

export interface PreloadedAudio {
  audio: HTMLAudioElement;
  objectUrl: string;
  /** Set to true if the preload was cancelled before it completed. */
  cancelled: boolean;
}

/**
 * Fetch TTS audio in the background without playing it.
 * Returns a handle that can be passed to playPreloaded().
 * Call handle.cancelled = true to discard it (the object URL will be revoked).
 */
export async function preloadTts(
  text: string,
  voice?: TtsVoice,
): Promise<PreloadedAudio | null> {
  if (!text.trim()) return null;

  const truncated = text.length > 4096 ? text.slice(0, 4093) + '...' : text;
  const resolvedVoice = voice ?? getPreferredVoice();

  const result = await window.electronAPI.ttsSpeak(truncated, resolvedVoice);

  if (result.error || !result.audioBase64) {
    console.warn('[tts] Preload API error:', result.error || 'no audio data');
    return null;
  }

  // Decode base64 → blob → object URL → HTMLAudioElement
  const binaryStr = atob(result.audioBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: result.mimeType || 'audio/mpeg' });
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);

  // Force the browser to buffer the audio data
  audio.preload = 'auto';
  audio.load();

  const handle: PreloadedAudio = { audio, objectUrl, cancelled: false };
  return handle;
}

/**
 * Discard a preloaded audio handle, revoking its object URL.
 */
export function discardPreloaded(handle: PreloadedAudio | null): void {
  if (!handle) return;
  handle.cancelled = true;
  handle.audio.pause();
  handle.audio.src = '';
  URL.revokeObjectURL(handle.objectUrl);
}

/**
 * Install a preloaded audio handle as the active TTS playback and start it.
 * Returns a promise that resolves when playback completes (like speakText).
 * The onLoaded callback fires immediately since the audio is already buffered.
 */
export function playPreloaded(
  handle: PreloadedAudio,
  onLoaded?: () => void,
): Promise<void> {
  // Stop any existing playback and claim a new generation
  stopSpeaking();
  const myGeneration = speakGeneration;

  if (handle.cancelled) return Promise.resolve();

  currentObjectUrl = handle.objectUrl;
  const audio = handle.audio;
  currentAudio = audio;

  notifyChange(); // notify: new audio installed

  return new Promise<void>((resolve, reject) => {
    // Wire up change notifications for UI updates
    audio.ontimeupdate = notifyChange;
    audio.onplay = notifyChange;
    audio.onpause = notifyChange;
    audio.onseeked = notifyChange;
    audio.onloadedmetadata = () => {
      notifyChange();
      onLoaded?.();
    };
    // If metadata is already loaded (preload finished), fire immediately
    if (audio.readyState >= 1) {
      onLoaded?.();
    }

    audio.onended = () => {
      if (speakGeneration === myGeneration) stopSpeaking();
      notifyChange();
      resolve();
    };
    audio.onerror = () => {
      if (speakGeneration === myGeneration) stopSpeaking();
      notifyChange();
      reject(new Error('Audio playback failed'));
    };

    audio.play().catch((e) => {
      if (speakGeneration === myGeneration) stopSpeaking();
      notifyChange();
      reject(e);
    });
  });
}

// ── Change listeners ────────────────────────────────────────────────────────

type TtsChangeListener = () => void;
const changeListeners = new Set<TtsChangeListener>();

/** Subscribe to TTS state changes (play, pause, seek, end, load). */
export function onTtsChange(fn: TtsChangeListener): () => void {
  changeListeners.add(fn);
  return () => { changeListeners.delete(fn); };
}

function notifyChange(): void {
  changeListeners.forEach(fn => fn());
}

/**
 * Speak text aloud via OpenAI TTS.
 * Returns a promise that resolves when playback completes (or rejects on error).
 * If stopSpeaking() is called while the API request is in-flight, the returned
 * promise resolves silently without starting playback.
 *
 * The `onLoaded` callback fires when audio is ready and playback starts,
 * allowing callers to update UI before the promise resolves (at end of playback).
 */
export async function speakText(
  text: string,
  voice?: TtsVoice,
  onLoaded?: () => void,
): Promise<void> {
  // Stop any existing playback and claim a new generation
  stopSpeaking();
  const myGeneration = speakGeneration;

  if (!text.trim()) return;

  // Truncate very long text (TTS API has a 4096 char limit)
  const truncated = text.length > 4096 ? text.slice(0, 4093) + '...' : text;

  // Use saved preference when no explicit voice is passed
  const resolvedVoice = voice ?? getPreferredVoice();

  notifyChange(); // notify: loading started

  const result = await window.electronAPI.ttsSpeak(truncated, resolvedVoice);

  // ── Stale-response guard ──────────────────────────────────────────────
  // If stopSpeaking() (or another speakText()) was called while we were
  // awaiting the IPC response, our generation is outdated — bail silently.
  if (speakGeneration !== myGeneration) return;

  if (result.error) {
    console.warn('[tts] API error:', result.error);
    throw new Error(result.error);
  }

  if (!result.audioBase64) {
    throw new Error('No audio data returned from TTS API');
  }

  // Double-check generation again before starting playback
  if (speakGeneration !== myGeneration) return;

  // Decode base64 → blob → object URL → HTMLAudioElement
  const binaryStr = atob(result.audioBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: result.mimeType || 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;

  return new Promise<void>((resolve, reject) => {
    // Final generation check before creating the audio element
    if (speakGeneration !== myGeneration) {
      URL.revokeObjectURL(url);
      currentObjectUrl = null;
      resolve();
      return;
    }

    const audio = new Audio(url);
    currentAudio = audio;

    // Wire up change notifications for UI updates
    audio.ontimeupdate = notifyChange;
    audio.onplay = notifyChange;
    audio.onpause = notifyChange;
    audio.onseeked = notifyChange;
    audio.onloadedmetadata = () => {
      notifyChange();
      onLoaded?.();
    };

    audio.onended = () => {
      // Only clean up if we're still the active generation
      if (speakGeneration === myGeneration) stopSpeaking();
      notifyChange();
      resolve();
    };
    audio.onerror = () => {
      if (speakGeneration === myGeneration) stopSpeaking();
      notifyChange();
      reject(new Error('Audio playback failed'));
    };

    audio.play().catch((e) => {
      if (speakGeneration === myGeneration) stopSpeaking();
      notifyChange();
      reject(e);
    });
  });
}
