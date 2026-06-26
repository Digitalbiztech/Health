/**
 * PDF Palette Builder — derives a full 7-tone color palette from a single base hex.
 * Used by PremiumPDFDocument to dynamically theme PDF reports per-tenant.
 */

export interface PdfPalette {
  primary: string;      // Base color — buttons, CTA, borders
  primaryDark: string;   // Darkened 20% — strong headings, delta badges
  primaryDeep: string;   // Darkened 35% — callout card backgrounds
  bright: string;        // Lightened 10% — sparklines, score indicators
  light: string;         // Lightened 55% — soft fills, callout subtitles
  tint: string;          // Lightened 80% — card tints, badge backgrounds
  border: string;        // Lightened 70% — soft borders, dividers
}

// ─── Hex ↔ HSL Conversion Helpers ────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let hue = 0;
  switch (max) {
    case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: hue = ((b - r) / d + 2) / 6; break;
    case b: hue = ((r - g) / d + 4) / 6; break;
  }

  return [hue, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const v = Math.round(Math.min(255, Math.max(0, c * 255)));
    return v.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function adjustLightness(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(1, Math.max(0, l + amount)));
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Build a full 7-tone PDF palette from a single base hex color.
 *
 * @param baseHex - The brand primary hex (e.g. '#0DA58E')
 * @returns A PdfPalette with primary, dark, deep, bright, light, tint, and border tones.
 */
export function buildPdfPalette(baseHex: string): PdfPalette {
  return {
    primary: baseHex,
    primaryDark: adjustLightness(baseHex, -0.12),
    primaryDeep: adjustLightness(baseHex, -0.20),
    bright: adjustLightness(baseHex, 0.08),
    light: adjustLightness(baseHex, 0.38),
    tint: adjustLightness(baseHex, 0.52),
    border: adjustLightness(baseHex, 0.45),
  };
}

/** Default teal palette matching the original hardcoded colors. */
export const DEFAULT_PDF_PALETTE: PdfPalette = buildPdfPalette('#0DA58E');
