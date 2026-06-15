import { useNavigate } from 'react-router-dom';
import { X, Compass, Eye, ShieldCheck, BookOpen } from 'lucide-react';
import type { AccountType } from '@/contexts/AuthContext';

interface WelcomeModalProps {
  isOpen: boolean;
  role: AccountType;
  onTakeTour: () => void;
  onViewSample: () => void;
  onSkip: () => void;
}

export default function WelcomeModal({
  isOpen,
  role,
  onTakeTour,
  onViewSample,
  onSkip,
}: WelcomeModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isStaff = role === 'STAFF';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="glass-card w-full max-w-lg rounded-2xl p-8 flex flex-col gap-6 relative animate-scale-in border border-border/40 shadow-2xl bg-card"
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3), var(--glow-primary)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onSkip}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/20 transition-all cursor-pointer border-0 bg-transparent"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3.5 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 animate-float">
            <img height={120} width={120} src="/logo/YC_Letterform_WH.png" alt="company log0" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Welcome to Health Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              {isStaff
                ? 'Manage patient diagnostics, track longitudinal trends, and generate AI insights in under two minutes.'
                : 'Understand your laboratory diagnostic report results in under two minutes, with clinical precision.'}
            </p>
          </div>
        </div>

        {/* Feature List */}
        <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-border/20 bg-muted/30">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Platform Capabilities
          </h4>

          <div className="grid grid-cols-1 gap-3 text-xs">
            {isStaff ? (
              <>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Patients Directory:</span>{' '}
                    <span className="text-muted-foreground">
                      Organize patient records, upload reports, and check statuses.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Longitudinal Trends:</span>{' '}
                    <span className="text-muted-foreground">
                      Compare historical reports side-by-side with dynamic charting.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Appointment Calendar:</span>{' '}
                    <span className="text-muted-foreground">
                      Keep track of scheduled, completed, and pending consultations.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Clinical Tasks:</span>{' '}
                    <span className="text-muted-foreground">
                      Set high-priority task reminders tied to patient cases.
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Automated Extraction:</span>{' '}
                    <span className="text-muted-foreground">
                      Our system extracts your biomarkers from blood work PDFs instantly.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Interactive Ranges:</span>{' '}
                    <span className="text-muted-foreground">
                      See normal, borderline, and high markers clearly categorized.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">AI Medical Assistant:</span>{' '}
                    <span className="text-muted-foreground">
                      Ask questions, learn about markers, and read helpful guidance.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Clinical Consistency:</span>{' '}
                    <span className="text-muted-foreground">
                      Rest assured, AI does not modify raw values. Data is verified.
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onTakeTour}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer border-0 w-full"
            style={{
              background: 'var(--primary-text)',
              boxShadow: 'var(--glow-primary)',
            }}
          >
            <Compass className="w-4.5 h-4.5" />
            Take Product Tour
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={onViewSample}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border border-border hover:bg-border/20 active:scale-[0.98] transition-all cursor-pointer bg-transparent animate-fade-in"
              style={{ color: 'var(--foreground)' }}
            >
              <Eye className="w-4 h-4" />
              Explore Sample Report
            </button>

            <button
              onClick={() => {
                onSkip();
                navigate('/guide');
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border border-border hover:bg-border/20 active:scale-[0.98] transition-all cursor-pointer bg-transparent animate-fade-in"
              style={{ color: 'var(--foreground)' }}
            >
              <BookOpen className="w-4 h-4" />
              Read Platform Guide
            </button>
          </div>

          <button
            onClick={onSkip}
            className="w-full text-center text-xs font-semibold py-2 transition-colors hover:underline text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0"
          >
            Skip and go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
