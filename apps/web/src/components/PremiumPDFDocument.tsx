import { Document, Page, Text, View, StyleSheet, Font, Image, Svg, Circle } from '@react-pdf/renderer';
import type { LabReport, LabPanel } from '@/types/lab';

// ─── Font Registrations ────────────────────────────────────────────────────────
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Lora',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@latest/latin-400-normal.woff', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@latest/latin-500-normal.woff', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@latest/latin-700-normal.woff', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-italic.woff', fontWeight: 400, fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.woff', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff', fontWeight: 700 },
  ],
});

// Alias for Circle to support SVG dash properties
const CircleAny = Circle as any;

// ─── Design Tokens & Palettes ──────────────────────────────────────────────────
const TEAL_DARK = '#065f46';
const TEAL_PRIMARY = '#0DA58E';
const TEAL_BRIGHT = '#10b981';
const TEAL_TINT = '#ecfdf5';
const TEAL_BORDER = '#d1fae5';
const BG_PAGE = '#F9FBFA';

const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';

// Status styling with colorblind-accessible icons and clinical color mapping
export const STATUS_META: Record<string, { label: string; icon: string; fg: string; bg: string; border: string; bar: string }> = {
  normal: { label: 'NORMAL', icon: '✓', fg: '#0d9488', bg: '#ecfdf5', border: '#a7f3d0', bar: '#0d9488' },
  high: { label: 'ELEVATED', icon: '▲', fg: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', bar: '#b91c1c' },
  low: { label: 'REDUCED', icon: '▼', fg: '#b45309', bg: '#fffbeb', border: '#fcd34d', bar: '#b45309' },
  critical: { label: 'CRITICAL', icon: '!', fg: '#7f1d1d', bg: '#fef2f2', border: '#f87171', bar: '#7f1d1d' },
  unknown: { label: 'UNKNOWN', icon: '•', fg: '#64748b', bg: '#f8fafc', border: '#cbd5e1', bar: '#94a3b8' },
};

// Muted clinical range bar zone tokens (calm pastel tones matching status pills)
const BAR_ZONE = {
  low: '#FDE68A',       // Soft muted warm amber (matches reduced/low pill)
  optimal: '#A7F3D0',   // Soft muted sage/mint (matches normal pill)
  high: '#FECACA',      // Soft muted coral/rose (matches elevated/high pill)
  trackBg: '#F1F5F9',   // Calm neutral base
};

const CATEGORY_COLORS: Record<string, string> = {
  'Complete Blood Count (CBC)': '#0DA58E',
  'Comprehensive Metabolic Panel (CMP)': '#06b6d4',
  'Lipid Panel': '#f59e0b',
  'Thyroid Panel': '#ec4899',
  'Hormones': '#8b5cf6',
  'Vitamins & Minerals': '#34d399',
};
const DEFAULT_COLORS = ['#0DA58E', '#06b6d4', '#3b82f6', '#34d399', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981'];

// ─── Reference Range Resolver ──────────────────────────────────────────────────
export interface ResolvedBiomarkerRange {
  type: 'two_sided' | 'greater_than' | 'less_than';
  min: number | null;
  max: number | null;
  displayMin: number;
  displayMax: number;
  optimalMin: number;
  optimalMax: number;
  optimalText: string;
  pct: number;
}

export function resolveBiomarkerRange(
  _name: string,
  minVal: any,
  maxVal: any,
  value: number,
  _gender: string
): ResolvedBiomarkerRange {
  const numMin = (minVal !== null && minVal !== undefined && minVal !== '') ? Number(minVal) : NaN;
  const numMax = (maxVal !== null && maxVal !== undefined && maxVal !== '') ? Number(maxVal) : NaN;
  const hasMin = !isNaN(numMin);
  const hasMax = !isNaN(numMax);

  const val = typeof value === 'number' && !isNaN(value) ? value : 0;

  // Case 1: Greater-than only (e.g. HDL > 40, eGFR > 60, Vitamin D > 30)
  // Condition: min is defined (> 0) and max is missing or sentinel (>= 500 or <= 0)
  if (hasMin && numMin > 0 && (!hasMax || numMax >= 500 || numMax <= 0)) {
    const optimalMin = numMin;
    const span = Math.max(optimalMin, 20);
    const displayMax = Math.max(optimalMin + span, val * 1.25);

    let pct = 35;
    if (val < optimalMin) {
      pct = Math.max(5, (val / optimalMin) * 35);
    } else {
      const excess = val - optimalMin;
      const room = Math.max(displayMax - optimalMin, 1);
      pct = 35 + Math.min(58, (excess / room) * 58);
    }

    return {
      type: 'greater_than',
      min: optimalMin,
      max: null,
      displayMin: 0,
      displayMax: parseFloat(displayMax.toFixed(1)),
      optimalMin,
      optimalMax: Infinity,
      optimalText: `≥ ${optimalMin}`,
      pct: Math.min(95, Math.max(5, pct)),
    };
  }

  // Case 2: Less-than only (e.g. Triglycerides < 150, LDL < 100, Ratio < 5.0, HbA1c < 5.7)
  // Condition: max is defined (< 500) and min is missing or <= 0
  if (hasMax && numMax > 0 && (!hasMin || numMin <= 0)) {
    const optimalMax = numMax;
    const buffer = optimalMax * 0.4;
    const displayMax = Math.max(optimalMax + buffer, val * 1.15);

    let pct = 50;
    if (val <= optimalMax) {
      pct = Math.max(5, (val / optimalMax) * 65);
    } else {
      const excess = val - optimalMax;
      const room = Math.max(displayMax - optimalMax, 0.1);
      pct = 65 + Math.min(30, (excess / room) * 30);
    }

    return {
      type: 'less_than',
      min: null,
      max: optimalMax,
      displayMin: 0,
      displayMax: parseFloat(displayMax.toFixed(1)),
      optimalMin: 0,
      optimalMax,
      optimalText: `< ${optimalMax}`,
      pct: Math.min(95, Math.max(5, pct)),
    };
  }

  // Case 3: Two-sided bounded (e.g. WBC 4.5 - 11.0, Potassium 3.5 - 5.0, Glucose 70 - 99)
  const min = hasMin ? Math.max(0, numMin) : 0;
  const max = hasMax ? numMax : (val > 0 ? val * 1.5 : 100);
  const span = Math.max(max - min, 0.1);
  const buffer = Math.min(min, span * 0.35, 10);
  const displayMin = Math.max(0, parseFloat((min - buffer).toFixed(2))); // Strictly non-negative!
  const displayMax = parseFloat((max + buffer).toFixed(2));

  let pct = 50;
  if (val < min) {
    const under = Math.max(min - displayMin, 0.1);
    const dist = Math.max(0, val - displayMin);
    pct = Math.max(5, (dist / under) * 30);
  } else if (val <= max) {
    const dist = val - min;
    pct = 30 + (span > 0 ? (dist / span) * 40 : 20);
  } else {
    const over = Math.max(displayMax - max, 0.1);
    const dist = Math.min(over, val - max);
    pct = 70 + Math.min(25, (dist / over) * 25);
  }

  return {
    type: 'two_sided',
    min,
    max,
    displayMin,
    displayMax,
    optimalMin: min,
    optimalMax: max,
    optimalText: `${min} – ${max}`,
    pct: Math.min(95, Math.max(5, pct)),
  };
}

function formatReportDate(dateString?: string): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function panelScore(panel: LabPanel): number {
  const n = panel.biomarkers.filter(b => b.status === 'normal').length;
  return panel.biomarkers.length ? Math.round((n / panel.biomarkers.length) * 100) : 0;
}

// ─── Stylesheet ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    paddingTop: 22,
    paddingBottom: 45,
    paddingHorizontal: 28,
    fontSize: 8.5,
    color: SLATE_900,
    backgroundColor: BG_PAGE,
  },

  // ── HEADER (High-contrast, elegant navy & gold) ───────────────────────────
  header: {
    backgroundColor: SLATE_900,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: TEAL_PRIMARY,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#044E45',
    borderWidth: 1.5,
    borderColor: TEAL_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandName: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#FFFFFF', // High-contrast white
    lineHeight: 1.1,
    fontFamily: 'Lora',
    letterSpacing: 0.5,
  },
  headerBrandTag: {
    fontSize: 6,
    color: '#CBD5E1', // High-contrast silver-slate
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: 'bold',
  },
  logo: {
    height: 26,
    width: 115,
    objectFit: 'contain',
  },
  headerTextContainer: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Lora',
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 6.5,
    marginTop: 2,
    fontWeight: 500,
  },

  // ── PATIENT BANNER ────────────────────────────────────────────────────────
  patientBanner: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  patientIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: TEAL_BORDER,
  },
  patientIconFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TEAL_TINT,
    borderWidth: 1.5,
    borderColor: TEAL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientIconFallbackText: {
    color: TEAL_DARK,
    fontWeight: 'bold',
    fontSize: 11,
  },
  patientDetails: {
    justifyContent: 'center',
  },
  patientName: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: SLATE_900,
  },
  patientMeta: {
    fontSize: 6.5,
    color: SLATE_500,
    marginTop: 1.5,
    fontWeight: 500,
  },
  bannerBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 6,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
  },
  bannerBadgeText: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_700,
  },
  bannerBadgeSubtext: {
    fontSize: 5.5,
    color: SLATE_400,
    marginTop: 1,
  },

  // ── SECTION HEADING ───────────────────────────────────────────────────────
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeadingTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  sectionHeadingSubtitle: {
    fontSize: 6.5,
    color: SLATE_500,
    fontWeight: 500,
    marginTop: 1.5,
  },
  sectionDatePill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 6,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
  },
  sectionDatePillText: {
    fontSize: 6,
    color: SLATE_500,
    fontWeight: 'bold',
  },

  // ── HERO EXECUTIVE SUMMARY 3-CARD ROW ─────────────────────────────────────
  overviewGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 9,
  },
  overviewCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 10,
    padding: 9,
    backgroundColor: '#ffffff',
  },
  overviewCardTitle: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
    fontFamily: 'Lora',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  radialContainer: {
    position: 'relative',
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialLabelContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialScoreText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  radialDescText: {
    fontSize: 4.5,
    color: SLATE_400,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 0.5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2.5,
  },
  legendColor: {
    width: 6,
    height: 6,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 6.5,
    color: SLATE_700,
    flex: 1,
  },
  legendValue: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_900,
  },

  // Body system index progress bars
  bodySystemRow: {
    marginBottom: 4.5,
  },
  bodySystemLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  bodySystemLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_700,
  },
  bodySystemVal: {
    fontSize: 6.5,
    fontWeight: 'bold',
  },
  bodySystemTrack: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bodySystemFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ── ACTIONABLE CLINICAL FOLLOW-UP CARD ────────────────────────────────────
  actionableFollowUpCard: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    padding: 8,
    marginBottom: 9,
  },
  actionableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  actionableAlertBadge: {
    backgroundColor: '#fee2e2',
    borderWidth: 0.8,
    borderColor: '#f87171',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  actionableAlertBadgeText: {
    color: '#b91c1c',
    fontSize: 5.5,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  actionableSubtitle: {
    fontSize: 6.5,
    color: '#7f1d1d',
    fontWeight: 500,
  },
  actionableFindingsList: {
    gap: 3.5,
    marginBottom: 6,
  },
  actionableFindingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 5,
    paddingVertical: 3.5,
    paddingHorizontal: 7,
    borderWidth: 0.5,
    borderColor: '#fecaca',
  },
  actionableItemName: {
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_900,
  },
  actionableItemVal: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#b91c1c',
  },
  actionableItemRef: {
    fontSize: 6,
    color: SLATE_400,
  },
  actionableCtaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#fecaca',
    paddingTop: 5,
  },
  actionableCtaNote: {
    fontSize: 6,
    color: '#7f1d1d',
    fontWeight: 500,
    flex: 1,
    marginRight: 6,
  },
  actionableButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  actionableButtonText: {
    color: '#ffffff',
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },

  optimalWellnessBanner: {
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 8,
    marginBottom: 9,
  },

  // ── AI CLINICAL SUMMARY ───────────────────────────────────────────────────
  summaryContainer: {
    borderWidth: 1,
    borderColor: TEAL_PRIMARY,
    borderRadius: 10,
    padding: 8,
    marginBottom: 9,
    backgroundColor: '#ffffff',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3.5,
  },
  summaryBadge: {
    backgroundColor: TEAL_TINT,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: TEAL_BORDER,
  },
  summaryBadgeText: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: TEAL_DARK,
    letterSpacing: 0.3,
  },
  summaryTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  summaryText: {
    color: SLATE_700,
    fontSize: 7,
    lineHeight: 1.35,
  },
  summaryDisclaimer: {
    marginTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: SLATE_100,
    paddingTop: 3.5,
  },
  summaryDisclaimerText: {
    fontSize: 5.5,
    color: SLATE_500,
  },

  // ── CONTINUOUS DETAILED PANELS ────────────────────────────────────────────
  panelSection: {
    marginBottom: 10,
  },
  panelHeader: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  panelMeta: {
    fontSize: 6,
    color: SLATE_400,
    marginTop: 1,
    fontWeight: 500,
  },
  panelScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    borderWidth: 0.8,
    borderColor: SLATE_100,
  },
  panelScoreVal: {
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  panelScoreLabel: {
    fontSize: 5,
    color: SLATE_400,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },

  // ── FLAGGED BIOMARKER CARD (Full gauge + clinical interpretation) ─────────
  flaggedCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 5,
    backgroundColor: '#ffffff',
  },
  flaggedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  flaggedName: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  flaggedValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  flaggedValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: SLATE_900,
  },
  flaggedUnit: {
    fontSize: 6.5,
    color: SLATE_400,
    fontWeight: 500,
  },
  flaggedBadge: {
    borderRadius: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 4.5,
    marginTop: 2,
    borderWidth: 0.5,
    alignSelf: 'flex-end',
  },
  flaggedBadgeText: {
    fontSize: 5.5,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  interpretationBox: {
    marginTop: 5,
    padding: 5,
    borderRadius: 6,
    backgroundColor: TEAL_TINT,
    borderWidth: 0.8,
    borderColor: TEAL_BORDER,
    flexDirection: 'row',
    gap: 5,
  },
  interpretationLabel: {
    color: TEAL_DARK,
    fontWeight: 'bold',
    fontSize: 5.5,
    backgroundColor: '#ffffff',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: TEAL_BORDER,
    alignSelf: 'flex-start',
  },
  interpretationText: {
    color: SLATE_700,
    fontSize: 6.5,
    lineHeight: 1.25,
    flex: 1,
  },

  // ── COMPACT NORMAL MARKERS TABLE ──────────────────────────────────────────
  compactTableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE_100,
    overflow: 'hidden',
    marginBottom: 5,
  },
  compactTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.8,
    borderBottomColor: SLATE_100,
    alignItems: 'center',
  },
  compactTableHeaderText: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: 'Lora',
  },
  compactTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  compactTableRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
  },
  compactColName: {
    width: '32%',
    fontSize: 7,
    color: SLATE_900,
    fontWeight: 500,
    paddingRight: 4,
  },
  compactColBar: {
    width: '38%',
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  compactColValue: {
    width: '17%',
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_900,
    textAlign: 'right',
    paddingRight: 6,
  },
  compactColStatus: {
    width: '13%',
    alignItems: 'flex-end',
  },
  miniBarTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  miniBarNeedle: {
    position: 'absolute',
    top: -1.5,
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f172a',
    borderWidth: 1.2,
    borderColor: '#ffffff',
  },
  miniBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1.5,
  },
  miniBarLabelText: {
    fontSize: 5,
    color: SLATE_400,
    fontWeight: 500,
  },

  // ── FOOTER (Fixed on all pages) ───────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 28,
    right: 28,
    borderTopWidth: 0.8,
    borderTopColor: SLATE_300,
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLogo: {
    height: 11,
    width: 55,
    objectFit: 'contain',
  },
  footerText: {
    color: SLATE_400,
    fontSize: 5.5,
    fontWeight: 500,
  },
  pageNumber: {
    color: SLATE_400,
    fontSize: 5.5,
    fontWeight: 'bold',
  },
});

// ─── Component Props ───────────────────────────────────────────────────────────
export interface PremiumPDFDocumentProps {
  report: LabReport;
  logoUrl?: string;
  iconLogoUrl?: string;
  brandName?: string;
  showPoweredBy?: boolean;
  poweredByText?: string;
}

// ─── Premium PDF Document Component ────────────────────────────────────────────
export function PremiumPDFDocument({
  report,
  logoUrl,
  iconLogoUrl,
  brandName,
  showPoweredBy = true,
  poweredByText,
}: PremiumPDFDocumentProps) {
  const allBiomarkers = report.panels.flatMap(p => p.biomarkers);
  const normalCount = allBiomarkers.filter(b => b.status === 'normal').length;
  const highCount = allBiomarkers.filter(b => b.status === 'high').length;
  const lowCount = allBiomarkers.filter(b => b.status === 'low').length;
  const criticalCount = allBiomarkers.filter(b => b.status === 'critical').length;
  const totalCount = allBiomarkers.length;
  const flaggedCount = highCount + lowCount + criticalCount;
  const flaggedBiomarkers = allBiomarkers.filter(b => b.status !== 'normal');

  const normalPct = typeof report.healthScore === 'number'
    ? report.healthScore
    : (totalCount ? Math.round((normalCount / totalCount) * 100) : 0);

  const scoreColor = normalPct >= 80 ? TEAL_BRIGHT : normalPct >= 60 ? '#f59e0b' : '#ef4444';
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formattedReportDate = formatReportDate(report.labDate || report.collectionDate) || generatedDate;

  // Standard Body Systems mapping with calculated score
  const standardPanels = [
    { label: 'BLOOD', categories: ['CBC', 'Blood', 'Hematology'] },
    { label: 'HEART', categories: ['Lipid Panel', 'Lipid', 'Cardiovascular'] },
    { label: 'HORMONES', categories: ['Hormones', 'Thyroid', 'Thyroid Panel'] },
    { label: 'NUTRIENTS', categories: ['Vitamins & Minerals', 'Nutrients', 'Vitamins'] },
    { label: 'METABOLIC', categories: ['Metabolic', 'Comprehensive Metabolic Panel', 'Comprehensive Metabolic Panel (CMP)', 'Kidney', 'Liver', 'Electrolytes'] },
  ];

  const systemsData = standardPanels.map(panel => {
    const biomarkersInPanel = report.panels
      .filter(p => panel.categories.some(c => p.name.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(p.name.toLowerCase())))
      .flatMap(p => p.biomarkers);

    const score = biomarkersInPanel.length
      ? Math.round((biomarkersInPanel.filter(b => b.status === 'normal').length / biomarkersInPanel.length) * 100)
      : 100;

    return {
      system: panel.label,
      score,
      total: biomarkersInPanel.length,
    };
  });

  // Category Doughnut segments
  const categoryData = report.panels
    .filter(p => p.biomarkers.length > 0)
    .map((p, idx) => {
      const color = CATEGORY_COLORS[p.name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      return {
        name: p.name.replace('Panel', '').trim(),
        count: p.biomarkers.length,
        color,
      };
    });

  const categoryTotal = categoryData.reduce((acc, curr) => acc + curr.count, 0);

  let accumulatedPct = 0;
  const doughnutSegments = categoryData.map((item) => {
    const pct = categoryTotal ? item.count / categoryTotal : 0;
    const offset = accumulatedPct;
    accumulatedPct += pct;
    return { ...item, pct, offset };
  });

  return (
    <Document>
      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 1: EXECUTIVE SUMMARY & CLINICAL HERO (NO REDUNDANCY)
          ══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <>
                <View style={styles.headerLogoCircle}>
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>⚲</Text>
                </View>
                <View>
                  <Text style={styles.headerBrandName}>{(brandName || 'YOUR CONCIERGE MD').toUpperCase()}</Text>
                  <Text style={styles.headerBrandTag}>Clinical Laboratory Report</Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Bloodwork Analysis Report</Text>
            <Text style={styles.headerSubtitle}>Generated: {generatedDate}</Text>
          </View>
        </View>

        {/* ─── Patient Banner ─── */}
        <View style={styles.patientBanner}>
          <View style={styles.patientInfo}>
            {iconLogoUrl ? (
              <Image src={iconLogoUrl} style={styles.patientIcon} />
            ) : (
              <View style={styles.patientIconFallback}>
                <Text style={styles.patientIconFallbackText}>
                  {(report.patientName || 'P').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.patientDetails}>
              <Text style={styles.patientName}>{report.patientName || 'Patient Report'}</Text>
              <Text style={styles.patientMeta}>
                {[
                  report.patientAge ? `${report.patientAge} yrs` : null,
                  report.patientGender ? (report.patientGender.charAt(0).toUpperCase() + report.patientGender.slice(1).toLowerCase()) : null,
                  formattedReportDate,
                  brandName || (report.orderedBy?.startsWith('Dr.') ? report.orderedBy : (report.orderedBy || 'Health Clinic')),
                ].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          </View>

          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>{totalCount} Biomarkers Tested</Text>
            <Text style={styles.bannerBadgeSubtext}>{report.panels.length} Diagnostic Panels</Text>
          </View>
        </View>

        {/* ─── Section Heading ─── */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionHeadingTitle}>Executive Health Summary</Text>
            <Text style={styles.sectionHeadingSubtitle}>Holistic body status, biomarker distribution & physician follow-up</Text>
          </View>
          <View style={styles.sectionDatePill}>
            <Text style={styles.sectionDatePillText}>Report Date: {formattedReportDate}</Text>
          </View>
        </View>

        {/* ─── Unified Hero Section (Health Score, Categories, Body Systems) ─── */}
        <View style={styles.overviewGrid}>
          {/* Card 1: Health Score Radial Gauge */}
          <View style={styles.overviewCard}>
            <Text style={styles.overviewCardTitle}>Overall Health Score</Text>
            <View style={styles.chartRow}>
              <View style={styles.radialContainer}>
                <Svg width="52" height="52" viewBox="0 0 52 52">
                  <Circle cx="26" cy="26" r="22" stroke={SLATE_100} strokeWidth="4" fill="none" />
                  {normalPct > 0 && (
                    <CircleAny
                      cx="26"
                      cy="26"
                      r="22"
                      stroke={scoreColor}
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${((normalPct / 100) * 2 * Math.PI * 22).toFixed(2)},${(2 * Math.PI * 22).toFixed(2)}`}
                      strokeDashoffset={(2 * Math.PI * 22 / 4).toFixed(2)}
                      strokeLinecap="round"
                    />
                  )}
                </Svg>
                <View style={styles.radialLabelContainer}>
                  <Text style={[styles.radialScoreText, { color: scoreColor }]}>{normalPct}%</Text>
                  <Text style={styles.radialDescText}>
                    {normalPct >= 80 ? 'Optimal' : normalPct >= 60 ? 'Moderate' : 'Needs Focus'}
                  </Text>
                </View>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#0d9488' }]} />
                  <Text style={styles.legendLabel}>Optimal</Text>
                  <Text style={styles.legendValue}>{normalCount}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#b91c1c' }]} />
                  <Text style={styles.legendLabel}>Elevated</Text>
                  <Text style={styles.legendValue}>{highCount}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#b45309' }]} />
                  <Text style={styles.legendLabel}>Reduced</Text>
                  <Text style={styles.legendValue}>{lowCount}</Text>
                </View>
                {criticalCount > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#7f1d1d' }]} />
                    <Text style={styles.legendLabel}>Critical</Text>
                    <Text style={styles.legendValue}>{criticalCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Card 2: Biomarkers by Category Doughnut */}
          <View style={[styles.overviewCard, { flex: 1.1 }]}>
            <Text style={styles.overviewCardTitle}>Panels Distribution</Text>
            <View style={styles.chartRow}>
              <View style={styles.radialContainer}>
                <Svg width="52" height="52" viewBox="0 0 52 52">
                  <Circle cx="26" cy="26" r="17" stroke={SLATE_100} strokeWidth="5.5" fill="none" />
                  {doughnutSegments.map((seg, sIdx) => {
                    if (seg.pct <= 0) return null;
                    const C = 2 * Math.PI * 17;
                    const dash1 = seg.pct * C;
                    const correctedOffset = C / 4 - seg.offset * C;
                    return (
                      <CircleAny
                        key={sIdx}
                        cx="26" cy="26" r="17"
                        stroke={seg.color}
                        strokeWidth="5.5"
                        fill="none"
                        strokeDasharray={`${dash1.toFixed(2)},${(C - dash1).toFixed(2)}`}
                        strokeDashoffset={correctedOffset.toFixed(2)}
                      />
                    );
                  })}
                </Svg>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: SLATE_900 }}>{totalCount}</Text>
                  <Text style={{ fontSize: 4, fontWeight: 'bold', color: SLATE_400, textTransform: 'uppercase', letterSpacing: 0.3 }}>Markers</Text>
                </View>
              </View>

              <View style={{ flex: 1, gap: 1.5 }}>
                {categoryData.slice(0, 5).map((item, idx) => (
                  <View key={idx} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendLabel, { fontSize: 6 }]}>{item.name}</Text>
                    <Text style={[styles.legendValue, { fontSize: 6 }]}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Card 3: Standardized Body Systems Index with visible scale */}
          <View style={[styles.overviewCard, { flex: 1.25 }]}>
            <Text style={styles.overviewCardTitle}>Body Systems Index</Text>
            <View style={{ gap: 3.5, marginTop: 1 }}>
              {systemsData.map((item) => {
                const isOptimal = item.score === 100;
                const barColor = isOptimal ? '#0d9488' : item.score >= 80 ? '#f59e0b' : '#b91c1c';
                return (
                  <View key={item.system} style={styles.bodySystemRow}>
                    <View style={styles.bodySystemLabelRow}>
                      <Text style={styles.bodySystemLabel}>{item.system}</Text>
                      <Text style={[styles.bodySystemVal, { color: barColor }]}>
                        {item.score}% {isOptimal ? '✓' : '!'}
                      </Text>
                    </View>
                    <View style={styles.bodySystemTrack}>
                      <View
                        style={[
                          styles.bodySystemFill,
                          {
                            width: `${Math.max(5, item.score)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── Actionable Clinical Follow-up Box ─── */}
        {flaggedCount > 0 ? (
          <View style={styles.actionableFollowUpCard} wrap={false}>
            <View style={styles.actionableHeader}>
              <View style={styles.actionableAlertBadge}>
                <Text style={styles.actionableAlertBadgeText}>⚠️ CLINICAL ACTION RECOMMENDED</Text>
              </View>
              <Text style={styles.actionableSubtitle}>
                {flaggedCount} biomarker{flaggedCount !== 1 ? 's' : ''} outside standard reference interval
              </Text>
            </View>

            <View style={styles.actionableFindingsList}>
              {flaggedBiomarkers.slice(0, 3).map((b) => {
                const r = resolveBiomarkerRange(b.name, b.min, b.max, b.value, report.patientGender || 'male');
                const meta = STATUS_META[b.status] || STATUS_META.normal;
                return (
                  <View key={b.name} style={styles.actionableFindingRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ backgroundColor: meta.bg, borderColor: meta.border, borderWidth: 0.5, borderRadius: 3, paddingHorizontal: 3.5, paddingVertical: 1 }}>
                        <Text style={{ color: meta.fg, fontSize: 5.5, fontWeight: 'bold' }}>{meta.icon} {meta.label}</Text>
                      </View>
                      <Text style={styles.actionableItemName}>{b.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.actionableItemVal, { color: meta.fg }]}>{b.value} {b.unit}</Text>
                      <Text style={styles.actionableItemRef}>Optimal: {r.optimalText} {b.unit}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.actionableCtaRow}>
              <Text style={styles.actionableCtaNote}>
                Recommended Next Step: Discuss these findings with your attending physician to evaluate transient vs. persistent variation.
              </Text>
              <View style={styles.actionableButton}>
                <Text style={styles.actionableButtonText}>SCHEDULE CLINICAL REVIEW →</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.optimalWellnessBanner} wrap={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 9, color: '#0d9488', fontWeight: 'bold' }}>✓</Text>
              <Text style={{ fontSize: 8, color: '#044E45', fontWeight: 'bold', fontFamily: 'Lora' }}>
                All Biomarkers Within Optimal Reference Range
              </Text>
            </View>
            <Text style={{ fontSize: 6.5, color: '#065f46', marginTop: 2 }}>
              All analyzed metabolic, cardiovascular, cellular, and endocrine indicators are within healthy physiological parameters. Maintain routine preventive screenings.
            </Text>
          </View>
        )}

        {/* ─── AI Clinical Synthesis ─── */}
        {report.summary && (
          <View style={styles.summaryContainer} wrap={false}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>AI CLINICAL SYNTHESIS</Text>
              </View>
              <Text style={styles.summaryTitle}>Laboratory Interpretation Summary</Text>
            </View>
            <Text style={styles.summaryText}>{report.summary}</Text>
            <View style={styles.summaryDisclaimer}>
              <Text style={styles.summaryDisclaimerText}>
                * AI-generated clinical synthesis for informational guidance — not a formal diagnosis. Always consult your attending healthcare provider before modifying medications or treatments.
              </Text>
            </View>
          </View>
        )}

        {/* ─── Page 1 Footer ─── */}
        <View style={styles.footer} fixed>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.footerLogo} />
          ) : (
            <Text style={{ color: SLATE_500, fontSize: 6, fontWeight: 'bold' }}>{(brandName || 'YOUR CONCIERGE MD').toUpperCase()}</Text>
          )}
          <Text style={styles.footerText}>
            {showPoweredBy ? (poweredByText || 'Powered by Huumanize') + '  ·  ' : ''}Confidential Clinical Document
          </Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGES 2+: CONTINUOUS BIOMARKER BREAKDOWN (NO PAGE-PER-PANEL WASTE)
          ══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page} wrap={true}>
        {/* Fixed Header on every sub-page */}
        <View style={styles.header} fixed>
          <View style={styles.headerBrand}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <>
                <View style={styles.headerLogoCircle}>
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>⚲</Text>
                </View>
                <View>
                  <Text style={styles.headerBrandName}>{(brandName || 'YOUR CONCIERGE MD').toUpperCase()}</Text>
                  <Text style={styles.headerBrandTag}>Detailed Biomarker Panels</Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Bloodwork Analysis Report</Text>
            <Text style={styles.headerSubtitle}>{report.patientName || 'Patient Report'} · {formattedReportDate}</Text>
          </View>
        </View>

        {/* Continuous panels flow */}
        {report.panels.map((panel) => {
          const pPct = panelScore(panel);
          const pColor = pPct >= 80 ? TEAL_BRIGHT : pPct >= 60 ? '#f59e0b' : '#ef4444';
          const flagged = panel.biomarkers.filter(b => b.status !== 'normal');
          const normal = panel.biomarkers.filter(b => b.status === 'normal');

          return (
            <View key={panel.name} style={styles.panelSection} wrap={true}>
              {/* Panel Header */}
              <View style={styles.panelHeader} wrap={false}>
                <View>
                  <Text style={styles.panelTitle}>{panel.name}</Text>
                  <Text style={styles.panelMeta}>
                    {panel.biomarkers.length} markers  ·  {flagged.length > 0 ? `${flagged.length} require review` : 'all biomarkers optimal'}
                  </Text>
                </View>
                <View style={styles.panelScoreBadge}>
                  <Text style={[styles.panelScoreVal, { color: pColor }]}>{pPct}%</Text>
                  <Text style={styles.panelScoreLabel}>Panel Score</Text>
                </View>
              </View>

              {/* 1. FLAGGED / BORDERLINE BIOMARKERS (Full illustrated gauge + clinical interpretation) */}
              {flagged.map((m) => {
                const meta = STATUS_META[m.status] || STATUS_META.normal;
                const resolved = resolveBiomarkerRange(m.name, m.min, m.max, m.value, report.patientGender || 'male');

                return (
                  <View
                    key={m.name}
                    style={[
                      styles.flaggedCard,
                      {
                        borderColor: meta.border,
                        backgroundColor: meta.bg,
                      },
                    ]}
                    wrap={false}
                  >
                    {/* Top Row: Name, Value, Status badge */}
                    <View style={styles.flaggedTopRow}>
                      <View>
                        <Text style={styles.flaggedName}>{m.name}</Text>
                        <Text style={{ fontSize: 6, color: SLATE_500, marginTop: 1 }}>
                          Reference Interval: {resolved.optimalText} {m.unit}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={styles.flaggedValueRow}>
                          <Text style={[styles.flaggedValue, { color: meta.fg }]}>{m.value}</Text>
                          <Text style={styles.flaggedUnit}>{m.unit}</Text>
                        </View>
                        <View style={[styles.flaggedBadge, { backgroundColor: '#ffffff', borderColor: meta.border }]}>
                          <Text style={[styles.flaggedBadgeText, { color: meta.fg }]}>
                            {meta.icon} {meta.label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Accurate Asymmetric / Bounded Range Bar with muted clinical tones */}
                    <View style={{ marginVertical: 4 }} wrap={false}>
                      {resolved.type === 'greater_than' ? (
                        // One-sided Greater Than Bar: Zone 1 (0 to 35% Low/Amber), Zone 2 (35% to 100% Optimal/Green)
                        <View>
                          <View style={{
                            flexDirection: 'row',
                            width: '100%',
                            height: 7,
                            borderRadius: 3.5,
                            overflow: 'hidden',
                            position: 'relative',
                            backgroundColor: BAR_ZONE.trackBg,
                          }}>
                            <View style={{ width: '35%', backgroundColor: BAR_ZONE.low }} />
                            <View style={{ width: '65%', backgroundColor: BAR_ZONE.optimal }} />
                            <View style={{
                              position: 'absolute',
                              left: `${resolved.pct}%`,
                              top: -1.5,
                              marginLeft: -4.5,
                              width: 9,
                              height: 9,
                              borderRadius: 4.5,
                              backgroundColor: '#0f172a',
                              borderWidth: 1.5,
                              borderColor: '#ffffff',
                            }} />
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                            <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 'bold' }}>0</Text>
                            <Text style={{ fontSize: 5.5, color: SLATE_700, fontWeight: 'bold' }}>Optimal Threshold: ≥ {resolved.optimalMin} {m.unit}</Text>
                            <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 'bold' }}>&gt;</Text>
                          </View>
                        </View>
                      ) : resolved.type === 'less_than' ? (
                        // One-sided Less Than Bar: Zone 1 (0 to 65% Optimal/Green), Zone 2 (65% to 85% Elevated/Amber), Zone 3 (85% to 100% Critical/Rose)
                        <View>
                          <View style={{
                            flexDirection: 'row',
                            width: '100%',
                            height: 7,
                            borderRadius: 3.5,
                            overflow: 'hidden',
                            position: 'relative',
                            backgroundColor: BAR_ZONE.trackBg,
                          }}>
                            <View style={{ width: '65%', backgroundColor: BAR_ZONE.optimal }} />
                            <View style={{ width: '20%', backgroundColor: BAR_ZONE.low }} />
                            <View style={{ width: '15%', backgroundColor: BAR_ZONE.high }} />
                            <View style={{
                              position: 'absolute',
                              left: `${resolved.pct}%`,
                              top: -1.5,
                              marginLeft: -4.5,
                              width: 9,
                              height: 9,
                              borderRadius: 4.5,
                              backgroundColor: '#0f172a',
                              borderWidth: 1.5,
                              borderColor: '#ffffff',
                            }} />
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                            <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 'bold' }}>0</Text>
                            <Text style={{ fontSize: 5.5, color: SLATE_700, fontWeight: 'bold' }}>Optimal Limit: &lt; {resolved.optimalMax} {m.unit}</Text>
                            <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 'bold' }}>{resolved.displayMax}</Text>
                          </View>
                        </View>
                      ) : (
                        // Two-sided Bounded Bar: Zone 1 (Low/Amber 30%), Zone 2 (Optimal/Green 40%), Zone 3 (High/Rose 30%)
                        <View>
                          <View style={{
                            flexDirection: 'row',
                            width: '100%',
                            height: 7,
                            borderRadius: 3.5,
                            overflow: 'hidden',
                            position: 'relative',
                            backgroundColor: BAR_ZONE.trackBg,
                          }}>
                            <View style={{ width: '30%', backgroundColor: BAR_ZONE.low }} />
                            <View style={{ width: '40%', backgroundColor: BAR_ZONE.optimal }} />
                            <View style={{ width: '30%', backgroundColor: BAR_ZONE.high }} />
                            <View style={{
                              position: 'absolute',
                              left: `${resolved.pct}%`,
                              top: -1.5,
                              marginLeft: -4.5,
                              width: 9,
                              height: 9,
                              borderRadius: 4.5,
                              backgroundColor: '#0f172a',
                              borderWidth: 1.5,
                              borderColor: '#ffffff',
                            }} />
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                            <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 'bold' }}>{resolved.displayMin}</Text>
                            <Text style={{ fontSize: 5.5, color: SLATE_700, fontWeight: 'bold' }}>Optimal Range: {resolved.optimalMin} – {resolved.optimalMax} {m.unit}</Text>
                            <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 'bold' }}>{resolved.displayMax}</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* AI Clinical Interpretation */}
                    {m.clinicalInterpretation ? (
                      <View style={styles.interpretationBox}>
                        <Text style={styles.interpretationLabel}>AI CLINICAL NOTE</Text>
                        <Text style={styles.interpretationText}>{m.clinicalInterpretation}</Text>
                      </View>
                    ) : (
                      <View style={styles.interpretationBox}>
                        <Text style={styles.interpretationLabel}>RECOMMENDATION</Text>
                        <Text style={styles.interpretationText}>Discuss this marker with your healthcare provider to evaluate if dietary adjustments or retesting is advised.</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* 2. COMPACT NORMAL BIOMARKERS TABLE (WITH INLINE MINI-SLIDER FOR EVERY MARKER) */}
              {normal.length > 0 && (
                <View style={styles.compactTableContainer} wrap={false}>
                  <View style={styles.compactTableHeader}>
                    <Text style={styles.compactColName}>
                      <Text style={styles.compactTableHeaderText}>Biomarker Name</Text>
                    </Text>
                    <Text style={styles.compactColBar}>
                      <Text style={styles.compactTableHeaderText}>Visual Range Position</Text>
                    </Text>
                    <Text style={styles.compactColValue}>
                      <Text style={styles.compactTableHeaderText}>Result</Text>
                    </Text>
                    <Text style={styles.compactColStatus}>
                      <Text style={styles.compactTableHeaderText}>Status</Text>
                    </Text>
                  </View>

                  {normal.map((m, idx) => {
                    const isLast = idx === normal.length - 1;
                    const resolved = resolveBiomarkerRange(m.name, m.min, m.max, m.value, report.patientGender || 'male');
                    return (
                      <View
                        key={m.name}
                        style={isLast ? styles.compactTableRowLast : styles.compactTableRow}
                      >
                        {/* Column 1: Biomarker Name */}
                        <Text style={styles.compactColName}>{m.name}</Text>

                        {/* Column 2: Thin Mini Range Slider with Dot Indicator */}
                        <View style={styles.compactColBar}>
                          <View style={styles.miniBarTrack}>
                            {resolved.type === 'greater_than' ? (
                              <>
                                <View style={{ width: '35%', backgroundColor: BAR_ZONE.low, height: '100%' }} />
                                <View style={{ width: '65%', backgroundColor: BAR_ZONE.optimal, height: '100%' }} />
                              </>
                            ) : resolved.type === 'less_than' ? (
                              <>
                                <View style={{ width: '65%', backgroundColor: BAR_ZONE.optimal, height: '100%' }} />
                                <View style={{ width: '20%', backgroundColor: BAR_ZONE.low, height: '100%' }} />
                                <View style={{ width: '15%', backgroundColor: BAR_ZONE.high, height: '100%' }} />
                              </>
                            ) : (
                              <>
                                <View style={{ width: '30%', backgroundColor: BAR_ZONE.low, height: '100%' }} />
                                <View style={{ width: '40%', backgroundColor: BAR_ZONE.optimal, height: '100%' }} />
                                <View style={{ width: '30%', backgroundColor: BAR_ZONE.high, height: '100%' }} />
                              </>
                            )}

                            {/* Result needle dot */}
                            <View
                              style={[
                                styles.miniBarNeedle,
                                { left: `${resolved.pct}%` },
                              ]}
                            />
                          </View>

                          {/* Range Limits subtext */}
                          <View style={styles.miniBarLabels}>
                            <Text style={styles.miniBarLabelText}>
                              {resolved.type === 'greater_than'
                                ? '0'
                                : resolved.type === 'less_than'
                                ? '0'
                                : `${resolved.displayMin}`}
                            </Text>
                            <Text style={[styles.miniBarLabelText, { color: SLATE_500 }]}>
                              Ref: {resolved.optimalText} {m.unit}
                            </Text>
                            <Text style={styles.miniBarLabelText}>
                              {resolved.type === 'greater_than'
                                ? '>'
                                : `${resolved.displayMax}`}
                            </Text>
                          </View>
                        </View>

                        {/* Column 3: Patient Result Value */}
                        <Text style={styles.compactColValue}>
                          {m.value} <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 500 }}>{m.unit}</Text>
                        </Text>

                        {/* Column 4: Status Badge */}
                        <View style={styles.compactColStatus}>
                          <View style={{
                            backgroundColor: '#ecfdf5',
                            borderRadius: 3,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                            borderWidth: 0.5,
                            borderColor: '#a7f3d0',
                          }}>
                            <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#0d9488' }}>✓ NORMAL</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Fixed Footer on every sub-page */}
        <View style={styles.footer} fixed>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.footerLogo} />
          ) : (
            <Text style={{ color: SLATE_500, fontSize: 6, fontWeight: 'bold' }}>{(brandName || 'YOUR CONCIERGE MD').toUpperCase()}</Text>
          )}
          <Text style={styles.footerText}>
            {showPoweredBy ? (poweredByText || 'Powered by Huumanize') + '  ·  ' : ''}Confidential Clinical Document
          </Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
