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

  // Resilient text cleaner helper to catch and strip any raw "undefined" strings from data
  const cleanText = (str: string) => {
    if (!str) return '';
    return str.replace(/\(undefined\s*(?:mg\/dL)?\)/gi, '').replace(/undefined/gi, 'elevated');
  };

  // Patient info
  const dob = patient?.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString('en-GB')
    : 'N/A';
  const gender = patient?.gender
    ? patient.gender.charAt(0).toUpperCase()
    : 'N/A';

  // Lab info
  const testDate = activeReport?.createdAt
    ? new Date(activeReport.createdAt).toLocaleDateString('en-GB')
    : 'N/A';
  const analyzedDate = new Date().toLocaleDateString('en-GB');

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
      description: `All biomarkers are currently in the optimal zone. Retain standard annual wellness screenings.`,
    });
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* ── Row 1: Patient Profile + Scan & Lab Info ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Patient Profile */}
        <div className="glass-card rounded-2xl p-5 border border-border/40 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4" style={{ color: 'var(--primary-text)' }} />
            <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--primary-text)' }}>
              Patient Profile
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Birth Date</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{dob}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Gender</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{gender}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Weight</p>
              <button className="text-xs font-bold text-[var(--primary-text)] hover:underline mt-0.5 bg-transparent border-0 p-0 cursor-pointer flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Add Weight
              </button>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Height</p>
              <button className="text-xs font-bold text-[var(--primary-text)] hover:underline mt-0.5 bg-transparent border-0 p-0 cursor-pointer flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Add Height
              </button>
            </div>
          </div>
        </div>

        {/* Scan & Laboratory Info */}
        <div className="glass-card rounded-2xl p-5 border border-border/40 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Microscope className="w-4 h-4" style={{ color: 'var(--primary-text)' }} />
            <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--primary-text)' }}>
              Scan &amp; Laboratory Info
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Test Date</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{testDate}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Date Analyzed</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{analyzedDate}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Panels Screened</p>
              <p className="text-sm font-bold text-foreground mt-0.5 truncate" title={panelsScreened}>{panelsScreened}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Lab Name</p>
              <p className="text-sm font-bold text-foreground mt-0.5">Unknown</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Biomarker Health Balance ───────────────────── */}
      <div
        className="rounded-2xl p-6 shadow-sm relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0d4a3a, #0a6b4f, #0d4a3a)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Health Score Ring */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                strokeWidth="3"
                stroke="rgba(255,255,255,0.12)"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3"
                strokeDasharray={`${healthScore}, 100`}
                strokeLinecap="round"
                stroke="#f5a623"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-white">{normalBiomarkers.length}/{biomarkers.length}</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-300">Optimal</span>
            </div>
          </div>

          {/* Text + Stats */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-extrabold text-white tracking-tight">Biomarker Health Balance</h3>
            <p className="text-sm text-emerald-100/95 mt-1 leading-relaxed">
              Your lab report shows <strong className="text-white">{normalBiomarkers.length} out of {biomarkers.length} biomarkers</strong> in the optimal range.
              {flaggedBiomarkers.length > 0 && (
                <> There {flaggedBiomarkers.length === 1 ? 'is' : 'are'} {flaggedBiomarkers.length} marker{flaggedBiomarkers.length > 1 ? 's' : ''} requiring targeted attention and clinical discussion.</>
              )}
            </p>
            <div className="flex gap-3 mt-4">
              <div className="flex-1 rounded-xl py-3 px-4 text-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xl font-black text-white">{biomarkers.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-200/70">Biomarkers</p>
              </div>
              <div className="flex-1 rounded-xl py-3 px-4 text-center" style={{ background: 'rgba(240, 78, 20, 0.15)', border: '1px solid rgba(240, 78, 20, 0.2)' }}>
                <p className="text-xl font-black text-orange-400">{flaggedBiomarkers.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-orange-300/70">Abnormal</p>
              </div>
              <div className="flex-1 rounded-xl py-3 px-4 text-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xl font-black text-white">{normalBiomarkers.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-200/70">Optimal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Clinical Interpretation ────────────────────── */}
      <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-glow)' }}>
            <FlaskConical className="w-4.5 h-4.5" style={{ color: 'var(--primary-text)' }} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground tracking-tight">Clinical Interpretation</h3>
            <p className="text-[10px] text-muted-foreground font-medium">
              Replicated BloodGPT Clinical Interpretation
            </p>
          </div>
        </div>

        {/* Primary Narrative Summary */}
        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: 'color-mix(in srgb, var(--card) 60%, var(--background))', border: '1px solid var(--border)' }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--primary-text)' }}>
            Primary Narrative Summary
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {summary || (
              summaryPoints.length > 0
                ? summaryPoints.join(' ')
                : `The data indicates ${flaggedBiomarkers.length} biomarker${flaggedBiomarkers.length !== 1 ? 's' : ''} outside optimal range across ${Object.keys(flaggedByCategory).length} categor${Object.keys(flaggedByCategory).length !== 1 ? 'ies' : 'y'}. ${flaggedBiomarkers.length === 0 ? 'All markers are within healthy reference intervals.' : 'These findings should be discussed with a healthcare provider to determine the appropriate follow-up and management.'}`
            )}
          </p>
        </div>

        {/* Systemic Observations */}
        {systemicObservations.length > 0 && (
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--primary-text)' }}>
              Systemic Observations
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemicObservations.slice(0, 4).map((obs, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 flex gap-3"
                  style={{ background: 'color-mix(in srgb, var(--card) 60%, var(--background))', border: '1px solid var(--border)' }}
                >
                  <div className="w-1 rounded-full flex-shrink-0" style={{ background: 'var(--border)' }} />
                  <div>
                    <p className="text-sm font-bold text-foreground mb-1">{obs.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{obs.description}</p>
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
        <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4.5 h-4.5 text-emerald-500" />
            <h3 className="text-base font-extrabold text-foreground tracking-tight">Possible Health Status</h3>
          </div>
          <div className="flex flex-col gap-5">
            {healthStatuses.length > 0 ? (
              healthStatuses.map((hs, i) => (
                <div key={i}>
                  <p className="text-sm font-bold text-foreground mb-1">{hs.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{hs.description}</p>
                </div>
              ))
            ) : (
              flaggedBiomarkers.length > 0 ? (
                Object.entries(flaggedByCategory).slice(0, 3).map(([cat, markers], i) => (
                  <div key={i}>
                    <p className="text-sm font-bold text-foreground mb-1">{cat} Function</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {markers.map(m => `${m.status.toLowerCase()} ${m.displayName}`).join(' and ')} suggest{markers.length === 1 ? 's' : ''} potential areas for clinical monitoring. This should be evaluated over time.
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">All biomarkers are within optimal range. No health concerns identified.</p>
              )
            )}
          </div>
        </div>

        {/* Pay Attention */}
        <div
          className="glass-card rounded-2xl p-6 shadow-sm"
          style={{ border: '1px solid rgba(240, 78, 20, 0.15)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4.5 h-4.5 text-orange-500" />
            <h3 className="text-base font-extrabold text-foreground tracking-tight">Pay Attention</h3>
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-5">Critical Review Checklist</p>
          <div className="flex flex-col gap-4">
            {payAttentionItems.length > 0 ? (
              payAttentionItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 flex gap-3"
                  style={{ background: 'rgba(240, 78, 20, 0.04)', border: '1px solid rgba(240, 78, 20, 0.12)' }}
                >
                  <div className="w-1 rounded-full flex-shrink-0 bg-red-500/60" />
                  <div>
                    <p className="text-sm font-bold text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))
            ) : flaggedBiomarkers.length > 0 ? (
              flaggedBiomarkers.slice(0, 3).map((b, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 flex gap-3"
                  style={{ background: 'rgba(240, 78, 20, 0.04)', border: '1px solid rgba(240, 78, 20, 0.12)' }}
                >
                  <div className="w-1 rounded-full flex-shrink-0 bg-red-500/60" />
                  <div>
                    <p className="text-sm font-bold text-foreground mb-1">Review {b.displayName}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {b.displayName} is {b.status.toLowerCase()} at {b.value} {b.unit} (ref: {b.referenceRange}). Consider follow-up testing.
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No critical items require attention. All biomarkers are within normal range.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: Clinical Panel Synthesis + Suggested Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Clinical Panel Synthesis */}
        <div className="md:col-span-7 glass-card rounded-2xl p-6 border border-border/40 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Beaker className="w-4 h-4" style={{ color: 'var(--primary-text)' }} />
            <h3 className="text-base font-extrabold text-foreground tracking-tight">Clinical Panel Synthesis</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary || (
              summaryPoints.length > 0
                ? summaryPoints.join(' ')
                : `The ${categories.join(' and ')} profile indicate ${flaggedBiomarkers.length === 0 ? 'all markers within normal range' : `${flaggedBiomarkers.length} area${flaggedBiomarkers.length > 1 ? 's' : ''} of observation`}. ${flaggedBiomarkers.length > 0 ? 'These findings should be discussed with a healthcare provider to determine the appropriate follow-up and management.' : 'No significant clinical concerns were identified.'}`
            )}
          </p>
        </div>

        {/* Suggested Next Steps / Timeline Checklist */}
        <div className="md:col-span-5 glass-card rounded-2xl p-6 border border-border/40 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-4 h-4" style={{ color: 'var(--primary-text)' }} />
            <h3 className="text-base font-extrabold text-foreground tracking-tight">Suggested Next Steps</h3>
          </div>
          <div className="relative pl-6 border-l border-border/30 flex flex-col gap-5">
            {timelineSteps.map((step, i) => (
              <div key={i} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-card border-2 border-[var(--primary)] flex items-center justify-center shadow-sm">
                  <span className="text-[9px] font-black text-[var(--primary-text)]">{step.step}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground mb-0.5">{step.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-normal">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 6: Related Research (PubMed) ─────────────────── */}
      <div className="glass-card rounded-2xl p-6 border border-border/40 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4" style={{ color: 'var(--primary-text)' }} />
          <h3 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--primary-text)' }}>
            Related Research (PubMed)
          </h3>
        </div>
        <p className="text-sm text-muted-foreground italic">
          No related medical literature found for these biomarkers.
        </p>
      </div>
    </div>
  );
}
