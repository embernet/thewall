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
import { askClaude } from '@/utils/llm';
import { uid, now, mid } from '@/utils/ids';
import type { Card } from '@/types';

// ── Tuning constants ────────────────────────────────────────────────────────

/** Minimum raw cards before triggering the pipeline. */
const MIN_RAW_CARDS = 5;

/** Time-based trigger: run pipeline after this many ms with 2+ raw cards. */
const TIME_TRIGGER_MS = 45_000;

/** Minimum raw cards for the time-based trigger. */
const MIN_RAW_CARDS_TIME = 2;

/** Polling interval for the time-based trigger check. */
const POLL_MS = 5_000;

// ── Pipeline state ──────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;
let firstRawAt: number | null = null;
let running = false;
let initialised = false;

// ── Lifecycle ───────────────────────────────────────────────────────────────

export function initTranscriptPipeline(): void {
  if (initialised) return;
  initialised = true;
  firstRawAt = null;
  running = false;

  bus.on('card:created', handleCardCreated);
  pollTimer = setInterval(checkTimeTrigger, POLL_MS);
  console.debug('[transcript-pipeline] Initialised');
}

export function destroyTranscriptPipeline(): void {
  bus.off('card:created', handleCardCreated);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  firstRawAt = null;
  running = false;
  initialised = false;
  console.debug('[transcript-pipeline] Destroyed');
}

/**
 * Force-flush: process any remaining raw cards immediately.
 * Called when the user stops recording.
 */
export async function flushTranscriptPipeline(): Promise<void> {
  const rawCards = getRawCards();
  if (rawCards.length >= MIN_RAW_CARDS_TIME) {
    console.debug(`[transcript-pipeline] Flush: ${rawCards.length} raw cards`);
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

function handleCardCreated({ card }: { card: Card }): void {
  if (card.source !== 'transcription') return;
  if (!card.userTags.includes('transcript:raw')) return;

  // Track when we first saw raw cards in this batch
  if (firstRawAt === null) firstRawAt = Date.now();

  // Count-based trigger
  const rawCards = getRawCards();
  if (rawCards.length >= MIN_RAW_CARDS && !running) {
    runPipeline(rawCards);
  }
}

function checkTimeTrigger(): void {
  if (running || firstRawAt === null) return;

  const elapsed = Date.now() - firstRawAt;
  if (elapsed < TIME_TRIGGER_MS) return;

  const rawCards = getRawCards();
  if (rawCards.length >= MIN_RAW_CARDS_TIME) {
    console.debug(
      `[transcript-pipeline] Time trigger: ${rawCards.length} raw cards after ${Math.round(elapsed / 1000)}s`,
    );
    runPipeline(rawCards);
  }
}

// ── Core pipeline ───────────────────────────────────────────────────────────

async function runPipeline(rawCards: Card[]): Promise<void> {
  if (running || rawCards.length === 0) return;
  running = true;
  firstRawAt = null;

  const batchId = uid();
  console.debug(
    `[transcript-pipeline] Starting batch ${batchId}: ${rawCards.length} raw cards`,
  );
  bus.emit('transcript:pipeline:started', {
    batchId,
    rawCardCount: rawCards.length,
  });

  try {
    // 1. Concatenate raw cards with speaker labels
    const concatenated = rawCards
      .map((c) => {
        const speaker = c.speaker ? `[${c.speaker}]: ` : '';
        return speaker + c.content;
      })
      .join('\n');

    // 2. Ask LLM to re-segment and clean
    const cleanSections = await resegmentAndClean(concatenated);

    if (!cleanSections || cleanSections.length === 0) {
      console.warn('[transcript-pipeline] LLM returned no sections');
      running = false;
      return;
    }

    // 3. Create clean cards
    const store = useSessionStore.getState();
    const tcol = store.columns.find((c) => c.type === 'transcript');
    if (!tcol || !store.session?.id) {
      running = false;
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
      const existing = store.cards.filter(
        (c) => c.columnId === tcol.id && !c.isDeleted,
      );
      const last = existing[existing.length - 1];

      store.addCard({
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

    // 4. Mark raw cards as processed
    for (const c of rawCards) {
      const newTags = c.userTags
        .filter((t) => t !== 'transcript:raw')
        .concat('transcript:processed');
      store.updateCard(c.id, { userTags: newTags });
    }

    console.debug(
      `[transcript-pipeline] Batch ${batchId} complete: ${cleanCardCount} clean cards from ${rawCards.length} raw cards`,
    );
    bus.emit('transcript:pipeline:completed', { batchId, cleanCardCount });
  } catch (e) {
    console.error('[transcript-pipeline] Pipeline error:', e);
  } finally {
    running = false;
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

  const result = await askClaude(SYSTEM_PROMPT, userPrompt, 4096);
  if (!result) return [];

  // Split on blank lines to get sections
  const sections = result
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return sections;
}
