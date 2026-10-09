import { describe, it, expect } from 'vitest';
import {
  generateStructuredSummaryMarkdown,
  generateStructuredSummaryHTML,
} from '../src/utils/export';
import type { ExportState } from '../src/utils/export';

describe('Structured Summary Export', () => {
  const sampleState: ExportState = {
    session: {
      id: 'session-1',
      title: "Karima's dissertation brainstorm",
      mode: 'sidekick',
      goal: 'Brainstorm dissertation topics linking CS, psychology, and biology.',
      status: 'active',
      createdAt: '2026-08-25T13:04:28.493Z',
      updatedAt: '2026-08-25T13:04:28.493Z',
    },
    columns: [
      {
        id: 'col-transcript',
        sessionId: 'session-1',
        type: 'transcript',
        title: 'Transcript',
        sortOrder: 'a',
        visible: true,
        collapsed: false,
        config: {
          summary: 'The discussion centers around exploring the intersection of CS, psychology, and neuroscience.',
        },
      },
      {
        id: 'col-observations',
        sessionId: 'session-1',
        type: 'observations',
        title: 'Observations',
        sortOrder: 'b',
        visible: true,
        collapsed: false,
        config: {
          summary: 'The dissertation primarily focuses on exploring the intersection between CS and brain theories.',
        },
      },
    ],
    cards: [
      {
        id: 'card-1',
        columnId: 'col-transcript',
        sessionId: 'session-1',
        content: "It will be a computer science dissertation, but I'm looking for applications into brain theories.",
        source: 'transcription',
        speaker: 'Karima',
        sourceCardIds: [],
        aiTags: [],
        userTags: ['transcript:clean'],
        highlightedBy: 'none',
        isDeleted: false,
        createdAt: '2026-08-25T13:09:19.937Z',
        updatedAt: '2026-08-25T13:09:19.937Z',
        sortOrder: 'a',
      },
      {
        id: 'card-2',
        columnId: 'col-transcript',
        sessionId: 'session-1',
        content: 'The focus would be technical and LLMs.',
        source: 'transcription',
        speaker: 'Mark',
        sourceCardIds: [],
        aiTags: [],
        userTags: ['transcript:clean'],
        highlightedBy: 'none',
        isDeleted: false,
        createdAt: '2026-08-25T13:10:24.911Z',
        updatedAt: '2026-08-25T13:10:24.911Z',
        sortOrder: 'b',
      },
      {
        id: 'card-3',
        columnId: 'col-observations',
        sessionId: 'session-1',
        content: 'The dissertation will focus on computer science with applications to brain theories.',
        source: 'agent',
        sourceCardIds: [],
        aiTags: [],
        userTags: [],
        highlightedBy: 'none',
        isDeleted: false,
        createdAt: '2026-08-25T13:11:00.000Z',
        updatedAt: '2026-08-25T13:11:00.000Z',
        sortOrder: 'a',
      },
      {
        id: 'card-4',
        columnId: 'col-observations',
        sessionId: 'session-1',
        content: 'The dissertation will focus on computer science with applications to brain theories.',
        source: 'agent',
        sourceCardIds: [],
        aiTags: [],
        userTags: [],
        highlightedBy: 'none',
        isDeleted: false,
        createdAt: '2026-08-25T13:11:05.000Z',
        updatedAt: '2026-08-25T13:11:05.000Z',
        sortOrder: 'b',
      },
      {
        id: 'card-5',
        columnId: 'col-observations',
        sessionId: 'session-1',
        content: 'Frontier Labs are exploring the synergy between psychology and LLM reasoning.',
        source: 'agent',
        sourceCardIds: [],
        aiTags: [],
        userTags: [],
        highlightedBy: 'none',
        isDeleted: false,
        createdAt: '2026-08-25T13:11:10.000Z',
        updatedAt: '2026-08-25T13:11:10.000Z',
        sortOrder: 'c',
      },
    ],
  };

  it('generates structured markdown with summaries, clean dialogue, and deduplication', () => {
    const md = generateStructuredSummaryMarkdown(sampleState);

    expect(md).toContain("# Karima's dissertation brainstorm");
    expect(md).toContain('### Executive Overview');
    expect(md).toContain('## 1. Transcript');
    expect(md).toContain('### Column Summary');
    expect(md).toContain('> The discussion centers around exploring the intersection of CS');
    expect(md).toContain('### Conversation Dialogue');
    expect(md).toContain("**Karima:** It will be a computer science dissertation");
    expect(md).toContain('**Mark:** The focus would be technical and LLMs');
    expect(md).toContain('## 2. Observations');
    expect(md).toContain('Frontier Labs are exploring the synergy');

    // Verify deduplication: card-4 is duplicate of card-3
    const occurrences = md.split('The dissertation will focus on computer science with applications to brain theories.').length - 1;
    expect(occurrences).toBe(1);
  });

  it('generates print-ready HTML with styled badges and CSS for PDF export', () => {
    const html = generateStructuredSummaryHTML(sampleState);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page');
    expect(html).toContain('speaker-karima');
    expect(html).toContain('speaker-mark');
    expect(html).toContain('<blockquote>');
  });
});
