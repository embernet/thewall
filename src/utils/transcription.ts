// ---------------------------------------------------------------------------
// Transcription Service
//
// Records audio via MediaRecorder and transcribes using either OpenAI Whisper
// or WISPR Flow, depending on the user's "transcription" API-key slot config.
//
// Electron does not include the Web Speech API, so we use MediaRecorder
// (which IS available) to capture audio chunks and send them to the
// configured transcription provider.
//
// All API calls are proxied through Electron's main process via IPC to avoid
// CORS issues in the renderer.  The main process handler lives in
// `electron/ipc/db-handlers.ts` (`ipcMain.handle('transcribe', ...)`).
//
// RECORDING STRATEGY — stop/restart per flush:
//   MediaRecorder produces webm where only the first chunk contains the
//   container header (EBML + Segment + Tracks).  Subsequent ondataavailable
//   chunks are headerless Cluster data and are NOT valid standalone files.
//   Whisper rejects them with "Invalid file format".
//
//   To get a valid webm file for every API call we stop() the recorder,
//   collect the complete webm, send it off, then immediately start() a new
//   recording on the same stream.
//
// FLUSH TIMING — Voice Activity Detection (VAD):
//   Instead of a fixed timer we use a Web Audio AnalyserNode to monitor the
//   microphone RMS level in real-time (~50ms polling).  We flush when:
//     • Speech is detected and then a silence gap ≥ SILENCE_THRESHOLD_MS
//       occurs (natural pause in speech), OR
//     • The recording exceeds MAX_SEGMENT_MS (hard cap, avoids very long
//       segments that would delay card creation).
//   A minimum segment length (MIN_SEGMENT_MS) prevents flushing tiny bursts.
//
// DESIGN PATTERN — event-bus decoupling:
//   This service emits results on the shared `bus` instead of accepting
//   callbacks.  Any new provider should follow the same contract:
//     1. Add provider-specific fetch logic in the main process handler
//     2. Add its provider/model to `src/utils/providers.ts` SLOT_PROVIDERS
//     3. That's it — the bus wiring and UI are provider-agnostic.
// ---------------------------------------------------------------------------

import type { ApiProvider, ApiKeyConfig } from '@/types';
import { bus } from '@/events/bus';

// ── VAD tuning constants ────────────────────────────────────────────────────
/** RMS level below which audio is considered silence (0–1 scale). */
const SILENCE_RMS_THRESHOLD = 0.01;
/** How long silence must persist before we flush (ms). */
const SILENCE_THRESHOLD_MS = 1_500;
/** Hard cap — flush even mid-speech to avoid huge segments (ms). */
const MAX_SEGMENT_MS = 20_000;
/** Minimum segment duration before we consider flushing (ms). */
const MIN_SEGMENT_MS = 2_000;
/** How often we poll the analyser for RMS levels (ms). */
const VAD_POLL_MS = 50;

// ── Session state ───────────────────────────────────────────────────────────

interface TranscriptionSession {
  stream: MediaStream;
  mimeType: string;
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
  flushing: boolean;
  paused: boolean;
  stopped: boolean;

  // VAD state
  audioCtx: AudioContext;
  analyser: AnalyserNode;
  sourceNode: MediaStreamAudioSourceNode;
  vadIntervalId: ReturnType<typeof setInterval> | null;
  segmentStartedAt: number;     // Date.now() when current recorder started
  lastSpeechAt: number;         // Date.now() of last frame with speech
  hasSpeech: boolean;           // whether we've detected any speech this segment
}

let session: TranscriptionSession | null = null;

// ── Cached transcription configuration ──────────────────────────────────────

let cachedProvider: ApiProvider = 'openai';
let cachedModelId = 'whisper-1';
let cachedKey = '';

export function setTranscriptionConfig(provider: ApiProvider, modelId: string, key: string): void {
  cachedProvider = provider;
  cachedModelId = modelId;
  cachedKey = key;
}

export async function loadTranscriptionConfig(): Promise<boolean> {
  try {
    const configs: ApiKeyConfig[] = await window.electronAPI?.db?.getApiKeyConfigs() ?? [];
    const cfg = configs.find(c => c.slot === 'transcription');
    if (cfg) {
      cachedProvider = cfg.provider;
      cachedModelId = cfg.modelId;
      if (cfg.hasKey) {
        cachedKey = await window.electronAPI?.db?.getDecryptedKey('transcription') ?? '';
        return !!cachedKey;
      }
    }
  } catch (e) {
    console.warn('[transcription] Failed to load config:', e);
  }
  return false;
}

// ── Blob → base64 ──────────────────────────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ── RMS calculation from AnalyserNode ───────────────────────────────────────

function getRMS(analyser: AnalyserNode): number {
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

// ── MediaRecorder lifecycle ─────────────────────────────────────────────────

function createRecorder(s: TranscriptionSession): MediaRecorder {
  const mr = new MediaRecorder(s.stream, s.mimeType ? { mimeType: s.mimeType } : undefined);

  mr.ondataavailable = (e) => {
    if (e.data.size > 0 && session) {
      session.chunks.push(e.data);
    }
  };

  mr.onerror = (e) => {
    console.error('[transcription] MediaRecorder error:', e);
    bus.emit('transcript:error', { error: 'MediaRecorder error' });
  };

  mr.start();
  s.mediaRecorder = mr;
  s.segmentStartedAt = Date.now();
  s.hasSpeech = false;
  return mr;
}

// ── Flush: stop recorder → send to API → restart ───────────────────────────

async function flushAndRestart(): Promise<void> {
  if (!session || session.flushing || session.stopped) return;

  const mr = session.mediaRecorder;
  if (!mr || mr.state === 'inactive') return;

  session.flushing = true;

  const completeBlob = await new Promise<Blob>((resolve) => {
    mr.onstop = () => {
      const blob = new Blob(session!.chunks, { type: session!.mimeType || 'audio/webm' });
      session!.chunks = [];
      resolve(blob);
    };
    mr.stop();
  });

  // Immediately start a new recorder so we don't miss audio
  if (session && !session.stopped && !session.paused) {
    createRecorder(session);
  }

  // Skip tiny blobs (silence / noise)
  if (completeBlob.size < 1000) {
    console.debug(`[transcription] Skipping tiny blob (${completeBlob.size} bytes)`);
    if (session) session.flushing = false;
    return;
  }

  console.debug(`[transcription] Sending ${completeBlob.size} bytes via IPC proxy…`);

  try {
    const base64 = await blobToBase64(completeBlob);
    const result = await window.electronAPI.transcribe(base64);

    if (result.error) {
      console.warn('[transcription] IPC proxy returned error:', result.error);
      bus.emit('transcript:error', { error: result.error });
    } else if (result.text) {
      console.debug(`[transcription] Got text: "${result.text.slice(0, 80)}${result.text.length > 80 ? '…' : ''}"`);
      bus.emit('transcript:segment', { text: result.text });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[transcription] IPC call failed:', msg);
    bus.emit('transcript:error', { error: msg });
  } finally {
    if (session) session.flushing = false;
  }
}

// ── VAD polling: decide when to flush ───────────────────────────────────────

function vadTick(): void {
  if (!session || session.paused || session.stopped || session.flushing) return;

  const now = Date.now();
  const rms = getRMS(session.analyser);
  const isSpeech = rms > SILENCE_RMS_THRESHOLD;
  const elapsed = now - session.segmentStartedAt;

  if (isSpeech) {
    session.lastSpeechAt = now;
    session.hasSpeech = true;
  }

  // Hard cap — flush regardless to keep latency bounded
  if (elapsed >= MAX_SEGMENT_MS) {
    console.debug(`[transcription] VAD: hard cap ${MAX_SEGMENT_MS}ms reached, flushing`);
    flushAndRestart();
    return;
  }

  // Don't consider flushing until we have a minimum segment length
  if (elapsed < MIN_SEGMENT_MS) return;

  // If we've had speech and now there's a sufficient silence gap → flush
  if (session.hasSpeech && !isSpeech) {
    const silenceDuration = now - session.lastSpeechAt;
    if (silenceDuration >= SILENCE_THRESHOLD_MS) {
      console.debug(`[transcription] VAD: silence gap ${silenceDuration}ms after ${elapsed}ms of recording, flushing`);
      flushAndRestart();
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function isTranscriptionAvailable(): Promise<boolean> {
  if (cachedKey) return true;
  return loadTranscriptionConfig();
}

/**
 * Start recording and transcribing.
 * Returns the MediaStream (for audio level monitoring) or null if unavailable.
 */
export async function startTranscription(): Promise<MediaStream | null> {
  if (!cachedKey) await loadTranscriptionConfig();
  if (!cachedKey) {
    console.warn('[transcription] No API key configured — unavailable');
    return null;
  }

  console.debug(`[transcription] Starting with provider=${cachedProvider}, model=${cachedModelId}, keyLen=${cachedKey.length}`);

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  console.debug(`[transcription] MediaRecorder mimeType: "${mimeType || '(default)'}"`);

  // Set up Web Audio analyser for VAD
  const audioCtx = new AudioContext();
  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  // Don't connect analyser to destination — we just read data, no playback

  const now = Date.now();

  session = {
    stream, mimeType,
    mediaRecorder: null,
    chunks: [], flushing: false, paused: false, stopped: false,
    // VAD
    audioCtx, analyser, sourceNode,
    vadIntervalId: null,
    segmentStartedAt: now,
    lastSpeechAt: now,
    hasSpeech: false,
  };

  createRecorder(session);

  // Start VAD polling
  session.vadIntervalId = setInterval(vadTick, VAD_POLL_MS);

  return stream;
}

export function pauseTranscription(): void {
  if (!session) return;
  session.paused = true;
  if (session.mediaRecorder && session.mediaRecorder.state === 'recording') {
    session.mediaRecorder.pause();
  }
}

export function resumeTranscription(): void {
  if (!session) return;
  session.paused = false;
  if (session.mediaRecorder && session.mediaRecorder.state === 'paused') {
    session.mediaRecorder.resume();
  }
}

export async function stopTranscription(): Promise<void> {
  if (!session) return;

  session.stopped = true;
  if (session.vadIntervalId) clearInterval(session.vadIntervalId);

  const mr = session.mediaRecorder;

  if (mr && mr.state !== 'inactive') {
    const finalBlob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => {
        const blob = new Blob(session!.chunks, { type: session!.mimeType || 'audio/webm' });
        session!.chunks = [];
        resolve(blob);
      };
      mr.stop();
    });

    if (finalBlob.size >= 1000) {
      console.debug(`[transcription] Final flush: ${finalBlob.size} bytes`);
      try {
        const base64 = await blobToBase64(finalBlob);
        const result = await window.electronAPI.transcribe(base64);
        if (result.text) {
          bus.emit('transcript:segment', { text: result.text });
        }
      } catch (e) {
        console.warn('[transcription] Final flush failed:', e);
      }
    }
  }

  // Clean up Web Audio nodes
  session.sourceNode.disconnect();
  await session.audioCtx.close().catch(() => {});

  // Stop all tracks on the stream
  session.stream.getTracks().forEach(t => t.stop());
  session = null;
}

export function isTranscribing(): boolean {
  return session !== null && !session.paused;
}
