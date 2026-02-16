import React, { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CostDashboardProps {
  open: boolean;
  onClose: () => void;
}

interface ModelRow {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  call_count: number;
  first_call: string;
  last_call: string;
}

interface Totals {
  total_cost: number;
  total_input: number;
  total_output: number;
  total_calls: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CostDashboard: React.FC<CostDashboardProps> = ({ open, onClose }) => {
  const [data, setData] = useState<{ byModel: ModelRow[]; totals: Totals } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        if (window.electronAPI?.db) {
          const result = await window.electronAPI.db.getApiUsageSummary();
          setData(result);
        }
      } catch (e) {
        console.error('Failed to load API usage:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const totals = data?.totals || { total_cost: 0, total_input: 0, total_output: 0, total_calls: 0 };
  const models = data?.byModel || [];

  // Find max cost for bar chart scaling
  const maxCost = Math.max(...models.map(m => m.cost_usd), 0.001);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[520px] max-h-[70vh] rounded-xl border border-wall-border bg-wall-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-wall-border">
          <div className="flex items-center gap-2">
            <span className="text-base">{'\uD83D\uDCB0'}</span>
            <span className="text-sm font-semibold text-wall-text">API Cost Dashboard</span>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-wall-subtle hover:text-wall-text text-sm"
          >{'\u2715'}</button>
        </div>

        {/* Summary cards */}
        <div className="shrink-0 grid grid-cols-4 gap-2 px-4 py-3">
          {[
            { label: 'Total Cost', value: fmtCost(totals.total_cost), color: '#f59e0b' },
            { label: 'API Calls', value: fmtTokens(totals.total_calls), color: '#6366f1' },
            { label: 'Input Tokens', value: fmtTokens(totals.total_input), color: '#3b82f6' },
            { label: 'Output Tokens', value: fmtTokens(totals.total_output), color: '#22c55e' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-wall-muted bg-wall-border/50 px-3 py-2 text-center">
              <div className="text-[9px] text-wall-subtle uppercase tracking-wide">{stat.label}</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Model breakdown */}
        <div className="flex-1 overflow-y-auto px-4 pb-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
          {loading ? (
            <div className="py-8 text-center text-[11px] text-wall-muted">{'\u23F3'} Loading usage data...</div>
          ) : models.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-wall-muted">No API usage recorded yet</div>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-wall-text-dim uppercase tracking-wide">By Model</div>
              {models.map((m) => (
                <div key={`${m.provider}-${m.model}`} className="rounded-lg border border-wall-muted bg-wall-border/30 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-[11px] font-semibold text-wall-text">{m.model}</span>
                      <span className="ml-2 text-[9px] text-wall-subtle">{m.provider}</span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-400">{fmtCost(m.cost_usd)}</span>
                  </div>
                  {/* Bar chart */}
                  <div className="h-[6px] rounded-full bg-wall-muted overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                      style={{ width: `${Math.max((m.cost_usd / maxCost) * 100, 2)}%` }}
                    />
                  </div>
                  <div className="flex gap-4 text-[9px] text-wall-subtle">
                    <span>{fmtTokens(m.call_count)} calls</span>
                    <span>{fmtTokens(m.input_tokens)} in</span>
                    <span>{fmtTokens(m.output_tokens)} out</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostDashboard;
