import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Sparkles,
  Upload,
  TrendingUp,
  MessageSquare,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  FileText,
  Info,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function Guide() {
  const navigate = useNavigate();
  const { principal } = useAuth();
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'PATIENT' | 'STAFF'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAnchor, setActiveAnchor] = useState('quick-start');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Set default role filter based on logged in user's role
  useEffect(() => {
    if (principal?.accountType === 'STAFF') {
      setRoleFilter('STAFF');
    } else if (principal?.accountType === 'PATIENT') {
      setRoleFilter('PATIENT');
    }
  }, [principal]);

  // ─── Interactive Widget States ───────────────────────────────
  
  // 1. Upload Simulator States
  const [simUploadState, setSimUploadState] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [simProgress, setSimProgress] = useState(0);
  const uploadTimerRef = useRef<any>(null);

  const startUploadSimulation = () => {
    if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    setSimUploadState('uploading');
    setSimProgress(0);
    
    let progress = 0;
    uploadTimerRef.current = setInterval(() => {
      progress += 10;
      setSimProgress(progress);
      if (progress >= 100) {
        clearInterval(uploadTimerRef.current);
        setSimUploadState('processing');
        
        // Wait a bit for processing
        setTimeout(() => {
          setSimUploadState('done');
        }, 1200);
      }
    }, 150);
  };

  // 2. Biomarker Slider States
  const [sliderVal, setSliderVal] = useState(24); // Deficient by default
  const [sliderStatus, setSliderStatus] = useState<'critical-low' | 'deficient' | 'normal' | 'high'>('deficient');

  const updateSliderState = (val: number) => {
    setSliderVal(val);
    if (val < 15) setSliderStatus('critical-low');
    else if (val < 30) setSliderStatus('deficient');
    else if (val <= 70) setSliderStatus('normal');
    else setSliderStatus('high');
  };

  // 3. Trends Simulator States
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const trendData = [
    { date: 'Dec 2025', val: 18, status: 'Deficient' },
    { date: 'Feb 2026', val: 24, status: 'Deficient' },
    { date: 'Jun 2026', val: 38, status: 'Normal' },
  ];

  // 4. AI Chat Simulator States
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Hello! I am your AI Care assistant. Click one of the common prompts below to see how I help you understand your reports.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const mockPrompts = [
    {
      q: 'Why is my Vitamin D low?',
      a: 'Your Vitamin D is currently at 24 ng/mL, which is classified as Deficient. Low Vitamin D can be caused by limited sun exposure, dietary factors, or absorption issues. Since Vitamin D is crucial for bone health and immune function, clinical guidelines typically suggest daily supplementation (1,000-2,000 IU) and increasing intake of egg yolks, fatty fish, and fortified foods. Consult your physician to establish a safe dosage.'
    },
    {
      q: 'What is a Wellness Index Score?',
      a: 'The Wellness Index is a consolidated health score (0-100) computed based on the ratio of normal, borderline, and high-risk biomarkers extracted from your lab report. A score of 80+ indicates excellent wellness, 60-79 indicates moderate anomalies to track, and below 60 suggests clinical follow-ups. It helps you monitor overall biological baseline shifts over time.'
    },
    {
      q: 'Is my health data secure here?',
      a: 'Absolutely. Auriem is fully HIPAA-compliant. All uploaded diagnostic PDFs are encrypted both in transit (using SSL/TLS) and at rest (using AES-256). Furthermore, all patient information and extracted biomarkers are sequestered within a secure organizational boundary, ensuring that only authorized clinical staff or yourself have access.'
    }
  ];

  const triggerChatSimulation = (prompt: typeof mockPrompts[0]) => {
    if (isTyping) return;
    
    // Add User prompt
    setChatMessages(prev => [...prev, { sender: 'user', text: prompt.q }]);
    setIsTyping(true);
    
    // Simulate AI printing response
    setTimeout(() => {
      setIsTyping(false);
      setChatMessages(prev => [...prev, { sender: 'ai', text: prompt.a }]);
    }, 1500);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    };
  }, []);

  // Scroll spy to highlight active sidebar item
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      
      const sections = ['quick-start', 'managing-reports', 'deciphering-biomarkers', 'ai-care-chat', 'faqs'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveAnchor(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 100,
        behavior: 'smooth'
      });
      setActiveAnchor(id);
    }
  };

  // FAQ contents
  const faqs = [
    {
      q: 'Does LabAI diagnose diseases?',
      a: 'No. LabAI is an educational and analytical tool designed to help you interpret laboratory report values. It does not provide medical diagnoses or replace professional consultations with qualified healthcare providers.'
    },
    {
      q: 'How accurate is the PDF biomarker extraction?',
      a: 'Our extraction engine operates with high accuracy using advanced OCR models. It extracts exact numerical values, units, and reference ranges directly from your PDF. However, you should always double-check the extracted values against your original paper report.'
    },
    {
      q: 'Is my health data secure and private?',
      a: 'Yes, absolutely. We prioritize your privacy. All uploaded documents are processed securely, and personal health information (PHI) is protected. We use industry-standard encryption and do not share your private data with third parties.'
    },
    {
      q: 'What types of reports can I upload?',
      a: 'We support standard blood panels including Complete Blood Count (CBC), Comprehensive Metabolic Panel (CMP), Lipid Panels (cholesterol), Thyroid Panels, and common hormone or vitamin tests. Files should be in PDF format.'
    },
    {
      q: 'Can clinicians upload reports for patients?',
      a: 'Yes. In the Clinician Dashboard, doctors and staff can select any patient profile from the Patients Directory and click "Upload Lab PDF" to associate a diagnostic report directly with that patient\'s longitudinal record.'
    }
  ];

  // Render guide content cards
  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 pb-20" style={{ background: 'var(--background)' }}>
      {/* Header Bar */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border/40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl border border-border hover:bg-border/20 text-foreground transition-all cursor-pointer bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Sparkles className="w-5.5 h-5.5 text-[var(--primary-text)]" />
              Auriem Platform Guide
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Comprehensive documentation and interactive tool guide</p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search guide & FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-border/40 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Role Filter Toggle */}
          <div className="flex rounded-xl border border-border/40 overflow-hidden bg-card/50 p-1 w-full sm:w-auto">
            {(['ALL', 'PATIENT', 'STAFF'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 bg-transparent flex-1 sm:flex-initial text-center',
                  roleFilter === role
                    ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-extrabold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {role === 'ALL' ? 'All Guides' : role === 'PATIENT' ? 'For Patients' : 'For Clinicians'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Two Column Layout */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Column 1: Sticky Navigation Tree (25% Width) */}
        <aside className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="glass-card rounded-2xl border border-border/40 p-5 space-y-3 bg-card/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Guide Contents</h3>
              <nav className="flex flex-col gap-1">
                {[
                  { id: 'quick-start', label: '🚀 Quick Start Guide', show: true },
                  { id: 'visual-tour', label: '📸 Step-by-Step Tour', show: true },
                  { 
                    id: 'managing-reports', 
                    label: '📄 Managing Lab Reports', 
                    show: roleFilter !== 'STAFF' 
                  },
                  { id: 'deciphering-biomarkers', label: '📊 Deciphering Biomarkers', show: true },
                  { id: 'ai-care-chat', label: '💬 Engaging with AI Care', show: true },
                  { id: 'faqs', label: '❓ Frequently Asked FAQs', show: true }
                ].map((item) => {
                  if (!item.show) return null;
                  const active = activeAnchor === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-xl text-xs font-semibold border-0 transition-all cursor-pointer flex items-center justify-between',
                        active
                          ? 'bg-[var(--primary)]/15 text-[var(--primary-text)] font-bold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-border/10 bg-transparent'
                      )}
                    >
                      <span>{item.label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-[var(--primary-text)]" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Context Card */}
            <div className="p-4 rounded-xl border border-border/20 bg-muted/20 space-y-2.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Security Standards
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Auriem is built on military-grade encryption models and compliant under standard HIPAA health safety protocols. Your reports are sequestered within organization containers.
              </p>
            </div>
          </div>
        </aside>

        {/* Column 2: Content Canvas (75% Width) */}
        <section className="col-span-1 lg:col-span-3 space-y-12">

          {/* Section 1: Quick Start Guide */}
          <article id="quick-start" className="glass-card rounded-2xl border border-border/40 p-6 md:p-8 space-y-6 bg-card">
            <div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Onboarding Overview
              </span>
              <h2 className="text-xl md:text-2xl font-black text-foreground mt-3 tracking-tight">🚀 Quick Start Guide</h2>
              <p className="text-xs text-muted-foreground mt-1">Get up and running with the Auriem Lab Interpretation Suite</p>
            </div>

            <p className="text-sm text-foreground/90 leading-relaxed font-medium">
              Welcome to your dedicated onboarding center. The Auriem Health Suite translates standard, confusing laboratory diagnostic paper sheets and blood-work PDFs into a clean, interactive wellness matrix. 
            </p>

            {/* Interactive Journey Flowchart Diagram */}
            <div className="p-5 rounded-2xl border border-border/40 bg-muted/20 space-y-4">
              <h4 className="text-xs font-bold text-foreground tracking-wide uppercase">Core Platform Journey</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                {[
                  { step: '1', title: 'Upload PDF', desc: 'Drop blood work files to parse.', icon: Upload },
                  { step: '2', title: 'Biomarkers', desc: 'Review range highlights.', icon: FileText },
                  { step: '3', title: 'Track Trends', desc: 'Graph longitudinal values.', icon: TrendingUp },
                  { step: '4', title: 'Consult AI', desc: 'Get care plans and descriptions.', icon: MessageSquare }
                ].map((j, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-3 rounded-xl bg-card border border-border/30 relative">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-[var(--primary-text)] bg-[var(--primary)]/15 border border-[var(--primary)]/30 mb-2">
                      {j.step}
                    </div>
                    <j.icon className="w-4 h-4 text-muted-foreground mb-1" />
                    <h5 className="text-xs font-extrabold text-foreground">{j.title}</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{j.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* Section 1.5: Visual Step-by-Step Tour */}
          <article id="visual-tour" className="glass-card rounded-2xl border border-border/40 p-6 md:p-8 space-y-8 bg-card">
            <div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                Visual Walkthrough
              </span>
              <h2 className="text-xl md:text-2xl font-black text-foreground mt-3 tracking-tight">📸 Step-by-Step Dashboard Tour</h2>
              <p className="text-xs text-muted-foreground mt-1">High-fidelity annotated screenshots of the primary user and doctor workflows</p>
            </div>

            <div className="space-y-10">
              {/* Step 1: Drag & Drop Ingestion Portal */}
              {roleFilter !== 'STAFF' && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-xs font-black">1</span>
                    <h3 className="text-sm font-bold text-foreground">Welcome Screen & Lab Report Ingestion</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                    When patients first log in, they are presented with a drag-and-drop ingestion interface. Here, they can upload blood work PDFs directly, explore the sample dashboard, or read the static platform documentation. Highlight features show parsed panels, range visuals, and clinical insights capabilities.
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-lg hover:scale-[1.005] transition-transform duration-300 ml-9">
                    <img 
                      src="/screenshots/Step-1.png" 
                      alt="Ingestion Portal Welcome Screen" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Step 1.1: Automated Extraction and Validation */}
              {roleFilter !== 'STAFF' && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-xs font-black">1.1</span>
                    <h3 className="text-sm font-bold text-foreground">Real-Time Lab Results Extraction Pipeline</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                    During the upload flow, the parsing progress dialog is displayed showing active OCR validation states. It gives feedback on extracting biomarkers, computing reference ranges, and generating personalized wellness summaries.
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-lg hover:scale-[1.005] transition-transform duration-300 ml-9">
                    <img 
                      src="/screenshots/Step-1.1.png" 
                      alt="Lab Result Extraction Pipeline Status" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Main Patient Dashboard Overview */}
              {roleFilter !== 'STAFF' && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-xs font-black">2</span>
                    <h3 className="text-sm font-bold text-foreground">Patient Dashboard Tabs & Layout</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                    The parsed clinical report is displayed across four tabs. You can view the <strong>Current Report</strong> (detailed range sliders for each biomarker), click <strong>Trends</strong> to view longitudinal timeline graphs, chat with the <strong>AI Clinical Care</strong> co-pilot, or select <strong>Compare</strong> to compare two different report dates.
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-lg hover:scale-[1.005] transition-transform duration-300 ml-9">
                    <img 
                      src="/screenshots/Step-2.png" 
                      alt="Main Dashboard Navigation and Workspace Tabs" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Accessing Lab Report History */}
              {roleFilter !== 'STAFF' && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-xs font-black">3</span>
                    <h3 className="text-sm font-bold text-foreground">Lab Report History Logs</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                    Access all previously processed diagnostic records directly from the sidebar folder directory. You can download the original raw PDF copy or click the <strong>Review</strong> action to load the structured dashboard view.
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-lg hover:scale-[1.005] transition-transform duration-300 ml-9">
                    <img 
                      src="/screenshots/Step-3.png" 
                      alt="Lab Report History Table" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Doctor Portal & Clinical Management */}
              {roleFilter !== 'PATIENT' && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-xs font-black">4</span>
                    <h3 className="text-sm font-bold text-foreground">Doctor Portal Clinical Dashboard</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                    The Doctor Portal dashboard gives clinicians administrative oversight. Medical staff can register new patient accounts, upload PDF reports, monitor global metrics, and manage pending client caseloads.
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-lg hover:scale-[1.005] transition-transform duration-300 ml-9">
                    <img 
                      src="/screenshots/Step-4.png" 
                      alt="Doctor Portal Management Dashboard" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* Section 2: Managing Lab Reports */}
          {roleFilter !== 'STAFF' && (
            <article id="managing-reports" className="glass-card rounded-2xl border border-border/40 p-6 md:p-8 space-y-6 bg-card">
              <div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--primary)]/15 text-[var(--primary-text)] border border-[var(--primary)]/30">
                  Data Ingestion
                </span>
                <h2 className="text-xl md:text-2xl font-black text-foreground mt-3 tracking-tight">📄 Managing Lab Reports</h2>
                <p className="text-xs text-muted-foreground mt-1">Uploading diagnostic reports and verifying processing status</p>
              </div>

              {/* Pattern A: Problem -> Solution -> Visual */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Info className="w-4.5 h-4.5 text-[var(--primary-text)]" />
                  How Ingestion Works
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong>The Problem:</strong> Lab reports are formatted as custom tabular columns that vary in page width, naming aliases (e.g. "Vitamin D3" vs "25-OH Vit D"), and standard units, making them painful to compare.
                  <br />
                  <strong>Our Solution:</strong> Our OCR intelligence identifies biomarker rows, normalizes names to dictionary standards, extracts ranges, and structures the values into database objects instantly.
                </p>
              </div>

              {/* Interactive Ingestion Simulator Widget */}
              <div className="p-5 rounded-2xl border border-border/40 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Interactive Ingestion Simulator</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Click simulate to watch the extraction microservice work in real time</p>
                  </div>
                  {simUploadState !== 'idle' && (
                    <button
                      onClick={() => setSimUploadState('idle')}
                      className="text-[10px] font-bold text-[var(--primary-text)] hover:underline border-0 bg-transparent cursor-pointer"
                    >
                      Reset Sim
                    </button>
                  )}
                </div>

                <div className="border border-border/30 rounded-xl bg-card p-6 flex flex-col items-center justify-center min-h-[160px] text-center relative overflow-hidden">
                  {simUploadState === 'idle' && (
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--primary)]/10 text-[var(--primary-text)] mx-auto">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Simulate Ingestion Flow</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Drag & drop simulated lab PDF</p>
                      </div>
                      <button
                        onClick={startUploadSimulation}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow hover:opacity-90 active:scale-95 transition-all border-0 cursor-pointer"
                        style={{ background: 'var(--primary-text)' }}
                      >
                        Start Upload Simulation
                      </button>
                    </div>
                  )}

                  {simUploadState === 'uploading' && (
                    <div className="w-full max-w-xs space-y-3">
                      <div className="flex justify-between text-[11px] font-bold text-foreground">
                        <span>Uploading blood_work_panel.pdf</span>
                        <span>{simProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-[var(--primary-text)] transition-all duration-150"
                          style={{ width: `${simProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground animate-pulse">Transferring document to Supabase storage...</p>
                    </div>
                  )}

                  {simUploadState === 'processing' && (
                    <div className="space-y-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-500 mx-auto">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Extracting Biomarker Values</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Running OCR parser and normalizing dictionaries...</p>
                      </div>
                    </div>
                  )}

                  {simUploadState === 'done' && (
                    <div className="space-y-3 animate-scale-in">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-500 mx-auto">
                        <CheckCircle2 className="w-5.5 h-5.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Extraction Complete!</p>
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">18 Biomarkers Extracted &bull; Accuracy Score 99.8%</p>
                      </div>
                      <div className="flex justify-center gap-1.5 flex-wrap">
                        {['Hemoglobin', 'Cholesterol', 'Vitamin D', 'TSH'].map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-emerald-500/5 text-emerald-600 border border-emerald-500/15">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 Screenshot: Parsed Biomarkers List */}
              <div className="space-y-2 pt-4 border-t border-border/20">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-[10px] font-black">2</span>
                  Biomarker Interpretation View
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Once parsed, the dashboard presents a structured summary list. Biomarkers are clearly organized, with key indicators showing whether they are **Deficient**, **Normal**, or **High** to help you identify outliers at a glance.
                </p>
                <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-md hover:scale-[1.005] transition-transform duration-300">
                  <img 
                    src="/screenshots/biomarker_summary.png" 
                    alt="Biomarker Summary Screenshot" 
                    className="w-full h-auto object-cover max-h-[350px]"
                  />
                </div>
              </div>
            </article>
          )}

          {/* Section 3: Deciphering Your Biomarkers */}
          <article id="deciphering-biomarkers" className="glass-card rounded-2xl border border-border/40 p-6 md:p-8 space-y-6 bg-card">
            <div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-500 border border-purple-500/20">
                Clinical Markers
              </span>
              <h2 className="text-xl md:text-2xl font-black text-foreground mt-3 tracking-tight">📊 Deciphering Biomarkers</h2>
              <p className="text-xs text-muted-foreground mt-1">Understanding health score models, sliders, and longitudinal trend lines</p>
            </div>

            {/* Pattern A: Problem -> Solution -> Visual */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-[var(--primary-text)]" />
                The Reference Slider Model
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Each biomarker contains custom ranges mapped in a multi-colored slider. The marker position visually highlights where your blood value falls relative to clinical low, normal, and high ranges.
              </p>
            </div>

            {/* Interactive Slider Widget */}
            <div className="p-5 rounded-2xl border border-border/40 bg-muted/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Interactive Range Slider</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Adjust the values or click preset toggles to see how indicators update</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSliderState(8)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-red-500/20 bg-red-500/5 text-red-500 cursor-pointer"
                  >
                    Low
                  </button>
                  <button
                    onClick={() => updateSliderState(24)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-amber-500/20 bg-amber-500/5 text-amber-500 cursor-pointer"
                  >
                    Deficient
                  </button>
                  <button
                    onClick={() => updateSliderState(52)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 cursor-pointer"
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => updateSliderState(85)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-red-500/20 bg-red-500/5 text-red-500 cursor-pointer"
                  >
                    High
                  </button>
                </div>
              </div>

              {/* Mock Slider Element */}
              <div className="border border-border/30 rounded-xl bg-card p-5 space-y-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="text-xs font-extrabold text-foreground">Vitamin D (25-Hydroxy)</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Primary biomarker for bone and immunomodulator health</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-foreground">{sliderVal}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">ng/mL</span>
                  </div>
                </div>

                {/* Slider bar */}
                <div className="space-y-2">
                  <div className="relative h-2 rounded-full bg-muted flex overflow-hidden">
                    <div className="w-[15%] h-full bg-red-500/35" title="Critical Low" />
                    <div className="w-[15%] h-full bg-amber-500/35" title="Deficient" />
                    <div className="w-[45%] h-full bg-emerald-500/35" title="Normal" />
                    <div className="w-[25%] h-full bg-red-500/35" title="High" />

                    {/* Indicator pin */}
                    <div
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-300',
                        sliderStatus === 'critical-low' && 'bg-red-500',
                        sliderStatus === 'deficient' && 'bg-amber-500',
                        sliderStatus === 'normal' && 'bg-emerald-500',
                        sliderStatus === 'high' && 'bg-red-500'
                      )}
                      style={{ left: `calc(${sliderVal}% - 8px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    <span>Low (0-15)</span>
                    <span>Deficient (15-30)</span>
                    <span>Normal (30-75)</span>
                    <span>High (75+)</span>
                  </div>
                </div>

                {/* Live Description block */}
                <div className="p-3 rounded-lg border border-border/15 bg-muted/10 flex gap-2">
                  <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {sliderStatus === 'critical-low' && 'Critical Alert: Levels below 15 ng/mL pose risks to bone homeostasis and require active prescription levels.'}
                    {sliderStatus === 'deficient' && 'Deficiency Warning: Values between 15-30 ng/mL represent insufficient levels. Increased vitamin D intake is recommended.'}
                    {sliderStatus === 'normal' && 'Healthy Baseline: Your levels are in the optimal clinical target zone, supporting cellular wellness.'}
                    {sliderStatus === 'high' && 'Toxicity Warning: Values exceeding 75 ng/mL are higher than standard limits. Supplementation intake should be reduced.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Trends Graph Simulator */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">Longitudinal Trackers (Trends)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Swapping reports from different test dates reveals trend paths. Monitoring biomarker trends helps patients and doctors see if health values improve in response to diet, exercise, or therapies.
              </p>

              <div className="p-5 rounded-2xl border border-border/40 bg-muted/20 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Interactive Trends Chart Simulator</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Hover over dates to see biomarker timeline details</p>
                </div>

                <div className="border border-border/30 rounded-xl bg-card p-5">
                  <div className="h-40 w-full relative flex items-end justify-between px-8 border-b border-l border-border/30 pb-4">
                    {/* SVG Trend Line */}
                    <svg className="absolute inset-0 w-full h-full p-8" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke="var(--primary-text)"
                        strokeWidth="3"
                        points="15,80 50,65 85,25"
                      />
                    </svg>

                    {/* Data Points */}
                    {trendData.map((d, idx) => {
                      const isHovered = hoveredTrendIndex === idx;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center relative z-10 cursor-pointer"
                          onMouseEnter={() => setHoveredTrendIndex(idx)}
                          onMouseLeave={() => setHoveredTrendIndex(null)}
                        >
                          {/* Tooltip */}
                          {isHovered && (
                            <div className="absolute bottom-12 bg-gray-900 text-white rounded-lg px-2.5 py-1 text-[9px] font-bold shadow-xl border border-gray-800 animate-scale-in text-center w-24 z-20">
                              <p className="font-extrabold">{d.val} ng/mL</p>
                              <p className="text-[8px] opacity-75">{d.status}</p>
                            </div>
                          )}
                          
                          {/* Dot marker */}
                          <div
                            className={cn(
                              'w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-transform duration-200',
                              idx === 2 ? 'bg-emerald-500' : 'bg-amber-500',
                              isHovered && 'scale-125'
                            )}
                            style={{
                              transform: isHovered ? 'translateY(-20px) scale(1.25)' : 'translateY(-20px)'
                            }}
                          />
                          <span className="text-[9px] font-bold text-muted-foreground mt-2">{d.date}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 & 4 Screenshots: Trends and Comparison */}
            <div className="space-y-6 pt-4 border-t border-border/20">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-[10px] font-black">3</span>
                  Longitudinal Trends Graph
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  By clicking the **Trends** tab on the dashboard, you can see historical graphs plotting biomarker changes across multiple reports to track shifts in your health trajectory.
                </p>
                <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-md hover:scale-[1.005] transition-transform duration-300">
                  <img 
                    src="/screenshots/historical_trends.png" 
                    alt="Historical Trends Screenshot" 
                    className="w-full h-auto object-cover max-h-[350px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-[10px] font-black">4</span>
                  Side-by-Side Report Comparison
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  By clicking the **Compare** tab, you can select any two reports side-by-side. The dashboard automatically calculates percentage changes and variations between biomarker results.
                </p>
                <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-md hover:scale-[1.005] transition-transform duration-300">
                  <img 
                    src="/screenshots/compare_reports.png" 
                    alt="Report Comparison Screenshot" 
                    className="w-full h-auto object-cover max-h-[350px]"
                  />
                </div>
              </div>
            </div>
          </article>

          {/* Section 4: Engaging with AI Care Chat */}
          <article id="ai-care-chat" className="glass-card rounded-2xl border border-border/40 p-6 md:p-8 space-y-6 bg-card">
            <div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                AI Consulting
              </span>
              <h2 className="text-xl md:text-2xl font-black text-foreground mt-3 tracking-tight">💬 Engaging with AI Care Chat</h2>
              <p className="text-xs text-muted-foreground mt-1">Consulting our clinical intelligence assistant about report details</p>
            </div>

            {/* Pattern A: Problem -> Solution -> Visual */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-[var(--primary-text)]" />
                HIPAA-Compliant AI Consultation
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>The Problem:</strong> Doctor appointments are short, and patients often leave with unasked questions, turning to unverified search engine articles.
                <br />
                <strong>Our Solution:</strong> Our AI Care assistant parses the extracted biomarker data in context, answering physiological queries based on recognized clinical guidelines.
              </p>
            </div>

            {/* Interactive AI Chat Widget */}
            <div className="p-5 rounded-2xl border border-border/40 bg-muted/20 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">Interactive AI Chat Console</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Click a prompt bubble to see an AI response simulation</p>
              </div>

              <div className="border border-border/30 rounded-xl bg-card overflow-hidden flex flex-col h-80">
                {/* Chat window messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-muted/5">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex w-full',
                        msg.sender === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm',
                          msg.sender === 'user'
                            ? 'bg-[var(--primary-text)] text-white rounded-tr-none'
                            : 'bg-muted/50 border border-border/20 text-foreground rounded-tl-none'
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex w-full justify-start">
                      <div className="bg-muted/50 border border-border/20 rounded-2xl rounded-tl-none px-4 py-2 text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Prompt choices */}
                <div className="p-3 border-t border-border/20 bg-muted/15 flex gap-2 overflow-x-auto">
                  {mockPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => triggerChatSimulation(p)}
                      disabled={isTyping}
                      className="whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold border border-border bg-card text-foreground hover:bg-border/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {p.q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 5 Screenshot: AI Clinical Assistant Chat */}
            <div className="space-y-2 pt-4 border-t border-border/20">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary-text)] flex items-center justify-center text-[10px] font-black">5</span>
                Interactive AI Chat Console
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The **AI Care** panel allows you to chat directly with Auriem's clinical assistant. You can click on preset prompt suggestions or type custom questions to receive physiological context and food recommendations.
              </p>
              <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-md hover:scale-[1.005] transition-transform duration-300">
                <img 
                  src="/screenshots/ai_chat.png" 
                  alt="AI Chat Screenshot" 
                  className="w-full h-auto object-cover max-h-[350px]"
                />
              </div>
            </div>
          </article>

          {/* Section 5: Frequently Asked Questions */}
          <article id="faqs" className="glass-card rounded-2xl border border-border/40 p-6 md:p-8 space-y-6 bg-card">
            <div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-500/10 text-gray-500 border border-gray-500/20">
                FAQ Hub
              </span>
              <h2 className="text-xl md:text-2xl font-black text-foreground mt-3 tracking-tight">❓ Frequently Asked Questions (FAQs)</h2>
              <p className="text-xs text-muted-foreground mt-1">Frequently asked questions regarding report interpretation and security</p>
            </div>

            {/* Pattern B: FAQ Accordion Expansion */}
            <div className="space-y-3">
              {filteredFaqs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching FAQ topics found.</p>
              ) : (
                filteredFaqs.map((faq, idx) => {
                  const active = expandedFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-border/30 rounded-xl overflow-hidden bg-card/50 transition-all hover:border-[var(--primary)]/30"
                    >
                      <button
                        onClick={() => setExpandedFaq(active ? null : idx)}
                        className="w-full flex items-center justify-between p-4 text-left text-xs font-bold text-foreground hover:bg-border/10 cursor-pointer border-0 bg-transparent transition-colors"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200',
                            active && 'rotate-180'
                          )}
                        />
                      </button>
                      {active && (
                        <div className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-border/10 bg-muted/10">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Help Drawer Screenshot */}
            <div className="space-y-2 pt-6 border-t border-border/20 mt-6">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Quick Action Help Drawer
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Need quick help or want to restart the interactive tour? Click the floating **Help Circle** button in the bottom-right corner of the dashboard to trigger the Auriem Help drawer at any time.
              </p>
              <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10 shadow-sm hover:scale-[1.005] transition-transform duration-300">
                <img 
                  src="/screenshots/help_drawer.png" 
                  alt="Help Drawer Screenshot" 
                  className="w-full h-auto object-cover max-h-[350px]"
                />
              </div>
            </div>
          </article>

        </section>
      </main>
    </div>
  );
}
