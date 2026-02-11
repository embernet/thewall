// ---------------------------------------------------------------------------
// Tool Adapter — Standard interface for tools usable by agents
// ---------------------------------------------------------------------------

export interface ToolManifest {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
}

export interface ToolResult {
  success: boolean;
  data: string;
  error?: string;
}

export type ToolExecutor = (params: Record<string, unknown>) => Promise<ToolResult>;

export interface Tool {
  manifest: ToolManifest;
  execute: ToolExecutor;
}

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.manifest.id, tool);
  }

  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  list(): ToolManifest[] {
    return [...this.tools.values()].map(t => t.manifest);
  }

  async execute(toolId: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) return { success: false, data: '', error: `Tool not found: ${toolId}` };

    try {
      return await tool.execute(params);
    } catch (e) {
      return { success: false, data: '', error: String(e) };
    }
  }
}

export const toolRegistry = new ToolRegistry();
