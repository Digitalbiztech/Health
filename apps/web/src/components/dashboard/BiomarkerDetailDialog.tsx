import { X, TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { Biomarker } from '@/types/dashboard';
import { STATUS_COLORS, CATEGORY_ICONS } from './constants';
import { getEffectivePct } from './utils';

interface DetailDialogProps {
  biomarker: Biomarker;
  onClose: () => void;
}

// Rich clinical descriptions keyed by canonical name
const BIOMARKER_DESCRIPTIONS: Record<string, { what: string; why: string; tips: string[] }> = {
  GLUCOSE: {
    what: 'Glucose is the primary sugar circulating in blood plasma. It is your body\'s main fuel source, derived from dietary carbohydrates and regulated by insulin from the pancreas.',
    why: 'Elevated fasting glucose indicates impaired glucose tolerance or early-stage metabolic dysfunction. Sustained elevations risk progression to Type 2 Diabetes, nerve damage, and cardiovascular complications.',
    tips: ['Limit refined carbohydrates and added sugars', 'Aim for 30 min of moderate exercise daily', 'Monitor HbA1c every 3–6 months if borderline'],
  },
  CHOLESTEROL_TOTAL: {
    what: 'Total cholesterol is a measurement of all cholesterol types in blood — including LDL ("bad"), HDL ("good"), and VLDL. It is a primary cardiovascular risk index.',
    why: 'Elevated total cholesterol accelerates plaque buildup in arterial walls, increasing risk of heart attack and stroke over time.',
    tips: ['Increase dietary fiber (oats, legumes, vegetables)', 'Replace saturated fats with unsaturated fats', 'Recheck after 3 months of dietary changes'],
  },
  LDL: {
    what: 'Low-Density Lipoprotein (LDL) is often called "bad" cholesterol because high levels lead to fatty deposits in blood vessels.',
    why: 'Elevated LDL is a major modifiable risk factor for atherosclerosis, coronary artery disease, and stroke.',
    tips: ['Adopt a Mediterranean or DASH diet', 'Reduce trans-fat and saturated fat intake', 'Discuss statin therapy if consistently elevated'],
  },
  HDL: {
    what: 'High-Density Lipoprotein (HDL) is "good" cholesterol that transports excess cholesterol from vessels back to the liver for processing.',
    why: 'Low HDL reduces cardiovascular protection. A level below 40 mg/dL (men) or 50 mg/dL (women) increases heart disease risk independently.',
    tips: ['Increase aerobic exercise (aim 150+ min/week)', 'Stop smoking if applicable', 'Consume omega-3 fatty acids (salmon, walnuts)'],
  },
  TRIGLYCERIDES: {
    what: 'Triglycerides are fats stored in blood and fat cells, derived from dietary fat and excess calories from carbohydrates or alcohol.',
    why: 'Elevated triglycerides often accompany low HDL and contribute to cardiovascular disease, and may also indicate fatty liver or insulin resistance.',
    tips: ['Reduce refined sugar and alcohol intake', 'Increase omega-3 intake', 'Follow a low-glycemic diet'],
  },
  ALT: {
    what: 'Alanine Aminotransferase (ALT) is an enzyme produced primarily in the liver. It is a sensitive indicator of hepatocellular damage.',
    why: 'Elevated ALT suggests liver stress, which may indicate fatty liver disease, viral hepatitis, or medication-induced hepatotoxicity.',
    tips: ['Avoid alcohol and hepatotoxic medications', 'Maintain a healthy body weight', 'Recheck in 4–8 weeks with liver ultrasound if persistently elevated'],
  },
  AST: {
    what: 'Aspartate Aminotransferase (AST) is a liver and heart enzyme released into the bloodstream when either organ is injured or inflamed.',
    why: 'Elevated AST may suggest liver damage, muscle injury, or cardiac stress. The AST:ALT ratio helps differentiate causes.',
    tips: ['Avoid muscle-damaging activity before testing', 'Limit alcohol', 'Investigate with full liver panel if combined with ALT elevation'],
  },
  CREATININE: {
    what: 'Creatinine is a metabolic waste product from muscle metabolism, filtered out by healthy kidneys at a steady rate.',
    why: 'Elevated creatinine indicates that kidneys are not filtering waste efficiently, suggesting reduced renal function or acute kidney injury.',
    tips: ['Stay well-hydrated', 'Avoid NSAIDs (ibuprofen) if kidneys are stressed', 'Follow up with eGFR and urine albumin:creatinine ratio'],
  },
  EGFR: {
    what: 'Estimated Glomerular Filtration Rate (eGFR) is a calculated estimate of how well your kidneys filter waste from the blood per minute.',
    why: 'Low eGFR values indicate progressive kidney disease. Values below 60 mL/min/1.73m² suggest moderate kidney impairment.',
    tips: ['Avoid dehydration and nephrotoxic drugs', 'Control blood pressure and blood glucose', 'Monitor quarterly with a nephrologist if below 45'],
  },
  TESTOSTERONE: {
    what: 'Testosterone is the primary androgen hormone, essential for muscle mass, bone density, libido, and mood regulation in both sexes.',
    why: 'Elevated testosterone in females may signal PCOS, adrenal dysfunction, or anabolic steroid use. Low levels in males impact energy, fertility, and bone health.',
    tips: ['Evaluate with a full hormone panel including LH, FSH', 'Assess for PCOS symptoms if female', 'Consider endocrinology referral if significantly abnormal'],
  },
};

const STATUS_META: Record<string, { icon: React.ReactNode; label: string; description: string; color: string }> = {
  NORMAL: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Within Normal Range',
    description: 'This biomarker value falls within the established optimal clinical reference interval.',
    color: '#1A9966',
  },
  HIGH: {
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Above Reference Range',
    description: 'This value exceeds the upper reference limit. Clinical evaluation is recommended.',
    color: '#F04E14',
  },
  LOW: {
    icon: <TrendingDown className="w-4 h-4" />,
    label: 'Below Reference Range',
    description: 'This value is below the lower reference limit. Clinical evaluation is recommended.',
    color: '#C97D0A',
  },
  CRITICAL: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Critical Value',
    description: 'This value is critically outside the reference range and may require urgent attention.',
    color: '#E53E3E',
  },
};

export function BiomarkerDetailDialog({ biomarker, onClose }: DetailDialogProps) {
  const colors = STATUS_COLORS[biomarker.status];
  const effectivePct = getEffectivePct(biomarker);
  const Icon = CATEGORY_ICONS[biomarker.category] || Activity;
  const statusMeta = STATUS_META[biomarker.status] || STATUS_META.NORMAL;

  // Get rich description or fallback
  const canonical = biomarker.canonicalName?.toUpperCase() || '';
  const matchKey = Object.keys(BIOMARKER_DESCRIPTIONS).find(k => canonical.includes(k));
  const richDesc = matchKey ? BIOMARKER_DESCRIPTIONS[matchKey] : null;

  const description = richDesc?.what || biomarker.description ||
    'A key biological compound monitored as part of a comprehensive laboratory diagnostic panel to evaluate systemic health and cellular function.';
  const analysis = richDesc?.why || biomarker.detailedAnalysis ||
    'This biomarker provides important information about your physiological status. Clinical significance depends on context and should be interpreted alongside other diagnostic results.';
  const tips = richDesc?.tips || ['Schedule a follow-up discussion with your physician', 'Continue routine monitoring per your care plan', 'Maintain healthy lifestyle practices'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
      >
        {/* Header gradient bar */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${statusMeta.color}, var(--primary))` }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: colors.bg }}
            >
              <Icon className="w-5 h-5" style={{ color: colors.text }} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-foreground leading-tight">{biomarker.displayName}</h3>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">{biomarker.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-border/30 transition-colors cursor-pointer border-0 bg-transparent flex-shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 flex flex-col gap-5 custom-scrollbar">
          {/* Value + Status Badge */}
          <div
            className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: colors.bg, border: `1px solid ${statusMeta.color}30` }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Your Value</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold" style={{ color: colors.text }}>{biomarker.value}</span>
                <span className="text-sm font-semibold text-muted-foreground">{biomarker.unit}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Reference: {biomarker.referenceRange}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `${statusMeta.color}20`, color: statusMeta.color }}
              >
                <span className="flex-shrink-0">{statusMeta.icon}</span>
                <span>{biomarker.status}</span>
              </div>
              <p className="text-[10px] text-right text-muted-foreground max-w-[140px] leading-tight">
                {statusMeta.label}
              </p>
            </div>
          </div>

          {/* Range Bar */}
          <div>
            <div className="flex justify-between text-[9px] mb-2 font-semibold text-muted-foreground">
              <span>Low {biomarker.referenceMin != null ? `(${biomarker.referenceMin})` : ''}</span>
              <span className="text-foreground font-bold">Optimal Range: {biomarker.referenceRange}</span>
              <span>High {biomarker.referenceMax != null ? `(${biomarker.referenceMax})` : ''}</span>
            </div>
            <div className="relative h-3.5 rounded-full overflow-visible bg-border/20 flex">
              {/* Zone segments */}
              <div className="h-full rounded-l-full w-[20%]" style={{ background: 'rgba(201,125,10,0.35)' }} />
              <div className="h-full w-[60%] border-x border-border/30" style={{ background: 'rgba(26,153,102,0.35)' }} />
              <div className="h-full rounded-r-full w-[20%]" style={{ background: 'rgba(240,78,20,0.35)' }} />
              {/* Needle */}
              <div
                className="absolute w-5 h-5 -top-[3px] rounded-full border-2 border-white shadow-lg transition-all duration-700"
                style={{ left: `calc(${effectivePct}% - 10px)`, background: statusMeta.color, boxShadow: `0 0 12px ${statusMeta.color}80` }}
              />
            </div>
            {/* Status description */}
            <div
              className="flex items-start gap-2 mt-3 p-2.5 rounded-lg"
              style={{ background: `${statusMeta.color}10`, border: `1px solid ${statusMeta.color}25` }}
            >
              <span style={{ color: statusMeta.color, flexShrink: 0, marginTop: '1px' }}>
                <Info className="w-3.5 h-3.5" />
              </span>
              <p className="text-[10px] leading-normal" style={{ color: statusMeta.color }}>{statusMeta.description}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/30" />

          {/* What is this? */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Minus className="w-3 h-3" />
              What is {biomarker.displayName}?
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>

          {/* Clinical Significance */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Clinical Significance
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{analysis}</p>
          </div>

          {/* Tips / Recommendations */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--primary-glow)', border: '1px solid var(--border)' }}
          >
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--primary-text)' }}>
              <CheckCircle2 className="w-3 h-3" />
              Recommended Actions
            </h4>
            <ul className="flex flex-col gap-2">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-extrabold mt-0.5"
                    style={{ background: 'var(--primary-text)', color: 'white' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-normal">{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Confidence score if available */}
          {biomarker.confidence != null && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-muted-foreground">Extraction Confidence</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-border/30 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(biomarker.confidence * 100)}%`, background: 'var(--primary-text)' }}
                  />
                </div>
                <span className="text-[10px] font-bold" style={{ color: 'var(--primary-text)' }}>
                  {Math.round(biomarker.confidence * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-border/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground border border-border/50 hover:bg-border/20 transition-all cursor-pointer bg-transparent"
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer hover:opacity-90 shadow-md"
            style={{ background: 'linear-gradient(135deg, var(--primary-text), var(--primary))' }}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
