import { useState, useEffect } from 'react';
import {
  FlaskConical,
  Microscope,
  Plus,
  BookOpen,
  Activity,
  AlertTriangle,
  User,
  Beaker,
} from 'lucide-react';
import type { CompleteReportData } from '@/types/dashboard';

interface ClinicalSectionProps {
  reportData: CompleteReportData;
}

export function ClinicalSection({ reportData }: ClinicalSectionProps) {
  const patient = reportData.patient;
  const biomarkers = reportData.extraction?.biomarkers || [];
  const normalBiomarkers = biomarkers.filter((b) => b.status === 'NORMAL');
  const flaggedBiomarkers = biomarkers.filter((b) => b.status !== 'NORMAL');
  const activeReport = reportData.reports?.[0];

  const healthScore = biomarkers.length > 0
    ? Math.round((normalBiomarkers.length / biomarkers.length) * 100)
    : 100;

  // React state for animated health score progress ring
  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(healthScore), 100);
    return () => clearTimeout(timer);
  }, [healthScore]);

  // React state for weight and height edits
  const [weight, setWeight] = useState<string>(() => localStorage.getItem(`weight_${patient?.id}`) || '');
  const [height, setHeight] = useState<string>(() => localStorage.getItem(`height_${patient?.id}`) || '');
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [isEditingHeight, setIsEditingHeight] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');

  // React state for timeline step completion
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`timeline_${patient?.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepNumber]: !prev[stepNumber] };
      localStorage.setItem(`timeline_${patient?.id}`, JSON.stringify(next));
      return next;
    });
  };

  // Clean double spaces and trim
  const cleanText = (str: string | undefined | null) => {
    if (!str) return '';
    return str.replace(/\s+/g, ' ').trim();
  };

  // Patient info - format date using standard system locale format
  const dob = patient?.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const gender = patient?.gender
    ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase()
    : 'N/A';

  // Lab info - format date using standard system locale format
  const testDate = activeReport?.createdAt
    ? new Date(activeReport.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const analyzedDate = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  // Derive human-friendly test type (Panels Screened) from categories
  const categoryHumanNameMap: Record<string, string> = {
    'CBC': 'Complete Blood Count',
    'Kidney': 'Kidney Function',
    'Lipid': 'Lipid Profile',
    'Lipid Panel': 'Lipid Profile',
    'Metabolic': 'Metabolic Health',
    'Vitamins': 'Vitamins & Micronutrients',
    'Thyroid': 'Thyroid Panel',
    'Liver': 'Liver Function',
    'Electrolytes': 'Electrolytes Balance',
  };

  const categories = Array.from(new Set(biomarkers.map((b) => b.category)));
  const humanizedCategories = categories.map(cat => categoryHumanNameMap[cat] || cat);
  const panelsScreened = humanizedCategories.length > 0
    ? humanizedCategories.slice(0, 2).join(' & ')
    : 'Routine Blood Panel';

  // Summary & recommendations from report
  const summary = cleanText(activeReport?.summary || '');
  const summaryPoints = (activeReport?.insights?.summaryPoints || []).map(cleanText);
  const recommendations = (activeReport?.insights?.recommendations || []).map(cleanText);
  const flags = activeReport?.insights?.flags || [];

  // Build systemic observations from flagged biomarkers grouped by category
  const flaggedByCategory: Record<string, typeof biomarkers> = {};
  flaggedBiomarkers.forEach((b) => {
    if (!flaggedByCategory[b.category]) flaggedByCategory[b.category] = [];
    flaggedByCategory[b.category].push(b);
  });

  const systemicObservations = Object.entries(flaggedByCategory).map(([cat, markers]) => {
    const statuses = markers.map((m) => `${m.status.toLowerCase()} ${m.displayName}`).join(' and ');
    return {
      title: `${cat} Observations`,
      description: cleanText(`The data shows ${statuses}, which may indicate areas requiring clinical review. These findings should be monitored to assess ${cat.toLowerCase()} function over time.`),
    };
  });

  // Build possible health statuses from summary points - split by colon to prevent truncation
  const healthStatuses = summaryPoints.slice(0, 3).map((point) => {
    const colonIndex = point.indexOf(':');
    if (colonIndex !== -1) {
      const title = point.slice(0, colonIndex).trim();
      const description = point.slice(colonIndex + 1).trim();
      return { title, description };
    }
    return { title: 'Health Observation', description: point };
  });

  // Build pay attention items from recommendations - split by colon to prevent truncation
  const payAttentionItems = recommendations.slice(0, 3).map((rec) => {
    const colonIndex = rec.indexOf(':');
    if (colonIndex !== -1) {
      const title = rec.slice(0, colonIndex).trim();
      const description = rec.slice(colonIndex + 1).trim();
      return { title, description };
    }
    return { title: 'Clinical Recommendation', description: rec };
  });

  // Suggested screenings from flags
  const suggestedScreenings = flags.slice(0, 3).map((f) => {
    const marker = biomarkers.find((b) => b.id === f.biomarkerId);
    return {
      name: marker?.displayName || f.biomarkerId,
      reason: cleanText(f.note || `To further assess ${marker?.displayName || 'biomarker'} levels and clinical status.`),
    };
  });

  // Fallback screenings if none from flags
  const displayScreenings = suggestedScreenings.length > 0
    ? suggestedScreenings
    : flaggedBiomarkers.slice(0, 3).map((b) => ({
        name: b.displayName,
        reason: `To further assess ${b.displayName.toLowerCase()} levels (currently ${b.status.toLowerCase()}).`,
      }));

  // Build active timeline steps checklist from screenings to progress action items logically
  const timelineSteps = [];
  if (displayScreenings.length > 0) {
    const mainMarker = displayScreenings[0].name;
    timelineSteps.push({
      step: 1,
      title: `Consult Primary Care Provider (PCP)`,
      description: `Schedule a follow-up consultation with your PCP to discuss your elevated ${mainMarker} levels.`,
    });
    timelineSteps.push({
      step: 2,
      title: `Retest in 90 Days`,
      description: `Schedule a follow-up lab screening in 3 months to monitor changes in your ${displayScreenings.map(s => s.name).slice(0, 2).join(' & ')} levels.`,
    });
    timelineSteps.push({
      step: 3,
      title: `Implement Lifestyle Changes`,
      description: `Focus on recommendations listed in the 'Pay Attention' checklist, specifically targeting metabolic and cardiovascular vectors.`,
    });
  } else {
    timelineSteps.push({
      step: 1,
      title: `Maintain Annual Wellness Exams`,
      description: `All biomarkers are currently in the optimal range. Retain standard annual wellness screenings.`,
    });
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* ── Row 1: Patient Profile + Scan & Lab Info ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Patient Profile */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-primary-text" />
            <h4 className="text-sm font-semibold text-primary-text uppercase tracking-wider">
              Patient Profile
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className="text-xs font-bold text-muted-foreground">Birth Date</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{dob}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Gender</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{gender}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Weight</p>
              {isEditingWeight ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (weightInput.trim()) {
                    setWeight(weightInput);
                    localStorage.setItem(`weight_${patient?.id}`, weightInput);
                  }
                  setIsEditingWeight(false);
                }} className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    placeholder="e.g. 70"
                    className="w-16 text-xs border border-border px-1.5 py-0.5 rounded bg-background text-foreground focus:outline-none focus:border-primary-text"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground">kg</span>
                  <button type="submit" className="text-xs font-bold text-primary-text hover:underline cursor-pointer bg-transparent border-0 p-0">Save</button>
                  <button type="button" onClick={() => setIsEditingWeight(false)} className="text-xs font-medium text-muted-foreground hover:underline cursor-pointer bg-transparent border-0 p-0">Cancel</button>
                </form>
              ) : weight ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-semibold text-foreground">{weight} kg</p>
                  <button onClick={() => { setWeightInput(weight); setIsEditingWeight(true); }} className="text-xs text-primary-text hover:underline bg-transparent border-0 p-0 cursor-pointer">Edit</button>
                </div>
              ) : (
                <button onClick={() => { setWeightInput(''); setIsEditingWeight(true); }} className="text-xs font-bold text-primary-text hover:underline mt-0.5 bg-transparent border-0 p-0 cursor-pointer flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Add Weight
                </button>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Height</p>
              {isEditingHeight ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (heightInput.trim()) {
                    setHeight(heightInput);
                    localStorage.setItem(`height_${patient?.id}`, heightInput);
                  }
                  setIsEditingHeight(false);
                }} className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    placeholder="e.g. 175"
                    className="w-16 text-xs border border-border px-1.5 py-0.5 rounded bg-background text-foreground focus:outline-none focus:border-primary-text"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground">cm</span>
                  <button type="submit" className="text-xs font-bold text-primary-text hover:underline cursor-pointer bg-transparent border-0 p-0">Save</button>
                  <button type="button" onClick={() => setIsEditingHeight(false)} className="text-xs font-medium text-muted-foreground hover:underline cursor-pointer bg-transparent border-0 p-0">Cancel</button>
                </form>
              ) : height ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-semibold text-foreground">{height} cm</p>
                  <button onClick={() => { setHeightInput(height); setIsEditingHeight(true); }} className="text-xs text-primary-text hover:underline bg-transparent border-0 p-0 cursor-pointer">Edit</button>
                </div>
              ) : (
                <button onClick={() => { setHeightInput(''); setIsEditingHeight(true); }} className="text-xs font-bold text-primary-text hover:underline mt-0.5 bg-transparent border-0 p-0 cursor-pointer flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Add Height
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scan & Laboratory Info */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Microscope className="w-4 h-4 text-primary-text" />
            <h4 className="text-sm font-semibold text-primary-text uppercase tracking-wider">
              Scan &amp; Laboratory Info
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className="text-xs font-bold text-muted-foreground">Test Date</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{testDate}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Date Analyzed</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{analyzedDate}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Panels Screened</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 truncate" title={panelsScreened}>{panelsScreened}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Lab Name</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Auriem Laboratory</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Biomarker Health Balance ───────────────────── */}
      <div className="rounded-2xl p-6 border border-border bg-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Health Score Ring */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                strokeWidth="3"
                stroke="var(--border)"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3"
                strokeDasharray={`${animatedScore}, 100`}
                strokeLinecap="round"
                stroke="var(--primary)"
                fill="none"
                className="transition-[stroke-dasharray] duration-1000 ease-out"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-foreground">{normalBiomarkers.length}/{biomarkers.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-text">Optimal</span>
            </div>
          </div>

          {/* Text + Stats */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground tracking-tight">Biomarker Health Balance</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[70ch]">
              Your lab report shows <strong className="text-foreground font-semibold">{normalBiomarkers.length} out of {biomarkers.length} biomarkers</strong> in the optimal range.
              {flaggedBiomarkers.length > 0 && (
                <> There {flaggedBiomarkers.length === 1 ? 'is' : 'are'} <strong className="text-status-high font-semibold">{flaggedBiomarkers.length} marker{flaggedBiomarkers.length > 1 ? 's' : ''}</strong> requiring targeted attention and clinical discussion.</>
              )}
            </p>
            
            {/* Unified Flat Stats layout - resolves the "Nested Cards" anti-pattern */}
            <div className="grid grid-cols-3 divide-x divide-border bg-muted/20 rounded-xl overflow-hidden mt-4 border border-border/60">
              <div className="py-3 px-4 text-center">
                <p className="text-xl font-bold text-foreground">{biomarkers.length}</p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Markers</p>
              </div>
              <div className="py-3 px-4 text-center bg-status-high/8">
                <p className="text-xl font-bold text-status-high">{flaggedBiomarkers.length}</p>
                <p className="text-xs font-semibold text-status-high uppercase tracking-wider">Abnormal</p>
              </div>
              <div className="py-3 px-4 text-center bg-status-normal/8">
                <p className="text-xl font-bold text-status-normal">{normalBiomarkers.length}</p>
                <p className="text-xs font-semibold text-status-normal uppercase tracking-wider">Optimal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Clinical Interpretation ────────────────────── */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary-glow">
            <FlaskConical className="w-5 h-5 text-primary-text" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">Clinical Interpretation</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Replicated BloodGPT Clinical Interpretation
            </p>
          </div>
        </div>

        {/* Primary Narrative Summary */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider mb-2">
            Primary Narrative Summary
          </h4>
          <p className="text-sm text-foreground leading-relaxed max-w-[70ch]">
            {summary || (
              summaryPoints.length > 0
                ? summaryPoints.join(' ')
                : `The data indicates ${flaggedBiomarkers.length} biomarker${flaggedBiomarkers.length !== 1 ? 's' : ''} outside optimal range across ${Object.keys(flaggedByCategory).length} categor${Object.keys(flaggedByCategory).length !== 1 ? 'ies' : 'y'}. ${flaggedBiomarkers.length === 0 ? 'All markers are within healthy reference intervals.' : 'These findings should be discussed with a healthcare provider to determine the appropriate follow-up and management.'}`
            )}
          </p>
        </div>

        {/* Systemic Observations */}
        {systemicObservations.length > 0 && (
          <div className="border-t border-border/40 pt-5 mt-5">
            <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider mb-3">
              Systemic Observations
            </h4>
            <div className="flex flex-col divide-y divide-border/40">
              {systemicObservations.slice(0, 4).map((obs, i) => (
                <div key={i} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-text mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">{obs.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">{obs.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Row 4: Possible Health Status + Pay Attention ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Possible Health Status */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-status-normal" />
            <h3 className="text-base font-bold text-foreground tracking-tight">Possible Health Status</h3>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {healthStatuses.length > 0 ? (
              healthStatuses.map((hs, i) => (
                <div key={i} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-primary-text" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">{hs.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">{hs.description}</p>
                  </div>
                </div>
              ))
            ) : (
              flaggedBiomarkers.length > 0 ? (
                Object.entries(flaggedByCategory).slice(0, 3).map(([cat, markers], i) => (
                  <div key={i} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-primary-text" />
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-0.5">{cat} Function</p>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">
                        {markers.map(m => `${m.status.toLowerCase()} ${m.displayName}`).join(' and ')} suggest{markers.length === 1 ? 's' : ''} potential areas for clinical monitoring.
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2">All biomarkers are within optimal range.</p>
              )
            )}
          </div>
        </div>

        {/* Pay Attention */}
        <div
          className="bg-card rounded-2xl p-6 border border-status-high/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-status-high" />
            <h3 className="text-base font-bold text-foreground tracking-tight">Pay Attention</h3>
          </div>
          <p className="text-xs font-bold text-muted-foreground mb-5 uppercase tracking-wider">Critical Review Checklist</p>
          <div className="flex flex-col divide-y divide-border/40">
            {payAttentionItems.length > 0 ? (
              payAttentionItems.map((item, i) => (
                <div key={i} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-status-high" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">{item.description}</p>
                  </div>
                </div>
              ))
            ) : flaggedBiomarkers.length > 0 ? (
              flaggedBiomarkers.slice(0, 3).map((b, i) => (
                <div key={i} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-status-high" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">Review {b.displayName}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">
                      {b.displayName} is {b.status.toLowerCase()} at {b.value} {b.unit} (ref: {b.referenceRange}).
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No critical items require attention.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: Clinical Panel Synthesis + Suggested Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Clinical Panel Synthesis */}
        <div className="md:col-span-7 bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Beaker className="w-4 h-4 text-primary-text" />
            <h3 className="text-base font-bold text-foreground tracking-tight">Clinical Panel Synthesis</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">
            {summary || (
              summaryPoints.length > 0
                ? summaryPoints.join(' ')
                : `The ${categories.join(' and ')} profile indicate ${flaggedBiomarkers.length === 0 ? 'all markers within normal range' : `${flaggedBiomarkers.length} area${flaggedBiomarkers.length > 1 ? 's' : ''} of observation`}. ${flaggedBiomarkers.length > 0 ? 'These findings should be discussed with a healthcare provider to determine the appropriate follow-up and management.' : 'No significant clinical concerns were identified.'}`
            )}
          </p>
        </div>

        {/* Suggested Next Steps / Timeline Checklist */}
        <div className="md:col-span-5 bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-4 h-4 text-primary-text" />
            <h3 className="text-base font-bold text-foreground tracking-tight">Suggested Next Steps</h3>
          </div>
          <div className="relative pl-6 border-l border-border/30 flex flex-col gap-5">
            {timelineSteps.map((step, i) => {
              const isCompleted = !!completedSteps[step.step];
              return (
                <div key={i} className={`relative transition-all duration-300 ${isCompleted ? 'opacity-60' : ''}`}>
                  {/* Timeline dot / Checkbox */}
                  <button
                    onClick={() => toggleStep(step.step)}
                    className={`absolute -left-[31px] top-0.5 w-5 h-5 rounded-full bg-card border-2 transition-all flex items-center justify-center cursor-pointer ${
                      isCompleted
                        ? 'border-status-normal bg-status-normal text-white'
                        : 'border-primary hover:border-primary-text text-primary-text'
                    }`}
                    title={isCompleted ? "Mark step as incomplete" : "Mark step as complete"}
                  >
                    {isCompleted ? (
                      <span className="text-[10px] font-black leading-none">✓</span>
                    ) : (
                      <span className="text-[10px] font-black leading-none">{step.step}</span>
                    )}
                  </button>
                  <div className="pl-1">
                    <p className={`text-sm font-semibold transition-all mb-0.5 ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-normal">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 6: Related Research (PubMed Search Helper) ── */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary-text" />
          <h3 className="text-sm font-semibold text-foreground">
            Clinical Reference &amp; Research (PubMed)
          </h3>
        </div>
        {flaggedBiomarkers.length > 0 ? (
          <div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed max-w-[70ch]">
              Select a flagged biomarker below to search PubMed for recent clinical literature, reference ranges, and therapeutic guidelines.
            </p>
            <div className="flex flex-wrap gap-2">
              {flaggedBiomarkers.map((b) => (
                <a
                  key={b.id}
                  href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(b.displayName + ' clinical guidelines')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:border-primary-text bg-muted/20 hover:bg-background text-muted-foreground hover:text-primary-text transition-all cursor-pointer"
                >
                  <span>Search PubMed: {b.displayName}</span>
                  <span className="text-[10px]">↗</span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            All biomarkers are currently in the optimal range. No active literature queries recommended.
          </p>
        )}
      </div>
    </div>
  );
}
