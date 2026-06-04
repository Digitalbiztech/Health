import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ChevronLeft, Eye, RotateCcw, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

// Types
import type {
  DashboardState,
  UploadRecord,
  CompleteReportData,
  AppointmentRecord,
  TaskRecord,
  PatientStat,
  PatientRecord,
} from '@/types/dashboard';

// Extracted Sub-views & Modals
import { UploadScreen } from '@/components/dashboard/UploadScreen';
import { LoadingScreen } from '@/components/dashboard/LoadingScreen';
import { ErrorScreen } from '@/components/dashboard/ErrorScreen';
import { PatientHome } from '@/components/dashboard/PatientHome';
import { ReportDashboard } from '@/components/dashboard/ReportDashboard';
import { ClinicianDashboard } from '@/components/dashboard/ClinicianDashboard';

// Utilities
import { exportPDF, exportCSV } from '@/components/dashboard/utils';

export default function Dashboard() {
  const { principal, signOut, principalLoading } = useAuth();
  const [viewState, setViewState] = useState<DashboardState>('UPLOAD');
  const [patientView, setPatientView] = useState<'home' | 'upload'>('home');
  const [patientUploads, setPatientUploads] = useState<UploadRecord[]>([]);
  const [patientUploadsLoading, setPatientUploadsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Active report states
  const [currentFileName, setCurrentFileName] = useState('');
  const [reportData, setReportData] = useState<CompleteReportData | null>(null);

  // Historical database list (for Trend comparisons)
  const [comparisonReports, setComparisonReports] = useState<CompleteReportData[]>([]);

  // ─── Report Comparison ───────────────────────────────────────
  const [compareReportA, setCompareReportA] = useState<CompleteReportData | null>(null);
  const [compareReportB, setCompareReportB] = useState<CompleteReportData | null>(null);
  // null = not in upload mode; 'A'/'B' = which slot is currently uploading/polling
  const [compareUploadSlot, setCompareUploadSlot] = useState<'A' | 'B' | null>(null);
  const [compareUploading, setCompareUploading] = useState(false);

  // Poll intervals
  const pollTimerRef = useRef<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Clinician Dashboard States ──────────────────────────────
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [clinicianTab, setClinicianTab] = useState<'directory' | 'activity'>('directory');
  const [allUploads, setAllUploads] = useState<UploadRecord[]>([]);
  const [patientSubTab, setPatientSubTab] = useState<'reports' | 'trends' | 'compare' | 'insights'>('reports');
  const [selectedPatientReports, setSelectedPatientReports] = useState<CompleteReportData[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // ─── Overview / Scheduling / Tasks ───────────────────────────
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [patientStats, setPatientStats] = useState<PatientStat[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Appointment creation modal
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);

  // Onboarding Modal States
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Fetch initial history
  useEffect(() => {
    fetchUploadsHistory();
  }, [principal]);

  useEffect(() => {
    if (principal && principal.accountType === 'STAFF') {
      fetchPatients();
      fetchOrgUploads();
      fetchAppointments();
      fetchPatientStats();
      fetchTasks();
    }
    if (principal && principal.accountType === 'PATIENT') {
      fetchPatientUploads();
    }
  }, [principal]);

  async function fetchPatientUploads() {
    setPatientUploadsLoading(true);
    try {
      const res = await apiFetch<{ data: { uploads: UploadRecord[] } }>('/reports/uploads');
      setPatientUploads(res.data.uploads);
    } catch (err) {
      console.error('Failed to load patient uploads:', err);
    } finally {
      setPatientUploadsLoading(false);
    }
  }

  async function fetchPatients() {
    setPatientsLoading(true);
    try {
      const res = await apiFetch<{ data: { patients: PatientRecord[] } }>('/patients');
      setPatients(res.data.patients);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient directory.');
    } finally {
      setPatientsLoading(false);
    }
  }

  async function fetchOrgUploads() {
    try {
      const res = await apiFetch<{ data: { uploads: UploadRecord[] } }>('/reports/uploads');
      setAllUploads(res.data.uploads);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchAppointments() {
    setAppointmentsLoading(true);
    try {
      const res = await apiFetch<{ data: { appointments: AppointmentRecord[] } }>('/appointments');
      setAppointments(res.data.appointments);
    } catch (err) {
      console.error(err);
    } finally {
      setAppointmentsLoading(false);
    }
  }

  async function fetchPatientStats() {
    try {
      const res = await apiFetch<{ data: { stats: PatientStat[] } }>('/patients/stats');
      setPatientStats(res.data.stats);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchTasks() {
    setTasksLoading(true);
    try {
      const res = await apiFetch<{ data: { tasks: TaskRecord[] } }>('/tasks');
      setTasks(res.data.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  }

  // ─── Appointment mutations ───────────────────────────────────



  async function updateAppointmentStatus(id: string, status: AppointmentRecord['status']) {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await apiFetch(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update appointment.');
      fetchAppointments();
    }
  }

  // ─── Task mutations ──────────────────────────────────────────

  async function createTask(payload: { title: string; priority: TaskRecord['priority']; dueDate?: string }) {
    try {
      await apiFetch('/tasks', { method: 'POST', body: JSON.stringify(payload) });
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add task.');
    }
  }

  async function toggleTaskStatus(task: TaskRecord) {
    const next: TaskRecord['status'] = task.status === 'DONE' ? 'TODO' : 'DONE';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task.');
      fetchTasks();
    }
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete task.');
      fetchTasks();
    }
  }

  async function loadPatientTrendsAndDetails(patient: PatientRecord) {
    setSelectedPatient(patient);
    setPatientSubTab('reports');
    setTrendsLoading(true);
    try {
      const res = await apiFetch<{ data: { uploads: UploadRecord[] } }>('/reports/uploads');
      setAllUploads(res.data.uploads);

      const patientCompleted = res.data.uploads
        .filter((u) => u.patientId === patient.id && u.status === 'COMPLETED')
        .slice(0, 6);

      const fetched = await Promise.all(
        patientCompleted.map((u) =>
          apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${u.id}`)
            .then((r) => r.data.upload)
            .catch(() => null)
        )
      );
      const validReports = fetched.filter((r): r is CompleteReportData => r !== null);
      setSelectedPatientReports(validReports);
    } catch (err) {
      console.error(err);
    } finally {
      setTrendsLoading(false);
    }
  }



  async function fetchUploadsHistory() {
    if (!principal) return;
    try {
      const res = await apiFetch<{ data: { uploads: UploadRecord[] } }>('/reports/uploads');

      const completed = res.data.uploads.filter((u) => u.status === 'COMPLETED').slice(0, 5);
      const fetchedReports = await Promise.all(
        completed.map((u) =>
          apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${u.id}`)
            .then((r) => r.data.upload)
            .catch(() => null)
        )
      );
      setComparisonReports(fetchedReports.filter((r): r is CompleteReportData => r !== null));
    } catch (err) {
      console.error('Failed to prefetch history:', err);
    }
  }

  // ─── FILE UPLOAD HANDLERS ────────────────────────────────────

  async function handleFileUpload(file: File, compareSlot: 'A' | 'B' | null = null) {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF documents are supported for clinical processing.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds the 20MB maximum safety threshold.');
      return;
    }

    if (compareSlot) {
      setCompareUploading(true);
    } else {
      setUploading(true);
      setErrorMessage('');
    }

    const toastId = toast.loading(
      compareSlot ? `Uploading Report ${compareSlot}...` : 'Uploading lab report to secure storage...'
    );

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (principal?.accountType === 'STAFF' && selectedPatient) {
        formData.append('patientId', selectedPatient.id);
      }

      const res = await apiFetch<{ status: string; data: { upload: UploadRecord } }>('/reports/upload', {
        method: 'POST',
        body: formData,
      });

      toast.success(
        compareSlot ? `Report ${compareSlot} uploaded. Analyzing...` : 'File stored. Initializing AI parsing engines...',
        { id: toastId }
      );

      if (compareSlot) {
        setCompareUploadSlot(compareSlot);
        startStatusPolling(res.data.upload.id, compareSlot);
      } else {
        setCurrentFileName(file.name);
        setViewState('LOADING');
        startStatusPolling(res.data.upload.id, null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'File upload failed.', { id: toastId });
      if (!compareSlot) {
        setErrorMessage(err.message || 'An error occurred during secure transport.');
        setViewState('ERROR');
      }
    } finally {
      if (compareSlot) {
        setCompareUploading(false);
      } else {
        setUploading(false);
      }
    }
  }

  // ─── POLLING / EXTRACTION JOB STATE ORCHESTRATOR ─────────────

  function startStatusPolling(uploadId: string, compareSlot: 'A' | 'B' | null = null) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await apiFetch<{ data: { uploads: UploadRecord[] } }>('/reports/uploads');
        const upload = res.data.uploads.find((u) => u.id === uploadId);

        if (!upload) {
          clearInterval(pollTimerRef.current!);
          if (compareSlot) {
            toast.error(`Report ${compareSlot} upload reference was lost.`);
            setCompareUploadSlot(null);
          } else {
            setErrorMessage('Processing job tracking reference was lost.');
            setViewState('ERROR');
          }
          return;
        }

        if (upload.status === 'COMPLETED') {
          clearInterval(pollTimerRef.current!);
          const reportRes = await apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${uploadId}`);

          if (compareSlot === 'A') {
            setCompareReportA(reportRes.data.upload);
            setCompareUploadSlot(null);
            toast.success('Report A ready!');
          } else if (compareSlot === 'B') {
            setCompareReportB(reportRes.data.upload);
            setCompareUploadSlot(null);
            toast.success('Report B ready!');
          } else {
            setReportData(reportRes.data.upload);
            toast.success('Clinical analysis successfully rendered!');
            setViewState('REPORT');
            fetchUploadsHistory();
            if (principal?.accountType === 'STAFF') {
              fetchPatients();
              fetchOrgUploads();
              if (selectedPatient) {
                loadPatientTrendsAndDetails(selectedPatient);
              }
            }
          }
        } else if (upload.status === 'FAILED') {
          clearInterval(pollTimerRef.current!);
          if (compareSlot) {
            toast.error(`Report ${compareSlot} extraction failed.`);
            setCompareUploadSlot(null);
          } else {
            setErrorMessage('Lab extraction failed. The PDF structure or biomarker scanning layout is unsupported.');
            setViewState('ERROR');
          }
        }
      } catch (err: any) {
        console.error('Polling error:', err);
      }
    }, 1500);
  }

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const flaggedBiomarkers = reportData?.extraction?.biomarkers?.filter((b) => b.status !== 'NORMAL') || [];
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (flaggedBiomarkers.length * 12.5))));

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--background)' }}>
      {/* Radial background tint */}
      <div
        className="fixed inset-0 pointer-events-none opacity-5 dark:opacity-10 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 10% 20%, hsl(25 31% 75%) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, hsl(30 11% 69%) 0%, transparent 40%)
          `,
        }}
      />

      {/* Sticky Header */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: 'color-mix(in srgb, var(--background) 80%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Left — Logo */}
          <div
            className="flex items-center cursor-pointer"
            onClick={() => {
              setViewState('UPLOAD');
              setSelectedPatient(null);
              if (principal?.accountType === 'PATIENT') {
                setPatientView('home');
              }
            }}
          >
            <img
              src="/logo/041323 YC LogoDeck_Main-WG copy.png"
              alt="Auriem Logo"
              className="h-10 w-auto object-contain"
            />
          </div>

          {/* Right — Actions */}
          <div className="flex items-center gap-3">
            {viewState === 'REPORT' && (
              <>
                {reportData?.fileUrl && (
                  <button
                    onClick={() => window.open(reportData.fileUrl, '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-muted-foreground hover:text-foreground hover:bg-border/10 transition-all bg-transparent"
                    style={{ borderColor: 'var(--border)' }}
                    title="View the original uploaded PDF"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View PDF
                  </button>
                )}

                {principal?.accountType === 'STAFF' && (
                  <button
                    onClick={() => {
                      setViewState('UPLOAD');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer bg-[var(--primary)]/15 text-[var(--primary-text)] border-[var(--primary)]/30"
                  >
                    Back to Case File
                  </button>
                )}

                {principal?.accountType === 'PATIENT' && (
                  <button
                    onClick={() => {
                      setViewState('UPLOAD');
                      setPatientView('home');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer bg-[var(--primary)]/15 text-[var(--primary-text)] border-[var(--primary)]/30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    My Dashboard
                  </button>
                )}

                <button
                  onClick={() => {
                    setViewState('UPLOAD');
                    if (principal?.accountType === 'STAFF') {
                      fetchPatients();
                      fetchOrgUploads();
                    }
                    if (principal?.accountType === 'PATIENT') {
                      setPatientView('home');
                      fetchPatientUploads();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-muted-foreground hover:text-foreground bg-transparent"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>

                <div className="relative group">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shadow border-0"
                    style={{ background: 'var(--primary-text)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <div className="absolute right-0 top-full mt-1.5 w-36 glass-card rounded-xl border border-border/40 shadow-lg hidden group-hover:flex flex-col p-1.5 z-30">
                    <button
                      onClick={() => reportData && exportPDF(reportData, healthScore)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-border/30 cursor-pointer border-0 bg-transparent"
                    >
                      PDF Report
                    </button>
                    <button
                      onClick={() => reportData && exportCSV(reportData)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-border/30 cursor-pointer border-0 bg-transparent"
                    >
                      Flat CSV Matrix
                    </button>
                  </div>
                </div>
              </>
            )}

            {principal?.accountType === 'PATIENT' && viewState === 'UPLOAD' && patientView === 'upload' && (
              <button
                onClick={() => setPatientView('home')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer bg-[var(--primary)]/15 text-[var(--primary-text)] border-[var(--primary)]/30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                My Dashboard
              </button>
            )}

            {/* Theme Switcher */}
            <ThemeToggle />

            {/* Sign Out */}
            <button
              onClick={signOut}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer hover:bg-primary/10 bg-transparent'
              )}
              style={{
                color: 'var(--muted-foreground)',
                border: '1px solid var(--border)',
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="relative z-10">
        {principalLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-text)]" />
            <p className="text-xs text-muted-foreground mt-2">Resolving clinical security permissions...</p>
          </div>
        ) : principal?.accountType === 'STAFF' && viewState === 'UPLOAD' ? (
          <ClinicianDashboard
            patients={patients}
            allUploads={allUploads}
            appointments={appointments}
            selectedPatient={selectedPatient}
            setSelectedPatient={setSelectedPatient}
            fetchPatients={fetchPatients}
            fetchAppointments={fetchAppointments}
            patientsLoading={patientsLoading}
            selectedPatientReports={selectedPatientReports}
            trendsLoading={trendsLoading}
            patientSubTab={patientSubTab}
            setPatientSubTab={setPatientSubTab}
            clinicianTab={clinicianTab}
            setClinicianTab={setClinicianTab}
            fetchOrgUploads={fetchOrgUploads}
            loadPatientTrendsAndDetails={loadPatientTrendsAndDetails}
            isOnboardingOpen={isOnboardingOpen}
            setIsOnboardingOpen={setIsOnboardingOpen}
            handleFileUpload={handleFileUpload}
            setReportData={setReportData}
            setViewState={setViewState}
            compareReportA={compareReportA}
            setCompareReportA={setCompareReportA}
            compareReportB={compareReportB}
            setCompareReportB={setCompareReportB}
            compareUploading={compareUploading}
            compareUploadSlot={compareUploadSlot}
            appointmentsLoading={appointmentsLoading}
            patientStats={patientStats}
            tasks={tasks}
            tasksLoading={tasksLoading}
            createTask={createTask}
            toggleTaskStatus={toggleTaskStatus}
            deleteTask={deleteTask}
            updateAppointmentStatus={updateAppointmentStatus}
            isApptModalOpen={isApptModalOpen}
            setIsApptModalOpen={setIsApptModalOpen}
          />
        ) : principal?.accountType === 'PATIENT' && viewState === 'UPLOAD' && patientView === 'home' ? (
          <PatientHome
            principal={principal}
            patientUploads={patientUploads}
            patientUploadsLoading={patientUploadsLoading}
            comparisonReports={comparisonReports}
            setPatientView={setPatientView}
            fetchPatientUploads={fetchPatientUploads}
            fetchUploadsHistory={fetchUploadsHistory}
            setReportData={setReportData}
            setViewState={setViewState}
          />
        ) : (
          <>
            {viewState === 'UPLOAD' && (
              <UploadScreen
                uploading={uploading}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                handleFileUpload={handleFileUpload}
                fileInputRef={fileInputRef}
              />
            )}
            {viewState === 'LOADING' && (
              <LoadingScreen currentFileName={currentFileName} />
            )}
            {viewState === 'ERROR' && (
              <ErrorScreen
                errorMessage={errorMessage}
                onTryAgain={() => {
                  setViewState('UPLOAD');
                  setSelectedPatient(null);
                  if (principal?.accountType === 'PATIENT') {
                    setPatientView('home');
                  }
                }}
              />
            )}
            {viewState === 'REPORT' && reportData && (
              <ReportDashboard
                reportData={reportData}
                comparisonReports={comparisonReports}
                handleFileUpload={handleFileUpload}
                compareUploading={compareUploading}
                compareUploadSlot={compareUploadSlot}
                compareReportA={compareReportA}
                setCompareReportA={setCompareReportA}
                compareReportB={compareReportB}
                setCompareReportB={setCompareReportB}
              />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center py-4 border-t border-border/20 mt-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--muted-foreground)' }}>
          Powered by Huumanize
        </p>
      </footer>
    </div>
  );
}
