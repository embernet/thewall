import { ToolEnabledAgent } from '../tool-enabled-base';
import type { AgentContext } from '../base';

class ProblemSolverAgent extends ToolEnabledAgent {
  readonly id = 'problem-solver';
  readonly name = 'Problem Solver';
  readonly description = 'Apply structured problem-solving frameworks to issues raised, with external research support';
  readonly targetColumn = 'ideas';
  readonly priority = 4;

  readonly tools = [
    'session_search',
    'web_search',
  ];
  readonly maxToolCalls = 2;

  systemPrompt(_ctx: AgentContext): string {
    return 'Apply structured problem-solving frameworks (root cause analysis, 5 Whys, first principles) to issues raised. Use tool results to find relevant approaches or precedents. Output 1-2 items, each on a new line starting with \u2022. Check the SIMILAR EXISTING ITEMS above (if any) and avoid duplicating what is already captured.';
  }

  userPrompt(ctx: AgentContext): string {
    return `Apply problem-solving frameworks:\n\n${ctx.recentTranscript}`;
  }
}

export const problemSolver = new ProblemSolverAgent();
