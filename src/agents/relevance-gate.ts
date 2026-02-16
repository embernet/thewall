// ---------------------------------------------------------------------------
// Relevance Gate — filler detection + topic tagging
//
// Runs once per transcript batch (not per agent). Determines:
// 1. Whether the batch has enough substance to trigger agents at all
// 2. Which topic areas the batch relates to (for per-agent filtering)
//
// Zero LLM calls — purely keyword / heuristic based.
// ---------------------------------------------------------------------------

// Common filler words and phrases that indicate non-substantive speech
const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'you', 'know', 'basically', 'sort', 'kind',
  'actually', 'literally', 'right', 'okay', 'ok', 'yeah', 'yes', 'no',
  'well', 'so', 'just', 'really', 'very', 'quite', 'oh', 'ah',
  'hey', 'hi', 'hello', 'bye', 'thanks', 'thank', 'sorry', 'please',
  'hmm', 'hm', 'mm', 'mhm', 'uh-huh', 'anyway', 'anyways',
]);

// Phrases that indicate the entire utterance is filler
const FILLER_PHRASES = [
  'can you hear me',
  'let me think',
  'one moment',
  'hold on',
  'are we recording',
  'is this working',
  'can everyone hear',
  'let me share',
  'give me a second',
  'bear with me',
  'sorry about that',
  'where was i',
  'as i was saying',
];

/** Topic keywords — each tag maps to domain-specific terms. */
const TOPIC_KEYWORDS = new Map<string, string[]>([
  ['action',   ['action', 'todo', 'assign', 'deadline', 'responsible', 'follow up', 'next step', 'deliver', 'owner', 'complete by', 'due date', 'task']],
  ['risk',     ['risk', 'gap', 'missing', 'assumption', 'unclear', 'concern', 'worry', 'problem', 'danger', 'threat', 'failure', 'blocker', 'obstacle']],
  ['claim',    ['claim', 'fact', 'data', 'evidence', 'statistic', 'research', 'proven', 'study', 'survey', 'percent', 'number', 'metric', 'measured']],
  ['concept',  ['concept', 'idea', 'theme', 'framework', 'approach', 'theory', 'model', 'principle', 'strategy', 'architecture', 'pattern', 'method']],
  ['question', ['question', 'unclear', 'wonder', 'curious', 'doubt', 'how do', 'what if', 'why does', 'who will', 'when will']],
  ['decision', ['decide', 'agree', 'disagree', 'vote', 'consensus', 'choose', 'option', 'alternative', 'trade-off', 'tradeoff', 'pros and cons']],
]);

export interface BatchAssessment {
  /** Whether the batch has enough substance to warrant agent processing. */
  isSubstantive: boolean;
  /** Topic tags that describe what the batch is about. */
  tags: Set<string>;
  /** Substance ratio (content words / total words). */
  substanceRatio: number;
}

/**
 * Assess a transcript batch for substance and topic relevance.
 * Returns tags that can be checked against per-agent relevance maps.
 */
export function assessBatch(batchText: string): BatchAssessment {
  const text = batchText.toLowerCase().trim();

  // Check for complete filler phrases first
  if (FILLER_PHRASES.some(p => text.includes(p)) && text.length < 60) {
    return { isSubstantive: false, tags: new Set(), substanceRatio: 0 };
  }

  // Tokenize and compute substance ratio
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return { isSubstantive: false, tags: new Set(), substanceRatio: 0 };
  }

  const contentWords = words.filter(w => w.length > 2 && !FILLER_WORDS.has(w));
  const substanceRatio = contentWords.length / words.length;

  // Reject batches with very low substance
  if (substanceRatio < 0.3 || contentWords.length < 3) {
    return { isSubstantive: false, tags: new Set(), substanceRatio };
  }

  // Tag extraction: check batch against keyword sets
  const tags = new Set<string>(['general']); // 'general' always present for substantive batches
  for (const [tag, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.add(tag);
    }
  }

  return { isSubstantive: true, tags, substanceRatio };
}
