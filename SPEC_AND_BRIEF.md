# The Wall — Complete Specification & Implementation Brief

## For: Claude Code Refactoring & Build-Out

This document contains:
1. The complete original specification
2. A working prototype (single-file React component) that implements ~40% of the spec
3. A detailed progress audit showing what's built, what's partial, and what's missing
4. Prioritised next steps for the refactoring and build-out

---

# PART 1: ORIGINAL SPECIFICATION

## Goal

Build **The Wall** — an AI companion desktop application (Electron + React + TypeScript) that acts as a real-time, multi-agent intelligence surface for meetings, research, and collaborative thinking. The Wall listens, transcribes, analyses, and generates structured insight cards across a configurable column-based UI. Its purpose is to **empower users to think deeper, challenge assumptions, and create meaningful progress** — ensuring nobody is "just another brick in the wall."

The Wall operates in three primary modes:

1. **Silent Participant** — passively monitors a meeting, running background agents that surface insights, questions, gaps, and research without interrupting flow
2. **Active Facilitator** — coordinates meeting stages, manages time allocation across agenda items, and transitions through structured processes or methodologies
3. **1:1 Sidekick** — collaborates directly with the user on brainstorming, research, analysis, creation, and problem-solving

---

## Architecture & Tech Stack

### Core Stack

- **Runtime**: Electron (desktop), React 18+ with TypeScript
- **State Management**: Zustand with middleware for persistence and undo/redo
- **Database**: SQLite via `better-sqlite3` for local persistence of all cards, prompts, outputs, embeddings, and session metadata
- **Embedding Store**: SQLite with `sqlite-vss` extension for vector similarity search over card embeddings
- **Knowledge Graph**: Local graph store (e.g. `graphology`) with persistence to SQLite; visualised via `react-force-graph` or `sigma.js`
- **Audio**: Web Audio API + `whisper.cpp` (local) or Whisper API (cloud) for real-time transcription
- **LLM Backend**: Anthropic Claude API (primary), with a pluggable provider interface supporting OpenAI, local Ollama, etc.
- **MCP Integration**: Model Context Protocol client for tool invocation across agents
- **Styling**: Tailwind CSS + Radix UI primitives for accessible, composable components

### Project Structure

```
the-wall/
├── electron/            # Electron main process
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/             # IPC handlers (db, audio, filesystem)
├── src/
│   ├── app/             # App shell, routing, layout
│   ├── components/      # Shared UI components
│   │   ├── Card/
│   │   ├── Column/
│   │   ├── SettingsPanel/
│   │   ├── KnowledgeGraph/
│   │   ├── AgentQueue/
│   │   └── ExportMenu/
│   ├── agents/          # Agent definitions, orchestration
│   │   ├── registry.ts
│   │   ├── orchestrator.ts
│   │   ├── worker-pool.ts
│   │   └── built-in/    # One file per built-in agent
│   ├── columns/         # Column type definitions and renderers
│   ├── tools/           # MCP tool implementations
│   ├── methodologies/   # Methodology definitions and step configs
│   ├── personas/        # Persona prompt templates
│   ├── store/           # Zustand stores
│   ├── db/              # SQLite schema, migrations, queries
│   ├── embeddings/      # Embedding generation and search
│   ├── hooks/           # Custom React hooks
│   ├── types/           # Shared TypeScript types
│   └── utils/           # Shared utilities
├── assets/              # Shared generated assets
├── migrations/          # SQLite migration files
└── tests/
```

---

## Data Model

### Core Entities (SQLite Schema)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mode TEXT CHECK(mode IN ('silent','active','sidekick')) NOT NULL,
  status TEXT CHECK(status IN ('draft','active','paused','ended','archived')) DEFAULT 'draft',
  goal TEXT,
  approach TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE columns (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  sort_order INTEGER NOT NULL,
  config JSON DEFAULT '{}',
  visible INTEGER DEFAULT 1
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  column_id TEXT REFERENCES columns(id),
  session_id TEXT REFERENCES sessions(id),
  content TEXT NOT NULL,
  source TEXT,  -- 'transcription','user','agent','inquiry'
  source_agent_id TEXT REFERENCES agents(id),
  source_card_ids JSON DEFAULT '[]',  -- links back to cards that inspired this one
  prompt_used TEXT,
  embedding BLOB,
  ai_tags JSON DEFAULT '[]',
  user_tags JSON DEFAULT '[]',
  speaker TEXT,
  timestamp_ms INTEGER,
  highlighted_by TEXT CHECK(highlighted_by IN ('none','user','ai','both')) DEFAULT 'none',
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sort_order TEXT NOT NULL  -- fractional indexing string
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'built-in','methodology','persona','custom'
  system_prompt TEXT NOT NULL,
  tools JSON DEFAULT '[]',
  enabled INTEGER DEFAULT 1,
  input_sources JSON DEFAULT '[]',
  config JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_graph_nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT,  -- 'concept','entity','topic','claim'
  metadata JSON DEFAULT '{}',
  embedding BLOB,
  session_id TEXT REFERENCES sessions(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_graph_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES knowledge_graph_nodes(id),
  target_id TEXT REFERENCES knowledge_graph_nodes(id),
  relationship TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  session_id TEXT REFERENCES sessions(id)
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT,
  source_agent_id TEXT,
  source_card_id TEXT,
  metadata JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  session_id TEXT REFERENCES sessions(id),
  status TEXT CHECK(status IN ('queued','running','paused','completed','failed')) DEFAULT 'queued',
  priority INTEGER DEFAULT 50,
  prompt TEXT NOT NULL,
  system_prompt TEXT,
  input_text TEXT,
  result TEXT,
  result_preview TEXT,
  error TEXT,
  cards_created INTEGER DEFAULT 0,
  duration_ms INTEGER,
  target_column_id TEXT REFERENCES columns(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);

CREATE TABLE api_usage (
  id TEXT PRIMARY KEY,
  agent_task_id TEXT REFERENCES agent_tasks(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Spec Refinements (from prototyping)

1. **Session Lifecycle**: Sessions have states: draft -> active -> paused -> ended -> archived
2. **Card Content Format**: Store as Markdown internally, render to React with custom renderer
3. **TriggerCondition Types**: new_transcript_segment, card_created, card_updated, manual, interval, session_mode_changed, agent_completed, keyword_detected
4. **Concurrency Model**: "Worker pool" means concurrent async API calls, not OS threads. Use `concurrencyLimit` terminology
5. **AgentContext Contract**:
   ```typescript
   interface AgentContext {
     session: Session;
     recentTranscript: TranscriptSegment[];
     allTranscript: TranscriptSegment[];
     triggerCard?: Card;
     relatedCards: Card[];
     previousOutput?: Card[];
     knowledgeGraph: GraphSnapshot;
     assets: Asset[];
   }
   ```
6. **Fractional Indexing**: Use fractional-indexing library for sort_order
7. **Error States**: Failed agent cards appear in target column with red error badge + retry button
8. **Embedding Model**: text-embedding-3-small (OpenAI) default, all-MiniLM-L6-v2 via ONNX for offline

---

## Agent System

### Orchestration

- Worker pool with configurable concurrency (default 3, user-adjustable 1-10)
- Priority queue (min-heap by priority + created_at)
- Orchestrator agent monitors transcript and context to decide which agents to trigger
- Agents can chain: one agent's output triggers another
- All prompts and outputs logged -- every card stores its generating prompt

### Built-in Agents (Full List)

| Agent | Purpose | Output Column |
| --- | --- | --- |
| Orchestrator | Meta-agent that decides which agents to activate and when | (controls other agents) |
| Concept Extractor | Extracts key concepts, ideas, themes | concepts |
| Claim Identifier | Extracts claims and assertions | claims |
| Claim Verifier | Fact-checks identified claims | claims |
| Claim Challenger | Counter-arguments to claims | claims |
| Gap Finder | Missing info, unstated assumptions, blind spots | gaps |
| Clarity Seeker | Flags ambiguous language, suggests clarifying questions | questions |
| Problem Finder | Potential problems, risks, failure modes | gaps |
| Tension Finder | Conflicting statements, priorities, objectives | gaps |
| Solution Finder | Proposes solutions to identified problems | ideas |
| Researcher | Deep research via internet search and retrieval | deep_research |
| Requirement Finder | Explicit and implicit requirements | notes |
| Constraint Finder | Constraints, limitations, boundaries | notes |
| Alternative Finder | Alternative approaches and options | alternatives |
| Trade-off Enumerator | Maps trade-offs between options | notes |
| Pattern Finder | Recurring themes, patterns, structures | concepts |
| Cliche Finder | Flags cliches, jargon, vague language | notes |
| Planner | Structured plans and action items | actions |
| Refiner | Improves and sharpens existing cards | (same column as input) |
| Summariser | Concise summaries of transcript segments | notes |
| Challenger | Devil's advocate against consensus | questions |
| Rhetoric Generator | Persuasive arguments and talking points | notes |
| Collaborator | Synthesis points and areas of agreement | concepts |
| Skeptic | Raises doubts, demands evidence | questions |
| Supporter | Identifies strengths, reinforces valuable ideas | highlights |
| Knowledge Manager | Curates knowledge graph, tags, cross-references | (graph) |
| Questioner | Probing questions to deepen understanding | questions |
| Chain of Thought Reasoner | Step-by-step complex problem working | notes |
| Problem Solver | Structured problem-solving frameworks | ideas |
| Coach | Guidance, encouragement, Socratic questioning | notes |
| Visionary | Extrapolates future implications | ideas |
| Pragmatist | Grounds ideas in practical reality | gaps |
| Idea Generator | Cross-references all agent output to generate actionable ideas | ideas |
| Action Tracker | Extracts action items and decisions | actions |
| Thinker | Thinks deeply about a topic to understand it better | notes |
| Methodology | Dynamically applies methodology steps via sub-agents | (varies) |
| Persona | Configurable persona agent | (varies) |

### Agent Extensibility

```typescript
interface AgentDefinition {
  id: string;
  name: string;
  type: 'built-in' | 'methodology' | 'persona' | 'custom';
  description: string;
  systemPrompt: string;
  triggerOn: TriggerCondition[];
  inputSources: string[];
  outputColumn: string;
  tools: string[];
  config: Record<string, any>;
}
```

Users can create custom agents via Settings panel form or JSON import.

---

## Column System

### Standard Column Types

transcript, instructions, notes, concepts, ideas, inquiry, questions, suggested_questions, related_topics, alternatives, deep_research, definitions, agent_queue, trash, highlights, custom

### Column Features (all columns)

- Search/filter bar with full-text and tag-based filtering
- Manual card entry at bottom
- Drag-and-drop reordering within and between columns
- Column reordering via drag handle on header
- Collapse/expand toggle
- Column-level export

### Special Column Behaviours

**Transcript Column**: Record toggle, live transcript segments, speaker diarisation, auto-scroll, type-to-transcribe with speaker tagging

**Instructions Column**: Pre-canned goals with default approach and agent configuration. Changing instructions reconfigures active agents via Orchestrator.

**Inquiry Column**: Response area (top), context scope selector (middle), input area (bottom). RAG pipeline: query -> embeddings -> narrow context -> LLM -> response card.

**Agent Queue Column**: Queued tasks with agent name, prompt preview, status. Per-task controls: pause, resume, prioritise, deprioritise, cancel, retry, edit prompt & retry. Expandable details with error info, input text, prompt, result preview, duration. Settings: worker thread count slider, auto-pause toggle.

**Ideas Column**: Populated by Idea Generator agent (second-pass). Each idea card has sourceCardIds linking back to the analysis cards that inspired it. Click source links to navigate.

**Highlights Column**: Filter tabs: All | User | AI. Color-coded: amber=user, blue=AI, green=both.

**Trash Column**: Deleted cards with restore via drag. Empty Trash with confirmation.

---

## Card Component

```typescript
interface Card {
  id: string;
  columnId: string;
  sessionId: string;
  content: string;           // Markdown with key terms as clickable links
  source: 'transcription' | 'user' | 'agent' | 'inquiry';
  sourceAgentName?: string;
  sourceCardIds?: SourceLink[];  // links back to inspiring cards
  promptUsed?: string;
  speaker?: string;
  timestamp?: number;        // ms from session start
  aiTags: string[];
  userTags: string[];
  highlightedBy: 'none' | 'user' | 'ai' | 'both';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sortOrder: string;         // fractional index
}

interface SourceLink {
  id: string;       // card ID to navigate to
  label: string;    // truncated content preview
  icon: string;     // column icon
  color: string;    // column color
}
```

### Card UI Elements

- Content area with inline key terms
- Speaker badge (color-coded)
- Source card link buttons (click to navigate to source)
- Metadata footer: source badge, agent name, timestamp
- Action bar (on hover): Copy, Edit, Show Prompt, Highlight, Tag, Delete, Select for Inquiry
- Tag display: AI tags (grey pills), user tags (coloured pills)

### Source Card Navigation

Clicking a source link: scrolls to the source card, highlights it with a purple outline for 2 seconds, auto-opens collapsed/hidden columns if needed.

---

## Copy, Export & Clipboard System

### Export Scopes
Single Card, Card Selection, Single Column, Multiple Columns, All Columns, Knowledge Graph

### Export Formats
clipboard-plain, clipboard-rich, clipboard-markdown, markdown (.md), json (structured), csv, html (styled), pdf, notion, obsidian (wiki links), graph-json, graph-graphml, graph-dot

### File-based Persistence
- Save session to disk as JSON (full re-importable format)
- Import single session or bulk backup from JSON
- Export All Sessions as backup file
- Export to Markdown, CSV, clipboard

---

## MCP Tools

| Tool | Description |
| --- | --- |
| internet_search | Web search via SearXNG or Brave Search API |
| retrieve_web_page | Fetches web page as clean markdown |
| create_image | Image generation via DALL-E / Stable Diffusion |
| generate_infographic | Multi-part structured prompt to Nanobanana API |
| knowledge_graph_search | Semantic search over knowledge graph |
| knowledge_graph_add | Adds nodes and edges to graph |
| convert_pdf_to_markdown | PDF content extraction |
| tag_cloud_create | Tag frequency data from cards |
| tag_cloud_search | Search existing tag clouds |
| persona_library | Retrieve persona definitions |
| methodology_library | Retrieve methodology definitions |
| prompt_library | Retrieve reusable prompt templates |
| asset_search | Search shared asset registry |
| asset_retrieve | Get specific asset by ID |

---

## Methodology System

Categories: Problem Solving & Ideation (TRIZ, SCAMPER), Process Improvement (Lean Six Sigma, Theory of Constraints), Strategy & Analysis (SWOT++, Soft Systems Methodology), Visual & Management (Graph Explorer, Kanban, Tag Cloud)

---

## Knowledge Graph

- Auto-populated by Knowledge Manager agent
- Force-directed graph visualisation (toggle, resizable)
- Node types: Concept (purple), Entity (blue), Topic (green), Claim (orange)
- Edge types: Related To, Supports, Contradicts, Depends On, Part Of, Derived From
- Interactive: click node -> show referencing cards, double-click -> deep research
- Export: JSON, GraphML, DOT

---

## Design Principles

### Extensibility
1. Plugin architecture with registry pattern for agents, tools, columns, methodologies
2. Event bus (mitt) for decoupled communication
3. Middleware pipeline for agent execution
4. Theme system via CSS custom properties + Tailwind
5. Config-driven columns from JSON definitions
6. Tool adapters via manifest file

### Stability & Robustness
1. Auto-save every 2 seconds + on every card creation
2. Crash recovery with incomplete session detection
3. Agent error isolation with retry (exponential backoff, max 3)
4. Circuit breaker for repeatedly failing agents
5. Graceful degradation when LLM unavailable
6. Input validation and sanitisation
7. Migration system for schema changes
8. Structured JSON logging with rotation

### Performance
1. Virtualised rendering (react-window / @tanstack/virtual)
2. Embedding computation in Web Worker
3. Debounced search (300ms + useDeferredValue)
4. Lazy column loading
5. Batched database writes (100ms window)
6. Agent task pooling
7. Incremental knowledge graph updates
8. Memoisation with LRU caches
9. Audio streaming (5-second windows)
10. Asset thumbnails


---

# PART 2: CURRENT IMPLEMENTATION STATUS

## What's Built & Working

### Core Application (single React component, ~2000 lines)

- [x] React column/card UI with dark theme
- [x] Session launcher (New / Simulated Meeting / Recent Sessions)
- [x] Top bar: title editing, mode switcher, agent status infographic (insights/active/queued counts)
- [x] Status bar with live metrics
- [x] Settings panel (Columns + Agents tabs)
- [x] useReducer state management
- [x] Auto-sync to persistent storage (debounced + immediate on card creation)
- [x] Session index for launcher
- [x] Save/import JSON files to/from disk
- [x] Export: Markdown, CSV, clipboard, full backup
- [x] Save status indicator (syncing/synced/error)
- [x] 12 column types: Transcript, Notes, Concepts, Ideas, Questions, Claims, Gaps & Risks, Actions, Inquiry, Agent Queue, Highlights, Trash
- [x] Column collapse/expand, show/hide via settings
- [x] Per-column search
- [x] Drag-and-drop cards between columns
- [x] Fractional indexing for sort order
- [x] Card: source badges, speaker tags, timestamps, inline edit, copy, highlight, delete to trash
- [x] Source card links with click-to-navigate (scroll + purple highlight animation, auto-opens columns)
- [x] Full provenance chain: Transcript -> Agent cards -> Ideas
- [x] Type-to-transcribe with speaker tagging and quick-add speaker UI
- [x] Web Speech API integration (where browser permits)
- [x] Audio visualiser and recording state UI
- [x] Simulated meeting generator via Claude API (configurable context, participants, turns)
- [x] 6 agents: Concept Extractor, Questioner, Claim Identifier, Gap Finder, Action Tracker, Idea Generator
- [x] All primary agents run in parallel with 4s debounce trigger from transcript
- [x] Idea Generator runs as second-pass, cross-referencing all primary agent output
- [x] Agent Queue column with running/history, expandable task details
- [x] Agent Queue: error details, input text, prompt, result preview, duration display
- [x] Agent Queue: retry failed tasks, edit prompt & retry
- [x] TF-IDF embeddings with stop-word removal and cosine similarity
- [x] Inquiry column RAG pipeline (find relevant cards -> build context -> Claude -> response)
- [x] Agent status infographic in top bar (insights count, active count, queued count)
- [x] Export menu dialog with JSON/Markdown/CSV/clipboard options
- [x] Per-session save-to-disk from launcher list

### Partially Built

- [ ] Highlights column -- user highlights work, but no AI auto-highlighting agent
- [ ] Instructions column -- goal dropdown exists but doesn't reconfigure agents
- [ ] Settings panel -- Audio, LLM, Export, Theme tabs are placeholders
- [ ] Keyboard shortcuts -- only Enter/Escape for editing

### Not Yet Built

- [ ] 29 additional agents from the spec
- [ ] Orchestrator agent (meta-agent that selects which agents to run based on mode/goal)
- [ ] Agent chaining (one agent's output triggers another)
- [ ] Worker pool with configurable concurrency limits (currently unlimited parallel)
- [ ] Circuit breaker for failing agents
- [ ] Custom agent creation UI
- [ ] Middleware pipeline (logging, rate limiting, cost tracking, caching)
- [ ] Methodology system (TRIZ, SCAMPER, Lean Six Sigma, SWOT++, etc.)
- [ ] Persona system with prompt templates
- [ ] Knowledge Graph (graphology, visualisation, Knowledge Manager agent)
- [ ] MCP client integration and tool servers
- [ ] Shared asset registry
- [ ] SQLite database (currently using key-value JSON storage via window.storage)
- [ ] Proper vector embeddings (currently TF-IDF in-browser, not real neural embeddings)
- [ ] Cost tracking (api_usage table)
- [ ] Column reordering via drag
- [ ] Multi-select cards with bulk actions (Shift+click, Cmd+click)
- [ ] Context menu (right-click)
- [ ] Full keyboard navigation (arrow keys, tab)
- [ ] Undo/redo (Cmd+Z / Cmd+Shift+Z)
- [ ] Column resize via drag handle
- [ ] Responsive layout / scroll snapping
- [ ] Light mode / theme system
- [ ] Accessibility (ARIA labels, screen reader, high contrast, 44px touch targets)
- [ ] Virtualised rendering for large card lists
- [ ] HTML/PDF/Notion/Obsidian export formats
- [ ] Per-column and selective multi-column export
- [ ] Crash recovery / incomplete session detection
- [ ] Structured logging
- [ ] Batched DB writes
- [ ] Web Worker for embeddings
- [ ] Testing (unit, integration, component, E2E)


---

# PART 3: REFACTORING BRIEF FOR CLAUDE CODE

## Priority 1: Project Scaffolding & Architecture

**Objective**: Transform the single-file prototype into a properly structured Electron + React + TypeScript project.

### Tasks

1. **Scaffold the project** using the directory structure from the spec
2. **Set up the build system**: Vite + Electron Forge or electron-builder
3. **Install dependencies**: react, zustand, better-sqlite3, tailwindcss, radix-ui, graphology, react-force-graph, mitt, fractional-indexing, @tanstack/virtual, vitest, playwright
4. **Extract the prototype** into proper files:
   - `src/types/index.ts` -- all TypeScript interfaces (Card, Column, Session, Agent, etc.)
   - `src/store/session.ts` -- Zustand store (migrate from useReducer)
   - `src/store/agents.ts` -- Agent state store
   - `src/components/Card/Card.tsx`
   - `src/components/Column/Column.tsx`
   - `src/components/Column/TranscriptColumn.tsx`
   - `src/components/Column/InquiryColumn.tsx`
   - `src/components/Column/AgentQueueColumn.tsx`
   - `src/components/Column/IdeasColumn.tsx`
   - `src/components/SettingsPanel/SettingsPanel.tsx`
   - `src/components/ExportMenu/ExportMenu.tsx`
   - `src/components/Launcher/Launcher.tsx`
   - `src/app/App.tsx` -- main app shell
   - `src/app/TopBar.tsx`
   - `src/app/StatusBar.tsx`
5. **Set up Tailwind** -- replace all inline styles with Tailwind classes
6. **Add Radix UI** primitives for dialogs, dropdowns, toggles, tooltips

### Key Prototype Behaviors to Preserve

- The existing 6 agents MUST continue to work and trigger automatically
- Source card links with navigation MUST be preserved
- The simulated meeting generator MUST work
- Type-to-transcribe with speaker tagging MUST work
- File export/import MUST work
- All card actions (edit, copy, highlight, delete, drag) MUST work

## Priority 2: SQLite Database

1. **Set up better-sqlite3** in the Electron main process
2. **Create migration system** with numbered up/down files
3. **Implement the full schema** from the spec (all CREATE TABLE statements above)
4. **Build a data access layer** in `src/db/`:
   - `schema.ts` -- table definitions
   - `migrations/` -- numbered migration files
   - `queries.ts` -- CRUD operations for all entities
   - `sync.ts` -- bridge between Zustand store and SQLite
5. **Migrate from JSON blobs** to proper relational storage
6. **Add sqlite-vss** for vector similarity search

## Priority 3: Proper Embeddings

1. **Integrate text-embedding-3-small** (OpenAI API) as primary embedding engine
2. **Add ONNX runtime** with all-MiniLM-L6-v2 for offline fallback
3. **Run embedding generation in a Web Worker**
4. **Store embeddings as BLOBs** in the cards table
5. **Build vector search** using sqlite-vss
6. **Replace the TF-IDF implementation** in the Inquiry column with real embeddings

## Priority 4: Complete Agent Suite

1. **Build BaseAgent class** in `src/agents/base.ts`:
   ```typescript
   abstract class BaseAgent {
     abstract name: string;
     abstract description: string;
     abstract systemPrompt: string;
     abstract triggerCondition(context: AgentContext): boolean;
     abstract execute(context: AgentContext): Promise<CardContent[]>;
   }
   ```
2. **Build agent registry** (`src/agents/registry.ts`) with register/unregister/list
3. **Build worker pool** (`src/agents/worker-pool.ts`) with configurable concurrency
4. **Build Orchestrator agent** that reads session mode + goal to select active agents
5. **Implement remaining agents** as individual files in `src/agents/built-in/`
6. **Add agent chaining** -- output cards from one agent trigger dependent agents
7. **Add circuit breaker** -- auto-disable after N consecutive failures
8. **Wire Instructions column** -- changing goal reconfigures Orchestrator

## Priority 5: Knowledge Graph

1. **Set up graphology** with persistence to SQLite
2. **Build Knowledge Manager agent** that extracts entities/relationships
3. **Add graph visualisation** panel using react-force-graph or d3-force
4. **Node types**: Concept (purple), Entity (blue), Topic (green), Claim (orange)
5. **Edge types**: Related To, Supports, Contradicts, Depends On, Part Of, Derived From
6. **Interactive**: click node -> show referencing cards, double-click -> deep research

## Priority 6: UI Polish

1. **Zustand with undo/redo middleware**
2. **Multi-select**: Shift+click range, Cmd+click individual, bulk actions toolbar
3. **Column drag reordering**
4. **Column resize** via drag handle
5. **Keyboard shortcuts**: Cmd+C, Cmd+Shift+C, Cmd+E, Cmd+Z, arrow navigation
6. **Context menu** on right-click
7. **Virtualised rendering** with @tanstack/virtual
8. **Theme system**: dark/light mode, accent colours, font sizing
9. **Accessibility**: ARIA labels, screen reader, high contrast, 44px touch targets

## Priority 7: Methodology & Persona Systems

1. **Methodology agent** that spawns sub-agents per step
2. **Implement SWOT++** as proof of concept
3. **Implement SCAMPER** as second methodology
4. **Persona agent** with prompt template system
5. **Pre-canned personas**: CEO, CTO, CFO, Product Manager, Investor, Machiavelli, Sun Tzu

## Priority 8: MCP & Tools

1. **MCP client** integration
2. **internet_search** tool (SearXNG or Brave Search API)
3. **retrieve_web_page** tool
4. **knowledge_graph_search** and **knowledge_graph_add** tools
5. **Shared asset registry**
6. **Tool adapter** pattern for wrapping external APIs

## Priority 9: Full Export System

1. **HTML styled export** with embedded CSS
2. **PDF export** via headless rendering
3. **Notion-flavoured markdown**
4. **Obsidian markdown** with [[wiki links]]
5. **Graph exports**: JSON, GraphML, DOT
6. **Export options**: include metadata, prompts, assets, date range filter
7. **Per-column and multi-column selective export**

## Priority 10: Stability & Performance

1. **Crash recovery** -- detect incomplete sessions on startup
2. **Structured JSON logging** with rotation
3. **Batched SQLite writes** (100ms transaction window)
4. **Agent error isolation** with exponential backoff retry
5. **Graceful degradation** banner when LLM unavailable
6. **Performance profiling** and optimisation

## Priority 11: Testing

1. **Unit tests** (Vitest): agent logic, export formatters, embedding search, data model
2. **Integration tests**: full agent task lifecycle, card CRUD, knowledge graph ops
3. **Component tests** (Testing Library): Card, Column, Settings, Export Dialog
4. **E2E tests** (Playwright): full session flow
5. **Performance benchmarks**: 1000+ cards, concurrent agents, large graphs

---

# PART 4: PROTOTYPE CODE NOTES

The working prototype is a single React component (~2000 lines) located in the Claude.ai artifact system. It should be provided to Claude Code alongside this spec file.

## Key Technical Details of the Prototype

### LLM calls
The prototype calls the Anthropic API directly via fetch to `https://api.anthropic.com/v1/messages` with model `claude-sonnet-4-20250514`. This should be wrapped in a proper LLM provider interface:

```typescript
interface LLMProvider {
  id: string;
  name: string;
  complete(params: {
    system: string;
    messages: Message[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<string>;
  embed?(text: string): Promise<number[]>;
}
```

Implement for: Anthropic Claude (primary), OpenAI (secondary), Ollama (local).

### Persistence
The prototype uses `window.storage` (Claude artifact persistent storage API) with keys prefixed `wall-sess-` and `wall-idx`. This should be replaced with SQLite via better-sqlite3 in the Electron main process.

### Embeddings
The prototype implements TF-IDF with cosine similarity in-browser. This should be replaced with proper neural embeddings (text-embedding-3-small or all-MiniLM-L6-v2).

### State Management
The prototype uses `useReducer` with a flat state object. This should be migrated to Zustand stores with proper middleware.

### Styling
The prototype uses inline styles throughout. This should be migrated to Tailwind CSS classes.

### Event Bus Events to Implement

```typescript
type AppEvent =
  | { type: 'transcript:segment'; segment: TranscriptSegment }
  | { type: 'card:created'; card: Card }
  | { type: 'card:updated'; card: Card }
  | { type: 'card:deleted'; cardId: string }
  | { type: 'agent:started'; taskId: string; agentId: string }
  | { type: 'agent:completed'; taskId: string; agentId: string; cardsCreated: number }
  | { type: 'agent:failed'; taskId: string; agentId: string; error: string }
  | { type: 'session:modeChanged'; mode: string }
  | { type: 'session:goalChanged'; goal: string }
  | { type: 'graph:nodeAdded'; node: GraphNode }
  | { type: 'graph:edgeAdded'; edge: GraphEdge };
```

---

## Key Design Principles

1. **Local-first**: All data in SQLite. Cloud APIs are optional enhancements.
2. **Offline capable**: Note-taking, card management, local search, export all work without internet.
3. **Privacy by default**: Audio processed and discarded after transcription unless user opts to save.
4. **Asset-centric**: Every generated artifact is a first-class asset discoverable by any part of the system.
5. **Provenance**: Every agent card links back to its source cards. Full audit trail.
6. **Extensibility**: New agents, tools, columns, and methodologies via registry pattern without modifying core code.
