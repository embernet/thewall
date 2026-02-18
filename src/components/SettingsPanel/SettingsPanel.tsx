import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApiSlot, ApiProvider, ApiKeyConfig } from '@/types';
import { SLOT_PROVIDERS, providerNeedsKey, getSlotDef, fetchProviderModels, getCachedModels } from '@/utils/providers';
import type { SlotDef, ModelDef } from '@/utils/providers';
import { setChatConfig, validateApiKey } from '@/utils/llm';
import { setEmbeddingConfig } from '@/utils/embedding-service';
import { setTranscriptionConfig } from '@/utils/transcription';
import { bus } from '@/events/bus';
import {
  loadSummaryPrompts,
  saveSummaryPrompts,
  resetAllBuiltInPrompts,
  DEFAULT_SUMMARY_PROMPTS,
} from '@/utils/summary-prompts';
import type { SummaryPrompt } from '@/utils/summary-prompts';
// Note: Column management is now handled by the ColumnSidebar component

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenAgentConfig?: () => void;
}

// ---------------------------------------------------------------------------
// Per-slot state
// ---------------------------------------------------------------------------

interface SlotState {
  provider: ApiProvider;
  modelId: string;
  key: string;
  hasExistingKey: boolean;
  dirty: boolean;
  saving: boolean;
  status: 'idle' | 'saved' | 'error' | 'validating' | 'valid' | 'invalid';
  statusMessage?: string;
}

function mkSlotState(slotDef: SlotDef, config?: ApiKeyConfig): SlotState {
  const defaultProv = slotDef.providers[0];
  const defaultModel = defaultProv.models[0];
  return {
    provider: config?.provider ?? (defaultProv.id as ApiProvider),
    modelId: config?.modelId ?? defaultModel.id,
    key: '',
    hasExistingKey: config?.hasKey ?? false,
    dirty: false,
    saving: false,
    status: config?.hasKey ? 'saved' : 'idle',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SettingsTab = 'columns' | 'agents' | 'api keys' | 'summaries';

export default function SettingsPanel({ open, onClose, onOpenAgentConfig }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>('columns');

  // API Key slot states
  const [slotStates, setSlotStates] = useState<Record<ApiSlot, SlotState>>({
    chat: mkSlotState(SLOT_PROVIDERS[0]),
    embeddings: mkSlotState(SLOT_PROVIDERS[1]),
    image_gen: mkSlotState(SLOT_PROVIDERS[2]),
    transcription: mkSlotState(SLOT_PROVIDERS[3]),
  });

  // Fetched models per provider (live from API)
  const [fetchedModels, setFetchedModels] = useState<Record<string, ModelDef[]>>({});

  // Summary prompts state
  const [summaryPrompts, setSummaryPrompts] = useState<SummaryPrompt[]>([]);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptDraft, setEditingPromptDraft] = useState('');
  const [editingLabelDraft, setEditingLabelDraft] = useState('');
  const [newPromptLabel, setNewPromptLabel] = useState('');
  const [newPromptText, setNewPromptText] = useState('');

  // Fetch live models for a provider using a decrypted key
  const fetchModelsForProvider = useCallback(async (provider: ApiProvider) => {
    // Check module-level cache first
    const cached = getCachedModels(provider);
    if (cached && cached.length > 0) {
      setFetchedModels(prev => ({ ...prev, [provider]: cached }));
      return;
    }
    // Fetch from API
    try {
      const key = await window.electronAPI?.db?.getDecryptedKey(
        // Find which slot uses this provider to get the right key
        provider === 'anthropic' ? 'chat' : provider === 'openai' ? 'chat' : 'chat'
      );
      if (!key) return;
      const models = await fetchProviderModels(provider, key);
      if (models.length > 0) {
        setFetchedModels(prev => ({ ...prev, [provider]: models }));
      }
    } catch (e) {
      console.warn(`Failed to fetch models for ${provider}:`, e);
    }
  }, []);

  // Load existing configs when panel opens, then fetch live models
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const configs: ApiKeyConfig[] = await window.electronAPI?.db?.getApiKeyConfigs() ?? [];
        const next: Record<ApiSlot, SlotState> = {
          chat: mkSlotState(SLOT_PROVIDERS[0], configs.find(c => c.slot === 'chat')),
          embeddings: mkSlotState(SLOT_PROVIDERS[1], configs.find(c => c.slot === 'embeddings')),
          image_gen: mkSlotState(SLOT_PROVIDERS[2], configs.find(c => c.slot === 'image_gen')),
          transcription: mkSlotState(SLOT_PROVIDERS[3], configs.find(c => c.slot === 'transcription')),
        };
        setSlotStates(next);

        // Fetch live models for providers that have keys
        const chatConfig = configs.find(c => c.slot === 'chat');
        if (chatConfig?.hasKey) {
          fetchModelsForProvider(chatConfig.provider as ApiProvider);
        }
      } catch (e) {
        console.warn('Failed to load API key configs:', e);
      }
    })();
  }, [open, fetchModelsForProvider]);

  // Load summary prompts when panel opens
  useEffect(() => {
    if (open) setSummaryPrompts(loadSummaryPrompts());
  }, [open]);

  // Update a single slot field
  const updateSlot = useCallback((slot: ApiSlot, patch: Partial<SlotState>) => {
    setSlotStates(prev => ({
      ...prev,
      [slot]: { ...prev[slot], ...patch, dirty: true },
    }));
  }, []);

  // Handle provider change — reset model to first for that provider, auto-save if key exists
  const onProviderChange = useCallback((slot: ApiSlot, providerId: ApiProvider) => {
    const slotDef = getSlotDef(slot);
    const provDef = slotDef?.providers.find(p => p.id === providerId);
    // Use fetched models if available, otherwise static
    const liveModels = fetchedModels[providerId];
    const firstModel = liveModels?.[0] ?? provDef?.models[0];
    updateSlot(slot, {
      provider: providerId,
      modelId: firstModel?.id ?? '',
      key: '',
      hasExistingKey: slotStates[slot].hasExistingKey,
      status: slotStates[slot].hasExistingKey ? slotStates[slot].status : 'idle',
    });
    // Fetch live models for the new provider
    fetchModelsForProvider(providerId);
    // Auto-save provider/model change if a key is already saved
    if (slotStates[slot].hasExistingKey) {
      // Defer so state update applies first
      setTimeout(() => pendingSaveRef.current = slot, 0);
    }
  }, [updateSlot, slotStates, fetchedModels, fetchModelsForProvider]);

  // Handle model change — auto-save if key exists
  const onModelChange = useCallback((slot: ApiSlot, modelId: string) => {
    updateSlot(slot, { modelId });
    if (slotStates[slot].hasExistingKey) {
      setTimeout(() => pendingSaveRef.current = slot, 0);
    }
  }, [updateSlot, slotStates]);

  // Ref for deferred auto-save after provider/model dropdown change
  const pendingSaveRef = useRef<ApiSlot | null>(null);

  // Save a slot
  const saveSlot = useCallback(async (slot: ApiSlot) => {
    const state = slotStates[slot];

    setSlotStates(prev => ({
      ...prev,
      [slot]: { ...prev[slot], saving: true },
    }));

    try {
      const keyToSave = state.key || '';
      await window.electronAPI.db.setApiKeyConfig(slot, state.provider, state.modelId, keyToSave);

      const { db } = window.electronAPI;

      // Re-read configs from DB to get authoritative hasKey state
      const updatedConfigs = await db.getApiKeyConfigs();
      const updatedSlot = updatedConfigs.find((c: ApiKeyConfig) => c.slot === slot);
      const hasKey = updatedSlot?.hasKey ?? !!keyToSave;

      // Refresh in-memory caches
      if (slot === 'chat') {
        const decrypted = await db.getDecryptedKey('chat');
        setChatConfig(state.provider, state.modelId, decrypted);
        if (!decrypted) {
          // No key to validate
          setSlotStates(prev => ({
            ...prev,
            chat: { ...prev.chat, saving: false, dirty: false, hasExistingKey: hasKey, status: 'saved' },
          }));
          bus.emit('api:statusChanged', { status: 'invalid' as const });
        } else {
          // Validate the key
          setSlotStates(prev => ({
            ...prev,
            chat: { ...prev.chat, saving: false, dirty: false, hasExistingKey: hasKey, status: 'validating' },
          }));
          const result = await validateApiKey();
          const mappedStatus = result === 'valid' ? 'valid' as const : result === 'invalid' ? 'invalid' as const : 'idle' as const;
          setSlotStates(prev => ({
            ...prev,
            chat: { ...prev.chat, status: mappedStatus },
          }));
          bus.emit('api:statusChanged', { status: result });
          // Fetch live models now that we have a valid key
          if (result === 'valid') fetchModelsForProvider(state.provider);
        }
      } else if (slot === 'embeddings') {
        const decrypted = providerNeedsKey(state.provider)
          ? await db.getDecryptedKey('embeddings')
          : '';
        setEmbeddingConfig(state.provider, state.modelId, decrypted);
        setSlotStates(prev => ({
          ...prev,
          embeddings: { ...prev.embeddings, saving: false, dirty: false, hasExistingKey: hasKey, status: 'saved' },
        }));
      } else if (slot === 'transcription') {
        const decrypted = providerNeedsKey(state.provider)
          ? await db.getDecryptedKey('transcription')
          : '';
        setTranscriptionConfig(state.provider, state.modelId, decrypted);
        setSlotStates(prev => ({
          ...prev,
          transcription: { ...prev.transcription, saving: false, dirty: false, hasExistingKey: hasKey, status: 'saved' },
        }));
      } else {
        // image_gen
        setSlotStates(prev => ({
          ...prev,
          image_gen: { ...prev.image_gen, saving: false, dirty: false, hasExistingKey: hasKey, status: 'saved' },
        }));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Failed to save API key config:', msg, e);
      setSlotStates(prev => ({
        ...prev,
        [slot]: { ...prev[slot], saving: false, status: 'error', statusMessage: msg },
      }));
    }
  }, [slotStates, fetchModelsForProvider]);

  // Auto-save when provider/model changes (deferred via ref to avoid stale state)
  useEffect(() => {
    if (pendingSaveRef.current) {
      const slot = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveSlot(slot);
    }
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="h-full w-[420px] overflow-auto border-l border-wall-border bg-wall-surface p-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-semibold text-wall-text">Settings</h2>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-base text-wall-text-dim hover:text-wall-text-muted"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Tab bar */}
        <div className="mb-3.5 flex gap-[3px] flex-wrap">
          {(['columns', 'agents', 'api keys', 'summaries'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'cursor-pointer rounded-md border-none px-2.5 py-[3px] text-[11px] font-medium capitalize ' +
                (tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-wall-border text-wall-text-dim hover:text-wall-text-muted')
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* Columns tab */}
        {tab === 'columns' && (
          <div className="py-4 text-center text-xs text-wall-text-dim">
            Use the sidebar on the left to manage column visibility, ordering, and layout.
          </div>
        )}

        {/* Agents tab */}
        {tab === 'agents' && (
          <div className="py-4 text-center">
            <div className="text-xs text-wall-text-dim mb-3">
              Configure agents, edit prompts, manage triggers, and create custom agents.
            </div>
            <button
              onClick={() => { onOpenAgentConfig?.(); onClose(); }}
              className="cursor-pointer rounded-md border border-indigo-500 bg-indigo-950 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-900"
            >
              {'\uD83E\uDD16'} Open Agent Configuration
            </button>
          </div>
        )}

        {/* API Keys tab */}
        {tab === 'api keys' && (
          <div className="space-y-4">
            <div className="text-xs text-wall-text-muted">
              Configure API keys for each capability. Keys are encrypted and stored locally.
            </div>

            {SLOT_PROVIDERS.map((slotDef) => (
              <SlotSection
                key={slotDef.slot}
                slotDef={slotDef}
                state={slotStates[slotDef.slot]}
                fetchedModels={fetchedModels[slotStates[slotDef.slot].provider]}
                onProviderChange={(p) => onProviderChange(slotDef.slot, p)}
                onModelChange={(m) => onModelChange(slotDef.slot, m)}
                onKeyChange={(k) => updateSlot(slotDef.slot, { key: k })}
                onSave={() => saveSlot(slotDef.slot)}
              />
            ))}
          </div>
        )}

        {/* Summaries tab */}
        {tab === 'summaries' && (
          <div className="space-y-4">
            <div className="text-xs text-wall-text-muted">
              Manage summary prompt templates. Edit built-in prompts or add your own.
            </div>

            {/* Reset all built-ins button */}
            <button
              onClick={() => {
                const updated = resetAllBuiltInPrompts();
                setSummaryPrompts(updated);
                setEditingPromptId(null);
              }}
              className="cursor-pointer rounded-md border border-wall-muted bg-wall-border px-3 py-1 text-[10px] font-medium text-wall-text-dim hover:bg-wall-muted"
            >
              Reset All System Prompts to Defaults
            </button>

            {/* Prompt list */}
            {summaryPrompts.map((prompt) => {
              const isEditing = editingPromptId === prompt.id;
              const isDefault = DEFAULT_SUMMARY_PROMPTS.some(d => d.id === prompt.id);
              const defaultPrompt = DEFAULT_SUMMARY_PROMPTS.find(d => d.id === prompt.id);
              const isModified = isDefault && defaultPrompt && defaultPrompt.prompt !== prompt.prompt;

              return (
                <div key={prompt.id} className="rounded-lg border border-wall-border bg-wall-bg p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex-1 text-xs font-semibold text-wall-text">
                      {prompt.label}
                    </span>
                    {prompt.builtIn && (
                      <span className="rounded-md bg-indigo-900/40 px-1.5 py-0.5 text-[8px] font-medium text-indigo-300">
                        System
                      </span>
                    )}
                    {isModified && (
                      <span className="rounded-md bg-amber-900/40 px-1.5 py-0.5 text-[8px] font-medium text-amber-300">
                        Modified
                      </span>
                    )}
                    {!prompt.builtIn && (
                      <button
                        onClick={() => {
                          const updated = summaryPrompts.filter(p => p.id !== prompt.id);
                          saveSummaryPrompts(updated);
                          setSummaryPrompts(updated);
                          if (editingPromptId === prompt.id) setEditingPromptId(null);
                        }}
                        className="cursor-pointer border-none bg-transparent text-[9px] text-red-400 hover:text-red-300"
                        title="Delete"
                      >
                        {'\uD83D\uDDD1\uFE0F'}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5">
                      {!prompt.builtIn && (
                        <input
                          value={editingLabelDraft}
                          onChange={(e) => setEditingLabelDraft(e.target.value)}
                          className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-xs text-wall-text outline-none"
                          style={{ boxSizing: 'border-box' }}
                          placeholder="Prompt name..."
                        />
                      )}
                      <textarea
                        value={editingPromptDraft}
                        onChange={(e) => setEditingPromptDraft(e.target.value)}
                        className="w-full resize-y rounded-md border border-wall-muted bg-wall-border px-2 py-1.5 text-[11px] text-wall-text outline-none font-inherit"
                        style={{ minHeight: 80, maxHeight: 300, boxSizing: 'border-box' }}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            const updated = summaryPrompts.map(p =>
                              p.id === prompt.id
                                ? { ...p, prompt: editingPromptDraft, label: prompt.builtIn ? p.label : editingLabelDraft }
                                : p,
                            );
                            saveSummaryPrompts(updated);
                            setSummaryPrompts(updated);
                            setEditingPromptId(null);
                          }}
                          className="cursor-pointer rounded-md border-none bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPromptId(null)}
                          className="cursor-pointer rounded-md border-none bg-wall-muted px-3 py-1 text-[10px] font-semibold text-wall-text-dim hover:bg-wall-border"
                        >
                          Cancel
                        </button>
                        {isDefault && (
                          <button
                            onClick={() => {
                              const def = DEFAULT_SUMMARY_PROMPTS.find(d => d.id === prompt.id);
                              if (def) {
                                setEditingPromptDraft(def.prompt);
                              }
                            }}
                            className="cursor-pointer rounded-md border-none bg-wall-muted px-3 py-1 text-[10px] font-semibold text-amber-400 hover:bg-wall-border"
                          >
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        className="text-[10px] text-wall-text-dim whitespace-pre-wrap line-clamp-3"
                        style={{ maxHeight: 60, overflow: 'hidden' }}
                      >
                        {prompt.prompt}
                      </div>
                      <button
                        onClick={() => {
                          setEditingPromptId(prompt.id);
                          setEditingPromptDraft(prompt.prompt);
                          setEditingLabelDraft(prompt.label);
                        }}
                        className="mt-1 cursor-pointer border-none bg-transparent text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add new prompt */}
            <div className="rounded-lg border border-dashed border-wall-muted bg-wall-bg p-3">
              <div className="mb-1.5 text-xs font-semibold text-wall-text">Add Custom Prompt</div>
              <input
                value={newPromptLabel}
                onChange={(e) => setNewPromptLabel(e.target.value)}
                placeholder="Prompt name..."
                className="mb-1.5 w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-xs text-wall-text outline-none"
                style={{ boxSizing: 'border-box' }}
              />
              <textarea
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder="Describe what kind of summary you want..."
                rows={3}
                className="w-full resize-y rounded-md border border-wall-muted bg-wall-border px-2 py-1.5 text-[11px] text-wall-text outline-none font-inherit"
                style={{ minHeight: 60, boxSizing: 'border-box' }}
              />
              <button
                onClick={() => {
                  if (!newPromptLabel.trim() || !newPromptText.trim()) return;
                  const newPrompt: SummaryPrompt = {
                    id: 'custom-' + Date.now(),
                    label: newPromptLabel.trim(),
                    prompt: newPromptText.trim(),
                    builtIn: false,
                  };
                  const updated = [...summaryPrompts, newPrompt];
                  saveSummaryPrompts(updated);
                  setSummaryPrompts(updated);
                  setNewPromptLabel('');
                  setNewPromptText('');
                }}
                disabled={!newPromptLabel.trim() || !newPromptText.trim()}
                className="mt-1.5 cursor-pointer rounded-md border-none bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Prompt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlotSection — one collapsible section per API slot
// ---------------------------------------------------------------------------

interface SlotSectionProps {
  slotDef: SlotDef;
  state: SlotState;
  fetchedModels?: ModelDef[];
  onProviderChange: (provider: ApiProvider) => void;
  onModelChange: (modelId: string) => void;
  onKeyChange: (key: string) => void;
  onSave: () => void;
}

const STATUS_DOT: Record<SlotState['status'], { color: string; label: string }> = {
  idle:       { color: '#475569', label: 'Not configured' },
  saved:      { color: '#22c55e', label: 'Saved' },
  error:      { color: '#ef4444', label: 'Save failed' },
  validating: { color: '#3b82f6', label: 'Validating...' },
  valid:      { color: '#22c55e', label: 'Valid' },
  invalid:    { color: '#ef4444', label: 'Invalid key' },
};

function SlotSection({ slotDef, state, fetchedModels, onProviderChange, onModelChange, onKeyChange, onSave }: SlotSectionProps) {
  const provDef = slotDef.providers.find(p => p.id === state.provider);
  // Use live-fetched models if available, otherwise fall back to static list
  const models = (fetchedModels && fetchedModels.length > 0) ? fetchedModels : (provDef?.models ?? []);
  const needsKey = providerNeedsKey(state.provider);
  const dot = STATUS_DOT[state.status];

  return (
    <div className="rounded-lg border border-wall-border bg-wall-bg p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: dot.color }}
          title={dot.label}
        />
        <span className="text-xs font-semibold text-wall-text">{slotDef.label}</span>
        <span className="text-[10px] text-wall-subtle">{slotDef.description}</span>
      </div>

      {/* Provider */}
      <div className="mb-2">
        <label className="mb-0.5 block text-[10px] font-medium text-wall-text-dim">Provider</label>
        <select
          value={state.provider}
          onChange={(e) => onProviderChange(e.target.value as ApiProvider)}
          className="w-full cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-xs text-wall-text outline-none"
        >
          {slotDef.providers.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Model */}
      <div className="mb-2">
        <label className="mb-0.5 block text-[10px] font-medium text-wall-text-dim">Model</label>
        <select
          value={state.modelId}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-1 text-xs text-wall-text outline-none"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.inputCost > 0 ? ` ($${(m.inputCost * 1_000_000).toFixed(2)}/$${(m.outputCost * 1_000_000).toFixed(2)} per 1M tok)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      {needsKey && (
        <div className="mb-2">
          <label className="mb-0.5 block text-[10px] font-medium text-wall-text-dim">
            API Key
            {state.hasExistingKey && !state.key && (
              <span className="ml-1 text-green-500">(saved)</span>
            )}
          </label>
          <input
            type="password"
            value={state.key}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={state.hasExistingKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (enter new key to replace)' : 'Enter API key...'}
            className="w-full rounded-md border border-wall-muted bg-wall-border px-2 py-1 font-mono text-xs text-wall-text outline-none"
            style={{ boxSizing: 'border-box' }}
          />
        </div>
      )}

      {/* Save button + status */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={state.saving}
            className="cursor-pointer rounded-md border-none bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.saving ? 'Saving...' : state.dirty ? 'Save' : 'Save'}
          </button>
          <span className="text-[10px]" style={{ color: dot.color }}>
            {dot.label}
          </span>
        </div>
        {state.status === 'error' && state.statusMessage && (
          <div className="text-[10px] text-red-400 break-all">{state.statusMessage}</div>
        )}
      </div>
    </div>
  );
}
