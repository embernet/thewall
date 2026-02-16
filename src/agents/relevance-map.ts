// ---------------------------------------------------------------------------
// Agent Relevance Map — maps agent IDs to topic tags they care about
//
// An agent only runs on a batch if the batch has at least one matching tag.
// Agents NOT in this map always run (no filtering).
// Agents mapped to ['general'] always run on substantive content.
// ---------------------------------------------------------------------------

/**
 * Maps agent ID → array of topic tags from the relevance gate.
 *
 * Primary agents (high priority) are mapped to ['general'] so they always fire.
 * Secondary/niche agents are mapped to specific topics so they only fire when
 * the batch content is relevant to their domain.
 */
export const AGENT_RELEVANCE: Record<string, string[]> = {
  // Primary agents — always fire on substantive content
  'concepts':          ['general'],
  'questioner':        ['general'],
  'claims':            ['general'],
  'gaps':              ['general'],
  'actions':           ['general'],
  'summariser':        ['general'],
  'knowledge-manager': ['general'],

  // Secondary agents — fire on matching topics
  'pattern-finder':    ['general', 'concept'],
  'clarity-seeker':    ['general', 'question'],
  'tension-finder':    ['risk', 'decision', 'claim'],
  'alternative-finder':['decision', 'concept', 'action'],
  'researcher':        ['claim', 'concept', 'question'],
  'supporter':         ['claim', 'concept', 'decision'],
  'challenger':        ['claim', 'decision', 'risk'],

  // Niche agents (disabled by default, but if user enables them)
  'refiner':           ['concept', 'decision'],
  'thinker':           ['concept', 'question'],
  'coach':             ['action', 'decision', 'question'],
  'rhetoric-generator':['claim', 'decision'],
  'chain-of-thought':  ['concept', 'risk', 'decision'],
  'cliche-finder':     ['general'],
  'constraint-finder': ['risk', 'action', 'decision'],
  'requirement-finder':['action', 'concept'],
  'tradeoff-enumerator':['decision', 'risk'],
  'problem-finder':    ['risk'],
  'skeptic':           ['claim', 'risk'],
  'problem-solver':    ['risk', 'action'],
  'visionary':         ['concept', 'decision'],
  'collaborator':      ['concept', 'decision'],
  'pragmatist':        ['risk', 'action'],
};
