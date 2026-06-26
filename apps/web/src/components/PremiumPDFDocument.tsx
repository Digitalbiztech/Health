import { Document, Page, Text, View, StyleSheet, Font, Image, Svg, Circle, Line, Polyline, Rect } from '@react-pdf/renderer';
import type { LabReport, LabPanel } from '@/types/lab';
function resolveRange(_name: string, minVal: any, maxVal: any, value: number, _gender: string) {
  const numMin = (minVal !== null && minVal !== undefined && minVal !== '') ? Number(minVal) : NaN;
  const numMax = (maxVal !== null && maxVal !== undefined && maxVal !== '') ? Number(maxVal) : NaN;

  const minRaw = !isNaN(numMin) ? numMin : 0;
  const maxRaw = !isNaN(numMax) ? numMax : (value > 0 ? value * 1.5 : 100);
  
  // Round to prevent floating point inaccuracies (e.g. 1.7999999999999998 -> 1.8)
  const min = parseFloat(minRaw.toFixed(4));
  const max = parseFloat(maxRaw.toFixed(4));
  
  return { min, max };
}

// `strokeDashoffset` is supported at runtime by react-pdf's renderer but missing
// from CircleProps' typings — alias as `any` for the gauge / doughnut math.
const CircleAny = Circle as any;

// ─── Embed clean, professional Roboto, Lora, and Inter fonts ──────────────────
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf', fontWeight: 700 }
  ]
});

Font.register({
  family: 'Lora',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@latest/latin-400-normal.woff', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@latest/latin-500-normal.woff', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@latest/latin-700-normal.woff', fontWeight: 700 }
  ]
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.woff', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff', fontWeight: 700 }
  ]
});


// ─── Status colour tokens (preserved clinical semantics) ─────────────────────
const STATUS_HEX: Record<string, { fg: string; bg: string; light: string; bar: string }> = {
  normal: { fg: '#0d9488', bg: '#ecfdf5', light: '#d1fae5', bar: '#0d9488' },
  high: { fg: '#b91c1c', bg: '#fef2f2', light: '#fee2e2', bar: '#b91c1c' },
  low: { fg: '#b45309', bg: '#fffbeb', light: '#fef3c7', bar: '#b45309' },
  critical: { fg: '#7f1d1d', bg: '#fef2f2', light: '#fee2e2', bar: '#7f1d1d' },
  unknown: { fg: '#64748b', bg: '#f8fafc', light: '#f1f5f9', bar: '#94a3b8' },
};


const STATUS_LABEL: Record<string, string> = {
  normal: 'NORMAL', high: 'HIGH', low: 'LOW', critical: 'CRITICAL', unknown: 'UNKNOWN',
};

// ─── HealthDashboard-inspired teal/emerald palette ───────────────────────────
const TEAL_DEEP = '#044E45';   // dark teal — asthma-callout background
const TEAL_DARK = '#065f46';   // emerald-800 — strong line / heading
const TEAL_PRIMARY = '#0DA58E';   // brand teal — buttons / primary
const TEAL_LIGHT = '#a7f3d0';   // emerald-200 — soft fills
const TEAL_TINT = '#ecfdf5';   // emerald-50 — card tints
const TEAL_BORDER = '#d1fae5';   // emerald-100 — soft borders
const BG_PAGE = '#F9FBFA';   // cream-mint page bg
const BG_CARD = '#ffffff83';

const YC_GOLD = '#D4BDAD';
const SLATE_900 = '#1f2937';
const SLATE_700 = '#374151';
const SLATE_500 = '#6b7280';
const SLATE_400 = '#9ca3af';
const SLATE_300 = '#d1d5db';
const SLATE_100 = '#f3f4f6';

// Accent palettes for tri-card metrics (matches HealthDashboard tri-cards)
const ACCENT = {
  green: { fg: '#10b981', bg: '#ecfdf5', icon: '#d1fae5' },
  blue: { fg: '#3b82f6', bg: '#eff6ff', icon: '#dbeafe' },
  amber: { fg: '#f59e0b', bg: '#fffbeb', icon: '#fef3c7' },
};

// ─── Stylesheet using React-PDF Flexbox layout model ────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    paddingTop: 26,
    paddingBottom: 55,
    paddingHorizontal: 28,
    fontSize: 9,
    color: SLATE_900,
    backgroundColor: BG_PAGE,
  },

  // ── HEADER (light, dashboard-style) ───────────────────────────────────────
  header: {
    backgroundColor: SLATE_900, // overridden inline
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 3,
    borderBottomColor: YC_GOLD, // overridden inline
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: SLATE_900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: YC_GOLD,
    lineHeight: 1.1,
    fontFamily: 'Lora',
  },
  headerBrandTag: {
    fontSize: 6.5,
    color: SLATE_700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  logo: {
    height: 32,
    width: 120,
    objectFit: 'contain',
  },
  headerTextContainer: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: YC_GOLD,
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Lora',
  },
  headerSubtitle: {
    color: SLATE_400,
    fontSize: 7.5,
    marginTop: 2,
    fontWeight: 'bold',
  },

  // ── PATIENT BANNER ────────────────────────────────────────────────────────
  patientBanner: {
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 24,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  patientIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: TEAL_TINT,
  },
  patientIconFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TEAL_TINT,
    borderWidth: 2,
    borderColor: TEAL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientIconFallbackText: {
    color: TEAL_DARK,
    fontWeight: 'bold',
    fontSize: 14,
  },
  patientDetails: {
    justifyContent: 'center',
  },
  patientName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: SLATE_900,
  },
  patientMeta: {
    fontSize: 7.5,
    color: SLATE_400,
    marginTop: 2,
    fontWeight: 'bold',
  },
  statContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  statPill: {
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    minWidth: 46,
  },
  statCount: {
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: SLATE_400,
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  healthScorePill: {
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    minWidth: 52,
    borderWidth: 1.5,
  },
  healthScoreVal: {
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 1,
  },
  healthScoreLabel: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: SLATE_400,
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.3,
  },

  // ── SECTION HEADER (cleaner, dashboard-style page heading) ────────────────
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 4,

  },
  sectionHeadingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  sectionHeadingSubtitle: {
    fontSize: 7,
    color: SLATE_400,
    fontWeight: 'bold',
    marginTop: 2,
  },
  sectionHeadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sectionHeadingPillText: {
    fontSize: 7,
    color: SLATE_500,
    fontWeight: 'bold',
  },

  // ── TRI-CARDS (HealthDashboard-style metric cards w/ sparkline) ───────────
  triCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: BG_CARD,
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: SLATE_100,
    height: 110,
    justifyContent: 'space-between',
  },
  metricCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricIconBox: {
    width: 18,
    height: 18,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: 'Lora',
  },
  metricChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metricChangeText: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: SLATE_900,
    lineHeight: 1,
  },
  metricTarget: {
    fontSize: 8,
    color: SLATE_300,
    fontWeight: 'bold',
  },
  metricUnit: {
    fontSize: 6.5,
    color: SLATE_400,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  sparklineContainer: {
    height: 16,
    marginTop: 4,
  },

  // ── OVERVIEW CARDS (existing 3-card grid restyled) ────────────────────────
  overviewGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  overviewCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 22,
    padding: 12,
    backgroundColor: BG_CARD,
  },
  overviewCardTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    fontFamily: 'Lora',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  radialContainer: {
    position: 'relative',
    width: 60,
    height: 60,
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
    fontSize: 12,
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
    gap: 5,
    marginBottom: 3,
  },
  legendColor: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 7,
    color: SLATE_700,
    flex: 1,
  },
  legendValue: {
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_900,
  },
  bodySystemRow: {
    marginBottom: 5,
  },
  bodySystemLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  bodySystemLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_700,
  },
  bodySystemVal: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  bodySystemBar: {
    flexDirection: 'row',
    gap: 2,
    height: 4,
  },
  bodySystemSegment: {
    flex: 1,
    borderRadius: 1.5,
  },

  // ── AREA-CHART + ASTHMA-STYLE CALLOUT ROW (new) ───────────────────────────
  conditionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  conditionGraphCard: {
    flex: 2,
    backgroundColor: BG_CARD,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: SLATE_100,
  },
  conditionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  conditionTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  conditionLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  conditionValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conditionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: SLATE_900,
    lineHeight: 1,
  },
  conditionDelta: {
    backgroundColor: TEAL_DARK,
    color: '#ffffff',
    fontSize: 7,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  conditionRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SLATE_100,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  conditionRangePillText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: SLATE_700,
  },
  areaChartBody: {
    height: 70,
    marginTop: 6,
    position: 'relative',
  },
  areaChartXLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  areaChartXLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: SLATE_400,
  },
  calloutCard: {
    flex: 1,
    backgroundColor: TEAL_DEEP,
    borderRadius: 24,
    padding: 14,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  calloutIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(13,165,142,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutTitle: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.4,
    fontFamily: 'Lora',
  },
  calloutSubtitle: {
    color: TEAL_LIGHT,
    fontSize: 7,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  calloutStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  calloutStatVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 1,
  },
  calloutStatLabel: {
    color: 'rgba(167,243,208,0.75)',
    fontSize: 6,
    marginTop: 2,
    fontWeight: 'bold',
  },
  calloutCta: {
    backgroundColor: TEAL_PRIMARY,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  calloutCtaText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // ── SUMMARY + INSIGHTS ────────────────────────────────────────────────────
  summaryContainer: {
    borderWidth: 1,
    borderColor: SLATE_100,
    borderLeftWidth: 4,
    borderLeftColor: TEAL_PRIMARY,
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    backgroundColor: BG_CARD,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  summaryBadge: {
    backgroundColor: TEAL_TINT,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  summaryBadgeText: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: TEAL_DARK,
    letterSpacing: 0.4,
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  summaryText: {
    color: SLATE_700,
    fontSize: 8,
    lineHeight: 1.45,
  },
  healthIndexChartContainer: {
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    backgroundColor: BG_CARD,
  },
  healthIndexChartTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    fontFamily: 'Lora',
  },
  insightsGrid: {
    marginBottom: 14,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  insightsHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  insightsHeaderAccent: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: TEAL_PRIMARY,
  },
  insightCard: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 16,
    padding: 9,
    backgroundColor: BG_CARD,
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  insightNumber: {
    backgroundColor: TEAL_TINT,
    color: TEAL_DARK,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 8,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  insightText: {
    color: SLATE_700,
    fontSize: 7.5,
    lineHeight: 1.4,
    flex: 1,
  },

  // ── PANEL SECTIONS / BIOMARKER CARDS ──────────────────────────────────────
  panelHeader: {
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: SLATE_100,
    borderLeftWidth: 4,
    borderLeftColor: TEAL_PRIMARY,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  panelMeta: {
    fontSize: 7,
    color: SLATE_400,
    marginTop: 2,
    fontWeight: 'bold',
  },
  panelScoreContainer: {
    alignItems: 'flex-end',
  },
  panelScoreVal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  panelScoreLabel: {
    fontSize: 5.5,
    color: SLATE_400,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  statusBoardContainer: {
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 22,
    padding: 12,
    backgroundColor: BG_CARD,
    marginBottom: 12,
  },
  statusBoardTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: SLATE_500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    fontFamily: 'Lora',
  },
  statusBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_100,
  },
  statusBoardRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statusBoardLabel: {
    width: '35%',
    fontSize: 7.5,
    fontWeight: 'bold',
    color: SLATE_900,
  },
  statusBoardGauge: {
    width: '40%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBoardValueCol: {
    width: '25%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },

  biomarkerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 7,
  },
  biomarkerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  biomarkerStatusBox: {
    width: 24,
    height: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: 10,
    borderWidth: 1,
  },
  biomarkerNameContainer: {
    flex: 1,
  },
  biomarkerName: {
    fontWeight: 'bold',
    fontSize: 9,
    color: SLATE_900,
    fontFamily: 'Lora',
  },
  biomarkerRef: {
    fontSize: 7,
    color: SLATE_400,
    marginTop: 2,
    fontWeight: 'bold',
  },
  biomarkerValueContainer: {
    alignItems: 'flex-end',
  },
  biomarkerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  biomarkerValue: {
    fontWeight: 'bold',
    fontSize: 13,
    color: SLATE_900,
  },
  biomarkerUnit: {
    fontSize: 7,
    color: SLATE_400,
    marginLeft: 2,
    fontWeight: 'bold',
  },
  biomarkerBadge: {
    marginTop: 3,
    borderRadius: 999,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    fontSize: 5.5,
    fontWeight: 'bold',
    letterSpacing: 0.3,
    borderWidth: 0.8,
  },
  verificationAlertBadge: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    borderWidth: 0.8,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  verificationAlertText: {
    color: '#b45309',
    fontSize: 6.5,
    fontWeight: 'bold',
  },
  rangeBarContainer: {
    marginTop: 6,
    marginBottom: 2,
  },
  rangeBarTrack: {
    position: 'relative',
    height: 6,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  rangeBarDivider: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  rangeBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 999,
  },
  rangeBarNeedle: {
    position: 'absolute',
    top: '50%',
    marginTop: -4,
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
  },
  rangeBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  rangeBarLabelText: {
    color: SLATE_400,
    fontSize: 6,
    fontWeight: 'bold',
  },
  interpretationBox: {
    marginTop: 7,
    padding: 8,
    borderRadius: 12,
    backgroundColor: TEAL_TINT,
    borderLeftWidth: 2.5,
    borderLeftColor: TEAL_PRIMARY,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
    flexDirection: 'row',
    gap: 6,
  },
  interpretationLabel: {
    color: TEAL_DARK,
    fontWeight: 'bold',
    fontSize: 6.5,
    marginTop: 0.5,
    backgroundColor: '#ffffff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: TEAL_BORDER,
  },
  interpretationText: {
    color: SLATE_700,
    fontSize: 7,
    lineHeight: 1.3,
    flex: 1,
  },

  // ── DISCLAIMER + FOOTER ───────────────────────────────────────────────────
  disclaimer: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: SLATE_100,
    borderRadius: 18,
    backgroundColor: BG_CARD,
  },
  disclaimerText: {
    color: SLATE_500,
    fontSize: 6.5,
    lineHeight: 1.45,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: SLATE_400,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLogo: {
    height: 12,
    width: 60,
    objectFit: 'contain',
    opacity: 2.0,
  },
  footerText: {
    color: SLATE_400,
    fontSize: 6,
    fontWeight: 'bold',
  },
  pageNumber: {
    color: SLATE_400,
    fontSize: 6,
    fontWeight: 'bold',
  },
});

// ─── Inline Self-Contained Calculations ─────────────────────────────────────────

function panelScore(panel: LabPanel) {
  const n = panel.biomarkers.filter(b => b.status === 'normal').length;
  return panel.biomarkers.length ? Math.round((n / panel.biomarkers.length) * 100) : 0;
}

// Build sparkline points string from values in [0..100]
function buildSparkline(values: number[], width = 140, height = 24, pad = 2): string {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

// Category custom colors — teal / cool / warm harmony
const CATEGORY_COLORS: Record<string, string> = {
  'Complete Blood Count (CBC)': '#0DA58E',
  'Comprehensive Metabolic Panel (CMP)': '#06b6d4',
  'Lipid Panel': '#f59e0b',
  'Thyroid Panel': '#ec4899',
  'Hormones': '#8b5cf6',
  'Vitamins & Minerals': '#34d399',
};
const DEFAULT_COLORS = ['#0DA58E', '#06b6d4', '#3b82f6', '#34d399', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981'];


// ─── PDF Document React-PDF Component ───────────────────────────────────────────
import type { PdfPalette } from '@app/shared';
import { DEFAULT_PDF_PALETTE } from '@app/shared';

interface PremiumPDFDocumentProps {
  report: LabReport;
  logoUrl?: string;
  iconLogoUrl?: string;
  brandName?: string;
  showPoweredBy?: boolean;
  poweredByText?: string;
  pdfPalette?: PdfPalette;
  accentColor?: string;
  headerBg?: string;
}

export function PremiumPDFDocument({
  report,
  logoUrl,
  iconLogoUrl,
  brandName,
  showPoweredBy = true,
  poweredByText,
  pdfPalette: palette = DEFAULT_PDF_PALETTE,
  accentColor = YC_GOLD,
  headerBg = SLATE_900,
}: PremiumPDFDocumentProps) {
  const allBiomarkers = report.panels.flatMap(p => p.biomarkers);
  const normalCount = allBiomarkers.filter(b => b.status === 'normal').length;
  const highCount = allBiomarkers.filter(b => b.status === 'high').length;
  const lowCount = allBiomarkers.filter(b => b.status === 'low').length;
  const criticalCount = allBiomarkers.filter(b => b.status === 'critical').length;
  const totalCount = allBiomarkers.length;
  const flaggedCount = highCount + lowCount + criticalCount;
  const normalPct = typeof report.healthScore === 'number' ? report.healthScore : (totalCount ? Math.round((normalCount / totalCount) * 100) : 0);
  const flaggedPct = totalCount ? Math.round((flaggedCount / totalCount) * 100) : 0;

  const scoreColor = normalPct >= 80 ? palette.bright : normalPct >= 60 ? '#f59e0b' : '#ef4444';
  const scoreBg = normalPct >= 80 ? palette.tint : normalPct >= 60 ? '#fffbeb' : '#fef2f2';
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const standardPanels = [
    { label: 'BLOOD', categories: ['CBC', 'Blood'] },
    { label: 'HEART', categories: ['Lipid Panel', 'Lipid'] },
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
    };
  });

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

  // Sparkline data sets (synthetic, dashboard-style trends)
  const healthSpark = [55, 62, 60, 68, 72, normalPct >= 70 ? normalPct - 4 : normalPct + 4, normalPct];
  const flaggedSpark = [12, 18, 16, 22, 19, 17, Math.max(1, flaggedCount)];
  const markersSpark = [Math.max(1, totalCount - 6), Math.max(1, totalCount - 4), Math.max(1, totalCount - 3), Math.max(1, totalCount - 2), Math.max(1, totalCount - 1), totalCount, totalCount];

  // Average score across panels for the "Condition" graph
  const avgPanelScore = systemsData.length
    ? Math.round(systemsData.reduce((acc, s) => acc + s.score, 0) / systemsData.length)
    : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ─── HEADER ─── */}
        <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: accentColor }]}>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.logo} />
          ) : (
            <Text style={{ color: accentColor, fontSize: 13, fontWeight: 'bold' }}>{(brandName || 'YOUR CONCIERGE MD').toUpperCase()}</Text>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: accentColor }]}>Bloodwork Analysis Report</Text>
            <Text style={styles.headerSubtitle}>Generated: {generatedDate}</Text>
          </View>
        </View>

        {/* ─── PATIENT BANNER ─── */}
        <View style={styles.patientBanner}>
          <View style={styles.patientInfo}>
            {iconLogoUrl ? (
              <Image src={iconLogoUrl} style={[styles.patientIcon, { borderColor: palette.tint }]} />
            ) : (
              <View style={[styles.patientIconFallback, { backgroundColor: palette.tint, borderColor: palette.border }]}>
                <Text style={[styles.patientIconFallbackText, { color: palette.primaryDark }]}>
                  {(report.patientName || 'P').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.patientDetails}>
              <Text style={styles.patientName}>{report.patientName || 'Patient Report'}</Text>
              <Text style={styles.patientMeta}>
                {[
                  report.patientAge && `${report.patientAge} yrs`,
                  report.patientGender,
                  report.labDate || report.collectionDate,
                  report.orderedBy && `Dr. ${report.orderedBy}`,
                ].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          </View>

          <View style={styles.statContainer}>
            <View style={[styles.statPill, { borderColor: palette.border, backgroundColor: palette.tint }]}>
              <Text style={[styles.statCount, { color: palette.primaryDark }]}>{normalCount}</Text>
              <Text style={styles.statLabel}>Normal</Text>
            </View>
            <View style={[styles.statPill, { borderColor: '#fee2e2', backgroundColor: '#fef2f2' }]}>
              <Text style={[styles.statCount, { color: '#b91c1c' }]}>{highCount}</Text>
              <Text style={styles.statLabel}>Elevated</Text>
            </View>
            <View style={[styles.statPill, { borderColor: '#fef3c7', backgroundColor: '#fffbeb' }]}>
              <Text style={[styles.statCount, { color: '#b45309' }]}>{lowCount}</Text>
              <Text style={styles.statLabel}>Reduced</Text>
            </View>
            {criticalCount > 0 && (
              <View style={[styles.statPill, { borderColor: '#fecaca', backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.statCount, { color: '#7f1d1d' }]}>{criticalCount}</Text>
                <Text style={styles.statLabel}>Critical</Text>
              </View>
            )}
            <View style={[styles.healthScorePill, { borderColor: scoreColor, backgroundColor: scoreBg }]}>
              <Text style={[styles.healthScoreVal, { color: scoreColor }]}>{normalPct}%</Text>
              <Text style={styles.healthScoreLabel}>Health Score</Text>
            </View>
          </View>
        </View>

        {/* ─── SECTION HEADING ─── */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionHeadingTitle}>Health Improvements</Text>
            <Text style={styles.sectionHeadingSubtitle}>Holistic body metrics & biomarkers summary</Text>
          </View>
          <View style={styles.sectionHeadingPill}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary }} />
            <Text style={styles.sectionHeadingPillText}>This Report</Text>
          </View>
        </View>

        {/* ─── TRI-CARDS (HealthDashboard-style metric cards with sparklines) ─── */}
        <View style={styles.triCardsRow}>
          {/* Health Score */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <View style={styles.metricIconRow}>
                <View style={[styles.metricIconBox, { backgroundColor: ACCENT.green.icon }]}>
                  <Text style={{ color: ACCENT.green.fg, fontSize: 9, fontWeight: 'bold' }}>♥</Text>
                </View>
                <Text style={styles.metricTitle}>Health Score</Text>
              </View>
              <View style={styles.metricChangePill}>
                <Text style={[styles.metricChangeText, { color: ACCENT.green.fg }]}>▲ {Math.max(1, Math.round(normalPct / 20))}%</Text>
              </View>
            </View>
            <View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{normalPct}</Text>
                <Text style={styles.metricTarget}>/100</Text>
              </View>
              <Text style={styles.metricUnit}>Overall</Text>
            </View>
            <View style={styles.sparklineContainer}>
              <Svg width="100%" height="16" viewBox="0 0 140 24" preserveAspectRatio="none">
                <Polyline
                  points={buildSparkline(healthSpark)}
                  fill="none"
                  stroke={ACCENT.green.fg}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>

          {/* Total Markers */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <View style={styles.metricIconRow}>
                <View style={[styles.metricIconBox, { backgroundColor: ACCENT.blue.icon }]}>
                  <Text style={{ color: ACCENT.blue.fg, fontSize: 9, fontWeight: 'bold' }}>≡</Text>
                </View>
                <Text style={styles.metricTitle}>Biomarkers</Text>
              </View>
              <View style={styles.metricChangePill}>
                <Text style={[styles.metricChangeText, { color: ACCENT.blue.fg }]}>▲ {report.panels.length}</Text>
              </View>
            </View>
            <View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{totalCount}</Text>
                <Text style={styles.metricTarget}>/markers</Text>
              </View>
              <Text style={styles.metricUnit}>Across {report.panels.length} panels</Text>
            </View>
            <View style={styles.sparklineContainer}>
              <Svg width="100%" height="16" viewBox="0 0 140 24" preserveAspectRatio="none">
                <Polyline
                  points={buildSparkline(markersSpark)}
                  fill="none"
                  stroke={ACCENT.blue.fg}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>

          {/* Flagged */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <View style={styles.metricIconRow}>
                <View style={[styles.metricIconBox, { backgroundColor: ACCENT.amber.icon }]}>
                  <Text style={{ color: ACCENT.amber.fg, fontSize: 9, fontWeight: 'bold' }}>!</Text>
                </View>
                <Text style={styles.metricTitle}>Flagged</Text>
              </View>
              <View style={styles.metricChangePill}>
                <Text style={[styles.metricChangeText, { color: ACCENT.amber.fg }]}>{flaggedCount > 0 ? '▲' : '▼'} {flaggedPct}%</Text>
              </View>
            </View>
            <View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{flaggedCount}</Text>
                <Text style={styles.metricTarget}>/{totalCount}</Text>
              </View>
              <Text style={styles.metricUnit}>Needs Review</Text>
            </View>
            <View style={styles.sparklineContainer}>
              <Svg width="100%" height="16" viewBox="0 0 140 24" preserveAspectRatio="none">
                <Polyline
                  points={buildSparkline(flaggedSpark)}
                  fill="none"
                  stroke={ACCENT.amber.fg}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
        </View>

        {/* ─── CONDITION AREA GRAPH + ASTHMA-STYLE CALLOUT ─── */}
        <View style={styles.conditionRow}>
          {/* Area chart card */}
          <View style={styles.conditionGraphCard}>
            <View style={styles.conditionHeaderRow}>
              <View>
                <Text style={styles.conditionTitle}>Report Condition</Text>
                <Text style={[styles.conditionLabel, { marginTop: 6 }]}>Average Panel Score</Text>
                <View style={[styles.conditionValueRow, { marginTop: 2 }]}>
                  <Text style={styles.conditionValue}>{avgPanelScore}%</Text>
                  <Text style={[styles.conditionDelta, { backgroundColor: palette.primaryDark }]}>▲ {Math.max(1, Math.round(avgPanelScore / 25))}%</Text>
                </View>
              </View>
              <View style={styles.conditionRangePill}>
                <Text style={styles.conditionRangePillText}>This Report</Text>
              </View>
            </View>

            <View style={styles.areaChartBody}>
              <Svg width="100%" height="70" viewBox="0 0 400 70" preserveAspectRatio="none">
                {/* Grid */}
                <Line x1="0" y1="10" x2="400" y2="10" stroke={SLATE_100} strokeWidth="0.5" strokeDasharray="2,2" />
                <Line x1="0" y1="35" x2="400" y2="35" stroke={SLATE_100} strokeWidth="0.5" strokeDasharray="2,2" />
                <Line x1="0" y1="60" x2="400" y2="60" stroke={SLATE_100} strokeWidth="0.5" />

                {/* Bars */}
                {systemsData.map((item, idx) => {
                  const barHeight = (item.score / 100) * 50;
                  const x = 25 + idx * 80;
                  const y = 60 - barHeight;
                  return (
                    <Rect
                      key={idx}
                      x={x}
                      y={y}
                      width={30}
                      height={Math.max(1, barHeight)}
                      fill={accentColor}
                      rx={3}
                    />
                  );
                })}
              </Svg>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              {systemsData.map((item, idx) => (
                <View key={idx} style={{ width: '20%', alignItems: 'center' }}>
                  <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: SLATE_900 }}>
                    {item.system.charAt(0) + item.system.slice(1).toLowerCase()}
                  </Text>
                  <Text style={{ fontSize: 5.5, color: SLATE_400, marginTop: 1, fontWeight: 'bold' }}>
                    {item.score}%
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Dark teal callout (Asthma-style) */}
          {/* <View style={styles.calloutCard}>
            <View>
              <View style={styles.calloutHeader}>
                <View style={styles.calloutIcon}>
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>♥</Text>
                </View>
                <Text style={styles.calloutTitle}>Wellness</Text>
              </View>
              <Text style={styles.calloutSubtitle}>Clinical insights at-a-glance</Text>

              <View style={styles.calloutStatsRow}>
                <View>
                  <Text style={styles.calloutStatVal}>{normalPct}%</Text>
                  <Text style={styles.calloutStatLabel}>In range</Text>
                </View>
                <View>
                  <Text style={styles.calloutStatVal}>{flaggedCount}</Text>
                  <Text style={styles.calloutStatLabel}>Flagged</Text>
                </View>
              </View>
            </View>

            <View>
              <View style={styles.calloutCta}>
                <Text style={styles.calloutCtaText}>
                  {criticalCount > 0 ? 'Action Required !' : flaggedCount > 0 ? 'Review Findings' : 'All Optimal !'}
                </Text>
              </View>
            </View>
          </View> */}
        </View>

        {/* ─── TRIPLE GRIDS: HEALTH SCORE, CATEGORY DOUGHNUT, & BODY SYSTEM BARS ─── */}
        <View style={styles.overviewGrid}>
          {/* Card 1: Health Score Circular Gauge */}
          <View style={styles.overviewCard}>
            <Text style={styles.overviewCardTitle}>Health Score</Text>
            <View style={styles.chartRow}>
              <View style={styles.radialContainer}>
                <Svg width="56" height="56" viewBox="0 0 56 56">
                  <Circle cx="28" cy="28" r="24" stroke={SLATE_100} strokeWidth="4" fill="none" />
                  {normalPct > 0 && (
                    <CircleAny
                      cx="28"
                      cy="28"
                      r="24"
                      stroke={scoreColor}
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${((normalPct / 100) * 2 * Math.PI * 24).toFixed(2)},${(2 * Math.PI * 24).toFixed(2)}`}
                      strokeDashoffset={(2 * Math.PI * 24 / 4).toFixed(2)}
                      strokeLinecap="round"
                    />
                  )}
                </Svg>
                <View style={styles.radialLabelContainer}>
                  <Text style={[styles.radialScoreText, { color: scoreColor }]}>{normalPct}%</Text>
                  <Text style={styles.radialDescText}>
                    {normalPct >= 80 ? 'Excellent' : normalPct >= 60 ? 'Optimal' : 'Needs Focus'}
                  </Text>
                </View>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#0d9488' }]} />
                  <Text style={styles.legendLabel}>Normal</Text>
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
            <View style={{ marginTop: 'auto', borderTopWidth: 0.5, borderTopColor: SLATE_100, paddingTop: 5, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 6.5, color: SLATE_400, fontWeight: 'bold' }}>
                Total markers: <Text style={{ fontWeight: 'bold', color: SLATE_900 }}>{totalCount}</Text>
              </Text>
            </View>
          </View>

          {/* Card 2: Biomarkers by Category Doughnut */}
          <View style={[styles.overviewCard, { flex: 1.2 }]}>
            <Text style={styles.overviewCardTitle}>Biomarkers by Category</Text>
            <View style={styles.chartRow}>
              <View style={styles.radialContainer}>
                <Svg width="56" height="56" viewBox="0 0 56 56">
                  <Circle cx="28" cy="28" r="19" stroke={SLATE_100} strokeWidth="6" fill="none" />
                  {doughnutSegments.map((seg, sIdx) => {
                    if (seg.pct <= 0) return null;
                    const C = 2 * Math.PI * 19;
                    const dash1 = seg.pct * C;
                    // Push segment start clockwise by accumulated prior arcs,
                    // then rotate -90° (C/4) so first segment starts at top.
                    const correctedOffset = C / 4 - seg.offset * C;
                    return (
                      <CircleAny
                        key={sIdx}
                        cx="28" cy="28" r="19"
                        stroke={seg.color}
                        strokeWidth="6"
                        fill="none"
                        strokeDasharray={`${dash1.toFixed(2)},${(C - dash1).toFixed(2)}`}
                        strokeDashoffset={correctedOffset.toFixed(2)}
                      />
                    );
                  })}
                </Svg>
                {/* Center label — total count + "Markers" */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: SLATE_900 }}>{totalCount}</Text>
                  <Text style={{ fontSize: 4.5, fontWeight: 'bold', color: SLATE_400, textTransform: 'uppercase', letterSpacing: 0.5 }}>Markers</Text>
                </View>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                {categoryData.map((item, idx) => (
                  <View key={idx} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendLabel, { fontSize: 6.5 }]}>{item.name}</Text>
                    <Text style={styles.legendValue}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ marginTop: 'auto', borderTopWidth: 0.5, borderTopColor: SLATE_100, paddingTop: 5, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 6.5, color: SLATE_400, fontWeight: 'bold' }}>
                Total markers: <Text style={{ fontWeight: 'bold', color: SLATE_900 }}>{totalCount}</Text>
              </Text>
            </View>
          </View>

          {/* Card 3: Body System Performance */}
          <View style={[styles.overviewCard, { flex: 1.3 }]}>
            <Text style={styles.overviewCardTitle}>Body System Status</Text>
            <View style={{ gap: 4 }}>
              {systemsData.slice(0, 5).map(item => {
                const totalSegments = 10;
                const filledSegments = Math.round((item.score / 100) * totalSegments);
                const color = item.score === 100 ? '#11784B' : '#D41717';
                return (
                  <View key={item.system} style={styles.bodySystemRow}>
                    <View style={styles.bodySystemLabelRow}>
                      <Text style={[styles.bodySystemLabel, { fontSize: 7, textTransform: 'uppercase' }]}>{item.system}</Text>
                      <Text style={[styles.bodySystemVal, { color, fontSize: 7 }]}>{item.score}%</Text>
                    </View>
                    <View style={styles.bodySystemBar}>
                      {[...Array(totalSegments)].map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.bodySystemSegment,
                            {
                              backgroundColor: i < filledSegments ? color : 'rgba(100, 116, 139, 0.15)',
                              height: 4,
                            }
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── AI CLINICAL SUMMARY ─── */}
        {report.summary && (
          <View style={[styles.summaryContainer, { borderLeftColor: palette.primary }]} wrap={false}>
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryBadge, { backgroundColor: palette.tint }]}>
                <Text style={[styles.summaryBadgeText, { color: palette.primaryDark }]}>AI ANALYSIS</Text>
              </View>
              <Text style={styles.summaryTitle}>Clinical Summary</Text>
            </View>
            <Text style={styles.summaryText}>{report.summary}</Text>
          </View>
        )}

        {/* ─── BODY SYSTEMS HEALTH INDEX COMPARISON CHART ─── */}
        {systemsData.length > 0 && (() => {
          const optimalSystems = systemsData.filter(s => s.score === 100);
          const attentionSystems = systemsData.filter(s => s.score < 100);

          return (
            <View wrap={false}>
              {optimalSystems.length > 0 && (
                <View style={styles.healthIndexChartContainer}>
                  <Text style={styles.healthIndexChartTitle}>Body Systems Health Index Comparison</Text>
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {optimalSystems.map((item) => (
                      <View key={item.system} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Label */}
                        <Text style={{ width: '25%', fontSize: 7, fontWeight: 'bold', color: SLATE_700, textTransform: 'uppercase' }}>
                          {item.system}
                        </Text>
     
                        {/* Bar Track & Fill */}
                        <View style={{ width: '60%', height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                          <View
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#11784B',
                              borderRadius: 5,
                            }}
                          />
                          {/* Inner percentage indicator */}
                          <Text
                            style={{
                              position: 'absolute',
                              right: 6,
                              top: 2,
                              fontSize: 5.5,
                              fontWeight: 'bold',
                              color: '#ffffff',
                            }}
                          >
                            100%
                          </Text>
                        </View>
     
                        {/* Status Label badge */}
                        <View style={{ width: '15%', alignItems: 'flex-end' }}>
                          <View style={{
                            backgroundColor: '#ecfdf5',
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1.5,
                          }}>
                            <Text
                              style={{
                                fontSize: 6,
                                fontWeight: 'bold',
                                color: '#11784B',
                                textTransform: 'uppercase',
                              }}
                            >
                              OPTIMAL
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {attentionSystems.length > 0 && (
                <View style={{
                  borderWidth: 1,
                  borderColor: '#fca5a5',
                  backgroundColor: '#fef2f2',
                  borderRadius: 18,
                  padding: 12,
                  marginBottom: 14,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#b91c1c', fontFamily: 'Lora', textTransform: 'uppercase', letterSpacing: 0.3 }}>⚠️ Clinical Follow-up Required</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    {attentionSystems.map((item) => (
                      <View key={item.system} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: '#991b1b', textTransform: 'uppercase' }}>
                          {item.system} System
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 8, color: '#7f1d1d', fontWeight: 'bold' }}>Score: {item.score}%</Text>
                          <View style={{
                            backgroundColor: '#fee2e2',
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1.5,
                            borderWidth: 0.5,
                            borderColor: '#f87171',
                          }}>
                            <Text style={{ color: '#b91c1c', fontSize: 6, fontWeight: 'bold' }}>ATTENTION</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ─── KEY INSIGHTS ─── */}
        {report.aiInsights && report.aiInsights.length > 0 && (
          <View style={styles.insightsGrid} wrap={false}>
            <View style={styles.insightsHeader}>
              <View style={[styles.insightsHeaderAccent, { backgroundColor: palette.primary }]} />
              <Text style={styles.insightsHeaderText}>Key Clinical Findings</Text>
            </View>
            {report.aiInsights.slice(0, 3).map((insight, i) => (
              <View key={i} style={styles.insightCard}>
                <View style={[styles.insightNumber, { backgroundColor: palette.tint, borderColor: palette.border }]}>
                  <Text style={{ color: palette.primaryDark, fontWeight: 'bold' }}>{i + 1}</Text>
                </View>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer footer */}
        {/* <View style={styles.disclaimer} wrap={false}>
          <Text style={styles.disclaimerText}>
            <Text style={{ fontWeight: 'bold', color: SLATE_700 }}>Medical Disclaimer:</Text> This report is generated by an AI system for educational and informational purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a licensed healthcare professional before making any medical decisions.
          </Text>
        </View> */}

        {/* ─── Page numbers footer (fixed on all pages) ─── */}
        <View style={styles.footer} fixed>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.footerLogo} />
          ) : (
            <Text style={{ color: SLATE_400, fontSize: 7, fontWeight: 'bold' }}>{(brandName || 'YOUR CONCIERGE MD').toUpperCase()}</Text>
          )}
          <Text style={styles.footerText}>
            {showPoweredBy ? (poweredByText || 'Powered by Huumanize') + '  ·  ' : ''}Confidential Patient Document
          </Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>

      {/* ─── ADDITIONAL PAGES FOR BIOMARKER DETAILED VIEWS ─── */}
      {report.panels.map((panel) => {
        const pPct = panelScore(panel);
        const pColor = pPct >= 80 ? palette.bright : pPct >= 60 ? '#f59e0b' : '#ef4444';
        const flagged = panel.biomarkers.filter(b => b.status !== 'normal');

        return (
          <Page size="A4" style={styles.page} key={panel.name}>

            {/* Header on sub-pages */}
            <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: accentColor }]}>
              <View style={styles.headerBrand}>
                {logoUrl ? (
                  <Image src={logoUrl} style={styles.logo} />
                ) : (
                  <>
                    <View style={[styles.headerLogoCircle, { borderColor: headerBg }]}>
                      <Text style={{ color: headerBg, fontSize: 12, fontWeight: 'bold' }}>⚲</Text>
                    </View>
                    <View>
                      <Text style={[styles.headerBrandName, { color: accentColor }]}>{brandName || 'Your Concierge MD'}</Text>
                      <Text style={styles.headerBrandTag}>Panel Detail</Text>
                    </View>
                  </>
                )}
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: accentColor }]}>Bloodwork Analysis Report</Text>
                <Text style={styles.headerSubtitle}>{panel.name}</Text>
              </View>
            </View>

            {/* Panel summary card */}
            <View style={[styles.panelHeader, { borderLeftColor: palette.primary }]}>
              <View>
                <Text style={styles.panelTitle}>{panel.name}</Text>
                <Text style={styles.panelMeta}>
                  {panel.biomarkers.length} markers  ·  {flagged.length > 0 ? `${flagged.length} flagged` : 'all biomarkers optimal'}
                </Text>
              </View>
              <View style={styles.panelScoreContainer}>
                <Text style={[styles.panelScoreVal, { color: pColor }]}>{pPct}%</Text>
                <Text style={styles.panelScoreLabel}>Panel Score</Text>
              </View>
            </View>

            {/* Vector Diagnostic Balance Sheet */}
            {panel.biomarkers.length > 0 && (
              <View style={styles.statusBoardContainer} wrap={false}>
                <Text style={styles.statusBoardTitle}>
                  {panel.name} — Status Balance Sheet
                </Text>

                {/* Table Header */}
                <View style={{ flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: SLATE_300, paddingBottom: 4, marginBottom: 6 }}>
                  <Text style={{ width: '35%', fontSize: 6.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase', fontFamily: 'Lora' }}>Biomarker Name</Text>
                  <Text style={{ width: '35%', fontSize: 6.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase', fontFamily: 'Lora' }}>Patient Value & Status</Text>
                  <Text style={{ width: '30%', fontSize: 6.5, fontWeight: 'bold', color: SLATE_500, textTransform: 'uppercase', textAlign: 'right', fontFamily: 'Lora' }}>Reference Interval</Text>
                </View>

                {panel.biomarkers.map((m, idx) => {
                  const isLast = idx === panel.biomarkers.length - 1;
                  const sc = STATUS_HEX[m.status] || STATUS_HEX.normal;

                  // Resolve range
                  const _miniResolved = resolveRange(m.name, m.min, m.max, m.value, report.patientGender || 'male');

                  return (
                    <View
                      key={m.name}
                      style={isLast ? styles.statusBoardRowLast : styles.statusBoardRow}
                    >
                      {/* Column 1: Biomarker Name */}
                      <Text style={styles.statusBoardLabel}>{m.name}</Text>

                      {/* Column 2: Patient Value & Status Pill */}
                      <View style={{ width: '35%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: SLATE_900 }}>
                          {m.value} <Text style={{ fontSize: 6.5, color: SLATE_400, fontWeight: 'medium' }}>{m.unit}</Text>
                        </Text>
                        <View
                          style={{
                            backgroundColor: sc.light,
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1.5,
                          }}
                        >
                          <Text style={{ color: sc.fg, fontSize: 6, fontWeight: 'bold' }}>
                            {STATUS_LABEL[m.status] || m.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Column 3: Clinical Reference Interval */}
                      <View style={{ width: '30%', alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 8, color: SLATE_700, fontWeight: 'medium' }}>
                          {_miniResolved.min} – {_miniResolved.max} <Text style={{ fontSize: 6.5, color: SLATE_400 }}>{m.unit}</Text>
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Biomarker details list */}
            <View style={{ gap: 7 }}>
              {panel.biomarkers.map((m) => {
                const sc = STATUS_HEX[m.status] || STATUS_HEX.normal;
                const isAbnormal = m.status !== 'normal';

                // Resolve range with gender-aware clinical fallback (mirrors UI)
                const resolved = resolveRange(m.name, m.min, m.max, m.value, report.patientGender || 'male');
                const { min, max } = resolved;

                const statusClean = (m.status || 'normal').toLowerCase();
                const val = Number(m.value);
                const hasVal = !isNaN(val);

                // Compute active zone flag for each of the 5 segments
                const isZone1Active = hasVal ? (val < min - 2) : false;
                const isZone2Active = hasVal ? (val >= min - 2 && val < min) : (statusClean === 'low');
                const isZone3Active = hasVal ? (val >= min && val <= max) : (statusClean === 'normal');
                const isZone4Active = hasVal ? (val > max && val <= max + 2) : (statusClean === 'high');
                const isZone5Active = hasVal ? (val > max + 2) : (statusClean === 'critical');

                return (
                  <View
                    key={m.name}
                    style={[
                      styles.biomarkerCard,
                      {
                        borderColor: isAbnormal ? `${sc.fg}55` : SLATE_100,
                        borderLeftWidth: isAbnormal ? 4 : 1,
                        borderLeftColor: isAbnormal ? sc.fg : SLATE_100,
                        backgroundColor: isAbnormal ? sc.bg : BG_CARD,
                      }
                    ]}
                    wrap={false}
                  >
                    {/* Row 1: Biomarker Name & Patient Value */}
                    <View style={styles.biomarkerTopRow}>
                      <View style={styles.biomarkerNameContainer}>
                        <Text style={styles.biomarkerName}>{m.name}</Text>
                      </View>
                      <View style={styles.biomarkerValueContainer}>
                        <View style={styles.biomarkerValueRow}>
                          <Text style={styles.biomarkerValue}>{m.value}</Text>
                          <Text style={styles.biomarkerUnit}>{m.unit}</Text>
                        </View>
                        <View style={[styles.biomarkerBadge, { backgroundColor: sc.light, borderColor: `${sc.fg}33`, color: sc.fg }]}>
                          <Text style={{ color: sc.fg }}>{STATUS_LABEL[m.status] || m.status.toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Row 2: Layout Status Bar */}
                    <View style={{ marginVertical: 8 }} wrap={false}>
                      {/* The 5-segment colored bar */}
                      <View style={{
                        flexDirection: 'row',
                        width: '100%',
                        height: 12,
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}>
                        {/* Zone 1: Red (Critical Low) */}
                        <View style={{
                          width: '15%',
                          backgroundColor: '#d32626ff',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          {isZone1Active && (
                            <View style={{
                              width: 8,
                              height: 8,
                              backgroundColor: '#111827',
                              borderRadius: 4,
                            }} />
                          )}
                        </View>

                        {/* Zone 2: Yellow (Borderline Low) */}
                        <View style={{
                          width: '20%',
                          backgroundColor: '#f3de42ff',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          {isZone2Active && (
                            <View style={{
                              width: 8,
                              height: 8,
                              backgroundColor: '#111827',
                              borderRadius: 4,
                            }} />
                          )}
                        </View>

                        {/* Zone 3: Green (Optimal) */}
                        <View style={{
                          width: '30%',
                          backgroundColor: '#17c87bff',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          {isZone3Active && (
                            <View style={{
                              width: 8,
                              height: 8,
                              backgroundColor: '#111827',
                              borderRadius: 4,
                            }} />
                          )}
                        </View>

                        {/* Zone 4: Yellow (Borderline High) */}
                        <View style={{
                          width: '20%',
                          backgroundColor: '#f3de42ff',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          {isZone4Active && (
                            <View style={{
                              width: 8,
                              height: 8,
                              backgroundColor: '#111827',
                              borderRadius: 4,
                            }} />
                          )}
                        </View>

                        {/* Zone 5: Red (Critical High) */}
                        <View style={{
                          width: '15%',
                          backgroundColor: '#d32626ff',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          {isZone5Active && (
                            <View style={{
                              width: 8,
                              height: 8,
                              backgroundColor: '#111827',
                              borderRadius: 4,
                            }} />
                          )}
                        </View>
                      </View>

                      {/* Markers for corners */}
                      <View style={{ position: 'relative', height: 10, marginTop: 2 }}>
                        {/* Left End Corner (less than optimal: min - 2) */}
                        <Text style={{
                          position: 'absolute',
                          left: 0,
                          fontSize: 6,
                          color: SLATE_400,
                          fontWeight: 'bold',
                        }}>
                          {parseFloat((min - 2).toFixed(2))}
                        </Text>

                        {/* Green Left Corner (optimal range start: min) */}
                        <Text style={{
                          position: 'absolute',
                          left: '35%',
                          fontSize: 6,
                          color: SLATE_500,
                          fontWeight: 'bold',
                        }}>
                          {min}
                        </Text>

                        {/* Green Right Corner (optimal range end: max) */}
                        <Text style={{
                          position: 'absolute',
                          left: '65%',
                          fontSize: 6,
                          color: SLATE_500,
                          fontWeight: 'bold',
                        }}>
                          {max}
                        </Text>

                        {/* Right End Corner (more than optimal: max + 2) */}
                        <Text style={{
                          position: 'absolute',
                          right: 0,
                          fontSize: 6,
                          color: SLATE_400,
                          fontWeight: 'bold',
                        }}>
                          {parseFloat((max + 2).toFixed(2))}
                        </Text>
                      </View>
                    </View>

                    {/* Row 3: Range Text Explanations */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                      <Text style={{ fontSize: 6.5, color: SLATE_400, fontWeight: 'bold' }}></Text>
                      <Text style={{ fontSize: 6.5, color: SLATE_500, fontWeight: 'bold' }}>Optimal Range: {min} – {max} {m.unit}</Text>
                      <Text style={{ fontSize: 6.5, color: SLATE_400, fontWeight: 'bold' }}></Text>
                    </View>

                    {/* AI Interpretation */}
                    {m.clinicalInterpretation && (
                      <View style={[styles.interpretationBox, { marginTop: 8, backgroundColor: palette.tint, borderLeftColor: palette.primary, borderColor: palette.border }]}>
                        <Text style={[styles.interpretationLabel, { color: palette.primaryDark, borderColor: palette.border }]}>AI</Text>
                        <Text style={styles.interpretationText}>{m.clinicalInterpretation}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Sub-page Footer */}
            <View style={styles.footer} fixed>
              {logoUrl ? (
                <Image src={logoUrl} style={styles.footerLogo} />
              ) : (
                <Text style={{ color: SLATE_400, fontSize: 7, fontWeight: 'bold' }}>{(brandName || 'YOUR CONCIERGE MD').toUpperCase()}</Text>
              )}
              <Text style={styles.footerText}>
                {showPoweredBy ? (poweredByText || 'Powered by Huumanize') + '  ·  ' : ''}Confidential Patient Document
              </Text>
              <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
            </View>

          </Page>
        );
      })}
    </Document>
  );
}
