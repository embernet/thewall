import { BaseMethodology, MethodologyStep } from './base';

class SCAMPERMethodology extends BaseMethodology {
  readonly id = 'scamper';
  readonly name = 'SCAMPER';
  readonly description = 'Creative technique: Substitute, Combine, Adapt, Modify, Put to use, Eliminate, Reverse';
  readonly icon = '\uD83D\uDE80';
  readonly steps: MethodologyStep[] = [
    { name: 'Substitute', description: 'What can be substituted?', customPrompt: 'What elements, materials, processes, or approaches could be substituted to improve or change the discussed topic? Think creatively about replacements.' },
    { name: 'Combine', description: 'What can be combined?', customPrompt: 'What ideas, concepts, or approaches from the discussion could be combined to create something new or better? Think about merging elements.' },
    { name: 'Adapt', description: 'What can be adapted?', customPrompt: 'What existing solutions, approaches, or ideas from other fields could be adapted to the discussed topic? Look for analogies and adaptations.' },
    { name: 'Modify', description: 'What can be modified?', customPrompt: 'What aspects could be magnified, minimized, or modified? Think about changing size, shape, scope, or other attributes.' },
    { name: 'Put to other uses', description: 'Other applications?', customPrompt: 'How else could the discussed concepts be used? What other markets, audiences, or contexts could benefit?' },
    { name: 'Eliminate', description: 'What can be eliminated?', customPrompt: 'What could be removed, simplified, or reduced? What is unnecessary complexity that could be eliminated?' },
    { name: 'Reverse', description: 'What can be reversed?', customPrompt: 'What could be reversed, rearranged, or done in the opposite way? Think about flipping assumptions or sequences.' },
  ];
}

export const scamperMethodology = new SCAMPERMethodology();
