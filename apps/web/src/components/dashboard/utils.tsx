import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import type { Biomarker, CompleteReportData } from '@/types/dashboard';

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

export function exportPDF(reportData: CompleteReportData, healthScore: number) {
  if (!reportData || !reportData.extraction) return;
  const activeReport = reportData.reports?.[0];
  if (!activeReport) return;
  
  const patient = reportData.patient;
  const doc = new jsPDF();
  const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
  const analyzedAt = new Date(activeReport.createdAt || Date.now()).toLocaleDateString();

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
