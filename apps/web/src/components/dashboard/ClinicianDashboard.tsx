import { useState, useRef } from 'react';
import {
  User,
  FileText,
  Loader2,
  ShieldAlert,
  ChevronLeft,
  Upload,
  TrendingUp,
  SplitSquareVertical,
  Eye,
  UserPlus,
  Search,
  ChevronRight,
  X,
  CheckCircle2,
  Circle,
  RotateCcw,
  LayoutDashboard,
  CalendarDays,
  Activity,
  Users,
  Heart,
  AlertTriangle,
  BarChart2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import type {
  PatientRecord,
  UploadRecord,
  AppointmentRecord,
  CompleteReportData,
  DashboardState,
  TaskRecord,
  PatientStat,
} from '@/types/dashboard';
import { calculateAge } from './utils';
import { TrendAnalysisChart } from './TrendAnalysisChart';
import { ComparisonView } from './ComparisonView';
import { AppointmentRow } from './AppointmentRow';
import { TaskSidebar } from './TaskSidebar';
import { OnboardPatientModal } from './OnboardPatientModal';
import { AppointmentModal } from './AppointmentModal';
import { ClinicianUploadModal } from './ClinicianUploadModal';

interface ClinicianDashboardProps {
  patients: PatientRecord[];
  allUploads: UploadRecord[];
  appointments: AppointmentRecord[];
  selectedPatient: PatientRecord | null;
  setSelectedPatient: (p: PatientRecord | null) => void;
  fetchPatients: () => Promise<void>;
  fetchAppointments: () => Promise<void>;
  patientsLoading: boolean;
  selectedPatientReports: CompleteReportData[];
  trendsLoading: boolean;
  patientSubTab: 'reports' | 'trends' | 'compare' | 'insights';
  setPatientSubTab: (tab: 'reports' | 'trends' | 'compare' | 'insights') => void;
  clinicianTab: 'directory' | 'activity';
  setClinicianTab: (tab: 'directory' | 'activity') => void;
  fetchOrgUploads: () => Promise<void>;
  loadPatientTrendsAndDetails: (p: PatientRecord) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  handleFileUpload: (file: File, compareSlot?: 'A' | 'B' | null, targetPatientId?: string) => Promise<void>;
  setReportData: (data: CompleteReportData | null) => void;
  setViewState: (state: DashboardState) => void;
  compareReportA: CompleteReportData | null;
  setCompareReportA: (r: CompleteReportData | null) => void;
  compareReportB: CompleteReportData | null;
  setCompareReportB: (r: CompleteReportData | null) => void;
  compareUploading: boolean;
  compareUploadSlot: 'A' | 'B' | null;
  appointmentsLoading: boolean;
  patientStats: PatientStat[];
  tasks: TaskRecord[];
  tasksLoading: boolean;
  createTask: (payload: { title: string; priority: TaskRecord['priority']; dueDate?: string }) => Promise<void>;
  toggleTaskStatus: (task: TaskRecord) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateAppointmentStatus: (id: string, status: AppointmentRecord['status']) => Promise<void>;
  isApptModalOpen: boolean;
  setIsApptModalOpen: (open: boolean) => void;
}

export function ClinicianDashboard({
  patients,
  allUploads,
  appointments,
  selectedPatient,
  setSelectedPatient,
  fetchPatients,
  fetchAppointments,
  patientsLoading,
  selectedPatientReports,
  trendsLoading,
  patientSubTab,
  setPatientSubTab,
  clinicianTab,
  setClinicianTab,
  fetchOrgUploads,
  loadPatientTrendsAndDetails,
  isOnboardingOpen,
  setIsOnboardingOpen,
  handleFileUpload,
  setReportData,
  setViewState,
  compareReportA,
  setCompareReportA,
  compareReportB,
  setCompareReportB,
  compareUploading,
  compareUploadSlot,
  appointmentsLoading,
  patientStats,
  tasks,
  tasksLoading,
  createTask,
  toggleTaskStatus,
  deleteTask,
  updateAppointmentStatus,
  isApptModalOpen,
  setIsApptModalOpen,
}: ClinicianDashboardProps) {
  const [staffView, setStaffView] = useState<'overview' | 'patients' | 'appointments' | 'activity'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [compareDragging, setCompareDragging] = useState<'A' | 'B' | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const compareFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCompareSlotRef = useRef<'A' | 'B'>('A');

  const totalPatients = patients.length;
  const totalReports = allUploads.length;
  const processingQueue = allUploads.filter((u) => u.status === 'PENDING' || u.status === 'PROCESSING').length;
  const failedReports = allUploads.filter((u) => u.status === 'FAILED').length;

  const filteredPatients = patients.filter((p) => {
    const query = searchTerm.toLowerCase();
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
    return fullName.includes(query) || (p.email || '').toLowerCase().includes(query);
  });

  const upcomingCount = appointments.filter(
    (a) => a.status === 'SCHEDULED' && new Date(a.startTime) >= new Date(Date.now() - 86400000)
  ).length;

  function renderCompareTab(available: CompleteReportData[]) {
    const bothReady = compareReportA !== null && compareReportB !== null;

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

          {isPolling && (
            <div className="glass-card rounded-xl p-4 border-border/40 flex items-center gap-3 border">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--primary-text)] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Analyzing Report {slot}…</p>
                <p className="text-[10px] text-muted-foreground">Usually 15–30 seconds.</p>
              </div>
            </div>
          )}

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
          <ComparisonView reportA={compareReportA} reportB={compareReportB} />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5 animate-fade-in">
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

  const summaryCards = (
    <section id="clinician-tour-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        { label: 'Registered Patients', val: totalPatients, icon: User, color: 'var(--primary-text)' },
        { label: 'Total Lab Reports', val: totalReports, icon: FileText, color: 'var(--primary)' },
        { label: 'Processing Queue', val: processingQueue, icon: Loader2, color: '#C97D0A', animate: processingQueue > 0 },
        { label: 'Failed Extractions', val: failedReports, icon: ShieldAlert, color: '#D41717' },
      ].map((stat, idx) => (
        <div key={idx} className="glass-card rounded-2xl p-5 border-border/40 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {stat.val}
            </p>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">
              {stat.label}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-glow)' }}
          >
            <stat.icon
              className={cn('w-5 h-5', stat.animate ? 'animate-spin' : '')}
              style={{ color: stat.color }}
            />
          </div>
        </div>
      ))}
    </section>
  );

  const patientCaseFile = selectedPatient && (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header / Profile banner */}
      <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedPatient(null);
              fetchPatients();
            }}
            className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-border/20 text-muted-foreground hover:text-foreground cursor-pointer transition-colors bg-transparent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <img
            src="/logo/040523 YC LogoDeck_Icon-GS.jpg"
            alt="YC Logo"
            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-border/40"
          />
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              {selectedPatient.firstName} {selectedPatient.lastName}
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase"
                style={{ background: 'var(--primary-glow)', color: 'var(--primary-text)' }}
              >
                {selectedPatient.gender}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()} · Age:{' '}
              {calculateAge(selectedPatient.dateOfBirth)} · Email: {selectedPatient.email}
            </p>
          </div>
        </div>

        {/* Upload report specific to this patient */}
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            accept=".pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer border-0"
            style={{ background: 'var(--primary-text)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Lab PDF
          </button>
        </div>
      </div>

      {/* Notes and biological files layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column - Notes & General info */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Clinical Intake Notes
            </h4>
            <p className="text-xs leading-relaxed text-foreground bg-border/10 p-3.5 rounded-xl border border-border/40 whitespace-pre-wrap">
              {selectedPatient.note ||
                'No clinical intake notes entered for this patient. Click "Onboard Patient" or manage records to append details.'}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Diagnostic Summary Indicators
            </h4>
            {selectedPatientReports.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No complete parsed lab diagnostics found for trends.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[var(--primary-text)] bg-[var(--primary)]/20">
                    {selectedPatientReports[0].reports?.[0]?.insights?.recommendations?.length || 0}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">AI Action Items</p>
                    <p className="text-[10px] text-muted-foreground">Action points suggested in latest labs.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#1A9966]/5 border border-[#1A9966]/20 rounded-xl">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#1A9966] bg-[#1A9966]/20">
                    {selectedPatientReports[0].extraction?.biomarkers?.filter((b) => b.status === 'NORMAL').length || 0}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1A9966]">Balanced Markers</p>
                    <p className="text-[10px] text-muted-foreground">Monitored metrics within reference range.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#F04E14]/5 border border-[#F04E14]/20 rounded-xl">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#F04E14] bg-[#F04E14]/20">
                    {selectedPatientReports[0].extraction?.biomarkers?.filter((b) => b.status !== 'NORMAL').length || 0}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#F04E14]">Anomaly Deviants</p>
                    <p className="text-[10px] text-muted-foreground">Markers showing deviation alerts.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Reports List or Trends charts */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Case File Sub-Tab Selector */}
          <div className="flex gap-2 p-1 rounded-xl border border-border/40" style={{ background: 'var(--card)' }}>
            {[
              { id: 'reports', label: 'Uploads', icon: FileText },
              { id: 'insights', label: 'Lab Insights', icon: BarChart2 },
              { id: 'trends', label: 'Trends', icon: TrendingUp },
              { id: 'compare', label: 'Compare', icon: SplitSquareVertical },
            ].map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => {
                  setPatientSubTab(subTab.id as any);
                  if (subTab.id !== 'compare') {
                    setCompareReportA(null);
                    setCompareReportB(null);
                  }
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border-0 bg-transparent',
                  patientSubTab === subTab.id
                    ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <subTab.icon className="w-3.5 h-3.5" />
                {subTab.label}
              </button>
            ))}
          </div>

          {patientSubTab === 'reports' ? (
            <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col gap-4">
              <h4 className="text-sm font-bold text-foreground">Lab Reports Case History</h4>

              {allUploads.filter((u) => u.patientId === selectedPatient.id).length === 0 ? (
                <div className="min-h-[180px] rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-xs text-foreground">No Laboratory Files</p>
                    <p className="text-[10px] text-muted-foreground max-w-xs mt-0.5">
                      Upload a clinical standard blood work PDF to begin secure biomarker data scanning and analysis.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {allUploads
                    .filter((u) => u.patientId === selectedPatient.id)
                    .map((upload) => {
                      const date = new Date(upload.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      const sizeMb = ((upload.fileSize || 0) / (1024 * 1024)).toFixed(2);

                      return (
                        <div
                          key={upload.id}
                          className="p-4 rounded-xl border border-border/40 bg-card/65 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow transition-shadow"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center"
                              style={{
                                background:
                                  upload.status === 'COMPLETED'
                                    ? 'rgba(26, 153, 102, 0.15)'
                                    : upload.status === 'FAILED'
                                    ? 'rgba(212, 23, 23, 0.15)'
                                    : 'rgba(201, 125, 10, 0.15)',
                              }}
                            >
                              <FileText
                                className="w-5 h-5"
                                style={{
                                  color:
                                    upload.status === 'COMPLETED'
                                      ? '#1A9966'
                                      : upload.status === 'FAILED'
                                      ? '#D41717'
                                      : '#C97D0A',
                                }}
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-foreground truncate max-w-[220px]">
                                {upload.fileName}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {date} · {sizeMb} MB
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background:
                                  upload.status === 'COMPLETED'
                                    ? 'rgba(26, 153, 102, 0.12)'
                                    : upload.status === 'FAILED'
                                    ? 'rgba(212, 23, 23, 0.12)'
                                    : 'rgba(201, 125, 10, 0.12)',
                                color:
                                  upload.status === 'COMPLETED'
                                    ? '#1A9966'
                                    : upload.status === 'FAILED'
                                    ? '#D41717'
                                    : '#C97D0A',
                              }}
                            >
                              {upload.status}
                            </span>

                            {upload.fileUrl && (
                              <button
                                onClick={() => window.open(upload.fileUrl, '_blank', 'noopener,noreferrer')}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-border/20 cursor-pointer transition-all bg-transparent"
                                title="View uploaded PDF"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                PDF
                              </button>
                            )}

                            {upload.status === 'COMPLETED' && (
                              <button
                                onClick={async () => {
                                  const toastId = toast.loading('Retrieving diagnostic details...');
                                  try {
                                    const reportRes = await apiFetch<{ data: { upload: CompleteReportData } }>(
                                      `/reports/upload/${upload.id}`
                                    );
                                    setReportData(reportRes.data.upload);
                                    toast.success('Report successfully loaded!', { id: toastId });
                                    setViewState('REPORT');
                                  } catch (err) {
                                    toast.error('Failed to load report analytics.', { id: toastId });
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-sm hover:opacity-90 cursor-pointer border-0"
                                style={{ background: 'var(--primary-text)' }}
                              >
                                Review
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : patientSubTab === 'insights' ? (
            (() => {
              const report = selectedPatientReports[0];
              if (!report) return (
                <div className="glass-card rounded-2xl p-12 border-border/40 flex flex-col items-center justify-center gap-3 text-center">
                  <BarChart2 className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">No Lab Data Yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Upload and process a lab PDF to unlock the Lab Insights dashboard.</p>
                </div>
              );
              const biomarkers = report.extraction?.biomarkers || [];
              const normal = biomarkers.filter(b => b.status === 'NORMAL');
              const flagged = biomarkers.filter(b => b.status !== 'NORMAL');
              const healthScore = Math.max(0, Math.min(100, Math.round(100 - (flagged.length * 12.5))));
              const categories = Array.from(new Set(biomarkers.map(b => b.category)));

              // System bars data
              const systemMap: Record<string, { color: string }> = {
                CBC: { color: '#10b981' }, Blood: { color: '#10b981' },
                Metabolic: { color: '#f59e0b' }, 'Lipid Panel': { color: '#3b82f6' },
                Hormones: { color: '#8b5cf6' }, Thyroid: { color: '#8b5cf6' },
                'Vitamins & Minerals': { color: '#ec4899' }, Nutrients: { color: '#ec4899' },
              };
              const systemBars = categories.map(cat => {
                const catMarkers = biomarkers.filter(b => b.category === cat);
                const catNormal = catMarkers.filter(b => b.status === 'NORMAL').length;
                const score = Math.round((catNormal / catMarkers.length) * 100);
                const color = systemMap[cat]?.color || 'var(--primary-text)';
                const blocks = 14;
                const filled = Math.round((score / 100) * blocks);
                return { label: cat.toUpperCase(), score, color, blocks, filled };
              });



              return (
                <div className="flex flex-col gap-5 animate-fade-in">
                  {/* KPI Row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'HEALTH SCORE', val: healthScore, unit: '/100', icon: Heart, color: healthScore >= 80 ? '#1A9966' : healthScore >= 60 ? '#C97D0A' : '#F04E14', sub: 'OVERALL' },
                      { label: 'BIOMARKERS', val: biomarkers.length, unit: `/${categories.length} panels`, icon: Activity, color: 'var(--primary-text)', sub: 'TESTED' },
                      { label: 'FLAGGED', val: flagged.length, unit: `/${biomarkers.length}`, icon: AlertTriangle, color: flagged.length === 0 ? '#1A9966' : '#F04E14', sub: 'NEEDS REVIEW' },
                    ].map(kpi => (
                      <div key={kpi.label} className="glass-card rounded-xl p-4 border border-border/40 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                          <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold" style={{ color: kpi.color }}>{kpi.val}</span>
                          <span className="text-[10px] text-muted-foreground">{kpi.unit}</span>
                        </div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.sub}</p>
                        <div className="h-0.5 rounded-full" style={{ background: kpi.color, opacity: 0.4 }} />
                      </div>
                    ))}
                  </div>

                  {/* Body System Status */}
                  <div className="glass-card rounded-xl p-5 border border-border/40">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-foreground">Body System Status</h4>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">SCORE BY PANEL</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {systemBars.map(sys => (
                        <div key={sys.label} className="flex items-center gap-3">
                          <span className="text-[9px] font-bold w-28 shrink-0 tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{sys.label}</span>
                          <div className="flex gap-[3px] flex-1">
                            {Array.from({ length: sys.blocks }).map((_, idx) => (
                              <div key={idx} className="flex-1 h-3 rounded-sm" style={{ background: idx < sys.filled ? sys.color : 'rgba(255,255,255,0.06)' }} />
                            ))}
                          </div>
                          <span className="text-xs font-bold w-10 text-right" style={{ color: sys.color }}>{sys.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Categories + Things to Watch */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category Health Breakdown */}
                    <div className="glass-card rounded-xl p-5 border border-border/40 flex flex-col justify-between">
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
                          <span className="text-muted-foreground"><strong className="text-foreground">{normal.length}</strong> Optimal</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-muted-foreground"><strong className="text-foreground">{flagged.length}</strong> Attention</span>
                        </div>
                      </div>
                    </div>

                    {/* Things to Watch */}
                    <div className="glass-card rounded-xl p-5 border border-border/40 flex flex-col gap-3 overflow-hidden">
                      <h4 className="text-sm font-bold text-foreground">Things to Watch</h4>
                      {flagged.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 gap-2 py-4">
                          <CheckCircle2 className="w-8 h-8 text-green-400" />
                          <p className="text-xs text-muted-foreground text-center">All markers within optimal range.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[240px] custom-scrollbar">
                          {flagged.map(b => {
                            const isCritical = b.status === 'CRITICAL';
                            const isHigh = b.status === 'HIGH';
                            const color = isCritical ? '#D41717' : isHigh ? '#F04E14' : '#C97D0A';
                            const pct = b.referenceMin != null && b.referenceMax != null
                              ? Math.max(5, Math.min(95, ((b.value - b.referenceMin) / (b.referenceMax - b.referenceMin)) * 100))
                              : b.status === 'HIGH' ? 85 : 15;
                            return (
                              <div key={b.id} className="p-3 rounded-xl border border-border/40 bg-card/60 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3" style={{ color }} />
                                    <span className="font-bold text-xs text-foreground">{b.displayName}</span>
                                  </div>
                                  <span className="font-extrabold text-xs" style={{ color }}>{b.value} {b.unit}</span>
                                </div>
                                <div>
                                  <div className="flex justify-between text-[8px] mb-1 text-muted-foreground">
                                    <span>Low</span><span className="font-semibold text-foreground">Normal</span><span>High</span>
                                  </div>
                                  <div className="relative h-1.5 rounded-full bg-border/30 flex overflow-hidden">
                                    <div className="h-full w-[25%]" style={{ background: 'rgba(201,125,10,0.2)' }} />
                                    <div className="h-full w-[50%]" style={{ background: 'rgba(26,153,102,0.2)' }} />
                                    <div className="h-full w-[25%]" style={{ background: 'rgba(240,78,20,0.2)' }} />
                                    <div className="absolute w-3 h-3 -top-[3px] rounded-full border border-white shadow" style={{ left: `calc(${pct}% - 6px)`, background: color }} />
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
              );
            })()
          ) : patientSubTab === 'trends' ? (
            <div>
              {trendsLoading ? (
                <div className="glass-card rounded-2xl p-8 border-border/40 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--primary-text)] mb-2" />
                  <span className="text-xs text-muted-foreground">Aggregating historical biomarkers...</span>
                </div>
              ) : (
                <TrendAnalysisChart
                  biomarkers={selectedPatientReports[0]?.extraction?.biomarkers || []}
                  comparisonReports={selectedPatientReports}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <SplitSquareVertical className="w-4 h-4 text-[var(--primary-text)]" />
                  Compare Reports
                </h4>
                {(compareReportA || compareReportB) && (
                  <button
                    onClick={() => {
                      setCompareReportA(null);
                      setCompareReportB(null);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-border/60 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-border/20 bg-transparent"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
              {renderCompareTab(selectedPatientReports)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const directoryAndActivity = (
    <div className="flex flex-col gap-6">
      {/* Header and Directory navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Tab toggles */}
        <div className="flex gap-2 p-1 rounded-xl border border-border/40" style={{ background: 'var(--card)' }}>
          <button
            onClick={() => setClinicianTab('directory')}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border-0 bg-transparent',
              clinicianTab === 'directory'
                ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-bold shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Patients Directory
          </button>
          <button
            onClick={() => {
              setClinicianTab('activity');
              fetchOrgUploads();
            }}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border-0 bg-transparent',
              clinicianTab === 'activity'
                ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-bold shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Org Activity Feed
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border hover:bg-border/20 transition-all cursor-pointer bg-transparent"
            style={{ color: 'var(--primary-text)', borderColor: 'var(--primary-text)' }}
          >
            <Upload className="w-4 h-4" />
            Upload Lab PDF
          </button>
          
          <button
            id="clinician-tour-onboard"
            onClick={() => setIsOnboardingOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer border-0"
            style={{ background: 'var(--primary-text)' }}
          >
            <UserPlus className="w-4 h-4" />
            Onboard Patient
          </button>
        </div>
      </div>

      {/* Tab 1: Patients Directory */}
      {clinicianTab === 'directory' ? (
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patients by name or email..."
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-card text-foreground outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          {patientsLoading ? (
            <div className="min-h-[200px] flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-text)]" />
              <p className="text-xs text-muted-foreground mt-2">Loading patients directory...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 border-border/40 shadow-sm text-center flex flex-col items-center justify-center min-h-[220px]">
              <User className="w-10 h-10 text-muted-foreground mb-3" />
              <h5 className="font-semibold text-sm text-foreground">No Patients Found</h5>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {searchTerm
                  ? 'No patients matched your search queries.'
                  : 'Onboard a patient to begin managing their laboratory diagnostic cases.'}
              </p>
            </div>
          ) : (
            <div id="clinician-tour-patients" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.map((patient) => {
                const age = calculateAge(patient.dateOfBirth);
                const latestUpload = patient.uploads?.[0];
                const totalUploadsCount = patient.uploads?.length || 0;

                return (
                  <div
                    key={patient.id}
                    onClick={() => loadPatientTrendsAndDetails(patient)}
                    className="glass-card rounded-xl p-5 border-border/40 hover:border-[var(--primary)]/65 hover:shadow-md cursor-pointer transition-all flex flex-col gap-4 bg-card group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo/040523 YC LogoDeck_Main-FC.jpg"
                        alt="YC Logo"
                        className="w-11 h-11 rounded-lg object-cover transition-transform group-hover:scale-105 border border-border/40 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-foreground truncate">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{patient.email}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>

                    <div className="border-t border-border/40 pt-3 flex justify-between text-[10px] text-muted-foreground">
                      <span>
                        Age: <strong className="text-foreground">{age}</strong> · {patient.gender}
                      </span>
                      <span>
                        Reports: <strong className="text-[var(--primary-text)]">{totalUploadsCount}</strong>
                      </span>
                    </div>

                    {latestUpload && (
                      <div className="border-t border-border/30 pt-2 flex items-center justify-between text-[9px]">
                        <span className="text-muted-foreground truncate max-w-[150px]">
                          Labs: {latestUpload.fileName}
                        </span>
                        <span
                          className="uppercase font-bold px-1.5 py-0.5 rounded-full text-[8px]"
                          style={{
                            background:
                              latestUpload.status === 'COMPLETED'
                                ? 'rgba(26, 153, 102, 0.12)'
                                : latestUpload.status === 'FAILED'
                                ? 'rgba(212, 23, 23, 0.12)'
                                : 'rgba(201, 125, 10, 0.12)',
                            color:
                              latestUpload.status === 'COMPLETED'
                                ? '#1A9966'
                                : latestUpload.status === 'FAILED'
                                ? '#D41717'
                                : '#C97D0A',
                          }}
                        >
                          {latestUpload.status}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Org Activity Feed */
        <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">Clinic Active Lab Scan Statuses</h4>
            <button
              onClick={fetchOrgUploads}
              className="text-[10px] font-semibold border border-border hover:bg-border/20 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-all bg-transparent"
            >
              Refresh
            </button>
          </div>

          {allUploads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No uploads registered under your organization.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {allUploads.map((upload) => {
                const date = new Date(upload.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={upload.id}
                    className="p-3.5 rounded-xl border border-border/40 bg-card/65 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background:
                            upload.status === 'COMPLETED'
                              ? 'rgba(26, 153, 102, 0.15)'
                              : upload.status === 'FAILED'
                              ? 'rgba(212, 23, 23, 0.15)'
                              : 'rgba(201, 125, 10, 0.15)',
                        }}
                      >
                        <FileText
                          className="w-4.5 h-4.5"
                          style={{
                            color:
                              upload.status === 'COMPLETED'
                                ? '#1A9966'
                                : upload.status === 'FAILED'
                                ? '#D41717'
                                : '#C97D0A',
                          }}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-foreground truncate max-w-[240px]">
                          {upload.fileName}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          Organization Upload · {date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            upload.status === 'COMPLETED'
                              ? 'rgba(26, 153, 102, 0.12)'
                              : upload.status === 'FAILED'
                              ? 'rgba(212, 23, 23, 0.12)'
                              : 'rgba(201, 125, 10, 0.12)',
                          color:
                            upload.status === 'COMPLETED'
                              ? '#1A9966'
                              : upload.status === 'FAILED'
                              ? '#D41717'
                              : '#C97D0A',
                        }}
                      >
                        {upload.status}
                      </span>

                      {upload.fileUrl && (
                        <button
                          onClick={() => window.open(upload.fileUrl, '_blank', 'noopener,noreferrer')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-border/20 cursor-pointer transition-all bg-transparent"
                          title="View uploaded PDF"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  function renderOverview() {
    const hasGrowth = patientStats.length >= 2;
    const upcoming = appointments
      .filter((a) => a.status === 'SCHEDULED' && new Date(a.startTime) >= new Date(Date.now() - 86400000))
      .slice(0, 5);

    return (
      <div className="flex flex-col gap-8">
        {summaryCards}

        {/* Patient Growth + Upcoming Appointments */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Patient Growth Line Graph */}
          <div className="xl:col-span-7 glass-card rounded-2xl p-6 border-border/40 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-bold text-foreground">Patient Growth</h4>
                <p className="text-xs text-muted-foreground">Cumulative registered patients by gender.</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary-text)' }} /> Male
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)' }} /> Female
                </span>
              </div>
            </div>

            {!hasGrowth ? (
              <div className="min-h-[240px] rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <TrendingUp className="w-10 h-10 text-muted-foreground animate-float" />
                <div>
                  <p className="font-semibold text-sm text-foreground">Not Enough History</p>
                  <p className="text-xs mt-0.5 max-w-[280px] text-muted-foreground">
                    Patient growth charts populate once you have signups across at least two months.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={patientStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" tick={{ fontSize: 9 }} />
                    <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="glass-card rounded-xl p-3 border border-border/40 shadow-md text-xs bg-card">
                              <p className="font-bold text-foreground mb-1">{label}</p>
                              {payload.map((p) => (
                                <p key={p.dataKey as string} className="font-semibold" style={{ color: p.color }}>
                                  {p.name}: {p.value}
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="male"
                      name="Male"
                      stroke="var(--primary-text)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="female"
                      name="Female"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="var(--muted-foreground)"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Upcoming Appointments snapshot */}
          <div className="xl:col-span-5 glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-foreground">Upcoming Appointments</h4>
                <p className="text-xs text-muted-foreground">{upcomingCount} scheduled.</p>
              </div>
              <button
                onClick={() => setIsApptModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shadow hover:opacity-90 border-0"
                style={{ background: 'var(--primary-text)' }}
              >
                New
              </button>
            </div>

            {upcoming.length === 0 ? (
              <div className="min-h-[180px] flex flex-col items-center justify-center text-center gap-2">
                <CalendarDays className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  No upcoming appointments. Schedule one to get started.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {upcoming.map((a) => (
                  <AppointmentRow key={a.id} appt={a} compact onStatus={updateAppointmentStatus} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent File Uploads */}
        <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-foreground">Recent File Uploads</h4>
              <p className="text-xs text-muted-foreground">Monitor the latest clinical reports received.</p>
            </div>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setStaffView('activity');
                fetchOrgUploads();
              }}
              className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer bg-transparent border-0"
            >
              View All Activity →
            </button>
          </div>

          {allUploads.length === 0 ? (
            <div className="min-h-[120px] flex flex-col items-center justify-center text-center gap-2 border-2 border-dashed border-border/60 rounded-xl p-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                No recent uploads.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...allUploads]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map((upload) => {
                  const date = new Date(upload.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={upload.id}
                      className="p-4 rounded-xl border border-border/40 bg-card/45 flex flex-col justify-between gap-3 hover:border-[var(--primary)]/50 transition-all duration-300 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background:
                              upload.status === 'COMPLETED'
                                ? 'rgba(26, 153, 102, 0.12)'
                                : upload.status === 'FAILED'
                                ? 'rgba(212, 23, 23, 0.12)'
                                : 'rgba(201, 125, 10, 0.12)',
                          }}
                        >
                          <FileText
                            className="w-5 h-5"
                            style={{
                              color:
                                upload.status === 'COMPLETED'
                                  ? '#1A9966'
                                  : upload.status === 'FAILED'
                                  ? '#D41717'
                                  : '#C97D0A',
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-foreground truncate" title={upload.fileName}>
                            {upload.fileName}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/20">
                        <span
                          className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full"
                          style={{
                            background:
                              upload.status === 'COMPLETED'
                                ? 'rgba(26, 153, 102, 0.12)'
                                : upload.status === 'FAILED'
                                ? 'rgba(212, 23, 23, 0.12)'
                                : 'rgba(201, 125, 10, 0.12)',
                            color:
                              upload.status === 'COMPLETED'
                                ? '#1A9966'
                                : upload.status === 'FAILED'
                                ? '#D41717'
                                : '#C97D0A',
                          }}
                        >
                          {upload.status}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {upload.fileUrl && (
                            <button
                              onClick={() => window.open(upload.fileUrl, '_blank', 'noopener,noreferrer')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-border/20 cursor-pointer transition-all bg-transparent"
                            >
                              <Eye className="w-3 h-3" />
                              PDF
                            </button>
                          )}

                          {upload.status === 'COMPLETED' && (
                            <button
                              onClick={async () => {
                                const toastId = toast.loading('Retrieving diagnostic details...');
                                try {
                                  const reportRes = await apiFetch<{ data: { upload: CompleteReportData } }>(
                                    `/reports/upload/${upload.id}`
                                  );
                                  setReportData(reportRes.data.upload);
                                  toast.success('Report successfully loaded!', { id: toastId });
                                  setViewState('REPORT');
                                } catch (err) {
                                  toast.error('Failed to load report analytics.', { id: toastId });
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold text-white shadow-sm hover:opacity-90 cursor-pointer border-0"
                              style={{ background: 'var(--primary-text)' }}
                            >
                              Review
                            </button>
                          )}
                        </div>
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

  function renderAppointments() {
    const now = Date.now();
    const todayStr = new Date().toDateString();
    const todays = appointments.filter((a) => new Date(a.startTime).toDateString() === todayStr);
    const upcoming = appointments.filter(
      (a) => new Date(a.startTime).toDateString() !== todayStr && new Date(a.startTime).getTime() >= now
    );
    const past = appointments.filter(
      (a) => new Date(a.startTime).getTime() < now && new Date(a.startTime).toDateString() !== todayStr
    );

    const Section = ({ title, items }: { title: string; items: AppointmentRecord[] }) => (
      <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col gap-3">
        <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">{items.length}</span>
        </h4>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Nothing here.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((a) => (
              <AppointmentRow key={a.id} appt={a} onStatus={updateAppointmentStatus} />
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">Appointment Dashboard</h3>
            <p className="text-xs text-muted-foreground">Manage your clinical schedule across the organization.</p>
          </div>
          <button
            onClick={() => setIsApptModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer border-0"
            style={{ background: 'var(--primary-text)' }}
          >
            New Appointment
          </button>
        </div>

        {appointmentsLoading ? (
          <div className="min-h-[200px] flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-text)]" />
            <p className="text-xs text-muted-foreground mt-2">Loading schedule...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Section title="Today" items={todays} />
            <Section title="Upcoming" items={upcoming} />
            <div className="lg:col-span-2">
              <Section title="Past" items={past} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sidebar navigation items
  const navItems: { id: typeof staffView; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'appointments', label: 'Appointments', icon: CalendarDays },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  // Coordinate staff tabs and clinicianTab
  const mainContent = selectedPatient ? (
    patientCaseFile
  ) : staffView === 'overview' ? (
    renderOverview()
  ) : staffView === 'appointments' ? (
    renderAppointments()
  ) : (
    directoryAndActivity
  );

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
      {/* Left Sidebar — App Navigation */}
      <aside className="hidden lg:flex flex-col gap-2 w-56 shrink-0 sticky top-[76px] self-start">
        <div id="clinician-tour-nav" className="glass-card rounded-2xl p-3 border-border/40 shadow-sm flex flex-col gap-1">
          {navItems.map((item) => {
            const active = !selectedPatient && staffView === item.id;
            return (
              <button
                key={item.id}
                id={`clinician-nav-item-${item.id}`}
                onClick={() => {
                  setSelectedPatient(null);
                  setStaffView(item.id);
                  if (item.id === 'patients') setClinicianTab('directory');
                  if (item.id === 'activity') {
                    setClinicianTab('activity');
                    fetchOrgUploads();
                  }
                }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left border-0 bg-transparent',
                  active
                    ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-border/20'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          id="clinician-tour-onboard-sidebar"
          onClick={() => setIsOnboardingOpen(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer border-0"
          style={{ background: 'var(--primary-text)' }}
        >
          <UserPlus className="w-4 h-4" />
          Onboard Patient
        </button>

        <button
          id="clinician-tour-upload"
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border hover:bg-border/20 transition-colors cursor-pointer bg-transparent"
          style={{ color: 'var(--primary-text)', borderColor: 'var(--primary-text)' }}
        >
          <Upload className="w-4 h-4 shrink-0" />
          Upload Lab PDF
        </button>
      </aside>

      {/* Main Column */}
      <main className="flex-1 min-w-0">
        {!selectedPatient && (
          <div className="lg:hidden flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-1">
            {navItems.map((item) => {
              const active = staffView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedPatient(null);
                    setStaffView(item.id);
                    if (item.id === 'patients') setClinicianTab('directory');
                    if (item.id === 'activity') {
                      setClinicianTab('activity');
                      fetchOrgUploads();
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border',
                    active ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] border-transparent shadow-sm' : 'border-border/50 text-muted-foreground bg-transparent'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {mainContent}
      </main>

      {/* Right Sidebar — Task Management */}
      <aside id="clinician-tour-tasks" className="hidden xl:block w-72 shrink-0 sticky top-[76px] self-start">
        <TaskSidebar
          tasks={tasks}
          loading={tasksLoading}
          onCreate={createTask}
          onToggle={toggleTaskStatus}
          onDelete={deleteTask}
        />
      </aside>

      {/* Modals */}
      <OnboardPatientModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSuccess={fetchPatients}
      />

      <AppointmentModal
        isOpen={isApptModalOpen}
        onClose={() => setIsApptModalOpen(false)}
        patients={patients}
        onSuccess={fetchAppointments}
      />

      <ClinicianUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        patients={patients}
        onUpload={handleFileUpload}
        onOnboardClick={() => {
          setIsUploadModalOpen(false);
          setIsOnboardingOpen(true);
        }}
      />
    </div>
  );
}
