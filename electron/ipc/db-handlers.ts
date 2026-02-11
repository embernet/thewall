import { ipcMain } from 'electron';
import { getDatabase } from './database';

export function registerDbHandlers() {
  const db = () => {
    const d = getDatabase();
    if (!d) throw new Error('Database not initialized');
    return d;
  };

  // ── Sessions ──

  ipcMain.handle('db:getSessions', () => {
    const rows = db()
      .prepare(
        `SELECT s.*,
          (SELECT COUNT(*) FROM cards c WHERE c.session_id = s.id AND c.is_deleted = 0) as card_count
         FROM sessions s
         ORDER BY s.updated_at DESC
         LIMIT 50`
      )
      .all();
    return rows;
  });

  ipcMain.handle('db:getSession', (_e, id: string) => {
    return db().prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  });

  ipcMain.handle('db:createSession', (_e, session: any) => {
    db()
      .prepare(
        `INSERT INTO sessions (id, title, mode, status, goal, approach, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.title,
        session.mode,
        session.status || 'active',
        session.goal || '',
        session.approach || '',
        session.createdAt || new Date().toISOString(),
        session.updatedAt || new Date().toISOString()
      );
    return session;
  });

  ipcMain.handle('db:updateSession', (_e, id: string, updates: any) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.mode !== undefined) { fields.push('mode = ?'); values.push(updates.mode); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.goal !== undefined) { fields.push('goal = ?'); values.push(updates.goal); }
    if (updates.approach !== undefined) { fields.push('approach = ?'); values.push(updates.approach); }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db().prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  });

  ipcMain.handle('db:deleteSession', (_e, id: string) => {
    db().prepare('DELETE FROM sessions WHERE id = ?').run(id);
  });

  // ── Columns ──

  ipcMain.handle('db:getColumns', (_e, sessionId: string) => {
    const rows = db()
      .prepare('SELECT * FROM columns WHERE session_id = ? ORDER BY sort_order')
      .all(sessionId);
    return rows.map(mapColumnFromDb);
  });

  ipcMain.handle('db:createColumn', (_e, column: any) => {
    db()
      .prepare(
        `INSERT INTO columns (id, session_id, type, title, agent_id, sort_order, config, visible, collapsed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        column.id,
        column.sessionId,
        column.type,
        column.title,
        column.agentId || null,
        column.sortOrder,
        JSON.stringify(column.config || {}),
        column.visible !== false ? 1 : 0,
        column.collapsed ? 1 : 0
      );
    return column;
  });

  ipcMain.handle('db:updateColumn', (_e, id: string, updates: any) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.visible !== undefined) { fields.push('visible = ?'); values.push(updates.visible ? 1 : 0); }
    if (updates.collapsed !== undefined) { fields.push('collapsed = ?'); values.push(updates.collapsed ? 1 : 0); }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }
    if (updates.config !== undefined) { fields.push('config = ?'); values.push(JSON.stringify(updates.config)); }

    if (fields.length === 0) return;
    values.push(id);
    db().prepare(`UPDATE columns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  });

  // ── Cards ──

  ipcMain.handle('db:getCards', (_e, sessionId: string) => {
    const rows = db()
      .prepare('SELECT * FROM cards WHERE session_id = ? ORDER BY sort_order')
      .all(sessionId);
    return rows.map(mapCardFromDb);
  });

  ipcMain.handle('db:createCard', (_e, card: any) => {
    db()
      .prepare(
        `INSERT INTO cards (id, column_id, session_id, content, source, source_agent_id, source_agent_name,
         source_card_ids, prompt_used, ai_tags, user_tags, speaker, timestamp_ms, highlighted_by,
         is_deleted, created_at, updated_at, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        card.id,
        card.columnId,
        card.sessionId,
        card.content,
        card.source,
        card.sourceAgentId || null,
        card.sourceAgentName || null,
        JSON.stringify(card.sourceCardIds || []),
        card.promptUsed || null,
        JSON.stringify(card.aiTags || []),
        JSON.stringify(card.userTags || []),
        card.speaker || null,
        card.timestamp ?? null,
        card.highlightedBy || 'none',
        card.isDeleted ? 1 : 0,
        card.createdAt || new Date().toISOString(),
        card.updatedAt || new Date().toISOString(),
        card.sortOrder
      );
    return card;
  });

  ipcMain.handle('db:updateCard', (_e, id: string, updates: any) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.highlightedBy !== undefined) { fields.push('highlighted_by = ?'); values.push(updates.highlightedBy); }
    if (updates.isDeleted !== undefined) { fields.push('is_deleted = ?'); values.push(updates.isDeleted ? 1 : 0); }
    if (updates.columnId !== undefined) { fields.push('column_id = ?'); values.push(updates.columnId); }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }
    if (updates.aiTags !== undefined) { fields.push('ai_tags = ?'); values.push(JSON.stringify(updates.aiTags)); }
    if (updates.userTags !== undefined) { fields.push('user_tags = ?'); values.push(JSON.stringify(updates.userTags)); }
    if (updates.sourceCardIds !== undefined) { fields.push('source_card_ids = ?'); values.push(JSON.stringify(updates.sourceCardIds)); }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    if (fields.length > 1) {
      db().prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  });

  ipcMain.handle('db:deleteCard', (_e, id: string) => {
    db().prepare('UPDATE cards SET is_deleted = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  });

  ipcMain.handle('db:moveCard', (_e, id: string, columnId: string, sortOrder: string) => {
    db()
      .prepare('UPDATE cards SET column_id = ?, sort_order = ?, is_deleted = 0, updated_at = ? WHERE id = ?')
      .run(columnId, sortOrder, new Date().toISOString(), id);
  });

  // ── Agents ──

  ipcMain.handle('db:getAgents', () => {
    return db().prepare('SELECT * FROM agents ORDER BY name').all().map(mapAgentFromDb);
  });

  ipcMain.handle('db:createAgent', (_e, agent: any) => {
    db()
      .prepare(
        `INSERT INTO agents (id, name, type, system_prompt, tools, enabled, input_sources, config, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        agent.id,
        agent.name,
        agent.type,
        agent.systemPrompt,
        JSON.stringify(agent.tools || []),
        agent.enabled !== false ? 1 : 0,
        JSON.stringify(agent.inputSources || []),
        JSON.stringify(agent.config || {}),
        agent.createdAt || new Date().toISOString()
      );
    return agent;
  });

  ipcMain.handle('db:updateAgent', (_e, id: string, updates: any) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.systemPrompt !== undefined) { fields.push('system_prompt = ?'); values.push(updates.systemPrompt); }
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
    if (updates.config !== undefined) { fields.push('config = ?'); values.push(JSON.stringify(updates.config)); }

    if (fields.length === 0) return;
    values.push(id);
    db().prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  });

  // ── Agent Tasks ──

  ipcMain.handle('db:getAgentTasks', (_e, sessionId: string) => {
    const rows = db()
      .prepare('SELECT * FROM agent_tasks WHERE session_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(sessionId);
    return rows.map(mapAgentTaskFromDb);
  });

  ipcMain.handle('db:createAgentTask', (_e, task: any) => {
    db()
      .prepare(
        `INSERT INTO agent_tasks (id, agent_id, agent_name, agent_key, session_id, status, priority,
         prompt, system_prompt, input_text, result, result_preview, error, cards_created,
         duration_ms, target_column_id, created_at, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        task.id,
        task.agentId || null,
        task.agentName || null,
        task.agentKey || null,
        task.sessionId,
        task.status || 'queued',
        task.priority || 50,
        task.prompt,
        task.systemPrompt || null,
        task.inputText || null,
        task.result || null,
        task.resultPreview || null,
        task.error || null,
        task.cardsCreated || 0,
        task.durationMs || null,
        task.targetColumnId || null,
        task.createdAt || new Date().toISOString(),
        task.startedAt || null,
        task.completedAt || null
      );
    return task;
  });

  ipcMain.handle('db:updateAgentTask', (_e, id: string, updates: any) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.result !== undefined) { fields.push('result = ?'); values.push(updates.result); }
    if (updates.resultPreview !== undefined) { fields.push('result_preview = ?'); values.push(updates.resultPreview); }
    if (updates.error !== undefined) { fields.push('error = ?'); values.push(updates.error); }
    if (updates.cardsCreated !== undefined) { fields.push('cards_created = ?'); values.push(updates.cardsCreated); }
    if (updates.durationMs !== undefined) { fields.push('duration_ms = ?'); values.push(updates.durationMs); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
    if (updates.startedAt !== undefined) { fields.push('started_at = ?'); values.push(updates.startedAt); }

    if (fields.length === 0) return;
    values.push(id);
    db().prepare(`UPDATE agent_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  });

  // ── API Usage ──

  ipcMain.handle('db:logApiUsage', (_e, usage: any) => {
    db()
      .prepare(
        `INSERT INTO api_usage (id, agent_task_id, provider, model, input_tokens, output_tokens, cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        usage.id,
        usage.agentTaskId || null,
        usage.provider,
        usage.model,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.costUsd || 0,
        usage.createdAt || new Date().toISOString()
      );
  });

  // ── Embeddings ──

  ipcMain.handle('db:storeEmbedding', (_e, cardId: string, blob: ArrayBuffer) => {
    db().prepare('UPDATE cards SET embedding = ? WHERE id = ?').run(Buffer.from(blob), cardId);
  });

  ipcMain.handle('db:getEmbedding', (_e, cardId: string) => {
    const row = db().prepare('SELECT embedding FROM cards WHERE id = ?').get(cardId) as any;
    return row?.embedding || null;
  });

  ipcMain.handle('db:getEmbeddings', (_e, sessionId: string) => {
    const rows = db()
      .prepare('SELECT id, embedding FROM cards WHERE session_id = ? AND embedding IS NOT NULL')
      .all(sessionId) as any[];
    return rows.map((r: any) => ({ id: r.id, embedding: r.embedding }));
  });

  // ── Knowledge Graph ──

  ipcMain.handle('db:getGraphNodes', (_e, sessionId: string) => {
    const rows = db()
      .prepare('SELECT * FROM knowledge_graph_nodes WHERE session_id = ? ORDER BY created_at')
      .all(sessionId) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      label: r.label,
      type: r.type,
      metadata: safeJsonParse(r.metadata, {}),
      sessionId: r.session_id,
      createdAt: r.created_at,
    }));
  });

  ipcMain.handle('db:getGraphEdges', (_e, sessionId: string) => {
    const rows = db()
      .prepare('SELECT * FROM knowledge_graph_edges WHERE session_id = ?')
      .all(sessionId) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      sourceId: r.source_id,
      targetId: r.target_id,
      relationship: r.relationship,
      weight: r.weight ?? 1,
      sessionId: r.session_id,
    }));
  });

  ipcMain.handle('db:createGraphNode', (_e, node: any) => {
    db()
      .prepare(
        `INSERT OR IGNORE INTO knowledge_graph_nodes (id, label, type, metadata, session_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        node.id,
        node.label,
        node.type || 'concept',
        JSON.stringify(node.metadata || {}),
        node.sessionId || null,
        node.createdAt || new Date().toISOString()
      );
  });

  ipcMain.handle('db:createGraphEdge', (_e, edge: any) => {
    db()
      .prepare(
        `INSERT OR IGNORE INTO knowledge_graph_edges (id, source_id, target_id, relationship, weight, session_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        edge.id,
        edge.sourceId,
        edge.targetId,
        edge.relationship,
        edge.weight ?? 1,
        edge.sessionId || null
      );
  });

  ipcMain.handle('db:deleteGraphNode', (_e, nodeId: string) => {
    const d = db();
    d.prepare('DELETE FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?').run(nodeId, nodeId);
    d.prepare('DELETE FROM knowledge_graph_nodes WHERE id = ?').run(nodeId);
  });

  // ── Bulk Import/Export ──

  ipcMain.handle('db:importSession', (_e, data: any) => {
    const d = db();
    d.transaction(() => {
      // Insert session
      d.prepare(
        `INSERT OR REPLACE INTO sessions (id, title, mode, status, goal, approach, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        data.session.id,
        data.session.title,
        data.session.mode,
        data.session.status || 'active',
        data.session.goal || '',
        data.session.approach || '',
        data.session.createdAt || new Date().toISOString(),
        new Date().toISOString()
      );

      // Delete existing columns/cards for this session (replace)
      d.prepare('DELETE FROM columns WHERE session_id = ?').run(data.session.id);

      // Insert columns
      const colStmt = d.prepare(
        `INSERT INTO columns (id, session_id, type, title, sort_order, visible, collapsed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const col of data.columns || []) {
        colStmt.run(
          col.id,
          col.sessionId || data.session.id,
          col.type,
          col.title,
          col.sortOrder || col.sort_order || 'n',
          col.visible !== false ? 1 : 0,
          col.collapsed ? 1 : 0
        );
      }

      // Insert cards
      const cardStmt = d.prepare(
        `INSERT INTO cards (id, column_id, session_id, content, source, source_agent_name,
         source_card_ids, prompt_used, ai_tags, user_tags, speaker, timestamp_ms,
         highlighted_by, is_deleted, created_at, updated_at, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const card of data.cards || []) {
        cardStmt.run(
          card.id,
          card.columnId || card.column_id,
          card.sessionId || data.session.id,
          card.content,
          card.source,
          card.sourceAgentName || card.source_agent_name || null,
          JSON.stringify(card.sourceCardIds || card.source_card_ids || []),
          card.promptUsed || card.prompt_used || null,
          JSON.stringify(card.aiTags || card.ai_tags || []),
          JSON.stringify(card.userTags || card.user_tags || []),
          card.speaker || null,
          card.timestamp ?? card.timestamp_ms ?? null,
          card.highlightedBy || card.highlighted_by || 'none',
          card.isDeleted || card.is_deleted ? 1 : 0,
          card.createdAt || card.created_at || new Date().toISOString(),
          card.updatedAt || card.updated_at || new Date().toISOString(),
          card.sortOrder || card.sort_order || 'n'
        );
      }

      // Insert speaker colors
      if (data.speakerColors) {
        d.prepare('DELETE FROM speaker_colors WHERE session_id = ?').run(data.session.id);
        const scStmt = d.prepare(
          'INSERT INTO speaker_colors (session_id, speaker, color) VALUES (?, ?, ?)'
        );
        for (const [speaker, color] of Object.entries(data.speakerColors)) {
          scStmt.run(data.session.id, speaker, color as string);
        }
      }
    })();
    return true;
  });

  ipcMain.handle('db:exportSession', (_e, sessionId: string) => {
    const d = db();
    const session = d.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!session) return null;

    const columns = d.prepare('SELECT * FROM columns WHERE session_id = ? ORDER BY sort_order').all(sessionId).map(mapColumnFromDb);
    const cards = d.prepare('SELECT * FROM cards WHERE session_id = ? ORDER BY sort_order').all(sessionId).map(mapCardFromDb);
    const agentTasks = d.prepare('SELECT * FROM agent_tasks WHERE session_id = ? ORDER BY created_at').all(sessionId).map(mapAgentTaskFromDb);

    const speakerColorRows = d.prepare('SELECT speaker, color FROM speaker_colors WHERE session_id = ?').all(sessionId) as any[];
    const speakerColors: Record<string, string> = {};
    for (const row of speakerColorRows) {
      speakerColors[row.speaker] = row.color;
    }

    return {
      _format: 'the-wall-session',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      session: mapSessionFromDb(session),
      columns,
      cards,
      speakerColors,
      agentTasks,
    };
  });

  ipcMain.handle('db:exportAllSessions', () => {
    const d = db();
    const sessionRows = d.prepare('SELECT id FROM sessions ORDER BY updated_at DESC').all() as any[];
    const sessions = [];
    for (const row of sessionRows) {
      const session = d.prepare('SELECT * FROM sessions WHERE id = ?').get(row.id) as any;
      const columns = d.prepare('SELECT * FROM columns WHERE session_id = ?').all(row.id).map(mapColumnFromDb);
      const cards = d.prepare('SELECT * FROM cards WHERE session_id = ?').all(row.id).map(mapCardFromDb);
      const speakerColorRows = d.prepare('SELECT speaker, color FROM speaker_colors WHERE session_id = ?').all(row.id) as any[];
      const speakerColors: Record<string, string> = {};
      for (const sc of speakerColorRows) speakerColors[sc.speaker] = sc.color;

      sessions.push({
        _format: 'the-wall-session',
        _version: 1,
        session: mapSessionFromDb(session),
        columns,
        cards,
        speakerColors,
      });
    }
    return {
      _format: 'the-wall-backup',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      _count: sessions.length,
      sessions,
    };
  });
}

// ── Mapping helpers (snake_case DB -> camelCase app) ──

function mapSessionFromDb(row: any) {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    goal: row.goal,
    approach: row.approach,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cardCount: row.card_count,
  };
}

function mapColumnFromDb(row: any) {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    title: row.title,
    agentId: row.agent_id,
    sortOrder: row.sort_order,
    config: safeJsonParse(row.config, {}),
    visible: !!row.visible,
    collapsed: !!row.collapsed,
  };
}

function mapCardFromDb(row: any) {
  return {
    id: row.id,
    columnId: row.column_id,
    sessionId: row.session_id,
    content: row.content,
    source: row.source,
    sourceAgentId: row.source_agent_id,
    sourceAgentName: row.source_agent_name,
    sourceCardIds: safeJsonParse(row.source_card_ids, []),
    promptUsed: row.prompt_used,
    aiTags: safeJsonParse(row.ai_tags, []),
    userTags: safeJsonParse(row.user_tags, []),
    speaker: row.speaker,
    timestamp: row.timestamp_ms,
    highlightedBy: row.highlighted_by,
    isDeleted: !!row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sortOrder: row.sort_order,
  };
}

function mapAgentFromDb(row: any) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    systemPrompt: row.system_prompt,
    tools: safeJsonParse(row.tools, []),
    enabled: !!row.enabled,
    inputSources: safeJsonParse(row.input_sources, []),
    config: safeJsonParse(row.config, {}),
    createdAt: row.created_at,
  };
}

function mapAgentTaskFromDb(row: any) {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentKey: row.agent_key,
    sessionId: row.session_id,
    status: row.status,
    priority: row.priority,
    prompt: row.prompt,
    systemPrompt: row.system_prompt,
    inputText: row.input_text,
    result: row.result,
    resultPreview: row.result_preview,
    error: row.error,
    cardsCreated: row.cards_created,
    duration: row.duration_ms,
    targetColumnId: row.target_column_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function safeJsonParse(str: string | null, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
