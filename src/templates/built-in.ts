// ============================================================================
// Built-in Session Templates
// ============================================================================

import type { SessionTemplate } from '@/types';

/**
 * Built-in session templates. Each template configures which agents and
 * columns are active, what mode to default to, and provides a system prompt
 * that guides the Chat and gives agents session-specific context.
 *
 * Agent IDs reference the built-in agent registry (see src/agents/built-in/).
 * Column types reference ColumnType from src/types/index.ts.
 */
export const BUILT_IN_TEMPLATES: readonly SessionTemplate[] = [
  {
    id: 'brainstorm',
    name: 'Brainstorming',
    icon: 'brainstorm',
    description: 'Freeform ideation with concept extraction, idea generation, and pattern finding.',
    enabledAgentIds: [
      'concepts', 'ideas', 'questions', 'pattern-finder',
      'alternative-finder', 'actions', 'challenger', 'supporter',
      'visionary', 'summariser', 'knowledge-manager',
    ],
    visibleColumnTypes: [
      'transcript', 'notes', 'concepts', 'ideas', 'questions',
      'alternatives', 'actions', 'highlights',
    ],
    defaultMode: 'active',
    systemPrompt:
      'This is a brainstorming session. Focus on generating creative ideas, finding patterns across ' +
      'concepts, and exploring alternatives. Encourage divergent thinking. Avoid premature criticism — ' +
      'build on ideas rather than shutting them down. Highlight connections between different concepts.',
    goalPlaceholder: 'What topic or problem are we brainstorming about?',
    isBuiltIn: true,
  },
  {
    id: 'research',
    name: 'Research Review',
    icon: 'research',
    description: 'Analyse documents, extract claims, verify facts, and surface gaps.',
    enabledAgentIds: [
      'concepts', 'claims', 'claim-verifier', 'claim-challenger',
      'gaps', 'questions', 'researcher', 'actions',
      'summariser', 'knowledge-manager',
    ],
    visibleColumnTypes: [
      'transcript', 'notes', 'context', 'concepts', 'claims',
      'questions', 'gaps', 'deep_research', 'highlights',
    ],
    defaultMode: 'active',
    systemPrompt:
      'This is a research review session. Focus on identifying and verifying claims, finding gaps in ' +
      'evidence, and surfacing questions that need investigation. Be rigorous about distinguishing ' +
      'facts from opinions. Flag unsupported assertions.',
    goalPlaceholder: 'What research or documents are we reviewing?',
    isBuiltIn: true,
  },
  {
    id: 'decision',
    name: 'Decision Making',
    icon: 'decision',
    description: 'Weigh tradeoffs, find alternatives, and track action items.',
    enabledAgentIds: [
      'concepts', 'gaps', 'actions', 'alternative-finder',
      'tradeoff-enumerator', 'constraint-finder', 'requirement-finder',
      'questions', 'pragmatist', 'skeptic', 'summariser',
      'knowledge-manager',
    ],
    visibleColumnTypes: [
      'transcript', 'notes', 'observations', 'concepts', 'questions',
      'gaps', 'actions', 'alternatives', 'highlights',
    ],
    defaultMode: 'active',
    systemPrompt:
      'This is a decision-making session. Focus on identifying the decision to be made, mapping ' +
      'alternatives, weighing tradeoffs, surfacing constraints and requirements, and tracking ' +
      'agreed-upon action items. Challenge assumptions and ensure all options are considered.',
    goalPlaceholder: 'What decision needs to be made?',
    isBuiltIn: true,
  },
  {
    id: 'retro',
    name: 'Retrospective',
    icon: 'retro',
    description: 'Review what went well, what didn\'t, and generate improvements.',
    enabledAgentIds: [
      'concepts', 'observations', 'gaps', 'actions',
      'ideas', 'pattern-finder', 'problem-finder',
      'solution-finder', 'summariser', 'knowledge-manager',
    ],
    visibleColumnTypes: [
      'transcript', 'notes', 'observations', 'concepts', 'gaps',
      'ideas', 'actions', 'highlights',
    ],
    defaultMode: 'active',
    systemPrompt:
      'This is a retrospective session. Focus on identifying what went well, what didn\'t go well, ' +
      'and actionable improvements. Look for patterns across problems. Ensure action items are ' +
      'specific and have owners. Be constructive rather than blame-oriented.',
    goalPlaceholder: 'What project, sprint, or event are we reflecting on?',
    isBuiltIn: true,
  },
  {
    id: 'interview',
    name: 'Interview Notes',
    icon: 'interview',
    description: 'Capture and analyse interview transcripts with question tracking.',
    enabledAgentIds: [
      'concepts', 'claims', 'questions', 'observations',
      'gaps', 'actions', 'clarity-seeker',
      'summariser', 'knowledge-manager',
    ],
    visibleColumnTypes: [
      'transcript', 'notes', 'observations', 'concepts', 'claims',
      'questions', 'gaps', 'actions', 'highlights',
    ],
    defaultMode: 'sidekick',
    systemPrompt:
      'This is an interview session. Focus on capturing key statements, identifying claims made ' +
      'by the interviewee, tracking which questions have been asked and answered, and noting gaps ' +
      'where follow-up questions would be valuable. Preserve the interviewee\'s original phrasing ' +
      'for important statements.',
    goalPlaceholder: 'Who is being interviewed and what is the topic?',
    isBuiltIn: true,
  },
  {
    id: 'strategy',
    name: 'Strategy Session',
    icon: 'strategy',
    description: 'High-level planning with gap analysis, alternatives, and actions.',
    enabledAgentIds: [
      'concepts', 'gaps', 'actions', 'alternative-finder',
      'tradeoff-enumerator', 'constraint-finder', 'planner',
      'visionary', 'pragmatist', 'questions',
      'summariser', 'knowledge-manager',
    ],
    visibleColumnTypes: [
      'transcript', 'notes', 'concepts', 'questions', 'gaps',
      'actions', 'alternatives', 'highlights',
    ],
    defaultMode: 'active',
    systemPrompt:
      'This is a strategy session. Focus on high-level goals, identifying strategic options, ' +
      'analysing gaps between current state and desired outcomes, and defining concrete next steps. ' +
      'Balance visionary thinking with practical constraints. Track decisions and action items.',
    goalPlaceholder: 'What strategic topic or initiative are we planning?',
    isBuiltIn: true,
  },
] as const;

/** Look up a built-in template by ID. */
export function getBuiltInTemplate(id: string): SessionTemplate | undefined {
  return BUILT_IN_TEMPLATES.find(t => t.id === id);
}
