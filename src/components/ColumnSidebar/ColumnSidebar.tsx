// ============================================================================
// The Wall — Column Sidebar (file-browser style column manager with tabs)
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import type { Column, AgentConfigOverride } from '@/types';
import { COL_TYPES } from '@/types';
import AgentsTab from './AgentsTab';

type SidebarTab = 'columns' | 'agents';

interface ColumnSidebarProps {
  columns: Column[];
  open: boolean;
  onToggle: () => void;
  setColumnVisible: (id: string, visible: boolean) => void;
  updateColumnOrder: (orderedIds: string[]) => void;
  /** Agent config overrides keyed by agent ID. */
  agentConfigs: Record<string, AgentConfigOverride>;
  /** Toggle an agent on/off. */
  onToggleAgent: (agentId: string, enabled: boolean) => void;
  /** Current concurrency setting. */
  concurrency: number;
  /** Update concurrency. */
  onConcurrencyChange: (n: number) => void;
}

const ColumnSidebar: React.FC<ColumnSidebarProps> = ({
  columns,
  open,
  onToggle,
  setColumnVisible,
  updateColumnOrder,
  agentConfigs,
  onToggleAgent,
  concurrency,
  onConcurrencyChange,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('columns');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const sorted = [...columns].sort((a, b) =>
    (a.sortOrder || '').localeCompare(b.sortOrder || ''),
  );

  const getMeta = (col: Column) => {
    // Check for ephemeral chunk columns
    if (col.config?.ephemeral) {
      return { icon: '\uD83D\uDCC4', color: '#10b981' };
    }
    const meta = COL_TYPES.find((c) => c.type === col.type);
    return meta || { icon: '\uD83D\uDCCB', color: '#6b7280' };
  };

  const handleDragStart = useCallback((idx: number) => {
    dragRef.current = idx;
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragRef.current !== null && dragRef.current !== idx) {
        setDropIdx(idx);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (idx: number) => {
      if (dragRef.current === null || dragRef.current === idx) {
        setDragIdx(null);
        setDropIdx(null);
        return;
      }

      const reordered = [...sorted];
      const [moved] = reordered.splice(dragRef.current, 1);
      reordered.splice(idx, 0, moved);
      updateColumnOrder(reordered.map((c) => c.id));

      dragRef.current = null;
      setDragIdx(null);
      setDropIdx(null);
    },
    [sorted, updateColumnOrder],
  );

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  // ── Collapsed sidebar ──
  if (!open) {
    return (
      <div
        className="flex w-[36px] min-w-[36px] cursor-pointer flex-col items-center border-r border-wall-border bg-wall-surface pt-2"
        onClick={onToggle}
        title="Open sidebar"
      >
        <span className="text-sm text-wall-subtle">{'\u2630'}</span>
        <span
          className="mt-2 text-[9px] text-wall-subtle"
          style={{ writingMode: 'vertical-rl', letterSpacing: 1 }}
        >
          {activeTab === 'columns' ? 'Columns' : 'Agents'}
        </span>
      </div>
    );
  }

  // ── Expanded sidebar ──
  return (
    <div className="flex h-full w-[200px] min-w-[200px] flex-col border-r border-wall-border bg-wall-surface">
      {/* ── Header with tabs ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-wall-border px-1 py-1">
        <div className="flex gap-0.5">
          <button
            onClick={() => setActiveTab('columns')}
            className="cursor-pointer rounded px-2 py-1 text-[10px] font-medium transition-colors"
            style={{
              background: activeTab === 'columns' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'columns' ? '#a5b4fc' : '#64748b',
              border: 'none',
            }}
          >
            Columns
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className="cursor-pointer rounded px-2 py-1 text-[10px] font-medium transition-colors"
            style={{
              background: activeTab === 'agents' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'agents' ? '#a5b4fc' : '#64748b',
              border: 'none',
            }}
          >
            Agents
          </button>
        </div>
        <button
          onClick={onToggle}
          className="cursor-pointer border-none bg-transparent text-[11px] text-wall-subtle"
          title="Collapse sidebar"
        >
          {'\u25C0'}
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'columns' ? (
        <div
          className="flex-1 overflow-auto px-1 py-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
        >
          {sorted.map((col, idx) => {
            const meta = getMeta(col);
            const isDragging = dragIdx === idx;
            const isDropTarget = dropIdx === idx;

            return (
              <div
                key={col.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-[5px] transition-colors"
                style={{
                  opacity: isDragging ? 0.4 : 1,
                  borderTop: isDropTarget ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'grab',
                }}
              >
                {/* Drag handle */}
                <span className="text-[9px] text-wall-muted">{'\u2630'}</span>

                {/* Visibility checkbox */}
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={(e) => {
                    e.stopPropagation();
                    setColumnVisible(col.id, !col.visible);
                  }}
                  className="h-3 w-3 cursor-pointer accent-indigo-500"
                  title={col.visible ? 'Hide column' : 'Show column'}
                />

                {/* Icon + title */}
                <span className="text-[11px]">{meta.icon}</span>
                <span
                  className="min-w-0 flex-1 truncate text-[10px]"
                  style={{
                    color: col.visible ? '#e2e8f0' : '#64748b',
                    fontWeight: col.visible ? 500 : 400,
                  }}
                >
                  {col.title}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <AgentsTab
            agentConfigs={agentConfigs}
            onToggleAgent={onToggleAgent}
            concurrency={concurrency}
            onConcurrencyChange={onConcurrencyChange}
          />
        </div>
      )}
    </div>
  );
};

export default ColumnSidebar;
