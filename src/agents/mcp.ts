// ============================================================================
// The Wall — MCP-Compatible Agent & Tool Adapter
// ============================================================================
//
// Exposes all registered agents and tools as MCP-style tool descriptors.
// This enables the Chat panel to list and invoke agents via @mentions,
// and provides the @help command with a full registry.
//
// "MCP-compatible" here means each agent/tool has a JSON-schema-style
// descriptor (name, description, inputSchema) matching the MCP tool spec,
// without requiring a full MCP transport layer.
// ============================================================================

import { agentRegistry } from './registry';
import { toolRegistry } from '@/tools/adapter';
import { useSessionStore } from '@/store/session';
import type { BaseAgent } from './base';

// ---------------------------------------------------------------------------
// MCP Tool Descriptor
// ---------------------------------------------------------------------------

export interface MCPToolDescriptor {
  /** Unique name — "agent:{id}" for agents, "tool:{id}" for tools. */
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  _kind: 'agent' | 'tool';
  _agentId?: string;
  _toolId?: string;
}

// ---------------------------------------------------------------------------
// AgentMCPAdapter
// ---------------------------------------------------------------------------

export class AgentMCPAdapter {
  /** Generate MCP descriptors for all registered agents. */
  listAgentTools(): MCPToolDescriptor[] {
    return agentRegistry.list().map((agent: BaseAgent) => ({
      name: `agent:${agent.id}`,
      description: `${agent.description} (${agent.agentType}, priority ${agent.priority})`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          intent: {
            type: 'string',
            description: 'The user intent or instruction for this agent',
          },
          context: {
            type: 'string',
            description: 'Additional context to provide to the agent',
          },
        },
        required: ['intent'],
      },
      _kind: 'agent' as const,
      _agentId: agent.id,
    }));
  }

  /** Generate MCP descriptors for all registered tools. */
  listToolManifests(): MCPToolDescriptor[] {
    return toolRegistry.list().map(manifest => ({
      name: `tool:${manifest.id}`,
      description: manifest.description,
      inputSchema: {
        type: 'object' as const,
        properties: Object.fromEntries(
          manifest.parameters.map(p => [
            p.name,
            { type: p.type, description: p.description },
          ]),
        ),
        required: manifest.parameters
          .filter(p => p.required)
          .map(p => p.name),
      },
      _kind: 'tool' as const,
      _toolId: manifest.id,
    }));
  }

  /** All agent + tool descriptors combined. */
  listAll(): MCPToolDescriptor[] {
    return [...this.listAgentTools(), ...this.listToolManifests()];
  }

  /**
   * Execute a tool by MCP descriptor name.
   * For agents: builds a minimal context and runs execute().
   * For tools: delegates to toolRegistry.execute().
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; data: string; error?: string }> {
    if (name.startsWith('tool:')) {
      const toolId = name.slice(5);
      return toolRegistry.execute(toolId, params);
    }

    if (name.startsWith('agent:')) {
      const agentId = name.slice(6);
      const agent = agentRegistry.get(agentId);
      if (!agent) {
        return { success: false, data: '', error: `Agent not found: ${agentId}` };
      }
      try {
        const store = useSessionStore.getState();
        const ctx = {
          sessionId: store.session?.id ?? '',
          mode: store.session?.mode ?? 'sidekick' as const,
          recentTranscript: (params.intent as string) ?? '',
          relatedCards: [],
          allCards: store.cards,
          columns: store.columns,
          previousOutput: params.context as string | undefined,
        };
        const result = await agent.execute(ctx);
        const data = result.cards.map(c => c.content).join('\n\n');
        return { success: true, data };
      } catch (e) {
        return { success: false, data: '', error: String(e) };
      }
    }

    return { success: false, data: '', error: `Unknown MCP tool: ${name}` };
  }

  /**
   * Find an agent by exact ID or prefix/name match.
   * Used for @mention fuzzy resolution in the chat panel.
   */
  resolveAgent(mention: string): BaseAgent | undefined {
    // Exact match first
    const exact = agentRegistry.get(mention);
    if (exact) return exact;

    // Prefix match on ID
    const byIdPrefix = agentRegistry.list().find(a =>
      a.id.startsWith(mention) || mention.startsWith(a.id),
    );
    if (byIdPrefix) return byIdPrefix;

    // Case-insensitive name contains match
    const lower = mention.toLowerCase();
    return agentRegistry.list().find(a =>
      a.name.toLowerCase().includes(lower),
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const agentMCPAdapter = new AgentMCPAdapter();

// ---------------------------------------------------------------------------
// @help content builder
// ---------------------------------------------------------------------------

/**
 * Build a markdown string listing all available agents and tools.
 * Used by the Chat panel's @help command.
 */
export function buildHelpContent(): string {
  const agents = agentRegistry.list();
  const tools = toolRegistry.list();

  const agentLines = agents
    .sort((a, b) => b.priority - a.priority)
    .map(a => {
      const trigger = a.triggersOnTranscript ? '⚡ auto' : '📌 manual';
      return `- **@${a.id}** \`${a.agentType}\` ${trigger} — ${a.description}`;
    })
    .join('\n');

  const toolLines = tools
    .map(t => {
      const params = t.parameters.map(p => p.name).join(', ');
      return `- **${t.name}** \`tool:${t.id}\`${params ? ` (${params})` : ''} — ${t.description}`;
    })
    .join('\n');

  return [
    '## Available Agents',
    '',
    agentLines || '_No agents registered._',
    '',
    '## Available Tools',
    '',
    toolLines || '_No tools registered._',
    '',
    '---',
    '_Use **@agent-id** to invoke an agent with your message as context._',
    '_Use **@image-generator** to generate an image from a description._',
  ].join('\n');
}
