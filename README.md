# The Wall

**AI-powered intelligence surface for meetings, research & thinking**

The Wall is a desktop application that acts as your real-time AI companion during meetings, research sessions, and collaborative thinking. It listens, transcribes, analyses, and generates structured insight cards across a configurable column-based workspace — so you can think deeper, challenge assumptions, and create meaningful progress.

> Free to use under the [MIT Licence](LICENSE)

---

## Features

### Three Operating Modes

| Mode | Description |
|---|---|
| **Silent** | Passively monitors and surfaces insights without interrupting flow |
| **Active** | Coordinates meeting stages and manages structured processes |
| **Sidekick** | Collaborates directly with you on brainstorming and analysis |

### Multi-Column Workspace

Organise your session across 15+ specialised columns:

- **Transcript** — Live transcription with speaker diarisation and audio recording
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
- **Deep Research** — Researcher agent output
- **Knowledge Graph** — Visual force-directed graph of concepts and relationships
- **Agent Queue** — Live view of running and queued AI agent tasks
- **Trash** — Deleted cards with restore capability

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

### Knowledge Graph

An auto-populated force-directed graph visualisation of concepts, entities, topics, and claims — with relationships like "Supports", "Contradicts", "Depends On", and more. Click any node to see the cards that reference it.

### Meeting Simulation

Generate a realistic AI-simulated meeting with configurable participants, roles, personas, and context — useful for testing workflows or exploring ideas.

### Chat / Inquiry

A built-in RAG (Retrieval-Augmented Generation) chat panel that searches across all your session cards to answer questions with full context.

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

### Transcription

- **Live audio recording** with real-time transcription via Web Speech API
- **OpenAI Whisper** API integration for high-accuracy transcription
- **Speaker diarisation** — assign different colours to different speakers
- **Type-to-transcribe** — manually type transcript segments with speaker tagging

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

All API keys are stored encrypted in your local SQLite database.

---

## Help

Click **? Help** in the toolbar within the app for detailed feature documentation, or see the in-app Help page.

---

## Licence

MIT — see [LICENSE](LICENSE)

---

## Author

Created by [Mark Burnett](https://linkedin.com/in/markburnett) &copy; 2026
