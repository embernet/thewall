import type { AgentContext } from '@/agents/base';
import { workerPool } from '@/agents/worker-pool';
import { agentRegistry } from '@/agents/registry';

export interface MethodologyStep {
  name: string;
  description: string;
  agentId?: string;       // specific agent to run
  customPrompt?: string;  // or a custom system prompt
  parallel?: boolean;     // can run concurrently with prev step
}

export interface MethodologyResult {
  stepName: string;
  output: string;
  cardsCreated: number;
}

export abstract class BaseMethodology {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly icon: string;
  abstract readonly steps: MethodologyStep[];

  async execute(ctx: AgentContext): Promise<MethodologyResult[]> {
    const results: MethodologyResult[] = [];

    for (const step of this.steps) {
      if (step.agentId) {
        const agent = agentRegistry.get(step.agentId);
        if (agent) {
          workerPool.submit(agent, ctx, 1); // high priority
          results.push({ stepName: step.name, output: 'Dispatched', cardsCreated: 0 });
        }
      }
    }

    return results;
  }
}

// Registry
class MethodologyRegistry {
  private methodologies = new Map<string, BaseMethodology>();

  register(m: BaseMethodology): void {
    this.methodologies.set(m.id, m);
  }

  get(id: string): BaseMethodology | undefined {
    return this.methodologies.get(id);
  }

  list(): BaseMethodology[] {
    return [...this.methodologies.values()];
  }
}

export const methodologyRegistry = new MethodologyRegistry();
