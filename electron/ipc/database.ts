import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function initDatabase(userDataPath: string): Database.Database {
  const dbPath = path.join(userDataPath, 'the-wall.db');
  console.log('Database path:', dbPath);

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

export function getDatabase(): Database.Database | null {
  return db;
}

function runMigrations(db: Database.Database) {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
  );

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      console.log(`Running migration: ${migration.name}`);
      db.transaction(() => {
        db!.exec(migration.up);
        db!.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
      })();
    }
  }
}

interface Migration {
  name: string;
  up: string;
  down: string;
}

const migrations: Migration[] = [
  {
    name: '001_initial_schema',
    up: `
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
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        agent_id TEXT,
        sort_order TEXT NOT NULL,
        config TEXT DEFAULT '{}',
        visible INTEGER DEFAULT 1,
        collapsed INTEGER DEFAULT 0
      );

      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        source TEXT CHECK(source IN ('transcription','user','agent','inquiry')),
        source_agent_id TEXT,
        source_agent_name TEXT,
        source_card_ids TEXT DEFAULT '[]',
        prompt_used TEXT,
        embedding BLOB,
        ai_tags TEXT DEFAULT '[]',
        user_tags TEXT DEFAULT '[]',
        speaker TEXT,
        timestamp_ms INTEGER,
        highlighted_by TEXT CHECK(highlighted_by IN ('none','user','ai','both')) DEFAULT 'none',
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sort_order TEXT NOT NULL
      );

      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        tools TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        input_sources TEXT DEFAULT '[]',
        config TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE knowledge_graph_nodes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        type TEXT,
        metadata TEXT DEFAULT '{}',
        embedding BLOB,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE knowledge_graph_edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
        target_id TEXT NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
        relationship TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        mime_type TEXT,
        source_agent_id TEXT,
        source_card_id TEXT,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE agent_tasks (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        agent_name TEXT,
        agent_key TEXT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
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
        target_column_id TEXT,
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

      CREATE TABLE speaker_colors (
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        speaker TEXT NOT NULL,
        color TEXT NOT NULL,
        PRIMARY KEY (session_id, speaker)
      );

      -- Indexes for common queries
      CREATE INDEX idx_columns_session ON columns(session_id);
      CREATE INDEX idx_cards_session ON cards(session_id);
      CREATE INDEX idx_cards_column ON cards(column_id);
      CREATE INDEX idx_cards_not_deleted ON cards(session_id, is_deleted);
      CREATE INDEX idx_agent_tasks_session ON agent_tasks(session_id);
      CREATE INDEX idx_kg_nodes_session ON knowledge_graph_nodes(session_id);
      CREATE INDEX idx_kg_edges_session ON knowledge_graph_edges(session_id);
    `,
    down: `
      DROP TABLE IF EXISTS api_usage;
      DROP TABLE IF EXISTS agent_tasks;
      DROP TABLE IF EXISTS assets;
      DROP TABLE IF EXISTS knowledge_graph_edges;
      DROP TABLE IF EXISTS knowledge_graph_nodes;
      DROP TABLE IF EXISTS agents;
      DROP TABLE IF EXISTS cards;
      DROP TABLE IF EXISTS columns;
      DROP TABLE IF EXISTS speaker_colors;
      DROP TABLE IF EXISTS sessions;
    `,
  },
  {
    name: '002_api_keys',
    up: `
      CREATE TABLE api_keys (
        slot TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        encrypted_key BLOB,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,
    down: `
      DROP TABLE IF EXISTS api_keys;
    `,
  },
  {
    name: '003_rename_notes_to_observations',
    up: `
      UPDATE columns SET type = 'observations', title = 'Observations'
        WHERE type = 'notes';
    `,
    down: `
      UPDATE columns SET type = 'notes', title = 'Notes'
        WHERE type = 'observations';
    `,
  },
  {
    name: '004_add_card_pinned',
    up: `
      ALTER TABLE cards ADD COLUMN pinned INTEGER DEFAULT 0;
    `,
    down: `
      -- SQLite doesn't support DROP COLUMN easily; ignore
    `,
  },
  {
    name: '005_agent_config',
    up: `
      CREATE TABLE IF NOT EXISTS agent_configs (
        agent_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        system_prompt TEXT,
        user_prompt TEXT,
        priority INTEGER,
        target_column TEXT,
        trigger_on_transcript INTEGER,
        input_columns TEXT,
        tool_ids TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS custom_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        target_column TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        trigger_on_transcript INTEGER DEFAULT 1,
        depends_on TEXT,
        input_columns TEXT,
        tool_ids TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `,
    down: `
      DROP TABLE IF EXISTS custom_agents;
      DROP TABLE IF EXISTS agent_configs;
    `,
  },
  {
    name: '006_default_disabled_agents',
    up: `
      -- Add maxTokens and dedupThreshold columns to agent_configs
      ALTER TABLE agent_configs ADD COLUMN max_tokens INTEGER;
      ALTER TABLE agent_configs ADD COLUMN dedup_threshold REAL;

      -- Disable 15 agents that overlap with primary agents
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('refiner', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('thinker', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('coach', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('rhetoric-generator', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('chain-of-thought', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('cliche-finder', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('constraint-finder', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('requirement-finder', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('tradeoff-enumerator', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('problem-finder', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('skeptic', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('problem-solver', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('visionary', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('collaborator', 0);
      INSERT OR IGNORE INTO agent_configs (agent_id, enabled) VALUES ('pragmatist', 0);
    `,
    down: `
      DELETE FROM agent_configs WHERE agent_id IN (
        'refiner','thinker','coach','rhetoric-generator','chain-of-thought',
        'cliche-finder','constraint-finder','requirement-finder','tradeoff-enumerator',
        'problem-finder','skeptic','problem-solver','visionary','collaborator','pragmatist'
      );
    `,
  },
  {
    name: '007_custom_agent_persona',
    up: `
      ALTER TABLE custom_agents ADD COLUMN persona_id TEXT;
    `,
    down: `
      -- SQLite doesn't support DROP COLUMN easily; ignore
    `,
  },
];
