import { agentRegistry } from '../registry';

import { conceptExtractor } from './concept-extractor';
import { questioner } from './questioner';
import { claimIdentifier } from './claim-identifier';
import { gapFinder } from './gap-finder';
import { actionTracker } from './action-tracker';
import { ideaGenerator } from './idea-generator';
import { claimVerifier } from './claim-verifier';
import { claimChallenger } from './claim-challenger';
import { claritySeeker } from './clarity-seeker';
import { problemFinder } from './problem-finder';
import { tensionFinder } from './tension-finder';
import { solutionFinder } from './solution-finder';
import { requirementFinder } from './requirement-finder';
import { constraintFinder } from './constraint-finder';
import { alternativeFinder } from './alternative-finder';
import { tradeoffEnumerator } from './tradeoff-enumerator';
import { patternFinder } from './pattern-finder';
import { clicheFinder } from './cliche-finder';
import { planner } from './planner';
import { refiner } from './refiner';
import { summariser } from './summariser';
import { challenger } from './challenger';
import { rhetoricGenerator } from './rhetoric-generator';
import { collaborator } from './collaborator';
import { skeptic } from './skeptic';
import { supporter } from './supporter';
import { chainOfThought } from './chain-of-thought';
import { problemSolver } from './problem-solver';
import { coach } from './coach';
import { visionary } from './visionary';
import { pragmatist } from './pragmatist';
import { thinker } from './thinker';
import { researcher } from './researcher';
import { knowledgeManager } from './knowledge-manager';
import { methodology } from './methodology';

export {
  conceptExtractor,
  questioner,
  claimIdentifier,
  gapFinder,
  actionTracker,
  ideaGenerator,
  claimVerifier,
  claimChallenger,
  claritySeeker,
  problemFinder,
  tensionFinder,
  solutionFinder,
  requirementFinder,
  constraintFinder,
  alternativeFinder,
  tradeoffEnumerator,
  patternFinder,
  clicheFinder,
  planner,
  refiner,
  summariser,
  challenger,
  rhetoricGenerator,
  collaborator,
  skeptic,
  supporter,
  chainOfThought,
  problemSolver,
  coach,
  visionary,
  pragmatist,
  thinker,
  researcher,
  knowledgeManager,
  methodology,
};

export const builtInAgents = [
  conceptExtractor,
  questioner,
  claimIdentifier,
  gapFinder,
  actionTracker,
  ideaGenerator,
  claimVerifier,
  claimChallenger,
  claritySeeker,
  problemFinder,
  tensionFinder,
  solutionFinder,
  requirementFinder,
  constraintFinder,
  alternativeFinder,
  tradeoffEnumerator,
  patternFinder,
  clicheFinder,
  planner,
  refiner,
  summariser,
  challenger,
  rhetoricGenerator,
  collaborator,
  skeptic,
  supporter,
  chainOfThought,
  problemSolver,
  coach,
  visionary,
  pragmatist,
  thinker,
  researcher,
  knowledgeManager,
  methodology,
];

export function registerBuiltInAgents(): void {
  for (const agent of builtInAgents) {
    agentRegistry.register(agent);
  }
}
