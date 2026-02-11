import { BaseAgent } from './base';

class AgentRegistry {
  private agents = new Map<string, BaseAgent>();

  register(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
  }

  unregister(id: string): void {
    this.agents.delete(id);
  }

  get(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  list(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /** Get agents sorted by priority (highest first) */
  listByPriority(): BaseAgent[] {
    return this.list().sort((a, b) => b.priority - a.priority);
  }

  /** Find agents that target a specific column type */
  forColumn(columnType: string): BaseAgent[] {
    return this.list().filter(a => a.targetColumn === columnType);
  }

  /** Get all agents whose dependencies are met (given a set of completed agent IDs) */
  ready(completedIds: Set<string>): BaseAgent[] {
    return this.list().filter(a =>
      a.dependsOn.length === 0 || a.dependsOn.every(dep => completedIds.has(dep))
    );
  }

  clear(): void {
    this.agents.clear();
  }
}

export const agentRegistry = new AgentRegistry();
