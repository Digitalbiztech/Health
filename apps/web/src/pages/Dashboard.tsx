import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LogOut,
  Upload,
  FileText,
  Activity,
  Lightbulb,
  Stethoscope,
  Loader2,
  Sparkles,
  RotateCcw,
  TrendingUp,
  MessageSquare,
  Send,
  Heart,
  Droplet,
  Brain,
  Download,
  ChevronRight,
  ShieldAlert,
  Dna,
  Search,
  UserPlus,
  ChevronLeft,
  User,
  Calendar,
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarPlus,
  Plus,
  Clock,
  Trash2,
  CheckCircle2,
  Circle,
  ListTodo,
  X,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceArea,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';

// ─── TYPES ───────────────────────────────────────────────────

type DashboardState = 'UPLOAD' | 'LOADING' | 'ERROR' | 'REPORT';

interface Biomarker {
  id: string;
  canonicalName: string;
  displayName: string;
  value: number;
  unit: string;
  referenceRange: string;
  referenceMin: number | null;
  referenceMax: number | null;
  status: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';
  category: string;
  confidence: number;
  description?: string;
  detailedAnalysis?: string;
}

interface UploadRecord {
  id: string;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

interface ReportRecord {
  id: string;
  title: string;
  summary: string;
  insights: {
    schemaVersion: number;
    flags: Array<{ biomarkerId: string; severity: string; note: string }>;
    recommendations: string[];
    summaryPoints: string[];
  };
  pdfUrl?: string;
  createdAt?: string;
}

interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface CompleteReportData {
  id: string;
  fileName: string;
  fileUrl?: string;
  status: string;
  patient: PatientRecord;
  extraction: {
    id: string;
    rawData: any;
    confidence: number;
    biomarkers: Biomarker[];
  } | null;
  reports: ReportRecord[];
}

interface AppointmentRecord {
  id: string;
  title: string;
  notes?: string | null;
  startTime: string;
  endTime?: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  patientId: string;
  patient?: { id: string; firstName: string | null; lastName: string | null; gender?: string } | null;
  user?: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string | null;
  patientId?: string | null;
  patient?: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface PatientStat {
  month: string;
  male: number;
  female: number;
  other: number;
  total: number;
}

// ─── COLOR MAPS ───────────────────────────────────────────────

const STATUS_COLORS = {
  NORMAL: {
    text: '#1A9966', // Teal-green
    bg: 'rgba(26, 153, 102, 0.1)',
    border: 'rgba(26, 153, 102, 0.2)',
  },
  LOW: {
    text: '#C97D0A', // Amber
    bg: 'rgba(201, 125, 10, 0.1)',
    border: 'rgba(201, 125, 10, 0.2)',
  },
  HIGH: {
    text: '#F04E14', // Orange-red
    bg: 'rgba(240, 78, 20, 0.1)',
    border: 'rgba(240, 78, 20, 0.2)',
  },
  CRITICAL: {
    text: '#D41717', // Deep red
    bg: 'rgba(212, 23, 23, 0.1)',
    border: 'rgba(212, 23, 23, 0.2)',
  },
};

const CATEGORY_ICONS: Record<string, any> = {
  Metabolic: Droplet,
  'Lipid Panel': Heart,
  CBC: Droplet,
  Thyroid: Brain,
};

// Task priority → accent color (reuses the status palette hues)
const PRIORITY_COLORS: Record<TaskRecord['priority'], string> = {
  HIGH: '#F04E14',
  MEDIUM: '#C97D0A',
  LOW: '#1A9966',
};

// Appointment status → badge palette
const APPT_STATUS_COLORS: Record<AppointmentRecord['status'], { text: string; bg: string }> = {
  SCHEDULED: { text: '#8a7a6a', bg: 'rgba(212, 189, 173, 0.18)' },
  COMPLETED: { text: '#1A9966', bg: 'rgba(26, 153, 102, 0.12)' },
  CANCELLED: { text: '#D41717', bg: 'rgba(212, 23, 23, 0.12)' },
  NO_SHOW: { text: '#C97D0A', bg: 'rgba(201, 125, 10, 0.12)' },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────

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

  // Workspace sub-navigation state
  const [activeTab, setActiveTab] = useState<'current' | 'trends' | 'ai-chat'>('current');
  const [selectedPanel, setSelectedPanel] = useState<string>('All');
  const [selectedBiomarkerDetail, setSelectedBiomarkerDetail] = useState<Biomarker | null>(null);

  // Poll intervals
  const pollTimerRef = useRef<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Clinician Dashboard States ──────────────────────────────
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [clinicianTab, setClinicianTab] = useState<'directory' | 'activity'>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [allUploads, setAllUploads] = useState<any[]>([]);
  const [patientSubTab, setPatientSubTab] = useState<'reports' | 'trends'>('reports');
  const [selectedPatientReports, setSelectedPatientReports] = useState<CompleteReportData[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // ─── Overview / Scheduling / Tasks ───────────────────────────
  const [staffView, setStaffView] = useState<'overview' | 'patients' | 'appointments' | 'activity'>('overview');
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [patientStats, setPatientStats] = useState<PatientStat[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Appointment creation modal
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [apptPatientId, setApptPatientId] = useState('');
  const [apptTitle, setApptTitle] = useState('');
  const [apptStart, setApptStart] = useState('');
  const [apptNotes, setApptNotes] = useState('');
  const [apptLoading, setApptLoading] = useState(false);

  // Onboarding Modal States
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardFirstName, setOnboardFirstName] = useState('');
  const [onboardLastName, setOnboardLastName] = useState('');
  const [onboardDob, setOnboardDob] = useState('');
  const [onboardGender, setOnboardGender] = useState('');
  const [onboardNote, setOnboardNote] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);

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
      const res = await apiFetch<{ data: { patients: any[] } }>('/patients');
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
      const res = await apiFetch<{ data: { uploads: any[] } }>('/reports/uploads');
      setAllUploads(res.data.uploads);
    } catch (err) {
      console.error(err);
    }
  }

  // ─── Scheduling / Stats / Tasks fetchers ─────────────────────

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

  async function handleApptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apptPatientId || !apptTitle || !apptStart) {
      toast.error('Patient, title and start time are required.');
      return;
    }
    setApptLoading(true);
    try {
      await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: apptPatientId,
          title: apptTitle,
          startTime: new Date(apptStart).toISOString(),
          notes: apptNotes || undefined,
        }),
      });
      toast.success('Appointment scheduled.');
      setIsApptModalOpen(false);
      setApptPatientId('');
      setApptTitle('');
      setApptStart('');
      setApptNotes('');
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule appointment.');
    } finally {
      setApptLoading(false);
    }
  }

  async function updateAppointmentStatus(id: string, status: AppointmentRecord['status']) {
    // Optimistic update
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

  async function loadPatientTrendsAndDetails(patient: any) {
    setSelectedPatient(patient);
    setPatientSubTab('reports');
    setTrendsLoading(true);
    try {
      const res = await apiFetch<{ data: { uploads: any[] } }>('/reports/uploads');
      setAllUploads(res.data.uploads);
      
      const patientCompleted = res.data.uploads
        .filter((u: any) => u.patientId === patient.id && u.status === 'COMPLETED')
        .slice(0, 6);

      const fetched = await Promise.all(
        patientCompleted.map((u: any) =>
          apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${u.id}`)
            .then(r => r.data.upload)
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

  function calculateAge(dobString: string): number {
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async function handleOnboardSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onboardEmail || !onboardFirstName || !onboardLastName || !onboardDob || !onboardGender) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setOnboardLoading(true);
    try {
      await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify({
          email: onboardEmail,
          firstName: onboardFirstName,
          lastName: onboardLastName,
          dateOfBirth: onboardDob,
          gender: onboardGender,
          note: onboardNote,
        }),
      });
      toast.success('Patient onboarded successfully!');
      setIsOnboardingOpen(false);
      setOnboardEmail('');
      setOnboardFirstName('');
      setOnboardLastName('');
      setOnboardDob('');
      setOnboardGender('');
      setOnboardNote('');
      fetchPatients();
    } catch (err: any) {
      toast.error(err.message || 'Failed to onboard patient.');
    } finally {
      setOnboardLoading(false);
    }
  }

  async function fetchUploadsHistory() {
    if (!principal) return;
    try {
      const res = await apiFetch<{ data: { uploads: UploadRecord[] } }>('/reports/uploads');
      
      // Prefetch completed reports for Trends/Comparison if available
      const completed = res.data.uploads.filter(u => u.status === 'COMPLETED').slice(0, 5);
      const fetchedReports = await Promise.all(
        completed.map(u => 
          apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${u.id}`)
            .then(r => r.data.upload)
            .catch(() => null)
        )
      );
      setComparisonReports(fetchedReports.filter((r): r is CompleteReportData => r !== null));
    } catch (err) {
      console.error('Failed to prefetch history:', err);
    }
  }

  // ─── FILE UPLOAD HANDLERS ────────────────────────────────────

  async function handleFileUpload(file: File) {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF documents are supported for clinical processing.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds the 20MB maximum safety threshold.');
      return;
    }

    setUploading(true);
    setErrorMessage('');
    const toastId = toast.loading('Uploading lab report to secure storage...');

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

      toast.success('File stored successfully. Initializing AI parsing engines...', { id: toastId });
      setCurrentFileName(file.name);
      setViewState('LOADING');
      
      // Start polling status
      startStatusPolling(res.data.upload.id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'File upload failed.', { id: toastId });
      setErrorMessage(err.message || 'An error occurred during secure transport.');
      setViewState('ERROR');
    } finally {
      setUploading(false);
    }
  }

  // ─── POLLING / EXTRACTION JOB STATE ORCHESTRATOR ─────────────

  function startStatusPolling(uploadId: string) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await apiFetch<{ data: { uploads: UploadRecord[] } }>('/reports/uploads');
        const upload = res.data.uploads.find(u => u.id === uploadId);

        if (!upload) {
          clearInterval(pollTimerRef.current!);
          setErrorMessage('Processing job tracking reference was lost.');
          setViewState('ERROR');
          return;
        }

        if (upload.status === 'COMPLETED') {
          clearInterval(pollTimerRef.current!);
          // Fetch final completed diagnostic report data
          const reportRes = await apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${uploadId}`);
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
        } else if (upload.status === 'FAILED') {
          clearInterval(pollTimerRef.current!);
          setErrorMessage('Lab extraction failed. The PDF structure or biomarker scanning layout is unsupported.');
          setViewState('ERROR');
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

  // ─── CLINICAL LOGIC ──────────────────────────────────────────

  const biomarkers = reportData?.extraction?.biomarkers || [];
  const activeReport = reportData?.reports?.[0];
  const patient = reportData?.patient;
  
  const panels = ['All', ...Array.from(new Set(biomarkers.map((b) => b.category)))];
  const filteredBiomarkers = selectedPanel === 'All' 
    ? biomarkers 
    : biomarkers.filter((b) => b.category === selectedPanel);

  const flaggedBiomarkers = biomarkers.filter((b) => b.status !== 'NORMAL');
  const normalBiomarkers = biomarkers.filter((b) => b.status === 'NORMAL');

  // Dynamic Health Score: Base of 100%, deducting 12% per abnormal marker, capped at 100
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (flaggedBiomarkers.length * 12.5))));

  // Get effective percentage for a needle in a three-zone bar (Low 20%, Optimal 60%, High 20%)
  function getEffectivePct(biomarker: Biomarker): number {
    const val = biomarker.value;
    const min = biomarker.referenceMin;
    const max = biomarker.referenceMax;

    if (biomarker.status === 'NORMAL') {
      if (min !== null && max !== null) {
        const offset = val - min;
        const range = max - min;
        return 20 + ((range > 0 ? offset / range : 0.5) * 60);
      }
      return 50;
    }
    if (biomarker.status === 'LOW') {
      if (min !== null) {
        const pct = Math.max(0, val / min);
        return pct * 20;
      }
      return 10;
    }
    if (biomarker.status === 'HIGH' || biomarker.status === 'CRITICAL') {
      if (max !== null) {
        const offset = val - max;
        // visual cap
        const pct = Math.min(1, offset / (max * 0.5 || 50));
        return 80 + (pct * 20);
      }
      return 90;
    }
    return 50;
  }

  // ─── PDF / CSV EXPORTS ───────────────────────────────────────

  function exportCSV() {
    if (!reportData || !reportData.extraction) return;
    const headers = 'Name,Value,Unit,Reference Range,Status,Category\n';
    const rows = reportData.extraction.biomarkers
      .map(
        (b) =>
          `"${b.displayName}",${b.value},"${b.unit}","${b.referenceRange}","${b.status}","${b.category}"`
      )
      .join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Lab_Report_Insights_${reportData.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Successfully exported flat CSV matrix.');
  }

  function exportPDF() {
    if (!reportData || !reportData.extraction || !activeReport) return;
    
    const doc = new jsPDF();
    const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
    const analyzedAt = new Date(reportData.reports[0].createdAt || Date.now()).toLocaleDateString();

    // Dark Slate Header Banner
    doc.setFillColor(18, 22, 28);
    doc.rect(0, 0, 210, 38, 'F');

    // Accent Stripe YC Gold
    doc.setFillColor(212, 189, 173);
    doc.rect(0, 38, 210, 2, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('AURIEM CLINICAL SUITE — DIAGNOSTICS SUMMARY', 14, 24);

    // Profile Details
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Patient Name: ${pName}`, 14, 52);
    doc.text(`DOB: ${patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}`, 14, 58);
    doc.text(`Gender: ${patient?.gender || 'N/A'}`, 14, 64);
    
    doc.text(`Report Title: ${activeReport.title}`, 120, 52);
    doc.text(`Analysis Date: ${analyzedAt}`, 120, 58);
    doc.text(`Health Score: ${healthScore}%`, 120, 64);

    // Divider Line
    doc.setDrawColor(210, 210, 210);
    doc.line(14, 70, 196, 70);

    // AI Summary
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CLINICAL ASSESSMENT SUMMARY', 14, 78);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const splitSummary = doc.splitTextToSize(activeReport.summary, 182);
    doc.text(splitSummary, 14, 84);

    // Recommendations Section
    let yPos = 84 + (splitSummary.length * 5) + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CLINICAL RECOMMENDATIONS', 14, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    activeReport.insights.recommendations.forEach((rec, idx) => {
      const splitRec = doc.splitTextToSize(`${idx + 1}. ${rec}`, 182);
      doc.text(splitRec, 14, yPos);
      yPos += (splitRec.length * 4.5) + 1;
    });

    yPos += 5;
    doc.line(14, yPos, 196, yPos);
    yPos += 8;

    // Biomarkers Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('BIOMARKER EXTRACTIONS PANEL', 14, yPos);
    yPos += 6;

    // Table Headers
    doc.setFillColor(235, 235, 235);
    doc.rect(14, yPos, 182, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Biomarker Name', 16, yPos + 5);
    doc.text('Value', 85, yPos + 5);
    doc.text('Reference Range', 115, yPos + 5);
    doc.text('Status', 165, yPos + 5);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    reportData.extraction.biomarkers.forEach((b, idx) => {
      // Row coloring alternate
      if (idx % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(14, yPos, 182, 7, 'F');
      }

      // Highlight abnormal
      if (b.status !== 'NORMAL') {
        doc.setTextColor(210, 40, 40);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
      }

      doc.text(b.displayName, 16, yPos + 5);
      doc.text(`${b.value} ${b.unit}`, 85, yPos + 5);
      doc.text(b.referenceRange || 'N/A', 115, yPos + 5);
      doc.text(b.status, 165, yPos + 5);
      yPos += 7;
    });

    // Disclaimer
    yPos += 12;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    const disclaimer = 'Disclaimer: This report is an AI-assisted translation of physical diagnostic materials for educational review. All diagnostic evaluations must be performed by a fully qualified board physician.';
    const splitDisc = doc.splitTextToSize(disclaimer, 182);
    doc.text(splitDisc, 14, yPos);

    doc.save(`Clinical_Insights_${pName.replace(/\s+/g, '_')}.pdf`);
    toast.success('Premium laboratory insights PDF downloaded!');
  }

  // ─── RENDERS — STATE 1: UPLOAD SCREEN ────────────────────────

  // ─── RENDERS — PATIENT HOME DASHBOARD ─────────────────────────

  function renderPatientHome() {
    const patientPrincipal = principal as import('@/contexts/AuthContext').PatientPrincipal;
    const totalUploads = patientUploads.length;
    const completedUploads = patientUploads.filter(u => u.status === 'COMPLETED').length;
    const pendingUploads = patientUploads.filter(u => u.status === 'PENDING' || u.status === 'PROCESSING').length;


    // Biomarker stats from comparison reports
    const latestReport = comparisonReports[0];
    const allBiomarkers = latestReport?.extraction?.biomarkers || [];
    const normalCount = allBiomarkers.filter(b => b.status === 'NORMAL').length;
    const abnormalCount = allBiomarkers.filter(b => b.status !== 'NORMAL').length;

    return (
      <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 flex flex-col gap-6">

        {/* ── Profile Card ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #D4BDAD, #B8A89A)' }}
            >
              {patientPrincipal?.firstName?.[0] || ''}{patientPrincipal?.lastName?.[0] || ''}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground">
                {patientPrincipal?.firstName} {patientPrincipal?.lastName}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {patientPrincipal?.email}
                </span>
                {patientPrincipal?.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(patientPrincipal.dateOfBirth).toLocaleDateString()} · Age {calculateAge(patientPrincipal.dateOfBirth)}
                  </span>
                )}
                {patientPrincipal?.gender && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212, 189, 173, 0.15)', color: '#8a7a6a' }}>
                    {patientPrincipal.gender}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setPatientView('upload')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              style={{ background: '#8a7a6a' }}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New Report
            </button>
          </div>
        </div>

        {/* ── Stats Cards ───────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Reports', val: totalUploads, icon: FileText, color: '#8a7a6a' },
            { label: 'Analyzed', val: completedUploads, icon: CheckCircle2, color: '#1A9966' },
            { label: 'Processing', val: pendingUploads, icon: Loader2, color: '#C97D0A', animate: pendingUploads > 0 },
            { label: 'Normal Markers', val: normalCount, icon: Heart, color: '#1A9966' },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="glass-card rounded-2xl p-5 border-border/40 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stat.val}</p>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212, 189, 173, 0.15)' }}>
                <stat.icon className={cn('w-5 h-5', stat.animate ? 'animate-spin' : '')} style={{ color: stat.color }} />
              </div>
            </div>
          ))}
        </section>

        {/* ── Main Content Grid ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left — Health At-a-Glance */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* Latest Health Summary */}
            <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
              <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-foreground)' }}>
                Health Snapshot
              </h4>
              {latestReport ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-[#1A9966]/5 border border-[#1A9966]/20 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#1A9966] bg-[#1A9966]/20">
                      {normalCount}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A9966]">Balanced Markers</p>
                      <p className="text-[10px] text-muted-foreground">Within normal reference range.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#F04E14]/5 border border-[#F04E14]/20 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#F04E14] bg-[#F04E14]/20">
                      {abnormalCount}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#F04E14]">Flagged Markers</p>
                      <p className="text-[10px] text-muted-foreground">Outside normal range — review recommended.</p>
                    </div>
                  </div>
                  {latestReport.reports?.[0]?.insights?.recommendations?.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-[#D4BDAD]/5 border border-[#D4BDAD]/20 rounded-xl">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#8a7a6a] bg-[#D4BDAD]/20">
                        {latestReport.reports[0].insights.recommendations.length}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#8a7a6a]">AI Recommendations</p>
                        <p className="text-[10px] text-muted-foreground">Personalized action items.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Stethoscope className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Upload your first lab report to see health insights.</p>
                </div>
              )}
            </div>

            {/* Quick AI Insights from latest report */}
            {latestReport?.reports?.[0]?.insights?.summaryPoints?.length > 0 && (
              <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
                  <Sparkles className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#8a7a6a' }} />
                  AI Summary
                </h4>
                <ul className="space-y-2">
                  {latestReport.reports[0].insights.summaryPoints.slice(0, 4).map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4BDAD] mt-1.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right — Reports History */}
          <div className="lg:col-span-8">
            <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  Lab Report History
                </h4>
                <button
                  onClick={() => { fetchPatientUploads(); fetchUploadsHistory(); }}
                  className="text-[10px] font-semibold border border-border hover:bg-border/20 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                >
                  Refresh
                </button>
              </div>

              {patientUploadsLoading ? (
                <div className="min-h-[200px] flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#8a7a6a]" />
                  <p className="text-xs text-muted-foreground mt-2">Loading your reports...</p>
                </div>
              ) : patientUploads.length === 0 ? (
                <div className="min-h-[220px] rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-xs text-foreground">No Reports Yet</p>
                    <p className="text-[10px] text-muted-foreground max-w-xs mt-0.5">
                      Upload your first blood work PDF to get personalized health insights and biomarker analysis.
                    </p>
                  </div>
                  <button
                    onClick={() => setPatientView('upload')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 cursor-pointer mt-2"
                    style={{ background: '#8a7a6a' }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Report
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {patientUploads.map((upload) => {
                    const date = new Date(upload.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    const sizeMb = upload.fileSize ? (upload.fileSize / (1024 * 1024)).toFixed(2) : null;

                    return (
                      <div
                        key={upload.id}
                        className="p-4 rounded-xl border border-border/40 bg-card/65 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{
                              background: upload.status === 'COMPLETED' ? 'rgba(26, 153, 102, 0.15)' :
                                          upload.status === 'FAILED' ? 'rgba(212, 23, 23, 0.15)' :
                                          'rgba(201, 125, 10, 0.15)'
                            }}
                          >
                            <FileText
                              className="w-5 h-5"
                              style={{
                                color: upload.status === 'COMPLETED' ? '#1A9966' :
                                       upload.status === 'FAILED' ? '#D41717' :
                                       '#C97D0A'
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-foreground truncate max-w-[240px]">
                              {upload.fileName}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {date}{sizeMb ? ` · ${sizeMb} MB` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span
                            className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: upload.status === 'COMPLETED' ? 'rgba(26, 153, 102, 0.12)' :
                                          upload.status === 'FAILED' ? 'rgba(212, 23, 23, 0.12)' :
                                          'rgba(201, 125, 10, 0.12)',
                              color: upload.status === 'COMPLETED' ? '#1A9966' :
                                     upload.status === 'FAILED' ? '#D41717' :
                                     '#C97D0A'
                            }}
                          >
                            {upload.status}
                          </span>

                          {upload.fileUrl && (
                            <button
                              onClick={() => window.open(upload.fileUrl, '_blank', 'noopener,noreferrer')}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-border/20 cursor-pointer transition-all"
                              title="View uploaded PDF"
                            >
                              <Eye className="w-3 h-3" />
                              PDF
                            </button>
                          )}

                          {upload.status === 'COMPLETED' && (
                            <button
                              onClick={async () => {
                                const toastId = toast.loading('Loading report analytics...');
                                try {
                                  const reportRes = await apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${upload.id}`);
                                  setReportData(reportRes.data.upload);
                                  toast.success('Report loaded!', { id: toastId });
                                  setViewState('REPORT');
                                } catch (err) {
                                  toast.error('Failed to load report.', { id: toastId });
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-sm hover:opacity-90 cursor-pointer"
                              style={{ background: '#8a7a6a' }}
                            >
                              Review
                            </button>
                          )}

                          {(upload.status === 'PENDING' || upload.status === 'PROCESSING') && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </span>
                          )}
                        </div>
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

  function renderUploadScreen() {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 animate-fade-in-up animate-float"
          style={{
            background: 'linear-gradient(135deg, #D4BDAD, #B8A89A)',
            boxShadow: '0 12px 40px rgba(212, 189, 173, 0.3)',
          }}
        >
          <Stethoscope className="w-12 h-12 text-white" />
        </div>

        <h2
          className="text-3xl font-bold tracking-tight mb-2 animate-fade-in-up"
          style={{ color: 'var(--foreground)', animationDelay: '0.05s' }}
        >
          Analyze Your Lab Results
        </h2>
        <p
          className="text-base mb-10 max-w-md animate-fade-in-up"
          style={{ color: 'var(--muted-foreground)', animationDelay: '0.1s' }}
        >
          Upload your blood work report and get AI-powered insights, biomarker visualization, and personalized health recommendations.
        </p>

        {/* Real Drop & Upload zone */}
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

        <div
          className={cn(
            "w-full min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 p-8 transition-all duration-300 cursor-pointer group animate-fade-in-up",
            isDragging ? "border-[#D4BDAD] bg-[#D4BDAD]/10" : "border-border hover:bg-[#D4BDAD]/5 hover:border-[#D4BDAD]"
          )}
          style={{ animationDelay: '0.15s' }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileUpload(file);
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{ background: 'rgba(212, 189, 173, 0.2)' }}
          >
            {uploading ? (
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#8a7a6a' }} />
            ) : (
              <Upload className="w-7 h-7" style={{ color: '#8a7a6a' }} />
            )}
          </div>
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
              {uploading ? 'Uploading and securing report buffer...' : 'Drop your lab report here or click to browse'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              PDF only · Max 20MB
            </p>
          </div>
          <span
            className="px-4 py-2 rounded-lg text-sm font-medium pointer-events-none transition-all"
            style={{
              background: '#8a7a6a',
              color: 'white',
            }}
          >
            Choose File
          </span>
        </div>

        {/* Feature Grid */}
        <div
          className="grid grid-cols-3 gap-4 w-full mt-12 animate-fade-in-up"
          style={{ animationDelay: '0.2s' }}
        >
          {[
            {
              icon: FileText,
              title: 'All Panels',
              color: 'var(--primary)',
            },
            {
              icon: Activity,
              title: 'Visual Ranges',
              color: 'var(--status-normal)',
            },
            {
              icon: Lightbulb,
              title: 'AI Insights',
              color: '#8a7a6a',
            },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 transition-all duration-200 hover:shadow-lg"
              style={{ animationDelay: `${0.2 + i * 0.04}s` }}
            >
              <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--foreground)' }}
              >
                {feature.title}
              </span>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ─── RENDERS — STATE 2: LOADING SCREEN ───────────────────────

  function renderLoadingScreen() {
    return (
      <main className="min-h-[80vh] flex flex-col items-center justify-center px-6">
        <div className="relative w-36 h-36 flex items-center justify-center mb-8">
          {/* Animated orb */}
          <div
            className="absolute inset-0 rounded-full border-4 border-dashed border-[#D4BDAD]/40 animate-spin"
            style={{ animationDuration: '6s' }}
          />
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center animate-pulse-glow"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 189, 173, 0.2), rgba(184, 168, 154, 0.2))',
              boxShadow: '0 0 25px rgba(212, 189, 173, 0.4)',
            }}
          >
            <Dna className="w-10 h-10 animate-float" style={{ color: '#8a7a6a' }} />
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
          Analyzing Your Lab Results
        </h3>
        <p className="text-sm mb-8 text-center max-w-sm" style={{ color: 'var(--muted-foreground)' }}>
          File: <span className="font-semibold text-[#8a7a6a]">{currentFileName}</span>
        </p>

        {/* 3 Staggered Processing Steps */}
        <div className="flex flex-col gap-3 w-full max-w-md">
          {[
            { label: 'Extracting biomarkers', icon: FileText, delay: 0 },
            { label: 'Calculating ranges', icon: Activity, delay: 0.2 },
            { label: 'Generating insights', icon: Sparkles, delay: 0.4 },
          ].map((step) => (
            <div
              key={step.label}
              className="glass-card rounded-xl p-4 flex items-center justify-between border-border/40 shadow-sm"
              style={{
                animation: 'fade-in-up 0.5s ease-out forwards',
                animationDelay: `${step.delay}s`,
                opacity: 0,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(212, 189, 173, 0.15)' }}
                >
                  <step.icon className="w-4 h-4" style={{ color: '#8a7a6a' }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {step.label}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#D4BDAD] animate-ping" />
                <span className="w-2 h-2 rounded-full bg-[#D4BDAD]" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ─── RENDERS — STATE 3: ERROR SCREEN ─────────────────────────

  function renderErrorScreen() {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(212, 23, 23, 0.1)' }}
        >
          <ShieldAlert className="w-8 h-8 text-[#D41717]" />
        </div>

        <h3 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--foreground)' }}>
          Analysis Failed
        </h3>
        <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
          {errorMessage || 'Secure optical extraction server failed to classify the report contents.'}
        </p>

        <button
          onClick={() => setViewState('UPLOAD')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all shadow-md hover:scale-[1.02]"
          style={{ background: '#8a7a6a' }}
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </main>
    );
  }

  // ─── RENDERS — STATE 4: REPORT DASHBOARD ─────────────────────

  function renderReportDashboard() {
    const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
    
    // Status segments for pie chart
    const pieData = [
      { name: 'Normal', value: normalBiomarkers.length, color: '#1A9966' },
      { name: 'Abnormal', value: flaggedBiomarkers.length, color: '#F04E14' },
    ].filter(s => s.value > 0);

    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* ── Patient Banner ─────────────────────────────────── */}
        <section className="glass-card rounded-2xl p-6 border-border/40 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #D4BDAD, #B8A89A)' }}
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
                  borderColor: 'rgba(212, 189, 173, 0.2)',
                }}
              >
                <p className="text-lg font-bold" style={{ color: '#8a7a6a' }}>{stat.val}</p>
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
        <section className="flex gap-2 p-1.5 rounded-xl border border-border/40 mb-8 max-w-md" style={{ background: 'var(--card)' }}>
          {[
            { id: 'current', label: 'Current Report', icon: FileText },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
            { id: 'ai-chat', label: 'Personalized Medical Care', icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeTab === tab.id
                  ? 'bg-[#D4BDAD]/15 text-[#8a7a6a] shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label === 'Personalized Medical Care' ? 'AI Care' : tab.label}
            </button>
          ))}
        </section>

        {/* ── Tab Content ────────────────────────────────────── */}
        {activeTab === 'current' && renderCurrentReportTab(pieData)}
        {activeTab === 'trends' && <TrendAnalysisChart biomarkers={biomarkers} comparisonReports={comparisonReports} />}
        {activeTab === 'ai-chat' && <AIChat biomarkers={biomarkers} patient={patient} />}
      </div>
    );
  }

  // ─── TAB 1: CURRENT REPORT ───────────────────────────────────

  function renderCurrentReportTab(pieData: any[]) {
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
                      className="p-3 rounded-xl border border-border/40 hover:border-[#D4BDAD] transition-all cursor-pointer flex items-center justify-between group"
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
                const panelMarkers = panel === 'All' ? biomarkers : biomarkers.filter(b => b.category === panel);
                const panelFlagged = panelMarkers.filter(b => b.status !== 'NORMAL').length;

                return (
                  <button
                    key={panel}
                    onClick={() => setSelectedPanel(panel)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-2',
                      isSelected
                        ? 'bg-[#D4BDAD] text-white shadow-sm font-bold'
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
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={
                    panels.filter(p => p !== 'All').map(p => {
                      const list = biomarkers.filter(b => b.category === p);
                      const norm = list.filter(b => b.status === 'NORMAL').length;
                      const score = Math.round((norm / list.length) * 100);
                      return { subject: p, score };
                    })
                  }>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--muted-foreground)' }} />
                    <Radar name="Body Index" dataKey="score" stroke="#8a7a6a" fill="#D4BDAD" fillOpacity={0.4} />
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
                    className="p-4 rounded-xl border border-border/40 hover:border-[#D4BDAD]/60 hover:shadow-md cursor-pointer transition-all flex flex-col gap-3 group bg-card"
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

  // ─── RENDERS — CLINICIAN PORTAL DASHBOARD ───────────────────

  function renderClinicianDashboard() {
    const totalPatients = patients.length;
    const totalReports = allUploads.length;
    const processingQueue = allUploads.filter(u => u.status === 'PENDING' || u.status === 'PROCESSING').length;
    const failedReports = allUploads.filter(u => u.status === 'FAILED').length;

    const filteredPatients = patients.filter(p => {
      const query = searchTerm.toLowerCase();
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      return fullName.includes(query) || (p.email || '').toLowerCase().includes(query);
    });

    const upcomingCount = appointments.filter(
      (a) => a.status === 'SCHEDULED' && new Date(a.startTime) >= new Date(Date.now() - 86400000),
    ).length;

    const summaryCards = (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Registered Patients', val: totalPatients, icon: User, color: '#8a7a6a' },
              { label: 'Total Lab Reports', val: totalReports, icon: FileText, color: 'var(--primary)' },
              { label: 'Processing Queue', val: processingQueue, icon: Loader2, color: '#C97D0A', animate: processingQueue > 0 },
              { label: 'Failed Extractions', val: failedReports, icon: ShieldAlert, color: '#D41717' },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="glass-card rounded-2xl p-5 border-border/40 shadow-sm flex items-center justify-between"
              >
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
                  style={{ background: 'rgba(212, 189, 173, 0.15)' }}
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
                  className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-border/20 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #D4BDAD, #B8A89A)' }}
                >
                  {selectedPatient.firstName?.[0] || ''}{selectedPatient.lastName?.[0] || ''}
                </div>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(212, 189, 173, 0.15)', color: '#8a7a6a' }}>
                      {selectedPatient.gender}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()} · Age: {calculateAge(selectedPatient.dateOfBirth)} · Email: {selectedPatient.email}
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
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer"
                  style={{ background: '#8a7a6a' }}
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
                    {selectedPatient.note || 'No clinical intake notes entered for this patient. Click "Onboard Patient" or manage records to append details.'}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border-border/40 shadow-sm">
                  <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-foreground)' }}>
                    Diagnostic Summary Indicators
                  </h4>
                  {selectedPatientReports.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No complete parsed lab diagnostics found for trends.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Show Health Score of latest report */}
                      <div className="flex items-center gap-3 p-3 bg-[#D4BDAD]/5 border border-[#D4BDAD]/20 rounded-xl">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#8a7a6a] bg-[#D4BDAD]/20">
                          {selectedPatientReports[0].reports?.[0]?.insights?.recommendations?.length || 0}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">AI Action Items</p>
                          <p className="text-[10px] text-muted-foreground">Action points suggested in latest labs.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-[#1A9966]/5 border border-[#1A9966]/20 rounded-xl">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#1A9966] bg-[#1A9966]/20">
                          {selectedPatientReports[0].extraction?.biomarkers?.filter(b => b.status === 'NORMAL').length || 0}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1A9966]">Balanced Markers</p>
                          <p className="text-[10px] text-muted-foreground">Monitored metrics within reference range.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-[#F04E14]/5 border border-[#F04E14]/20 rounded-xl">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[#F04E14] bg-[#F04E14]/20">
                          {selectedPatientReports[0].extraction?.biomarkers?.filter(b => b.status !== 'NORMAL').length || 0}
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
                <div className="flex gap-2 p-1 rounded-xl border border-border/40 max-w-xs" style={{ background: 'var(--card)' }}>
                  {[
                    { id: 'reports', label: 'Uploads & Reports', icon: FileText },
                    { id: 'trends', label: 'Biomarker Trends', icon: TrendingUp },
                  ].map((subTab) => (
                    <button
                      key={subTab.id}
                      onClick={() => setPatientSubTab(subTab.id as any)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer',
                        patientSubTab === subTab.id
                          ? 'bg-[#D4BDAD]/15 text-[#8a7a6a] font-bold shadow-sm'
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
                    
                    {allUploads.filter(u => u.patientId === selectedPatient.id).length === 0 ? (
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
                          .filter(u => u.patientId === selectedPatient.id)
                          .map((upload) => {
                            const date = new Date(upload.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            const sizeMb = (upload.fileSize / (1024 * 1024)).toFixed(2);
                            
                            return (
                              <div
                                key={upload.id}
                                className="p-4 rounded-xl border border-border/40 bg-card/65 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow transition-shadow"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                                    style={{
                                      background: upload.status === 'COMPLETED' ? 'rgba(26, 153, 102, 0.15)' :
                                                  upload.status === 'FAILED' ? 'rgba(212, 23, 23, 0.15)' :
                                                  'rgba(201, 125, 10, 0.15)'
                                    }}
                                  >
                                    <FileText
                                      className="w-5 h-5"
                                      style={{
                                        color: upload.status === 'COMPLETED' ? '#1A9966' :
                                               upload.status === 'FAILED' ? '#D41717' :
                                               '#C97D0A'
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
                                  {/* Status badge */}
                                  <span
                                    className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
                                    style={{
                                      background: upload.status === 'COMPLETED' ? 'rgba(26, 153, 102, 0.12)' :
                                                  upload.status === 'FAILED' ? 'rgba(212, 23, 23, 0.12)' :
                                                  'rgba(201, 125, 10, 0.12)',
                                      color: upload.status === 'COMPLETED' ? '#1A9966' :
                                             upload.status === 'FAILED' ? '#D41717' :
                                             '#C97D0A'
                                    }}
                                  >
                                    {upload.status}
                                  </span>

                                  {/* View Original PDF */}
                                  {upload.fileUrl && (
                                    <button
                                      onClick={() => window.open(upload.fileUrl, '_blank', 'noopener,noreferrer')}
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-border/20 cursor-pointer transition-all"
                                      title="View uploaded PDF"
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
                                          const reportRes = await apiFetch<{ data: { upload: CompleteReportData } }>(`/reports/upload/${upload.id}`);
                                          setReportData(reportRes.data.upload);
                                          toast.success('Report successfully loaded!', { id: toastId });
                                          setViewState('REPORT');
                                        } catch (err) {
                                          toast.error('Failed to load report analytics.', { id: toastId });
                                        }
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-sm hover:opacity-90 cursor-pointer"
                                      style={{ background: '#8a7a6a' }}
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
                ) : (
                  <div>
                    {trendsLoading ? (
                      <div className="glass-card rounded-2xl p-8 border-border/40 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
                        <Loader2 className="w-6 h-6 animate-spin text-[#8a7a6a] mb-2" />
                        <span className="text-xs text-muted-foreground">Aggregating historical biomarkers...</span>
                      </div>
                    ) : (
                      <TrendAnalysisChart
                        biomarkers={selectedPatientReports[0]?.extraction?.biomarkers || []}
                        comparisonReports={selectedPatientReports}
                      />
                    )}
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
                    'px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all',
                    clinicianTab === 'directory'
                      ? 'bg-[#D4BDAD]/15 text-[#8a7a6a] font-bold shadow-sm'
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
                    'px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all',
                    clinicianTab === 'activity'
                      ? 'bg-[#D4BDAD]/15 text-[#8a7a6a] font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Org Activity Feed
                </button>
              </div>

              {/* Onboard patient button */}
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer"
                style={{ background: '#8a7a6a' }}
              >
                <UserPlus className="w-4 h-4" />
                Onboard Patient
              </button>
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
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-card text-foreground outline-none focus:border-[#D4BDAD] transition-colors"
                  />
                </div>

                {patientsLoading ? (
                  <div className="min-h-[200px] flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#8a7a6a]" />
                    <p className="text-xs text-muted-foreground mt-2">Loading patients directory...</p>
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="glass-card rounded-2xl p-12 border-border/40 shadow-sm text-center flex flex-col items-center justify-center min-h-[220px]">
                    <User className="w-10 h-10 text-muted-foreground mb-3" />
                    <h5 className="font-semibold text-sm text-foreground">No Patients Found</h5>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      {searchTerm ? 'No patients matched your search queries.' : 'Onboard a patient to begin managing their laboratory diagnostic cases.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPatients.map((patient) => {
                      const age = calculateAge(patient.dateOfBirth);
                      const latestUpload = patient.uploads?.[0];
                      const totalUploadsCount = patient.uploads?.length || 0;
                      
                      return (
                        <div
                          key={patient.id}
                          onClick={() => loadPatientTrendsAndDetails(patient)}
                          className="glass-card rounded-xl p-5 border-border/40 hover:border-[#D4BDAD]/65 hover:shadow-md cursor-pointer transition-all flex flex-col gap-4 bg-card group"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-white text-sm transition-transform group-hover:scale-105"
                              style={{ background: 'linear-gradient(135deg, #D4BDAD, #B8A89A)' }}
                            >
                              {patient.firstName?.[0] || ''}{patient.lastName?.[0] || ''}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-foreground truncate">
                                {patient.firstName} {patient.lastName}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {patient.email}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                          </div>

                          <div className="border-t border-border/40 pt-3 flex justify-between text-[10px] text-muted-foreground">
                            <span>Age: <strong className="text-foreground">{age}</strong> · {patient.gender}</span>
                            <span>Reports: <strong className="text-[#8a7a6a]">{totalUploadsCount}</strong></span>
                          </div>

                          {latestUpload && (
                            <div className="border-t border-border/30 pt-2 flex items-center justify-between text-[9px]">
                              <span className="text-muted-foreground truncate max-w-[150px]">Labs: {latestUpload.fileName}</span>
                              <span
                                className="uppercase font-bold px-1.5 py-0.5 rounded-full text-[8px]"
                                style={{
                                  background: latestUpload.status === 'COMPLETED' ? 'rgba(26, 153, 102, 0.12)' :
                                              latestUpload.status === 'FAILED' ? 'rgba(212, 23, 23, 0.12)' :
                                              'rgba(201, 125, 10, 0.12)',
                                  color: latestUpload.status === 'COMPLETED' ? '#1A9966' :
                                         latestUpload.status === 'FAILED' ? '#D41717' :
                                         '#C97D0A'
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
                    className="text-[10px] font-semibold border border-border hover:bg-border/20 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                  >
                    Refresh
                  </button>
                </div>

                {allUploads.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No uploads registered under your organization.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {allUploads.map((upload) => {
                      const date = new Date(upload.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                      
                      return (
                        <div
                          key={upload.id}
                          className="p-3.5 rounded-xl border border-border/40 bg-card/65 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{
                                background: upload.status === 'COMPLETED' ? 'rgba(26, 153, 102, 0.15)' :
                                            upload.status === 'FAILED' ? 'rgba(212, 23, 23, 0.15)' :
                                            'rgba(201, 125, 10, 0.15)'
                              }}
                            >
                              <FileText
                                className="w-4.5 h-4.5"
                                style={{
                                  color: upload.status === 'COMPLETED' ? '#1A9966' :
                                         upload.status === 'FAILED' ? '#D41717' :
                                         '#C97D0A'
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
                                background: upload.status === 'COMPLETED' ? 'rgba(26, 153, 102, 0.12)' :
                                            upload.status === 'FAILED' ? 'rgba(212, 23, 23, 0.12)' :
                                            'rgba(201, 125, 10, 0.12)',
                                color: upload.status === 'COMPLETED' ? '#1A9966' :
                                       upload.status === 'FAILED' ? '#D41717' :
                                       '#C97D0A'
                              }}
                            >
                              {upload.status}
                            </span>

                            {/* View Original PDF */}
                            {upload.fileUrl && (
                              <button
                                onClick={() => window.open(upload.fileUrl, '_blank', 'noopener,noreferrer')}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-border/20 cursor-pointer transition-all"
                                title="View uploaded PDF"
                              >
                                <Eye className="w-3 h-3" />
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

    {/* ─── ONBOARD PATIENT GLASSMORPHISM MODAL ───────────────── */}
    const onboardModal = isOnboardingOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsOnboardingOpen(false)} />
            <div
              className="relative glass-card w-full max-w-md rounded-2xl p-6 border-border/40 shadow-xl overflow-hidden bg-card/95 animate-scale-in"
              style={{
                borderColor: 'color-mix(in srgb, var(--border) 40%, transparent)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
              }}
            >
              <h3 className="text-base font-bold text-foreground mb-1">Onboard New Patient</h3>
              <p className="text-xs text-muted-foreground mb-4">Register an authenticated profile under your clinical portal organization.</p>

              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={onboardFirstName}
                      onChange={(e) => setOnboardFirstName(e.target.value)}
                      placeholder="Jane"
                      className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={onboardLastName}
                      onChange={(e) => setOnboardLastName(e.target.value)}
                      placeholder="Smith"
                      className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={onboardEmail}
                    onChange={(e) => setOnboardEmail(e.target.value)}
                    placeholder="jane.smith@example.com"
                    className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date of Birth</label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={onboardDob}
                        onChange={(e) => setOnboardDob(e.target.value)}
                        className="w-full text-xs rounded-xl px-3.5 py-2.5 pr-8 outline-none border border-border/60 bg-card text-foreground"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Biological Gender</label>
                    <select
                      required
                      value={onboardGender}
                      onChange={(e) => setOnboardGender(e.target.value)}
                      className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground cursor-pointer"
                    >
                      <option value="" disabled>Select</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Intake Comments / Notes</label>
                  <textarea
                    rows={2.5}
                    value={onboardNote}
                    onChange={(e) => setOnboardNote(e.target.value)}
                    placeholder="E.g., History of high cholesterol, lipid metrics checkup panel, YC project notes."
                    className="w-full text-xs rounded-xl px-3.5 py-2 outline-none border border-border/60 bg-card text-foreground resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOnboardingOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-border hover:bg-border/20 text-muted-foreground transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboardLoading}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
                    style={{ background: '#8a7a6a' }}
                  >
                    {onboardLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Onboard Patient
                  </button>
                </div>
              </form>
            </div>
          </div>
    ) : null;

    // Sidebar navigation items
    const navItems: { id: typeof staffView; label: string; icon: any }[] = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'patients', label: 'Patients', icon: Users },
      { id: 'appointments', label: 'Appointments', icon: CalendarDays },
      { id: 'activity', label: 'Activity', icon: Activity },
    ];

    // When a patient case file is open it takes over the main column entirely.
    const mainContent = selectedPatient ? (
      patientCaseFile
    ) : staffView === 'overview' ? (
      renderOverview(summaryCards, upcomingCount)
    ) : staffView === 'appointments' ? (
      renderAppointments()
    ) : (
      // 'patients' and 'activity' share the directory/activity block; sync clinicianTab
      directoryAndActivity
    );

    return (
      <div className="flex gap-6 max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
        {/* ── Left Sidebar — App Navigation ─────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-2 w-56 shrink-0 sticky top-[76px] self-start">
          <div className="glass-card rounded-2xl p-3 border-border/40 shadow-sm flex flex-col gap-1">
            {navItems.map((item) => {
              const active = !selectedPatient && staffView === item.id;
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left',
                    active
                      ? 'bg-[#D4BDAD]/15 text-[#8a7a6a] shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-border/20',
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Onboard shortcut */}
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer"
            style={{ background: '#8a7a6a' }}
          >
            <UserPlus className="w-4 h-4" />
            Onboard Patient
          </button>
        </aside>

        {/* ── Main Column ───────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Mobile nav (sidebar collapses to a horizontal scroller) */}
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
                      if (item.id === 'activity') { setClinicianTab('activity'); fetchOrgUploads(); }
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                      active ? 'bg-[#D4BDAD]/15 text-[#8a7a6a] shadow-sm' : 'border border-border/50 text-muted-foreground',
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

        {/* ── Right Sidebar — Task Management ────────────────────── */}
        <aside className="hidden xl:block w-72 shrink-0 sticky top-[76px] self-start">
          <TaskSidebar
            tasks={tasks}
            loading={tasksLoading}
            onCreate={createTask}
            onToggle={toggleTaskStatus}
            onDelete={deleteTask}
          />
        </aside>

        {onboardModal}
        {renderAppointmentModal()}
      </div>
    );
  }

  // ─── RENDERS — OVERVIEW (Doctor Dashboard home) ──────────────

  function renderOverview(summaryCards: React.ReactNode, upcomingCount: number) {
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
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#8a7a6a' }} /> Male
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#D4BDAD' }} /> Female
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
                    <RechartsTooltip content={({ active, payload, label }) => {
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
                    }} />
                    <Line type="monotone" dataKey="male" name="Male" stroke="#8a7a6a" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="female" name="Female" stroke="#D4BDAD" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shadow hover:opacity-90"
                style={{ background: '#8a7a6a' }}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            {upcoming.length === 0 ? (
              <div className="min-h-[180px] flex flex-col items-center justify-center text-center gap-2">
                <CalendarDays className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground max-w-[220px]">No upcoming appointments. Schedule one to get started.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {upcoming.map((a) => <AppointmentRow key={a.id} appt={a} compact onStatus={updateAppointmentStatus} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDERS — APPOINTMENTS DASHBOARD ────────────────────────

  function renderAppointments() {
    const now = Date.now();
    const todayStr = new Date().toDateString();
    const todays = appointments.filter((a) => new Date(a.startTime).toDateString() === todayStr);
    const upcoming = appointments.filter(
      (a) => new Date(a.startTime).toDateString() !== todayStr && new Date(a.startTime).getTime() >= now,
    );
    const past = appointments.filter((a) => new Date(a.startTime).getTime() < now && new Date(a.startTime).toDateString() !== todayStr);

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
            {items.map((a) => <AppointmentRow key={a.id} appt={a} onStatus={updateAppointmentStatus} />)}
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
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer"
            style={{ background: '#8a7a6a' }}
          >
            <CalendarPlus className="w-4 h-4" />
            New Appointment
          </button>
        </div>

        {appointmentsLoading ? (
          <div className="min-h-[200px] flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#8a7a6a]" />
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

  // ─── RENDERS — NEW APPOINTMENT MODAL ─────────────────────────

  function renderAppointmentModal() {
    if (!isApptModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsApptModalOpen(false)} />
        <div
          className="relative glass-card w-full max-w-md rounded-2xl p-6 border-border/40 shadow-xl overflow-hidden bg-card/95 animate-scale-in"
          style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-foreground">Schedule Appointment</h3>
            <button onClick={() => setIsApptModalOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Book a clinical visit for a patient in your organization.</p>

          <form onSubmit={handleApptSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Patient</label>
              <select
                required
                value={apptPatientId}
                onChange={(e) => setApptPatientId(e.target.value)}
                className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground cursor-pointer"
              >
                <option value="" disabled>Select a patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Title</label>
              <input
                type="text"
                required
                value={apptTitle}
                onChange={(e) => setApptTitle(e.target.value)}
                placeholder="e.g., Lipid panel follow-up"
                className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date &amp; Time</label>
              <input
                type="datetime-local"
                required
                value={apptStart}
                onChange={(e) => setApptStart(e.target.value)}
                className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Notes</label>
              <textarea
                rows={2}
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                placeholder="Optional context for the visit."
                className="w-full text-xs rounded-xl px-3.5 py-2 outline-none border border-border/60 bg-card text-foreground resize-none"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setIsApptModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-border hover:bg-border/20 text-muted-foreground transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={apptLoading}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
                style={{ background: '#8a7a6a' }}
              >
                {apptLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Schedule
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── RENDERS — GENERAL BASE LAYOUT ───────────────────────────

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--background)' }}>
      {/* Radial tint tints */}
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
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              setViewState('UPLOAD');
              setSelectedPatient(null);
              if (principal?.accountType === 'PATIENT') {
                setPatientView('home');
              }
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #D4BDAD, #B8A89A)' }}
            >
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
              Auriem
            </span>
          </div>

          {/* Right — Actions */}
          <div className="flex items-center gap-3">
            {viewState === 'REPORT' && (
              <>
                {/* View Original PDF */}
                {reportData?.fileUrl && (
                  <button
                    onClick={() => window.open(reportData.fileUrl, '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-muted-foreground hover:text-foreground hover:bg-border/10 transition-all"
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
                      setSelectedBiomarkerDetail(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer bg-[#D4BDAD]/15 text-[#8a7a6a] border-[#D4BDAD]/30"
                  >
                    Back to Case File
                  </button>
                )}

                {principal?.accountType === 'PATIENT' && (
                  <button
                    onClick={() => {
                      setViewState('UPLOAD');
                      setPatientView('home');
                      setSelectedBiomarkerDetail(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer bg-[#D4BDAD]/15 text-[#8a7a6a] border-[#D4BDAD]/30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    My Dashboard
                  </button>
                )}

                <button
                  onClick={() => {
                    setViewState('UPLOAD');
                    setSelectedBiomarkerDetail(null);
                    if (principal?.accountType === 'STAFF') {
                      fetchPatients();
                      fetchOrgUploads();
                    }
                    if (principal?.accountType === 'PATIENT') {
                      setPatientView('home');
                      fetchPatientUploads();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-muted-foreground hover:text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>

                <div className="relative group">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shadow"
                    style={{ background: '#8a7a6a' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <div className="absolute right-0 top-full mt-1.5 w-36 glass-card rounded-xl border border-border/40 shadow-lg hidden group-hover:flex flex-col p-1.5 z-30">
                    <button
                      onClick={exportPDF}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-border/30 cursor-pointer"
                    >
                      PDF Report
                    </button>
                    <button
                      onClick={exportCSV}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-border/30 cursor-pointer"
                    >
                      Flat CSV Matrix
                    </button>
                  </div>
                </div>
              </>
            )}
            {/* Patient: back to dashboard from upload screen */}
            {principal?.accountType === 'PATIENT' && viewState === 'UPLOAD' && patientView === 'upload' && (
              <button
                onClick={() => setPatientView('home')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer bg-[#D4BDAD]/15 text-[#8a7a6a] border-[#D4BDAD]/30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                My Dashboard
              </button>
            )}

            {/* Sign Out */}
            <button
              onClick={signOut}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer hover:bg-[#D4BDAD]/10'
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

      {/* Main Container based on view states */}
      <div className="relative z-10">
        {principalLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-[#8a7a6a]" />
            <p className="text-xs text-muted-foreground mt-2">Resolving clinical security permissions...</p>
          </div>
        ) : principal?.accountType === 'STAFF' && viewState === 'UPLOAD' ? (
          renderClinicianDashboard()
        ) : principal?.accountType === 'PATIENT' && viewState === 'UPLOAD' && patientView === 'home' ? (
          renderPatientHome()
        ) : (
          <>
            {viewState === 'UPLOAD' && renderUploadScreen()}
            {viewState === 'LOADING' && renderLoadingScreen()}
            {viewState === 'ERROR' && renderErrorScreen()}
            {viewState === 'REPORT' && renderReportDashboard()}
          </>
        )}
      </div>

      {/* ─── MODAL DETAIL DIALOG ──────────────────────────────── */}
      {selectedBiomarkerDetail && (
        <BiomarkerDetailDialog
          biomarker={selectedBiomarkerDetail}
          onClose={() => setSelectedBiomarkerDetail(null)}
          getEffectivePct={getEffectivePct}
        />
      )}
    </div>
  );
}

// ─── BIOMARKER DETAIL MODAL DIALOG ────────────────────────────

interface DetailDialogProps {
  biomarker: Biomarker;
  onClose: () => void;
  getEffectivePct: (b: Biomarker) => number;
}

function BiomarkerDetailDialog({ biomarker, onClose, getEffectivePct }: DetailDialogProps) {
  const colors = STATUS_COLORS[biomarker.status];
  const effectivePct = getEffectivePct(biomarker);

  // Fallback description generator based on biomarkers
  const getDescriptions = () => {
    switch (biomarker.canonicalName) {
      case 'GLUCOSE':
        return {
          desc: 'Glucose is the primary sugar found in blood. It is the body\'s main source of energy, derived from metabolic processing of consumed carbohydrates.',
          analysis: 'Slight elevations indicate a metabolic status of impaired fasting glucose. It warrants close monitoring of daily carbohydrate glycemic indices and active evaluation of HbA1c to assess long-term regulation.',
        };
      case 'CHOLESTEROL_TOTAL':
        return {
          desc: 'Total cholesterol is a comprehensive measurement of all cholesterol types circulating in blood plasma, serving as a core index for cardiovascular evaluation.',
          analysis: 'Moderate elevation increases blood vessel lipid deposition. Recommend proactive dietary modifications (rich in fiber/omega-3 fatty acids) and active regular exercise panels.',
        };
      default:
        return {
          desc: 'A critical biological compound monitored as part of comprehensive standard cellular and systemic lipid laboratory panels.',
          analysis: 'Systemic values represent physiological stability. Keep regular panels monitored to establish stable health baseline timelines.',
        };
    }
  };

  const texts = getDescriptions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Box */}
      <div className="relative glass-card w-full max-w-md rounded-2xl p-6 border-border/40 shadow-xl overflow-hidden bg-card/95">
        <h3 className="text-lg font-bold text-foreground mb-1">{biomarker.displayName}</h3>
        <p className="text-xs text-muted-foreground uppercase mb-4 tracking-wider">{biomarker.category}</p>

        {/* Large Value */}
        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-3xl font-extrabold" style={{ color: colors.text }}>
            {biomarker.value}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">{biomarker.unit}</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: colors.bg, color: colors.text }}>
            {biomarker.status}
          </span>
        </div>

        {/* Info Blocks */}
        <div className="flex flex-col gap-4 text-xs leading-relaxed mb-6">
          <div>
            <h4 className="font-semibold text-foreground uppercase tracking-wider text-[10px] mb-1">What is {biomarker.displayName}?</h4>
            <p className="text-muted-foreground">{texts.desc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground uppercase tracking-wider text-[10px] mb-1">Clinical Interpretation</h4>
            <p className="text-muted-foreground">{texts.analysis}</p>
          </div>
        </div>

        {/* 3-Zone bar expanded */}
        <div className="mb-6">
          <div className="relative h-3 rounded-full overflow-hidden bg-border/40 flex">
            <div className="h-full w-[20%]" style={{ background: 'rgba(201, 125, 10, 0.25)' }} />
            <div className="h-full w-[60%] border-x border-border/40" style={{ background: 'rgba(26, 153, 102, 0.25)' }} />
            <div className="h-full w-[20%]" style={{ background: 'rgba(240, 78, 20, 0.25)' }} />
            
            <div
              className="absolute w-4.5 h-4.5 -top-0.5 rounded-full border border-white shadow transition-all duration-500"
              style={{
                left: `calc(${effectivePct}% - 9px)`,
                background: colors.text,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] mt-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>
            <span>Low ({biomarker.referenceMin ?? '0'})</span>
            <span style={{ color: 'var(--foreground)' }}>Optimal Range: {biomarker.referenceRange}</span>
            <span>High ({biomarker.referenceMax ?? 'N/A'})</span>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-md text-center hover:opacity-90 transition-opacity cursor-pointer"
          style={{ background: '#8a7a6a' }}
        >
          Close Detail
        </button>
      </div>
    </div>
  );
}

// ─── TAB 2: HISTORICAL TRENDS CHART ────────────────────────────

interface TrendProps {
  biomarkers: Biomarker[];
  comparisonReports: CompleteReportData[];
}

function TrendAnalysisChart({ biomarkers, comparisonReports }: TrendProps) {
  const [selectedMarker, setSelectedMarker] = useState<string>('');

  useEffect(() => {
    if (biomarkers.length > 0 && !selectedMarker) {
      setSelectedMarker(biomarkers[0].canonicalName);
    }
  }, [biomarkers]);

  // Gather trend points across comparison reports
  const trendData = comparisonReports
    .map((report) => {
      const marker = report.extraction?.biomarkers.find(b => b.canonicalName === selectedMarker);
      if (!marker) return null;
      return {
        date: new Date(report.reports[0]?.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
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
                      <p className="mt-1 font-semibold text-[#8a7a6a]">
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
                stroke="#8a7a6a"
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

// ─── TAB 3: PERSONALIZED MEDICAL CARE (AI CLINICAL CHAT) ────────

interface ChatProps {
  biomarkers: Biomarker[];
  patient?: PatientRecord;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function AIChat({ biomarkers, patient }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I am Auriem's clinical diagnostics assistant. I've finished analyzing your laboratory work. 
      
      I noticed **${biomarkers.filter(b => b.status !== 'NORMAL').length} flagged biomarkers**. Let me know what questions you have about your cholesterol, glucose ranges, or specific dietary recommendations!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(textToSend = input) {
    if (!textToSend.trim() || loading) return;

    const userText = textToSend;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      // Structure the context prompt details for AI clinical helper
      const abnormalities = biomarkers
        .filter((b) => b.status !== 'NORMAL')
        .map((b) => `- ${b.displayName}: ${b.value} ${b.unit} (Ref: ${b.referenceRange} - ${b.status})`)
        .join('\n');

      console.log('Sending message to clinical model context:', patient, abnormalities);

      // Simulating response based on clinical parameters
      setTimeout(() => {
        let answer = '';
        if (userText.toLowerCase().includes('cholesterol') || userText.toLowerCase().includes('lipid')) {
          answer = `Your **Total Cholesterol (${biomarkers.find(b => b.canonicalName === 'CHOLESTEROL_TOTAL')?.value || 210} mg/dL)** is elevated above the standard reference maximum of 200 mg/dL. 
          
### Clinical Recommendations:
1. **Dietary Shifts:** Integrate Mediterranean nutrition elements. Increase soluble fiber (oats, beans) which binds cholesterol in your digestive tract and aids excretion.
2. **Increase Healthy Fats:** Consume avocados, olive oil, and almonds while cutting trans/saturated fats.
3. **Cardio Activity:** Strive for 30 minutes of aerobic activity (jogging, brisk cycling) 5 times per week.`;
        } else if (userText.toLowerCase().includes('glucose') || userText.toLowerCase().includes('sugar')) {
          answer = `Your **Fasting Blood Glucose (${biomarkers.find(b => b.canonicalName === 'GLUCOSE')?.value || 105.5} mg/dL)** falls slightly high, placing you in a pre-diabetic monitoring vector.

### Action Plan:
- **Cut Simple Carbohydrates:** Reduce white bread, sodas, and heavy sucrose additives.
- **Support Metabolic Regulation:** Ensure adequate physical strength/weight training to increase skeletal muscle glucose uptake.
- **Check HbA1c:** Discuss a 3-month HbA1c diagnostic panel with your practitioner to evaluate long-term insulin efficacy.`;
        } else {
          answer = `Based on your recent lab results, your vital clinical readings represent high metabolic stability. However, keeping physical cardiovascular workouts regular will further improve lipid profiles. 

Let me know if there's a specific biomarker panel (CBC, Lipid Panel, CMP) you'd like me to explain!`;
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
        setLoading(false);
      }, 1200);

    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Apologies, my clinical communications link timed out. Please try asking again.' },
      ]);
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-[600px] bg-card">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between" style={{ background: 'var(--card)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212, 189, 173, 0.2)' }}>
            <Lightbulb className="w-4.5 h-4.5 text-[#8a7a6a]" />
          </div>
          <div>
            <h5 className="text-sm font-bold text-foreground">AI Clinical Assistant</h5>
            <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              Online Diagnostic Consultation
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
        {messages.map((msg, idx) => {
          const isAI = msg.role === 'assistant';
          return (
            <div
              key={idx}
              className={cn(
                'max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed',
                isAI
                  ? 'bg-card border border-border/50 text-foreground self-start rounded-tl-none shadow-sm'
                  : 'text-white self-end rounded-tr-none shadow'
              )}
              style={{
                background: isAI ? undefined : '#8a7a6a',
              }}
            >
              {isAI ? (
                <div className="prose prose-sm dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="bg-card border border-border/50 text-muted-foreground self-start rounded-2xl rounded-tl-none p-4 flex items-center gap-2.5 text-xs shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[#8a7a6a]" />
            <span>Analyzing diagnostic parameters...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggestions */}
      <div className="px-6 py-2 flex flex-wrap gap-2 border-t border-border/30 bg-border/5">
        {[
          'Explain my cholesterol anomalies',
          'Is my fasting glucose dangerous?',
          'What exercises help my HDL?',
        ].map((item) => (
          <button
            key={item}
            onClick={() => handleSend(item)}
            className="text-[10px] font-semibold border border-border/50 hover:border-[#D4BDAD] px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground cursor-pointer transition-all bg-card"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="p-4 border-t border-border/40 flex items-center gap-2" style={{ background: 'var(--card)' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Auriem AI about your clinical laboratory report insights..."
          className="flex-1 text-xs border border-border/60 p-3 rounded-xl bg-card text-foreground"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          onClick={() => handleSend()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white cursor-pointer shadow hover:opacity-90 transition-opacity"
          style={{ background: '#8a7a6a' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── APPOINTMENT ROW ──────────────────────────────────────────

interface AppointmentRowProps {
  appt: AppointmentRecord;
  compact?: boolean;
  onStatus: (id: string, status: AppointmentRecord['status']) => void;
}

function AppointmentRow({ appt, compact, onStatus }: AppointmentRowProps) {
  const colors = APPT_STATUS_COLORS[appt.status];
  const start = new Date(appt.startTime);
  const initials = `${appt.patient?.firstName?.[0] || ''}${appt.patient?.lastName?.[0] || ''}` || '?';
  const patientName = `${appt.patient?.firstName || ''} ${appt.patient?.lastName || ''}`.trim() || 'Patient';

  return (
    <div className="p-3 rounded-xl border border-border/40 bg-card/65 flex items-center justify-between gap-3 hover:shadow transition-shadow">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
          style={{ background: 'linear-gradient(135deg, #D4BDAD, #B8A89A)' }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-xs text-foreground truncate">{appt.title}</p>
          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {start.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            <span className="opacity-60">·</span>
            {patientName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
          style={{ background: colors.bg, color: colors.text }}
        >
          {appt.status.replace('_', ' ')}
        </span>
        {!compact && appt.status === 'SCHEDULED' && (
          <>
            <button
              onClick={() => onStatus(appt.id, 'COMPLETED')}
              title="Mark completed"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#1A9966] hover:bg-[#1A9966]/10 cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStatus(appt.id, 'CANCELLED')}
              title="Cancel"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#D41717] hover:bg-[#D41717]/10 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── TASK MANAGEMENT SIDEBAR ──────────────────────────────────

interface TaskSidebarProps {
  tasks: TaskRecord[];
  loading: boolean;
  onCreate: (payload: { title: string; priority: TaskRecord['priority']; dueDate?: string }) => void;
  onToggle: (task: TaskRecord) => void;
  onDelete: (id: string) => void;
}

function TaskSidebar({ tasks, loading, onCreate, onToggle, onDelete }: TaskSidebarProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskRecord['priority']>('MEDIUM');
  const [filter, setFilter] = useState<'open' | 'done'>('open');

  const visible = tasks.filter((t) => (filter === 'open' ? t.status !== 'DONE' : t.status === 'DONE'));
  const openCount = tasks.filter((t) => t.status !== 'DONE').length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreate({ title: newTitle.trim(), priority: newPriority });
    setNewTitle('');
    setNewPriority('MEDIUM');
  }

  return (
    <div className="glass-card rounded-2xl p-4 border-border/40 shadow-sm flex flex-col gap-3 max-h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-[#8a7a6a]" />
          Tasks
        </h4>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4BDAD]/15 text-[#8a7a6a]">
          {openCount} open
        </span>
      </div>

      {/* Add task */}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
          className="w-full text-xs rounded-xl px-3 py-2 outline-none border border-border/60 bg-card text-foreground focus:border-[#D4BDAD] transition-colors"
        />
        <div className="flex items-center gap-2">
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as TaskRecord['priority'])}
            className="flex-1 text-[11px] rounded-lg px-2 py-1.5 outline-none border border-border/60 bg-card text-foreground cursor-pointer"
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <button
            type="submit"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 cursor-pointer shadow hover:opacity-90"
            style={{ background: '#8a7a6a' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Filter toggle */}
      <div className="flex gap-1 p-1 rounded-lg border border-border/40" style={{ background: 'var(--card)' }}>
        {(['open', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 py-1 rounded-md text-[11px] font-semibold capitalize transition-all cursor-pointer',
              filter === f ? 'bg-[#D4BDAD]/15 text-[#8a7a6a]' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#8a7a6a]" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6">
            {filter === 'open' ? 'No open tasks. Nice work!' : 'No completed tasks yet.'}
          </p>
        ) : (
          visible.map((task) => {
            const done = task.status === 'DONE';
            return (
              <div
                key={task.id}
                className="group p-2.5 rounded-xl border border-border/40 bg-card/65 flex items-start gap-2.5 hover:border-[#D4BDAD]/50 transition-colors"
              >
                <button
                  onClick={() => onToggle(task)}
                  className="mt-0.5 shrink-0 cursor-pointer"
                  title={done ? 'Mark as open' : 'Mark as done'}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1A9966]" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground hover:text-[#8a7a6a]" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium text-foreground break-words', done && 'line-through opacity-60')}>
                    {task.title}
                  </p>
                  {task.patient && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                      {task.patient.firstName} {task.patient.lastName}
                    </p>
                  )}
                </div>
                <span
                  className="w-2 h-2 rounded-full mt-1 shrink-0"
                  style={{ background: PRIORITY_COLORS[task.priority] }}
                  title={`${task.priority} priority`}
                />
                <button
                  onClick={() => onDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#D41717] cursor-pointer transition-all shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
