// ============================================================================
// The Wall — ToolEnabledAgent Base Class
// ============================================================================
//
// Extends BaseAgent with a plan-then-synthesize execution model that lets
// agents autonomously select and use tools from the ToolRegistry.
//
// Execution flow:
//   1. PLAN:       LLM sees available tool manifests + context → outputs tool calls as JSON
//   2. EXECUTE:    Parse tool calls, run them via ToolRegistry (with rate limiting)
//   3. SYNTHESIZE: LLM sees original context + tool results → produces final output
//
// Agents declare `readonly tools: string[]` listing which tool IDs they can use.
// If no tools are available or all calls fail, falls back to prompt-only behavior.
// ============================================================================

import { BaseAgent, AgentContext, AgentResult, ArtefactData } from './base';
import { askClaude } from '@/utils/llm';
import { toolRegistry } from '@/tools/adapter';
import type { ToolManifest, ToolResult } from '@/tools/adapter';
import { rateLimiter } from '@/tools/rate-limiter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlannedToolCall {
  toolId: string;
  params: Record<string, unknown>;
  reasoning?: string;
}

interface ExecutedToolResult {
  toolId: string;
  toolName: string;
  params: Record<string, unknown>;
  result: ToolResult;
}

// ---------------------------------------------------------------------------
// ToolEnabledAgent
// ---------------------------------------------------------------------------

export abstract class ToolEnabledAgent extends BaseAgent {
  /** Tool IDs this agent can use (must match IDs in ToolRegistry). */
  abstract readonly tools: string[];

  /** Maximum number of tool calls per execution (cost control). */
  readonly maxToolCalls: number = 3;

  /** Always prompt-plus-code since we have custom execute logic. */
  readonly behaviorType: 'prompt-plus-code' = 'prompt-plus-code';

  /** Tool-enabled agents always report true. */
  override get hasTools(): boolean { return true; }

  /**
   * Override execute() with the plan → execute → synthesize pipeline.
   * Falls back to standard prompt-only if no tools are available or planning fails.
   */
  async execute(ctx: AgentContext): Promise<AgentResult> {
    // Resolve available tools
    const manifests = this.getAvailableToolManifests();
    if (manifests.length === 0) {
      // No tools available — fall back to standard BaseAgent behavior
      return super.execute(ctx);
    }

    // Phase 1: Plan — ask LLM which tools to use
    let toolCalls: PlannedToolCall[];
    try {
      const planSys = this.buildPlanPrompt(manifests, ctx);
      const planUsr = this.buildPlanUserMessage(ctx);
      const planRaw = await askClaude(planSys, planUsr, 500);
      toolCalls = this.parseToolCalls(planRaw ?? '');
    } catch (e) {
      console.warn(`[${this.id}] Tool planning failed, falling back to prompt-only:`, e);
      return super.execute(ctx);
    }

    // No tools needed — the LLM decided this doesn't require tool use
    if (toolCalls.length === 0) {
      return super.execute(ctx);
    }

    // Phase 2: Execute tools
    const toolResults = await this.executeTools(toolCalls);

    // All tools failed — fall back to prompt-only
    if (toolResults.length === 0 || toolResults.every(r => !r.result.success)) {
      console.warn(`[${this.id}] All tool calls failed, falling back to prompt-only`);
      return super.execute(ctx);
    }

    // Phase 3: Synthesize — LLM produces final output with tool results as context
    const synthSys = this.buildSynthesisPrompt(ctx, toolResults);
    const synthUsr = this.userPrompt(ctx);
    const raw = await askClaude(synthSys, synthUsr, this.maxTokens);
    if (!raw) throw new Error('LLM returned no response during synthesis.');

    const cards = this.parseOutput(raw, ctx);
    const artefacts = this.buildArtefacts(toolResults);
    return { cards, raw, artefacts: artefacts.length > 0 ? artefacts : undefined };
  }

  // -------------------------------------------------------------------------
  // Phase 1: Planning
  // -------------------------------------------------------------------------

  /** Get tool manifests for tools this agent can use and that are registered. */
  protected getAvailableToolManifests(): ToolManifest[] {
    return this.tools
      .map(id => toolRegistry.get(id)?.manifest)
      .filter((m): m is ToolManifest => m !== undefined);
  }

  /** Build the system prompt for the planning phase. */
  protected buildPlanPrompt(manifests: ToolManifest[], _ctx: AgentContext): string {
    const toolDescriptions = manifests.map(m => {
      const params = m.parameters
        .map(p => `    - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`)
        .join('\n');
      return `TOOL: ${m.id}\n  Description: ${m.description}\n  Parameters:\n${params}`;
    }).join('\n\n');

    return `You are a tool-use planner. Given a task and available tools, decide which tools to call (if any) to gather information needed for the task.

AVAILABLE TOOLS:
${toolDescriptions}

RULES:
- Output a JSON array of tool calls, or an empty array [] if no tools are needed.
- Each tool call: {"toolId": "...", "params": {...}, "reasoning": "..."}
- Maximum ${this.maxToolCalls} tool calls.
- Only use tools when external information would genuinely improve the output.
- Prefer session_search first to check what's already known before external lookups.
- Be specific with search queries — vague queries waste API calls.

OUTPUT FORMAT (JSON only, no other text):
[{"toolId": "tool_id", "params": {"param1": "value"}, "reasoning": "why this tool"}]

Or if no tools needed:
[]`;
  }

  /** Build the user message for the planning phase. */
  protected buildPlanUserMessage(ctx: AgentContext): string {
    return `TASK: ${this.description}

CONTEXT:
${this.userPrompt(ctx)}

Which tools should I call to help with this task?`;
  }

  /** Parse the LLM's tool call plan from JSON output. */
  protected parseToolCalls(raw: string): PlannedToolCall[] {
    // Extract JSON array from the response (handle markdown code blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((call: unknown): call is PlannedToolCall => {
          if (typeof call !== 'object' || call === null) return false;
          const c = call as Record<string, unknown>;
          return typeof c.toolId === 'string' && typeof c.params === 'object';
        })
        .slice(0, this.maxToolCalls);
    } catch {
      console.warn(`[${this.id}] Failed to parse tool calls:`, raw.slice(0, 200));
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Tool Execution
  // -------------------------------------------------------------------------

  /** Execute planned tool calls with rate limiting. */
  protected async executeTools(calls: PlannedToolCall[]): Promise<ExecutedToolResult[]> {
    const results: ExecutedToolResult[] = [];

    for (const call of calls) {
      // Check rate limit
      if (!rateLimiter.acquire(call.toolId)) {
        console.warn(`[${this.id}] Rate limited: ${call.toolId}`);
        results.push({
          toolId: call.toolId,
          toolName: call.toolId,
          params: call.params,
          result: { success: false, data: '', error: 'Rate limited — try again later' },
        });
        continue;
      }

      // Execute
      const tool = toolRegistry.get(call.toolId);
      if (!tool) {
        results.push({
          toolId: call.toolId,
          toolName: call.toolId,
          params: call.params,
          result: { success: false, data: '', error: `Tool not found: ${call.toolId}` },
        });
        continue;
      }

      try {
        const result = await tool.execute(call.params);
        results.push({
          toolId: call.toolId,
          toolName: tool.manifest.name,
          params: call.params,
          result,
        });
      } catch (e) {
        results.push({
          toolId: call.toolId,
          toolName: tool.manifest.name,
          params: call.params,
          result: { success: false, data: '', error: String(e) },
        });
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Synthesis
  // -------------------------------------------------------------------------

  /** Build the system prompt for synthesis, including tool results. */
  protected buildSynthesisPrompt(ctx: AgentContext, toolResults: ExecutedToolResult[]): string {
    const basePrompt = this.systemPrompt(ctx);
    const resultsBlock = this.formatToolResults(toolResults);

    return `${basePrompt}

${resultsBlock}

Use the tool results above to inform your output. Cite sources where applicable. If tool results are empty or failed, rely on your own knowledge but note the limitation.`;
  }

  // -------------------------------------------------------------------------
  // Artefact Building
  // -------------------------------------------------------------------------

  /** Build ArtefactData entries from executed tool results. */
  protected buildArtefacts(results: ExecutedToolResult[]): ArtefactData[] {
    const artefacts: ArtefactData[] = [];

    for (const r of results) {
      // Skip failed tool calls — no useful artefact data
      if (!r.result.success || !r.result.data) continue;

      // Skip local/meta tools that don't produce external artefacts
      if (r.toolId === 'session_search' || r.toolId === 'text_summarizer' || r.toolId === 'extract_structured_data') {
        continue;
      }

      const query = typeof r.params.query === 'string'
        ? r.params.query
        : JSON.stringify(r.params);
      const url = extractFirstUrl(r.result.data);
      const content = truncateForArtefact(r.result.data, 500);

      artefacts.push({
        toolId: r.toolId,
        toolName: r.toolName,
        query,
        url: url || (typeof r.params.url === 'string' ? r.params.url : undefined),
        content,
        rawResult: r.result.data,
      });
    }

    return artefacts;
  }

  /** Format tool results for injection into the synthesis prompt. */
  protected formatToolResults(results: ExecutedToolResult[]): string {
    if (results.length === 0) return '';

    const blocks = results.map(r => {
      const status = r.result.success ? 'SUCCESS' : 'FAILED';
      const data = r.result.success
        ? truncateToolOutput(r.result.data, 2000)
        : `Error: ${r.result.error}`;
      return `--- TOOL: ${r.toolName} (${r.toolId}) [${status}] ---\nQuery: ${JSON.stringify(r.params)}\n${data}`;
    });

    return `TOOL RESULTS:\n${blocks.join('\n\n')}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate tool output to avoid blowing up the synthesis context. */
function truncateToolOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n... [truncated, ${text.length - maxChars} chars omitted]`;
}

/** Extract the first URL found in a tool result string. */
function extractFirstUrl(text: string): string | undefined {
  // Match "URL: https://..." pattern (common in formatted tool results)
  const urlPattern = /URL:\s*(https?:\/\/\S+)/i;
  const match = text.match(urlPattern);
  if (match) return match[1];
  // Fallback: match any https URL
  const httpMatch = text.match(/https?:\/\/\S+/);
  return httpMatch ? httpMatch[0] : undefined;
}

/** Truncate text for artefact card content. */
function truncateForArtefact(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '…';
}
