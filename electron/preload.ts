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

    // Embeddings
    storeEmbedding: (cardId: string, blob: ArrayBuffer) =>
      ipcRenderer.invoke('db:storeEmbedding', cardId, blob),
    getEmbedding: (cardId: string) => ipcRenderer.invoke('db:getEmbedding', cardId),
    getEmbeddings: (sessionId: string) => ipcRenderer.invoke('db:getEmbeddings', sessionId),

    // Bulk operations
    importSession: (data: any) => ipcRenderer.invoke('db:importSession', data),
    exportSession: (sessionId: string) => ipcRenderer.invoke('db:exportSession', sessionId),
    exportAllSessions: () => ipcRenderer.invoke('db:exportAllSessions'),
  },
});
