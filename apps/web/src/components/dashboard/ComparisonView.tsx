import { useState } from 'react';
import { FileText, X, ArrowUp, ArrowDown, ArrowRight, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Biomarker, CompleteReportData } from '@/types/dashboard';
import { STATUS_COLORS } from './constants';

type ChangeKind = 'improved' | 'worsened' | 'stable' | 'new' | 'resolved';

interface DeltaRow {
  canonicalName: string;
  displayName: string;
  category: string;
  aValue: number | null;
  bValue: number | null;
  aStatus: Biomarker['status'] | null;
  bStatus: Biomarker['status'] | null;
  unit: string;
  delta: number | null;
  change: ChangeKind;
}

function classifyChange(a: Biomarker | undefined, b: Biomarker | undefined): ChangeKind {
  if (!a) return 'new';
  if (!b) return 'resolved';
  const aFlagged = a.status !== 'NORMAL';
  const bFlagged = b.status !== 'NORMAL';
  if (aFlagged && !bFlagged) return 'improved';
  if (!aFlagged && bFlagged) return 'worsened';
  return 'stable';
}

const CHANGE_STYLE: Record<ChangeKind, { label: string; bg: string; text: string; icon: any }> = {
  improved:  { label: 'Improved',  bg: 'rgba(26,153,102,0.1)',  text: '#1A9966', icon: ArrowDown   },
  worsened:  { label: 'Worsened',  bg: 'rgba(240,78,20,0.1)',   text: '#F04E14', icon: ArrowUp     },
  stable:    { label: 'Stable',    bg: 'var(--primary-glow)', text: 'var(--primary-text)', icon: ArrowRight  },
  new:       { label: 'New',       bg: 'rgba(201,125,10,0.12)', text: '#C97D0A', icon: Plus        },
  resolved:  { label: 'Resolved',  bg: 'rgba(26,153,102,0.12)', text: '#1A9966', icon: Minus       },
};

interface ComparisonViewProps {
  reportA: CompleteReportData;
  reportB: CompleteReportData;
}

export function ComparisonView({ reportA, reportB }: ComparisonViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [changeFilter, setChangeFilter] = useState<ChangeKind | 'All'>('All');

  const bmsA = reportA.extraction?.biomarkers ?? [];
  const bmsB = reportB.extraction?.biomarkers ?? [];

  // Determine which is chronologically earlier
  const dateA = new Date(reportA.reports?.[0]?.createdAt || reportA.fileName);
  const dateB = new Date(reportB.reports?.[0]?.createdAt || reportB.fileName);
  const isANewer = dateA >= dateB;
  // Always label as Before → After
  const [before, after] = isANewer ? [bmsB, bmsA] : [bmsA, bmsB];
  const [beforeReport, afterReport] = isANewer ? [reportB, reportA] : [reportA, reportB];

  // Build delta rows from the full marker union
  const allNames = Array.from(new Set([...before.map(b => b.canonicalName), ...after.map(b => b.canonicalName)]));
  const rows: DeltaRow[] = allNames.map(name => {
    const bm = before.find(b => b.canonicalName === name);
    const am = after.find(b => b.canonicalName === name);
    const ref = am ?? bm!;
    const delta = (am && bm) ? am.value - bm.value : null;
    return {
      canonicalName: name,
      displayName: ref.displayName,
      category: ref.category,
      aValue: bm?.value ?? null,
      bValue: am?.value ?? null,
      aStatus: bm?.status ?? null,
      bStatus: am?.status ?? null,
      unit: ref.unit,
      delta,
      change: classifyChange(bm, am),
    };
  });

  // Summary counts
  const counts = { improved: 0, worsened: 0, stable: 0, new: 0, resolved: 0 };
  rows.forEach(r => counts[r.change]++);

  const categories = ['All', ...Array.from(new Set(rows.map(r => r.category)))];
  const filtered = rows.filter(r =>
    (categoryFilter === 'All' || r.category === categoryFilter) &&
    (changeFilter === 'All' || r.change === changeFilter),
  );

  // Sort: worsened first, then improved, then new, then stable, then resolved
  const SORT_ORDER: Record<ChangeKind, number> = { worsened: 0, improved: 1, new: 2, stable: 3, resolved: 4 };
  filtered.sort((a, b) => SORT_ORDER[a.change] - SORT_ORDER[b.change]);

  const statusBadge = (status: Biomarker['status'] | null) => {
    if (!status) return null;
    const c = STATUS_COLORS[status];
    return (
      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>
        {status}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Report headers */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { report: beforeReport, label: 'Before' },
          { report: afterReport, label: 'After' },
        ].map(({ report, label }) => (
          <div
            key={report.id}
            className="glass-card rounded-xl p-4 border-border/40 shadow-sm flex items-center gap-3"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: label === 'After' ? 'rgba(26,153,102,0.15)' : 'var(--primary-glow)' }}
            >
              <FileText className="w-4.5 h-4.5" style={{ color: label === 'After' ? '#1A9966' : 'var(--primary-text)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-xs font-semibold text-foreground truncate">{report.fileName}</p>
              <p className="text-[10px] text-muted-foreground">
                {report.reports?.[0]?.createdAt
                  ? new Date(report.reports[0].createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(counts) as [ChangeKind, number][]).map(([kind, count]) => {
          const s = CHANGE_STYLE[kind];
          const Icon = s.icon;
          const active = changeFilter === kind;
          return (
            <button
              key={kind}
              onClick={() => setChangeFilter(active ? 'All' : kind)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border"
              style={{
                background: active ? s.bg : 'transparent',
                color: active ? s.text : 'var(--muted-foreground)',
                borderColor: active ? s.text + '55' : 'var(--border)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: s.bg, color: s.text }}
              >
                {count}
              </span>
            </button>
          );
        })}
        {changeFilter !== 'All' && (
          <button
            onClick={() => setChangeFilter('All')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground border border-border/60 cursor-pointer hover:text-foreground"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border',
              categoryFilter === cat
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-border/20',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Delta table */}
      <div className="glass-card rounded-2xl border-border/40 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr] gap-0 border-b border-border/40 px-4 py-3 bg-border/10">
          {['Biomarker', 'Before', 'After', 'Δ Change', 'Status'].map(h => (
            <p key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</p>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No biomarkers match your filters.</p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[520px] overflow-y-auto custom-scrollbar">
            {filtered.map((row, idx) => {
              const s = CHANGE_STYLE[row.change];
              const Icon = s.icon;
              const deltaAbs = row.delta !== null ? Math.abs(row.delta) : null;
              const deltaSign = row.delta !== null ? (row.delta > 0 ? '+' : row.delta < 0 ? '' : '±') : null;
              return (
                <div
                  key={row.canonicalName}
                  className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr] gap-0 px-4 py-3 items-center hover:bg-border/10 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${idx * 0.025}s` }}
                >
                  {/* Biomarker name + category */}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{row.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">{row.category}</p>
                  </div>

                  {/* Before value */}
                  <div>
                    {row.aValue !== null ? (
                      <p className="text-xs font-mono text-foreground">
                        {row.aValue} <span className="text-muted-foreground">{row.unit}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">—</p>
                    )}
                    {statusBadge(row.aStatus)}
                  </div>

                  {/* After value */}
                  <div>
                    {row.bValue !== null ? (
                      <p className="text-xs font-mono text-foreground">
                        {row.bValue} <span className="text-muted-foreground">{row.unit}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">—</p>
                    )}
                    {statusBadge(row.bStatus)}
                  </div>

                  {/* Delta */}
                  <div>
                    {row.delta !== null ? (
                      <p className="text-xs font-mono font-semibold" style={{ color: s.text }}>
                        {deltaSign}{deltaAbs?.toFixed(2)} {row.unit}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">N/A</p>
                    )}
                  </div>

                  {/* Change badge */}
                  <div>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: s.bg, color: s.text }}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
