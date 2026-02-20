# The Wall

**AI-powered intelligence surface for meetings, research & thinking**

The Wall is a desktop application that acts as your real-time AI companion during meetings, research sessions, and collaborative thinking. It listens, transcribes, analyses, and generates structured insight cards across a configurable column-based workspace — so you can think deeper, challenge assumptions, and create meaningful progress.

> Free to use under the [MIT Licence](LICENSE)

---

## Features

### Three Operating Modes

Each mode controls how aggressively the AI agents respond to your content:

| Mode | Description |
|---|---|
| **Silent** | Agents only run when explicitly triggered via Chat. No automatic dispatch on transcript — ideal for focused note-taking where you want full control. |
| **Active** | Agents auto-run on transcript with fast dispatch (3 second debounce). The most proactive mode — best for meetings or live brainstorming. |
| **Sidekick** | Agents auto-run with a gentler pace (6 second debounce). Optimised for 1:1 collaboration and research sessions. |

Switch modes at any time from the top bar. Switching to Silent immediately stops the auto-dispatch pipeline.

### Session Templates

Start sessions pre-configured for specific use cases. Each template defines which agents and columns are active, the operating mode, and a guiding system prompt for the AI:

| Template | Focus |
|---|---|
| **Brainstorming** | Idea generation, pattern finding, and creative exploration |
| **Research** | Deep research, claim verification, and evidence gathering |
| **Decision Making** | Trade-off analysis, risk assessment, and structured evaluation |
| **Retrospective** | Pattern recognition, gap analysis, and actionable improvements |
| **Interview** | Question generation, claim tracking, and insight extraction |
| **Strategy** | Visionary thinking, constraint mapping, and strategic planning |

Each template includes a **Session Goal** input where you can provide specific context (e.g. "We're evaluating whether to migrate from AWS to GCP") that guides both the AI agents and the Chat.

#### Custom Templates

Create your own templates with full control over:
- Which agents are enabled for the session
- Which columns are visible
- Default operating mode (silent / active / sidekick)
- System prompt that guides the AI's behaviour
- Goal placeholder text

Custom templates are saved to your local database and appear alongside the built-in templates in the launcher.

### Multi-Column Workspace

Organise your session across 15+ specialised columns:

- **Transcript** — Live transcription with speaker diarisation, audio recording, card numbering, splitting, and renumbering
- **Notes** — Manual and agent-generated notes
- **Concepts** — Key themes and ideas extracted from the conversation
- **Ideas** — Cross-referenced, actionable ideas generated from all other cards
- **Questions** — Probing questions and clarifying queries
- **Claims** — Assertions and fact-checked claims
- **Gaps & Risks** — Missing information, assumptions, and failure modes
- **Alternatives** — Alternative approaches and options
- **Actions** — Extracted action items and decisions
- **Highlights** — Cards flagged by you or the AI
- **Context** — Reference documents and background material
- **Summary** — Auto-generated per-column summaries with configurable prompts and change tracking
- **Deep Research** — Researcher agent output
- **Knowledge Graph** — Visual force-directed graph of concepts and relationships
- **Agent Queue** — Live view of running and queued AI agent tasks
- **Trash** — Deleted cards with restore capability

Each column header shows a **filtered/total card count** badge when search or agent filters are active. Columns include **Copy** and **JSON** buttons for quick export of their contents.

### Cards

Cards are numbered sequentially within their column for easy reference. Each card displays the **agent name** at the top (for agent-generated cards) along with source links, timestamps, and speaker attribution.

Card actions include copy, inline edit (Markdown), view prompt, highlight, find related, link, split, renumber, and delete.

### AI Agent System

35 built-in agents run autonomously in the background:

| Agent | Purpose |
|---|---|
| Concept Extractor | Extracts key concepts, ideas, and themes |
| Claim Identifier | Identifies assertions and claims |
| Claim Verifier | Fact-checks identified claims |
| Claim Challenger | Generates counter-arguments |
| Gap Finder | Surfaces missing information and blind spots |
| Clarity Seeker | Flags ambiguous language and suggests clarifying questions |
| Problem Finder | Identifies potential problems and failure modes |
| Tension Finder | Detects conflicting statements and priorities |
| Solution Finder | Proposes solutions to identified problems |
| Researcher | Deep research and web retrieval |
| Requirement Finder | Extracts explicit and implicit requirements |
| Constraint Finder | Identifies constraints and limitations |
| Alternative Finder | Generates alternative approaches |
| Trade-off Enumerator | Maps trade-offs between options |
| Pattern Finder | Identifies recurring themes and structures |
| Cliche Finder | Flags jargon and vague language |
| Planner | Creates structured plans and action items |
| Refiner | Improves and sharpens existing cards |
| Summariser | Generates concise summaries |
| Challenger | Devil's advocate against consensus |
| Rhetoric Generator | Persuasive arguments and talking points |
| Collaborator | Synthesis points and areas of agreement |
| Skeptic | Raises doubts and demands evidence |
| Supporter | Identifies strengths and reinforces valuable ideas |
| Knowledge Manager | Curates the knowledge graph |
| Questioner | Probing questions to deepen understanding |
| Chain of Thought Reasoner | Step-by-step complex problem working |
| Problem Solver | Structured problem-solving frameworks |
| Coach | Guidance and Socratic questioning |
| Visionary | Extrapolates future implications |
| Pragmatist | Grounds ideas in practical reality |
| Idea Generator | Cross-references all agent output to generate actionable ideas |
| Action Tracker | Extracts action items and decisions |
| Thinker | Deep reflection on topics |
| Image Generator | Generates images from concepts |

#### Agent-Column Matrix

The Agent Configuration panel includes a **Column Matrix** tab — a grid view showing which column each agent outputs to. Click any cell to reassign an agent's output column. When a session is active with template-based constraints, use the **All / Session Enabled** filter toggle to show only the agents and columns active in the current session.

#### Per-Column Agent Filtering

Each column header includes an **agent filter** button that lets you filter which agents' cards are shown within that column. The column badge shows filtered vs total card counts.

### Knowledge Graph

An auto-populated force-directed graph visualisation of concepts, entities, topics, and claims — with relationships like "Supports", "Contradicts", "Depends On", and more. Click any node to see the cards that reference it, or double-click to trigger deep research.

The graph toolbar provides controls for:
- **Display modes** — switch between force-directed, radial, and hierarchical layouts
- **Labels toggle** — show or hide node labels
- **Physics toggle** — freeze or animate the simulation
- **Node spacing** — adjust the repulsion force between nodes

### Meeting Simulation

Generate a realistic AI-simulated meeting with configurable participants, roles, personas, and context — useful for testing workflows or exploring ideas.

### Chat / Inquiry

A built-in RAG (Retrieval-Augmented Generation) chat panel that searches across all your session cards to answer questions with full context. When a session template provides a system prompt or session goal, the Chat incorporates this context into its responses. Chat history is persisted per session with per-message controls.

### Embeddings & Semantic Search

- **OpenAI** `text-embedding-3-small` for neural embeddings (requires API key)
- **Local TF-IDF** fallback for offline use
- Semantic card search across all sessions (`Cmd+K`)

### Export Formats

Export your session data in multiple formats:

- **JSON** — Full structured session backup
- **Markdown** — Readable document format
- **CSV** — Spreadsheet-compatible
- **HTML** — Styled web page
- **Obsidian** — Wiki-link format for Obsidian vaults
- **Clipboard** — Quick copy

Agent names appear at the front of exported card text for clear attribution.

### Transcription

- **Live audio recording** with real-time transcription via Web Speech API
- **OpenAI Whisper** API integration for high-accuracy transcription
- **Speaker diarisation** — assign different colours to different speakers, with persistent speaker management
- **Type-to-transcribe** — manually type transcript segments with speaker tagging
- **Card splitting** — split long transcript cards at natural breakpoints
- **Renumbering** — renumber transcript cards after edits or splits

### Appearance

- **Light and dark themes** — switch between light and dark mode
- **SVG icons** — crisp iconography throughout the interface
- **Status bar** — persistent footer with session info and save status

### Persistence

- All data stored locally in SQLite via `better-sqlite3`
- Auto-save every session change
- Import/export individual sessions or full backups
- No data ever leaves your machine unless you configure cloud APIs

---

## Tech Stack

- **Electron** — Desktop runtime
- **React 18 + TypeScript** — UI
- **Vite** — Build tool
- **Tailwind CSS** — Styling
- **Zustand + zundo** — State management with undo/redo
- **SQLite (better-sqlite3)** — Local persistence
- **graphology** — In-memory knowledge graph
- **@tanstack/virtual** — Virtualised rendering for large card lists
- **mitt** — Event bus

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/embernet/thewall.git
cd thewall
npm install
npm run electron:dev
```

### Build for Distribution

```bash
npm run electron:build
```

### Configure API Keys

Open the app, start a session, then click **⚙️ Settings** → **API Keys** to configure:

| Slot | Provider Options | Purpose |
|---|---|---|
| Chat | Anthropic Claude, OpenAI, Google Gemini | AI agents and chat |
| Embeddings | OpenAI | Semantic search |
| Transcription | OpenAI Whisper | Audio transcription |
| Image Generation | OpenAI DALL-E, Flux | Image creation |

All API keys are stored encrypted in your local SQLite database. Available models are fetched dynamically from each provider's API.

---

## Help

Click **? Help** in the toolbar within the app for detailed feature documentation, or see the in-app Help page.

---

## Licence

MIT — see [LICENSE](LICENSE)

---

## Author

Created by [Mark Burnett](https://linkedin.com/in/markburnett) &copy; 2026
