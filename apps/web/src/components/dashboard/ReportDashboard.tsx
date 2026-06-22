import { useState, useRef } from 'react';
import {
  FileText,
  TrendingUp,
  MessageSquare,
  SplitSquareVertical,
  // ChevronRight,
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
  Search,
  Terminal,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  // AreaChart,
  // Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { CompleteReportData } from '@/types/dashboard';
import { STATUS_COLORS, CATEGORY_ICONS } from './constants';
import { getEffectivePct, getSliderTrack } from './utils';
import { BiomarkerDetailDialog } from './BiomarkerDetailDialog';
import { TrendAnalysisChart } from './TrendAnalysisChart';
import { AIChat } from './AIChat';
import { ComparisonView } from './ComparisonView';
import { ClinicalSection } from './ClinicalSection';
import { useBranding } from '@/hooks/useBranding';

const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const v = payload.value;
  
  let text = '';
  let color = 'var(--muted-foreground)';
  
  if (v === 0.5) {
    text = 'Very Low';
    color = '#f43f5e';
  } else if (v === 1.1) {
    text = 'Low';
    color = '#fbbf24';
  } else if (v === 2.2) {
    text = 'Optimal';
    color = '#10b981';
  } else if (v === 3.1) {
    text = 'High';
    color = '#fbbf24';
  } else if (v === 3.6) {
    text = 'Elevated';
    color = '#f43f5e';
  }
  
  return (
    <text
      x={x - 8}
      y={y}
      dy={3}
      textAnchor="end"
      fill={color}
      fontSize={8}
      fontWeight="bold"
    >
      {text}
    </text>
  );
};

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
  isSampleReport?: boolean;
  onUploadClick?: () => void;
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
  isSampleReport = false,
  onUploadClick,
}: ReportDashboardProps) {
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState<'current' | 'trends' | 'ai-chat' | 'compare'>('current');
  const [currentSubTab, setCurrentSubTab] = useState<'clinical' | 'biomarker-analysis'>('clinical');
  const [selectedPanel, setSelectedPanel] = useState<string>('All');
  const [selectedBiomarkerDetail, setSelectedBiomarkerDetail] = useState<any>(null);
  const [compareDragging, setCompareDragging] = useState<'A' | 'B' | null>(null);
  const [biomarkerSearch, setBiomarkerSearch] = useState('');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [showApiLogs, setShowApiLogs] = useState(false);

  const compareFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCompareSlotRef = useRef<'A' | 'B'>('A');

  const patient = reportData.patient;
  const biomarkers = reportData.extraction?.biomarkers || [];
  const normalBiomarkers = biomarkers.filter((b) => b.status === 'NORMAL');
  const flaggedBiomarkers = biomarkers.filter((b) => b.status !== 'NORMAL');
  const panels = ['All', ...Array.from(new Set(biomarkers.map((b) => b.category)))];

  // const filteredBiomarkers = selectedPanel === 'All'
  //   ? biomarkers
  //   : biomarkers.filter((b) => b.category === selectedPanel);

  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (flaggedBiomarkers.length * 12.5))));
  const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';

  // Biomarker Breakdown filtering
  const breakdownBiomarkers = biomarkers
    .filter(b => selectedPanel === 'All' || b.category === selectedPanel)
    .filter(b => !showFlaggedOnly || b.status !== 'NORMAL')
    .filter(b => !biomarkerSearch || b.displayName.toLowerCase().includes(biomarkerSearch.toLowerCase()))
    .sort((a, b) => {
      const aFlagged = a.status !== 'NORMAL';
      const bFlagged = b.status !== 'NORMAL';
      if (aFlagged && !bFlagged) return -1;
      if (!aFlagged && bFlagged) return 1;
      return 0;
    });



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

    // ── Clinical Report ─────────────────────────────────────
    return (
      <div className="flex flex-col gap-0 animate-fade-in">
        {subTabBar}
        
        {/* High-fidelity clinical summary sub-view */}
        <div id="report-tour-summary">
          <ClinicalSection reportData={reportData} />
        </div>

        {/* ── Biomarker Breakdown ─────────────────────────────── */}
        <div className="mt-8 border-t border-border/20 pt-8">
          {/* Header row */}
          <div id="report-tour-biomarkers" className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-extrabold text-foreground tracking-tight">Biomarker Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Horizontal slider ranges &amp; clinical explanations</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search biomarkers..."
                  value={biomarkerSearch}
                  onChange={(e) => setBiomarkerSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-xl text-xs border border-border/40 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--primary)] w-48"
                />
              </div>
              {/* All / Flagged toggle */}
              <div className="flex rounded-xl border border-border/40 overflow-hidden">
                <button
                  onClick={() => setShowFlaggedOnly(false)}
                  className={cn(
                    'px-3.5 py-2 text-xs font-semibold cursor-pointer border-0 transition-all',
                    !showFlaggedOnly
                      ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-bold'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setShowFlaggedOnly(true)}
                  className={cn(
                    'px-3.5 py-2 text-xs font-semibold cursor-pointer border-0 transition-all flex items-center gap-1.5',
                    showFlaggedOnly
                      ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-bold'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Flagged
                  {flaggedBiomarkers.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {flaggedBiomarkers.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {panels.map((panel) => {
              const isSelected = selectedPanel === panel;
              const count = panel === 'All'
                ? biomarkers.filter(b => !showFlaggedOnly || b.status !== 'NORMAL')
                            .filter(b => !biomarkerSearch || b.displayName.toLowerCase().includes(biomarkerSearch.toLowerCase())).length
                : biomarkers.filter(b => b.category === panel)
                            .filter(b => !showFlaggedOnly || b.status !== 'NORMAL')
                            .filter(b => !biomarkerSearch || b.displayName.toLowerCase().includes(biomarkerSearch.toLowerCase())).length;

              return (
                <button
                  key={panel}
                  onClick={() => setSelectedPanel(panel)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 border-0',
                    isSelected
                      ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-bold'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {panel === 'All' ? 'All' : panel}
                  <span
                    className={cn(
                      'w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center',
                      isSelected ? 'bg-[var(--primary-text)] text-white' : 'bg-border/30 text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Biomarker cards grid (2 columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {breakdownBiomarkers.map((b) => {
              const colors = STATUS_COLORS[b.status];
              const Icon = CATEGORY_ICONS[b.category] || Droplet;
              const effectivePct = getEffectivePct(b);

              const numMin = b.referenceMin != null ? Number(b.referenceMin) : null;
              const numMax = b.referenceMax != null ? Number(b.referenceMax) : null;

              const displayMin = (numMin != null && !isNaN(numMin))
                ? parseFloat(Math.max(0, numMin - 2).toFixed(4)).toString()
                : '0';

              const displayMax = (numMax != null && !isNaN(numMax))
                ? (numMax === 999 ? 'N/A' : parseFloat((numMax + 2).toFixed(4)).toString())
                : 'N/A';

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-border/40 hover:border-[var(--primary)]/60 hover:shadow-md transition-all flex flex-col gap-3 group bg-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105" style={{ background: colors.bg }}>
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
                    {(() => {
                      const track = getSliderTrack(b.referenceMin, b.referenceMax);
                      return (
                        <div className="relative pb-3.5">
                          <div className="relative h-2 rounded-full overflow-hidden bg-border/40 flex">
                            {track.leftPct > 0 && <div className="h-full" style={{ width: `${track.leftPct}%`, background: track.leftColor }} />}
                            {track.midPct > 0 && <div className="h-full border-x border-border/40" style={{ width: `${track.midPct}%`, background: track.midColor }} />}
                            {track.rightPct > 0 && <div className="h-full" style={{ width: `${track.rightPct}%`, background: track.rightColor }} />}
                            <div
                              className="absolute w-3.5 h-3.5 -top-0.5 rounded-full border border-white shadow transition-all duration-500"
                              style={{ left: `calc(${effectivePct}% - 7px)`, background: colors.text }}
                            />
                          </div>
                          {/* Green corner markers */}
                          {track.leftPct > 0 && numMin !== null && !isNaN(numMin) && numMin > 0 && (
                            <div
                              className="absolute text-[8px] font-bold text-green-500/80 -translate-x-1/2 mt-0.5"
                              style={{ left: `${track.leftPct}%` }}
                            >
                              {numMin}
                            </div>
                          )}
                          {track.rightPct > 0 && numMax !== null && !isNaN(numMax) && numMax !== 999 && (
                            <div
                              className="absolute text-[8px] font-bold text-green-500/80 -translate-x-1/2 mt-0.5"
                              style={{ left: `${track.leftPct + track.midPct}%` }}
                            >
                              {numMax}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex justify-between text-[8px]" style={{ color: 'var(--muted-foreground)' }}>
                      <span>Min: {displayMin}</span>
                      <span>Optimal: {b.referenceRange}</span>
                      <span>Max: {displayMax}</span>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="mt-1">
                    <button
                      onClick={() => setSelectedBiomarkerDetail(b)}
                      className="w-full py-1.5 rounded-lg text-[11px] font-semibold border border-border/40 hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/5 transition-all bg-transparent text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      View Explanation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderBiomarkerAnalysis(subTabBar: React.ReactNode) {
    // Data processing
    const categories = panels.filter(p => p !== 'All');

    // System map with full details
    const systemMap: Record<string, { color: string; label: string }> = {
      CBC: { color: '#10b981', label: 'Blood' },
      Blood: { color: '#10b981', label: 'Blood' },
      Kidney: { color: '#06b6d4', label: 'Metabolic' },
      Liver: { color: '#06b6d4', label: 'Metabolic' },
      Electrolytes: { color: '#06b6d4', label: 'Metabolic' },
      Metabolic: { color: '#06b6d4', label: 'Metabolic' },
      'Comprehensive Metabolic Panel': { color: '#06b6d4', label: 'Metabolic' },
      'Lipid Panel': { color: '#f97316', label: 'Lipid' },
      Lipid: { color: '#f97316', label: 'Lipid' },
      Hormones: { color: '#a855f7', label: 'Hormones' },
      Thyroid: { color: '#a855f7', label: 'Hormones' },
      'Vitamins & Minerals': { color: '#ec4899', label: 'Nutrients' },
      Nutrients: { color: '#ec4899', label: 'Nutrients' },
      Vitamins: { color: '#ec4899', label: 'Nutrients' },
    };

    // Standard clinical panels for the Body System Status
    const standardPanels = [
      { id: 'blood', label: 'BLOOD', categories: ['CBC', 'Blood'] },
      { id: 'heart', label: 'HEART', categories: ['Lipid Panel', 'Lipid'] },
      { id: 'hormones', label: 'HORMONES', categories: ['Hormones', 'Thyroid'] },
      { id: 'nutrients', label: 'NUTRIENTS', categories: ['Vitamins & Minerals', 'Nutrients', 'Vitamins'] },
      { id: 'metabolic', label: 'METABOLIC', categories: ['Metabolic', 'Comprehensive Metabolic Panel', 'Kidney', 'Liver', 'Electrolytes'] },
    ];

    const systemBars = standardPanels.map(panel => {
      const catBiomarkers = biomarkers.filter(b => panel.categories.includes(b.category));
      const score = catBiomarkers.length
        ? Math.round((catBiomarkers.filter(b => b.status === 'NORMAL').length / catBiomarkers.length) * 100)
        : 100;

      const primaryCat = panel.categories[0];
      const color = systemMap[primaryCat]?.color || '#10b981';
      const blocks = 10;
      const filled = Math.round((score / 100) * blocks);
      return { label: panel.label, score, color, filled, blocks };
    });

    // Report Condition chart data (5 points as shown in mockup)
    const conditionData = systemBars.map(bar => ({
      name: bar.label.charAt(0) + bar.label.slice(1).toLowerCase(),
      score: bar.score,
      color: 'var(--primary-text)',
    }));

    const avgPanelScore = systemBars.length
      ? Math.round(systemBars.reduce((acc, s) => acc + s.score, 0) / systemBars.length)
      : 100;
    const conditionDelta = Math.max(1, Math.round(avgPanelScore / 25));

    // User profile age/gender
    const calculateAgeLocal = (dob?: string) => {
      if (!dob) return 42;
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };
    const patientAge = calculateAgeLocal(patient?.dateOfBirth);
    const patientGender = patient?.gender ? (patient.gender.toLowerCase().startsWith('m') ? 'M' : 'F') : 'M';

    // Group donut segments
    const totalMarkers = biomarkers.length;
    let accumulatedPercent = 0;
    const categoryDonutData = categories.map(cat => {
      const count = biomarkers.filter(b => b.category === cat).length;
      const pct = totalMarkers > 0 ? (count / totalMarkers) * 100 : 0;
      const sysInfo = systemMap[cat] || { color: '#10b981', label: cat };
      const strokeDash = `${pct} ${100 - pct}`;
      const strokeOffset = 100 - accumulatedPercent;
      accumulatedPercent += pct;
      return {
        name: sysInfo.label,
        count,
        color: sysInfo.color,
        strokeDash,
        strokeOffset,
      };
    });

    // Filter things to watch
    const watchBiomarkers = flaggedBiomarkers.slice(0, 3); // show top 3 or all

    // Ordered profile data for the connected category line chart
    const orderedBiomarkers = [...biomarkers].sort((a, b) => {
      const catOrder = ['CBC', 'Blood', 'Metabolic', 'Comprehensive Metabolic Panel', 'Lipid Panel', 'Lipid', 'Hormones', 'Thyroid', 'Vitamins & Minerals', 'Nutrients'];
      const indexA = catOrder.indexOf(a.category);
      const indexB = catOrder.indexOf(b.category);
      return (indexA !== -1 ? indexA : 99) - (indexB !== -1 ? indexB : 99);
    });

    const profileData = orderedBiomarkers.map(b => {
      let yVal = 2.2;
      if (b.status === 'LOW') yVal = 1.1;
      else if (b.status === 'HIGH') yVal = 3.1;
      else if (b.status === 'CRITICAL') {
        yVal = (b.referenceMin != null && b.value < b.referenceMin) ? 0.5 : 3.6;
      }

      const catColor = systemMap[b.category]?.color || 'var(--primary-text)';
      const item: any = {
        name: b.displayName,
        color: catColor,
        status: b.status,
        value: b.value,
        unit: b.unit,
      };

      const sysLabel = systemMap[b.category]?.label || b.category;
      item[`val_${sysLabel}`] = yVal;

      return item;
    });

    const lineCategories = Array.from(new Set(categories.map(cat => systemMap[cat]?.label || cat)));
    const categoryColors = categories.reduce((acc, cat) => {
      const label = systemMap[cat]?.label || cat;
      acc[label] = systemMap[cat]?.color || '#10b981';
      return acc;
    }, {} as Record<string, string>);

    const activeReport = reportData.reports?.[0];
    const collectionDateStr = activeReport?.createdAt
      ? new Date(activeReport.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'No Collection Date';

    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {subTabBar}

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column (8/12) */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* Header Box */}
            <div className="glass-card rounded-2xl p-5 border border-border/40 flex justify-between items-center shadow-sm">
              <div>
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">Bloodwork Analysis</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{collectionDateStr}</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center border border-border/40 bg-muted/10">
                <Search className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Summary Metrics Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Health Score */}
              <div className="glass-card rounded-2xl p-5 border border-border/40 flex flex-col justify-between shadow-sm relative overflow-hidden h-36">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                      <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">Health Score</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-500">↑ 4%</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-black text-foreground">{healthScore}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">OVERALL</p>
                  <svg viewBox="0 0 100 20" className="w-full h-5 mt-1 overflow-visible">
                    <path d="M0,15 Q25,5 50,12 T100,5" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* Biomarkers */}
              <div className="glass-card rounded-2xl p-5 border border-border/40 flex flex-col justify-between shadow-sm relative overflow-hidden h-36">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">Biomarkers</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-cyan-400">↑ 5</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-black text-foreground">{totalMarkers}</span>
                    <span className="text-xs text-muted-foreground">/{categories.length} panels</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">TESTED</p>
                  <svg viewBox="0 0 100 20" className="w-full h-5 mt-1 overflow-visible">
                    <path d="M0,15 Q30,15 60,8 T100,10" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* Flagged */}
              <div className="glass-card rounded-2xl p-5 border border-border/40 flex flex-col justify-between shadow-sm relative overflow-hidden h-36">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-orange-500 fill-orange-500/10" />
                      <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">Flagged</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-orange-500">↓ 11%</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-black text-foreground">{flaggedBiomarkers.length}</span>
                    <span className="text-xs text-muted-foreground">/{totalMarkers}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">NEEDS REVIEW</p>
                  <svg viewBox="0 0 100 20" className="w-full h-5 mt-1 overflow-visible">
                    <path d="M0,10 Q20,5 40,15 T80,10 T100,18" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Report Condition */}
            <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Report Condition</h4>
                  <p className="text-[10px] text-muted-foreground">Average Panel Score</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-muted/30 text-muted-foreground">This Report</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">{avgPanelScore}%</span>
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">▲ {conditionDelta}%</span>
              </div>

              <div className="h-40 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conditionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.1} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="glass-card rounded-xl p-2 border border-border/40 shadow text-[10px] bg-card">
                            <p className="font-bold text-foreground">{payload[0]?.payload?.name}</p>
                            <p className="text-emerald-400 font-extrabold mt-0.5">{payload[0]?.value}% Score</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {conditionData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Body System Status */}
            <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">Body System Status</h4>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">SCORE BY PANEL</span>
              </div>
              <div className="flex flex-col gap-4">
                {systemBars.map(sys => {
                  const isNormal = sys.score === 100;
                  const fillColor = isNormal ? '#11784B' : '#D41717';
                  return (
                    <div key={sys.label} className="flex items-center gap-4">
                      <span className="text-[10px] font-bold w-28 shrink-0 tracking-wider text-muted-foreground">{sys.label}</span>
                      <div className="flex gap-[4px] flex-1">
                        {Array.from({ length: sys.blocks }).map((_, idx) => {
                          const isFilled = idx < sys.filled;
                          return (
                            <div
                              key={idx}
                              className="flex-1 h-3.5 rounded-sm transition-all"
                              style={{ background: isFilled ? fillColor : 'rgba(100, 116, 139, 0.15)' }}
                            />
                          );
                        })}
                      </div>
                      <span className="text-xs font-bold w-10 text-right" style={{ color: fillColor }}>{sys.score}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column (4/12) */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* User Profile Card */}
            <div className="glass-card rounded-2xl p-6 border border-border/40 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-16 h-16 rounded-full bg-muted/15 flex items-center justify-center border border-border/40 text-2xl font-black text-[var(--primary-text)] shadow-inner">
                {pName.charAt(0).toUpperCase()}
              </div>
              <h4 className="text-base font-extrabold text-foreground mt-4 tracking-tight">{pName}</h4>
              <p className="text-xs text-muted-foreground mt-1">{patientAge} yrs · {patientGender}</p>
            </div>

            {/* Categories Card */}
            <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
              <h4 className="text-sm font-bold text-foreground">Categories</h4>

              <div className="flex items-center gap-4">
                {/* Donut Chart */}
                <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
                  <svg width="96" height="96" viewBox="0 0 40 40" className="transform -rotate-90">
                    {categoryDonutData.map((d, i) => (
                      <circle
                        key={i}
                        cx="20"
                        cy="20"
                        r="15.91549430918954"
                        fill="transparent"
                        stroke={d.color}
                        strokeWidth="4"
                        strokeDasharray={d.strokeDash}
                        strokeDashoffset={d.strokeOffset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-foreground">{totalMarkers}</span>
                    <span className="text-[7px] tracking-widest text-muted-foreground font-extrabold">MARKERS</span>
                  </div>
                </div>

                {/* Categories List */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  {categoryDonutData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-muted-foreground truncate font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold text-foreground ml-2">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status breakdown text and items */}
              <div className="border-t border-border/20 pt-4 mt-2 flex flex-col gap-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {flaggedBiomarkers.length <= 2
                    ? "Good news — most of your lab values are healthy."
                    : "Your lab report contains several biomarkers that require clinical review."}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-muted-foreground"><strong className="text-foreground">{normalBiomarkers.length} markers</strong> normal</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <span className="text-muted-foreground"><strong className="text-foreground">{flaggedBiomarkers.length} markers</strong> needs attention</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Things to Watch */}
            <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
              <h4 className="text-sm font-bold text-foreground">Things to Watch</h4>
              {flaggedBiomarkers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-6">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                  <p className="text-xs text-muted-foreground text-center">Excellent! All biomarkers are within optimal range.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                  {watchBiomarkers.map(b => {
                    const color = systemMap[b.category]?.color || '#f97316';
                    const pct = getEffectivePct(b);
                    const desc = b.description || `${b.displayName} levels are flagged as ${b.status.toLowerCase()}, indicating a shift outside optimal boundaries.`;

                    return (
                      <div key={b.id} className="p-3.5 rounded-xl border border-border/40 bg-card/40 flex flex-col gap-2.5">
                        <div className="flex justify-between items-baseline w-full">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 fill-orange-500/10 shrink-0" />
                            <span className="font-extrabold text-xs text-foreground truncate">{b.displayName}</span>
                          </div>
                          <span className="font-black text-sm text-orange-500 ml-3 shrink-0">{b.value}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-normal">{desc}</p>

                        <div className="mt-1">
                          {(() => {
                            const track = getSliderTrack(b.referenceMin, b.referenceMax);
                            return (
                              <div className="relative h-1.5 rounded-full bg-border/20 flex overflow-hidden">
                                {track.leftPct > 0 && <div className="h-full" style={{ width: `${track.leftPct}%`, background: track.leftColor }} />}
                                {track.midPct > 0 && <div className="h-full border-x border-border/40" style={{ width: `${track.midPct}%`, background: track.midColor }} />}
                                {track.rightPct > 0 && <div className="h-full" style={{ width: `${track.rightPct}%`, background: track.rightColor }} />}
                                <div
                                  className="absolute w-2.5 h-2.5 -top-[2px] rounded-full border border-white shadow transition-all duration-300"
                                  style={{ left: `calc(${pct}% - 5px)`, background: color }}
                                />
                              </div>
                            );
                          })()}
                          <div className="flex justify-between text-[8px] mt-1 text-muted-foreground font-semibold px-0.5">
                            <span>Low</span>
                            <span>Normal</span>
                            <span>High</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Systemic Biomarker Profile & Reference Zones */}
        <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-foreground">Systemic Biomarker Profile & Reference Zones</h4>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-extrabold mt-0.5">NORMALIZED RANGE PROFILES ACROSS {categories.length} DIAGNOSTIC CATEGORIES</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap md:justify-end">
              {lineCategories.map((catLabel, idx) => {
                const color = categoryColors[catLabel] || '#10b981';
                return (
                  <span key={idx} className="flex items-center gap-1.5 text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    {catLabel}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="relative flex h-72 mt-4">
            {/* Vertical color bar zone indicator */}
            <div
              className="absolute left-[12px] w-1.5 rounded-full z-10"
              style={{
                top: '8px',
                height: '162px',
                background: 'linear-gradient(to top, #f43f5e 0%, #f43f5e 20%, #fbbf24 20%, #fbbf24 41.25%, #10b981 41.25%, #10b981 68.75%, #fbbf24 68.75%, #fbbf24 83.75%, #f43f5e 83.75%, #f43f5e 100%)'
              }}
            />
            <div className="flex-1 h-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profileData} margin={{ top: 8, right: 16, left: 20, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.1} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 8, fontWeight: 'bold' }} angle={-45} textAnchor="end" interval={0} height={70} />
                  <YAxis
                    domain={[0, 4]}
                    tick={<CustomYAxisTick />}
                    ticks={[0.5, 1.1, 2.2, 3.1, 3.6]}
                    width={75}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="glass-card rounded-xl p-2.5 border border-border/40 shadow text-xs bg-card">
                          <p className="font-bold text-foreground">{payload[0]?.payload?.name}</p>
                          <p className="text-muted-foreground mt-0.5">Value: <span className="font-extrabold text-foreground">{payload[0]?.payload?.value} {payload[0]?.payload?.unit}</span></p>
                          <p className="text-muted-foreground mt-0.5">Status: <span className="font-semibold text-foreground">{payload[0]?.payload?.status}</span></p>
                        </div>
                      ) : null
                    }
                  />

                  {/* Reference boundaries matching Y divisions */}
                  <ReferenceLine y={0.8} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.25} />
                  <ReferenceLine y={1.65} stroke="#fbbf24" strokeDasharray="3 3" opacity={0.25} />
                  <ReferenceLine y={2.75} stroke="#10b981" strokeDasharray="3 3" opacity={0.25} />
                  <ReferenceLine y={3.35} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.25} />

                  {/* Shaded Optimal Reference Zone Band */}
                  <ReferenceArea y1={1.65} y2={2.75} fill="#10b981" fillOpacity={0.035} />

                  {lineCategories.map(catLabel => {
                    const color = categoryColors[catLabel] || 'var(--primary-text)';
                    return (
                      <Line
                        key={catLabel}
                        type="monotone"
                        dataKey={`val_${catLabel}`}
                        stroke={color}
                        strokeWidth={2.5}
                        connectNulls={false}
                        dot={(props: any) => {
                          if (props.cx === undefined || props.cy === undefined) return null;
                          const isNormal = props.payload?.status === 'NORMAL';
                          const dotColor = isNormal ? '#10b981' : '#F04E14';
                          return (
                            <circle
                              key={props.key}
                              cx={props.cx}
                              cy={props.cy}
                              r={4.5}
                              fill={dotColor}
                              stroke="white"
                              strokeWidth={1.5}
                            />
                          );
                        }}
                        activeDot={{ r: 6 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span><strong className="text-foreground">Clinical Guide:</strong> The vertical color bar and shaded bands map reference intervals dynamically, allowing immediate visual assessment across distinct panels and units.</span>
            </div>
            <span className="flex items-center gap-1.5 text-[9px] font-extrabold px-2.5 py-1 rounded bg-rose-500/5 text-rose-500 border border-rose-500/10 uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              100% NORMALIZED
            </span>
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
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Sample Report Banner */}
      {isSampleReport && (
        <div 
          id="report-tour-banner"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4.5 rounded-2xl border border-[var(--primary)]/30 sample-banner-pulse"
          style={{
            background: 'linear-gradient(135deg, rgba(201, 125, 10, 0.15), rgba(201, 125, 10, 0.05))',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div className="text-left">
              <h4 className="text-xs font-bold text-foreground">Viewing Sample Report</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                This is a static demonstration report with mock values. Upload a blood test PDF to parse and explore your own clinical data.
              </p>
            </div>
          </div>
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer border-0 shrink-0"
            style={{
              background: 'var(--primary-text)',
            }}
          >
            Upload Now
          </button>
        </div>
      )}

      {/* ── Patient Banner ─────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          {branding.logoIconUrl ? (
            <img
              src={branding.logoIconUrl}
              alt={`${branding.brandName} Icon`}
              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-border/40"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-primary/20 text-primary-text font-black text-lg border border-border/40 shrink-0">
              {branding.brandName.substring(0, 2).toUpperCase()}
            </div>
          )}
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

        {branding.logoLetterformUrl ? (
          <img
            src={branding.logoLetterformUrl}
            alt={`${branding.brandName} Letterform`}
            className="h-10 w-auto object-contain shrink-0 mx-4 hidden lg:block"
          />
        ) : (
          <span className="font-semibold text-lg shrink-0 mx-4 hidden lg:block text-muted-foreground">
            {branding.brandName}
          </span>
        )}

        <button
          onClick={() => setShowApiLogs(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold border border-border bg-border/10 text-foreground hover:bg-border/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Terminal className="w-3.5 h-3.5 text-[var(--primary-text)]" />
          API Logs
        </button>

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
      <section id="report-tour-tabs" className="flex gap-2 p-1.5 rounded-xl border border-border/40 mb-8" style={{ background: 'var(--card)' }}>
        {[
          { id: 'current', label: 'Current Report', icon: FileText },
          { id: 'trends', label: 'Trends', icon: TrendingUp },
          { id: 'ai-chat', label: 'AI Care', icon: MessageSquare },
          { id: 'compare', label: 'Compare', icon: SplitSquareVertical },
        ].map((tab) => (
          <button
            key={tab.id}
            id={`report-tab-btn-${tab.id}`}
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
      {activeTab === 'ai-chat' && <AIChat biomarkers={biomarkers} patient={patient} isSampleReport={isSampleReport} />}
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

      {/* API Logs Dialog */}
      {showApiLogs && (
        <ApiLogsDialog
          reportData={reportData}
          onClose={() => setShowApiLogs(false)}
        />
      )}
    </div>
  );
}

interface ApiLogsDialogProps {
  reportData: CompleteReportData;
  onClose: () => void;
}

function ApiLogsDialog({ reportData, onClose }: ApiLogsDialogProps) {
  const apiLogs = reportData.extraction?.rawData?.metadata?.api_logs || null;
  const [activeTab, setActiveTab] = useState<'pymupdf' | 'pdfplumber' | 'mistral_ocr'>('pymupdf');

  const hasPymupdf = !!apiLogs?.pymupdf;
  const hasPdfplumber = !!apiLogs?.pdfplumber;
  const hasOcr = !!apiLogs?.mistral_ocr;

  const tabs = [
    { id: 'pymupdf', label: 'PyMuPDF Logs', exists: hasPymupdf, data: apiLogs?.pymupdf },
    { id: 'pdfplumber', label: 'pdfplumber Logs', exists: hasPdfplumber, data: apiLogs?.pdfplumber },
    { id: 'mistral_ocr', label: 'Mistral OCR Logs', exists: hasOcr, data: apiLogs?.mistral_ocr },
  ];

  // Pick first available tab
  const defaultTab = tabs.find((t) => t.exists)?.id as 'pymupdf' | 'pdfplumber' | 'mistral_ocr' | undefined;
  const currentTabId = tabs.some((t) => t.id === activeTab && t.exists) ? activeTab : defaultTab;
  const currentTab = tabs.find((t) => t.id === currentTabId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card rounded-2xl border border-border/40 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)]/10 text-[var(--primary-text)]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Biomarker Extraction API Logs</h3>
              <p className="text-xs text-muted-foreground">Compare intermediate outputs from PyMuPDF and pdfplumber</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border-0 bg-transparent text-muted-foreground hover:text-foreground cursor-pointer hover:bg-border/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!apiLogs ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground text-sm">
              No API logs found for this report. Logs are generated for new uploads running the modernized orchestrator pipeline.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white border-0 cursor-pointer shadow-sm hover:opacity-90 transition-all"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Tab Selector */}
            <div className="px-6 pt-4 border-b border-border/40 flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  disabled={!tab.exists}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-4 py-2 border-b-2 font-semibold text-sm transition-all bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                    activeTab === tab.id
                      ? "border-[var(--primary)] text-[var(--primary-text)]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label} {!tab.exists && "(N/A)"}
                </button>
              ))}
            </div>

            {/* Tab Details */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {currentTab ? (
                <>
                  {/* Summary card */}
                  <div className="p-4 rounded-xl border border-border/40 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground capitalize">
                        {currentTab.id === 'pymupdf' ? 'PyMuPDF Native Text Parser' : currentTab.id === 'pdfplumber' ? 'pdfplumber Layout & Table Parser' : 'Mistral OCR Engine'}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Biomarkers parsed and normalized: <span className="font-bold text-foreground">{currentTab.data?.biomarkers?.length || 0}</span>
                      </p>
                    </div>
                    <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 self-start sm:self-auto">
                      Source: {currentTab.id}
                    </div>
                  </div>

                  {/* Two sections: Normalized Biomarkers (JSON) and Raw Extracted Text */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[300px]">
                    {/* Left: Normalized Biomarkers list */}
                    <div className="flex flex-col border border-border/40 rounded-xl overflow-hidden bg-card/50">
                      <div className="px-4 py-2.5 border-b border-border/40 bg-card/80 flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Normalized Biomarkers</span>
                        <span className="text-[10px] bg-border/20 text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                          JSON
                        </span>
                      </div>
                      <div className="p-4 flex-1 font-mono text-xs overflow-auto max-h-[350px] bg-black/5 dark:bg-black/20 text-muted-foreground">
                        {currentTab.data?.biomarkers && currentTab.data.biomarkers.length > 0 ? (
                          <pre className="text-[11px] leading-relaxed select-text text-foreground">
                            {JSON.stringify(currentTab.data.biomarkers, null, 2)}
                          </pre>
                        ) : (
                          <p className="italic text-center mt-8 text-xs text-muted-foreground/60">No biomarkers successfully normalized from this extractor.</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Raw Extracted Text */}
                    <div className="flex flex-col border border-border/40 rounded-xl overflow-hidden bg-card/50">
                      <div className="px-4 py-2.5 border-b border-border/40 bg-card/80 flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Raw Extracted Text</span>
                        <span className="text-[10px] bg-border/20 text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                          Text
                        </span>
                      </div>
                      <div className="p-4 flex-1 font-mono text-xs overflow-auto max-h-[350px] bg-black/5 dark:bg-black/20 text-muted-foreground whitespace-pre-wrap select-text leading-relaxed">
                        {currentTab.data?.text ? (
                          <span className="text-foreground">{currentTab.data.text}</span>
                        ) : (
                          <p className="italic text-center mt-8 text-xs text-muted-foreground/60">No raw text extracted by this method.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">Select a tab to view logs.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
