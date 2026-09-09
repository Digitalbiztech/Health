# Comprehensive Replication Guide: Previous 8 Local Commits

This document provides an exact, step-by-step blueprint of all code changes, bug fixes, UI improvements, and asset updates made across the last 8 local commits on branch `master`. You can replicate these changes identically into another project repository.

---

## 1. Commit Log Summary

| # | Commit SHA | Summary |
|---|------------|---------|
| **1** | `6cf4e41` | `fix(web): uncrop biomarker slider indicators and fix JSX syntax in ClinicianDashboard` |
| **2** | `7b683f9` | `fix(pdf): refine patient banner layout, align tri-card icons and badges, and soften slider color scheme` |
| **3** | `a2af8c1` | `fix(pdf): overhaul export PDF layout, range logic, and clinical actionability per fix.md` |
| **4** | `8e462cd` | `fix(pdf): resolve font resolution error for Inter italic and standardize numeric fontWeights` |
| **5** | `89443d8` | `fix(pdf): add compact inline range sliders to all biomarkers and desaturate slider colors per fix.md` |
| **6** | `2a4f8e9` | `fix(pdf): resolve glyph corruption, remove slider scale flanking numbers, and prevent orphan headers per fix.md round 3` |
| **7** | `bd1e66c` | `fix(pdf): resolve decimal drop, restore upper reference bounds, fix slider positions, restore 5-tier scale, and enhance logo contrast per fix.md round 4` |
| **8** | `24346fe` | `fix(pdf): render all panels in Panels Distribution legend in dual columns per fix.md round 5` |

---

## 2. File-by-File Changes

---

### File 1: `apps/web/src/components/dashboard/ClinicianDashboard.tsx`

#### A. Fix JSX syntax error
- **Problem**: Unexpected token / parser error at line ~845 (`{}}` syntax issue inside mapping block).
- **Fix**: Corrected block nesting and closing braces.

#### B. Fix Cropped Biomarker Slider Indicator Pin
- **Problem**: In the Biomarker Breakdown section, the needle indicator circle (`w-3 h-3`) was rendered inside an `overflow-hidden` container with `-top-[3px]`, causing the top and bottom half of the circle to be sliced off / cropped by the parent's boundaries.
- **Fix**:
  - Separate the track (which has `overflow-hidden` and rounded corners) from the indicator pin.
  - Wrap both in an outer `relative` wrapper.
  - Position the indicator pin with `top-[3px] -translate-y-1/2` and `z-10 pointer-events-none`.
  - Clamp percentage between 2% and 98% with `Math.max(2, Math.min(98, pct))`.

```tsx
// BEFORE (Cropped):
<div className="relative h-1.5 rounded-full bg-border/30 flex overflow-hidden">
  <div className="h-full w-[25%] bg-status-low/20" />
  <div className="h-full w-[50%] bg-status-normal/20" />
  <div className="h-full w-[25%] bg-status-high/20" />
  <div className="absolute w-3 h-3 -top-[3px] rounded-full border border-white shadow" style={{ left: `calc(${pct}% - 6px)`, background: color }} />
</div>

// AFTER (Uncropped):
<div className="relative">
  <div className="relative h-1.5 rounded-full bg-border/30 flex overflow-hidden">
    <div className="h-full w-[25%] bg-status-low/20" />
    <div className="h-full w-[50%] bg-status-normal/20" />
    <div className="h-full w-[25%] bg-status-high/20" />
  </div>
  <div
    className="absolute w-3 h-3 top-[3px] -translate-y-1/2 rounded-full border border-white shadow pointer-events-none z-10"
    style={{ left: `calc(${Math.max(2, Math.min(98, pct))}% - 6px)`, background: color }}
  />
</div>
```

---

### File 2: `apps/web/src/components/dashboard/ReportDashboard.tsx`

#### Apply Same Indicator Pin Uncrop Fix to ReportDashboard
- Applied identical fix in two places (expanded detail and mini compact card):
```tsx
// In ReportDashboard.tsx slider rendering:
const clampedPct = Math.max(2, Math.min(98, effectivePct));

<div className="relative pb-3.5">
  <div className="relative h-2 rounded-full overflow-hidden bg-border/40 flex">
    {track.leftPct > 0 && <div className="h-full" style={{ width: `${track.leftPct}%`, background: track.leftColor }} />}
    {track.midPct > 0 && <div className="h-full border-x border-border/40" style={{ width: `${track.midPct}%`, background: track.midColor }} />}
    {track.rightPct > 0 && <div className="h-full" style={{ width: `${track.rightPct}%`, background: track.rightColor }} />}
  </div>
  <div
    className="absolute w-3.5 h-3.5 top-1 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-all duration-500 z-10 pointer-events-none"
    style={{ left: `calc(${clampedPct}% - 7px)`, background: colors.text }}
  />
  ...
</div>
```

---

### File 3: `apps/web/src/pages/Guide.tsx`

- Same slider uncrop fix applied to the interactive demo slider in `Guide.tsx`:
```tsx
<div className="relative">
  <div className="relative h-2 rounded-full bg-muted flex overflow-hidden">
    <div className="w-[15%] h-full bg-red-500/35" title="Critical Low" />
    <div className="w-[15%] h-full bg-amber-500/35" title="Deficient" />
    <div className="w-[45%] h-full bg-emerald-500/35" title="Normal" />
    <div className="w-[25%] h-full bg-red-500/35" title="High" />
  </div>
  <div
    className={cn(
      'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-300 pointer-events-none z-10',
      ...
    )}
    style={{ left: `calc(${sliderValue}% - 8px)` }}
  />
</div>
```

---

### File 4: `apps/web/src/components/PremiumPDFDocument.tsx`

This file contains the core PDF generation engine built with `@react-pdf/renderer`. The key architectural and visual updates include:

#### 1. React import compatibility
Ensure both Vite bundler mode (`jsx: "react-jsx"`, `noUnusedLocals: true`) and Node/tsx execution succeed without `TS6133` or `ReferenceError: React is not defined`:
```ts
import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image, Svg, Circle, Line, Polyline } from '@react-pdf/renderer';
import type { LabReport, LabPanel } from '@/types/lab';

void React;
```

#### 2. Inter Italic Font Registration
Fixed `@react-pdf/renderer` runtime crash: `Could not resolve font for Inter, fontWeight 400, fontStyle italic`:
```ts
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-italic.woff', fontWeight: 400, fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.woff', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff', fontWeight: 700 },
  ],
});
```

#### 3. Unicode Glyph Corruption Prevention & Vector Status Icons
- Non-ASCII characters (`≥`, `≤`, `₂`, `✓`, `▲`, `▼`, `→`, `’`, `⚠️`, `⚲`) corrupt inside `@react-pdf/renderer` standard fonts.
- Implemented `sanitizeText` and dedicated SVG `<StatusIcon>`:
```ts
export function sanitizeText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/₂/g, '2')
    .replace(/₁/g, '1')
    .replace(/₃/g, '3')
    .replace(/₄/g, '4')
    .replace(/≥/g, '>= ')
    .replace(/≤/g, '<= ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/•/g, '·')
    .replace(/[✓▲▼→⚠️⚲]/g, '')
    .trim();
}

function StatusIcon({ status, color }: { status: string; color: string }) {
  switch (status) {
    case 'normal':
      return (
        <Svg width="5.5" height="5.5" viewBox="0 0 10 10">
          <Polyline points="1.5,5.5 4,8 8.5,2.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'high':
      return (
        <Svg width="5" height="5" viewBox="0 0 8 8">
          <Polyline points="4,1.5 7.5,6.5 0.5,6.5" fill={color} />
        </Svg>
      );
    case 'low':
      return (
        <Svg width="5" height="5" viewBox="0 0 8 8">
          <Polyline points="0.5,1.5 7.5,1.5 4,6.5" fill={color} />
        </Svg>
      );
    case 'critical':
      return (
        <Svg width="5.5" height="5.5" viewBox="0 0 8 8">
          <Circle cx="4" cy="4" r="3.5" fill={color} />
          <Line x1="4" y1="2" x2="4" y2="4.5" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
          <Circle cx="4" cy="6" r="0.6" fill="#ffffff" />
        </Svg>
      );
    default:
      return (
        <Svg width="4" height="4" viewBox="0 0 6 6">
          <Circle cx="3" cy="3" r="2" fill={color} />
        </Svg>
      );
  }
}
```

#### 4. Decimal Value Formatting Helper
Ensures decimals never drop when stringifying or formatting values:
```ts
export function formatBiomarkerValue(val: any): string {
  if (val === null || val === undefined || val === '') return '-';
  const str = String(val).trim();
  const num = Number(str);
  if (!isNaN(num)) {
    if (Number.isInteger(num)) return num.toString();
    return parseFloat(num.toFixed(4)).toString();
  }
  return str;
}
```

#### 5. Restored 5-Tier Color Scale Tokens
```ts
const BAR_ZONE = {
  veryLow: '#FED7AA',   // Soft muted peach/amber (very low)
  low: '#FEF08A',       // Soft muted warm yellow (low)
  optimal: '#A7F3D0',   // Soft muted sage/mint (moderate / optimal)
  high: '#FECDD3',      // Soft muted pastel rose (high)
  veryHigh: '#FCA5A5',  // Soft muted coral/red (very high)
  trackBg: '#F1F5F9',   // Calm neutral base
};
```

#### 6. Panel Name Shortener and Expanded Category Colors
```ts
export function formatPanelShortName(name?: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.includes('CBC') || trimmed.toLowerCase() === 'complete blood count') return 'CBC';
  if (trimmed.includes('CMP') || trimmed.toLowerCase() === 'comprehensive metabolic panel') return 'CMP';
  return trimmed
    .replace(/\s+Panel$/i, '')
    .replace(/\s*&\s*Minerals$/i, '')
    .trim();
}

const CATEGORY_COLORS: Record<string, string> = {
  'Complete Blood Count (CBC)': '#0DA58E',
  'CBC': '#0DA58E',
  'Comprehensive Metabolic Panel (CMP)': '#06b6d4',
  'CMP': '#06b6d4',
  'Lipid Panel': '#f59e0b',
  'Lipid': '#f59e0b',
  'Diabetes': '#3b82f6',
  'Kidney': '#06b6d4',
  'Electrolytes': '#10b981',
  'Liver': '#ec4899',
  'Thyroid Panel': '#8b5cf6',
  'Thyroid': '#8b5cf6',
  'Hormones': '#6366f1',
  'Vitamins & Minerals': '#34d399',
  'Vitamins': '#34d399',
  'Cardiac': '#ef4444',
  'Inflammation': '#f97316',
  'Iron Studies': '#a855f7',
  'Pancreatic': '#14b8a6',
};
const DEFAULT_COLORS = ['#0DA58E', '#f59e0b', '#3b82f6', '#06b6d4', '#10b981', '#ec4899', '#8b5cf6', '#6366f1', '#34d399', '#ef4444'];
```

#### 7. Reference Range Resolver (`resolveBiomarkerRange`)
- Coerces `value` using `Number(value)` so string decimals (`"57.6"`) don't fall back to `0`.
- Protects two-sided ranges (Total Testosterone `250 - 827`, Bioavailable Testosterone `110 - 575`) from open-ended misclassification.
- Enforces strictly non-negative `displayMin >= 0` so scales never display negative numbers (e.g. `-2`).
- Accurately maps slider dot position across 5 zones:
```ts
export function resolveBiomarkerRange(
  name: string,
  minVal: any,
  maxVal: any,
  value: any,
  _gender: string
): ResolvedBiomarkerRange {
  const numMin = (minVal !== null && minVal !== undefined && minVal !== '') ? Number(minVal) : NaN;
  const numMax = (maxVal !== null && maxVal !== undefined && maxVal !== '') ? Number(maxVal) : NaN;
  const hasMin = !isNaN(numMin);
  const hasMax = !isNaN(numMax);

  const numVal = (value !== null && value !== undefined && value !== '') ? Number(value) : NaN;
  const val = !isNaN(numVal) ? numVal : 0;

  const nameLower = (name || '').toLowerCase();
  const isExplicitGreaterThan =
    nameLower.includes('egfr') ||
    (nameLower.includes('hdl') && !nameLower.includes('ratio')) ||
    nameLower.includes('vitamin d');

  const isSentinelMax = !hasMax || numMax <= 0 || (isExplicitGreaterThan && numMax >= 900);

  // Case 1: Greater-than only (e.g. HDL > 40, eGFR > 60)
  if (hasMin && numMin > 0 && isSentinelMax) {
    const optimalMin = numMin;
    const span = Math.max(optimalMin, 20);
    const displayMax = Math.max(optimalMin + span, val * 1.25);

    let pct = 35;
    if (val < optimalMin) {
      pct = Math.max(5, (val / optimalMin) * 35);
    } else {
      const excess = val - optimalMin;
      const room = Math.max(displayMax - optimalMin, 1);
      pct = 35 + Math.min(60, (excess / room) * 60);
    }

    return {
      type: 'greater_than',
      min: optimalMin,
      max: null,
      displayMin: 0,
      displayMax: parseFloat(displayMax.toFixed(1)),
      optimalMin,
      optimalMax: Infinity,
      optimalText: `> ${formatBiomarkerValue(optimalMin)}`,
      pct: Math.min(95, Math.max(5, pct)),
    };
  }

  // Case 2: Less-than only (e.g. Triglycerides < 150, LDL < 100, HbA1c < 5.7)
  if (hasMax && numMax > 0 && (!hasMin || numMin <= 0)) {
    const optimalMax = numMax;
    const buffer = optimalMax * 0.4;
    const displayMax = Math.max(optimalMax + buffer, val * 1.15);

    let pct = 40;
    if (val <= optimalMax) {
      pct = Math.max(5, (val / optimalMax) * 60);
    } else {
      const excess = val - optimalMax;
      const room = Math.max(displayMax - optimalMax, 0.1);
      pct = 60 + Math.min(35, (excess / room) * 35);
    }

    return {
      type: 'less_than',
      min: null,
      max: optimalMax,
      displayMin: 0,
      displayMax: parseFloat(displayMax.toFixed(1)),
      optimalMin: 0,
      optimalMax,
      optimalText: `< ${formatBiomarkerValue(optimalMax)}`,
      pct: Math.min(95, Math.max(5, pct)),
    };
  }

  // Case 3: Two-sided bounded (Total Testosterone 250 - 827, Free Testosterone 46 - 224, WBC 4.5 - 11.0)
  const min = hasMin ? Math.max(0, numMin) : 0;
  const max = hasMax ? numMax : (val > 0 ? val * 1.5 : 100);
  const span = Math.max(max - min, 0.1);
  const buffer = span * 0.4;
  const displayMin = Math.max(0, parseFloat((min - buffer).toFixed(2))); // Strictly non-negative!
  const displayMax = parseFloat((max + buffer).toFixed(2));

  let pct = 50;
  if (val < min) {
    const under = Math.max(min - displayMin, 0.1);
    const underRatio = Math.max(0, (val - displayMin) / under);
    pct = 5 + underRatio * 25; // Sits in Very Low (5-15%) & Low (15-30%)
  } else if (val <= max) {
    const ratio = (val - min) / span;
    pct = 30 + ratio * 40; // Sits in Optimal / Moderate (30-70%)
  } else {
    const over = Math.max(displayMax - max, 0.1);
    const overRatio = Math.min(1, Math.max(0, (val - max) / over));
    pct = 70 + overRatio * 25; // Sits in High (70-85%) & Very High (85-95%)
  }

  return {
    type: 'two_sided',
    min,
    max,
    displayMin,
    displayMax,
    optimalMin: min,
    optimalMax: max,
    optimalText: `${formatBiomarkerValue(min)} - ${formatBiomarkerValue(max)}`,
    pct: Math.min(95, Math.max(5, pct)),
  };
}
```

#### 8. Page 1 Executive Summary: Dual-Column "Panels Distribution" Legend
- Slices `categoryData` into two columns if `categoryData.length > 5`.
- Balances `overviewGrid` card widths (`flex: 0.95`, `flex: 1.35`, `flex: 1.15`):
```tsx
const isMultiCol = categoryData.length > 5;
const colMid = isMultiCol ? Math.ceil(categoryData.length / 2) : categoryData.length;
const col1 = categoryData.slice(0, colMid);
const col2 = isMultiCol ? categoryData.slice(colMid) : [];

// In Card 2 JSX:
<View style={[styles.overviewCard, { flex: 1.35 }]}>
  <Text style={styles.overviewCardTitle}>Panels Distribution</Text>
  <View style={styles.chartRow}>
    <View style={styles.radialContainer}>
      <Svg width="48" height="48" viewBox="0 0 48 48">
        <Circle cx="24" cy="24" r="16" stroke={SLATE_100} strokeWidth="5" fill="none" />
        {doughnutSegments.map((seg, sIdx) => {
          if (seg.pct <= 0) return null;
          const C = 2 * Math.PI * 16;
          const dash1 = seg.pct * C;
          const correctedOffset = C / 4 - seg.offset * C;
          return (
            <CircleAny
              key={sIdx}
              cx="24" cy="24" r="16"
              stroke={seg.color}
              strokeWidth="5"
              fill="none"
              strokeDasharray={`${dash1.toFixed(2)},${(C - dash1).toFixed(2)}`}
              strokeDashoffset={correctedOffset.toFixed(2)}
            />
          );
        })}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: SLATE_900 }}>{totalCount}</Text>
        <Text style={{ fontSize: 3.5, fontWeight: 'bold', color: SLATE_400, textTransform: 'uppercase', letterSpacing: 0.3 }}>Markers</Text>
      </View>
    </View>

    {isMultiCol ? (
      <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
        <View style={{ flex: 1, gap: 1.5 }}>
          {col1.map((item, idx) => (
            <View key={idx} style={styles.legendItemCompact}>
              <View style={[styles.legendColorMini, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabelMini}>{item.name}</Text>
              <Text style={styles.legendValueMini}>{item.count}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 1.5 }}>
          {col2.map((item, idx) => (
            <View key={idx} style={styles.legendItemCompact}>
              <View style={[styles.legendColorMini, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabelMini}>{item.name}</Text>
              <Text style={styles.legendValueMini}>{item.count}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : (
      <View style={{ flex: 1, gap: 1.5 }}>
        {categoryData.map((item, idx) => (
          <View key={idx} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.color }]} />
            <Text style={[styles.legendLabel, { fontSize: 6 }]}>{item.name}</Text>
            <Text style={[styles.legendValue, { fontSize: 6 }]}>{item.count}</Text>
          </View>
        ))}
      </View>
    )}
  </View>
</View>
```

#### 9. Compact Normal Table Row with Inline 5-Tier Slider
- Displays clean, uncolliding columns: Name, Range Slider with centered `Ref:` interval, Result, Status badge:
```tsx
<View key={m.name} style={isLast ? styles.compactTableRowLast : styles.compactTableRow}>
  {/* Column 1: Biomarker Name */}
  <Text style={styles.compactColName}>{sanitizeText(m.name)}</Text>

  {/* Column 2: Thin Mini Range Slider with Dot Indicator */}
  <View style={styles.compactColBar}>
    <View style={styles.miniBarTrack}>
      {resolved.type === 'greater_than' ? (
        <>
          <View style={{ width: '15%', backgroundColor: BAR_ZONE.veryLow, height: '100%' }} />
          <View style={{ width: '20%', backgroundColor: BAR_ZONE.low, height: '100%' }} />
          <View style={{ width: '65%', backgroundColor: BAR_ZONE.optimal, height: '100%' }} />
        </>
      ) : resolved.type === 'less_than' ? (
        <>
          <View style={{ width: '60%', backgroundColor: BAR_ZONE.optimal, height: '100%' }} />
          <View style={{ width: '15%', backgroundColor: BAR_ZONE.low, height: '100%' }} />
          <View style={{ width: '13%', backgroundColor: BAR_ZONE.high, height: '100%' }} />
          <View style={{ width: '12%', backgroundColor: BAR_ZONE.veryHigh, height: '100%' }} />
        </>
      ) : (
        <>
          <View style={{ width: '15%', backgroundColor: BAR_ZONE.veryLow, height: '100%' }} />
          <View style={{ width: '15%', backgroundColor: BAR_ZONE.low, height: '100%' }} />
          <View style={{ width: '40%', backgroundColor: BAR_ZONE.optimal, height: '100%' }} />
          <View style={{ width: '15%', backgroundColor: BAR_ZONE.high, height: '100%' }} />
          <View style={{ width: '15%', backgroundColor: BAR_ZONE.veryHigh, height: '100%' }} />
        </>
      )}

      {/* Result needle dot */}
      <View style={[styles.miniBarNeedle, { left: `${resolved.pct}%` }]} />
    </View>

    {/* Range Limits subtext (Centered reference range, no flanking scale bounds) */}
    <View style={styles.miniBarLabels}>
      <Text style={[styles.miniBarLabelText, { color: SLATE_500 }]}>
        Ref: {resolved.optimalText} {m.unit}
      </Text>
    </View>
  </View>

  {/* Column 3: Patient Result Value */}
  <Text style={styles.compactColValue}>
    {formatBiomarkerValue(m.value)} <Text style={{ fontSize: 5.5, color: SLATE_400, fontWeight: 500 }}>{m.unit}</Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    }}>
      <StatusIcon status="normal" color="#0d9488" />
      <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#0d9488' }}>NORMAL</Text>
    </View>
  </View>
</View>
```

#### 10. Prevent Orphan Headers Across Page Breaks
- Added `minPresenceAhead={100}` on `panelHeader`.
- Added `wrap={panel.biomarkers.length > 8}` on `panelSection` and `compactTableContainer`:
```tsx
<View key={panel.name} style={styles.panelSection} wrap={panel.biomarkers.length > 8}>
  <View style={styles.panelHeader} wrap={false} minPresenceAhead={100}>
    ...
  </View>
```

---

### File 5: `apps/web/src/components/dashboard/PDFPreviewModal.tsx`

#### Update fallback logo URL to high-contrast white asset
```tsx
const logoUrl = branding.logoMainUrl
  ? (branding.logoMainUrl.startsWith('http') ? branding.logoMainUrl : window.location.origin + branding.logoMainUrl)
  : window.location.origin + '/logo/YC_Main_White.png';
```

---

### File 6: `apps/web/src/components/dashboard/utils.tsx`

#### Update fallback logo in `exportPDF`
```tsx
const logoUrl = branding?.logoMainUrl
  ? (branding.logoMainUrl.startsWith('http') ? branding.logoMainUrl : window.location.origin + branding.logoMainUrl)
  : window.location.origin + '/logo/YC_Main_White.png';
```

---

### File 7: `packages/shared/src/index.ts`

#### Update default tenant branding configuration
```ts
export const DEFAULT_BRANDING: TenantBranding = {
  brandName: 'Health Dashboard',
  tagline: 'AI-Powered Clinical Insights',
  poweredByText: 'POWERED BY HUUMANIZE',
  logoMainUrl: '/logo/YC_Main_White.png',
  ...
};
```

---

### File 8: `apps/api/src/middleware/authGuard.ts`

#### Update backend default branding seed
```ts
logoMainUrl: '/logo/YC_Main_White.png',
```

---

### File 9: Logo Assets

#### Reversed White Logo for Navy Header
- Located at: `apps/web/public/logo/YC_Main_White.png` (and `apps/web/public/logo/041323 YC LogoDeck_Main-WG copy.png`).
- Converted all non-transparent pixels to pure white `(255, 255, 255)` with preserved alpha channel so that the logo has maximum contrast against the `#0f172a` navy header bar.
- Python Pillow conversion script:
```python
from PIL import Image

im = Image.open('apps/web/public/logo/041323 YC LogoDeck_Main-WG copy.png').convert('RGBA')
r, g, b, a = im.split()
white = Image.new('RGB', im.size, (255, 255, 255))
new_im = Image.merge('RGBA', (*white.split(), a))
new_im.save('apps/web/public/logo/YC_Main_White.png')
new_im.save('apps/web/public/logo/041323 YC LogoDeck_Main-WG copy.png')
```

---

## 3. Verification Checklist for Target Repository

1. **Build & Typecheck**:
   ```bash
   npm --prefix apps/web run build
   ```
   Must succeed with zero TypeScript or Vite bundle errors.

2. **Decimals Audit**:
   Confirm that `57.6` renders as `57.6 pg/mL` (not `576`). Confirm `96.1`, `32.1`, `33.4`, `11.7`, `1.09`, `2.61`, `2.5`, and `2.1` keep their decimals.

3. **Slider Needles**:
   Confirm that slider needles dynamically track each marker's result value across its reference range rather than freezing at 5%.

4. **Reference Intervals**:
   Confirm that Total Testosterone displays `250 - 827 ng/dL` and Bioavailable Testosterone displays `110 - 575 ng/dL` (two-sided bounded).

5. **Panels Distribution Legend**:
   Confirm all 9 panels are visible in the 2-column legend and their individual counts sum exactly to `41 MARKERS`.

6. **Logo Visibility**:
   Confirm the white wordmark logo stands out crisply on the dark navy `#0f172a` header bar on all pages.
