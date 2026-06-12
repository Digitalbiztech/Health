import { toast } from 'sonner';
import type { Biomarker, CompleteReportData } from '@/types/dashboard';
import { pdf } from '@react-pdf/renderer';
import { PremiumPDFDocument } from '../PremiumPDFDocument';
import type { LabReport } from '../../types/lab';

export function calculateAge(dobString: string): number {
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Get effective percentage for a needle in a three-zone bar (Low 20%, Optimal 60%, High 20%)
export function getEffectivePct(biomarker: Biomarker): number {
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

export function getSliderTrack(canonicalName?: string, displayName?: string): { leftPct: number; midPct: number; rightPct: number; leftColor: string; midColor: string; rightColor: string } {
  const name = (canonicalName || displayName || '').toUpperCase();
  
  // 1. Only LOW is dangerous (eGFR, HDL, VITAMIN, VITD)
  if (name.includes('EGFR') || name.includes('HDL') || name.includes('VITAMIN') || name.includes('VITD')) {
    return {
      leftPct: 25,
      midPct: 75,
      rightPct: 0,
      leftColor: 'rgba(201, 125, 10, 0.25)', // Orange (Low danger)
      midColor: 'rgba(26, 153, 102, 0.25)',  // Green (Optimal)
      rightColor: 'rgba(26, 153, 102, 0.25)', // Green (Optimal)
    };
  }
  
  // 2. Only HIGH is dangerous (ALT, AST, Bilirubin, LDL, Cholesterol, Triglycerides, Glucose)
  if (
    name.includes('ALT') ||
    name.includes('AST') ||
    name.includes('BILIRUBIN') ||
    name.includes('LDL') ||
    name.includes('TRIGLYCERIDES') ||
    name.includes('GLUCOSE') ||
    name.includes('CHOLESTEROL') ||
    name.includes('CREATININE')
  ) {
    return {
      leftPct: 0,
      midPct: 75,
      rightPct: 25,
      leftColor: 'rgba(26, 153, 102, 0.25)',  // Green (Optimal)
      midColor: 'rgba(26, 153, 102, 0.25)',  // Green (Optimal)
      rightColor: 'rgba(240, 78, 20, 0.25)',  // Red/Orange (High danger)
    };
  }
  
  // 3. Two-sided danger (Default: Sodium, Potassium, WBC, Hemoglobin, etc.)
  return {
    leftPct: 20,
    midPct: 60,
    rightPct: 20,
    leftColor: 'rgba(201, 125, 10, 0.25)', // Orange (Low danger)
    midColor: 'rgba(26, 153, 102, 0.25)',  // Green (Optimal)
    rightColor: 'rgba(240, 78, 20, 0.25)',  // Red/Orange (High danger)
  };
}

export function exportCSV(reportData: CompleteReportData) {
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

export function convertToLabReport(reportData: CompleteReportData, healthScore: number): LabReport {
  const patient = reportData.patient;
  const activeReport = reportData.reports?.[0];
  const biomarkers = reportData.extraction?.biomarkers || [];

  // Group biomarkers by category
  const categories = Array.from(new Set(biomarkers.map((b) => b.category)));
  const panels = categories.map((cat) => {
    const catBiomarkers = biomarkers.filter((b) => b.category === cat);
    return {
      name: cat,
      biomarkers: catBiomarkers.map((b) => ({
        name: b.displayName,
        value: b.value,
        unit: b.unit,
        status: b.status.toLowerCase() as 'normal' | 'high' | 'low' | 'critical' | 'unknown',
        min: b.referenceMin ?? undefined,
        max: b.referenceMax ?? undefined,
        confidenceScore: b.confidence,
        clinicalInterpretation: b.description || b.detailedAnalysis,
      })),
    };
  });

  const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
  const age = patient?.dateOfBirth ? calculateAge(patient.dateOfBirth) : undefined;

  return {
    id: reportData.id,
    patientName: pName,
    patientAge: age,
    patientGender: patient?.gender || 'male',
    labDate: activeReport?.createdAt,
    collectionDate: activeReport?.createdAt,
    orderedBy: 'Health Clinical Suite',
    summary: activeReport?.summary,
    aiInsights: activeReport?.insights?.recommendations || [],
    panels,
    healthScore,
  };
}

export async function exportPDF(reportData: CompleteReportData, healthScore: number) {
  if (!reportData || !reportData.extraction) return;
  const activeReport = reportData.reports?.[0];
  if (!activeReport) return;

  const toastId = toast.loading('Generating premium clinical PDF...');

  try {
    const labReport = convertToLabReport(reportData, healthScore);
    const logoUrl = window.location.origin + '/logo/041323 YC LogoDeck_Main-WG copy.png';
    const iconLogoUrl = window.location.origin + '/logo/040523 YC LogoDeck_Icon-GS.jpg';

    const doc = <PremiumPDFDocument report={labReport} logoUrl={logoUrl} iconLogoUrl={iconLogoUrl} />;
    const blob = await pdf(doc).toBlob();

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const patient = reportData.patient;
    const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
    link.setAttribute('download', `Clinical_Insights_${pName.replace(/\s+/g, '_')}.pdf`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Premium laboratory insights PDF downloaded!', { id: toastId });
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast.error('Failed to generate PDF. Please try again.', { id: toastId });
  }
}

