import { useState } from 'react';
import { SvgIcon } from '@/components/Icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Section data
// ---------------------------------------------------------------------------

type HelpSection = {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeSection, setActiveSection] = useState('getting-started');

  if (!open) return null;

  const sections: HelpSection[] = [
    {
      id: 'getting-started',
      icon: 'getting-started',
      title: 'Getting Started',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            <strong className="text-wall-text">The Wall</strong> is an AI-powered intelligence surface for
            meetings, research, and thinking. It captures, analyses, and organises your ideas in real time
            across a multi-column workspace.
          </p>
          <Section title="1. Configure your API keys">
            <p>Click <Kbd>⚙️ Settings</Kbd> → <strong>API Keys</strong> to add your API keys. At minimum, add a chat
            API key (Anthropic Claude or OpenAI) to enable the AI agents.</p>
          </Section>
          <Section title="2. Start a session">
            <p>From the launcher, choose one of three options:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li><strong>New Session</strong> — blank workspace, or pick a quick start template</li>
              <li><strong>Recent Sessions</strong> — reopen a previous session</li>
              <li><strong>Simulate Meeting</strong> — generate an AI-driven mock meeting</li>
            </ul>
          </Section>
          <Section title="3. Choose a mode">
            <p>Select your operating mode in the top bar:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li><strong>Silent</strong> — agents only run when explicitly triggered via Chat; no automatic dispatch on transcript</li>
              <li><strong>Active</strong> — agents auto-run on transcript with fast dispatch (3s); most proactive mode</li>
              <li><strong>Sidekick</strong> — agents auto-run with a gentler pace (6s debounce); optimised for 1:1 collaboration</li>
            </ul>
            <p className="mt-1 text-wall-text-dim text-[11px]">
              You can switch modes at any time. Switching to Silent immediately stops the auto-dispatch pipeline.
            </p>
          </Section>
          <Section title="4. Add content">
            <p>Type notes, record audio, or paste text into any column. AI agents will automatically
            begin analysing and generating insight cards across the other columns (unless in Silent mode).</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'templates',
      icon: 'templates',
      title: 'Session Templates',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            Templates pre-configure your session for a specific use case — selecting the right agents,
            columns, mode, and AI guidance so you can get started immediately.
          </p>
          <Section title="Built-in templates">
            <ul className="list-disc pl-4 space-y-1">
              <li><strong><SvgIcon name="brainstorm" size={13} className="inline-block align-[-2px] text-yellow-400 mr-1" />Brainstorming</strong> — idea generation, pattern finding, creative exploration</li>
              <li><strong><SvgIcon name="research" size={13} className="inline-block align-[-2px] text-cyan-400 mr-1" />Research</strong> — deep research, claim verification, evidence gathering</li>
              <li><strong><SvgIcon name="decision" size={13} className="inline-block align-[-2px] text-indigo-400 mr-1" />Decision Making</strong> — trade-off analysis, risk assessment, structured evaluation</li>
              <li><strong><SvgIcon name="retro" size={13} className="inline-block align-[-2px] text-green-400 mr-1" />Retrospective</strong> — pattern recognition, gap analysis, actionable improvements</li>
              <li><strong><SvgIcon name="interview" size={13} className="inline-block align-[-2px] text-red-400 mr-1" />Interview</strong> — question generation, claim tracking, insight extraction</li>
              <li><strong><SvgIcon name="strategy" size={13} className="inline-block align-[-2px] text-orange-400 mr-1" />Strategy</strong> — visionary thinking, constraint mapping, strategic planning</li>
            </ul>
          </Section>
          <Section title="Session goal">
            <p>Each template includes a <strong>Session Goal</strong> input where you can describe the specific
            context or objective for this session. This goal is provided to both the AI agents and the
            Chat panel, so the AI tailors its responses to your needs.</p>
          </Section>
          <Section title="Template details">
            <p>When you select a template, a detail panel shows:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li>The default mode (silent / active / sidekick)</li>
              <li>How many agents and columns are enabled</li>
              <li>A goal input with a contextual placeholder</li>
            </ul>
          </Section>
          <Section title="Custom templates">
            <p>Click <strong>+ Create Custom Template</strong> in the launcher to build your own. You can configure:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li>Name, icon, and description</li>
              <li>Which agents are enabled (multi-select from all 35 built-in agents)</li>
              <li>Which columns are visible</li>
              <li>Default operating mode</li>
              <li>System prompt that guides the AI&rsquo;s behaviour</li>
              <li>Goal placeholder text</li>
            </ul>
            <p className="mt-1 text-wall-text-dim text-[11px]">
              Custom templates are saved locally and appear alongside the built-in templates.
              Hover over a custom template to reveal edit and delete controls.
            </p>
          </Section>
        </div>
      ),
    },
    {
      id: 'columns',
      icon: 'columns',
      title: 'Columns',
      content: (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-wall-text">
            The workspace is divided into columns, each focused on a different type of insight.
            Toggle columns on/off in the left sidebar.
          </p>
          <ColRow icon="transcript" name="Transcript" desc="Live transcription with speaker diarisation. Record audio or type manually with speaker tagging. Supports card splitting and renumbering." />
          <ColRow icon="notes" name="Notes" desc="Manual and agent-generated notes and observations." />
          <ColRow icon="concepts" name="Concepts" desc="Key themes, ideas, and patterns extracted from the conversation." />
          <ColRow icon="ideas" name="Ideas" desc="Cross-referenced actionable ideas generated by the Idea Generator agent." />
          <ColRow icon="questions" name="Questions" desc="Probing questions to deepen understanding and surface ambiguity." />
          <ColRow icon="claims" name="Claims" desc="Assertions, facts, and counter-arguments with source links." />
          <ColRow icon="gaps" name="Gaps & Risks" desc="Missing information, unstated assumptions, blind spots, and failure modes." />
          <ColRow icon="alternatives" name="Alternatives" desc="Alternative approaches and options to consider." />
          <ColRow icon="actions" name="Actions" desc="Extracted action items and decisions with owners." />
          <ColRow icon="highlights" name="Highlights" desc="Cards flagged by you or the AI. Filter by User, AI, or Both." />
          <ColRow icon="context" name="Context" desc="Reference documents, PDFs, and background material for the AI to use." />
          <ColRow icon="summary" name="Summary" desc="Auto-generated per-column summaries with configurable prompts and change tracking." />
          <ColRow icon="deep_research" name="Deep Research" desc="Researcher agent output from web searches and retrieval." />
          <ColRow icon="agent_queue" name="Agent Queue" desc="Live view of queued, running, and completed agent tasks with controls." />
          <ColRow icon="trash" name="Trash" desc="Deleted cards. Drag back to restore, or empty the trash." />
          <Section title="Managing columns">
            <ul className="list-disc pl-4 space-y-1">
              <li>Toggle visibility in the <strong>left sidebar</strong></li>
              <li>Reorder by dragging in the sidebar</li>
              <li>Collapse/expand individual columns with the arrow button in their header</li>
              <li>Each column header shows a <strong>filtered/total card count</strong> when filters are active</li>
              <li>Use the <strong>Copy</strong> and <strong>JSON</strong> buttons in the column header to export column contents</li>
            </ul>
          </Section>
          <Section title="Per-column agent filter">
            <p>Click the agent filter icon in a column header to choose which agents&rsquo; cards are shown.
            This lets you focus on specific types of output within a column without hiding the column entirely.</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'cards',
      icon: 'cards',
      title: 'Cards',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            Cards are the core unit of content. Each card has a source (Transcript, User, Agent, or Chat),
            optional speaker attribution, timestamps, a sequential card number, and links back to the cards
            that inspired it. Agent-generated cards display the <strong>agent name</strong> at the top.
          </p>
          <Section title="Card actions">
            <p>Hover over a card to reveal its action bar:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li><strong>Copy</strong> — copy card text to clipboard</li>
              <li><strong>Edit</strong> — inline edit the card content (Markdown supported)</li>
              <li><strong>Prompt</strong> — view the AI prompt that generated this card</li>
              <li><strong>Highlight</strong> — flag the card (cycles: none → user → AI → both)</li>
              <li><strong>Find Related</strong> — semantically search for similar cards</li>
              <li><strong>Link</strong> — create a source link to another card</li>
              <li><strong>Split</strong> — split a long card into multiple cards at natural breakpoints</li>
              <li><strong>Renumber</strong> — renumber cards in the column sequentially</li>
              <li><strong>Delete</strong> — move to Trash</li>
            </ul>
          </Section>
          <Section title="Source links">
            <p>Cards generated by agents show coloured pill buttons linking to the source cards
            that triggered them. Click a pill to scroll to and highlight the source card.</p>
          </Section>
          <Section title="Dragging cards">
            <p>Drag cards between columns to reorganise your workspace. Cards remember their
            position using fractional indexing.</p>
          </Section>
          <Section title="Adding cards manually">
            <p>Click the <strong>+ Add card</strong> input at the bottom of any column and press
            <Kbd>Enter</Kbd> to add a new card.</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'agents',
      icon: 'agents',
      title: 'AI Agents',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            35 built-in AI agents analyse your content and generate insight cards automatically.
            Agents are triggered by new transcript segments, card creation, or on a timer.
            The operating mode controls how and when agents are dispatched.
          </p>
          <Section title="Mode-based dispatch">
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Silent</strong> — agents do not auto-dispatch; only triggered explicitly via Chat commands</li>
              <li><strong>Active</strong> — agents auto-dispatch 3 seconds after new transcript content</li>
              <li><strong>Sidekick</strong> — agents auto-dispatch 6 seconds after new transcript content</li>
            </ul>
            <p className="mt-1 text-wall-text-dim text-[11px]">
              Templates can pre-set the mode, and switching to Silent mid-session flushes the pending transcript buffer.
            </p>
          </Section>
          <Section title="Session agent filtering">
            <p>When you start a session from a template, only the agents specified by that template
            are active. The top bar shows an <strong>agent count badge</strong> (e.g. &ldquo;12 agents&rdquo;) when a
            template constrains the agent set. You can view which agents are active in the
            Agent Configuration → Column Matrix tab using the <strong>Session Enabled</strong> filter.</p>
          </Section>
          <Section title="Managing agents">
            <ul className="list-disc pl-4 space-y-1">
              <li>Enable/disable individual agents in the <strong>left sidebar → Agents tab</strong></li>
              <li>Set concurrency (how many agents run in parallel) with the slider</li>
              <li>Click <Kbd>🤖</Kbd> in the top bar to open the Agent Configuration panel</li>
              <li>Pause/resume the entire agent queue with the <Kbd>⏸ Pause Queue</Kbd> button</li>
            </ul>
          </Section>
          <Section title="Agent-Column Matrix">
            <p>Open Agent Configuration → <strong>Column Matrix</strong> tab to see a grid of all agents
            vs all columns. Click any cell to reassign which column an agent outputs to.</p>
            <p className="mt-1">When a session is active with template constraints, use the
            <strong> All / Session Enabled</strong> filter toggle to show only the agents and columns
            active in the current session.</p>
          </Section>
          <Section title="Agent Queue column">
            <p>The Agent Queue column shows all running and queued tasks. For each task you can:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li>Expand to see the full prompt, input text, and result preview</li>
              <li>Retry failed tasks</li>
              <li>Edit the prompt and retry</li>
            </ul>
          </Section>
          <Section title="Key agents explained">
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Idea Generator</strong> — second-pass agent that cross-references all other agent output to generate actionable ideas</li>
              <li><strong>Knowledge Manager</strong> — populates the knowledge graph with concepts, entities, and their relationships</li>
              <li><strong>Researcher</strong> — performs deep research using web search and retrieval</li>
              <li><strong>Action Tracker</strong> — extracts concrete action items and decisions</li>
              <li><strong>Claim Verifier</strong> — fact-checks claims identified in the transcript</li>
            </ul>
          </Section>
        </div>
      ),
    },
    {
      id: 'transcript',
      icon: 'transcript',
      title: 'Transcript & Audio',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            The Transcript column captures the spoken conversation that the AI agents analyse.
          </p>
          <Section title="Recording audio">
            <ul className="list-disc pl-4 space-y-1">
              <li>Click the <Kbd>⏺ Record</Kbd> button in the Transcript column header to start recording</li>
              <li>The recording timer appears in the top bar while active</li>
              <li>Click <Kbd>⏸ Pause</Kbd> to pause without stopping, <Kbd>⏹ Stop</Kbd> to end</li>
              <li>Audio is transcribed in real time via Web Speech API or OpenAI Whisper</li>
            </ul>
          </Section>
          <Section title="Speaker diarisation">
            <ul className="list-disc pl-4 space-y-1">
              <li>Click the speaker colour dot on a transcript card to assign a speaker name</li>
              <li>Each speaker gets a unique colour for easy visual identification</li>
              <li>Speaker names and colours are persisted with the session</li>
              <li>Manage speakers from the Transcript column header controls</li>
            </ul>
          </Section>
          <Section title="Card splitting & renumbering">
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Split</strong> — break a long transcript card into shorter segments at natural breakpoints</li>
              <li><strong>Renumber</strong> — re-sequence card numbers after splits, edits, or reordering</li>
              <li>Card numbers appear on each card for easy reference in discussions</li>
            </ul>
          </Section>
          <Section title="Type-to-transcribe">
            <p>You can manually type transcript segments without recording. Use the speaker selector
            at the top of the Transcript column to tag who is speaking.</p>
          </Section>
          <Section title="Transcription providers">
            <p>Configure transcription in <Kbd>⚙️ Settings</Kbd> → <strong>API Keys</strong>:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li><strong>Browser</strong> — Web Speech API (free, works offline, lower accuracy)</li>
              <li><strong>OpenAI Whisper</strong> — Cloud transcription (requires API key, higher accuracy)</li>
            </ul>
          </Section>
        </div>
      ),
    },
    {
      id: 'chat',
      icon: 'chat',
      title: 'Chat / Inquiry',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            The Chat panel (right side) lets you ask questions about your session content.
            It uses RAG (Retrieval-Augmented Generation) to find relevant cards and answer
            with full context.
          </p>
          <Section title="Using the Chat panel">
            <ul className="list-disc pl-4 space-y-1">
              <li>Toggle the chat panel with the <Kbd>&gt;</Kbd> button on the right edge</li>
              <li>Type a question and press <Kbd>Enter</Kbd></li>
              <li>The AI searches your session cards for relevant context before responding</li>
              <li>Responses appear as cards with source links to the cards they drew from</li>
            </ul>
          </Section>
          <Section title="Session context">
            <p>When a session is started from a template, the Chat automatically incorporates
            the template&rsquo;s <strong>system prompt</strong> and your <strong>session goal</strong> into
            its responses, ensuring the AI stays focused on your objectives.</p>
          </Section>
          <Section title="Chat history">
            <p>Chat history is persisted per session. Each message has individual controls for
            copying, editing, and deletion. Your conversation picks up where you left off when
            you reopen a session.</p>
          </Section>
          <Section title="Context scope">
            <p>The chat uses all non-deleted cards in the current session as context.
            The most semantically relevant cards are selected to fit within the model&rsquo;s
            context window.</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'knowledge-graph',
      icon: 'knowledge-graph',
      title: 'Knowledge Graph',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            The Knowledge Graph is a force-directed visualisation of concepts, entities, topics,
            and claims extracted by the Knowledge Manager agent.
          </p>
          <Section title="Opening the graph">
            <p>Click <Kbd>🕸️ Graph</Kbd> in the top bar. The graph panel appears as an overlay.</p>
          </Section>
          <Section title="Node types">
            <ul className="list-disc pl-4 space-y-1">
              <li><span style={{color:'#a855f7'}}>●</span> <strong>Concept</strong> — abstract ideas and themes</li>
              <li><span style={{color:'#3b82f6'}}>●</span> <strong>Entity</strong> — people, places, organisations</li>
              <li><span style={{color:'#22c55e'}}>●</span> <strong>Topic</strong> — subject areas and categories</li>
              <li><span style={{color:'#f97316'}}>●</span> <strong>Claim</strong> — assertions and facts</li>
            </ul>
          </Section>
          <Section title="Edge types">
            <p>Relationships between nodes: Related To, Supports, Contradicts, Depends On, Part Of, Derived From.</p>
          </Section>
          <Section title="Graph toolbar">
            <p>The toolbar above the graph provides controls for:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li><strong>Display modes</strong> — switch between force-directed, radial, and hierarchical layouts</li>
              <li><strong>Labels toggle</strong> — show or hide node labels for a cleaner view</li>
              <li><strong>Physics toggle</strong> — freeze the simulation to manually position nodes, or re-enable to let them settle</li>
              <li><strong>Node spacing</strong> — adjust the repulsion force to spread nodes apart or bring them closer</li>
            </ul>
          </Section>
          <Section title="Interaction">
            <ul className="list-disc pl-4 space-y-1">
              <li>Drag nodes to rearrange the layout</li>
              <li>Click a node to see which cards reference it</li>
              <li>Double-click a node to trigger deep research on that concept</li>
            </ul>
          </Section>
        </div>
      ),
    },
    {
      id: 'search',
      icon: 'search',
      title: 'Search',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            The Wall provides both per-column text search and global semantic search.
          </p>
          <Section title="Semantic search (Cmd+K)">
            <p>Press <Kbd>⌘K</Kbd> to open the global search overlay. Type a query and the app
            finds the most semantically similar cards across all columns using embeddings.</p>
            <p className="mt-1 text-wall-text-dim text-[11px]">
              Uses OpenAI embeddings if configured, or local TF-IDF as fallback.
            </p>
          </Section>
          <Section title="Per-column search">
            <p>Click the <Kbd>🔍</Kbd> icon in any column header to filter cards within that column by text.
            The column badge updates to show the filtered count vs total.</p>
          </Section>
          <Section title="Find Related">
            <p>Right-click any card or use its action menu → <strong>Find Related</strong> to semantically
            search for similar cards across the session.</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'export',
      icon: 'export',
      title: 'Export',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            Export your session data in multiple formats.
          </p>
          <Section title="Export menu">
            <p>Click <Kbd>📤 Export</Kbd> in the top bar to open export options:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li><strong>JSON</strong> — full structured session backup (re-importable)</li>
              <li><strong>Markdown</strong> — human-readable document</li>
              <li><strong>CSV</strong> — spreadsheet-compatible tabular data</li>
              <li><strong>HTML</strong> — styled web page</li>
              <li><strong>Obsidian</strong> — wiki-link format for Obsidian vaults</li>
            </ul>
            <p className="mt-1 text-wall-text-dim text-[11px]">
              Agent names appear at the front of exported card text for clear attribution.
            </p>
          </Section>
          <Section title="Quick save">
            <p>Click <Kbd>💾</Kbd> in the top bar to instantly save a JSON snapshot to disk.</p>
          </Section>
          <Section title="Import">
            <p>From the launcher → <strong>Recent Sessions</strong>, click <Kbd>📂 Import from File</Kbd>
            to load a previously exported session or backup.</p>
          </Section>
          <Section title="Backup all sessions">
            <p>From the launcher → <strong>Recent Sessions</strong>, click <Kbd>💾 Export All Backup</Kbd>
            to save all sessions as a single backup file.</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'settings',
      icon: 'settings',
      title: 'Settings',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            Access settings via <Kbd>⚙️</Kbd> in the top-right corner.
          </p>
          <Section title="API Keys tab">
            <p>Configure providers and keys for each capability slot:</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li><strong>Chat</strong> — Anthropic Claude, OpenAI, or Google Gemini</li>
              <li><strong>Embeddings</strong> — OpenAI text-embedding-3-small</li>
              <li><strong>Transcription</strong> — OpenAI Whisper</li>
              <li><strong>Image Generation</strong> — DALL-E or Flux</li>
            </ul>
            <p className="mt-1 text-wall-text-dim text-[11px]">All keys are stored encrypted in your local SQLite database. Available models are fetched dynamically from each provider&rsquo;s API.</p>
          </Section>
          <Section title="Summaries tab">
            <p>Customise the AI prompts used to generate column summaries. Each column type
            can have its own prompt. Click <strong>Reset All</strong> to restore defaults.</p>
          </Section>
          <Section title="Model selector">
            <p>The model selector in the top bar lets you switch between available models
            for the configured chat provider without opening settings.</p>
          </Section>
          <Section title="Cost Dashboard">
            <p>Click <Kbd>💰</Kbd> in the top bar to view your API usage and estimated costs
            broken down by provider and model.</p>
          </Section>
          <Section title="Appearance">
            <p>Switch between <strong>light and dark themes</strong> from the settings panel or status bar.
            The interface uses SVG icons for crisp rendering at all sizes.</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'simulation',
      icon: 'simulation',
      title: 'Meeting Simulation',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            Generate a realistic AI-simulated meeting to explore ideas, test workflows,
            or create example content.
          </p>
          <Section title="Setting up a simulation">
            <ol className="list-decimal pl-4 space-y-1">
              <li>From the launcher, click <strong>🎭 Simulate Meeting</strong></li>
              <li>Enter a meeting context/agenda</li>
              <li>Add participants with names, roles, and optionally assign a built-in persona</li>
              <li>Set the number of turns (5–40)</li>
              <li>Click <strong>Start Simulated Meeting →</strong></li>
            </ol>
          </Section>
          <Section title="Personas">
            <p>Each participant can be assigned a built-in persona (CEO, CTO, CFO, Analyst,
            Advocate, etc.) which shapes how they speak and what they prioritise in the conversation.</p>
          </Section>
          <Section title="During simulation">
            <p>The simulation status appears in the top bar. Click <Kbd>Stop</Kbd> to end it early.
            AI agents analyse the transcript in real time as the conversation progresses.
            Simulations run in Active mode for maximum agent responsiveness.</p>
          </Section>
        </div>
      ),
    },
    {
      id: 'shortcuts',
      icon: 'shortcuts',
      title: 'Keyboard Shortcuts',
      content: (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-wall-text">
            Keyboard shortcuts for common actions.
          </p>
          <table className="w-full text-[12px] border-collapse">
            <tbody>
              {[
                ['⌘K', 'Open semantic search'],
                ['Enter', 'Confirm card edit / add card'],
                ['Escape', 'Cancel edit / cancel link mode'],
                ['⌘Z', 'Undo'],
                ['⌘⇧Z', 'Redo'],
              ].map(([key, desc]) => (
                <tr key={key} className="border-b border-wall-border">
                  <td className="py-1.5 pr-4 w-24">
                    <Kbd>{key}</Kbd>
                  </td>
                  <td className="py-1.5 text-wall-text">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
  ];

  const active = sections.find(s => s.id === activeSection) ?? sections[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="flex overflow-hidden rounded-xl border border-wall-border bg-wall-surface shadow-2xl"
        style={{ width: 780, height: 600 }}
      >
        {/* ── Sidebar nav ── */}
        <div className="flex w-[200px] shrink-0 flex-col border-r border-wall-border bg-wall-bg/50">
          <div className="border-b border-wall-border px-4 py-3.5">
            <div
              className="text-[15px] font-extrabold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              THE WALL
            </div>
            <div className="mt-0.5 text-[10px] text-wall-subtle">Help &amp; Documentation</div>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex w-full cursor-pointer items-center gap-2 border-none px-4 py-2 text-left text-[11px] font-medium transition-colors ${
                  activeSection === s.id
                    ? 'bg-indigo-950/60 text-indigo-300'
                    : 'bg-transparent text-wall-text-dim hover:bg-wall-border hover:text-wall-text'
                }`}
              >
                <SvgIcon name={s.icon} size={13} className="shrink-0" />
                {s.title}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Content ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-wall-border px-5 py-3.5">
            <h2 className="text-[14px] font-bold text-wall-text">
              <span className="flex items-center gap-2"><SvgIcon name={active.icon} size={15} />{active.title}</span>
            </h2>
            <button
              onClick={onClose}
              className="cursor-pointer border-none bg-transparent text-[18px] leading-none text-wall-text-dim hover:text-wall-text"
              aria-label="Close help"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-wall-muted">
            {active.content}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-wall-subtle">{title}</h3>
      <div className="text-[12px] leading-relaxed text-wall-text-muted">{children}</div>
    </div>
  );
}

function ColRow({ icon, name, desc }: { icon: string; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <SvgIcon name={icon} size={14} className="shrink-0 mt-0.5" />
      <div>
        <span className="text-[12px] font-semibold text-wall-text">{name}</span>
        <span className="ml-1.5 text-[11px] text-wall-text-dim">{desc}</span>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block rounded border border-wall-muted bg-wall-border px-1 py-px font-mono text-[10px] text-wall-text-muted">
      {children}
    </kbd>
  );
}
