import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSessionStore } from '@/store/session';
import Launcher from '@/components/Launcher/Launcher';
import Column from '@/components/Column/Column';
import InquiryColumn from '@/components/Column/InquiryColumn';
import AgentQueueColumn from '@/components/Column/AgentQueueColumn';
import SettingsPanel from '@/components/SettingsPanel/SettingsPanel';
import ExportMenu from '@/components/ExportMenu/ExportMenu';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { askClaude } from '@/utils/llm';
import { findSimilar } from '@/utils/embeddings';
import { uid, now, mid } from '@/utils/ids';
import { AGENT_DEFINITIONS, COL_TYPES, SPEAKER_COLORS } from '@/types';
import type { Card, Column as ColumnType, SessionIndexEntry, SimConfig, AgentTask } from '@/types';

export default function App() {
  const store = useSessionStore();
  const {
    view, session, columns, cards, audio, agentBusy, agentTasks, speakerColors,
    init, addCard, setAudio, setAgentBusy, addAgentTask, updateAgentTask,
    setView, setSpeakerColors, setSaveStatus, goToLauncher,
    toggleColumnVisibility, toggleColumnCollapsed,
  } = store;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [sessions, setSessions] = useState<SessionIndexEntry[]>([]);

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

  // ── Agent Processing ──
  const runAgents = useCallback(async (text: string, sessionId: string, cols: ColumnType[]) => {
    if (!text?.trim()) return;
    const ideasCol = cols.find(c => c.type === 'ideas');
    const newAgentCards: (Card & { colType: string; colTitle: string; colIcon: string; colColor: string })[] = [];

    // Find transcript source cards for linking
    const tcol = cols.find(c => c.type === 'transcript');
    const tMeta = COL_TYPES.find(ct => ct.type === 'transcript')!;
    const allTranscript = tcol ? cardsRef.current.filter(c => c.columnId === tcol.id && !c.isDeleted) : [];
    const batchLines = text.split('\n').filter(l => l.trim());
    const sourceTranscriptCards = allTranscript.filter(tc => {
      return batchLines.some(line => {
        const clean = line.replace(/^[^:]+:\s*/, '');
        return tc.content === clean || tc.content.includes(clean) || clean.includes(tc.content);
      });
    }).slice(-6);
    const transcriptLinks = sourceTranscriptCards.map(tc => ({
      id: tc.id,
      label: (tc.speaker ? tc.speaker + ': ' : '') + tc.content.slice(0, 50),
      icon: tMeta.icon,
      color: (tMeta.color) + '80',
    }));

    const tasks = AGENT_DEFINITIONS.map(async agent => {
      const col = cols.find(c => c.type === agent.col);
      if (!col) return;
      const taskId = uid();
      const promptText = agent.prompt(text);
      const startedAt = Date.now();
      setAgentBusy(agent.col, true);
      addAgentTask({
        id: taskId, agentName: agent.name, agentKey: agent.key, status: 'running',
        createdAt: now(), cardsCreated: 0, inputText: text, prompt: promptText,
        systemPrompt: agent.sys, sessionId,
      });
      try {
        const result = await askClaude(agent.sys, promptText);
        const duration = Date.now() - startedAt;
        if (!result) {
          updateAgentTask(taskId, { status: 'failed', error: 'No response from Claude API.', completedAt: now(), duration });
          return;
        }
        const bullets = result.split('\n').map(l => l.replace(/^[•\-*]\s*/, '').trim()).filter(l => l.length > 5);
        let created = 0;
        for (const b of bullets) {
          const existing = cardsRef.current.filter(c => c.columnId === col.id);
          const last = existing[existing.length - 1];
          const cardId = uid();
          let bulletLinks = [...transcriptLinks];
          if (sourceTranscriptCards.length > 1) {
            const best = findSimilar(b, sourceTranscriptCards, 2);
            if (best.length > 0) {
              bulletLinks = best.map(r => ({
                id: r.card.id,
                label: (r.card.speaker ? r.card.speaker + ': ' : '') + r.card.content.slice(0, 50),
                icon: tMeta.icon,
                color: (tMeta.color) + '80',
              }));
            }
          }
          const card: Card = {
            id: cardId, columnId: col.id, sessionId, content: b, source: 'agent',
            sourceAgentName: agent.name, sourceCardIds: bulletLinks, aiTags: [], userTags: [],
            highlightedBy: 'none', isDeleted: false, createdAt: now(), updatedAt: now(),
            sortOrder: last ? mid(last.sortOrder) : 'n',
          };
          addCard(card);
          const colMeta = COL_TYPES.find(ct => ct.type === agent.col);
          newAgentCards.push({
            ...card, colType: agent.col, colTitle: col.title,
            colIcon: colMeta?.icon || '📌', colColor: colMeta?.color || '#64748b',
          });
          created++;
        }
        updateAgentTask(taskId, { status: 'completed', cardsCreated: created, completedAt: now(), duration, resultPreview: result.slice(0, 500) });
      } catch (e: any) {
        updateAgentTask(taskId, { status: 'failed', error: e?.message || String(e), completedAt: now(), duration: Date.now() - startedAt });
      }
      setAgentBusy(agent.col, false);
    });
    await Promise.allSettled(tasks);

    // ── Ideas Agent (second pass) ──
    if (!ideasCol || newAgentCards.length === 0) return;
    const gapCards = newAgentCards.filter(c => c.colType === 'gaps');
    const questionCards = newAgentCards.filter(c => c.colType === 'questions');
    const claimCards = newAgentCards.filter(c => c.colType === 'claims');
    const actionCards = newAgentCards.filter(c => c.colType === 'actions');
    const conceptCards = newAgentCards.filter(c => c.colType === 'concepts');

    const sections: string[] = [];
    if (gapCards.length) sections.push('GAPS & RISKS (suggest how to address each):\n' + gapCards.map(c => '- ' + c.content).join('\n'));
    if (questionCards.length) sections.push('QUESTIONS (suggest possible answers or approaches):\n' + questionCards.map(c => '- ' + c.content).join('\n'));
    if (claimCards.length) sections.push('CLAIMS (suggest how to verify or build on each):\n' + claimCards.map(c => '- ' + c.content).join('\n'));
    if (actionCards.length) sections.push('ACTION ITEMS (suggest better or additional approaches):\n' + actionCards.map(c => '- ' + c.content).join('\n'));
    if (conceptCards.length) sections.push('KEY CONCEPTS (suggest applications or explorations):\n' + conceptCards.map(c => '- ' + c.content).join('\n'));
    if (sections.length === 0) return;

    const ideasTaskId = uid();
    const ideasSys = 'You are a creative problem-solver and idea generator. Given analysis from a meeting, generate actionable ideas. For each idea, start the line with the NUMBER of the source item it addresses (from the numbered list below), then a pipe |, then the idea. Format: NUMBER|idea text. One idea per line. Be specific and actionable. Generate 2-5 ideas total.';

    const numberedItems: { num: number; card: typeof newAgentCards[0] }[] = [];
    let itemIdx = 1;
    const allSourceCards = [...gapCards, ...questionCards, ...claimCards, ...actionCards, ...conceptCards];
    const numberedList = allSourceCards.map(c => {
      const n = itemIdx++;
      numberedItems.push({ num: n, card: c });
      return n + '. [' + c.colType.toUpperCase() + '] ' + c.content;
    }).join('\n');

    const ideasPrompt = 'Here are findings from a meeting analysis. Generate ideas to address them.\n\n' + numberedList;

    setAgentBusy('ideas', true);
    addAgentTask({
      id: ideasTaskId, agentName: 'Idea Generator', agentKey: 'ideas', status: 'running',
      createdAt: now(), cardsCreated: 0, inputText: numberedList, prompt: ideasPrompt,
      systemPrompt: ideasSys, sessionId,
    });

    try {
      const result = await askClaude(ideasSys, ideasPrompt);
      if (!result) {
        updateAgentTask(ideasTaskId, { status: 'failed', error: 'No response', completedAt: now() });
        setAgentBusy('ideas', false);
        return;
      }
      const lines = result.split('\n').map(l => l.replace(/^[•\-*]\s*/, '').trim()).filter(l => l.length > 5);
      let created = 0;
      for (const line of lines) {
        const pipeIdx = line.indexOf('|');
        let sourceNum: number | null = null;
        let ideaText = line;
        if (pipeIdx > 0 && pipeIdx < 5) {
          const numStr = line.slice(0, pipeIdx).replace(/[^0-9]/g, '');
          sourceNum = parseInt(numStr, 10);
          ideaText = line.slice(pipeIdx + 1).trim();
        }
        if (!ideaText || ideaText.length < 5) continue;

        const sourceLinks: Card['sourceCardIds'] = [];
        if (sourceNum && numberedItems.length > 0) {
          const src = numberedItems.find(ni => ni.num === sourceNum);
          if (src) {
            sourceLinks.push({ id: src.card.id, label: src.card.content.slice(0, 50), icon: src.card.colIcon, color: src.card.colColor + '80' });
          }
        }
        if (sourceLinks.length === 0 && allSourceCards.length > 0) {
          const best = findSimilar(ideaText, allSourceCards, 1);
          if (best.length > 0 && best[0].score > 0.1) {
            const src = best[0].card as typeof newAgentCards[0];
            sourceLinks.push({ id: src.id, label: src.content.slice(0, 50), icon: src.colIcon, color: src.colColor + '80' });
          }
        }

        const existing = cardsRef.current.filter(c => c.columnId === ideasCol.id);
        const last = existing[existing.length - 1];
        addCard({
          id: uid(), columnId: ideasCol.id, sessionId, content: ideaText, source: 'agent',
          sourceAgentName: 'Idea Generator', sourceCardIds: sourceLinks, aiTags: [], userTags: [],
          highlightedBy: 'none', isDeleted: false, createdAt: now(), updatedAt: now(),
          sortOrder: last ? mid(last.sortOrder) : 'n',
        });
        created++;
      }
      updateAgentTask(ideasTaskId, { status: 'completed', cardsCreated: created, completedAt: now(), resultPreview: result.slice(0, 500) });
    } catch (e: any) {
      updateAgentTask(ideasTaskId, { status: 'failed', error: e?.message || String(e), completedAt: now() });
    }
    setAgentBusy('ideas', false);
  }, [addCard, setAgentBusy, addAgentTask, updateAgentTask]);

  // ── Watch transcript for agent triggers ──
  const transcriptBuf = useRef<string[]>([]);
  const agentTmr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAgents = useCallback((text: string) => {
    if (!session?.id || !columns) return;
    transcriptBuf.current.push(text);
    if (agentTmr.current) clearTimeout(agentTmr.current);
    agentTmr.current = setTimeout(() => {
      const batch = transcriptBuf.current.join('\n');
      transcriptBuf.current = [];
      if (batch.trim()) runAgents(batch, session.id, columns);
    }, 4000);
  }, [session?.id, columns, runAgents]);

  const lastTC = useRef(0);
  useEffect(() => {
    if (!columns || simRunning) return;
    const tcol = columns.find(c => c.type === 'transcript');
    if (!tcol) return;
    const tCards = cards.filter(c => c.columnId === tcol.id && !c.isDeleted);
    if (tCards.length > lastTC.current) {
      tCards.slice(lastTC.current).forEach(c => scheduleAgents(c.content));
    }
    lastTC.current = tCards.length;
  }, [cards.length, columns, simRunning, scheduleAgents, cards]);

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

    let batch: string[] = [];
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
      batch.push(speaker + ': ' + text);
      if (batch.length >= 3 || i === lines.length - 1) {
        const bt = batch.join('\n');
        batch = [];
        runAgents(bt, s.session.id, s.columns);
      }
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 1200));
    }
    setSimRunning(false);
    if (timerIv.current) clearInterval(timerIv.current);
    setAudio({ level: 0, elapsed: Date.now() - timerStart.current! });
  }, [init, setSpeakerColors, setAudio, addCard, runAgents]);

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

  // ── Retry failed agent task ──
  const retryTask = useCallback(async (task: AgentTask) => {
    if (!session?.id || !columns) return;
    const agent = AGENT_DEFINITIONS.find(a => a.key === task.agentKey);
    const col = columns.find(c => c.type === (agent?.col || task.agentKey));
    if (!col) return;

    const taskId = uid();
    const promptText = (task as any).editedPrompt ? task.prompt! : (agent ? agent.prompt(task.inputText || '') : task.prompt!);
    const sysPrompt = task.systemPrompt || agent?.sys || 'You are a helpful assistant.';
    const startedAt = Date.now();

    setAgentBusy(col.type, true);
    addAgentTask({
      id: taskId, agentName: task.agentName + ((task as any).editedPrompt ? ' (edited)' : '') + ' ↻',
      agentKey: task.agentKey, status: 'running', createdAt: now(), cardsCreated: 0,
      inputText: task.inputText, prompt: promptText, systemPrompt: sysPrompt, sessionId: session.id,
    });

    try {
      const result = await askClaude(sysPrompt, promptText);
      const duration = Date.now() - startedAt;
      if (!result) {
        updateAgentTask(taskId, { status: 'failed', error: 'No response on retry.', completedAt: now(), duration });
        setAgentBusy(col.type, false);
        return;
      }
      const bullets = result.split('\n').map(l => l.replace(/^[•\-*]\s*/, '').trim()).filter(l => l.length > 5);
      let created = 0;
      for (const b of bullets) {
        const existing = cardsRef.current.filter(c => c.columnId === col.id);
        const last = existing[existing.length - 1];
        addCard({
          id: uid(), columnId: col.id, sessionId: session.id, content: b, source: 'agent',
          sourceAgentName: task.agentName + ' ↻', sourceCardIds: [], aiTags: [], userTags: [],
          highlightedBy: 'none', isDeleted: false, createdAt: now(), updatedAt: now(),
          sortOrder: last ? mid(last.sortOrder) : 'n',
        });
        created++;
      }
      updateAgentTask(taskId, { status: 'completed', cardsCreated: created, completedAt: now(), duration, resultPreview: result.slice(0, 500) });
    } catch (e: any) {
      updateAgentTask(taskId, { status: 'failed', error: e?.message || String(e), completedAt: now(), duration: Date.now() - startedAt });
    }
    setAgentBusy(col.type, false);
  }, [session?.id, columns, setAgentBusy, addAgentTask, updateAgentTask, addCard]);

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

      <StatusBar simRunning={simRunning} />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {exportOpen && <ExportMenu onClose={() => setExportOpen(false)} />}

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:0.5;}50%{transform:scale(1.3);opacity:0;}}`}</style>
    </div>
  );
}
