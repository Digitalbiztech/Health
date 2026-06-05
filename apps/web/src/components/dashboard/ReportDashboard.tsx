import { useState, useRef } from 'react';
import {
  Stethoscope,
  FileText,
  TrendingUp,
  MessageSquare,
  SplitSquareVertical,
  ChevronRight,
  Droplet,
  X,
  Loader2,
  CheckCircle2,
  Circle,
  Upload,
  RotateCcw,
  Info,
  Heart,
  AlertTriangle,
  Activity,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { CompleteReportData } from '@/types/dashboard';
import { STATUS_COLORS, CATEGORY_ICONS } from './constants';
import { getEffectivePct } from './utils';
import { BiomarkerDetailDialog } from './BiomarkerDetailDialog';
import { TrendAnalysisChart } from './TrendAnalysisChart';
import { AIChat } from './AIChat';
import { ComparisonView } from './ComparisonView';

interface ReportDashboardProps {
  reportData: CompleteReportData;
  comparisonReports: CompleteReportData[];
  handleFileUpload: (file: File, compareSlot?: 'A' | 'B' | null) => Promise<void>;
  compareUploading: boolean;
  compareUploadSlot: 'A' | 'B' | null;
  compareReportA: CompleteReportData | null;
  setCompareReportA: (r: CompleteReportData | null) => void;
  compareReportB: CompleteReportData | null;
  setCompareReportB: (r: CompleteReportData | null) => void;
}

export function ReportDashboard({
  reportData,
  comparisonReports,
  handleFileUpload,
  compareUploading,
  compareUploadSlot,
  compareReportA,
  setCompareReportA,
  compareReportB,
  setCompareReportB,
}: ReportDashboardProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'trends' | 'ai-chat' | 'compare'>('current');
  const [currentSubTab, setCurrentSubTab] = useState<'clinical' | 'biomarker-analysis'>('clinical');
  const [selectedPanel, setSelectedPanel] = useState<string>('All');
  const [selectedBiomarkerDetail, setSelectedBiomarkerDetail] = useState<any>(null);
  const [compareDragging, setCompareDragging] = useState<'A' | 'B' | null>(null);

  const compareFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCompareSlotRef = useRef<'A' | 'B'>('A');

  const patient = reportData.patient;
  const biomarkers = reportData.extraction?.biomarkers || [];
  const normalBiomarkers = biomarkers.filter((b) => b.status === 'NORMAL');
  const flaggedBiomarkers = biomarkers.filter((b) => b.status !== 'NORMAL');
  const panels = ['All', ...Array.from(new Set(biomarkers.map((b) => b.category)))];

  const filteredBiomarkers = selectedPanel === 'All'
    ? biomarkers
    : biomarkers.filter((b) => b.category === selectedPanel);

  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (flaggedBiomarkers.length * 12.5))));
  const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';



  function renderCurrentReportTab() {
    // ── Sub-tab switcher ─────────────────────────────────────
    const subTabBar = (
      <div className="flex gap-2 p-1.5 rounded-xl border border-border/40 max-w-sm mb-6" style={{ background: 'var(--card)' }}>
        {[
          { id: 'clinical', label: 'Clinical Report', icon: FileText },
          { id: 'biomarker-analysis', label: 'Biomarker Analysis', icon: BarChart2 },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setCurrentSubTab(t.id as any)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 bg-transparent',
              currentSubTab === t.id
                ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>
    );

    if (currentSubTab === 'biomarker-analysis') {
      return renderBiomarkerAnalysis(subTabBar);
    }

    // ── Clinical Report (original grid) ─────────────────────
    return (
      <div className="flex flex-col gap-0">
        {subTabBar}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side — Flagged Summary & Pie Chart */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Diagnostics Summary
            </h4>

            {/* Diagnostics Summary health bar */}
            <div className="flex flex-col gap-3 mt-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-emerald-500">Optimal ({normalBiomarkers.length})</span>
                <span className="font-bold text-rose-500">Flagged ({flaggedBiomarkers.length})</span>
              </div>
              <div className="relative h-3 rounded-full bg-border/20 overflow-hidden flex">
                {normalBiomarkers.length > 0 && (
                  <div 
                    className="h-full bg-emerald-500/85 transition-all duration-500" 
                    style={{ width: `${(normalBiomarkers.length / biomarkers.length) * 100}%` }}
                    title={`${normalBiomarkers.length} Optimal`}
                  />
                )}
                {flaggedBiomarkers.length > 0 && (
                  <div 
                    className="h-full bg-rose-500/85 transition-all duration-500" 
                    style={{ width: `${(flaggedBiomarkers.length / biomarkers.length) * 100}%` }}
                    title={`${flaggedBiomarkers.length} Flagged`}
                  />
                )}
              </div>
              <div className="text-center mt-3">
                <span className="text-3xl font-extrabold text-foreground">
                  {biomarkers.length > 0 ? Math.round((normalBiomarkers.length / biomarkers.length) * 100) : 100}%
                </span>
                <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider mt-0.5">Optimal Biomarker Score</span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
              {flaggedBiomarkers.length === 0
                ? "Excellent! All monitored biological vectors are well-balanced within optimal physiological zones."
                : `We identified ${flaggedBiomarkers.length} biomarker values exhibiting deviance from standard reference values.`}
            </p>
          </div>

          {/* Flagged biomarker scrollbox */}
          {flaggedBiomarkers.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
              <h4 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center justify-between" style={{ color: 'var(--muted-foreground)' }}>
                <span>Anomaly List</span>
                <span className="text-xs bg-[#F04E14]/10 text-[#F04E14] px-2 py-0.5 rounded-full font-bold">
                  {flaggedBiomarkers.length} Alert{flaggedBiomarkers.length > 1 ? 's' : ''}
                </span>
              </h4>
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                {flaggedBiomarkers.map((b) => {
                  const colors = STATUS_COLORS[b.status];
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBiomarkerDetail(b)}
                      className="p-3 rounded-xl border border-border/40 hover:border-[var(--primary)] transition-all cursor-pointer flex items-center justify-between group bg-transparent"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-6 rounded-full" style={{ background: colors.text }} />
                        <div>
                          <p className="font-semibold text-xs" style={{ color: 'var(--foreground)' }}>
                            {b.displayName}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                            Ref: {b.referenceRange}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className="font-bold text-xs" style={{ color: colors.text }}>
                            {b.value} {b.unit}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                            {b.status}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side — Main Panel Workspace */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
            {/* Panel selector pills */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-border/40 pb-4">
              {panels.map((panel) => {
                const isSelected = selectedPanel === panel;
                const panelMarkers = panel === 'All' ? biomarkers : biomarkers.filter((b) => b.category === panel);
                const panelFlagged = panelMarkers.filter((b) => b.status !== 'NORMAL').length;

                return (
                  <button
                    key={panel}
                    onClick={() => setSelectedPanel(panel)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-2',
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-sm font-bold border-[var(--primary)]'
                        : 'border border-border/60 hover:bg-border/20 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>{panel === 'All' ? 'All Panels' : panel}</span>
                    {panelFlagged > 0 && (
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full bg-[#F04E14]',
                          isSelected ? 'bg-white' : ''
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Radar View (when All is selected) */}
            {/* Panel Health Overview (replacing Radar Chart) */}
            {selectedPanel === 'All' && (
              <div className="mb-6 border-b border-border/20 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Panel Health Index</h5>
                  <span className="text-[10px] text-muted-foreground">Optimal markers by category</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {panels
                    .filter((p) => p !== 'All')
                    .map((p) => {
                      const list = biomarkers.filter((b) => b.category === p);
                      const norm = list.filter((b) => b.status === 'NORMAL').length;
                      const score = Math.round((norm / list.length) * 100);

                      return (
                        <div key={p} className="flex items-center justify-between text-xs py-1">
                          <span className="font-semibold text-muted-foreground w-28 shrink-0">{p}</span>
                          <div className="flex-1 mx-3 h-2 rounded-full bg-border/20 overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${score}%`,
                                background: score >= 80 ? 'var(--status-normal)' : score >= 60 ? 'var(--status-low)' : 'var(--status-critical)' 
                              }}
                            />
                          </div>
                          <span className="font-bold text-foreground w-8 text-right">{score}%</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Biomarker list view — grouped by category */}
            {selectedPanel === 'All' ? (
              // Show categories grouped
              <div className="flex flex-col gap-8">
                {panels.filter(p => p !== 'All').map((category) => {
                  const catMarkers = biomarkers.filter(b => b.category === category);
                  if (catMarkers.length === 0) return null;
                  const catFlagged = catMarkers.filter(b => b.status !== 'NORMAL').length;
                  const CatIcon = CATEGORY_ICONS[category] || Droplet;
                  const catScore = Math.round(((catMarkers.length - catFlagged) / catMarkers.length) * 100);

                  return (
                    <div key={category}>
                      {/* Category header */}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/30">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-glow)' }}>
                            <CatIcon className="w-3.5 h-3.5" style={{ color: 'var(--primary-text)' }} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{category}</p>
                            <p className="text-[10px] text-muted-foreground">{catMarkers.length} marker{catMarkers.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                            <div className="w-16 h-1.5 rounded-full bg-border/30 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${catScore}%`,
                                  background: catScore >= 80 ? '#1A9966' : catScore >= 60 ? '#C97D0A' : '#F04E14',
                                }}
                              />
                            </div>
                            <span className={catScore >= 80 ? 'text-green-500' : catScore >= 60 ? 'text-yellow-500' : 'text-red-500'}>
                              {catScore}%
                            </span>
                          </div>
                          {catFlagged > 0 && (
                            <span className="text-[9px] bg-[#F04E14]/10 text-[#F04E14] px-2 py-0.5 rounded-full font-bold">
                              {catFlagged} alert{catFlagged > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cards grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catMarkers.map((b) => {
                          const colors = STATUS_COLORS[b.status];
                          const Icon = CATEGORY_ICONS[b.category] || Droplet;
                          const effectivePct = getEffectivePct(b);
                          return (
                            <div
                              key={b.id}
                              className="p-4 rounded-xl border border-border/40 hover:border-[var(--primary)]/60 hover:shadow-md transition-all flex flex-col gap-3 group bg-card"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: colors.bg }}>
                                    <Icon className="w-4 h-4" style={{ color: colors.text }} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-xs" style={{ color: 'var(--foreground)' }}>{b.displayName}</p>
                                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{b.value} {b.unit}</p>
                                  </div>
                                </div>
                                <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold" style={{ background: colors.bg, color: colors.text }}>
                                  {b.status}
                                </span>
                              </div>

                              {/* Zone slider bar */}
                              <div>
                                <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>
                                  <span>Low</span>
                                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{b.value} {b.unit}</span>
                                  <span>High</span>
                                </div>
                                <div className="relative h-2 rounded-full overflow-hidden bg-border/40 flex">
                                  <div className="h-full w-[20%]" style={{ background: 'rgba(201, 125, 10, 0.25)' }} />
                                  <div className="h-full w-[60%] border-x border-border/40" style={{ background: 'rgba(26, 153, 102, 0.25)' }} />
                                  <div className="h-full w-[20%]" style={{ background: 'rgba(240, 78, 20, 0.25)' }} />
                                  <div
                                    className="absolute w-3.5 h-3.5 -top-0.5 rounded-full border border-white shadow transition-all duration-500"
                                    style={{ left: `calc(${effectivePct}% - 7px)`, background: colors.text }}
                                  />
                                </div>
                                <div className="flex justify-between text-[8px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                  <span>Min: {b.referenceMin ?? '0'}</span>
                                  <span>Ref: {b.referenceRange}</span>
                                  <span>Max: {b.referenceMax ?? 'N/A'}</span>
                                </div>
                              </div>

                              {/* Details button */}
                              <button
                                onClick={() => setSelectedBiomarkerDetail(b)}
                                className="w-full py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border border-border/40 hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/5 transition-all bg-transparent text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
                              >
                                <Info className="w-3 h-3" />
                                View Details
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Single panel selected
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBiomarkers.map((b) => {
                  const colors = STATUS_COLORS[b.status];
                  const Icon = CATEGORY_ICONS[b.category] || Droplet;
                  const effectivePct = getEffectivePct(b);

                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-border/40 hover:border-[var(--primary)]/60 hover:shadow-md transition-all flex flex-col gap-3 group bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                            style={{ background: colors.bg }}
                          >
                            <Icon className="w-4 h-4" style={{ color: colors.text }} />
                          </div>
                          <div>
                            <p className="font-bold text-xs" style={{ color: 'var(--foreground)' }}>{b.displayName}</p>
                            <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{b.category}</p>
                          </div>
                        </div>
                        <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold" style={{ background: colors.bg, color: colors.text }}>
                          {b.status}
                        </span>
                      </div>

                      {/* Zone slider bar */}
                      <div>
                        <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>
                          <span>Low</span>
                          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{b.value} {b.unit}</span>
                          <span>High</span>
                        </div>
                        <div className="relative h-2 rounded-full overflow-hidden bg-border/40 flex">
                          <div className="h-full w-[20%]" style={{ background: 'rgba(201, 125, 10, 0.25)' }} />
                          <div className="h-full w-[60%] border-x border-border/40" style={{ background: 'rgba(26, 153, 102, 0.25)' }} />
                          <div className="h-full w-[20%]" style={{ background: 'rgba(240, 78, 20, 0.25)' }} />
                          <div
                            className="absolute w-3.5 h-3.5 -top-0.5 rounded-full border border-white shadow transition-all duration-500"
                            style={{ left: `calc(${effectivePct}% - 7px)`, background: colors.text }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                          <span>Min: {b.referenceMin ?? '0'}</span>
                          <span>Optimal: {b.referenceRange}</span>
                          <span>Max: {b.referenceMax ?? 'N/A'}</span>
                        </div>
                      </div>

                      {/* Details button */}
                      <button
                        onClick={() => setSelectedBiomarkerDetail(b)}
                        className="w-full py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border border-border/40 hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/5 transition-all bg-transparent text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
                      >
                        <Info className="w-3 h-3" />
                        View Details
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  }

  function renderBiomarkerAnalysis(subTabBar: React.ReactNode) {
    // Data processing
    const categories = panels.filter(p => p !== 'All');
    const systemMap: Record<string, { color: string }> = {
      CBC: { color: '#10b981' }, Blood: { color: '#10b981' },
      Metabolic: { color: '#f59e0b' }, 'Lipid Panel': { color: '#3b82f6' },
      Hormones: { color: '#8b5cf6' }, Thyroid: { color: '#8b5cf6' },
      'Vitamins & Minerals': { color: '#ec4899' }, Nutrients: { color: '#ec4899' },
    };
    const systemBars = categories.map(cat => {
      const catM = biomarkers.filter(b => b.category === cat);
      const score = catM.length ? Math.round((catM.filter(b => b.status === 'NORMAL').length / catM.length) * 100) : 0;
      const color = systemMap[cat]?.color || 'var(--primary-text)';
      const blocks = 14;
      return { label: cat.toUpperCase(), score, color, filled: Math.round((score / 100) * blocks), blocks };
    });


    // Normalized systemic profile data
    const profileData = biomarkers.map(b => {
      let yVal = 2.2;
      if (b.status === 'LOW') yVal = 1.1;
      else if (b.status === 'HIGH') yVal = 3.1;
      else if (b.status === 'CRITICAL') {
        yVal = (b.referenceMin != null && b.value < b.referenceMin) ? 0.5 : 3.6;
      }
      const catColor = systemMap[b.category]?.color || 'var(--primary-text)';
      return { name: b.displayName, val: yVal, color: catColor, status: b.status };
    });

    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {subTabBar}

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'HEALTH SCORE', val: healthScore, unit: '/100', Icon: Heart, color: healthScore >= 80 ? '#1A9966' : healthScore >= 60 ? '#C97D0A' : '#F04E14', sub: 'OVERALL' },
            { label: 'BIOMARKERS', val: biomarkers.length, unit: `/${categories.length} panels`, Icon: Activity, color: 'var(--primary-text)', sub: 'TESTED' },
            { label: 'FLAGGED', val: flaggedBiomarkers.length, unit: `/${biomarkers.length}`, Icon: AlertTriangle, color: flaggedBiomarkers.length === 0 ? '#1A9966' : '#F04E14', sub: 'NEEDS REVIEW' },
          ].map(kpi => (
            <div key={kpi.label} className="glass-card rounded-2xl p-5 border border-border/40 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                <kpi.Icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold" style={{ color: kpi.color }}>{kpi.val}</span>
                <span className="text-xs text-muted-foreground">{kpi.unit}</span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.sub}</p>
              <div className="h-1 rounded-full mt-1" style={{ background: `linear-gradient(90deg, ${kpi.color}, transparent)`, opacity: 0.5 }} />
            </div>
          ))}
        </div>

        {/* Body System Status */}
        <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="text-sm font-bold text-foreground">Body System Status</h4>
              <p className="text-[10px] text-muted-foreground">Wellness score across each diagnostic panel</p>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">SCORE BY PANEL</span>
          </div>
          <div className="flex flex-col gap-4">
            {systemBars.map(sys => (
              <div key={sys.label} className="flex items-center gap-4">
                <span className="text-[9px] font-bold w-32 shrink-0 tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{sys.label}</span>
                <div className="flex gap-[3px] flex-1">
                  {Array.from({ length: sys.blocks }).map((_, idx) => (
                    <div key={idx} className="flex-1 h-3.5 rounded-sm transition-all" style={{ background: idx < sys.filled ? sys.color : 'rgba(255,255,255,0.05)' }} />
                  ))}
                </div>
                <span className="text-xs font-bold w-10 text-right" style={{ color: sys.color }}>{sys.score}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categories + Things to Watch */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Health Breakdown */}
          <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-foreground">Category Health Breakdown</h4>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Normal / Flagged</span>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[160px] pr-1.5 custom-scrollbar">
                {categories.map((cat) => {
                  const catMarkers = biomarkers.filter(b => b.category === cat);
                  const catNormal = catMarkers.filter(b => b.status === 'NORMAL').length;
                  const catFlagged = catMarkers.length - catNormal;
                  const normalPct = (catNormal / catMarkers.length) * 100;
                  const flaggedPct = (catFlagged / catMarkers.length) * 100;

                  return (
                    <div key={cat} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-foreground truncate max-w-[120px]">{cat}</span>
                        <span className="text-[9px] text-muted-foreground font-medium">
                          {catNormal}/{catMarkers.length} Normal
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-border/20 overflow-hidden flex">
                        {catNormal > 0 && (
                          <div 
                            className="h-full bg-emerald-500/85 transition-all duration-500" 
                            style={{ width: `${normalPct}%` }}
                            title={`${catNormal} Normal`}
                          />
                        )}
                        {catFlagged > 0 && (
                          <div 
                            className="h-full bg-rose-500/85 transition-all duration-500" 
                            style={{ width: `${flaggedPct}%` }}
                            title={`${catFlagged} Flagged`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-border/20 mt-4 pt-3 flex justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-muted-foreground"><strong className="text-foreground">{normalBiomarkers.length}</strong> Optimal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-muted-foreground"><strong className="text-foreground">{flaggedBiomarkers.length}</strong> Attention</span>
              </div>
            </div>
          </div>

          {/* Things to Watch */}
          <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-3">
            <h4 className="text-sm font-bold text-foreground">Things to Watch</h4>
            {flaggedBiomarkers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
                <p className="text-xs text-muted-foreground text-center">Excellent! All biomarkers are within optimal range.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[280px] custom-scrollbar">
                {flaggedBiomarkers.map(b => {
                  const color = b.status === 'CRITICAL' ? '#D41717' : b.status === 'HIGH' ? '#F04E14' : '#C97D0A';
                  const pct = b.referenceMin != null && b.referenceMax != null
                    ? Math.max(5, Math.min(95, ((b.value - b.referenceMin) / (b.referenceMax - b.referenceMin)) * 100))
                    : b.status === 'HIGH' ? 85 : 15;
                  return (
                    <div key={b.id} className="p-3.5 rounded-xl border border-border/40 bg-card/60 flex flex-col gap-2.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5" style={{ color }} />
                          <span className="font-extrabold text-xs text-foreground">{b.displayName}</span>
                        </div>
                        <span className="font-extrabold text-xs" style={{ color }}>{b.value} {b.unit}</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-[8px] mb-1 text-muted-foreground">
                          <span>Low</span><span className="font-semibold text-foreground">Normal</span><span>High</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-border/30 flex overflow-hidden">
                          <div className="h-full w-[25%]" style={{ background: 'rgba(201,125,10,0.2)' }} />
                          <div className="h-full w-[50%]" style={{ background: 'rgba(26,153,102,0.2)' }} />
                          <div className="h-full w-[25%]" style={{ background: 'rgba(240,78,20,0.2)' }} />
                          <div className="absolute w-3.5 h-3.5 -top-[3px] rounded-full border border-white shadow" style={{ left: `calc(${pct}% - 7px)`, background: color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Systemic Biomarker Profile */}
        <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h4 className="text-sm font-bold text-foreground">Systemic Biomarker Profile & Reference Zones</h4>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">NORMALIZED RANGE PROFILES ACROSS {categories.length} DIAGNOSTIC CATEGORIES</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-end">
              {['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ec4899'].map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  {['Blood','Metabolic','Lipid','Hormones','Nutrients'][i]}
                </span>
              ))}
            </div>
          </div>
          <div className="h-52 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profileData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 8 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 4]} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
                  tickFormatter={(v) => (['','Very Low','Low','','Optimal','','High','Elevated'][Math.round(v * 2)] || '')}
                  ticks={[0.5, 1.1, 2.2, 3.1, 3.6]}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="glass-card rounded-xl p-2.5 border border-border/40 shadow text-xs bg-card">
                        <p className="font-bold text-foreground">{payload[0]?.payload?.name}</p>
                        <p className="text-muted-foreground mt-0.5">Status: <span className="font-semibold text-foreground">{payload[0]?.payload?.status}</span></p>
                      </div>
                    ) : null
                  }
                />
                <ReferenceLine y={0.5} stroke="rgba(239,68,68,0.15)" strokeDasharray="3 3" />
                <ReferenceLine y={1.1} stroke="rgba(245,158,11,0.15)" strokeDasharray="3 3" />
                <ReferenceLine y={2.2} stroke="rgba(16,185,129,0.2)" strokeDasharray="3 3" label={{ value: 'Optimal', position: 'right', fill: '#10b981', fontSize: 8 }} />
                <ReferenceLine y={3.1} stroke="rgba(245,158,11,0.15)" strokeDasharray="3 3" />
                <ReferenceLine y={3.6} stroke="rgba(239,68,68,0.15)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="val" stroke="var(--primary-text)" strokeWidth={2.5} dot={(props: any) => {
                  const c = props.payload?.color || 'var(--primary-text)';
                  return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill={c} stroke="white" strokeWidth={1.5} />;
                }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span><strong className="text-foreground">Clinical Guide:</strong> Dots represent normalized status. The Optimal zone (center band) is the target reference region.</span>
            </div>
            <span className="text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--primary-glow)', color: 'var(--primary-text)' }}>100% NORMALIZED</span>
          </div>
        </div>
      </div>
    );
  }

  function renderCompareTab(available: CompleteReportData[]) {
    const bothReady = compareReportA !== null && compareReportB !== null;

    // Slot picker helper
    const SlotPicker = ({
      slot,
      selected,
      onSelect,
      onClear,
    }: {
      slot: 'A' | 'B';
      selected: CompleteReportData | null;
      onSelect: (r: CompleteReportData) => void;
      onClear: () => void;
    }) => {
      const otherSelected = slot === 'A' ? compareReportB : compareReportA;
      const isUploading = compareUploading && compareUploadSlot === slot;
      const isPolling = !compareUploading && compareUploadSlot === slot;
      const dragActive = compareDragging === slot;

      return (
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Slot header */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black"
                style={{ background: slot === 'A' ? 'var(--primary-text)' : 'var(--primary)' }}
              >
                {slot}
              </span>
              Report {slot}
            </p>
            {selected && (
              <button
                onClick={onClear}
                className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 hover:underline bg-transparent border-0"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Polling spinner */}
          {isPolling && (
            <div className="glass-card rounded-xl p-4 border-border/40 flex items-center gap-3 border">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--primary-text)] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Analyzing Report {slot}…</p>
                <p className="text-[10px] text-muted-foreground">Usually 15–30 seconds.</p>
              </div>
            </div>
          )}

          {/* Selected report pill */}
          {selected && !isPolling && (
            <div
              className="flex items-center gap-2.5 p-3 rounded-xl border-2 text-xs"
              style={{
                borderColor: slot === 'A' ? 'var(--primary-text)' : 'var(--primary)',
                background: slot === 'A' ? 'rgba(138,122,106,0.08)' : 'var(--primary-glow)',
              }}
            >
              <FileText className="w-4 h-4 shrink-0" style={{ color: slot === 'A' ? 'var(--primary-text)' : 'var(--primary)' }} />
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{selected.fileName}</p>
                {selected.reports?.[0]?.createdAt && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(selected.reports[0].createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <CheckCircle2 className="w-4 h-4 shrink-0 ml-auto" style={{ color: slot === 'A' ? 'var(--primary-text)' : 'var(--primary)' }} />
            </div>
          )}

          {/* Available reports list */}
          {!isPolling && (
            <div className="flex flex-col gap-2">
              {available.map((r) => {
                const isSelected = selected?.id === r.id;
                const isUsedByOther = otherSelected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    disabled={isUsedByOther}
                    onClick={() => onSelect(r)}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-xl border text-xs text-left transition-all cursor-pointer w-full',
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-foreground'
                        : isUsedByOther
                          ? 'border-border/30 opacity-40 cursor-not-allowed'
                          : 'border-border/50 hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/5 text-foreground'
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: isSelected ? 'var(--primary-glow)' : 'var(--primary-glow)' }}
                    >
                      <FileText className="w-4 h-4 text-[var(--primary-text)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{r.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.extraction?.biomarkers?.length ?? 0} markers
                        {r.reports?.[0]?.createdAt
                          ? ' · ' +
                          new Date(r.reports[0].createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                          : ''}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[var(--primary-text)] shrink-0" />}
                    {isUsedByOther && <span className="text-[9px] text-muted-foreground shrink-0">In use</span>}
                  </button>
                );
              })}

              {/* Upload new option */}
              <div
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-xl border-2 border-dashed text-xs transition-all cursor-pointer group',
                  dragActive ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-border/50 hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/5'
                )}
                onClick={() => {
                  pendingCompareSlotRef.current = slot;
                  compareFileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setCompareDragging(slot);
                }}
                onDragLeave={() => setCompareDragging(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setCompareDragging(null);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileUpload(f, slot);
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: 'var(--primary-glow)' }}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-text)]" />
                  ) : (
                    <Upload className="w-4 h-4 text-[var(--primary-text)]" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {isUploading ? 'Uploading…' : 'Upload new PDF'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">PDF only · Max 20MB</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    if (bothReady) {
      return (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <SplitSquareVertical className="w-5 h-5 text-[var(--primary-text)]" />
              Report Comparison
            </h4>
            <button
              onClick={() => {
                setCompareReportA(null);
                setCompareReportB(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border/60 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-border/20 transition-all bg-transparent"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Change Reports
            </button>
          </div>
          <ComparisonView reportA={compareReportA} reportB={compareReportB} />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        {/* Shared hidden file input */}
        <input
          type="file"
          ref={compareFileInputRef}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, pendingCompareSlotRef.current);
            e.target.value = '';
          }}
          accept=".pdf"
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
          >
            <SplitSquareVertical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Select Two Reports to Compare</h4>
            <p className="text-xs text-muted-foreground">
              Pick from previous uploads or drop a new PDF. Both slots must be filled to run the comparison.
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-border/10 border border-border/40">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: compareReportA ? '#1A9966' : 'var(--muted-foreground)' }}
          >
            {compareReportA ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />} Report A
          </span>
          <div className="flex-1 h-0.5 rounded-full bg-border" />
          <span
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: compareReportB ? '#1A9966' : 'var(--muted-foreground)' }}
          >
            {compareReportB ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />} Report B
          </span>
          <div className="flex-1 h-0.5 rounded-full bg-border" />
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <SplitSquareVertical className="w-4 h-4" /> Compare
          </span>
        </div>

        {/* Two slot pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <SlotPicker
            slot="A"
            selected={compareReportA}
            onSelect={setCompareReportA}
            onClear={() => setCompareReportA(null)}
          />
          <SlotPicker
            slot="B"
            selected={compareReportB}
            onSelect={setCompareReportB}
            onClear={() => setCompareReportB(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* ── Patient Banner ─────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
          >
            <Stethoscope className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {pName}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {patient?.gender} · DOB: {patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-3 justify-center w-full lg:w-auto">
          {[
            { label: 'Total Markers', val: biomarkers.length },
            { label: 'Normal', val: normalBiomarkers.length },
            { label: 'Flagged', val: flaggedBiomarkers.length },
            { label: 'Panels', val: panels.length - 1 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-4 py-2 rounded-xl text-center border"
              style={{
                background: 'rgba(212, 189, 173, 0.1)',
                borderColor: 'var(--primary-glow)',
              }}
            >
              <p className="text-lg font-bold" style={{ color: 'var(--primary-text)' }}>{stat.val}</p>
              <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <img
          src="/logo/YC_Letterform_WG.png"
          alt="YC Letterform Logo"
          className="h-10 w-auto object-contain shrink-0 mx-4 hidden lg:block"
        />

        {/* Health Score Ring */}
        <div className="flex items-center gap-4 w-full lg:w-auto justify-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border/20"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3.5"
                strokeDasharray={`${healthScore}, 100`}
                strokeLinecap="round"
                stroke={healthScore >= 80 ? '#1A9966' : healthScore >= 60 ? '#C97D0A' : '#F04E14'}
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              {healthScore}%
            </span>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Health Score</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {healthScore >= 80 ? 'Excellent lab results' : healthScore >= 60 ? 'Moderate anomalies' : 'Action recommended'}
            </p>
          </div>
        </div>
      </section>

      {/* ── Workspace Tab Selector ─────────────────────────── */}
      <section className="flex gap-2 p-1.5 rounded-xl border border-border/40 mb-8" style={{ background: 'var(--card)' }}>
        {[
          { id: 'current', label: 'Current Report', icon: FileText },
          { id: 'trends', label: 'Trends', icon: TrendingUp },
          { id: 'ai-chat', label: 'AI Care', icon: MessageSquare },
          { id: 'compare', label: 'Compare', icon: SplitSquareVertical },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id !== 'compare') {
                setCompareReportA(null);
                setCompareReportB(null);
              }
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 bg-transparent',
              activeTab === tab.id
                ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </section>

      {/* ── Tab Content ────────────────────────────────────── */}
      {activeTab === 'current' && renderCurrentReportTab()}
      {activeTab === 'trends' && <TrendAnalysisChart biomarkers={biomarkers} comparisonReports={comparisonReports} />}
      {activeTab === 'ai-chat' && <AIChat biomarkers={biomarkers} patient={patient} />}
      {activeTab === 'compare' &&
        renderCompareTab(
          [reportData, ...comparisonReports]
            .filter((r): r is CompleteReportData => r !== null)
            .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
        )}

      {/* Detail Dialog Popup */}
      {selectedBiomarkerDetail && (
        <BiomarkerDetailDialog
          biomarker={selectedBiomarkerDetail}
          onClose={() => setSelectedBiomarkerDetail(null)}
        />
      )}
    </div>
  );
}
