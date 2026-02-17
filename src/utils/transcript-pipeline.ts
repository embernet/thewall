// ---------------------------------------------------------------------------
// Transcript Post-Processing Pipeline
//
// Sits between raw VAD-chunked transcript cards and the agent orchestrator.
// Accumulates raw transcript cards, then runs a single LLM call to:
//   1. Re-segment the concatenated text into meaningful, self-contained sections
//   2. Clean filler words (um, er, uh, like, you know) without summarising
//
// Raw cards are tagged 'transcript:raw' and dimmed after processing.
// Clean cards are tagged 'transcript:clean' — only these reach the agents.
//
// This is a pipeline SERVICE, not an agent — it updates cards in the same
// column (transcript), whereas agents create cards in other columns.
// ---------------------------------------------------------------------------

import { bus } from '@/events/bus';
import { useSessionStore } from '@/store/session';
import { askClaude, getApiKey } from '@/utils/llm';
import { uid, now, mid } from '@/utils/ids';
import type { Card } from '@/types';

// ── Tuning constants ────────────────────────────────────────────────────────

/** Minimum raw cards before triggering the pipeline (count-based). */
const MIN_RAW_CARDS = 5;

/** Time-based trigger: run pipeline after this many ms with 2+ raw cards. */
const TIME_TRIGGER_MS = 45_000;

/** Minimum raw cards for the time-based trigger and flush. */
const MIN_RAW_CARDS_TIME = 2;

/** Polling interval for the time-based and re-check triggers. */
const POLL_MS = 5_000;

/** Delay before processing existing raw cards on session load. */
const SESSION_LOAD_DELAY_MS = 3_000;

/** How many times to retry on LLM failure before giving up for this batch. */
const MAX_RETRIES = 3;

/** Delay between retries (doubles each attempt). */
const RETRY_BASE_DELAY_MS = 5_000;

// ── Pipeline state ──────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;
let firstRawAt: number | null = null;
let running = false;
let initialised = false;
/** Set to true when flush is requested while pipeline is already running. */
let pendingFlush = false;

// ── Lifecycle ───────────────────────────────────────────────────────────────

export function initTranscriptPipeline(): void {
  if (initialised) return;
  initialised = true;
  firstRawAt = null;
  running = false;
  pendingFlush = false;

  bus.on('card:created', handleCardCreated);

  // Poll timer handles: time-based trigger AND re-check for raw cards that
  // accumulated while the pipeline was running.
  pollTimer = setInterval(pollCheck, POLL_MS);

  // On session load, process any existing raw cards after a short delay
  // (gives the store time to settle after hydrating cards from DB)
  setTimeout(processExistingRawCards, SESSION_LOAD_DELAY_MS);

  console.log('[transcript-pipeline] Initialised');
}

export function destroyTranscriptPipeline(): void {
  bus.off('card:created', handleCardCreated);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  firstRawAt = null;
  running = false;
  pendingFlush = false;
  initialised = false;
  console.log('[transcript-pipeline] Destroyed');
}

/**
 * Force-flush: process any remaining raw cards.
 * Called when the user stops recording.
 * If the pipeline is currently running, it queues a re-run for when it finishes.
 */
export async function flushTranscriptPipeline(): Promise<void> {
  if (running) {
    // Pipeline is mid-run — flag a pending flush so the poll loop picks it up
    pendingFlush = true;
    console.log('[transcript-pipeline] Flush requested while running — queued');
    return;
  }
  const rawCards = getRawCards();
  if (rawCards.length > 0) {
    console.log(`[transcript-pipeline] Flush: ${rawCards.length} raw cards`);
    await runPipeline(rawCards);
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function getRawCards(): Card[] {
  const store = useSessionStore.getState();
  return store.cards.filter(
    (c) =>
      c.source === 'transcription' &&
      !c.isDeleted &&
      c.userTags.includes('transcript:raw'),
  );
}

/**
 * Process any existing raw cards found when opening a session.
 * This handles the case where the user closed or refreshed the app
 * before the pipeline had a chance to process their transcript.
 */
function processExistingRawCards(): void {
  if (!initialised) return;
  const rawCards = getRawCards();
  console.log(
    `[transcript-pipeline] Session load check: ${rawCards.length} raw cards found, API key ${getApiKey() ? 'available' : 'NOT available'}`,
  );
  if (rawCards.length > 0) {
    // Always set firstRawAt so the poll loop can pick them up
    if (firstRawAt === null) firstRawAt = Date.now() - TIME_TRIGGER_MS;
    // If we have enough and not already running, run immediately
    if (rawCards.length >= MIN_RAW_CARDS_TIME && !running) {
      runPipeline(rawCards);
    }
  }
}

function handleCardCreated({ card }: { card: Card }): void {
  if (card.source !== 'transcription') return;
  if (!card.userTags.includes('transcript:raw')) return;

  // Track when we first saw raw cards in this batch
  if (firstRawAt === null) firstRawAt = Date.now();

  // Count-based trigger — only if not already running
  if (!running) {
    const rawCards = getRawCards();
    if (rawCards.length >= MIN_RAW_CARDS) {
      runPipeline(rawCards);
    }
  }
}

/**
 * Unified poll check — runs every POLL_MS.
 * Handles four cases:
 *   1. Time-based trigger (raw cards sitting for > TIME_TRIGGER_MS)
 *   2. Re-check after pipeline finishes (raw cards accumulated while running)
 *   3. Pending flush (flush was requested while pipeline was running)
 *   4. Raw cards waiting for API key (retry on session load)
 */
function pollCheck(): void {
  if (running) return; // let it finish

  const rawCards = getRawCards();
  if (rawCards.length === 0) {
    firstRawAt = null;
    pendingFlush = false;
    return;
  }

  // Case 3: Pending flush — process whatever we have
  if (pendingFlush) {
    pendingFlush = false;
    console.log(
      `[transcript-pipeline] Pending flush: ${rawCards.length} raw cards`,
    );
    runPipeline(rawCards);
    return;
  }

  // Case 2: Re-check — cards accumulated while we were running
  if (rawCards.length >= MIN_RAW_CARDS) {
    console.log(
      `[transcript-pipeline] Re-check trigger: ${rawCards.length} raw cards`,
    );
    runPipeline(rawCards);
    return;
  }

  // Case 1 & 4: Time-based trigger (also catches session-load retries)
  if (firstRawAt !== null) {
    const elapsed = Date.now() - firstRawAt;
    if (elapsed >= TIME_TRIGGER_MS && rawCards.length >= MIN_RAW_CARDS_TIME) {
      console.log(
        `[transcript-pipeline] Time trigger: ${rawCards.length} raw cards after ${Math.round(elapsed / 1000)}s`,
      );
      runPipeline(rawCards);
    }
  } else if (rawCards.length >= MIN_RAW_CARDS_TIME) {
    // Raw cards exist but firstRawAt was cleared (e.g. after a failed pipeline run)
    // Re-set it so the time trigger can eventually fire
    firstRawAt = Date.now();
  }
}

// ── Core pipeline ───────────────────────────────────────────────────────────

async function runPipeline(rawCards: Card[]): Promise<void> {
  if (running || rawCards.length === 0) return;
  running = true;

  // Snapshot the IDs we're processing so we don't re-process them
  const processingIds = new Set(rawCards.map((c) => c.id));

  const batchId = uid();
  console.log(
    `[transcript-pipeline] Starting batch ${batchId}: ${rawCards.length} raw cards`,
  );
  bus.emit('transcript:pipeline:started', {
    batchId,
    rawCardCount: rawCards.length,
  });

  try {
    // Check API key before attempting LLM call
    if (!getApiKey()) {
      console.warn(
        '[transcript-pipeline] No API key available — will retry via poll loop',
      );
      // Set firstRawAt so the poll loop retries
      firstRawAt = Date.now();
      return; // finally block will set running = false
    }

    // 1. Concatenate raw cards with speaker labels
    const concatenated = rawCards
      .map((c) => {
        const speaker = c.speaker ? `[${c.speaker}]: ` : '';
        return speaker + c.content;
      })
      .join('\n');

    // 2. Ask LLM to re-segment and clean (with retries)
    let cleanSections: string[] = [];
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      cleanSections = await resegmentAndClean(concatenated);
      if (cleanSections.length > 0) break;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * attempt;
        console.warn(
          `[transcript-pipeline] LLM returned no sections (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay / 1000}s...`,
        );
        await sleep(delay);
      }
    }

    if (cleanSections.length === 0) {
      console.warn('[transcript-pipeline] LLM returned no sections after retries — will retry via poll loop');
      // Set firstRawAt so the poll loop retries later
      firstRawAt = Date.now();
      return; // finally block will set running = false
    }

    // 3. Create clean cards
    // Re-read store to get fresh state (cards may have changed during await)
    const store = useSessionStore.getState();
    const tcol = store.columns.find((c) => c.type === 'transcript');
    if (!tcol || !store.session?.id) {
      console.warn('[transcript-pipeline] No transcript column or session — aborting');
      return;
    }

    // Build source card references for the clean cards
    const sourceRefs = rawCards.map((c) => ({
      id: c.id,
      label: 'Raw',
      color: '#f97316',
      icon: '\uD83C\uDF10', // 🌐
    }));

    // Infer speaker from raw cards (most common speaker)
    const speakerCounts: Record<string, number> = {};
    for (const c of rawCards) {
      if (c.speaker) {
        speakerCounts[c.speaker] = (speakerCounts[c.speaker] || 0) + 1;
      }
    }
    const dominantSpeaker =
      Object.entries(speakerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'You';

    let cleanCardCount = 0;

    for (const section of cleanSections) {
      if (!section.trim()) continue;

      // Extract speaker label if present: [Name]: text
      let speaker = dominantSpeaker;
      let content = section.trim();
      const speakerMatch = content.match(/^\[([^\]]+)\]:\s*/);
      if (speakerMatch) {
        speaker = speakerMatch[1];
        content = content.slice(speakerMatch[0].length).trim();
      }

      if (!content) continue;

      // Get sort order: after all existing cards in transcript column
      // Re-read from store each time since addCard mutates it
      const freshStore = useSessionStore.getState();
      const existing = freshStore.cards.filter(
        (c) => c.columnId === tcol.id && !c.isDeleted,
      );
      const last = existing[existing.length - 1];

      freshStore.addCard({
        id: uid(),
        columnId: tcol.id,
        sessionId: store.session!.id,
        content,
        source: 'transcription',
        speaker,
        timestamp: rawCards[0]?.timestamp,
        sourceCardIds: sourceRefs,
        aiTags: [],
        userTags: ['transcript:clean'],
        highlightedBy: 'none',
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
        sortOrder: last ? mid(last.sortOrder) : 'n',
      });

      cleanCardCount++;
    }

    // 4. Mark raw cards as processed (only the ones we snapshotted)
    const latestStore = useSessionStore.getState();
    for (const c of rawCards) {
      // Re-read the card to get its current state (it may have changed)
      const current = latestStore.cards.find((cc) => cc.id === c.id);
      if (!current) continue;
      // Only transition cards we actually processed
      if (!processingIds.has(c.id)) continue;
      const newTags = current.userTags
        .filter((t) => t !== 'transcript:raw')
        .concat('transcript:processed');
      latestStore.updateCard(c.id, { userTags: newTags });
    }

    console.log(
      `[transcript-pipeline] Batch ${batchId} complete: ${cleanCardCount} clean cards from ${rawCards.length} raw cards`,
    );
    bus.emit('transcript:pipeline:completed', { batchId, cleanCardCount });
  } catch (e) {
    console.error('[transcript-pipeline] Pipeline error:', e);
    // On error, ensure retry by setting firstRawAt
    firstRawAt = Date.now();
  } finally {
    running = false;
    // After finishing, check if new raw cards accumulated during our run.
    const remaining = getRawCards();
    if (remaining.length > 0) {
      // Reset firstRawAt so time-based trigger can fire for the new batch
      if (firstRawAt === null) firstRawAt = Date.now();
      // If enough cards or pending flush, run again soon (yield to event loop)
      if (remaining.length >= MIN_RAW_CARDS || pendingFlush) {
        pendingFlush = false;
        setTimeout(() => {
          const cards = getRawCards();
          if (cards.length > 0 && !running) runPipeline(cards);
        }, 100);
      }
    }
  }
}

// ── LLM: re-segment + clean filler ─────────────────────────────────────────

const SYSTEM_PROMPT = `You are a transcript post-processor. Your job is two things:

1. RE-SEGMENT: Split the transcript into meaningful, self-contained sections. Each section should contain a complete thought, idea, or topic. Do NOT split mid-sentence or mid-idea. Sections should be 1-4 sentences each.

2. CLEAN FILLER: Remove filler words and verbal tics: um, uh, er, ah, like (when used as filler), you know, I mean, sort of, kind of, basically, actually, right?, okay so, so yeah. Also remove false starts and repeated words ("I I think" → "I think").

CRITICAL RULES:
- This is NOT summarisation. Preserve ALL substantive content and meaning.
- Every meaningful word the speaker said must appear in your output.
- Keep the speaker's voice, vocabulary, and phrasing (minus filler).
- If speaker labels are present as [Name]:, preserve them at the start of each section where that speaker is talking.
- Separate sections with a single blank line.
- Do NOT add headers, numbers, bullets, or any formatting — just the cleaned text in sections.
- Do NOT add any commentary or meta-text.
- Output ONLY the cleaned, re-segmented transcript text.`;

async function resegmentAndClean(
  concatenatedText: string,
): Promise<string[]> {
  const userPrompt = `Here is the raw transcript to re-segment and clean:\n\n${concatenatedText}`;

  try {
    const result = await askClaude(SYSTEM_PROMPT, userPrompt, 4096);
    if (!result) {
      console.warn('[transcript-pipeline] askClaude returned null');
      return [];
    }

    // Split on blank lines to get sections
    const sections = result
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    return sections;
  } catch (e) {
    console.error('[transcript-pipeline] LLM call failed:', e);
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
