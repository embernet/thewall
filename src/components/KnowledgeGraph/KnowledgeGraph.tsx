import { useEffect, useRef, useState, useCallback } from 'react';
import { bus } from '@/events/bus';
import {
  getGraph,
  getNodes,
  getEdges,
  loadGraph,
  clearGraph,
} from '@/graph/graph-service';
import { useSessionStore } from '@/store/session';
import type { KnowledgeGraphNode, KnowledgeGraphEdge, KGNodeType } from '@/types';

// ---------------------------------------------------------------------------
// Knowledge Graph Panel
//
// Canvas-based force-directed graph visualization.
// Toggle-able panel rendered as an overlay / side panel.
// ---------------------------------------------------------------------------

const NODE_COLORS: Record<KGNodeType, string> = {
  concept: '#8b5cf6',
  entity: '#06b6d4',
  topic: '#f59e0b',
  claim: '#14b8a6',
};

const NODE_RADIUS_BASE = 8;
const LINK_COLOR = 'rgba(100, 116, 139, 0.4)';
const LABEL_COLOR = '#e2e8f0';
const BG_COLOR = '#0f172a';

interface SimNode {
  id: string;
  label: string;
  type: KGNodeType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

interface SimEdge {
  sourceId: string;
  targetId: string;
  relationship: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KnowledgeGraph({ open, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const session = useSessionStore(s => s.session);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<SimEdge[]>([]);
  const [hovered, setHovered] = useState<SimNode | null>(null);
  const [dragging, setDragging] = useState<SimNode | null>(null);
  const animRef = useRef<number>(0);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  // Load graph data
  const refreshData = useCallback(() => {
    const gNodes = getNodes();
    const gEdges = getEdges();
    const graph = getGraph();

    const simNodes: SimNode[] = gNodes.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type || 'concept',
      x: Math.random() * 600 - 300,
      y: Math.random() * 400 - 200,
      vx: 0,
      vy: 0,
      degree: graph.hasNode(n.id) ? graph.degree(n.id) : 0,
    }));

    const simEdges: SimEdge[] = gEdges.map(e => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      relationship: e.relationship,
    }));

    setNodes(simNodes);
    setEdges(simEdges);
  }, []);

  // Load on open
  useEffect(() => {
    if (!open || !session?.id) return;
    loadGraph(session.id).then(refreshData);
    return () => { clearGraph(); };
  }, [open, session?.id, refreshData]);

  // Listen for graph updates
  useEffect(() => {
    if (!open) return;
    const onNodeAdded = () => refreshData();
    const onEdgeAdded = () => refreshData();
    bus.on('graph:nodeAdded', onNodeAdded);
    bus.on('graph:edgeAdded', onEdgeAdded);
    return () => {
      bus.off('graph:nodeAdded', onNodeAdded);
      bus.off('graph:edgeAdded', onEdgeAdded);
    };
  }, [open, refreshData]);

  // Force simulation + render
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const nodesMap = new Map<string, SimNode>();
    nodes.forEach(n => nodesMap.set(n.id, n));

    const tick = () => {
      if (!running) return;

      // Resize canvas to container
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2 + panRef.current.x * window.devicePixelRatio;
      const cy = h / 2 + panRef.current.y * window.devicePixelRatio;
      const scale = zoomRef.current * window.devicePixelRatio;

      // Simple force simulation step
      for (const n of nodes) {
        // Center gravity
        n.vx += -n.x * 0.01;
        n.vy += -n.y * 0.01;
      }

      // Node repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Edge attraction
      for (const e of edges) {
        const s = nodesMap.get(e.sourceId);
        const t = nodesMap.get(e.targetId);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.005;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      // Apply velocities with damping
      for (const n of nodes) {
        if (dragging && n.id === dragging.id) continue;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Clear
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Draw edges
      ctx.strokeStyle = LINK_COLOR;
      ctx.lineWidth = 1;
      for (const e of edges) {
        const s = nodesMap.get(e.sourceId);
        const t = nodesMap.get(e.targetId);
        if (!s || !t) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();

        // Edge label
        const mx = (s.x + t.x) / 2;
        const my = (s.y + t.y) / 2;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.relationship, mx, my - 3);
      }

      // Draw nodes
      for (const n of nodes) {
        const r = NODE_RADIUS_BASE + Math.min(n.degree, 10) * 1.5;
        const color = NODE_COLORS[n.type] || NODE_COLORS.concept;

        // Glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = color + '30';
        ctx.fill();

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hovered?.id === n.id ? '#fff' : color;
        ctx.fill();

        // Label
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + r + 14);
      }

      ctx.restore();

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [open, nodes, edges, hovered, dragging]);

  // Mouse interactions
  const getNodeAt = useCallback((clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left - rect.width / 2 - panRef.current.x) / zoomRef.current;
    const my = (clientY - rect.top - rect.height / 2 - panRef.current.y) / zoomRef.current;

    for (const n of nodes) {
      const r = NODE_RADIUS_BASE + Math.min(n.degree, 10) * 1.5 + 4;
      const dx = mx - n.x;
      const dy = my - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dragging.x = (e.clientX - rect.left - rect.width / 2 - panRef.current.x) / zoomRef.current;
      dragging.y = (e.clientY - rect.top - rect.height / 2 - panRef.current.y) / zoomRef.current;
      dragging.vx = 0;
      dragging.vy = 0;
    } else {
      setHovered(getNodeAt(e.clientX, e.clientY));
    }
  }, [dragging, getNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node) setDragging(node);
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.2, Math.min(3, zoomRef.current - e.deltaY * 0.001));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-[600px] flex-col border-l border-wall-border bg-wall-bg">
        {/* Header */}
        <div className="flex h-[42px] items-center justify-between border-b border-wall-border px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Knowledge Graph</span>
            <span className="rounded bg-wall-border px-1.5 py-0.5 text-[10px] text-wall-subtle">
              {nodes.length} nodes &middot; {edges.length} edges
            </span>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-lg text-wall-text-dim hover:text-wall-text"
          >
            &times;
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 border-b border-wall-border px-4 py-1.5">
          {(Object.entries(NODE_COLORS) as [KGNodeType, string][]).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[9px] capitalize text-wall-subtle">{type}</span>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="relative flex-1">
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-wall-subtle">
              No nodes yet. The Knowledge Manager agent will populate the graph as you talk.
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="h-full w-full"
              style={{ cursor: hovered ? 'pointer' : dragging ? 'grabbing' : 'default' }}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            />
          )}
        </div>

        {/* Hovered node details */}
        {hovered && (
          <div className="border-t border-wall-border px-4 py-2">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ background: NODE_COLORS[hovered.type] || NODE_COLORS.concept }}
              />
              <span className="text-xs font-semibold text-wall-text">{hovered.label}</span>
              <span className="text-[10px] capitalize text-wall-subtle">{hovered.type}</span>
            </div>
            <div className="mt-1 text-[10px] text-wall-subtle">
              {hovered.degree} connection{hovered.degree !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
