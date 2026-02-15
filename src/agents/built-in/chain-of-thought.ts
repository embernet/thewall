import { BaseAgent, AgentContext } from '../base';

class ChainOfThoughtAgent extends BaseAgent {
  readonly id = 'chain-of-thought';
  readonly name = 'Chain of Thought Reasoner';
  readonly description = 'Apply step-by-step logical reasoning to key topics';
  readonly targetColumn = 'observations';
  readonly priority = 5;

  systemPrompt(_ctx: AgentContext): string {
    return 'Apply step-by-step logical reasoning to the key topic being discussed. Walk through the reasoning chain. Output 1-2 items, each on a new line starting with •. Each item should show the reasoning steps.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Reason step-by-step about:\n\n${ctx.recentTranscript}`;
  }
}

export const chainOfThought = new ChainOfThoughtAgent();
