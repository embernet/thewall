import { create } from 'zustand';
import { temporal } from 'zundo';
import type { TemporalState } from 'zundo';
import type { StoreApi } from 'zustand';
import type {
  Session,
  Column,
  Card,
  AudioState,
  AgentTask,
  AppView,
  SaveStatus,
  SessionMode,
  HighlightState,
} from '@/types';
import { bus } from '@/events/bus';

/* ------------------------------------------------------------------ */
/*  Highlight toggle map: none->user, user->none, ai->both, both->ai  */
/* ------------------------------------------------------------------ */
const HIGHLIGHT_NEXT: Record<string, string> = {
  none: 'user',
  user: 'none',
  ai: 'both',
  both: 'ai',
};

/* ------------------------------------------------------------------ */
/*  Store shape                                                        */
/* ------------------------------------------------------------------ */

export interface SessionState {
  /* data */
  view: AppView;
  session: Session | null;
  columns: Column[];
  cards: Card[];
  audio: AudioState;
  agentBusy: Record<string, boolean>;
  agentTasks: AgentTask[];
  speakerColors: Record<string, string>;
  saveStatus: SaveStatus;

  /* actions */
  init: (state: {
    session: Session;
    columns: Column[];
    cards: Card[];
    audio: AudioState;
    agentBusy: Record<string, boolean>;
    agentTasks: AgentTask[];
    speakerColors: Record<string, string>;
  }) => void;
  setTitle: (title: string) => void;
  setMode: (mode: SessionMode) => void;
  addCard: (card: Card) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  moveCard: (cardId: string, columnId: string, sortOrder: string) => void;
  toggleHighlight: (id: string) => void;
  toggleColumnVisibility: (id: string) => void;
  toggleColumnCollapsed: (id: string) => void;
  emptyTrash: () => void;
  setAudio: (updates: Partial<AudioState>) => void;
  setAgentBusy: (key: string, busy: boolean) => void;
  addAgentTask: (task: AgentTask) => void;
  updateAgentTask: (id: string, updates: Partial<AgentTask>) => void;
  setView: (view: AppView) => void;
  setSpeakerColors: (colors: Record<string, string>) => void;
  setSaveStatus: (status: SaveStatus) => void;
  goToLauncher: () => void;
}

/* ------------------------------------------------------------------ */
/*  Default initial state                                              */
/* ------------------------------------------------------------------ */

const initialState: Pick<
  SessionState,
  | 'view'
  | 'session'
  | 'columns'
  | 'cards'
  | 'audio'
  | 'agentBusy'
  | 'agentTasks'
  | 'speakerColors'
  | 'saveStatus'
> = {
  view: 'launcher',
  session: null,
  columns: [],
  cards: [],
  audio: {
    recording: false,
    paused: false,
    level: 0,
    elapsed: 0,
    autoScroll: true,
  },
  agentBusy: {},
  agentTasks: [],
  speakerColors: {},
  saveStatus: 'idle',
};

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const useSessionStore = create<SessionState>()(temporal((set, get) => ({
  ...initialState,

  // ── INIT: replace entire state, switch view to session ──
  init: (incoming) =>
    set(() => ({
      ...incoming,
      view: 'session' as AppView,
      saveStatus: 'idle' as SaveStatus,
    })),

  // ── SET_TITLE ──
  setTitle: (title) =>
    set((state) => ({
      session: state.session ? { ...state.session, title } : state.session,
    })),

  // ── SET_MODE ──
  setMode: (mode) => {
    set((state) => ({
      session: state.session ? { ...state.session, mode } : state.session,
    }));
    bus.emit('session:modeChanged', { mode });
  },

  // ── ADD_CARD ──
  addCard: (card) => {
    set((state) => ({
      cards: [...state.cards, card],
    }));
    bus.emit('card:created', { card });
  },

  // ── UPDATE_CARD: partial update by id, refresh updatedAt ──
  updateCard: (id, updates) => {
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c,
      ),
    }));
    const card = get().cards.find((c) => c.id === id);
    if (card) bus.emit('card:updated', { card });
  },

  // ── DELETE_CARD: move card to the trash column ──
  deleteCard: (id) => {
    set((state) => {
      const trashCol = state.columns.find((c) => c.type === 'trash');
      if (!trashCol) return state;
      return {
        cards: state.cards.map((c) =>
          c.id === id ? { ...c, columnId: trashCol.id, isDeleted: true } : c,
        ),
      };
    });
    bus.emit('card:deleted', { cardId: id });
  },

  // ── MOVE_CARD: re-parent card to a new column ──
  moveCard: (cardId, columnId, sortOrder) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId
          ? { ...c, columnId, sortOrder, isDeleted: false }
          : c,
      ),
    })),

  // ── TOGGLE_HL: cycle highlight state ──
  toggleHighlight: (id) =>
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          highlightedBy: (HIGHLIGHT_NEXT[c.highlightedBy] ?? 'user') as HighlightState,
        };
      }),
    })),

  // ── TOG_VIS: toggle column visibility ──
  toggleColumnVisibility: (id) =>
    set((state) => ({
      columns: state.columns.map((c) =>
        c.id === id ? { ...c, visible: !c.visible } : c,
      ),
    })),

  // ── TOG_COLL: toggle column collapsed ──
  toggleColumnCollapsed: (id) =>
    set((state) => ({
      columns: state.columns.map((c) =>
        c.id === id ? { ...c, collapsed: !c.collapsed } : c,
      ),
    })),

  // ── EMPTY_TRASH: remove all cards in the trash column ──
  emptyTrash: () =>
    set((state) => {
      const trashCol = state.columns.find((c) => c.type === 'trash');
      return {
        cards: state.cards.filter((c) => c.columnId !== trashCol?.id),
      };
    }),

  // ── SET_AUDIO: merge partial audio updates ──
  setAudio: (updates) =>
    set((state) => ({
      audio: { ...state.audio, ...updates },
    })),

  // ── SET_BUSY: set busy flag for a column type key ──
  setAgentBusy: (key, busy) =>
    set((state) => ({
      agentBusy: { ...state.agentBusy, [key]: busy },
    })),

  // ── ADD_TASK: append agent task ──
  addAgentTask: (task) => {
    set((state) => ({
      agentTasks: [...state.agentTasks, task],
    }));
    bus.emit('agent:started', { taskId: task.id, agentKey: task.agentKey });
  },

  // ── UPD_TASK: update specific agent task by id ──
  updateAgentTask: (id, updates) => {
    set((state) => ({
      agentTasks: state.agentTasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    }));
    if (updates.status === 'completed') {
      const task = get().agentTasks.find((t) => t.id === id);
      if (task) bus.emit('agent:completed', { taskId: id, agentKey: task.agentKey, cardsCreated: task.cardsCreated });
    } else if (updates.status === 'failed') {
      const task = get().agentTasks.find((t) => t.id === id);
      if (task) bus.emit('agent:failed', { taskId: id, agentKey: task.agentKey, error: task.error || 'unknown' });
    }
  },

  // ── SET_VIEW ──
  setView: (view) => set(() => ({ view })),

  // ── SET_COLORS ──
  setSpeakerColors: (colors) => set(() => ({ speakerColors: colors })),

  // ── SET_SAVE_STATUS ──
  setSaveStatus: (status) => set(() => ({ saveStatus: status })),

  // ── GO_TO_LAUNCHER: reset session state and return to launcher view ──
  goToLauncher: () =>
    set(() => ({
      view: 'launcher' as AppView,
      session: null,
      columns: [],
      cards: [],
      audio: {
        recording: false,
        paused: false,
        level: 0,
        elapsed: 0,
        autoScroll: true,
      },
      agentBusy: {},
      agentTasks: [],
      speakerColors: {},
      saveStatus: 'idle' as SaveStatus,
    })),
}), {
  // Only track card/column data changes for undo/redo, not transient UI state
  partialize: (state) => ({
    cards: state.cards,
    columns: state.columns,
  }),
  limit: 50,
}));

// Expose temporal store for keyboard shortcuts
export const useTemporalStore = <T>(
  selector: (state: TemporalState<Pick<SessionState, 'cards' | 'columns'>>) => T,
) => {
  const store = useSessionStore.temporal as StoreApi<TemporalState<Pick<SessionState, 'cards' | 'columns'>>>;
  return selector(store.getState());
};

// Direct access for non-React code (e.g., keyboard handler)
useTemporalStore.getState = () => {
  const store = useSessionStore.temporal as StoreApi<TemporalState<Pick<SessionState, 'cards' | 'columns'>>>;
  return store.getState();
};
