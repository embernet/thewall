// ============================================================================
// Summary Prompts — pre-canned and custom summary prompt definitions
// ============================================================================

export interface SummaryPrompt {
  id: string;
  label: string;
  prompt: string;
  builtIn: boolean;
}

// ---------------------------------------------------------------------------
// Default built-in prompts
// ---------------------------------------------------------------------------

export const DEFAULT_SUMMARY_PROMPTS: readonly SummaryPrompt[] = [
  {
    id: 'simple-summary',
    label: 'Simple Summary',
    builtIn: true,
    prompt:
      'Provide a clear, concise summary of this session. Cover the main topics discussed, key points raised, and any conclusions reached. Use plain language and keep it brief — aim for a few short paragraphs.',
  },
  {
    id: 'meeting-notes',
    label: 'Meeting Notes',
    builtIn: true,
    prompt:
      'Format this as structured meeting notes with the following sections:\n\n## Attendees\nList the speakers/participants mentioned.\n\n## Agenda / Topics Discussed\nBullet each major topic.\n\n## Key Decisions\nList any decisions that were made.\n\n## Action Items\nList action items with owners where mentioned.\n\n## Next Steps\nAny follow-ups or future plans discussed.',
  },
  {
    id: 'presentation-summary',
    label: 'Presentation Summary',
    builtIn: true,
    prompt:
      'Summarize this as if it were a presentation or pitch that was given. Structure it as:\n\n## Title / Topic\nThe main subject of the presentation.\n\n## Key Messages\nThe 3-5 most important points the presenter wanted to convey.\n\n## Supporting Evidence\nData, examples, or arguments used to support the key messages.\n\n## Audience Questions & Discussion\nAny questions raised or discussion points.\n\n## Takeaways\nWhat the audience should remember or do after this presentation.',
  },
  {
    id: 'pitch-assessment',
    label: 'Pitch Assessment',
    builtIn: true,
    prompt:
      'Assess this session as if it were a business pitch or proposal. Provide:\n\n## The Pitch\nWhat is being proposed and by whom.\n\n## Strengths\nWhat was compelling, well-argued, or differentiated.\n\n## Weaknesses\nGaps, unconvincing arguments, missing evidence, or risks.\n\n## Questions Not Addressed\nImportant questions that were left unanswered.\n\n## Overall Assessment\nA brief overall evaluation of the pitch quality and likelihood of success.\n\n## Recommendations\nSuggestions for improvement.',
  },
  {
    id: 'brainstorm-summary',
    label: 'Brainstorm Summary',
    builtIn: true,
    prompt:
      'Summarize this brainstorming session. Organize the output as:\n\n## Problem / Challenge\nWhat was being brainstormed about.\n\n## Ideas Generated\nGroup and list the ideas that came up, organized by theme or category.\n\n## Most Promising Ideas\nHighlight the ideas that seemed to gain the most traction or enthusiasm.\n\n## Concerns & Constraints\nAny limitations, risks, or pushback mentioned.\n\n## Next Steps\nAny agreed actions for developing the ideas further.',
  },
] as const;

// ---------------------------------------------------------------------------
// Local storage persistence for user-customized prompts
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'wall:summaryPrompts';

/** Load all summary prompts (built-in defaults merged with user customizations). */
export function loadSummaryPrompts(): SummaryPrompt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored: SummaryPrompt[] = JSON.parse(raw);
      // Merge: keep user edits of built-ins, add any new built-ins, keep custom prompts
      const builtInIds = new Set(DEFAULT_SUMMARY_PROMPTS.map(p => p.id));
      const storedMap = new Map(stored.map(p => [p.id, p]));

      const merged: SummaryPrompt[] = [];
      // Add built-ins (use stored version if user has edited it)
      for (const def of DEFAULT_SUMMARY_PROMPTS) {
        const userVersion = storedMap.get(def.id);
        merged.push(userVersion ?? { ...def });
      }
      // Add user custom prompts
      for (const s of stored) {
        if (!builtInIds.has(s.id)) {
          merged.push(s);
        }
      }
      return merged;
    }
  } catch (e) {
    console.warn('Failed to load summary prompts:', e);
  }
  return DEFAULT_SUMMARY_PROMPTS.map(p => ({ ...p }));
}

/** Save the full prompts list to local storage. */
export function saveSummaryPrompts(prompts: SummaryPrompt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  } catch (e) {
    console.warn('Failed to save summary prompts:', e);
  }
}

/** Reset a built-in prompt to its default. Returns the updated list. */
export function resetBuiltInPrompt(promptId: string): SummaryPrompt[] {
  const prompts = loadSummaryPrompts();
  const def = DEFAULT_SUMMARY_PROMPTS.find(p => p.id === promptId);
  if (!def) return prompts;
  const updated = prompts.map(p => p.id === promptId ? { ...def } : p);
  saveSummaryPrompts(updated);
  return updated;
}

/** Reset ALL built-in prompts to their defaults. Returns the updated list. */
export function resetAllBuiltInPrompts(): SummaryPrompt[] {
  const prompts = loadSummaryPrompts();
  const builtInMap = new Map(DEFAULT_SUMMARY_PROMPTS.map(p => [p.id, p]));
  const updated = prompts.map(p => {
    const def = builtInMap.get(p.id);
    return def ? { ...def } : p;
  });
  saveSummaryPrompts(updated);
  return updated;
}
