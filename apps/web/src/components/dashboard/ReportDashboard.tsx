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
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
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

  // Status segments for pie chart
  const pieData = [
    { name: 'Normal', value: normalBiomarkers.length, color: '#1A9966' },
    { name: 'Abnormal', value: flaggedBiomarkers.length, color: '#F04E14' },
  ].filter((s) => s.value > 0);

  function renderCurrentReportTab() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side — Flagged Summary & Pie Chart */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Diagnostics Summary
            </h4>
            
            {/* Pie Chart */}
            <div className="h-44 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-2xl font-bold block" style={{ color: 'var(--foreground)' }}>
                  {flaggedBiomarkers.length}
                </span>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Anomaly Flags
                </span>
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
            {selectedPanel === 'All' && (
              <div className="h-64 mb-6 border-b border-border/20 pb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    data={panels
                      .filter((p) => p !== 'All')
                      .map((p) => {
                        const list = biomarkers.filter((b) => b.category === p);
                        const norm = list.filter((b) => b.status === 'NORMAL').length;
                        const score = Math.round((norm / list.length) * 100);
                        return { subject: p, score };
                      })}
                  >
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--muted-foreground)' }} />
                    <Radar name="Body Index" dataKey="score" stroke="var(--primary-text)" fill="var(--primary)" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Biomarker list view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBiomarkers.map((b) => {
                const colors = STATUS_COLORS[b.status];
                const Icon = CATEGORY_ICONS[b.category] || Droplet;
                const effectivePct = getEffectivePct(b);

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBiomarkerDetail(b)}
                    className="p-4 rounded-xl border border-border/40 hover:border-[var(--primary)]/60 hover:shadow-md cursor-pointer transition-all flex flex-col gap-3 group bg-card"
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
                          <p className="font-bold text-xs" style={{ color: 'var(--foreground)' }}>
                            {b.displayName}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                            {b.category}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          {b.status}
                        </span>
                      </div>
                    </div>

                    {/* Zone slider bar */}
                    <div>
                      <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>
                        <span>Low</span>
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                          {b.value} {b.unit}
                        </span>
                        <span>High</span>
                      </div>
                      <div className="relative h-2 rounded-full overflow-hidden bg-border/40 flex">
                        <div className="h-full w-[20%]" style={{ background: 'rgba(201, 125, 10, 0.25)' }} />
                        <div className="h-full w-[60%] border-x border-border/40" style={{ background: 'rgba(26, 153, 102, 0.25)' }} />
                        <div className="h-full w-[20%]" style={{ background: 'rgba(240, 78, 20, 0.25)' }} />
                        
                        {/* Needle dot */}
                        <div
                          className="absolute w-3.5 h-3.5 -top-0.5 rounded-full border border-white shadow transition-all duration-500"
                          style={{
                            left: `calc(${effectivePct}% - 7px)`,
                            background: colors.text,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        <span>Min: {b.referenceMin ?? '0'}</span>
                        <span>Optimal: {b.referenceRange}</span>
                        <span>Max: {b.referenceMax ?? 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
