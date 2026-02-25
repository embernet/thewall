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
    summaryPrompt:
      'Produce a structured summary of this brainstorming session organised into the following sections:\n\n' +
      '**Problem / Challenge** — State the central problem or topic the brainstorming focused on.\n\n' +
      '**Ideas Generated** — List the ideas that emerged, grouped by theme where possible. Include brief descriptions.\n\n' +
      '**Most Promising Ideas** — Highlight the ideas that gained the most traction or had the strongest supporting arguments. Explain why they stand out.\n\n' +
      '**Patterns & Connections** — Note any recurring themes, unexpected connections between ideas, or cross-cutting insights.\n\n' +
      '**Open Questions** — List questions that remain unanswered or need further exploration.\n\n' +
      '**Concerns & Constraints** — Capture any practical limitations, risks, or pushback that was raised.\n\n' +
      '**Next Steps** — List concrete follow-up actions, who is responsible, and any priorities agreed upon.\n\n' +
      'Be concise but thorough. Use bullet points within each section. If a section has no relevant content, omit it.',
    summaryPromptLabel: 'Brainstorming',
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
    summaryPrompt:
      'Produce a structured summary of this research review organised into the following sections:\n\n' +
      '**Research Overview** — Briefly describe the material reviewed and the scope of the analysis.\n\n' +
      '**Key Claims & Findings** — List the most significant claims or findings identified, noting the strength of evidence for each.\n\n' +
      '**Verified vs. Unverified** — Distinguish claims that were supported by evidence from those that remain unverified or disputed.\n\n' +
      '**Gaps in Evidence** — Identify areas where evidence is missing, insufficient, or contradictory.\n\n' +
      '**Open Questions** — List questions that emerged during the review and need further investigation.\n\n' +
      '**Methodological Concerns** — Note any issues with methodology, bias, or reliability raised during discussion.\n\n' +
      '**Implications & Significance** — Summarise what the findings mean in context and why they matter.\n\n' +
      '**Recommended Next Steps** — List follow-up research, reading, or actions needed.\n\n' +
      'Be concise but thorough. Use bullet points within each section. If a section has no relevant content, omit it.',
    summaryPromptLabel: 'Research Review',
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
    summaryPrompt:
      'Produce a structured summary of this decision-making session organised into the following sections:\n\n' +
      '**Decision Statement** — Clearly state the decision that was being considered.\n\n' +
      '**Options Evaluated** — List each alternative that was discussed, with a brief description of its merits.\n\n' +
      '**Trade-offs & Comparisons** — Summarise the key trade-offs between options, including cost, risk, time, and impact considerations.\n\n' +
      '**Constraints & Requirements** — List any hard constraints, non-negotiable requirements, or boundary conditions that shaped the decision.\n\n' +
      '**Risks & Concerns** — Identify risks associated with the leading options and any concerns raised by participants.\n\n' +
      '**Decision Reached** — State the decision if one was made, including the rationale. If no decision was reached, explain what is blocking it.\n\n' +
      '**Assumptions** — List key assumptions underlying the decision that should be monitored or validated.\n\n' +
      '**Actions & Owners** — List concrete next steps with owners and deadlines where specified.\n\n' +
      'Be concise but thorough. Use bullet points within each section. If a section has no relevant content, omit it.',
    summaryPromptLabel: 'Decision Making',
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
    summaryPrompt:
      'Produce a structured summary of this retrospective organised into the following sections:\n\n' +
      '**Context** — Briefly describe the project, sprint, or event being reviewed.\n\n' +
      '**What Went Well** — List the successes, positive outcomes, and things the team should continue doing.\n\n' +
      '**What Didn\'t Go Well** — List the problems, frustrations, and areas where things fell short. Be specific about impact.\n\n' +
      '**Root Causes & Patterns** — Identify recurring themes or underlying causes behind the issues raised. Note any patterns that span multiple problems.\n\n' +
      '**Key Learnings** — Summarise the most important lessons and insights from the discussion.\n\n' +
      '**Improvement Ideas** — List proposed improvements and changes, noting which are quick wins versus longer-term investments.\n\n' +
      '**Actions & Owners** — List specific, actionable commitments with clear owners and timelines.\n\n' +
      'Be concise but thorough. Use bullet points within each section. If a section has no relevant content, omit it.',
    summaryPromptLabel: 'Retrospective',
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
    summaryPrompt:
      'Produce a structured summary of this interview organised into the following sections:\n\n' +
      '**Interview Overview** — State who was interviewed, their role or context, and the main topic or purpose of the interview.\n\n' +
      '**Key Statements & Claims** — List the most significant statements made by the interviewee, preserving their original phrasing where it matters. Note any factual claims that could be verified.\n\n' +
      '**Themes & Insights** — Summarise the major themes that emerged and any notable insights or perspectives the interviewee shared.\n\n' +
      '**Areas of Emphasis** — Note topics the interviewee felt strongly about, returned to repeatedly, or spent the most time on.\n\n' +
      '**Gaps & Unanswered Questions** — Identify questions that were not fully answered, topics that were avoided or deflected, and areas that need follow-up.\n\n' +
      '**Contradictions or Tensions** — Flag any inconsistencies within the interviewee\'s responses or between their claims and known information.\n\n' +
      '**Follow-up Actions** — List recommended follow-up questions, fact-checks to perform, and next steps.\n\n' +
      'Be concise but thorough. Use bullet points within each section. If a section has no relevant content, omit it.',
    summaryPromptLabel: 'Interview Notes',
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
    summaryPrompt:
      'Produce a structured summary of this strategy session organised into the following sections:\n\n' +
      '**Strategic Objective** — State the high-level goal or initiative the session focused on.\n\n' +
      '**Current State Assessment** — Summarise the key points about where things stand today, including strengths and weaknesses discussed.\n\n' +
      '**Strategic Options** — List the options or approaches that were considered, with brief descriptions of each.\n\n' +
      '**Trade-offs & Analysis** — Summarise the key trade-offs between options, including feasibility, impact, cost, and timeline considerations.\n\n' +
      '**Gaps & Risks** — Identify gaps between the current state and desired outcomes, and risks that could derail progress.\n\n' +
      '**Constraints & Dependencies** — List practical constraints, resource limitations, or external dependencies that affect the strategy.\n\n' +
      '**Agreed Direction** — State any strategic direction or priorities that were agreed upon. If no consensus was reached, summarise the outstanding disagreements.\n\n' +
      '**Actions & Milestones** — List concrete next steps with owners, timelines, and key milestones where specified.\n\n' +
      'Be concise but thorough. Use bullet points within each section. If a section has no relevant content, omit it.',
    summaryPromptLabel: 'Strategy Session',
    isBuiltIn: true,
  },
  {
    id: 'collaboration',
    name: 'Collaboration Meeting',
    icon: 'collaboration',
    description: 'Meetings between partner organisations or groups working on shared goals.',
    enabledAgentIds: [
      'concepts', 'questions', 'actions', 'ideas', 'gaps',
      'observations', 'pattern-finder', 'collaborator', 'supporter',
      'pragmatist', 'clarity-seeker', 'problem-solver', 'solution-finder',
      'summariser', 'knowledge-manager',
    ],
    visibleColumnTypes: [
      'transcript', 'notes', 'observations', 'concepts', 'ideas',
      'questions', 'gaps', 'actions', 'highlights',
    ],
    defaultMode: 'active',
    systemPrompt:
      'This is a collaboration meeting between partner organisations or groups. Focus on shared ' +
      'goals, mutual priorities, and opportunities for joint progress. Surface key questions each ' +
      'party raises, best practices being shared, and insights relevant to the partnership. Track ' +
      'commitments, shared action items with clear ownership, and any risks or dependencies between ' +
      'the collaborating groups. Highlight alignment and note areas where priorities may diverge.',
    goalPlaceholder: 'What is the focus of this collaboration meeting?',
    summaryPrompt:
      'Produce a structured summary of this collaboration meeting organised into the following sections:\n\n' +
      '**Key Questions Raised** — List the main questions raised by participants, noting who raised them and whether they were resolved.\n\n' +
      '**Best Practices Shared** — Capture any methods, approaches, or lessons learned that were shared between the groups.\n\n' +
      '**Key Insights & Findings** — Summarise the most important insights related to the shared work, including any data points, progress updates, or discoveries.\n\n' +
      '**Risks & Dependencies** — Identify risks to the collaboration, blockers, or dependencies between the groups that need attention.\n\n' +
      '**Opportunities** — Highlight new opportunities for joint progress, synergies, or areas where combined effort could accelerate outcomes.\n\n' +
      '**Priorities & Alignment** — Note agreed priorities, any shifts in direction, and areas where the groups are aligned or need further alignment.\n\n' +
      '**Actions & Commitments** — List concrete next steps with owners and deadlines where specified.\n\n' +
      'Be concise but thorough. Use bullet points within each section. If a section has no relevant content, omit it.',
    summaryPromptLabel: 'Collaboration Meeting',
    isBuiltIn: true,
  },
] as const;

/** Look up a built-in template by ID. */
export function getBuiltInTemplate(id: string): SessionTemplate | undefined {
  return BUILT_IN_TEMPLATES.find(t => t.id === id);
}
