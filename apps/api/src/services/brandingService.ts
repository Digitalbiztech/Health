import { DEFAULT_BRANDING, TenantBranding } from '@app/shared';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

interface CacheEntry {
  data: TenantBranding;
  expiresAt: number;
}

const orgCache = new Map<string, CacheEntry>();
const slugCache = new Map<string, CacheEntry>();

const CACHE_TTL = (global as any).BRANDING_CACHE_TTL_MS || 300_000; // Fallback to 5 minutes

function mapBranding(dbBranding: any): TenantBranding {
  if (!dbBranding) return DEFAULT_BRANDING;
  
  return {
    brandName: dbBranding.brandName,
    tagline: dbBranding.tagline,
    poweredByText: dbBranding.poweredByText,
    logoMainUrl: dbBranding.logoMainUrl,
    logoIconUrl: dbBranding.logoIconUrl,
    logoLetterformUrl: dbBranding.logoLetterformUrl,
    faviconUrl: dbBranding.faviconUrl,
    colors: {
      light: {
        primary: dbBranding.colorPrimary,
        primaryForeground: dbBranding.colorPrimaryForeground,
        primaryText: dbBranding.colorPrimaryText,
        primaryGlow: dbBranding.colorPrimaryGlow,
        accent: dbBranding.colorAccent,
      },
      dark: {
        primary: dbBranding.colorPrimaryDark,
        primaryForeground: dbBranding.colorPrimaryForegroundDark,
        primaryText: dbBranding.colorPrimaryTextDark,
        accent: dbBranding.colorAccentDark,
      },
    },
    pdf: {
      accentColor: dbBranding.pdfAccentColor,
      headerBg: dbBranding.pdfHeaderBg,
      themePreset: dbBranding.pdfThemePreset,
    },
    showPoweredBy: dbBranding.showPoweredBy,
    fontFamily: dbBranding.fontFamily,
  };
}

export const brandingService = {
  async getBrandingByOrgId(orgId: string): Promise<TenantBranding> {
    const cached = orgCache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const dbBranding = await prisma.organizationBranding.findUnique({
      where: { organizationId: orgId },
    });

    const branding = mapBranding(dbBranding);

    orgCache.set(orgId, {
      data: branding,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return branding;
  },

  async getBrandingBySlug(slug: string): Promise<TenantBranding> {
    const cached = slugCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const org = await prisma.organization.findUnique({
      where: { slug },
      include: { branding: true },
    });

    if (!org) {
      return DEFAULT_BRANDING;
    }

    const branding = mapBranding(org.branding);

    slugCache.set(slug, {
      data: branding,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return branding;
  },

  async updateBranding(orgId: string, data: any): Promise<TenantBranding> {
    const dbData: any = {};
    if (data.brandName !== undefined) dbData.brandName = data.brandName;
    if (data.tagline !== undefined) dbData.tagline = data.tagline;
    if (data.poweredByText !== undefined) dbData.poweredByText = data.poweredByText;
    if (data.logoMainUrl !== undefined) dbData.logoMainUrl = data.logoMainUrl;
    if (data.logoIconUrl !== undefined) dbData.logoIconUrl = data.logoIconUrl;
    if (data.logoLetterformUrl !== undefined) dbData.logoLetterformUrl = data.logoLetterformUrl;
    if (data.faviconUrl !== undefined) dbData.faviconUrl = data.faviconUrl;
    
    if (data.colors?.light) {
      if (data.colors.light.primary !== undefined) dbData.colorPrimary = data.colors.light.primary;
      if (data.colors.light.primaryForeground !== undefined) dbData.colorPrimaryForeground = data.colors.light.primaryForeground;
      if (data.colors.light.primaryText !== undefined) dbData.colorPrimaryText = data.colors.light.primaryText;
      if (data.colors.light.primaryGlow !== undefined) dbData.colorPrimaryGlow = data.colors.light.primaryGlow;
      if (data.colors.light.accent !== undefined) dbData.colorAccent = data.colors.light.accent;
    }
    if (data.colors?.dark) {
      if (data.colors.dark.primary !== undefined) dbData.colorPrimaryDark = data.colors.dark.primary;
      if (data.colors.dark.primaryForeground !== undefined) dbData.colorPrimaryForegroundDark = data.colors.dark.primaryForeground;
      if (data.colors.dark.primaryText !== undefined) dbData.colorPrimaryTextDark = data.colors.dark.primaryText;
      if (data.colors.dark.accent !== undefined) dbData.colorAccentDark = data.colors.dark.accent;
    }
    if (data.pdf) {
      if (data.pdf.accentColor !== undefined) dbData.pdfAccentColor = data.pdf.accentColor;
      if (data.pdf.headerBg !== undefined) dbData.pdfHeaderBg = data.pdf.headerBg;
      if (data.pdf.themePreset !== undefined) dbData.pdfThemePreset = data.pdf.themePreset;
    }
    if (data.showPoweredBy !== undefined) dbData.showPoweredBy = data.showPoweredBy;
    if (data.fontFamily !== undefined) dbData.fontFamily = data.fontFamily;

    const dbBranding = await prisma.organizationBranding.upsert({
      where: { organizationId: orgId },
      update: dbData,
      create: {
        ...dbData,
        organizationId: orgId,
      },
    });

    // Clear caches
    orgCache.clear();
    slugCache.clear();

    return mapBranding(dbBranding);
  },
};
