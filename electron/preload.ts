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
  },
});
