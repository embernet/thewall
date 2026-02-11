import { useState } from 'react';
import type { SessionIndexEntry, SimConfig, SimParticipant, SessionExport, BackupExport } from '@/types';
import { SPEAKER_COLORS } from '@/types';
import { exportSessionToFile, readFileAsJSON, downloadJSON } from '@/utils/export';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LauncherProps {
  sessions: SessionIndexEntry[];
  onStart: (title: string) => void;
  onSimulate: (config: SimConfig) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Default simulation data
// ---------------------------------------------------------------------------

const DEFAULT_SIM_CTX =
  'Q3 product roadmap review. The team needs to decide between investing in developer experience or a new real-time collaboration feature.';

const DEFAULT_SIM_PARTS: SimParticipant[] = [
  { name: 'Alex', role: 'VP Engineering \u2014 facilitator' },
  { name: 'Jordan', role: 'Lead Analyst \u2014 data-driven' },
  { name: 'Sam', role: 'Head of Support \u2014 customer advocate' },
  { name: 'Morgan', role: 'CFO \u2014 revenue focused' },
];

const DEFAULT_SIM_TURNS = 20;

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type LauncherTab = 'recent' | 'new' | 'sim';

interface TabDef {
  k: LauncherTab;
  l: string;
  i: string;
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
// Component
// ---------------------------------------------------------------------------

export default function Launcher({
  sessions,
  onStart,
  onSimulate,
  onOpen,
  onDelete,
  onRefresh,
}: LauncherProps) {
  const [tab, setTab] = useState<LauncherTab>(sessions.length > 0 ? 'recent' : 'new');
  const [title, setTitle] = useState('');
  const [simCtx, setSimCtx] = useState(DEFAULT_SIM_CTX);
  const [simParts, setSimParts] = useState<SimParticipant[]>(DEFAULT_SIM_PARTS);
  const [simTurns, setSimTurns] = useState(DEFAULT_SIM_TURNS);

  // Build tab list -- only show "Recent" when there are sessions
  const tabs: TabDef[] = [
    ...(sessions.length > 0
      ? [{ k: 'recent' as LauncherTab, l: 'Recent Sessions', i: '\uD83D\uDCC2' }]
      : []),
    { k: 'new', l: 'New Session', i: '\uD83D\uDCDD' },
    { k: 'sim', l: 'Simulate Meeting', i: '\uD83C\uDFAD' },
  ];

  return (
    <div className="flex h-screen w-full items-center justify-center bg-wall-bg font-sans">
      <div className="w-[580px] max-h-[90vh] overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-wall-muted">
        {/* ── Header ── */}
        <div className="mb-7 text-center">
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
        <div className="mb-4 flex justify-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={
                'cursor-pointer rounded-lg px-4 py-[7px] text-xs font-semibold transition-colors ' +
                (tab === t.k
                  ? 'border-2 border-indigo-500 bg-indigo-950 text-indigo-300'
                  : 'border border-wall-border bg-wall-surface text-wall-text-dim hover:text-wall-text-muted')
              }
            >
              {t.i + ' ' + t.l}
            </button>
          ))}
        </div>

        {/* ── Panel ── */}
        <div className="rounded-xl border border-wall-border bg-wall-surface p-5">
          {/* ─── Recent Sessions Tab ─── */}
          {tab === 'recent' && (
            <div>
              {/* Import / Export toolbar */}
              <div className="mb-2.5 flex gap-1">
                <button
                  onClick={() => importSessionFromFile(onRefresh)}
                  className="flex-1 cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2.5 py-[7px] text-[11px] font-semibold text-indigo-300 hover:bg-wall-muted"
                >
                  {'\uD83D\uDCC2'} Import from File
                </button>
                {sessions.length > 0 && (
                  <button
                    onClick={() => exportAllSessionsToFile(sessions)}
                    className="flex-1 cursor-pointer rounded-md border border-wall-muted bg-wall-border px-2.5 py-[7px] text-[11px] font-semibold text-green-500 hover:bg-wall-muted"
                  >
                    {'\uD83D\uDCBE'} Export All Backup
                  </button>
                )}
              </div>

              {/* Session list */}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onOpen(s.id)}
                  className="mb-1.5 flex cursor-pointer items-center justify-between rounded-lg bg-wall-border px-3 py-2.5 hover:bg-wall-muted"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-wall-text">{s.title}</div>
                    <div className="mt-0.5 text-[11px] text-wall-text-dim">
                      {s.cardCount || 0} cards &bull; {s.mode} &bull;{' '}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {/* Save to disk */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const data = await loadSessionForExport(s.id);
                        if (data) {
                          exportSessionToFile({ ...data, agentTasks: [] });
                        }
                      }}
                      className="cursor-pointer rounded-md bg-wall-muted px-2 py-1 text-[11px] text-green-500 hover:bg-wall-subtle"
                      title="Save to disk"
                    >
                      {'\uD83D\uDCBE'}
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
                      className="cursor-pointer rounded-md bg-wall-muted px-2 py-1 text-[11px] text-wall-text-muted hover:text-red-400"
                    >
                      {'\u2715'}
                    </button>
                  </div>
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="p-4 text-center text-[13px] text-wall-subtle">
                  No saved sessions yet.
                </div>
              )}
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
                onClick={() => onStart(title || 'New Session')}
                className="w-full cursor-pointer rounded-lg border-none py-[11px] text-sm font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                }}
              >
                Start Session {'\u2192'}
              </button>
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
                  onClick={() => setSimParts([...simParts, { name: '', role: '' }])}
                  className="cursor-pointer rounded border border-wall-muted bg-wall-border px-[7px] py-0.5 text-[10px] text-indigo-500 hover:bg-wall-muted"
                >
                  + Add
                </button>
              </div>

              {simParts.map((p, i) => (
                <div key={i} className="mb-1 flex items-center gap-1.5">
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
                      className="cursor-pointer border-none bg-transparent text-xs text-wall-subtle hover:text-red-400"
                    >
                      {'\u2715'}
                    </button>
                  )}
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
                {'\uD83C\uDFAD'} Start Simulated Meeting {'\u2192'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
