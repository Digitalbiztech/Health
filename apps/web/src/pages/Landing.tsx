import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  Brain, 
  Database, 
  FileDown, 
  Calendar, 
  ListTodo, 
  ArrowRight, 
  Lock, 
  Menu, 
  X, 
  Info, 
  ExternalLink, 
  ShieldCheck,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/useBranding';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

// Mock PubMed Citation Data for the interactive RAG component
interface Citation {
  id: string;
  title: string;
  journal: string;
  abstract: string;
  link: string;
}

const MOCK_CITATION: Citation = {
  id: 'PMID: 3841029',
  title: 'Longitudinal Biomarker Analysis of Adrenal Insufficiency and Cortisol Variability',
  journal: 'Journal of Clinical Endocrinology & Metabolism (2025)',
  abstract: 'This study outlines the significance of morning serum cortisol levels below 3.0 μg/dL as a key marker of secondary adrenal insufficiency. The study indicates that serial testing over a 6-month period is optimal to resolve diagnostic ambiguity.',
  link: 'https://pubmed.ncbi.nlm.nih.gov/'
};

export default function Landing() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Upload Demo State ──────────────────────────────────────
  const [uploadState, setUploadState] = useState<'idle' | 'dragging' | 'processing' | 'completed'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // ── Interactive Slider States ──────────────────────────────
  const [sliderValue, setSliderValue] = useState(55); // Default optimal range
  const [biomarkerName, setBiomarkerName] = useState<'cortisol' | 'hemoglobin'>('cortisol');

  // ── Interactive RAG Chat State ─────────────────────────────
  const [ragExpanded, setRagExpanded] = useState(false);
  const chatMessage = "Explain my morning cortisol value. What are the clinical guidelines?";

  // Simulate file upload processing steps
  const simulateProcessing = useCallback((fileName: string) => {
    setUploadedFileName(fileName);
    setUploadState('processing');
    setUploadProgress(0);

    const steps = [
      { progress: 20, text: 'Extracting PDF biomarkers (PyMuPDF/Mistral)...' },
      { progress: 50, text: 'Scrubbing patient PII (Presidio encryption vault)...' },
      { progress: 80, text: 'Grounding results in knowledge base (pgvector RAG)...' },
      { progress: 100, text: 'Compiling premium health summary...' }
    ];

    let currentStepIdx = 0;
    const interval = setInterval(() => {
      if (currentStepIdx < steps.length) {
        setProcessingStep(steps[currentStepIdx].text);
        setUploadProgress(steps[currentStepIdx].progress);
        currentStepIdx++;
      } else {
        clearInterval(interval);
        setUploadState('completed');
        toast.success('Simulation complete! Report processed successfully.');
      }
    }, 1200);
  }, []);

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploadState === 'idle') setUploadState('dragging');
  };

  const handleDragLeave = () => {
    if (uploadState === 'dragging') setUploadState('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploadState !== 'idle' && uploadState !== 'dragging') return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf') || file.name.endsWith('.csv')) {
        simulateProcessing(file.name);
      } else {
        toast.error('Please drop a valid PDF or CSV clinical report.');
        setUploadState('idle');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      simulateProcessing(files[0].name);
    }
  };

  // Resolve biomarker metrics dynamically
  const getBiomarkerStatus = () => {
    if (biomarkerName === 'cortisol') {
      if (sliderValue < 30) return { label: 'Low', class: 'bg-[#C97D0A]/10 text-[#C97D0A] border-[#C97D0A]/20', desc: 'Indicates adrenal insufficiency risk. Morning levels below 6.0 μg/dL warrant investigation.' };
      if (sliderValue <= 75) return { label: 'Optimal', class: 'bg-[#1A9966]/10 text-[#1A9966] border-[#1A9966]/20', desc: 'Within standard healthy physiological range.' };
      if (sliderValue <= 90) return { label: 'High', class: 'bg-[#F04E14]/10 text-[#F04E14] border-[#F04E14]/20', desc: 'Slightly elevated. Review clinical context or stress factors.' };
      return { label: 'Critical', class: 'bg-[#D41717]/10 text-[#D41717] border-[#D41717]/20', desc: 'Warrants immediate clinician review. Risk of hypercortisolemia.' };
    } else {
      // Hemoglobin
      if (sliderValue < 40) return { label: 'Low', class: 'bg-[#C97D0A]/10 text-[#C97D0A] border-[#C97D0A]/20', desc: 'Risk of anemia. Typical physiological normal values require >= 13.5 g/dL.' };
      if (sliderValue <= 80) return { label: 'Optimal', class: 'bg-[#1A9966]/10 text-[#1A9966] border-[#1A9966]/20', desc: 'Normal healthy oxygen capacity.' };
      return { label: 'High', class: 'bg-[#F04E14]/10 text-[#F04E14] border-[#F04E14]/20', desc: 'Mild erythrocytosis. Review hydration levels.' };
    }
  };

  const currentStatus = getBiomarkerStatus();

  return (
    <div className="min-h-screen relative font-sans selection:bg-[#D4BDAD]/30 selection:text-[#8A7A6A] bg-background text-foreground transition-colors duration-300">
      
      {/* ── Outer Radial Glows ─────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-0 h-[45vh] w-[45vw] bg-radial-gradient from-[#D4BDAD]/5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[45vh] w-[45vw] bg-radial-gradient from-[#B8A89A]/4 to-transparent blur-3xl" />
      </div>

      {/* ── Sticky Navigation Header ───────────────────────────── */}
      <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-8 h-8 rounded-xl bg-[#D4BDAD] flex items-center justify-center font-bold text-white shadow-sm">
              {branding.brandName.substring(0, 1).toUpperCase()}
            </div>
            <span className="font-extrabold text-lg tracking-tight text-foreground">
              {branding.brandName} <span className="font-light text-[#8A7A6A]">Clinical Suite</span>
            </span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#biomarkers" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Interactive Demo</a>
            <a href="#RAG-grounding" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">RAG Assistant</a>
            <a href="#clinicians" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">For Labs</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <button 
              onClick={() => navigate('/login')} 
              className="text-xs font-bold text-[#8A7A6A] border border-[#D4BDAD]/40 hover:border-[#D4BDAD] px-4.5 py-2 rounded-xl transition-all hover:bg-[#D4BDAD]/5 cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/login')} 
              className="text-xs font-bold bg-[#D4BDAD] text-white px-5 py-2.5 rounded-xl hover:bg-[#8A7A6A] transition-all shadow hover:shadow-md cursor-pointer"
            >
              Register Portal
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="p-2 rounded-lg border border-border text-foreground hover:bg-border/20"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden w-full border-b border-border/40 bg-background/95 backdrop-blur-md px-6 py-6 absolute top-16 left-0 flex flex-col gap-5 shadow-lg animate-fade-in">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Features</a>
            <a href="#biomarkers" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Interactive Demo</a>
            <a href="#RAG-grounding" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">RAG Assistant</a>
            <a href="#clinicians" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">For Labs & Clinicians</a>
            <hr className="border-border/40" />
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }} 
                className="w-full text-center py-3 text-xs font-bold text-[#8A7A6A] border border-[#D4BDAD]/40 rounded-xl"
              >
                Sign In
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }} 
                className="w-full text-center py-3 text-xs font-bold bg-[#D4BDAD] text-white rounded-xl"
              >
                Register Portal
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section (Option A: Editorial Drag & Drop) ────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-20 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Hero Left */}
          <div className="lg:col-span-7 flex flex-col text-left">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-[#8A7A6A] uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Next-Generation Medical Lab Processor
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight leading-[1.08] mb-6">
              Effortless medical lab report processing.
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-[62ch] mb-8">
              Auriem Clinical Suite transforms raw laboratory PDFs into print-safe, standardized health reports. Designed for patient clarity and advanced clinical workflows, featuring automated PHI scrubbing, units normalization, and RAG-grounded answers.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => navigate('/login')} 
                className="inline-flex items-center gap-2 bg-[#D4BDAD] text-white px-6.5 py-3.5 rounded-xl font-bold text-xs hover:bg-[#8A7A6A] transition-all shadow hover:shadow-md cursor-pointer"
              >
                Get Started Now <ArrowRight className="w-4 h-4" />
              </button>
              <a 
                href="#features" 
                className="inline-flex items-center gap-2 border border-border bg-card/45 hover:bg-card/90 px-6.5 py-3.5 rounded-xl font-bold text-xs text-foreground transition-all cursor-pointer"
              >
                Explore Technology
              </a>
            </div>
          </div>

          {/* Hero Right (Interactive Drag & Drop zone) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-lg p-6 relative transition-all duration-300 hover:shadow-xl">
              
              {/* Top Bar Decoration */}
              <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-3">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#8A7A6A]" /> Clinical Pipeline Sandbox
                </span>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#1A9966]" />
              </div>

              {/* Box states */}
              {uploadState === 'idle' && (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-[#D4BDAD]/40 hover:border-[#D4BDAD] bg-background/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] transition-all"
                >
                  <input 
                    type="file" 
                    id="sandbox-file" 
                    className="hidden" 
                    accept=".pdf,.csv"
                    onChange={handleFileSelect}
                  />
                  <label htmlFor="sandbox-file" className="cursor-pointer flex flex-col items-center">
                    <UploadCloud className="w-12 h-12 text-[#D4BDAD] mb-4 animate-pulse" />
                    <h3 className="text-sm font-bold text-foreground mb-1.5">Drag & Drop Lab Report</h3>
                    <p className="text-xs text-muted-foreground max-w-[28ch] leading-relaxed mb-3">
                      Drop your files here (PDF, CSV) or click to browse.
                    </p>
                    <span className="text-[10px] font-semibold bg-[#D4BDAD]/15 text-[#8A7A6A] border border-[#D4BDAD]/20 px-3 py-1 rounded-full">
                      Try with patient_report.pdf
                    </span>
                  </label>
                </div>
              )}

              {uploadState === 'dragging' && (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-[#8A7A6A] bg-[#D4BDAD]/10 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[220px] transition-all animate-pulse"
                >
                  <UploadCloud className="w-12 h-12 text-[#8A7A6A] mb-4" />
                  <h3 className="text-sm font-bold text-[#8A7A6A] mb-1">Release to Drop</h3>
                  <p className="text-xs text-muted-foreground">Sandbox accepts medical lab sheets.</p>
                </div>
              )}

              {uploadState === 'processing' && (
                <div className="border border-border bg-background/40 rounded-xl p-6 flex flex-col justify-center min-h-[220px] transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground truncate max-w-[80%]">{uploadedFileName}</span>
                    <span className="text-xs font-black text-[#8A7A6A]">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-border/60 rounded-full overflow-hidden mb-4">
                    <div 
                      className="h-full bg-gradient-primary rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #D4BDAD, #8A7A6A)' }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-[#8A7A6A] animate-spin shrink-0" />
                    <p className="text-xs text-muted-foreground animate-pulse italic">{processingStep}</p>
                  </div>
                </div>
              )}

              {uploadState === 'completed' && (
                <div className="border border-border bg-[#1A9966]/5 rounded-xl p-6 flex flex-col justify-between min-h-[220px] transition-all animate-fade-in">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-full bg-[#1A9966] flex items-center justify-center text-white">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <h4 className="text-xs font-bold text-foreground">Extraction Complete</h4>
                    </div>
                    <div className="bg-background border border-border/60 rounded-lg p-3.5 mb-4">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
                        <span className="text-[10px] font-black text-muted-foreground uppercase">Biomarker Map</span>
                        <span className="text-[10px] font-bold text-[#1A9966]">3 Flagged High</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">Morning Cortisol</span>
                          <span className="font-bold text-[#F04E14]">28.4 μg/dL (High)</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">Total Cholesterol</span>
                          <span className="font-bold text-[#D41717]">290 mg/dL (Critical)</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">Hemoglobin</span>
                          <span className="font-bold text-[#1A9966]">14.2 g/dL (Optimal)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <button 
                      onClick={() => navigate('/login')} 
                      className="flex-1 py-2.5 rounded-xl bg-[#D4BDAD] text-white text-xs font-bold shadow hover:bg-[#8A7A6A] transition-all cursor-pointer"
                    >
                      Access Suite
                    </button>
                    <button 
                      onClick={() => setUploadState('idle')} 
                      className="px-4 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:bg-muted transition-all cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom security disclaimer */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[9px] text-muted-foreground border-t border-border/40 pt-3">
                <Lock className="w-3 h-3 text-[#8A7A6A]" /> Fully encrypted Presidio PHI masking, HIPAA compliant
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── Technology Stack & Feature Showcase Grid ───────────────── */}
      <section id="features" className="relative z-10 border-t border-border/40 bg-muted/30 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[10px] font-black uppercase text-[#8A7A6A] tracking-widest mb-3 inline-block">Architecture Core</span>
            <h2 className="text-3xl font-black text-foreground tracking-tight mb-4">Precision Processing Pipeline</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We process lab sheets through a robust three-tier microservice architecture using pnpm & Turborepo, prioritizing strict security and medical standardizations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="bg-card border border-border/60 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-[#D4BDAD]/15 flex items-center justify-center text-[#8A7A6A] mb-5">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">Multi-OCR Extraction Cascade</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Automatic detection of digital vs scanned PDFs. Cascade parses using fast PyMuPDF, falls back to layout-aware pdfplumber, and routes unreadable pages via high-fidelity Mistral OCR.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground bg-[#D4BDAD]/10 border border-[#D4BDAD]/25 px-2.5 py-1 rounded-lg w-fit">
                PyMuPDF + pdfplumber + Mistral
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-card border border-border/60 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-[#1A9966]/10 flex items-center justify-center text-[#1A9966] mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">Zero-Leak PII Masking Vault</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Prior to LLM interactions, Microsoft Presidio NLP identifies and scrubs all personal details, utilizing a local deterministic token vault for secure bidirectional identifier resolution.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground bg-[#1A9966]/10 border border-[#1A9966]/20 px-2.5 py-1 rounded-lg w-fit">
                Presidio Masking + Token Vault
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-card border border-border/60 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-[#0891b2]/10 flex items-center justify-center text-[#0891b2] mb-5">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">Standardized RAG Chat</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Clinical answers are grounded in patients biomarkers using pgvector distance filtering, utilizing history-aware prompt rewriting and auto-citation of NCBI PubMed references.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground bg-[#0891b2]/10 border border-[#0891b2]/20 px-2.5 py-1 rounded-lg w-fit">
                pgvector + PubMed Citations
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Interactive Biomarker Metric Preview Section ────────────── */}
      <section id="biomarkers" className="relative z-10 border-t border-border/40 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column (Descriptive) */}
            <div className="lg:col-span-5 text-left">
              <span className="text-[10px] font-black uppercase text-[#8A7A6A] tracking-widest mb-3 inline-block">Visual Indicators</span>
              <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight mb-4">
                Interactive Range Normalization
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                All raw values map automatically to normalized clinical biomarker panels. Test the range slider to see how values trigger semantic warnings based on dynamic threshold ranges.
              </p>
              <div className="flex items-center gap-3 mb-5">
                <button 
                  onClick={() => { setBiomarkerName('cortisol'); setSliderValue(55); }}
                  className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${biomarkerName === 'cortisol' ? 'bg-[#D4BDAD] text-white' : 'border border-border text-foreground hover:bg-muted'}`}
                >
                  Morning Cortisol
                </button>
                <button 
                  onClick={() => { setBiomarkerName('hemoglobin'); setSliderValue(60); }}
                  className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${biomarkerName === 'hemoglobin' ? 'bg-[#D4BDAD] text-white' : 'border border-border text-foreground hover:bg-muted'}`}
                >
                  Hemoglobin
                </button>
              </div>
              <div className="flex items-start gap-3 bg-muted/40 border border-border/60 rounded-xl p-4.5">
                <Info className="w-5 h-5 text-[#8A7A6A] shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">{currentStatus.desc}</p>
              </div>
            </div>

            {/* Right Column (Interactive Panel) */}
            <div className="lg:col-span-7">
              <div className="bg-card border border-border/80 rounded-2xl shadow-lg p-6 max-w-xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {biomarkerName === 'cortisol' ? 'Cortisol (AM Testing)' : 'Hemoglobin'}
                    </h3>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Panel: {biomarkerName === 'cortisol' ? 'Adrenal & Hormone Health' : 'Hemic System'}
                    </span>
                  </div>
                  <span className={`text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full border ${currentStatus.class} transition-all`}>
                    {currentStatus.label}
                  </span>
                </div>

                {/* Slider Component */}
                <div className="mb-8">
                  <div className="flex justify-between text-[11px] mb-3 font-semibold text-muted-foreground">
                    <span>
                      Current Value: <strong className="text-foreground text-sm font-extrabold">
                        {biomarkerName === 'cortisol' ? `${(sliderValue * 0.4).toFixed(1)} μg/dL` : `${(sliderValue * 0.2 + 8).toFixed(1)} g/dL`}
                      </strong>
                    </span>
                    <span>
                      Ref Range: {biomarkerName === 'cortisol' ? '6.0 – 18.0 μg/dL' : '13.5 – 17.5 g/dL'}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="10"
                    max="100"
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-[#8A7A6A] focus:outline-none"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-2 font-medium">
                    <span>Low</span>
                    <span>Optimal (Ref Range)</span>
                    <span>High</span>
                    <span>Critical</span>
                  </div>
                </div>

                {/* Print-safe scale indicators */}
                <div className="border-t border-border/40 pt-5">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">Print-Safe Scale Render</h4>
                  
                  {/* Clean HTML scale */}
                  <div className="flex w-full h-3 rounded-full overflow-hidden border border-border">
                    <div className="bg-[#C97D0A]/35" style={{ width: biomarkerName === 'cortisol' ? '30%' : '40%' }}>
                      {sliderValue < (biomarkerName === 'cortisol' ? 30 : 40) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground mx-auto my-0.5" />
                      )}
                    </div>
                    <div className="bg-[#1A9966]/35" style={{ width: biomarkerName === 'cortisol' ? '45%' : '40%' }}>
                      {sliderValue >= (biomarkerName === 'cortisol' ? 30 : 40) && sliderValue <= (biomarkerName === 'cortisol' ? 75 : 80) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground mx-auto my-0.5" />
                      )}
                    </div>
                    <div className="bg-[#F04E14]/35" style={{ width: biomarkerName === 'cortisol' ? '15%' : '20%' }}>
                      {sliderValue > (biomarkerName === 'cortisol' ? 75 : 80) && sliderValue <= (biomarkerName === 'cortisol' ? 90 : 100) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground mx-auto my-0.5" />
                      )}
                    </div>
                    {biomarkerName === 'cortisol' && (
                      <div className="bg-[#D41717]/35" style={{ width: '10%' }}>
                        {sliderValue > 90 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-foreground mx-auto my-0.5" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Interactive RAG Chat & PubMed citations Preview ────────── */}
      <section id="RAG-grounding" className="relative z-10 border-t border-border/40 bg-muted/20 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Chat Sandbox Column */}
            <div className="lg:col-span-7">
              <div className="bg-card border border-border/80 rounded-2xl shadow-lg p-5 max-w-xl mx-auto">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3.5 mb-4">
                  <Brain className="w-4 h-4 text-[#8A7A6A]" />
                  <span className="text-xs font-bold text-foreground">Interactive RAG Assistant Preview</span>
                </div>

                <div className="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-1">
                  
                  {/* User message */}
                  <div className="flex gap-3 justify-end">
                    <div className="bg-[#D4BDAD] text-white rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] text-xs font-medium">
                      {chatMessage}
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#8A7A6A] flex items-center justify-center font-bold text-white shrink-0 text-xs">
                      A
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] text-xs text-foreground leading-relaxed">
                      Your morning cortisol level is 28.4 μg/dL. Based on guidelines, morning values above 18.0 μg/dL indicate adrenal hyperactivity, stress response, or other factors. 
                      <br /><br />
                      Clinical guidance recommends longitudinal checks to rule out transient stress variables 
                      
                      {/* Interactive Citation Bubble */}
                      <button 
                        onClick={() => setRagExpanded(!ragExpanded)}
                        className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded bg-background border border-[#D4BDAD] text-[#8A7A6A] hover:bg-[#D4BDAD]/10 font-bold text-[9px] cursor-pointer"
                      >
                        [PubMed 3841029] {ragExpanded ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded PubMed Citation Abstract */}
                  {ragExpanded && (
                    <div className="ml-11 bg-background border border-[#D4BDAD]/40 rounded-xl p-4.5 animate-fade-in text-left">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
                        <span className="text-[9px] font-black text-[#8A7A6A] uppercase tracking-wider">{MOCK_CITATION.id}</span>
                        <a 
                          href={MOCK_CITATION.link} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                        >
                          PubMed Link <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <h4 className="text-xs font-bold text-foreground mb-1">{MOCK_CITATION.title}</h4>
                      <p className="text-[10px] text-muted-foreground italic mb-2">{MOCK_CITATION.journal}</p>
                      <p className="text-[10px] text-muted-foreground leading-normal">{MOCK_CITATION.abstract}</p>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Explanatory Column */}
            <div className="lg:col-span-5 text-left">
              <span className="text-[10px] font-black uppercase text-[#8A7A6A] tracking-widest mb-3 inline-block">Grounding Security</span>
              <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight mb-4">
                Clinical PubMed Grounding
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Auriem AI Chat parses medical questions and grounds answers directly in your biomarker metrics.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When clinical keywords are triggered, the backend automatically initiates PubMed indexing queries, injecting abstracts and link verification directly into responses to provide scientific validation.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Clinicians/Labs Workspace Preview Section ────────────────── */}
      <section id="clinicians" className="relative z-10 border-t border-border/40 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[10px] font-black uppercase text-[#8A7A6A] tracking-widest mb-3 inline-block">Clinic Workspace</span>
            <h2 className="text-3xl font-black text-foreground tracking-tight mb-4">Built for Clinical Operations</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Equip practitioners with comprehensive dashboards to manage directories, onboard patients, generate reports, schedule appointments, and coordinate daily tasks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Feature card 1 */}
            <div className="bg-card border border-border/60 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-[#D4BDAD]/15 flex items-center justify-center text-[#8A7A6A] mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-foreground mb-1.5">Searchable Directories</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Instantly search clinical patient archives, filter historical uploads, and register new patients.
              </p>
            </div>

            {/* Feature card 2 */}
            <div className="bg-card border border-border/60 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-[#1A9966]/10 flex items-center justify-center text-[#1A9966] mb-4">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-foreground mb-1.5">Unified Scheduling</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Appointments sidebars with custom status badges (Scheduled, Completed, No-Show) and creation dialogs.
              </p>
            </div>

            {/* Feature card 3 */}
            <div className="bg-card border border-border/60 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-[#0891b2]/10 flex items-center justify-center text-[#0891b2] mb-4">
                <ListTodo className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-foreground mb-1.5">Task Sidebars</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Organize work with prioritized task filters (High, Medium, Low) and quick checkbox updates.
              </p>
            </div>

            {/* Feature card 4 */}
            <div className="bg-card border border-border/60 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-[#F04E14]/10 flex items-center justify-center text-[#F04E14] mb-4">
                <FileDown className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-foreground mb-1.5">Premium PDF Reports</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Compile clinical results into beautiful, branded, and print-safe PDF documents.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Committed Bottom CTA Section ──────────────────────────────── */}
      <section className="relative z-10 border-t border-border/40 py-20 bg-gradient-to-br from-[#D4BDAD]/15 to-[#B8A89A]/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-5">
            Ready to normalize your clinical workflows?
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Experience the Auriem Clinical Suite sandbox by signing up as a clinician, or request a full tenant portal layout configuration.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={() => navigate('/login')} 
              className="bg-[#D4BDAD] text-white px-8 py-4.5 rounded-xl font-bold text-xs hover:bg-[#8A7A6A] transition-all shadow hover:shadow-md cursor-pointer"
            >
              Sign Up for Free Account
            </button>
            <button 
              onClick={() => navigate('/login')} 
              className="bg-card border border-border hover:bg-muted text-foreground px-8 py-4.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Schedule Platform Demo
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/40 py-10 bg-background transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[#D4BDAD] flex items-center justify-center font-bold text-white text-[10px]">
              {branding.brandName.substring(0, 1).toUpperCase()}
            </div>
            <span className="text-xs font-extrabold text-foreground tracking-tight">
              © 2026 {branding.brandName} Clinical Suite. All rights reserved.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] font-bold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#biomarkers" className="hover:text-foreground transition-colors">Demo</a>
            <a href="/guide" className="hover:text-foreground transition-colors">Documentation</a>
            <a href="/login" className="hover:text-foreground transition-colors">Clinician Portal</a>
            <span className="text-muted-foreground/60">Powered by Huumanize</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
