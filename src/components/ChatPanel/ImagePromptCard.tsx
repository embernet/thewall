// ============================================================================
// The Wall — Image Prompt Review / Edit Card
// ============================================================================
//
// Rendered when the Chat panel receives a 'prompt' result from the
// ImageGeneratorAgent.buildPrompt() call.
//
// Shows:
//   1. The full structured breakdown (SUBJECT/STYLE/MOOD/etc.) — read-only
//   2. An editable textarea pre-filled with the extracted FINAL PROMPT
//   3. Model picker — choose between Imagen 3, Imagen 3 Fast, Gemini image-gen, etc.
//   4. Optional input image selector (if user attached images)
//   5. "Generate Image" button
//   6. Loading/error states
// ============================================================================

import React, { useState, useEffect } from 'react';
import type { ImageAttachment } from '@/types';
import { getImageGenModels, fetchProviderModels } from '@/utils/providers';
import { getImageGenModel } from '@/utils/image-generation';

interface ImagePromptCardProps {
  structuredText: string;
  initialFinalPrompt: string;
  /** Called when the user clicks Generate. Receives the edited prompt, optional
   *  input image for image-to-image, and the chosen model ID. */
  onGenerate: (finalizedPrompt: string, inputImage?: ImageAttachment, modelId?: string) => void;
  attachedImages: ImageAttachment[];
  loading: boolean;
  error?: string;
}

// Human-readable descriptions shown below the picker when a model is selected
const MODEL_DESCRIPTIONS: Record<string, string> = {
  'imagen-3.0-generate-001':
    'Imagen 3 — dedicated text-to-image pipeline. High fidelity, strong prompt adherence.',
  'imagen-3.0-fast-generate-001':
    'Imagen 3 Fast — same pipeline, optimised for speed at lower cost.',
  'gemini-2.0-flash-preview-image-generation':
    'Gemini 2.0 Flash Image (Nano Banana Pro) — multimodal generate_content pathway. Conversational image generation with 4K quality support.',
};

const ImagePromptCard: React.FC<ImagePromptCardProps> = ({
  structuredText,
  initialFinalPrompt,
  onGenerate,
  attachedImages,
  loading,
  error,
}) => {
  const [finalPrompt, setFinalPrompt] = useState(initialFinalPrompt);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(
    attachedImages.length > 0 ? 0 : null,
  );
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Model picker — start with whatever is already cached/static, then refresh live
  const savedModel = getImageGenModel();
  const initialModels = getImageGenModels();
  const [availableModels, setAvailableModels] = useState(
    initialModels.length > 0 ? [...initialModels] : [],
  );
  const defaultModelId =
    availableModels.find((m) => m.id === savedModel)?.id ?? availableModels[0]?.id ?? savedModel;
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);

  // On mount, fetch live models from Google (same flow as Settings panel)
  useEffect(() => {
    const api = window.electronAPI?.db;
    if (!api?.getDecryptedKey) return;

    api.getDecryptedKey('image_gen').then(async (key) => {
      if (!key) return;
      const fetched = await fetchProviderModels('google', key);
      if (fetched.length > 0) {
        setAvailableModels(fetched);
        // If the currently saved model is in the fresh list, keep it; otherwise keep the default
        setSelectedModelId(prev =>
          fetched.find(m => m.id === prev) ? prev :
          fetched.find(m => m.id === savedModel)?.id ?? fetched[0]?.id ?? prev
        );
      }
    }).catch(() => {/* no key or IPC error — stay with static list */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isGemini = /gemini/i.test(selectedModelId);

  const handleGenerate = () => {
    if (!finalPrompt.trim() || loading) return;
    const inputImage =
      selectedImageIdx !== null ? attachedImages[selectedImageIdx] : undefined;
    onGenerate(finalPrompt.trim(), inputImage, selectedModelId || undefined);
  };

  return (
    <div
      className="rounded-lg border border-indigo-500/30 bg-indigo-950/30 p-3 text-[11px]"
      style={{ maxWidth: '100%' }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm">🎨</span>
        <span className="font-semibold text-indigo-300">Image Prompt</span>
        <span className="ml-auto text-[9px] text-wall-muted">Review & edit before generating</span>
      </div>

      {/* Structured breakdown toggle */}
      <button
        onClick={() => setShowBreakdown(v => !v)}
        className="mb-2 flex w-full cursor-pointer items-center gap-1 rounded border border-wall-border bg-wall-surface/50 px-2 py-1 text-left text-[10px] text-wall-subtle hover:text-wall-text transition-colors"
        style={{ border: 'none', background: 'rgba(30,41,59,0.5)' }}
      >
        <span>{showBreakdown ? '▾' : '▸'}</span>
        <span>Structured breakdown</span>
      </button>

      {showBreakdown && (
        <pre
          className="mb-2 max-h-64 overflow-y-auto rounded border border-wall-border bg-wall-bg p-2 text-[10px] leading-relaxed text-wall-subtle whitespace-pre-wrap"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}
        >
          {structuredText}
        </pre>
      )}

      {/* Editable final prompt */}
      <div className="mb-2">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-wall-subtle">
          Final Prompt (edit before generating)
        </div>
        <textarea
          value={finalPrompt}
          onChange={e => setFinalPrompt(e.target.value)}
          disabled={loading}
          rows={8}
          className="w-full resize-y rounded border border-wall-border bg-wall-bg px-2 py-1.5 text-[10px] leading-relaxed text-wall-text focus:outline-none focus:border-indigo-500 transition-colors"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--scrollbar-thumb) transparent',
            minHeight: '6rem',
          }}
        />
      </div>

      {/* Model picker */}
      <div className="mb-2">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-wall-subtle">
          Model
        </div>
        <select
          value={selectedModelId}
          onChange={e => setSelectedModelId(e.target.value)}
          disabled={loading}
          className="w-full cursor-pointer rounded border border-wall-muted bg-wall-border px-2 py-1 text-[10px] text-wall-text outline-none disabled:opacity-50"
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {/* Contextual description */}
        <p className="mt-1 text-[9px] leading-snug text-wall-muted">
          {MODEL_DESCRIPTIONS[selectedModelId] ?? (
            isGemini
              ? 'Gemini model — uses generate_content with IMAGE response modality.'
              : 'Imagen model — uses dedicated predict pipeline.'
          )}
        </p>
      </div>

      {/* Input image selector */}
      {attachedImages.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-wall-subtle">
            Input image (optional — for image-to-image)
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedImageIdx(null)}
              className="rounded border px-2 py-0.5 text-[10px] transition-colors cursor-pointer"
              style={{
                borderColor: selectedImageIdx === null ? '#6366f1' : 'var(--wall-muted-hex)',
                color: selectedImageIdx === null ? '#a5b4fc' : 'var(--wall-text-dim-hex)',
                background: selectedImageIdx === null ? 'rgba(99,102,241,0.15)' : 'transparent',
              }}
            >
              None
            </button>
            {attachedImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImageIdx(i)}
                className="relative cursor-pointer rounded border transition-colors p-0 overflow-hidden"
                style={{
                  borderColor: selectedImageIdx === i ? '#6366f1' : 'var(--wall-muted-hex)',
                  outline: selectedImageIdx === i ? '2px solid #6366f1' : 'none',
                }}
                title={img.name ?? `Image ${i + 1}`}
              >
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={img.name ?? `Image ${i + 1}`}
                  className="h-12 w-12 object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-2 rounded border border-red-700/40 bg-red-950/30 px-2 py-1.5 text-[10px] text-red-400">
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !finalPrompt.trim()}
        className="w-full cursor-pointer rounded-md py-1.5 text-[11px] font-semibold transition-colors border-none"
        style={{
          background:
            loading || !finalPrompt.trim()
              ? 'rgba(99,102,241,0.2)'
              : 'rgba(99,102,241,0.85)',
          color:
            loading || !finalPrompt.trim() ? '#6366f1' : '#e0e7ff',
          cursor: loading || !finalPrompt.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="animate-spin">⟳</span>
            Generating…
          </span>
        ) : (
          '✨ Generate Image'
        )}
      </button>
    </div>
  );
};

export default ImagePromptCard;
