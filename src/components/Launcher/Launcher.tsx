import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { APP_VERSION } from '@/version';
import type { SessionIndexEntry, SimConfig, SimParticipant, SessionExport, BackupExport, SessionTemplate, ColumnType, SessionMode, SessionFolder } from '@/types';
import { SPEAKER_COLORS, COL_TYPES } from '@/types';
import { v4 as uid } from 'uuid';
import { exportSessionToFile, readFileAsJSON, downloadJSON } from '@/utils/export';
import { personaRegistry } from '@/personas/base';
import { builtInPersonas } from '@/personas/built-in';
import { BUILT_IN_TEMPLATES } from '@/templates/built-in';
import { builtInAgents } from '@/agents/built-in';
import TemplateEditor from './TemplateEditor';
import {
  SvgIcon,
  IconClipboard,
  IconStar,
  IconFolder,
  IconEdit,
  IconClose,
  IconTrash,
  IconImport,
  IconBackup,
  IconSave,
  IconMasks,
  IconHelp,
} from '@/components/Icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StartSessionOpts {
  title: string;
  templateId?: string | null;
  goal?: string;
}

/** Sidebar filter: null = all, 'favorites' = favorites, 'unfiled' = no folder, string = folder id */
type SidebarFilter = null | 'favorites' | 'unfiled' | string;

interface LauncherProps {
  sessions: SessionIndexEntry[];
  onStart: (opts: StartSessionOpts) => void;
  onSimulate: (config: SimConfig) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
}

// ---------------------------------------------------------------------------
// Default simulation data
// ---------------------------------------------------------------------------

const DEFAULT_SIM_CTX =
  'Q3 product roadmap review. The team needs to decide between investing in developer experience or a new real-time collaboration feature.';

const DEFAULT_SIM_PARTS: SimParticipant[] = [
  { name: 'Alex', role: 'VP Engineering \u2014 facilitator', personaId: 'cto', personaPrompt: '' },
  { name: 'Jordan', role: 'Lead Analyst \u2014 data-driven', personaId: 'analyst', personaPrompt: '' },
  { name: 'Sam', role: 'Head of Support \u2014 customer advocate', personaId: 'advocate', personaPrompt: '' },
  { name: 'Morgan', role: 'CFO \u2014 revenue focused', personaId: 'cfo', personaPrompt: '' },
];

const DEFAULT_SIM_TURNS = 20;

// ---------------------------------------------------------------------------
// Session templates — sourced from built-in definitions + user custom
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type LauncherTab = 'recent' | 'new' | 'sim';

interface TabDef {
  k: LauncherTab;
  l: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadSessionForExport(id: string) {
  if (window.electronAPI) {
    return window.electronAPI.db.exportSession(id);
  }
  return null;
}

async function exportAllSessionsToFile(sessions: SessionIndexEntry[]) {
  if (!window.electronAPI) return;
  const backup = await window.electronAPI.db.exportAllSessions();
  if (backup) {
    downloadJSON(backup, 'wall_backup_' + new Date().toISOString().slice(0, 10) + '.json');
  }
}

async function importSessionFromFile(onDone: () => void) {
  try {
    const data = await readFileAsJSON<SessionExport | BackupExport>();

    if (window.electronAPI) {
      // Electron path: use IPC to import
      if (
        (data as BackupExport)._format === 'the-wall-backup' &&
        (data as BackupExport).sessions
      ) {
        let count = 0;
        for (const s of (data as BackupExport).sessions) {
          if (s.session?.id) {
            await window.electronAPI.db.importSession(s);
            count++;
          }
        }
        alert('Imported ' + count + ' sessions from backup.');
      } else if (
        (data as SessionExport)._format === 'the-wall-session' &&
        (data as SessionExport).session?.id
      ) {
        await window.electronAPI.db.importSession(data as SessionExport);
        alert('Imported session: ' + (data as SessionExport).session.title);
      } else {
        alert('Unrecognized file format. Expected a Wall session or backup file.');
      }
    } else {
      // No Electron API available -- show a notice
      alert('Import requires the desktop app. Please use the Electron build.');
    }

    onDone();
  } catch (e) {
    if (e instanceof Error && e.message !== 'No file selected') {
      alert('Import failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }
}

// ---------------------------------------------------------------------------
// Persona Picker (inline component)
// ---------------------------------------------------------------------------

function PersonaPicker({
  participant,
  index,
  onChange,
}: {
  participant: SimParticipant;
  index: number;
  onChange: (updated: SimParticipant) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  // Use builtInPersonas directly — the registry may not be populated yet
  // (it's filled during initOrchestrator, which runs after a session opens).
  const personas = builtInPersonas;
  const selectedPersona = participant.personaId
    ? builtInPersonas.find(p => p.id === participant.personaId) ?? null
    : null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="w-full cursor-pointer rounded-md border border-wall-muted bg-wall-border px-[7px] py-[5px] text-left text-[10px] text-wall-text outline-none hover:border-indigo-500/50"
      >
        {selectedPersona ? (
          <span className="flex items-center gap-1"><SvgIcon name={selectedPersona.icon} size={12} />{selectedPersona.name}</span>
        ) : participant.personaPrompt ? (
          <span className="text-wall-text-muted">Custom persona</span>
        ) : (
          <span className="text-wall-subtle">Select persona...</span>
        )}
      </button>

      {showPicker && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-[240px] w-[260px] overflow-y-auto rounded-lg border border-wall-border bg-wall-surface shadow-xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-wall-muted"
        >
          {/* No persona / custom */}
          <button
            onClick={() => {
              onChange({ ...participant, personaId: null });
              setShowPicker(false);
            }}
            className={`w-full cursor-pointer border-b border-wall-border px-3 py-2 text-left text-[10px] hover:bg-wall-border ${
              !participant.personaId ? 'bg-indigo-950/30 text-indigo-300' : 'text-wall-text-muted'
            }`}
          >
            No persona (custom)
          </button>

          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange({ ...participant, personaId: p.id, personaPrompt: '' });
                setShowPicker(false);
              }}
              className={`w-full cursor-pointer px-3 py-1.5 text-left hover:bg-wall-border ${
                participant.personaId === p.id
                  ? 'bg-indigo-950/30 text-indigo-300'
                  : 'text-wall-text'
              }`}
            >
              <div className="text-[10px] font-semibold flex items-center gap-1">
                <SvgIcon name={p.icon} size={12} /> {p.name}
              </div>
              <div className="text-[8px] text-wall-subtle leading-snug">{p.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* Custom persona prompt (shown when no built-in persona selected) */}
      {!participant.personaId && (
        <textarea
          value={participant.personaPrompt}
          onChange={(e) =>
            onChange({ ...participant, personaPrompt: e.target.value })
          }
          placeholder="Describe this participant's personality, expertise, and conversation style..."
          rows={2}
          className="mt-1 w-full rounded-md border border-wall-muted bg-wall-border/40 px-[7px] py-[5px] font-mono text-[9px] text-wall-text outline-none resize-y placeholder:text-wall-subtle focus:border-indigo-500"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Launcher({
  sessions,
  onStart,
  onSimulate,
  onOpen,
  onDelete,
  onRefresh,
  onOpenHelp,
  onOpenAbout,
}: LauncherProps) {
  const [tab, setTab] = useState<LauncherTab>(sessions.length > 0 ? 'recent' : 'new');
  const [title, setTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null);
  const [templateGoal, setTemplateGoal] = useState('');
  const [customTemplates, setCustomTemplates] = useState<SessionTemplate[]>([]);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [simCtx, setSimCtx] = useState(DEFAULT_SIM_CTX);
  const [simParts, setSimParts] = useState<SimParticipant[]>(DEFAULT_SIM_PARTS);
  const [simTurns, setSimTurns] = useState(DEFAULT_SIM_TURNS);

  // ── Folders & Favorites state ──
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('unfiled');
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameSessionTitle, setRenameSessionTitle] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameFolderInputRef = useRef<HTMLInputElement>(null);
  const renameSessionInputRef = useRef<HTMLInputElement>(null);

  // Load folders from DB
  const loadFolders = useCallback(async () => {
    if (window.electronAPI?.db?.getSessionFolders) {
      const f = await window.electronAPI.db.getSessionFolders();
      setFolders(f);
    }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  // Focus new-folder input when shown
  useEffect(() => {
    if (creatingFolder) newFolderInputRef.current?.focus();
  }, [creatingFolder]);
  useEffect(() => {
    if (renamingFolderId) renameFolderInputRef.current?.focus();
  }, [renamingFolderId]);
  useEffect(() => {
    if (renamingSessionId) renameSessionInputRef.current?.focus();
  }, [renamingSessionId]);

  // ── Folder helpers ──
  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || !window.electronAPI?.db) return;
    const folder: SessionFolder = {
      id: uid(),
      name,
      sortOrder: folders.length,
      createdAt: new Date().toISOString(),
    };
    await window.electronAPI.db.createSessionFolder(folder);
    setFolders(prev => [...prev, folder]);
    setNewFolderName('');
    setCreatingFolder(false);
  }, [newFolderName, folders.length]);

  const handleRenameFolder = useCallback(async (id: string) => {
    const name = renameFolderName.trim();
    if (!name || !window.electronAPI?.db) return;
    await window.electronAPI.db.updateSessionFolder(id, { name });
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    setRenamingFolderId(null);
    setRenameFolderName('');
  }, [renameFolderName]);

  const handleDeleteFolder = useCallback(async (id: string) => {
    if (!window.electronAPI?.db) return;
    await window.electronAPI.db.deleteSessionFolder(id);
    setFolders(prev => prev.filter(f => f.id !== id));
    if (sidebarFilter === id) setSidebarFilter('unfiled');
    onRefresh();
  }, [sidebarFilter, onRefresh]);

  const handleToggleFavorite = useCallback(async (sessionId: string, current: boolean) => {
    if (!window.electronAPI?.db) return;
    await window.electronAPI.db.toggleSessionFavorite(sessionId, !current);
    onRefresh();
  }, [onRefresh]);

  const handleSetSessionFolder = useCallback(async (sessionId: string, folderId: string | null) => {
    if (!window.electronAPI?.db) return;
    await window.electronAPI.db.setSessionFolder(sessionId, folderId);
    onRefresh();
  }, [onRefresh]);

  const handleRenameSession = useCallback(async (sessionId: string) => {
    const title = renameSessionTitle.trim();
    if (!title || !window.electronAPI?.db) {
      setRenamingSessionId(null);
      setRenameSessionTitle('');
      return;
    }
    await window.electronAPI.db.updateSession(sessionId, { title });
    setRenamingSessionId(null);
    setRenameSessionTitle('');
    onRefresh();
  }, [renameSessionTitle, onRefresh]);

  // ── Drag & drop ──
  const handleDragStart = useCallback((e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.setData('text/plain', sessionId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverTarget(null);
    const sessionId = e.dataTransfer.getData('text/plain');
    if (!sessionId) return;
    await handleSetSessionFolder(sessionId, folderId);
  }, [handleSetSessionFolder]);

  // ── Filtered sessions ──
  const filteredSessions = useMemo(() => {
    if (sidebarFilter === null) return sessions;
    if (sidebarFilter === 'favorites') return sessions.filter(s => s.isFavorited);
    if (sidebarFilter === 'unfiled') return sessions.filter(s => !s.folderId);
    return sessions.filter(s => s.folderId === sidebarFilter);
  }, [sessions, sidebarFilter]);

  const favoritesCount = useMemo(() => sessions.filter(s => s.isFavorited).length, [sessions]);
  const unfiledCount = useMemo(() => sessions.filter(s => !s.folderId).length, [sessions]);

  const folderSessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of folders) counts[f.id] = 0;
    for (const s of sessions) {
      if (s.folderId && counts[s.folderId] !== undefined) counts[s.folderId]++;
    }
    return counts;
  }, [sessions, folders]);

  // Load custom templates from DB
  useEffect(() => {
    if (window.electronAPI?.db?.getSessionTemplates) {
      window.electronAPI.db.getSessionTemplates().then(templates => {
        setCustomTemplates(templates.filter(t => !t.isBuiltIn));
      }).catch(console.error);
    }
  }, []);

  // Build tab list -- only show "Recent" when there are sessions
  const tabs: TabDef[] = [
    ...(sessions.length > 0
      ? [{ k: 'recent' as LauncherTab, l: 'Recent Sessions', icon: <IconFolder width={13} height={13} /> }]
      : []),
    { k: 'new', l: 'New Session', icon: <SvgIcon name="document" size={13} /> },
    { k: 'sim', l: 'Simulate Meeting', icon: <IconMasks width={13} height={13} /> },
  ];

  return (
    <div className="flex h-screen w-full items-center justify-center bg-wall-bg font-sans">
      {/* Drag region for window movement */}
      <div className="drag-region fixed inset-x-0 top-0 h-10" />
      <div className="w-[580px] max-h-[90vh] flex flex-col">
        {/* ── Header ── */}
        <div className="mb-7 text-center shrink-0">
          <div
            className="mb-1.5 text-4xl font-extrabold tracking-tighter"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            THE WALL
          </div>
          <div className="text-[13px] text-wall-text-dim">
            AI-powered intelligence surface for meetings, research &amp; thinking
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="mb-4 flex justify-center gap-1 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={
                'inline-flex items-center gap-1.5 cursor-pointer rounded-lg px-4 py-[7px] text-xs font-semibold transition-colors ' +
                (tab === t.k
                  ? 'border-2 border-indigo-500 bg-indigo-950 text-indigo-300'
                  : 'border border-wall-border bg-wall-surface text-wall-text-dim hover:text-wall-text-muted')
              }
            >
              {t.icon} {t.l}
            </button>
          ))}
        </div>

        {/* ── Panel ── */}
        <div className={
          'rounded-xl border border-wall-border bg-wall-surface p-5 relative min-h-0 ' +
          (tab === 'recent' ? 'flex flex-col overflow-hidden' : 'overflow-auto')
        } style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
          {/* ─── Recent Sessions Tab ─── */}
          {tab === 'recent' && (
            <div className="flex gap-3 min-h-0 flex-1">
              {/* ── Left sidebar: Folders ── */}
              <div className="w-[154px] shrink-0 flex flex-col gap-0.5 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                {/* All Sessions */}
                <button
                  onClick={() => setSidebarFilter(null)}
                  onDragOver={(e) => handleDragOver(e, '__all__')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, null)}
                  className={
                    'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors ' +
                    (sidebarFilter === null
                      ? 'bg-indigo-950/60 text-indigo-300'
                      : 'text-wall-text-muted hover:bg-wall-border hover:text-wall-text') +
                    (dragOverTarget === '__all__' ? ' ring-1 ring-indigo-500' : '')
                  }
                >
                  <IconClipboard width={14} height={14} className="shrink-0" />
                  <span className="truncate flex-1">All Sessions</span>
                  <span className="text-[9px] text-wall-subtle">{sessions.length}</span>
                </button>

                {/* Favorites */}
                <button
                  onClick={() => setSidebarFilter('favorites')}
                  className={
                    'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors ' +
                    (sidebarFilter === 'favorites'
                      ? 'bg-indigo-950/60 text-indigo-300'
                      : 'text-wall-text-muted hover:bg-wall-border hover:text-wall-text')
                  }
                >
                  <IconStar width={14} height={14} className="shrink-0 text-amber-400" />
                  <span className="truncate flex-1">Favorites</span>
                  {favoritesCount > 0 && (
                    <span className="text-[9px] text-wall-subtle">{favoritesCount}</span>
                  )}
                </button>

                {/* Unfiled */}
                <button
                  onClick={() => setSidebarFilter('unfiled')}
                  onDragOver={(e) => handleDragOver(e, '__unfiled__')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, null)}
                  className={
                    'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors ' +
                    (sidebarFilter === 'unfiled'
                      ? 'bg-indigo-950/60 text-indigo-300'
                      : 'text-wall-text-muted hover:bg-wall-border hover:text-wall-text') +
                    (dragOverTarget === '__unfiled__' ? ' ring-1 ring-indigo-500' : '')
                  }
                >
                  <IconFolder width={14} height={14} className="shrink-0" />
                  <span className="truncate flex-1">Unfiled</span>
                  <span className="text-[9px] text-wall-subtle">{unfiledCount}</span>
                </button>

                {/* Divider */}
                {folders.length > 0 && (
                  <div className="my-1 border-t border-wall-muted/50" />
                )}

                {/* User folders */}
                {folders.map((f) => (
                  <div
                    key={f.id}
                    onDragOver={(e) => handleDragOver(e, f.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, f.id)}
                    className={
                      'group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ' +
                      (sidebarFilter === f.id
                        ? 'bg-indigo-950/60 text-indigo-300'
                        : 'text-wall-text-muted hover:bg-wall-border hover:text-wall-text') +
                      (dragOverTarget === f.id ? ' ring-1 ring-indigo-500 bg-indigo-950/30' : '')
                    }
                  >
                    {renamingFolderId === f.id ? (
                      <input
                        ref={renameFolderInputRef}
                        value={renameFolderName}
                        onChange={(e) => setRenameFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameFolder(f.id);
                          if (e.key === 'Escape') { setRenamingFolderId(null); setRenameFolderName(''); }
                        }}
                        onBlur={() => { setRenamingFolderId(null); setRenameFolderName(''); }}
                        className="w-full rounded border border-indigo-500 bg-wall-border px-1 py-0.5 text-[10px] text-wall-text outline-none"
                      />
                    ) : (
                      <>
                        <IconFolder width={12} height={12} className="shrink-0" />
                        <button
                          onClick={() => setSidebarFilter(f.id)}
                          className="cursor-pointer truncate flex-1 text-left bg-transparent border-none p-0 text-inherit"
                        >
                          {f.name}
                        </button>
                        <span className="text-[9px] text-wall-subtle">{folderSessionCounts[f.id] || 0}</span>
                        <div className="hidden group-hover:flex gap-0.5 ml-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFolderId(f.id);
                              setRenameFolderName(f.name);
                            }}
                            className="cursor-pointer border-none bg-transparent p-0 text-wall-subtle hover:text-indigo-400"
                            title="Rename"
                          ><IconEdit width={10} height={10} /></button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete folder "${f.name}"? Sessions will be unfiled.`)) handleDeleteFolder(f.id);
                            }}
                            className="cursor-pointer border-none bg-transparent p-0 text-wall-subtle hover:text-red-400"
                            title="Delete"
                          ><IconTrash width={10} height={10} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* New folder input */}
                {creatingFolder ? (
                  <div className="flex items-center gap-1 px-1">
                    <input
                      ref={newFolderInputRef}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
                      }}
                      onBlur={() => { if (!newFolderName.trim()) { setCreatingFolder(false); setNewFolderName(''); } }}
                      placeholder="Folder name..."
                      className="flex-1 rounded border border-indigo-500 bg-wall-border px-1.5 py-1 text-[10px] text-wall-text outline-none placeholder:text-wall-subtle"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setCreatingFolder(true)}
                    className="mt-0.5 flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-wall-muted/50 bg-transparent px-2 py-1.5 text-[10px] text-wall-subtle hover:border-indigo-500/50 hover:text-indigo-400"
                  >
                    + New Folder
                  </button>
                )}
              </div>

              {/* ── Right: Session list ── */}
              <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1">
                {/* Import / Export toolbar */}
                <div className="mb-1 flex gap-1">
                  <button
                    onClick={() => importSessionFromFile(onRefresh)}
                    className="flex-1 inline-flex items-center justify-center gap-1 cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] text-[10px] font-semibold text-indigo-300 hover:bg-wall-muted"
                  >
                    <IconImport width={12} height={12} /> Import
                  </button>
                  {sessions.length > 0 && (
                    <button
                      onClick={() => exportAllSessionsToFile(sessions)}
                      className="flex-1 inline-flex items-center justify-center gap-1 cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2 py-[5px] text-[10px] font-semibold text-green-500 hover:bg-wall-muted"
                    >
                      <IconBackup width={12} height={12} /> Export All
                    </button>
                  )}
                </div>

                {/* Session cards */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                  {filteredSessions.map((s) => (
                    <div
                      key={s.id}
                      draggable={renamingSessionId !== s.id}
                      onDragStart={(e) => handleDragStart(e, s.id)}
                      onClick={() => { if (renamingSessionId !== s.id) onOpen(s.id); }}
                      className="mb-1.5 flex cursor-pointer items-center justify-between rounded-lg bg-wall-border px-3 py-2.5 hover:bg-wall-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {/* Favorite star */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(s.id, s.isFavorited);
                            }}
                            className={
                              'cursor-pointer border-none bg-transparent p-0 transition-colors ' +
                              (s.isFavorited ? 'text-amber-400' : 'text-wall-muted hover:text-amber-400/60')
                            }
                            title={s.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <IconStar width={14} height={14} fill={s.isFavorited ? 'currentColor' : 'none'} />
                          </button>
                          {renamingSessionId === s.id ? (
                            <input
                              ref={renameSessionInputRef}
                              value={renameSessionTitle}
                              onChange={(e) => setRenameSessionTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSession(s.id);
                                if (e.key === 'Escape') { setRenamingSessionId(null); setRenameSessionTitle(''); }
                              }}
                              onBlur={() => handleRenameSession(s.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="min-w-0 flex-1 rounded border border-indigo-500 bg-wall-border px-1.5 py-0.5 text-[13px] font-semibold text-wall-text outline-none"
                            />
                          ) : (
                            <span className="truncate text-[13px] font-semibold text-wall-text">{s.title}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-wall-text-dim pl-[22px]">
                          {s.cardCount || 0} cards &bull; {s.mode} &bull;{' '}
                          {new Date(s.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        {/* Rename */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingSessionId(s.id);
                            setRenameSessionTitle(s.title);
                          }}
                          className="cursor-pointer rounded-md bg-wall-muted px-2 py-1 text-wall-text-muted hover:text-indigo-400 hover:bg-wall-subtle"
                          title="Rename"
                        >
                          <IconEdit width={12} height={12} />
                        </button>
                        {/* Save to disk */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const data = await loadSessionForExport(s.id);
                            if (data) {
                              exportSessionToFile({ ...data, agentTasks: [] });
                            }
                          }}
                          className="cursor-pointer rounded-md bg-wall-muted px-2 py-1 text-green-500 hover:bg-wall-subtle"
                          title="Save to disk"
                        >
                          <IconSave width={12} height={12} />
                        </button>
                        {/* Open */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(s.id);
                          }}
                          className="cursor-pointer rounded-md bg-indigo-600 px-3 py-1 text-[11px] text-white hover:bg-indigo-500"
                        >
                          Open
                        </button>
                        {/* Delete */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete session?')) onDelete(s.id);
                          }}
                          className="cursor-pointer rounded-md bg-wall-muted px-2 py-1 text-wall-text-muted hover:text-red-400"
                        >
                          <IconTrash width={12} height={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredSessions.length === 0 && (
                    <div className="p-4 text-center text-[13px] text-wall-subtle">
                      {sidebarFilter === 'favorites'
                        ? 'No favorite sessions yet. Click the star on a session to add it.'
                        : sidebarFilter === 'unfiled'
                          ? 'No unfiled sessions. All sessions have been organized into folders.'
                          : sidebarFilter === null
                            ? 'No saved sessions yet.'
                            : 'No sessions in this folder. Drag sessions here to organize them.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── New Session Tab ─── */}
          {tab === 'new' && (
            <div>
              <label className="mb-1 block text-xs text-wall-text-muted">Session Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product Strategy Meeting"
                className="mb-3.5 box-border w-full rounded-lg border border-wall-muted bg-wall-border px-3 py-[9px] text-[13px] text-wall-text outline-none placeholder:text-wall-text-dim focus:border-indigo-500"
              />
              <p className="mb-4 text-xs leading-relaxed text-wall-text-dim">
                Start an empty session. Type notes or record audio. AI agents analyse content in
                real-time across columns.
              </p>
              <button
                onClick={() => onStart({ title: title || 'New Session' })}
                className="w-full cursor-pointer rounded-lg border-none py-[11px] text-sm font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                }}
              >
                Start Session {'\u2192'}
              </button>

              {/* ── Quick Start Templates ── */}
              <div className="mt-6 border-t border-wall-muted pt-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-wall-subtle">
                  Quick Start Templates
                </div>

                {/* Template selection or goal input */}
                {selectedTemplate ? (
                  <div className="rounded-lg border border-indigo-500/50 bg-wall-border/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SvgIcon name={selectedTemplate.icon} size={16} />
                        <span className="text-[12px] font-semibold text-wall-text">{selectedTemplate.name}</span>
                      </div>
                      <button
                        onClick={() => { setSelectedTemplate(null); setTemplateGoal(''); }}
                        className="inline-flex items-center gap-1 cursor-pointer rounded-md bg-wall-muted px-2 py-0.5 text-[10px] text-wall-text-muted hover:text-wall-text"
                      >
                        <IconClose width={10} height={10} /> Change
                      </button>
                    </div>
                    <p className="mb-2 text-[10px] text-wall-subtle">{selectedTemplate.description}</p>
                    <label className="mb-1 block text-[10px] text-wall-text-muted">
                      Session Goal / Context
                    </label>
                    <textarea
                      value={templateGoal}
                      onChange={(e) => setTemplateGoal(e.target.value)}
                      placeholder={selectedTemplate.goalPlaceholder}
                      rows={2}
                      className="mb-2.5 box-border w-full resize-y rounded-lg border border-wall-muted bg-wall-border px-3 py-[7px] font-sans text-[11px] text-wall-text outline-none placeholder:text-wall-text-dim focus:border-indigo-500"
                    />
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[9px] text-wall-subtle">Mode:</span>
                      <span className="rounded bg-wall-muted px-1.5 py-0.5 text-[9px] font-medium text-wall-text">
                        {selectedTemplate.defaultMode}
                      </span>
                      <span className="text-[9px] text-wall-subtle ml-2">
                        {selectedTemplate.enabledAgentIds.length} agents
                      </span>
                      <span className="text-[9px] text-wall-subtle">
                        &middot; {selectedTemplate.visibleColumnTypes.length} columns
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onStart({
                          title: selectedTemplate.name,
                          templateId: selectedTemplate.id,
                          goal: templateGoal,
                        });
                      }}
                      className="w-full cursor-pointer rounded-lg border-none py-[9px] text-[12px] font-bold text-white"
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      }}
                    >
                      Start {selectedTemplate.name} {'\u2192'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {BUILT_IN_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => { setSelectedTemplate(tpl as SessionTemplate); setTemplateGoal(''); }}
                          className="cursor-pointer rounded-lg border border-wall-muted bg-wall-border/50 px-3 py-2.5 text-left hover:border-indigo-500/50 hover:bg-wall-border"
                        >
                          <div className="mb-0.5"><SvgIcon name={tpl.icon} size={14} /></div>
                          <div className="text-[11px] font-semibold text-wall-text">{tpl.name}</div>
                          <div className="text-[9px] text-wall-subtle leading-snug mt-0.5">{tpl.description}</div>
                        </button>
                      ))}
                      {customTemplates.map((tpl) => (
                        <div key={tpl.id} className="relative group">
                          <button
                            onClick={() => { setSelectedTemplate(tpl); setTemplateGoal(''); }}
                            className="w-full cursor-pointer rounded-lg border border-wall-muted bg-wall-border/50 px-3 py-2.5 text-left hover:border-indigo-500/50 hover:bg-wall-border"
                          >
                            <div className="mb-0.5"><SvgIcon name={tpl.icon} size={14} /></div>
                            <div className="text-[11px] font-semibold text-wall-text">{tpl.name}</div>
                            <div className="text-[9px] text-wall-subtle leading-snug mt-0.5">{tpl.description}</div>
                          </button>
                          <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTemplate(tpl); setShowCreateTemplate(true); }}
                              className="cursor-pointer rounded bg-wall-muted/80 px-1 py-0.5 text-wall-text-muted hover:text-indigo-400"
                              title="Edit"
                            ><IconEdit width={10} height={10} /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Create template button */}
                    {!showCreateTemplate && (
                      <button
                        onClick={() => { setShowCreateTemplate(true); setEditingTemplate(null); }}
                        className="mt-2 w-full cursor-pointer rounded-lg border border-dashed border-wall-muted bg-transparent py-2 text-[10px] text-wall-subtle hover:border-indigo-500/50 hover:text-indigo-400"
                      >
                        + Create Custom Template
                      </button>
                    )}

                    {/* Template editor (create or edit) */}
                    {showCreateTemplate && (
                  <div className="mt-2">
                    <TemplateEditor
                      initial={editingTemplate}
                      onSave={async (tpl) => {
                        if (window.electronAPI?.db?.saveSessionTemplate) {
                          await window.electronAPI.db.saveSessionTemplate(tpl);
                        }
                        setCustomTemplates(prev => {
                          const idx = prev.findIndex(t => t.id === tpl.id);
                          if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = tpl;
                            return next;
                          }
                          return [...prev, tpl];
                        });
                        setShowCreateTemplate(false);
                        setEditingTemplate(null);
                      }}
                      onCancel={() => { setShowCreateTemplate(false); setEditingTemplate(null); }}
                      onDelete={editingTemplate ? async (id) => {
                        if (window.electronAPI?.db?.deleteSessionTemplate) {
                          await window.electronAPI.db.deleteSessionTemplate(id);
                        }
                        setCustomTemplates(prev => prev.filter(t => t.id !== id));
                        setShowCreateTemplate(false);
                        setEditingTemplate(null);
                      } : undefined}
                    />
                  </div>
                )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─── Simulate Meeting Tab ─── */}
          {tab === 'sim' && (
            <div>
              <label className="mb-1 block text-xs text-wall-text-muted">Meeting Context</label>
              <textarea
                value={simCtx}
                onChange={(e) => setSimCtx(e.target.value)}
                rows={3}
                className="mb-2.5 box-border w-full resize-y rounded-lg border border-wall-muted bg-wall-border px-3 py-[9px] font-sans text-xs text-wall-text outline-none focus:border-indigo-500"
              />

              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs text-wall-text-muted">Participants</label>
                <button
                  onClick={() => setSimParts([...simParts, { name: '', role: '', personaId: null, personaPrompt: '' }])}
                  className="cursor-pointer rounded border border-wall-muted bg-wall-border px-[7px] py-0.5 text-[10px] text-indigo-500 hover:bg-wall-muted"
                >
                  + Add
                </button>
              </div>

              {simParts.map((p, i) => (
                <div key={i} className="mb-2 rounded-lg border border-wall-muted/50 bg-wall-border/30 px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }}
                    />
                    <input
                      value={p.name}
                      onChange={(e) => {
                        const n = [...simParts];
                        n[i] = { ...n[i], name: e.target.value };
                        setSimParts(n);
                      }}
                      placeholder="Name"
                      className="w-[90px] rounded-md border border-wall-muted bg-wall-border px-[7px] py-[5px] text-[11px] text-wall-text outline-none focus:border-indigo-500"
                    />
                    <input
                      value={p.role}
                      onChange={(e) => {
                        const n = [...simParts];
                        n[i] = { ...n[i], role: e.target.value };
                        setSimParts(n);
                      }}
                      placeholder="Role"
                      className="flex-1 rounded-md border border-wall-muted bg-wall-border px-[7px] py-[5px] text-[11px] text-wall-text outline-none focus:border-indigo-500"
                    />
                    {simParts.length > 2 && (
                      <button
                        onClick={() => setSimParts(simParts.filter((_, j) => j !== i))}
                        className="cursor-pointer border-none bg-transparent text-wall-subtle hover:text-red-400"
                      >
                        <IconClose width={12} height={12} />
                      </button>
                    )}
                  </div>
                  {/* Persona picker */}
                  <div className="mt-1 ml-[18px]">
                    <label className="block text-[8px] font-semibold text-wall-subtle mb-0.5 uppercase tracking-wider">Persona</label>
                    <PersonaPicker
                      participant={p}
                      index={i}
                      onChange={(updated) => {
                        const n = [...simParts];
                        n[i] = updated;
                        setSimParts(n);
                      }}
                    />
                  </div>
                </div>
              ))}

              <label className="mb-1 mt-2.5 block text-xs text-wall-text-muted">
                Turns: {simTurns}
              </label>
              <input
                type="range"
                min={5}
                max={40}
                value={simTurns}
                onChange={(e) => setSimTurns(+e.target.value)}
                className="mb-3 w-full accent-indigo-500"
              />

              <button
                onClick={() =>
                  onSimulate({
                    context: simCtx,
                    participants: simParts.filter((p) => p.name),
                    turns: simTurns,
                  })
                }
                disabled={!simCtx.trim() || simParts.filter((p) => p.name).length < 2}
                className="w-full cursor-pointer rounded-lg border-none py-[11px] text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-wall-muted"
                style={{
                  ...( simCtx.trim()
                    ? { background: 'linear-gradient(135deg, #ec4899, #6366f1)' }
                    : {}),
                }}
              >
                <IconMasks width={14} height={14} className="inline-block" /> Start Simulated Meeting {'\u2192'}
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="mt-4 flex shrink-0 items-center justify-center gap-4 text-[10px] text-wall-subtle">
          <button
            onClick={onOpenHelp}
            className="inline-flex items-center gap-0.5 cursor-pointer border-none bg-transparent text-wall-subtle hover:text-wall-text-muted"
          >
            <IconHelp width={11} height={11} /> Help
          </button>
          <span>·</span>
          <button
            onClick={onOpenAbout}
            className="cursor-pointer border-none bg-transparent text-wall-subtle hover:text-wall-text-muted"
          >
            About
          </button>
          <span>·</span>
          <span>v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}
