import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { PremiumPDFDocument } from '../PremiumPDFDocument';
import { convertToLabReport } from './utils';
import type { CompleteReportData } from '@/types/dashboard';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: CompleteReportData | null;
  healthScore: number;
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  reportData,
  healthScore,
}: PDFPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !reportData) {
      setPdfUrl('');
      setLoading(true);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    async function generatePdf() {
      try {
        const labReport = convertToLabReport(reportData!, healthScore);
        const logoUrl = window.location.origin + '/logo/041323 YC LogoDeck_Main-WG copy.png';
        const iconLogoUrl = window.location.origin + '/logo/040523 YC LogoDeck_Icon-GS.jpg';

        const doc = <PremiumPDFDocument report={labReport} logoUrl={logoUrl} iconLogoUrl={iconLogoUrl} />;
        const blob = await pdf(doc).toBlob();

        if (active) {
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error generating PDF preview:', err);
        if (active) {
          setError(err.message || 'Failed to compile report PDF.');
          setLoading(false);
        }
      }
    }

    generatePdf();

    return () => {
      active = false;
    };
  }, [isOpen, reportData, healthScore]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (!isOpen || !reportData) return null;

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    const patient = reportData.patient;
    const pName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
    link.setAttribute('download', `Clinical_Insights_${pName.replace(/\s+/g, '_')}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Premium laboratory insights PDF downloaded!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div
        className="relative glass-card w-full max-w-5xl rounded-2xl p-6 border-border/40 shadow-xl overflow-hidden bg-card/95 flex flex-col h-[85vh] animate-scale-in"
        style={{
          borderColor: 'color-mix(in srgb, var(--border) 40%, transparent)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div>
            <h3 className="text-base font-bold text-foreground">Diagnostic Report Preview</h3>
            <p className="text-xs text-muted-foreground">
              Review the formatted clinical insights document before printing or exporting.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded-lg hover:bg-border/20 bg-transparent border-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 bg-background/30 rounded-xl border border-border/40 relative overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[var(--primary-text)] animate-spin" />
              <p className="text-xs font-medium text-muted-foreground">
                Compiling premium PDF document insights...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center max-w-md">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm font-semibold text-foreground">Failed to render PDF</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : (
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0 rounded-xl"
              title="Clinical PDF Preview"
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-border/20 text-muted-foreground transition-all cursor-pointer bg-transparent"
          >
            Close Preview
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || !!error}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center gap-1.5 border-0"
            style={{ background: 'var(--primary-text)' }}
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
