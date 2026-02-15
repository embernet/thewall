import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSessionStore } from '@/store/session';
import Launcher from '@/components/Launcher/Launcher';
import Column from '@/components/Column/Column';
import InquiryColumn from '@/components/Column/InquiryColumn';
import AgentQueueColumn from '@/components/Column/AgentQueueColumn';
import SettingsPanel from '@/components/SettingsPanel/SettingsPanel';
import ExportMenu from '@/components/ExportMenu/ExportMenu';
import KnowledgeGraph from '@/components/KnowledgeGraph/KnowledgeGraph';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { askClaude, loadChatConfig, validateApiKey, getApiKey } from '@/utils/llm';
import { loadEmbeddingConfig, getEmbeddingProvider } from '@/utils/embedding-service';
import type { ApiKeyStatus, EmbeddingProvider } from '@/types';
import { bus } from '@/events/bus';
import { uid, now, mid } from '@/utils/ids';
import { COL_TYPES, SPEAKER_COLORS } from '@/types';
import { initOrchestrator, destroyOrchestrator } from '@/agents/orchestrator';
import { workerPool } from '@/agents/worker-pool';
import { useKeyboard } from '@/hooks/useKeyboard';
import type { Card, Column as ColumnType, SessionIndexEntry, SimConfig, AgentTask } from '@/types';

export default function App() {
  const store = useSessionStore();
  const {
    view, session, columns, cards, audio, agentBusy, agentTasks, speakerColors,
    init, addCard, setAudio,
    setView, setSpeakerColors, setSaveStatus, goToLauncher,
    toggleColumnVisibility, toggleColumnCollapsed,
  } = store;

  useKeyboard();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [sessions, setSessions] = useState<SessionIndexEntry[]>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('unchecked');
  const [embeddingProvider, setEmbeddingProvider] = useState<EmbeddingProvider>('local');

  const cardsRef = useRef<Card[]>([]);
  const simAbort = useRef(false);
  const timerStart = useRef<number | null>(null);
  const timerIv = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => { cardsRef.current = cards; }, [cards]);

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

  // ── Agent Orchestrator ──
  useEffect(() => {
    if (view === 'session' && session?.id) {
      initOrchestrator();
    }
    return () => { destroyOrchestrator(); };
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
      source: 'transcription', speaker: speaker || 'You',
      timestamp: Date.now() - (timerStart.current || Date.now()),
      sourceCardIds: [], aiTags: [], userTags: [], highlightedBy: 'none', isDeleted: false,
      createdAt: now(), updatedAt: now(), sortOrder: last ? mid(last.sortOrder) : 'n',
    });
  }, [session?.id, columns, addCard]);

  const startAudioLevel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      recognitionRef.current = null;
      stopAudioLevel();
      setAudio({ recording: false, paused: false, level: 0 });
    } else {
      timerStart.current = Date.now();
      recordingRef.current = true;
      setAudio({ recording: true, paused: false });
      startAudioLevel();

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      const recog = new SR();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';
      recog.maxAlternatives = 1;

      recog.onresult = (event: any) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        }
        if (finalText.trim()) addTranscriptCard(finalText);
      };

      recog.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          recognitionRef.current = null;
          if (timerIv.current) clearInterval(timerIv.current);
          timerIv.current = setInterval(() => {
            setAudio({ level: 0.05 + Math.random() * 0.1, elapsed: Date.now() - (timerStart.current || Date.now()) });
          }, 200);
        }
        if (event.error === 'no-speech' || event.error === 'network') {
          try { recog.start(); } catch {}
        }
      };

      recog.onend = () => {
        if (recognitionRef.current && recordingRef.current) {
          try { recog.start(); } catch {}
        }
      };

      try { recog.start(); } catch (e) { console.error('Failed to start recognition:', e); }
      recognitionRef.current = recog;
    }
  }, [simRunning, audio.recording, addTranscriptCard, startAudioLevel, stopAudioLevel, setAudio]);

  const pauseRecord = useCallback(() => {
    if (audio.paused) {
      if (recognitionRef.current) { try { recognitionRef.current.start(); } catch {} }
      startAudioLevel();
      setAudio({ paused: false });
    } else {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      stopAudioLevel();
      setAudio({ paused: true, level: 0 });
    }
  }, [audio.paused, startAudioLevel, stopAudioLevel, setAudio]);

  useEffect(() => () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
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
      sortOrder: String.fromCharCode(98 + i * 2),
      visible: c.type !== 'trash', collapsed: false,
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
    const cardRows = await window.electronAPI.db.getCards(id);
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
      speakerColors: {},
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

    const partDesc = config.participants.map(p => p.name + ' (' + p.role + ')').join(', ');
    const genSys = 'You are a meeting dialogue generator. Generate realistic meeting dialogue. Each line must be formatted exactly as: SPEAKER_NAME: dialogue text. One speaker per line. No stage directions. Make it natural.';
    const genPrompt = 'Generate ' + config.turns + ' turns of a meeting.\n\nContext: ' + config.context + '\n\nParticipants:\n' + partDesc + '\n\nGenerate the full conversation now, one line per turn in format NAME: text';

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
    const col = columns.find(c => c.id === card.columnId);
    if (col && !col.visible) toggleColumnVisibility(col.id);
    if (col && col.collapsed) toggleColumnCollapsed(col.id);
    setTimeout(() => {
      const el = document.getElementById('card-' + cardId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid #a855f7';
        el.style.outlineOffset = '2px';
        setTimeout(() => { el.style.outline = 'none'; el.style.outlineOffset = '0'; }, 2000);
      }
    }, 100);
  }, [cards, columns, toggleColumnVisibility, toggleColumnCollapsed]);

  // ── Retry failed agent task (delegates to worker pool) ──
  const retryTask = useCallback((task: AgentTask) => {
    workerPool.retry(task.id);
  }, []);

  const handleStopSim = useCallback(() => {
    simAbort.current = true;
    setSimRunning(false);
    if (timerIv.current) clearInterval(timerIv.current);
  }, []);

  const handleGoToLauncher = useCallback(async () => {
    simAbort.current = true;
    setSimRunning(false);
    if (timerIv.current) clearInterval(timerIv.current);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    stopAudioLevel();
    recordingRef.current = false;
    goToLauncher();
  }, [goToLauncher, stopAudioLevel]);

  // ── Render ──
  if (view === 'launcher' || !session) {
    return (
      <Launcher
        sessions={sessions}
        onStart={startSession}
        onSimulate={startSim}
        onOpen={openSession}
        onDelete={deleteSessionEntry}
        onRefresh={loadSessions}
      />
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
        apiKeyStatus={apiKeyStatus}
      />

      <div className="flex-1 flex overflow-x-auto">
        {visCols.map(col => {
          if (col.type === 'inquiry') {
            return (
              <InquiryColumn
                key={col.id}
                column={col}
                cards={cards.filter(c => c.columnId === col.id && !c.isDeleted)}
                allCards={cards.filter(c => !c.isDeleted)}
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
            />
          );
        })}
      </div>

      <StatusBar simRunning={simRunning} embeddingProvider={embeddingProvider} />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {exportOpen && <ExportMenu onClose={() => setExportOpen(false)} />}
      <KnowledgeGraph open={graphOpen} onClose={() => setGraphOpen(false)} />

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:0.5;}50%{transform:scale(1.3);opacity:0;}}`}</style>
    </div>
  );
}
