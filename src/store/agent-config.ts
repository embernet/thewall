// ---------------------------------------------------------------------------
// Agent Config Store — manages agent configuration state for the UI
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { AgentConfigOverride, CustomAgentConfig } from '@/types';
import type { ToolManifest } from '@/tools/adapter';
import { toolRegistry } from '@/tools/adapter';
import { bus } from '@/events/bus';

interface AgentConfigState {
  /** Per-agent overrides keyed by agent ID. */
  configs: Record<string, AgentConfigOverride>;
  /** User-created custom agents. */
  customAgents: CustomAgentConfig[];
  /** Available tool manifests. */
  tools: ToolManifest[];
  /** Whether we're loading from DB. */
  loading: boolean;

  /** Load all agent configs, custom agents, and tools from DB. */
  loadAll: () => Promise<void>;

  /** Save (upsert) an agent config override. */
  saveConfig: (agentId: string, config: Partial<AgentConfigOverride>) => Promise<void>;

  /** Reset an agent to defaults (delete override). */
  resetConfig: (agentId: string) => Promise<void>;

  /** Save (upsert) a custom agent. */
  saveCustomAgent: (agent: CustomAgentConfig) => Promise<void>;

  /** Delete a custom agent. */
  deleteCustomAgent: (id: string) => Promise<void>;
}

export const useAgentConfigStore = create<AgentConfigState>((set, get) => ({
  configs: {},
  customAgents: [],
  tools: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const [overrides, customs] = await Promise.all([
        window.electronAPI?.db?.getAgentConfigs?.() ?? [],
        window.electronAPI?.db?.getCustomAgents?.() ?? [],
      ]);

      const configs: Record<string, AgentConfigOverride> = {};
      for (const o of overrides) {
        configs[o.agentId] = o;
      }

      const tools = toolRegistry.list();

      set({ configs, customAgents: customs, tools, loading: false });
    } catch (e) {
      console.warn('Failed to load agent configs:', e);
      set({ loading: false });
    }
  },

  saveConfig: async (agentId, config) => {
    try {
      // Merge with existing
      const existing = get().configs[agentId];
      const merged = {
        ...(existing || { agentId, enabled: true }),
        ...config,
      };
      await window.electronAPI?.db?.saveAgentConfig(agentId, merged);

      // Update local state
      set(s => ({
        configs: {
          ...s.configs,
          [agentId]: merged as AgentConfigOverride,
        },
      }));

      // Notify orchestrator to hot-reload
      bus.emit('agentConfig:changed', {} as Record<string, never>);
    } catch (e) {
      console.warn('Failed to save agent config:', e);
    }
  },

  resetConfig: async (agentId) => {
    try {
      await window.electronAPI?.db?.deleteAgentConfig(agentId);

      set(s => {
        const configs = { ...s.configs };
        delete configs[agentId];
        return { configs };
      });

      bus.emit('agentConfig:changed', {} as Record<string, never>);
    } catch (e) {
      console.warn('Failed to reset agent config:', e);
    }
  },

  saveCustomAgent: async (agent) => {
    try {
      await window.electronAPI?.db?.saveCustomAgent(agent);

      set(s => {
        const existing = s.customAgents.findIndex(a => a.id === agent.id);
        const customAgents = [...s.customAgents];
        if (existing >= 0) {
          customAgents[existing] = agent;
        } else {
          customAgents.push(agent);
        }
        return { customAgents };
      });

      bus.emit('agentConfig:changed', {} as Record<string, never>);
    } catch (e) {
      console.warn('Failed to save custom agent:', e);
    }
  },

  deleteCustomAgent: async (id) => {
    try {
      await window.electronAPI?.db?.deleteCustomAgent(id);

      set(s => ({
        customAgents: s.customAgents.filter(a => a.id !== id),
      }));

      bus.emit('agentConfig:changed', {} as Record<string, never>);
    } catch (e) {
      console.warn('Failed to delete custom agent:', e);
    }
  },
}));
