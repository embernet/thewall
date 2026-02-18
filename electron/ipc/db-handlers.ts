import { ipcMain, safeStorage } from 'electron';
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
        `INSERT OR IGNORE INTO cards (id, column_id, session_id, content, source, source_agent_id, source_agent_name,
         source_card_ids, prompt_used, ai_tags, user_tags, speaker, timestamp_ms, highlighted_by,
         is_deleted, pinned, created_at, updated_at, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        card.pinned ? 1 : 0,
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
    if (updates.pinned !== undefined) { fields.push('pinned = ?'); values.push(updates.pinned ? 1 : 0); }

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

  ipcMain.handle('db:getApiUsageSummary', () => {
    const rows = db()
      .prepare(
        `SELECT provider, model,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cost_usd) as cost_usd,
                COUNT(*) as call_count,
                MIN(created_at) as first_call,
                MAX(created_at) as last_call
         FROM api_usage
         GROUP BY provider, model
         ORDER BY cost_usd DESC`
      )
      .all();
    const total = db()
      .prepare(
        `SELECT SUM(cost_usd) as total_cost,
                SUM(input_tokens) as total_input,
                SUM(output_tokens) as total_output,
                COUNT(*) as total_calls
         FROM api_usage`
      )
      .get() as any;
    return { byModel: rows, totals: total || { total_cost: 0, total_input: 0, total_output: 0, total_calls: 0 } };
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

  // ── API Key Management ──

  ipcMain.handle('db:getApiKeyConfigs', () => {
    const d = db();
    // Ensure the api_keys table exists
    d.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        slot TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        encrypted_key BLOB,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const rows = d.prepare('SELECT slot, provider, model_id, encrypted_key FROM api_keys').all() as any[];
    return rows.map((r: any) => ({
      slot: r.slot,
      provider: r.provider,
      modelId: r.model_id,
      hasKey: !!r.encrypted_key,
    }));
  });

  ipcMain.handle('db:setApiKeyConfig', (_e, slot: string, provider: string, modelId: string, rawKey: string) => {
    let encryptedKey: Buffer | null = null;
    if (rawKey) {
      if (safeStorage.isEncryptionAvailable()) {
        encryptedKey = safeStorage.encryptString(rawKey);
      } else {
        // Fallback: store as plain UTF-8 buffer (not ideal but functional)
        console.warn('safeStorage encryption not available — storing key as plaintext');
        encryptedKey = Buffer.from(rawKey, 'utf-8');
      }
    }
    const d = db();
    // Ensure the api_keys table exists (in case migration hasn't run yet)
    d.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        slot TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        encrypted_key BLOB,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    d.prepare(
      `INSERT INTO api_keys (slot, provider, model_id, encrypted_key, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slot) DO UPDATE SET
         provider = excluded.provider,
         model_id = excluded.model_id,
         encrypted_key = COALESCE(excluded.encrypted_key, api_keys.encrypted_key),
         updated_at = excluded.updated_at`
    ).run(slot, provider, modelId, encryptedKey, new Date().toISOString());
  });

  ipcMain.handle('db:getDecryptedKey', (_e, slot: string) => {
    const row = db().prepare('SELECT encrypted_key FROM api_keys WHERE slot = ?').get(slot) as any;
    if (!row?.encrypted_key) return '';
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(row.encrypted_key);
      }
      // Fallback: stored as plain UTF-8
      return row.encrypted_key.toString('utf-8');
    } catch (e) {
      console.warn('Failed to decrypt API key for slot', slot, e);
      return '';
    }
  });

  ipcMain.handle('db:deleteApiKeyConfig', (_e, slot: string) => {
    db().prepare('DELETE FROM api_keys WHERE slot = ?').run(slot);
  });

  // ── Chat Messages ──

  ipcMain.handle('db:getChatMessages', (_e, sessionId: string) => {
    const rows = db()
      .prepare(
        'SELECT * FROM chat_messages WHERE session_id = ? AND is_deleted = 0 ORDER BY timestamp_ms ASC'
      )
      .all(sessionId) as any[];
    return rows.map(mapChatMessageFromDb);
  });

  ipcMain.handle('db:createChatMessage', (_e, msg: any) => {
    db()
      .prepare(
        `INSERT OR IGNORE INTO chat_messages
         (id, session_id, role, content, image_attachments, image_data, image_mime_type,
          agent_name, is_image_prompt_card, structured_prompt_text, final_prompt,
          hidden_from_llm, collapsed, is_deleted, timestamp_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        msg.id,
        msg.sessionId,
        msg.role,
        msg.content,
        msg.imageAttachments ? JSON.stringify(msg.imageAttachments) : null,
        msg.imageData ?? null,
        msg.imageMimeType ?? null,
        msg.agentName ?? null,
        msg.isImagePromptCard ? 1 : 0,
        msg.structuredPromptText ?? null,
        msg.finalPrompt ?? null,
        msg.hiddenFromLlm ? 1 : 0,
        msg.collapsed ? 1 : 0,
        msg.isDeleted ? 1 : 0,
        msg.timestamp,
        new Date().toISOString()
      );
    return msg;
  });

  ipcMain.handle('db:updateChatMessage', (_e, id: string, updates: any) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.hiddenFromLlm !== undefined) { fields.push('hidden_from_llm = ?'); values.push(updates.hiddenFromLlm ? 1 : 0); }
    if (updates.collapsed !== undefined) { fields.push('collapsed = ?'); values.push(updates.collapsed ? 1 : 0); }
    if (updates.isDeleted !== undefined) { fields.push('is_deleted = ?'); values.push(updates.isDeleted ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);
    db().prepare(`UPDATE chat_messages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  });

  ipcMain.handle('db:clearChatMessages', (_e, sessionId: string) => {
    db().prepare('UPDATE chat_messages SET is_deleted = 1 WHERE session_id = ?').run(sessionId);
  });

  // ── Transcription Proxy ──
  // Proxies transcription API calls through the main process to avoid CORS
  // issues in the renderer. The main process fetch is not subject to CORS.

  ipcMain.handle('transcribe', async (_e, audioBase64: string) => {
    // Read transcription config from DB
    const row = db().prepare('SELECT * FROM api_keys WHERE slot = ?').get('transcription') as any;
    if (!row) return { error: 'No transcription API key configured' };

    const provider = row.provider;
    const modelId = row.model_id;

    let apiKey = '';
    if (row.encrypted_key) {
      try {
        if (safeStorage.isEncryptionAvailable()) {
          apiKey = safeStorage.decryptString(row.encrypted_key);
        } else {
          apiKey = row.encrypted_key.toString('utf-8');
        }
      } catch {
        return { error: 'Failed to decrypt transcription API key' };
      }
    }
    if (!apiKey) return { error: 'Transcription API key is empty' };

    try {
      if (provider === 'wispr') {
        // WISPR Flow — direct API-key auth
        const r = await fetch('https://api.flowvoice.ai/api/v1/dash/api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ audio: audioBase64, properties: {} }),
        });
        if (!r.ok) {
          const err = await r.text().catch(() => r.statusText);
          return { error: `WISPR Flow API error ${r.status}: ${err}` };
        }
        const json = await r.json() as { text?: string };
        return { text: (json.text ?? '').trim() };

      } else {
        // OpenAI Whisper — multipart form upload
        // Decode base64 audio back to binary and wrap in a File so that
        // Node's FormData sends the correct Content-Disposition filename
        // and Content-Type in the multipart boundary.
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

        const form = new FormData();
        form.append('file', file);
        form.append('model', modelId || 'whisper-1');
        form.append('language', 'en');
        form.append('response_format', 'text');

        const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
        if (!r.ok) {
          const err = await r.text().catch(() => r.statusText);
          return { error: `Whisper API error ${r.status}: ${err}` };
        }
        const text = await r.text();
        return { text: text.trim() };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: msg };
    }
  });

  // ── Image Generation Proxy ──
  // Proxies Imagen 3 API calls through the main process to avoid CORS issues
  // in the renderer. Google's Generative AI API does not set CORS headers.

  // List available Google image generation models (CORS proxy).
  // Returns Imagen models (predict method) plus Gemini models that support image output.
  ipcMain.handle('listImagenModels', async (_e, apiKey: string) => {
    if (!apiKey) return { error: 'No API key provided', models: [] };
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      );
      if (!r.ok) {
        const err = await r.text().catch(() => r.statusText);
        return { error: `Google API error ${r.status}: ${err}`, models: [] };
      }
      const data = await r.json() as {
        models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      };
      // Include Imagen models (predict) AND Gemini image-generation models (generateContent)
      const models = (data.models ?? []).filter((m) => {
        const isImagen = /imagen/i.test(m.name) && m.supportedGenerationMethods?.includes('predict');
        const isGeminiImage = /gemini.*image|image.*gemini/i.test(m.name);
        return isImagen || isGeminiImage;
      });
      return { models, error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: msg, models: [] };
    }
  });

  ipcMain.handle('generateImage', async (_e, prompt: string, inputBase64?: string, overrideModelId?: string) => {
    const row = db().prepare('SELECT * FROM api_keys WHERE slot = ?').get('image_gen') as any;
    if (!row) return { error: 'No image generation API key configured' };

    let apiKey = '';
    if (row.encrypted_key) {
      try {
        if (safeStorage.isEncryptionAvailable()) {
          apiKey = safeStorage.decryptString(row.encrypted_key);
        } else {
          apiKey = row.encrypted_key.toString('utf-8');
        }
      } catch {
        return { error: 'Failed to decrypt image generation API key' };
      }
    }
    if (!apiKey) return { error: 'Image generation API key is empty' };

    // overrideModelId comes from the per-generation model picker in the UI;
    // falls back to whatever is saved in settings, then the hardcoded default.
    const modelId = overrideModelId || row.model_id || 'imagen-3.0-generate-001';

    // ── Gemini generateContent pathway ──────────────────────────────────────
    // Gemini image-generation models (e.g. gemini-2.0-flash-preview-image-generation)
    // use generateContent with responseModalities: ["IMAGE"].
    const isGeminiImageModel = /gemini/i.test(modelId);
    if (isGeminiImageModel) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      const parts: Array<Record<string, unknown>> = [{ text: prompt }];
      if (inputBase64) {
        // Prepend image part for image-to-image
        parts.unshift({ inlineData: { mimeType: 'image/png', data: inputBase64 } });
      }
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
        });
        if (!r.ok) {
          const err = await r.text().catch(() => r.statusText);
          return { error: `Gemini image API error ${r.status}: ${err}` };
        }
        const data = await r.json() as {
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
          }>;
        };
        const parts2 = data.candidates?.[0]?.content?.parts ?? [];
        const imgPart = parts2.find((p) => p.inlineData?.data);
        if (!imgPart?.inlineData?.data) {
          return { error: 'Gemini returned no image data' };
        }
        return {
          imageData: imgPart.inlineData.data,
          mimeType: imgPart.inlineData.mimeType || 'image/png',
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: msg };
      }
    }

    // ── Imagen predict pathway ───────────────────────────────────────────────
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`;

    const instance: Record<string, unknown> = { prompt };
    if (inputBase64) {
      instance.image = { bytesBase64Encoded: inputBase64 };
    }

    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [instance],
          parameters: { sampleCount: 1 },
        }),
      });
      if (!r.ok) {
        const err = await r.text().catch(() => r.statusText);
        return { error: `Imagen API error ${r.status}: ${err}` };
      }
      const data = await r.json() as { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] };
      const prediction = data.predictions?.[0];
      if (!prediction?.bytesBase64Encoded) {
        return { error: 'Imagen returned no image data' };
      }
      return {
        imageData: prediction.bytesBase64Encoded,
        mimeType: prediction.mimeType || 'image/png',
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: msg };
    }
  });

  // ── Agent Configuration ──

  ipcMain.handle('db:getAgentConfigs', () => {
    const rows = db().prepare('SELECT * FROM agent_configs').all() as any[];
    return rows.map((r: any) => ({
      agentId: r.agent_id,
      enabled: r.enabled !== 0,
      systemPrompt: r.system_prompt ?? null,
      userPrompt: r.user_prompt ?? null,
      priority: r.priority ?? null,
      targetColumn: r.target_column ?? null,
      triggerOnTranscript: r.trigger_on_transcript != null ? !!r.trigger_on_transcript : null,
      inputColumns: safeJsonParse(r.input_columns, null),
      toolIds: safeJsonParse(r.tool_ids, null),
      maxTokens: r.max_tokens ?? null,
      dedupThreshold: r.dedup_threshold ?? null,
      updatedAt: r.updated_at,
    }));
  });

  ipcMain.handle('db:saveAgentConfig', (_e, agentId: string, config: any) => {
    db().prepare(
      `INSERT INTO agent_configs (agent_id, enabled, system_prompt, user_prompt, priority, target_column, trigger_on_transcript, input_columns, tool_ids, max_tokens, dedup_threshold, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent_id) DO UPDATE SET
         enabled = excluded.enabled,
         system_prompt = excluded.system_prompt,
         user_prompt = excluded.user_prompt,
         priority = excluded.priority,
         target_column = excluded.target_column,
         trigger_on_transcript = excluded.trigger_on_transcript,
         input_columns = excluded.input_columns,
         tool_ids = excluded.tool_ids,
         max_tokens = excluded.max_tokens,
         dedup_threshold = excluded.dedup_threshold,
         updated_at = excluded.updated_at`
    ).run(
      agentId,
      config.enabled !== undefined ? (config.enabled ? 1 : 0) : 1,
      config.systemPrompt ?? null,
      config.userPrompt ?? null,
      config.priority ?? null,
      config.targetColumn ?? null,
      config.triggerOnTranscript != null ? (config.triggerOnTranscript ? 1 : 0) : null,
      config.inputColumns ? JSON.stringify(config.inputColumns) : null,
      config.toolIds ? JSON.stringify(config.toolIds) : null,
      config.maxTokens ?? null,
      config.dedupThreshold ?? null,
      new Date().toISOString()
    );
  });

  ipcMain.handle('db:deleteAgentConfig', (_e, agentId: string) => {
    db().prepare('DELETE FROM agent_configs WHERE agent_id = ?').run(agentId);
  });

  ipcMain.handle('db:getCustomAgents', () => {
    const rows = db().prepare('SELECT * FROM custom_agents ORDER BY name').all() as any[];
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      personaId: r.persona_id || null,
      systemPrompt: r.system_prompt,
      userPrompt: r.user_prompt,
      targetColumn: r.target_column,
      priority: r.priority ?? 5,
      triggerOnTranscript: !!r.trigger_on_transcript,
      dependsOn: safeJsonParse(r.depends_on, []),
      inputColumns: safeJsonParse(r.input_columns, []),
      toolIds: safeJsonParse(r.tool_ids, []),
      enabled: r.enabled !== 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  });

  ipcMain.handle('db:saveCustomAgent', (_e, agent: any) => {
    db().prepare(
      `INSERT INTO custom_agents (id, name, description, persona_id, system_prompt, user_prompt, target_column, priority, trigger_on_transcript, depends_on, input_columns, tool_ids, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         persona_id = excluded.persona_id,
         system_prompt = excluded.system_prompt,
         user_prompt = excluded.user_prompt,
         target_column = excluded.target_column,
         priority = excluded.priority,
         trigger_on_transcript = excluded.trigger_on_transcript,
         depends_on = excluded.depends_on,
         input_columns = excluded.input_columns,
         tool_ids = excluded.tool_ids,
         enabled = excluded.enabled,
         updated_at = excluded.updated_at`
    ).run(
      agent.id,
      agent.name,
      agent.description || '',
      agent.personaId || null,
      agent.systemPrompt,
      agent.userPrompt,
      agent.targetColumn,
      agent.priority ?? 5,
      agent.triggerOnTranscript ? 1 : 0,
      JSON.stringify(agent.dependsOn || []),
      JSON.stringify(agent.inputColumns || []),
      JSON.stringify(agent.toolIds || []),
      agent.enabled !== false ? 1 : 0,
      agent.createdAt || new Date().toISOString(),
      new Date().toISOString()
    );
  });

  ipcMain.handle('db:deleteCustomAgent', (_e, id: string) => {
    db().prepare('DELETE FROM custom_agents WHERE id = ?').run(id);
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
         highlighted_by, is_deleted, pinned, created_at, updated_at, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          card.pinned ? 1 : 0,
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
    pinned: !!row.pinned,
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

function mapChatMessageFromDb(row: any) {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    imageAttachments: safeJsonParse(row.image_attachments, undefined),
    imageData: row.image_data ?? undefined,
    imageMimeType: row.image_mime_type ?? undefined,
    agentName: row.agent_name ?? undefined,
    isImagePromptCard: !!row.is_image_prompt_card,
    structuredPromptText: row.structured_prompt_text ?? undefined,
    finalPrompt: row.final_prompt ?? undefined,
    hiddenFromLlm: !!row.hidden_from_llm,
    collapsed: !!row.collapsed,
    isDeleted: !!row.is_deleted,
    timestamp: row.timestamp_ms,
  };
}

function safeJsonParse(str: string | null, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
