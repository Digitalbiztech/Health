export interface Biomarker {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'high' | 'low' | 'critical' | 'unknown';
  min?: number;
  max?: number;
  confidenceScore?: number;
  clinicalInterpretation?: string;
}

export interface LabPanel {
  name: string;
  biomarkers: Biomarker[];
}

export interface LabReport {
  id: string;
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
  labDate?: string;
  collectionDate?: string;
  orderedBy?: string;
  summary?: string;
  aiInsights?: string[];
  panels: LabPanel[];
  healthScore?: number;
}
