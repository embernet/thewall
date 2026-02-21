import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    // Sessions
    getSessions: () => ipcRenderer.invoke('db:getSessions'),
    getSession: (id: string) => ipcRenderer.invoke('db:getSession', id),
    createSession: (session: any) => ipcRenderer.invoke('db:createSession', session),
    updateSession: (id: string, updates: any) => ipcRenderer.invoke('db:updateSession', id, updates),
    deleteSession: (id: string) => ipcRenderer.invoke('db:deleteSession', id),

    // Columns
    getColumns: (sessionId: string) => ipcRenderer.invoke('db:getColumns', sessionId),
    createColumn: (column: any) => ipcRenderer.invoke('db:createColumn', column),
    updateColumn: (id: string, updates: any) => ipcRenderer.invoke('db:updateColumn', id, updates),

    // Cards
    getCards: (sessionId: string) => ipcRenderer.invoke('db:getCards', sessionId),
    createCard: (card: any) => ipcRenderer.invoke('db:createCard', card),
    updateCard: (id: string, updates: any) => ipcRenderer.invoke('db:updateCard', id, updates),
    deleteCard: (id: string) => ipcRenderer.invoke('db:deleteCard', id),
    moveCard: (id: string, columnId: string, sortOrder: string) =>
      ipcRenderer.invoke('db:moveCard', id, columnId, sortOrder),

    // Speaker Colors
    getSpeakerColors: (sessionId: string) => ipcRenderer.invoke('db:getSpeakerColors', sessionId),
    saveSpeakerColors: (sessionId: string, colors: Record<string, string>) =>
      ipcRenderer.invoke('db:saveSpeakerColors', sessionId, colors),

    // Agents
    getAgents: () => ipcRenderer.invoke('db:getAgents'),
    createAgent: (agent: any) => ipcRenderer.invoke('db:createAgent', agent),
    updateAgent: (id: string, updates: any) => ipcRenderer.invoke('db:updateAgent', id, updates),

    // Agent Tasks
    getAgentTasks: (sessionId: string) => ipcRenderer.invoke('db:getAgentTasks', sessionId),
    createAgentTask: (task: any) => ipcRenderer.invoke('db:createAgentTask', task),
    updateAgentTask: (id: string, updates: any) => ipcRenderer.invoke('db:updateAgentTask', id, updates),

    // API Usage
    logApiUsage: (usage: any) => ipcRenderer.invoke('db:logApiUsage', usage),
    getApiUsageSummary: () => ipcRenderer.invoke('db:getApiUsageSummary'),
    getApiUsageSummaryForSession: (sessionId: string) =>
      ipcRenderer.invoke('db:getApiUsageSummaryForSession', sessionId),

    // API Key Management
    getApiKeyConfigs: () => ipcRenderer.invoke('db:getApiKeyConfigs'),
    setApiKeyConfig: (slot: string, provider: string, modelId: string, rawKey: string) =>
      ipcRenderer.invoke('db:setApiKeyConfig', slot, provider, modelId, rawKey),
    getDecryptedKey: (slot: string) => ipcRenderer.invoke('db:getDecryptedKey', slot),
    deleteApiKeyConfig: (slot: string) => ipcRenderer.invoke('db:deleteApiKeyConfig', slot),

    // Embeddings
    storeEmbedding: (cardId: string, blob: ArrayBuffer) =>
      ipcRenderer.invoke('db:storeEmbedding', cardId, blob),
    getEmbedding: (cardId: string) => ipcRenderer.invoke('db:getEmbedding', cardId),
    getEmbeddings: (sessionId: string) => ipcRenderer.invoke('db:getEmbeddings', sessionId),

    // Knowledge Graph
    getGraphNodes: (sessionId: string) => ipcRenderer.invoke('db:getGraphNodes', sessionId),
    getGraphEdges: (sessionId: string) => ipcRenderer.invoke('db:getGraphEdges', sessionId),
    createGraphNode: (node: any) => ipcRenderer.invoke('db:createGraphNode', node),
    createGraphEdge: (edge: any) => ipcRenderer.invoke('db:createGraphEdge', edge),
    deleteGraphNode: (nodeId: string) => ipcRenderer.invoke('db:deleteGraphNode', nodeId),

    // Bulk operations
    importSession: (data: any) => ipcRenderer.invoke('db:importSession', data),
    exportSession: (sessionId: string) => ipcRenderer.invoke('db:exportSession', sessionId),
    exportAllSessions: () => ipcRenderer.invoke('db:exportAllSessions'),

    // File processing (Context column)
    processContextFile: () => ipcRenderer.invoke('file:processContextFile'),

    // Session Templates
    getSessionTemplates: () => ipcRenderer.invoke('db:getSessionTemplates'),
    saveSessionTemplate: (template: any) => ipcRenderer.invoke('db:saveSessionTemplate', template),
    deleteSessionTemplate: (id: string) => ipcRenderer.invoke('db:deleteSessionTemplate', id),

    // Agent Configuration
    getAgentConfigs: () => ipcRenderer.invoke('db:getAgentConfigs'),
    saveAgentConfig: (agentId: string, config: any) =>
      ipcRenderer.invoke('db:saveAgentConfig', agentId, config),
    deleteAgentConfig: (agentId: string) => ipcRenderer.invoke('db:deleteAgentConfig', agentId),
    getCustomAgents: () => ipcRenderer.invoke('db:getCustomAgents'),
    saveCustomAgent: (agent: any) => ipcRenderer.invoke('db:saveCustomAgent', agent),
    deleteCustomAgent: (id: string) => ipcRenderer.invoke('db:deleteCustomAgent', id),

    // Chat Messages
    getChatMessages: (sessionId: string) => ipcRenderer.invoke('db:getChatMessages', sessionId),
    createChatMessage: (msg: any) => ipcRenderer.invoke('db:createChatMessage', msg),
    updateChatMessage: (id: string, updates: any) => ipcRenderer.invoke('db:updateChatMessage', id, updates),
    clearChatMessages: (sessionId: string) => ipcRenderer.invoke('db:clearChatMessages', sessionId),
  },

  // Transcription proxy (bypasses CORS)
  transcribe: (audioBase64: string) =>
    ipcRenderer.invoke('transcribe', audioBase64) as Promise<{ text?: string; error?: string }>,

  // Image generation proxy (bypasses CORS for Google Imagen API)
  listImagenModels: (apiKey: string) =>
    ipcRenderer.invoke('listImagenModels', apiKey) as Promise<{
      models: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      error: string | null;
    }>,
  generateImage: (prompt: string, inputBase64?: string, modelId?: string) =>
    ipcRenderer.invoke('generateImage', prompt, inputBase64, modelId) as Promise<{ imageData?: string; mimeType?: string; error?: string }>,

  // Tool proxies (CORS-bypassed external API calls for agent tools)
  tools: {
    webSearch: (query: string, numResults?: number) =>
      ipcRenderer.invoke('tool:webSearch', query, numResults) as Promise<{
        results: Array<{ title: string; url: string; snippet: string }>;
        error: string | null;
      }>,
    searchPatents: (query: string, numResults?: number) =>
      ipcRenderer.invoke('tool:searchPatents', query, numResults) as Promise<{
        results: Array<{ title: string; url: string; snippet: string }>;
        error: string | null;
      }>,
    searchArxiv: (query: string, numResults?: number) =>
      ipcRenderer.invoke('tool:searchArxiv', query, numResults) as Promise<{
        results: Array<{ title: string; url: string; authors: string; published: string; summary: string }>;
        error: string | null;
      }>,
    searchAcademic: (query: string, numResults?: number, yearFrom?: number) =>
      ipcRenderer.invoke('tool:searchAcademic', query, numResults, yearFrom) as Promise<{
        results: Array<{ title: string; authors: string; year: number; abstract: string; url: string; citationCount: number; venue: string }>;
        error: string | null;
      }>,
    wikipediaLookup: (query: string) =>
      ipcRenderer.invoke('tool:wikipediaLookup', query) as Promise<{
        result: { title: string; extract: string; url: string } | null;
        error: string | null;
      }>,
    fetchUrl: (url: string) =>
      ipcRenderer.invoke('tool:fetchUrl', url) as Promise<{
        result: { title: string; content: string; url: string } | null;
        error: string | null;
      }>,
    fetchPdf: (url: string) =>
      ipcRenderer.invoke('tool:fetchPdf', url) as Promise<{
        result: { title: string; content: string; pageCount: number } | null;
        error: string | null;
      }>,
  },

  // Shell utilities
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('file:openPath', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // App lifecycle
  quit: () => ipcRenderer.invoke('app:quit'),
});
