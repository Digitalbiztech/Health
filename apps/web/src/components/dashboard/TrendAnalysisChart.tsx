import { useState, useEffect } from 'react';
import { TrendingUp, Search, AlertTriangle, Info, X } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceArea,
} from 'recharts';
import type { Biomarker, CompleteReportData } from '@/types/dashboard';
import { STATUS_COLORS, CATEGORY_ICONS } from './constants';
import { cn } from '@/lib/utils';

interface TrendProps {
  biomarkers: Biomarker[];
  comparisonReports: CompleteReportData[];
}

export function TrendAnalysisChart({ biomarkers, comparisonReports }: TrendProps) {
  const [selectedMarker, setSelectedMarker] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  useEffect(() => {
    if (biomarkers.length > 0 && !selectedMarker) {
      setSelectedMarker(biomarkers[0].canonicalName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biomarkers]);

  // Gather trend points across comparison reports
  const trendData = comparisonReports
    .map((report) => {
      const marker = report.extraction?.biomarkers.find(b => b.canonicalName === selectedMarker);
      if (!marker) return null;
      return {
        date: new Date(report.reports[0]?.createdAt || 0).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: Number(marker.value),
        min: marker.referenceMin,
        max: marker.referenceMax,
      };
    })
    .filter((d): d is { date: string; value: number; min: number | null; max: number | null } => d !== null)
    .reverse(); // chronologically order

  const currentMarkerInfo = biomarkers.find(b => b.canonicalName === selectedMarker);

  // Filter biomarkers list
  const filteredBiomarkers = biomarkers.filter((b) => {
    const matchesSearch = b.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFlagged = !showFlaggedOnly || b.status !== 'NORMAL';
    return matchesSearch && matchesFlagged;
  });

  // Group filtered biomarkers by category
  const categoriesMap: Record<string, Biomarker[]> = {};
  filteredBiomarkers.forEach((b) => {
    if (!categoriesMap[b.category]) {
      categoriesMap[b.category] = [];
    }
    categoriesMap[b.category].push(b);
  });

  // Sort categories: put categories containing flagged/abnormal biomarkers first,
  // then sort alphabetically.
  const sortedCategories = Object.keys(categoriesMap).sort((a, b) => {
    const aHasFlagged = categoriesMap[a].some((x) => x.status !== 'NORMAL');
    const bHasFlagged = categoriesMap[b].some((x) => x.status !== 'NORMAL');
    if (aHasFlagged && !bHasFlagged) return -1;
    if (!aHasFlagged && bHasFlagged) return 1;
    return a.localeCompare(b);
  });

  // Sort biomarkers inside each category group: flagged/abnormal first, then alphabetical
  Object.keys(categoriesMap).forEach((cat) => {
    categoriesMap[cat].sort((a, b) => {
      const aFlagged = a.status !== 'NORMAL';
      const bFlagged = b.status !== 'NORMAL';
      if (aFlagged && !bFlagged) return -1;
      if (!aFlagged && bFlagged) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  });

  const flaggedCount = biomarkers.filter(b => b.status !== 'NORMAL').length;

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-6">
      {/* Header */}
      <div>
        <h4 className="text-base font-extrabold text-foreground tracking-tight">Biomarker Trend Analysis</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Track historical changes and analyze fluctuations across multiple reports.</p>
      </div>

      {/* 2-Column Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Column (3/10 width - 30%): Metric list grouped by category */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Controls: Search and Flagged Toggle */}
          <div className="flex flex-col gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search biomarkers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs border border-border/40 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--primary)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Toggle */}
            <button
              onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer bg-transparent",
                showFlaggedOnly
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Show Flagged Only</span>
              </div>
              {flaggedCount > 0 && (
                <span className={cn(
                  "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center",
                  showFlaggedOnly ? "bg-rose-500 text-white" : "bg-border/30 text-muted-foreground"
                )}>
                  {flaggedCount}
                </span>
              )}
            </button>
          </div>

          {/* List of Metric Categories & Rows */}
          <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[460px] pr-1.5 custom-scrollbar border border-border/10 rounded-xl p-2 bg-muted/5">
            {sortedCategories.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic text-center py-6">No biomarkers match filters.</p>
            ) : (
              sortedCategories.map((category) => {
                const categoryBiomarkers = categoriesMap[category];
                const CategoryIcon = CATEGORY_ICONS[category] || Info;
                const flaggedInCat = categoryBiomarkers.filter(x => x.status !== 'NORMAL').length;

                return (
                  <div key={category} className="flex flex-col gap-1.5">
                    {/* Category Header */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground bg-muted/20 dark:bg-muted/10 rounded-lg border border-border/10">
                      <div className="flex items-center gap-1.5">
                        <CategoryIcon className="w-3.5 h-3.5 text-[var(--primary-text)] opacity-75 shrink-0" />
                        <span className="truncate">{category}</span>
                      </div>
                      {flaggedInCat > 0 && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[8px] font-black border border-rose-500/20 shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {flaggedInCat}
                        </span>
                      )}
                    </div>

                    {/* Biomarkers inside Category */}
                    <div className="flex flex-col gap-1 pl-1">
                      {categoryBiomarkers.map((b) => {
                        const isSelected = b.canonicalName === selectedMarker;
                        const colors = STATUS_COLORS[b.status];
                        return (
                          <button
                            key={b.canonicalName}
                            onClick={() => setSelectedMarker(b.canonicalName)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer w-full text-xs font-semibold",
                              isSelected
                                ? "bg-[var(--primary)]/15 border-[var(--primary)]/30 text-[var(--primary-text)] font-bold shadow-sm"
                                : "bg-card/40 border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40 hover:bg-card"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Status Dot */}
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                                style={{ background: colors?.text || '#10b981' }}
                              />
                              <span className={cn(
                                "truncate",
                                isSelected ? "text-foreground font-extrabold" : "text-foreground/80 font-medium"
                              )}>
                                {b.displayName}
                              </span>
                            </div>
                            <div className="text-right shrink-0 ml-3 font-mono flex items-baseline gap-0.5">
                              <span className={cn(
                                "font-extrabold text-xs",
                                isSelected ? "text-[var(--primary-text)]" : "text-foreground/90"
                              )}>
                                {b.value}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-normal scale-90">{b.unit}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (7/10 width - 70%): Canvas & Chart */}
        <div className="lg:col-span-7 flex flex-col gap-5 border border-border/40 rounded-2xl p-5 bg-card/10">
          {currentMarkerInfo ? (
            <>
              {/* Selected Marker Header & Info Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/20">
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-base font-extrabold text-foreground tracking-tight">
                      {currentMarkerInfo.displayName}
                    </h5>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        background: STATUS_COLORS[currentMarkerInfo.status]?.bg,
                        color: STATUS_COLORS[currentMarkerInfo.status]?.text,
                      }}
                    >
                      {currentMarkerInfo.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Category: {currentMarkerInfo.category}</p>
                </div>
                
                <div className="flex flex-col items-end text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Optimal Reference Range</p>
                  <p className="text-xs font-extrabold text-foreground mt-0.5">{currentMarkerInfo.referenceRange}</p>
                </div>
              </div>

              {/* Description box if available */}
              {currentMarkerInfo.description && (
                <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10 text-[11px] text-muted-foreground leading-relaxed flex gap-2">
                  <Info className="w-4 h-4 text-[var(--primary-text)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-foreground">Clinical Summary: </span>
                    {currentMarkerInfo.description}
                  </div>
                </div>
              )}

              {/* Chart container */}
              {trendData.length < 2 ? (
                <div className="min-h-[240px] rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-3 p-6 text-center bg-muted/5">
                  <TrendingUp className="w-10 h-10 text-muted-foreground animate-float" />
                  <div>
                    <p className="font-bold text-sm text-foreground">Insufficient Historical Data</p>
                    <p className="text-xs mt-1 max-w-[280px] text-muted-foreground leading-normal font-medium">
                      Historical tracking for <strong className="text-foreground">{currentMarkerInfo.displayName}</strong> requires at least two completed lab reports.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-64 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.15} />
                      <XAxis
                        dataKey="date"
                        stroke="var(--muted-foreground)"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 'semibold' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 'semibold' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="glass-card rounded-xl p-3 border border-border/40 shadow-md text-xs bg-card">
                                <p className="font-extrabold text-foreground">{payload[0].payload.date}</p>
                                <p className="mt-1 font-extrabold text-[var(--primary-text)]">
                                  Value: {payload[0].value} {currentMarkerInfo.unit}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {/* Highlight normal range area */}
                      {currentMarkerInfo.referenceMin !== null && currentMarkerInfo.referenceMax !== null && (
                        <ReferenceArea
                          y1={currentMarkerInfo.referenceMin}
                          y2={currentMarkerInfo.referenceMax}
                          fill="#1A9966"
                          fillOpacity={0.06}
                        />
                      )}

                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--primary-text)"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 1.5, fill: 'var(--primary-text)', stroke: 'white' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="min-h-[300px] flex flex-col items-center justify-center text-center p-6 gap-3">
              <TrendingUp className="w-12 h-12 text-muted-foreground/60" />
              <div>
                <p className="font-bold text-sm text-foreground">No Biomarker Selected</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[260px] leading-normal font-medium">
                  Select a biomarker from the list on the left to track historical fluctuations.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
