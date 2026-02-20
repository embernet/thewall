import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSessionStore } from '@/store/session';
import Launcher from '@/components/Launcher/Launcher';
import Column from '@/components/Column/Column';
import AgentQueueColumn from '@/components/Column/AgentQueueColumn';
import ContextColumn from '@/components/Column/ContextColumn';
import SummaryColumn from '@/components/Column/SummaryColumn';
import ColumnSidebar from '@/components/ColumnSidebar/ColumnSidebar';
import SettingsPanel from '@/components/SettingsPanel/SettingsPanel';
import ExportMenu from '@/components/ExportMenu/ExportMenu';
import KnowledgeGraph from '@/components/KnowledgeGraph/KnowledgeGraph';
import type { GraphMode } from '@/components/KnowledgeGraph/KnowledgeGraph';
import SearchOverlay from '@/components/SearchOverlay/SearchOverlay';
import NotificationToast from '@/components/NotificationToast/NotificationToast';
import CostDashboard from '@/components/CostDashboard/CostDashboard';
import AgentConfig from '@/components/AgentConfig/AgentConfig';
import FindRelatedView from '@/components/FindRelatedModal/FindRelatedModal';
import HelpModal from '@/components/HelpModal/HelpModal';
import AboutModal from '@/components/AboutModal/AboutModal';
import ChatPanel from '@/components/ChatPanel/ChatPanel';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { askClaude, loadChatConfig, validateApiKey, getApiKey, getChatProvider } from '@/utils/llm';
import { loadEmbeddingConfig, getEmbeddingProvider } from '@/utils/embedding-service';
import { loadImageGenConfig } from '@/utils/image-generation';
import { fetchProviderModels } from '@/utils/providers';
import type { ApiKeyStatus, EmbeddingProvider } from '@/types';
import { bus } from '@/events/bus';
import { uid, now, mid } from '@/utils/ids';
import { COL_TYPES, SPEAKER_COLORS } from '@/types';
import { initOrchestrator, destroyOrchestrator } from '@/agents/orchestrator';
import { workerPool } from '@/agents/worker-pool';
import { useAgentConfigStore } from '@/store/agent-config';
import { startTranscription, stopTranscription, pauseTranscription, resumeTranscription, loadTranscriptionConfig } from '@/utils/transcription';
import { initTranscriptPipeline, destroyTranscriptPipeline, flushTranscriptPipeline } from '@/utils/transcript-pipeline';
import { useKeyboard } from '@/hooks/useKeyboard';
import { isChunkCard, getParentDocId, getFileName } from '@/utils/document-cards';
import { personaRegistry } from '@/personas/base';
import type { Card, Column as ColumnType, SessionIndexEntry, SimConfig, AgentTask } from '@/types';

export default function App() {
  const store = useSessionStore();
  const {
    view, session, columns, cards, audio, agentBusy, agentTasks, speakerColors,
    init, addCard, setAudio,
    setView, setSpeakerColors, setSaveStatus, goToLauncher,
    toggleColumnVisibility, toggleColumnCollapsed,
    setColumnVisible, updateColumnOrder, addColumn, removeColumn,
    linkCards,
  } = store;

  const searchCb = useMemo(() => ({
    onSearch: () => setSearchOpen(o => !o),
    onFind: () => {
      setFindRelatedInitialCard(null);
      setFindRelatedOpen(o => !o);
    },
    onEscape: () => setLinkingFrom(null),
  }), []);
  useKeyboard(searchCb);

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    localStorage.getItem('wall:sidebar') !== 'closed',
  );
  const [chatOpen, setChatOpen] = useState(() =>
    localStorage.getItem('wall:chat-panel') !== 'closed',
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphMode>('panel');
  const [searchOpen, setSearchOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [agentConfigOpen, setAgentConfigOpen] = useState(false);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [sessions, setSessions] = useState<SessionIndexEntry[]>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('unchecked');
  const [embeddingProvider, setEmbeddingProvider] = useState<EmbeddingProvider>('local');
  const [concurrency, setConcurrency] = useState(3);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [findRelatedOpen, setFindRelatedOpen] = useState(false);
  const [findRelatedInitialCard, setFindRelatedInitialCard] = useState<Card | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('wall:dark-mode');
    return stored !== 'false'; // default to dark
  });

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.classList.toggle('light', !darkMode);
    localStorage.setItem('wall:dark-mode', String(darkMode));
  }, [darkMode]);

  // Agent config store (for sidebar Agents tab)
  const agentConfigStore = useAgentConfigStore();
  const handleToggleAgent = useCallback((agentId: string, enabled: boolean) => {
    agentConfigStore.saveConfig(agentId, { enabled });
  }, [agentConfigStore]);
  const handleConcurrencyChange = useCallback((n: number) => {
    setConcurrency(n);
    workerPool.setConcurrency(n);
  }, []);

  const cardsRef = useRef<Card[]>([]);
  const simAbort = useRef(false);
  const timerStart = useRef<number | null>(null);
  const timerIv = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => { cardsRef.current = cards; }, [cards]);

  // Persist sidebar open/closed to localStorage
  useEffect(() => {
    localStorage.setItem('wall:sidebar', sidebarOpen ? 'open' : 'closed');
  }, [sidebarOpen]);

  // ── Broadcast API status changes to the event bus (auto-pauses agent queue) ──
  useEffect(() => {
    bus.emit('api:statusChanged', { status: apiKeyStatus });
  }, [apiKeyStatus]);

  // ── Load API configs from encrypted DB on startup, validate chat key ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Load chat config from DB
      try {
        const hasKey = await loadChatConfig();
        if (cancelled) return;
        if (hasKey) {
          setApiKeyStatus('checking');
          try {
            const result = await validateApiKey();
            if (!cancelled) setApiKeyStatus(result);
            // Pre-fetch available models for the configured provider
            if (!cancelled && result === 'valid') {
              fetchProviderModels(getChatProvider(), getApiKey()).catch(() => {});
            }
          } catch (e) {
            console.warn('API key validation failed:', e);
            if (!cancelled) setApiKeyStatus('invalid');
          }
        }
      } catch (e) {
        console.warn('Failed to load chat config:', e);
        if (!cancelled) setApiKeyStatus('invalid');
      }
      // Load embedding config from DB
      try {
        await loadEmbeddingConfig();
        if (!cancelled) setEmbeddingProvider(getEmbeddingProvider());
      } catch (e) {
        console.warn('Failed to load embedding config:', e);
      }
      // Load transcription config from DB
      try {
        await loadTranscriptionConfig();
      } catch (e) {
        console.warn('Failed to load transcription config:', e);
      }
      // Load image generation config from DB
      try {
        await loadImageGenConfig();
      } catch (e) {
        console.warn('Failed to load image gen config:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load sessions index ──
  const loadSessions = useCallback(async () => {
    if (window.electronAPI) {
      const rows = await window.electronAPI.db.getSessions();
      setSessions(rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        mode: r.mode,
        updatedAt: r.updated_at || r.updatedAt,
        cardCount: r.card_count ?? r.cardCount ?? 0,
      })));
    }
  }, []);

  useEffect(() => {
    if (view === 'launcher') loadSessions();
  }, [view, loadSessions]);

  // ── Persist column visibility/order/collapsed/config changes to DB ──
  const prevColStateRef = useRef<string>('');
  useEffect(() => {
    if (!session?.id || !window.electronAPI) return;
    const serialized = JSON.stringify(
      columns.map((c) => ({ id: c.id, visible: c.visible, collapsed: c.collapsed, sortOrder: c.sortOrder, config: c.config })),
    );
    if (serialized === prevColStateRef.current) return;
    prevColStateRef.current = serialized;
    for (const col of columns) {
      window.electronAPI.db
        .updateColumn(col.id, { visible: col.visible, collapsed: col.collapsed, sortOrder: col.sortOrder, config: col.config })
        .catch(console.error);
    }
  }, [columns, session?.id]);

  // ── Auto-save to SQLite ──
  useEffect(() => {
    if (!session?.id || view !== 'session' || !window.electronAPI) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await window.electronAPI.db.updateSession(session.id, {
          title: session.title,
          mode: session.mode,
          goal: session.goal,
          status: session.status,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [session?.title, session?.mode, session?.goal, columns, view, session?.id, setSaveStatus, session?.status]);

  // Save cards immediately on add
  const prevCardLen = useRef(0);
  useEffect(() => {
    const len = cards.length;
    if (session?.id && len > prevCardLen.current && len > 0 && window.electronAPI) {
      const newCards = cards.slice(prevCardLen.current);
      for (const card of newCards) {
        window.electronAPI.db.createCard(card).catch(console.error);
      }
      setSaveStatus('saved');
    }
    prevCardLen.current = len;
  }, [cards.length, session?.id, cards, setSaveStatus]);

  // ── Persist card updates and deletes ──
  useEffect(() => {
    if (!session?.id || !window.electronAPI) return;

    const handleUpdate = ({ card }: { card: Card }) => {
      window.electronAPI.db
        .updateCard(card.id, {
          content: card.content,
          highlightedBy: card.highlightedBy,
          isDeleted: card.isDeleted,
          columnId: card.columnId,
          sortOrder: card.sortOrder,
          aiTags: card.aiTags,
          userTags: card.userTags,
          sourceCardIds: card.sourceCardIds,
          pinned: card.pinned,
          speaker: card.speaker,
        })
        .catch(console.error);
    };

    const handleDelete = ({ cardId }: { cardId: string }) => {
      const card = cardsRef.current.find((c) => c.id === cardId);
      if (card) {
        window.electronAPI.db
          .updateCard(cardId, { isDeleted: true, columnId: card.columnId })
          .catch(console.error);
      }
    };

    bus.on('card:updated', handleUpdate);
    bus.on('card:deleted', handleDelete);
    return () => {
      bus.off('card:updated', handleUpdate);
      bus.off('card:deleted', handleDelete);
    };
  }, [session?.id]);

  // ── Persist speaker color changes ──
  useEffect(() => {
    if (!session?.id || !window.electronAPI) return;
    const sid = session.id;

    const handleColorsUpdated = ({ colors }: { colors: Record<string, string> }) => {
      window.electronAPI.db.saveSpeakerColors(sid, colors).catch(console.error);
    };

    bus.on('speakerColors:updated', handleColorsUpdated);
    return () => { bus.off('speakerColors:updated', handleColorsUpdated); };
  }, [session?.id]);

  // ── Document chunk column creation (listen for viewChunks events) ──
  useEffect(() => {
    const handler = ({ docCardId }: { docCardId: string; highlightChunkId?: string }) => {
      if (!session?.id) return;
      // Check if a chunk column for this document already exists
      const existing = columns.find(
        (c) => c.config?.docCardId === docCardId && c.config?.ephemeral,
      );
      if (existing) {
        // Make sure it's visible
        if (!existing.visible) setColumnVisible(existing.id, true);
        if (existing.collapsed) toggleColumnCollapsed(existing.id);
        return;
      }
      // Find the document card to get the file name
      const docCard = cards.find((c) => c.id === docCardId);
      const fileName = docCard ? getFileName(docCard) || 'Document' : 'Document';
      const truncName = fileName.length > 20 ? fileName.slice(0, 20) + '...' : fileName;
      // Place it right after the context column
      const ctxCol = columns.find((c) => c.type === 'context');
      const afterSort = ctxCol?.sortOrder || 'b';
      const chunkCol: ColumnType = {
        id: uid(),
        sessionId: session.id,
        type: 'context',
        title: '\uD83D\uDCC4 ' + truncName,
        sortOrder: afterSort + 'a',
        visible: true,
        collapsed: false,
        config: { docCardId, ephemeral: true },
      };
      addColumn(chunkCol);
      // Persist to DB
      if (window.electronAPI) {
        window.electronAPI.db.createColumn(chunkCol).catch(console.error);
      }
    };
    bus.on('document:viewChunks', handler);
    return () => { bus.off('document:viewChunks', handler); };
  }, [session?.id, columns, cards, setColumnVisible, toggleColumnCollapsed, addColumn]);

  // ── Find Related event listener ──
  useEffect(() => {
    const handler = ({ card }: { card: Card }) => {
      setFindRelatedInitialCard(card);
      setFindRelatedOpen(true);
    };
    bus.on('card:findRelated', handler);
    return () => { bus.off('card:findRelated', handler); };
  }, []);

  // ── Agent Orchestrator + Transcript Pipeline ──
  useEffect(() => {
    if (view === 'session' && session?.id) {
      initOrchestrator().catch(e => console.warn('Orchestrator init failed:', e));
      initTranscriptPipeline();
    }
    return () => {
      destroyOrchestrator();
      destroyTranscriptPipeline();
    };
  }, [view, session?.id]);

  // ── Speech Recognition ──
  const addTranscriptCard = useCallback((text: string, speaker?: string) => {
    if (!text?.trim() || !session?.id) return;
    const tcol = columns.find(c => c.type === 'transcript');
    if (!tcol) return;
    const existing = cardsRef.current.filter(c => c.columnId === tcol.id);
    const last = existing[existing.length - 1];
    addCard({
      id: uid(), columnId: tcol.id, sessionId: session.id, content: text.trim(),
      source: 'transcription', speaker: speaker || undefined,
      timestamp: Date.now() - (timerStart.current || Date.now()),
      sourceCardIds: [], aiTags: [], userTags: ['transcript:raw'], highlightedBy: 'none', isDeleted: false,
      createdAt: now(), updatedAt: now(), sortOrder: last ? mid(last.sortOrder) : 'n',
    });
  }, [session?.id, columns, addCard]);

  const startAudioLevel = useCallback(async (existingStream?: MediaStream) => {
    try {
      const stream = existingStream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtxRef.current = new AudioContext();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
        setAudio({ level: avg * 2.5, elapsed: Date.now() - (timerStart.current || Date.now()) });
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
      return stream;
    } catch {
      timerIv.current = setInterval(() => {
        setAudio({ level: 0.3 + Math.random() * 0.5, elapsed: Date.now() - (timerStart.current || Date.now()) });
      }, 100);
      return null;
    }
  }, [setAudio]);

  const stopAudioLevel = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerIv.current) clearInterval(timerIv.current);
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // Listen for transcription results on the event bus — no stale closures
  useEffect(() => {
    const onSegment = ({ text }: { text: string }) => addTranscriptCard(text);
    bus.on('transcript:segment', onSegment);
    return () => { bus.off('transcript:segment', onSegment); };
  }, [addTranscriptCard]);

  const toggleRecord = useCallback(() => {
    if (simRunning) {
      simAbort.current = true;
      setSimRunning(false);
      if (timerIv.current) clearInterval(timerIv.current);
      stopAudioLevel();
      setAudio({ recording: false, paused: false, level: 0 });
      recordingRef.current = false;
      return;
    }
    if (audio.recording) {
      recordingRef.current = false;
      stopAudioLevel();
      setAudio({ recording: false, paused: false, level: 0 });
      stopTranscription();
      // Flush any remaining raw transcript cards through the pipeline
      flushTranscriptPipeline();
    } else {
      timerStart.current = Date.now();
      recordingRef.current = true;
      setAudio({ recording: true, paused: false });

      // Start transcription — it returns the mic stream for audio visualization
      startTranscription()
        .then((stream) => {
          if (stream) {
            startAudioLevel(stream);
          } else {
            // No API key configured — fall back to audio-only (no transcription)
            console.warn('Transcription unavailable (no API key configured). Audio-only mode.');
            startAudioLevel();
          }
        })
        .catch((e) => {
          console.error('Failed to start transcription:', e);
          startAudioLevel();
        });
    }
  }, [simRunning, audio.recording, startAudioLevel, stopAudioLevel, setAudio]);

  const pauseRecord = useCallback(() => {
    if (audio.paused) {
      resumeTranscription();
      startAudioLevel();
      setAudio({ paused: false });
    } else {
      pauseTranscription();
      stopAudioLevel();
      setAudio({ paused: true, level: 0 });
    }
  }, [audio.paused, startAudioLevel, stopAudioLevel, setAudio]);

  useEffect(() => () => {
    stopTranscription();
    stopAudioLevel();
  }, [stopAudioLevel]);

  const knownSpeakers = useMemo(() => {
    const s = new Set(Object.keys(speakerColors));
    cards.forEach(c => { if (c.speaker) s.add(c.speaker); });
    return [...s];
  }, [cards, speakerColors]);

  // ── Session actions ──
  const mkSession = (title: string, mode: 'silent' | 'active' | 'sidekick' = 'sidekick') => {
    const sid = uid();
    const cols = COL_TYPES.map((c, i) => ({
      id: uid(), sessionId: sid, type: c.type, title: c.title,
      // Summary column gets sort order 'a' so it appears on the left when visible
      sortOrder: c.type === 'summary' ? 'a' : String.fromCharCode(98 + i * 2),
      visible: c.type !== 'trash' && c.type !== 'summary', collapsed: false,
    }));
    return {
      session: { id: sid, title, mode, goal: '', status: 'active' as const, createdAt: now(), updatedAt: now() },
      columns: cols,
      cards: [] as Card[],
      audio: { recording: false, paused: false, level: 0, elapsed: 0, autoScroll: true },
      agentBusy: {} as Record<string, boolean>,
      agentTasks: [] as AgentTask[],
      speakerColors: {} as Record<string, string>,
    };
  };

  const startSession = useCallback(async (title: string) => {
    const s = mkSession(title);
    if (window.electronAPI) {
      await window.electronAPI.db.createSession(s.session);
      for (const col of s.columns) {
        await window.electronAPI.db.createColumn(col);
      }
    }
    init(s);
  }, [init]);

  const openSession = useCallback(async (id: string) => {
    if (!window.electronAPI) return;
    const sessionRow = await window.electronAPI.db.getSession(id);
    if (!sessionRow) { alert('Could not load session.'); return; }
    const cols = await window.electronAPI.db.getColumns(id);
    // Backfill context column for existing sessions
    if (!cols.some(c => c.type === 'context')) {
      const contextCol: ColumnType = {
        id: uid(), sessionId: id, type: 'context', title: 'Context',
        sortOrder: 'bb', visible: true, collapsed: false,
      };
      await window.electronAPI.db.createColumn(contextCol);
      cols.push(contextCol);
    }
    // Backfill summary column for existing sessions
    if (!cols.some(c => c.type === 'summary')) {
      const summaryCol: ColumnType = {
        id: uid(), sessionId: id, type: 'summary', title: 'Summary',
        sortOrder: 'a', visible: false, collapsed: false,
      };
      await window.electronAPI.db.createColumn(summaryCol);
      cols.push(summaryCol);
    }
    const cardRows = await window.electronAPI.db.getCards(id);
    const colors = await window.electronAPI.db.getSpeakerColors(id);
    init({
      session: {
        id: sessionRow.id, title: sessionRow.title, mode: sessionRow.mode,
        goal: sessionRow.goal || '', status: sessionRow.status || 'active',
        createdAt: sessionRow.createdAt,
        updatedAt: sessionRow.updatedAt,
      },
      columns: cols,
      cards: cardRows,
      audio: { recording: false, paused: false, level: 0, elapsed: 0, autoScroll: true },
      agentBusy: {},
      agentTasks: [],
      speakerColors: colors || {},
    });
  }, [init]);

  const deleteSessionEntry = useCallback(async (id: string) => {
    if (window.electronAPI) await window.electronAPI.db.deleteSession(id);
    loadSessions();
  }, [loadSessions]);

  const startSim = useCallback(async (config: SimConfig) => {
    const s = mkSession('🎭 ' + config.context.slice(0, 40) + '...', 'silent');
    const colors: Record<string, string> = {};
    config.participants.forEach((p, i) => { colors[p.name] = SPEAKER_COLORS[i % SPEAKER_COLORS.length]; });
    s.speakerColors = colors;

    if (window.electronAPI) {
      await window.electronAPI.db.createSession(s.session);
      for (const col of s.columns) {
        await window.electronAPI.db.createColumn(col);
      }
    }

    init(s);
    setSpeakerColors(colors);
    setSimRunning(true);
    simAbort.current = false;
    timerStart.current = Date.now();
    timerIv.current = setInterval(() => {
      setAudio({ level: 0.3 + Math.random() * 0.7, elapsed: Date.now() - timerStart.current! });
    }, 100);

    // Build rich participant descriptions with persona details
    const partLines = config.participants.map(p => {
      const persona = p.personaId ? personaRegistry.get(p.personaId) : null;
      const personaDesc = persona
        ? persona.systemPromptPrefix
        : p.personaPrompt || '';
      const base = p.name + ' (' + p.role + ')';
      return personaDesc ? base + ' — Personality: ' + personaDesc : base;
    });
    const genSys = 'You are a meeting dialogue generator. Generate realistic meeting dialogue. Each participant has a distinct personality and perspective described below — ensure their dialogue reflects their persona. Each line must be formatted exactly as: SPEAKER_NAME: dialogue text. One speaker per line. No stage directions. Make it natural and stay in character for each participant.';
    const genPrompt = 'Generate ' + config.turns + ' turns of a meeting.\n\nContext: ' + config.context + '\n\nParticipants:\n' + partLines.join('\n') + '\n\nGenerate the full conversation now, one line per turn in format NAME: text';

    const result = await askClaude(genSys, genPrompt);
    if (!result || simAbort.current) {
      setSimRunning(false);
      if (timerIv.current) clearInterval(timerIv.current);
      return;
    }

    const lines = result.split('\n').filter(l => l.includes(':') && l.trim().length > 5);
    const tcol = s.columns.find(c => c.type === 'transcript');
    if (!tcol) { setSimRunning(false); if (timerIv.current) clearInterval(timerIv.current); return; }

    for (let i = 0; i < lines.length; i++) {
      if (simAbort.current) break;
      const ci = lines[i].indexOf(':');
      const speaker = lines[i].slice(0, ci).trim().replace(/^\*+|\*+$/g, '');
      const text = lines[i].slice(ci + 1).trim();
      if (!text) continue;
      const existing = cardsRef.current.filter(c => c.columnId === tcol.id);
      const last = existing[existing.length - 1];
      addCard({
        id: uid(), columnId: tcol.id, sessionId: s.session.id, content: text,
        source: 'transcription', speaker,
        timestamp: Date.now() - timerStart.current!,
        sourceCardIds: [], aiTags: [], userTags: [], highlightedBy: 'none', isDeleted: false,
        createdAt: now(), updatedAt: now(), sortOrder: last ? mid(last.sortOrder) : 'n',
      });
      // Orchestrator auto-triggers via card:created events from addCard
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 1200));
    }
    setSimRunning(false);
    if (timerIv.current) clearInterval(timerIv.current);
    setAudio({ level: 0, elapsed: Date.now() - timerStart.current! });
  }, [init, setSpeakerColors, setAudio, addCard]);

  // ── Navigate to source card ──
  const navigateToCard = useCallback((cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // If it's a chunk card, ensure its chunk column exists
    const parentDocId = getParentDocId(card);
    if (parentDocId) {
      const chunkCol = columns.find(
        (c) => c.config?.docCardId === parentDocId && c.config?.ephemeral,
      );
      if (!chunkCol) {
        // Create the chunk column, then scroll after it renders
        bus.emit('document:viewChunks', { docCardId: parentDocId, highlightChunkId: cardId });
        setTimeout(() => {
          const el = document.getElementById('card-' + cardId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.outline = '2px solid #a855f7';
            el.style.outlineOffset = '2px';
            setTimeout(() => { el.style.outline = 'none'; el.style.outlineOffset = '0'; }, 2000);
          }
        }, 300);
        return;
      }
      // Chunk column exists — make sure it's visible
      if (!chunkCol.visible) setColumnVisible(chunkCol.id, true);
      if (chunkCol.collapsed) toggleColumnCollapsed(chunkCol.id);
    } else {
      // Normal card — ensure its column is visible
      const col = columns.find(c => c.id === card.columnId);
      if (col && !col.visible) toggleColumnVisibility(col.id);
      if (col && col.collapsed) toggleColumnCollapsed(col.id);
    }

    setTimeout(() => {
      const el = document.getElementById('card-' + cardId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid #a855f7';
        el.style.outlineOffset = '2px';
        setTimeout(() => { el.style.outline = 'none'; el.style.outlineOffset = '0'; }, 2000);
      }
    }, 100);
  }, [cards, columns, toggleColumnVisibility, toggleColumnCollapsed, setColumnVisible]);

  // ── Card linking ──
  const startLinking = useCallback((cardId: string) => {
    setLinkingFrom(cardId);
  }, []);

  const completeLinking = useCallback((targetId: string) => {
    if (linkingFrom && linkingFrom !== targetId) {
      linkCards(linkingFrom, targetId);
      // Emit card:updated for DB persistence
      const updated = useSessionStore.getState().cards.find(c => c.id === linkingFrom);
      if (updated) bus.emit('card:updated', { card: updated });
    }
    setLinkingFrom(null);
  }, [linkingFrom, linkCards]);

  const cancelLinking = useCallback(() => {
    setLinkingFrom(null);
  }, []);

  // ── Retry failed agent task (delegates to worker pool) ──
  const retryTask = useCallback((task: AgentTask) => {
    workerPool.retry(task.id);
  }, []);

  const handleStopSim = useCallback(() => {
    simAbort.current = true;
    setSimRunning(false);
    if (timerIv.current) clearInterval(timerIv.current);
  }, []);

  const toggleSummaryColumn = useCallback(() => {
    const summaryCol = columns.find(c => c.type === 'summary');
    if (summaryCol) {
      toggleColumnVisibility(summaryCol.id);
      // If making visible and collapsed, also uncollapse
      if (!summaryCol.visible && summaryCol.collapsed) {
        toggleColumnCollapsed(summaryCol.id);
      }
    }
  }, [columns, toggleColumnVisibility, toggleColumnCollapsed]);

  const summaryColumnVisible = columns.some(c => c.type === 'summary' && c.visible);

  const handleGoToLauncher = useCallback(async () => {
    simAbort.current = true;
    setSimRunning(false);
    if (timerIv.current) clearInterval(timerIv.current);
    stopTranscription();
    stopAudioLevel();
    recordingRef.current = false;
    goToLauncher();
  }, [goToLauncher, stopAudioLevel]);

  // ── Render ──
  if (view === 'launcher' || !session) {
    return (
      <>
        <Launcher
          sessions={sessions}
          onStart={startSession}
          onSimulate={startSim}
          onOpen={openSession}
          onDelete={deleteSessionEntry}
          onRefresh={loadSessions}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
        />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      </>
    );
  }

  const hlCards = cards.filter(c => c.highlightedBy !== 'none' && !c.isDeleted);
  const visCols = columns.filter(c => c.visible).sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''));

  return (
    <div className="w-full h-screen flex flex-col bg-wall-bg text-wall-text overflow-hidden"
         style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <TopBar
        simRunning={simRunning}
        onStopSim={handleStopSim}
        onToggleRecord={toggleRecord}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onToggleGraph={() => setGraphOpen(o => !o)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenCost={() => setCostOpen(true)}
        onOpenAgentConfig={() => setAgentConfigOpen(true)}
        onToggleNotifications={() => setNotifPanelOpen(o => !o)}
        onToggleSummary={toggleSummaryColumn}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        summaryVisible={summaryColumnVisible}
        notificationCount={notifCount}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(d => !d)}
      />

      {/* ── Linking mode banner ── */}
      {linkingFrom && (
        <div className="shrink-0 flex items-center justify-center gap-3 bg-purple-900/30 border-b border-purple-700/40 px-4 py-1.5">
          <span className="text-[11px] font-semibold text-purple-300">
            {'\uD83D\uDD17'} Click another card to create a link
          </span>
          <button
            onClick={cancelLinking}
            className="cursor-pointer rounded-md border border-purple-700 bg-purple-900/40 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300 hover:bg-purple-800/40"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <ColumnSidebar
          columns={columns}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          setColumnVisible={setColumnVisible}
          updateColumnOrder={updateColumnOrder}
          agentConfigs={agentConfigStore.configs}
          onToggleAgent={handleToggleAgent}
          concurrency={concurrency}
          onConcurrencyChange={handleConcurrencyChange}
        />
        <div className="flex-1 flex overflow-x-auto min-w-0">
          {visCols.map(col => {
            // Summary column — special component
            if (col.type === 'summary') {
              return (
                <SummaryColumn
                  key={col.id}
                  column={col}
                  allColumns={columns}
                  allCards={cards}
                />
              );
            }
            // Ephemeral chunk columns — show chunk cards for the linked document
            if (col.config?.ephemeral && col.config?.docCardId) {
              const docCardId = col.config.docCardId as string;
              const chunkCards = cards.filter(
                (c) => !c.isDeleted && getParentDocId(c) === docCardId,
              );
              return (
                <Column
                  key={col.id}
                  column={col}
                  cards={chunkCards}
                  onNavigate={navigateToCard}
                  linkingFrom={linkingFrom}
                  onStartLink={startLinking}
                  onCompleteLink={completeLinking}
                />
              );
            }
            if (col.type === 'inquiry') {
              // Inquiry column is now the Chat panel (right sidebar) — skip rendering here
              return null;
            }
            if (col.type === 'context') {
              // Filter out chunk cards — only show document cards and manual text cards
              return (
                <ContextColumn
                  key={col.id}
                  column={col}
                  cards={cards.filter(c => c.columnId === col.id && !c.isDeleted && !isChunkCard(c))}
                  onNavigate={navigateToCard}
                />
              );
            }
            if (col.type === 'agent_queue') {
              return (
                <AgentQueueColumn
                  key={col.id}
                  column={col}
                  onRetryTask={retryTask}
                />
              );
            }
            const colCards = col.type === 'highlights'
              ? hlCards
              : cards.filter(c => c.columnId === col.id && (col.type === 'trash' || !c.isDeleted));
            return (
              <Column
                key={col.id}
                column={col}
                cards={colCards}
                audio={col.type === 'transcript' ? audio : undefined}
                onToggleRecord={col.type === 'transcript' ? toggleRecord : undefined}
                onPauseRecord={col.type === 'transcript' ? pauseRecord : undefined}
                simRunning={col.type === 'transcript' ? simRunning : false}
                onNavigate={navigateToCard}
                linkingFrom={linkingFrom}
                onStartLink={startLinking}
                onCompleteLink={completeLinking}
              />
            );
          })}
        </div>
        <ChatPanel
          open={chatOpen}
          onToggle={() => setChatOpen(o => {
            const next = !o;
            localStorage.setItem('wall:chat-panel', next ? 'open' : 'closed');
            return next;
          })}
          allCards={cards.filter(c => !c.isDeleted)}
          onNavigate={navigateToCard}
          sessionId={session?.id}
        />
      </div>

      <StatusBar simRunning={simRunning} embeddingProvider={embeddingProvider} apiKeyStatus={apiKeyStatus} />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenAgentConfig={() => setAgentConfigOpen(true)} />
      {exportOpen && <ExportMenu onClose={() => setExportOpen(false)} />}
      <KnowledgeGraph
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        mode={graphMode}
        onModeChange={setGraphMode}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigateToCard} />
      <NotificationToast
        onNavigate={navigateToCard}
        panelOpen={notifPanelOpen}
        onTogglePanel={() => setNotifPanelOpen(o => !o)}
        onHistoryCount={setNotifCount}
      />
      <CostDashboard open={costOpen} onClose={() => setCostOpen(false)} />
      <AgentConfig open={agentConfigOpen} onClose={() => setAgentConfigOpen(false)} />
      <FindRelatedView
        open={findRelatedOpen}
        initialCard={findRelatedInitialCard}
        onClose={() => { setFindRelatedOpen(false); setFindRelatedInitialCard(null); }}
        onNavigate={navigateToCard}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:0.5;}50%{transform:scale(1.3);opacity:0;}}`}</style>
    </div>
  );
}
