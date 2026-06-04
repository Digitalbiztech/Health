import type { Biomarker } from '@/types/dashboard';
import { STATUS_COLORS } from './constants';
import { getEffectivePct } from './utils';

interface DetailDialogProps {
  biomarker: Biomarker;
  onClose: () => void;
}

export function BiomarkerDetailDialog({ biomarker, onClose }: DetailDialogProps) {
  const colors = STATUS_COLORS[biomarker.status];
  const effectivePct = getEffectivePct(biomarker);

  // Fallback description generator based on biomarkers
  const getDescriptions = () => {
    switch (biomarker.canonicalName) {
      case 'GLUCOSE':
        return {
          desc: 'Glucose is the primary sugar found in blood. It is the body\'s main source of energy, derived from metabolic processing of consumed carbohydrates.',
          analysis: 'Slight elevations indicate a metabolic status of impaired fasting glucose. It warrants close monitoring of daily carbohydrate glycemic indices and active evaluation of HbA1c to assess long-term regulation.',
        };
      case 'CHOLESTEROL_TOTAL':
        return {
          desc: 'Total cholesterol is a comprehensive measurement of all cholesterol types circulating in blood plasma, serving as a core index for cardiovascular evaluation.',
          analysis: 'Moderate elevation increases blood vessel lipid deposition. Recommend proactive dietary modifications (rich in fiber/omega-3 fatty acids) and active regular exercise panels.',
        };
      default:
        return {
          desc: 'A critical biological compound monitored as part of comprehensive standard cellular and systemic lipid laboratory panels.',
          analysis: 'Systemic values represent physiological stability. Keep regular panels monitored to establish stable health baseline timelines.',
        };
    }
  };

  const texts = getDescriptions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Box */}
      <div className="relative glass-card w-full max-w-md rounded-2xl p-6 border-border/40 shadow-xl overflow-hidden bg-card/95">
        <h3 className="text-lg font-bold text-foreground mb-1">{biomarker.displayName}</h3>
        <p className="text-xs text-muted-foreground uppercase mb-4 tracking-wider">{biomarker.category}</p>

        {/* Large Value */}
        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-3xl font-extrabold" style={{ color: colors.text }}>
            {biomarker.value}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">{biomarker.unit}</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: colors.bg, color: colors.text }}>
            {biomarker.status}
          </span>
        </div>

        {/* Info Blocks */}
        <div className="flex flex-col gap-4 text-xs leading-relaxed mb-6">
          <div>
            <h4 className="font-semibold text-foreground uppercase tracking-wider text-[10px] mb-1">What is {biomarker.displayName}?</h4>
            <p className="text-muted-foreground">{texts.desc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground uppercase tracking-wider text-[10px] mb-1">Clinical Interpretation</h4>
            <p className="text-muted-foreground">{texts.analysis}</p>
          </div>
        </div>

        {/* 3-Zone bar expanded */}
        <div className="mb-6">
          <div className="relative h-3 rounded-full overflow-hidden bg-border/40 flex">
            <div className="h-full w-[20%]" style={{ background: 'rgba(201, 125, 10, 0.25)' }} />
            <div className="h-full w-[60%] border-x border-border/40" style={{ background: 'rgba(26, 153, 102, 0.25)' }} />
            <div className="h-full w-[20%]" style={{ background: 'rgba(240, 78, 20, 0.25)' }} />
            
            <div
              className="absolute w-4.5 h-4.5 -top-0.5 rounded-full border border-white shadow transition-all duration-500"
              style={{
                left: `calc(${effectivePct}% - 9px)`,
                background: colors.text,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] mt-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>
            <span>Low ({biomarker.referenceMin ?? '0'})</span>
            <span style={{ color: 'var(--foreground)' }}>Optimal Range: {biomarker.referenceRange}</span>
            <span>High ({biomarker.referenceMax ?? 'N/A'})</span>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-md text-center hover:opacity-90 transition-opacity cursor-pointer"
          style={{ background: 'var(--primary-text)' }}
        >
          Close Detail
        </button>
      </div>
    </div>
  );
}
