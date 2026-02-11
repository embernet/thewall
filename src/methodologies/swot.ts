import { BaseMethodology, MethodologyStep } from './base';

class SWOTMethodology extends BaseMethodology {
  readonly id = 'swot';
  readonly name = 'SWOT++ Analysis';
  readonly description = 'Analyze Strengths, Weaknesses, Opportunities, and Threats with synthesis';
  readonly icon = '\uD83D\uDCCA';
  readonly steps: MethodologyStep[] = [
    { name: 'Strengths', description: 'Identify internal strengths', agentId: 'concept-extractor', parallel: true },
    { name: 'Weaknesses', description: 'Identify internal weaknesses', agentId: 'gap-finder', parallel: true },
    { name: 'Opportunities', description: 'Identify external opportunities', agentId: 'idea-generator', parallel: true },
    { name: 'Threats', description: 'Identify external threats', agentId: 'problem-finder', parallel: true },
    { name: 'Synthesis', description: 'Combine insights into strategic recommendations', agentId: 'planner' },
  ];
}

export const swotMethodology = new SWOTMethodology();
