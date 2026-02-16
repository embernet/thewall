import { BaseAgent, AgentContext } from '../base';

class SummariserAgent extends BaseAgent {
  readonly id = 'summariser';
  readonly name = 'Summariser';
  readonly description = 'Create concise summaries of key points discussed';
  readonly targetColumn = 'observations';
  readonly priority = 7;
  readonly maxTokens = 500;

  systemPrompt(_ctx: AgentContext): string {
    return 'Create a concise summary of the key points discussed. Focus on decisions, conclusions, and important information. Output 1-2 bullet points, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and skip anything already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Summarize the key points:\n\n${ctx.recentTranscript}`;
  }
}

export const summariser = new SummariserAgent();
