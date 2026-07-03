import { User, Calendar, Upload, FileText, CheckCircle2, Loader2, Heart, Stethoscope, Sparkles, Eye, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useBranding } from '@/hooks/useBranding';
import type { UploadRecord, CompleteReportData, DashboardState } from '@/types/dashboard';
import { calculateAge } from './utils';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { SAMPLE_REPORT } from '@/data/sampleReportData';

interface PatientHomeProps {
  principal: any;
  patientUploads: UploadRecord[];
  patientUploadsLoading: boolean;
  comparisonReports: CompleteReportData[];
  setPatientView: (view: 'home' | 'upload') => void;
  fetchPatientUploads: () => Promise<void>;
  fetchUploadsHistory: () => Promise<void>;
  setReportData: (data: CompleteReportData | null) => void;
  setViewState: (state: DashboardState) => void;
  onViewSample: () => void;
}

export function PatientHome({
  principal,
  patientUploads,
  patientUploadsLoading,
  comparisonReports,
  setPatientView,
  fetchPatientUploads,
  fetchUploadsHistory,
  setReportData,
  setViewState,
  onViewSample,
}: PatientHomeProps) {
  const { branding } = useBranding();
  const patientPrincipal = principal;
  const totalUploads = patientUploads.length;
  const completedUploads = patientUploads.filter(u => u.status === 'COMPLETED').length;
  const pendingUploads = patientUploads.filter(u => u.status === 'PENDING' || u.status === 'PROCESSING').length;

  // Biomarker stats from comparison reports
  const latestReport = comparisonReports[0];
  const allBiomarkers = latestReport?.extraction?.biomarkers || [];
  const normalCount = allBiomarkers.filter(b => b.status === 'NORMAL').length;
  const abnormalCount = allBiomarkers.filter(b => b.status !== 'NORMAL').length;

  // Initialize the patient tour
  const { startTour } = useOnboardingTour('PATIENT_HOME');

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 flex flex-col gap-6">

      {/* ── Profile Card ──────────────────────────────────── */}
      <div id="tour-profile-card" className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {branding.logoIconUrl ? (
            <img
              src={branding.logoIconUrl}
              alt={`${branding.brandName} Icon`}
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-border/40"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-primary/20 text-primary-text font-black text-xl border border-border/40 shrink-0">
              {branding.brandName.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground">
              {patientPrincipal?.firstName} {patientPrincipal?.lastName}
            </h2>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
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
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-glow)', color: 'var(--primary-text)' }}>
                  {patientPrincipal.gender}
                </span>
              )}
            </div>
          </div>
          {branding.logoLetterformUrl ? (
            <img
              src={branding.logoLetterformUrl}
              alt={`${branding.brandName} Letterform`}
              className="h-10 w-auto object-contain shrink-0 mx-4 hidden sm:block"
            />
          ) : (
            <span className="font-semibold text-lg shrink-0 mx-4 hidden sm:block text-muted-foreground">
              {branding.brandName}
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="tour-upload-btn"
              onClick={() => setPatientView('upload')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: 'var(--primary-text)' }}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New Report
            </button>
            <button
              onClick={startTour}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all hover:bg-[var(--primary)]/10 bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--primary-text)' }}
              title="Take a guided tour of your dashboard"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tour</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ───────────────────────────────────── */}
      <section id="tour-stats-section" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', val: totalUploads, icon: FileText, color: 'var(--primary-text)' },
          { label: 'Analyzed', val: completedUploads, icon: CheckCircle2, color: 'var(--status-normal)' },
          { label: 'Processing', val: pendingUploads, icon: Loader2, color: 'var(--status-low)', animate: pendingUploads > 0 },
          { label: 'Normal Markers', val: normalCount, icon: Heart, color: 'var(--status-normal)' },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-card rounded-2xl p-5 border border-border flex items-center justify-between"
          >
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stat.val}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-glow)' }}>
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
          <div id="tour-health-snapshot" className="bg-card rounded-2xl p-6 border border-border">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Health Snapshot
            </h4>
            {latestReport ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl border animate-fade-in" style={{ background: 'var(--status-normal-bg)', borderColor: 'color-mix(in srgb, var(--status-normal) 20%, transparent)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold" style={{ color: 'var(--status-normal)', background: 'color-mix(in srgb, var(--status-normal) 15%, transparent)' }}>
                    {normalCount}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--status-normal)' }}>Balanced Markers</p>
                    <p className="text-[10px] text-muted-foreground">Within normal reference range.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border animate-fade-in" style={{ background: 'var(--status-high-bg)', borderColor: 'color-mix(in srgb, var(--status-high) 20%, transparent)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold" style={{ color: 'var(--status-high)', background: 'color-mix(in srgb, var(--status-high) 15%, transparent)' }}>
                    {abnormalCount}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--status-high)' }}>Flagged Markers</p>
                    <p className="text-[10px] text-muted-foreground">Outside normal range — review recommended.</p>
                  </div>
                </div>
                {latestReport.reports?.[0]?.insights?.recommendations?.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[var(--primary-text)] bg-[var(--primary)]/20">
                      {latestReport.reports[0].insights.recommendations.length}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--primary-text)]">AI Recommendations</p>
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
            <div id="tour-ai-summary" className="bg-card rounded-2xl p-6 border border-border">
              <h4 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
                <Sparkles className="w-3.5 h-3.5 inline mr-1.5" style={{ color: 'var(--primary-text)' }} />
                AI Summary
              </h4>
              <ul className="space-y-2">
                {latestReport.reports[0].insights.summaryPoints.slice(0, 4).map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right — Reports History */}
        <div className="lg:col-span-8">
          <div id="tour-report-history" className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                Lab Report History
              </h4>
              <button
                onClick={() => { fetchPatientUploads(); fetchUploadsHistory(); }}
                className="text-[10px] font-semibold border border-border hover:bg-border/20 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-all bg-transparent"
              >
                Refresh
              </button>
            </div>

            {patientUploadsLoading ? (
              <div className="min-h-[200px] flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--primary-text)]" />
                <p className="text-xs text-muted-foreground mt-2">Loading your reports...</p>
              </div>
            ) : patientUploads.length === 0 ? (
              <div className="min-h-[220px] rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-xs text-foreground">No Reports Yet</p>
                  <p className="text-[10px] text-muted-foreground max-w-xs mt-0.5">
                    Not ready to upload? Explore the dashboard with a Sample Report containing realistic pre-parsed biomarkers, longitudinal trends, and sample AI Q&A.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5 mt-2">
                  <button
                    onClick={() => setPatientView('upload')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow hover:opacity-90 cursor-pointer"
                    style={{ background: 'var(--primary-text)' }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Report
                  </button>
                  <button
                    onClick={onViewSample}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-border/20 text-foreground cursor-pointer bg-transparent"
                  >
                    Explore Sample Report
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {patientUploads.map((upload, uploadIdx) => {
                  const date = new Date(upload.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  const sizeMb = upload.fileSize ? (upload.fileSize / (1024 * 1024)).toFixed(2) : null;
                  const isFirstCompleted = upload.status === 'COMPLETED' && uploadIdx === patientUploads.findIndex(u => u.status === 'COMPLETED');

                  return (
                    <div
                      key={upload.id}
                      className="py-4 border-b border-border/60 last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center animate-fade-in"
                          style={{
                            background: upload.status === 'COMPLETED' ? 'color-mix(in srgb, var(--status-normal) 15%, transparent)' :
                                        upload.status === 'FAILED' ? 'color-mix(in srgb, var(--status-critical) 15%, transparent)' :
                                        'color-mix(in srgb, var(--status-low) 15%, transparent)'
                          }}
                        >
                          <FileText
                            className="w-5 h-5"
                            style={{
                              color: upload.status === 'COMPLETED' ? 'var(--status-normal)' :
                                     upload.status === 'FAILED' ? 'var(--status-critical)' :
                                     'var(--status-low)'
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
                            background: upload.status === 'COMPLETED' ? 'color-mix(in srgb, var(--status-normal) 12%, transparent)' :
                                        upload.status === 'FAILED' ? 'color-mix(in srgb, var(--status-critical) 12%, transparent)' :
                                        'color-mix(in srgb, var(--status-low) 12%, transparent)',
                            color: upload.status === 'COMPLETED' ? 'var(--status-normal)' :
                                   upload.status === 'FAILED' ? 'var(--status-critical)' :
                                   'var(--status-low)'
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
                            <Eye className="w-3 h-3" />
                            PDF
                          </button>
                        )}

                        {upload.status === 'COMPLETED' && (
                          <button
                            id={isFirstCompleted ? 'tour-report-review-btn' : undefined}
                            onClick={async () => {
                              if (upload.id === 'sample-report-id') {
                                setReportData(SAMPLE_REPORT);
                                setViewState('REPORT');
                                if (sessionStorage.getItem('active-onboarding-tour') === 'PATIENT_HOME') {
                                  sessionStorage.setItem('active-onboarding-tour', 'PATIENT_REPORT');
                                }
                                return;
                              }
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
                            style={{ background: 'var(--primary-text)' }}
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
