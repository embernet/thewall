// ============================================================================
// The Wall — Image Generator Agent
// ============================================================================
//
// A utility agent that operates in two modes:
//
//   buildPrompt(userIntent)  — asks Claude to produce a structured Imagen 3
//                              prompt with SUBJECT / STYLE / MOOD /
//                              COMPOSITION / TECHNICAL sections, plus a
//                              combined FINAL PROMPT the user can review and
//                              edit before generating.
//
//   generateImage(prompt, inputImage?)  — calls Google Imagen 3 via the
//                              image-generation utility (IPC proxy).
//
// The agent extends BaseAgent so it appears in the registry and @help output,
// but the two real methods bypass the standard execute() pipeline.
// ChatPanel calls buildPrompt() and generateImage() directly.
// ============================================================================

import { BaseAgent, type AgentContext, type AgentResult } from '../base';
import { askClaude, askClaudeMultimodal } from '@/utils/llm';
import { generateImage as doGenerateImage, loadImageGenConfig } from '@/utils/image-generation';
import type { ImageAttachment } from '@/types';

// ---------------------------------------------------------------------------
// Image Generator Agent
// ---------------------------------------------------------------------------

class ImageGeneratorAgent extends BaseAgent {
  readonly id = 'image-generator';
  readonly name = 'Image Generator';
  readonly description =
    'Generates structured image prompts for review, then produces images via Google Imagen 3. Supports both text-only and image-to-image generation.';
  readonly targetColumn = 'context';
  readonly agentType: 'utility' = 'utility';
  readonly triggersOnTranscript = false;
  readonly priority = 8;
  readonly inputSummary = 'User intent text + optional input image';
  readonly behaviorType: 'prompt-plus-code' = 'prompt-plus-code';

  // ── BaseAgent abstract stubs ──────────────────────────────────────────────
  // These are not used directly — ChatPanel calls buildPrompt() and
  // generateImage() instead. They are here to satisfy the abstract interface.

  systemPrompt(_ctx: AgentContext): string {
    return 'You are an expert visual prompt engineer for Google Imagen 3.';
  }

  userPrompt(_ctx: AgentContext): string {
    return '';
  }

  shouldActivate(_ctx: AgentContext): boolean {
    return false; // never auto-triggers
  }

  async execute(_ctx: AgentContext): Promise<AgentResult> {
    // No-op — use buildPrompt() and generateImage() directly
    return { cards: [], raw: '' };
  }

  // ── Primary API ───────────────────────────────────────────────────────────

  /**
   * Mode A: Given a user's creative intent (and optional reference images),
   * ask Claude to generate a structured Imagen 3 prompt.
   *
   * When images are provided (e.g. a whiteboard photo) Claude analyses them
   * visually and incorporates their content into the prompt.
   *
   * Returns:
   *   structuredText — the full breakdown (SUBJECT/STYLE/MOOD/etc.)
   *   finalPrompt    — the extracted FINAL PROMPT section for the editable field
   */
  async buildPrompt(
    userIntent: string,
    referenceImages?: ImageAttachment[],
  ): Promise<{ structuredText: string; finalPrompt: string }> {
    const sys = [
      'You are an expert visual prompt engineer for Google Imagen 3.',
      '',
      'Given a user\'s creative intent (and any reference images provided), produce a',
      'detailed structured image prompt. If reference images are supplied, analyse their',
      'visual content thoroughly and incorporate specific details — layout, elements,',
      'colours, structure — into your prompt.',
      '',
      'Use EXACTLY this format, filling in real content (not placeholder text):',
      '',
      'SUBJECT: <detailed description of the main subject(s) and all key elements>',
      'STYLE: <art style, medium, technique, artist references if appropriate>',
      'MOOD: <atmosphere, emotional tone, lighting, colour palette>',
      'COMPOSITION: <framing, perspective, layout, foreground/background elements>',
      'TECHNICAL: <resolution, quality descriptors, rendering style>',
      '',
      'FINAL PROMPT: <A single cohesive paragraph — at least 4-6 sentences — combining',
      'all sections above into one fluid, vivid, richly detailed prompt ready to send',
      'to Imagen 3. Include ALL important visual details. NO brackets, NO placeholders',
      '— real descriptive text only.>',
      '',
      'Rules:',
      '- Every section MUST be on its own line starting with the label',
      '- FINAL PROMPT MUST be comprehensive — do not truncate or summarise; include',
      '  enough detail for the model to produce a faithful, high-quality result',
      '- FINAL PROMPT is always the last section',
      '- Base ALL sections on the user\'s actual intent — do not invent unrelated subjects',
      '- Be specific and vivid; Imagen 3 responds well to detailed, descriptive language',
      '- If intent mentions meeting notes, transcripts, or whiteboards, use',
      '  infographic/diagram aesthetics: clean, professional, data-visualisation style',
    ].join('\n');

    const userMsg = referenceImages?.length
      ? `Create a detailed Imagen 3 prompt for the following intent. Reference image(s) are attached — analyse them and incorporate their visual content into the prompt.\n\nIntent: ${userIntent}`
      : `Create a detailed Imagen 3 prompt for:\n\n${userIntent}`;

    // 2000 tokens — infographic prompts derived from meeting content can be lengthy.
    // Using multimodal when reference images are present so Claude can see them.
    const raw = referenceImages?.length
      ? await askClaudeMultimodal(sys, userMsg, referenceImages, 2000)
      : await askClaude(sys, userMsg, 2000);
    if (!raw) throw new Error('LLM returned no response when building image prompt');

    // Extract FINAL PROMPT section.
    // Strategy: find "FINAL PROMPT:" label and take everything after it.
    // FINAL PROMPT is always the last labeled section so we just grab to end-of-string.
    let finalPrompt: string;
    const finalPromptIdx = raw.search(/^FINAL PROMPT:/im);
    if (finalPromptIdx !== -1) {
      // Everything after "FINAL PROMPT:" on that line and below
      const afterLabel = raw.slice(finalPromptIdx).replace(/^FINAL PROMPT:\s*/i, '').trim();
      // Take the content — could be multi-line; trim leading/trailing whitespace
      finalPrompt = afterLabel.trim();
    } else {
      // Fallback: take the longest paragraph in the response (most likely to be the final prompt)
      const paragraphs = raw.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);
      finalPrompt = paragraphs.sort((a, b) => b.length - a.length)[0] ?? raw.trim();
    }

    return { structuredText: raw, finalPrompt };
  }

  /**
   * Mode B: Generate an image from a finalized prompt.
   * Routes to Imagen 3 (predict) or Gemini (generateContent) based on modelId.
   *
   * @param finalizedPrompt - The reviewed/edited prompt text.
   * @param inputImage      - Optional reference image for image-to-image generation.
   * @param modelId         - Model to use; overrides the saved settings selection.
   */
  async generateImage(
    finalizedPrompt: string,
    inputImage?: ImageAttachment,
    modelId?: string,
  ): Promise<{ imageData: string; mimeType: string }> {
    // Ensure config is loaded (user may have set key after app start)
    await loadImageGenConfig();
    return doGenerateImage(finalizedPrompt, inputImage?.data, modelId);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const imageGenerator = new ImageGeneratorAgent();
