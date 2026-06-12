import { useState } from 'react';
import { HelpCircle, X, Shield, RefreshCw, ChevronDown, CheckCircle, FileText } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface HelpDrawerProps {
  onRestartTour: () => void;
}

export default function HelpDrawer({ onRestartTour }: HelpDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { resetOnboarding } = useOnboarding();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Does LabAI diagnose diseases?',
      a: 'No. LabAI is an educational and analytical tool designed to help you interpret laboratory report values. It does not provide medical diagnoses or replace professional consultations with qualified healthcare providers.',
    },
    {
      q: 'How accurate is the PDF biomarker extraction?',
      a: 'Our extraction engine operates with high accuracy using advanced OCR models. It extracts exact numerical values, units, and reference ranges directly from your PDF. However, you should always double-check the extracted values against your original paper report.',
    },
    {
      q: 'Is my health data secure and private?',
      a: 'Yes, absolutely. We prioritize your privacy. All uploaded documents are processed securely, and personal health information (PHI) is protected. We use industry-standard encryption and do not share your private data with third parties.',
    },
    {
      q: 'What types of reports can I upload?',
      a: 'We support standard blood panels including Complete Blood Count (CBC), Comprehensive Metabolic Panel (CMP), Lipid Panels (cholesterol), Thyroid Panels, and common hormone or vitamin tests. Files should be in PDF format.',
    },
  ];

  const handleRestartTourClick = () => {
    setIsOpen(false);
    onRestartTour();
  };

  const handleResetAllClick = () => {
    resetOnboarding();
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[99] flex items-center justify-center w-12 h-12 rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer border-0"
        style={{
          background: 'var(--primary-text)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), var(--glow-primary)',
        }}
        title="Help & Onboarding Support"
        id="help-drawer-trigger"
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[9990] bg-black/45 backdrop-blur-sm animate-fade-in"
        />
      )}

      {/* Slide-out Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[9991] w-full max-w-sm bg-card border-l border-border/40 shadow-2xl transition-transform duration-350 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'color-mix(in srgb, var(--card) 96%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/20">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[var(--primary-text)]" />
            <h3 className="text-sm font-bold text-foreground">Auriem Help & Support</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/20 transition-all cursor-pointer border-0 bg-transparent"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          {/* Getting Started Guide */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[var(--primary-text)]" />
              Getting Started Guide
            </h4>
            <ol className="space-y-2.5 text-xs text-muted-foreground list-decimal pl-4">
              <li>
                <strong className="text-foreground">Register or Login:</strong> Set up your patient or clinician profile.
              </li>
              <li>
                <strong className="text-foreground">Upload Report:</strong> Drag & drop your blood work PDF to parse values.
              </li>
              <li>
                <strong className="text-foreground">Analyze Markers:</strong> Review normal, borderline, and high values.
              </li>
              <li>
                <strong className="text-foreground">Consult AI Chat:</strong> Ask follow-up questions about specific biomarkers.
              </li>
              <li>
                <strong className="text-foreground">Download PDF:</strong> Export your premium patient case report summary.
              </li>
            </ol>
          </div>

          <hr className="border-border/15" />

          {/* Supported Panels */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--primary-text)]" />
              Supported Lab Panels
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {['CBC', 'CMP', 'Lipid Panel', 'Thyroid', 'Hormones', 'Vitamins', 'Renal', 'Hepatic'].map((panel) => (
                <span
                  key={panel}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-border bg-muted/30 text-foreground"
                >
                  {panel}
                </span>
              ))}
            </div>
          </div>

          <hr className="border-border/15" />

          {/* Privacy & Safety Section */}
          <div className="p-3.5 rounded-xl border border-border/20 bg-muted/20 space-y-2">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Privacy & Security
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We employ strict safeguards, encrypting your data at rest and in transit. Your documents are handled in absolute privacy, and we never monetize your private health data.
            </p>
          </div>

          <hr className="border-border/15" />

          {/* FAQ Accordion */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Frequently Asked Questions
            </h4>
            <div className="space-y-2">
              {faqs.map((faq, idx) => {
                const active = activeFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-border/30 rounded-xl overflow-hidden bg-card/45"
                  >
                    <button
                      onClick={() => setActiveFaq(active ? null : idx)}
                      className="w-full flex items-center justify-between p-3 text-left text-xs font-bold text-foreground hover:bg-border/10 cursor-pointer border-0 bg-transparent transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                          active ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {active && (
                      <div className="p-3 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-border/10 bg-muted/10">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-border/20 flex flex-col gap-2 bg-muted/20">
          <button
            onClick={handleRestartTourClick}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-white shadow transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer border-0"
            style={{ background: 'var(--primary-text)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restart Product Tour
          </button>
          <button
            onClick={handleResetAllClick}
            className="w-full text-center py-2 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer border-0 bg-transparent"
          >
            Reset Welcome & Onboarding State
          </button>
        </div>
      </div>
    </>
  );
}
