// ============================================================================
// The Wall — Google Imagen 3 Image Generation Utility
// ============================================================================
//
// Mirrors the pattern of llm.ts: module-level cache, loadImageGenConfig(),
// setImageGenConfig(), and generateImage().
//
// Google's Generative AI API does not set CORS headers, so we proxy all
// calls through the Electron main process via IPC (window.electronAPI.generateImage).
// The main process handler is registered in electron/ipc/db-handlers.ts.
//
// TODO: Consider migrating generated image storage from base64 SQLite TEXT
// to the Asset file system once image volume becomes significant.
// ============================================================================

import type { ApiKeyConfig } from '@/types';

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cachedImageGenKey = '';
let cachedImageGenModel = 'imagen-3.0-generate-001';

// ---------------------------------------------------------------------------
// Public config setters (called from SettingsPanel after save)
// ---------------------------------------------------------------------------

export const setImageGenConfig = (key: string, modelId: string): void => {
  cachedImageGenKey = key;
  cachedImageGenModel = modelId;
};

export const getImageGenModel = (): string => cachedImageGenModel;

export const hasImageGenKey = (): boolean => !!cachedImageGenKey;

// ---------------------------------------------------------------------------
// Load from encrypted DB via IPC
// ---------------------------------------------------------------------------

/**
 * Load image_gen slot configuration from the database.
 * Returns true if a valid key was found.
 */
export const loadImageGenConfig = async (): Promise<boolean> => {
  try {
    const configs: ApiKeyConfig[] = await window.electronAPI?.db?.getApiKeyConfigs() ?? [];
    const cfg = configs.find(c => c.slot === 'image_gen');
    if (cfg) {
      cachedImageGenModel = cfg.modelId || 'imagen-3.0-generate-001';
      if (cfg.hasKey) {
        cachedImageGenKey = await window.electronAPI?.db?.getDecryptedKey('image_gen') ?? '';
        return !!cachedImageGenKey;
      }
    }
  } catch (e) {
    console.warn('Failed to load image gen config:', e);
  }
  return false;
};

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

export interface GeneratedImage {
  /** Base64-encoded image data — no data: URI prefix. */
  imageData: string;
  mimeType: string;
}

/**
 * Generate an image via Google Imagen 3 or Gemini image-generation models.
 *
 * Always proxied through Electron main process to avoid CORS restrictions.
 *
 * @param prompt - The text prompt for image generation.
 * @param inputImageBase64 - Optional base64 input image for image-to-image generation.
 * @param modelId - Optional model override (used when the per-card picker differs from settings).
 */
export const generateImage = async (
  prompt: string,
  inputImageBase64?: string,
  modelId?: string,
): Promise<GeneratedImage> => {
  if (!window.electronAPI?.generateImage) {
    throw new Error('Image generation IPC not available');
  }

  const result = await window.electronAPI.generateImage(prompt, inputImageBase64, modelId);

  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.imageData) {
    throw new Error('No image data returned from Imagen API');
  }

  return {
    imageData: result.imageData,
    mimeType: result.mimeType || 'image/png',
  };
};
