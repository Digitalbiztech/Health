import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
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

interface TrendProps {
  biomarkers: Biomarker[];
  comparisonReports: CompleteReportData[];
}

export function TrendAnalysisChart({ biomarkers, comparisonReports }: TrendProps) {
  const [selectedMarker, setSelectedMarker] = useState<string>('');

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

  return (
    <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h4 className="text-base font-bold text-foreground">Biomarker Trend Lines</h4>
          <p className="text-xs text-muted-foreground">Select a biomarker to track your metabolic fluctuations over time.</p>
        </div>
        
        {/* Dropdown selector */}
        <select
          value={selectedMarker}
          onChange={(e) => setSelectedMarker(e.target.value)}
          className="text-xs border border-border p-2 rounded-xl bg-card text-foreground font-semibold"
        >
          {biomarkers.map((b) => (
            <option key={b.canonicalName} value={b.canonicalName}>
              {b.displayName}
            </option>
          ))}
        </select>
      </div>

      {trendData.length < 2 ? (
        <div className="min-h-[220px] rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <TrendingUp className="w-10 h-10 text-muted-foreground animate-float" />
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Insufficient Data</p>
            <p className="text-xs mt-0.5 max-w-[260px]" style={{ color: 'var(--muted-foreground)' }}>
              Historical charts require at least two completed lab reports. Upload another file to begin tracking metrics.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" tick={{ fontSize: 9 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 9 }} />
              <RechartsTooltip content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="glass-card rounded-xl p-3 border border-border/40 shadow-md text-xs bg-card">
                      <p className="font-bold text-foreground">{payload[0].payload.date}</p>
                      <p className="mt-1 font-semibold text-[var(--primary-text)]">
                        Value: {payload[0].value} {currentMarkerInfo?.unit}
                      </p>
                    </div>
                  );
                }
                return null;
              }} />
              
              {/* Highlight normal range area if min & max exist */}
              {currentMarkerInfo && currentMarkerInfo.referenceMin !== null && currentMarkerInfo.referenceMax !== null && (
                <ReferenceArea
                  y1={currentMarkerInfo.referenceMin ?? undefined}
                  y2={currentMarkerInfo.referenceMax ?? undefined}
                  fill="#1A9966"
                  fillOpacity={0.08}
                />
              )}

              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--primary-text)"
                strokeWidth={3}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
