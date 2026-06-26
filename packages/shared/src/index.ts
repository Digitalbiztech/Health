export interface TenantBranding {
  // Identity
  brandName: string;
  tagline: string | null;
  poweredByText: string;
  
  // Logo URLs
  logoMainUrl: string | null;
  logoIconUrl: string | null;
  logoLetterformUrl: string | null;
  faviconUrl: string | null;
  
  // Color Palette (HSL strings without parens)
  colors: {
    light: {
      primary: string;
      primaryForeground: string;
      primaryText: string;
      primaryGlow: string;
      accent: string;
    };
    dark: {
      primary: string;
      primaryForeground: string;
      primaryText: string;
      accent: string;
    };
  };
  
  // PDF
  pdf: {
    primaryColor: string; // hex — base color for auto-derived palette
    accentColor: string;  // hex
    headerBg: string;     // hex
    themePreset: string;
  };
  
  // Feature flags
  showPoweredBy: boolean;
  fontFamily: string | null;
}

export const DEFAULT_BRANDING: TenantBranding = {
  brandName: 'Health Dashboard',
  tagline: 'AI-Powered Clinical Insights',
  poweredByText: 'POWERED BY HUUMANIZE',
  logoMainUrl: '/logo/041323 YC LogoDeck_Main-WG copy.png',
  logoIconUrl: '/logo/040523 YC LogoDeck_Icon-GS.jpg',
  logoLetterformUrl: '/logo/YC_Letterform_WG.png',
  faviconUrl: '/favicon.svg',
  colors: {
    light: {
      primary: '25 31% 75%',
      primaryForeground: '0 0% 100%',
      primaryText: '25 20% 48%',
      primaryGlow: '25 31% 75%',
      accent: '30 11% 69%',
    },
    dark: {
      primary: '27 15% 49%',
      primaryForeground: '0 0% 100%',
      primaryText: '27 25% 65%',
      accent: '30 11% 45%',
    },
  },
  pdf: {
    primaryColor: '#0DA58E',
    accentColor: '#D4BDAD',
    headerBg: '#1f2937',
    themePreset: 'warm-gold',
  },
  showPoweredBy: true,
  fontFamily: null,
};

export { buildPdfPalette, DEFAULT_PDF_PALETTE } from './pdfPalette.js';
export type { PdfPalette } from './pdfPalette.js';
