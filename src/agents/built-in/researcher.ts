import { ToolEnabledAgent } from '../tool-enabled-base';
import type { AgentContext } from '../base';

class ResearcherAgent extends ToolEnabledAgent {
  readonly id = 'researcher';
  readonly name = 'Researcher';
  readonly description = 'Identify topics needing deeper research, then search external sources for relevant information';
  readonly targetColumn = 'deep_research';
  readonly priority = 5;
  readonly maxTokens = 800;

  readonly tools = [
    'session_search',
    'web_search',
    'academic_search',
    'arxiv_search',
    'wikipedia_lookup',
    'web_reader',
    'text_summarizer',
  ];
  readonly maxToolCalls = 3;

  systemPrompt(_ctx: AgentContext): string {
    return 'You are a research assistant. Identify topics that need deeper research or fact-checking, and provide findings from the tool results. For each item, include the finding and its source. Output 1-3 items, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What needs deeper research?\n\n${ctx.recentTranscript}`;
  }
}

export const researcher = new ResearcherAgent();
