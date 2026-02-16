import { BaseAgent, AgentContext } from '../base';

class ProblemSolverAgent extends BaseAgent {
  readonly id = 'problem-solver';
  readonly name = 'Problem Solver';
  readonly description = 'Apply structured problem-solving frameworks to issues raised';
  readonly targetColumn = 'ideas';
  readonly priority = 4;

  systemPrompt(_ctx: AgentContext): string {
    return 'Apply structured problem-solving frameworks (root cause analysis, 5 Whys, first principles) to issues raised. Output 1-2 items, each on a new line starting with •. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Apply problem-solving frameworks:\n\n${ctx.recentTranscript}`;
  }
}

export const problemSolver = new ProblemSolverAgent();
