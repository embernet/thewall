// ---------------------------------------------------------------------------
// Agent Config Loader — loads DB overrides, wraps agents, registers them
// ---------------------------------------------------------------------------

import { agentRegistry } from './registry';
import { builtInAgents, registerBuiltInAgents } from './built-in';
import { ConfigurableAgent } from './configurable-agent';
import { CustomRuntimeAgent } from './custom-runtime-agent';
import type { AgentConfigOverride, CustomAgentConfig } from '@/types';

/**
 * Load agent configs from DB, wrap built-in agents with overrides,
 * create custom agents, and register all in the agent registry.
 */
export async function loadAgentConfigs(): Promise<void> {
  // Clear existing registrations
  agentRegistry.clear();

  // 1. Load overrides from DB
  let overrides: AgentConfigOverride[] = [];
  let customConfigs: CustomAgentConfig[] = [];

  try {
    if (window.electronAPI?.db?.getAgentConfigs) {
      overrides = await window.electronAPI.db.getAgentConfigs();
    }
  } catch (e) {
    console.warn('Failed to load agent configs:', e);
  }

  try {
    if (window.electronAPI?.db?.getCustomAgents) {
      customConfigs = await window.electronAPI.db.getCustomAgents();
    }
  } catch (e) {
    console.warn('Failed to load custom agents:', e);
  }

  // 2. Build override lookup
  const overrideMap = new Map<string, AgentConfigOverride>();
  for (const o of overrides) {
    overrideMap.set(o.agentId, o);
  }

  // 3. Register built-in agents (wrapped if override exists)
  for (const agent of builtInAgents) {
    const override = overrideMap.get(agent.id);
    if (override) {
      agentRegistry.register(new ConfigurableAgent(agent, override));
    } else {
      agentRegistry.register(agent);
    }
  }

  // 4. Register custom agents
  for (const config of customConfigs) {
    if (config.enabled) {
      agentRegistry.register(new CustomRuntimeAgent(config));
    }
  }
}

/**
 * Hot-reload: re-apply agent configs without full orchestrator restart.
 * Called when user saves changes in the Agent Configuration UI.
 */
export async function applyAgentConfigs(): Promise<void> {
  await loadAgentConfigs();
}
