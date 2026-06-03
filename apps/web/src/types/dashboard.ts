export type DashboardState = 'UPLOAD' | 'LOADING' | 'ERROR' | 'REPORT';

export interface Biomarker {
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

export interface UploadRecord {
  id: string;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  patientId?: string;
}

export interface ReportRecord {
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

export interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email?: string;
  note?: string;
  uploads?: UploadRecord[];
}

export interface CompleteReportData {
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

export interface AppointmentRecord {
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

export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string | null;
  patientId?: string | null;
  patient?: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface PatientStat {
  month: string;
  male: number;
  female: number;
  other: number;
  total: number;
}
