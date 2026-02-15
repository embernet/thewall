import { BaseAgent, AgentContext } from '../base';

class RequirementFinderAgent extends BaseAgent {
  readonly id = 'requirement-finder';
  readonly name = 'Requirement Finder';
  readonly description = 'Extract explicit and implicit requirements from the discussion';
  readonly targetColumn = 'observations';
  readonly priority = 5;

  systemPrompt(_ctx: AgentContext): string {
    return 'Extract explicit and implicit requirements from the discussion. Include constraints, needs, and must-haves. Output 1-2 items, each on a new line starting with \u2022.';
  }

  userPrompt(ctx: AgentContext): string {
    return `What requirements are stated or implied?\n\n${ctx.recentTranscript}`;
  }
}

export const requirementFinder = new RequirementFinderAgent();
