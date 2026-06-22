import React, { createContext, useEffect, useState } from 'react';
import { DEFAULT_BRANDING, type TenantBranding } from '@app/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface BrandingContextType {
  branding: TenantBranding;
  brandingLoaded: boolean;
  refreshBranding: () => Promise<void>;
}

export const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

function getSubdomain(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  if (parts.length <= 1 || hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  return parts[0];
}

function getTenantSlug(): string | null {
  const params = new URLSearchParams(window.location.search);
  const queryTenant = params.get('tenant');
  if (queryTenant) return queryTenant;
  
  return getSubdomain();
}

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState<boolean>(false);

  const fetchBranding = async () => {
    const slug = getTenantSlug();
    if (!slug) {
      setBranding(DEFAULT_BRANDING);
      setBrandingLoaded(true);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/branding/${slug}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch branding: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setBranding(json.data);
      } else {
        setBranding(DEFAULT_BRANDING);
      }
    } catch (err) {
      console.error('Error fetching branding configuration:', err);
      setBranding(DEFAULT_BRANDING);
    } finally {
      setBrandingLoaded(true);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  // Effect to inject CSS variables and handle dark/light mode toggles dynamically
  useEffect(() => {
    if (!brandingLoaded) return;

    const updateColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const palette = isDark ? branding.colors.dark : branding.colors.light;
      const root = document.documentElement;

      root.style.setProperty('--primary', `hsl(${palette.primary})`);
      root.style.setProperty('--primary-foreground', `hsl(${palette.primaryForeground})`);
      root.style.setProperty('--primary-text', `hsl(${palette.primaryText})`);
      root.style.setProperty('--primary-glow', `hsl(${palette.primary} / 0.15)`);
      root.style.setProperty('--accent', `hsl(${palette.accent})`);
      root.style.setProperty('--accent-foreground', isDark ? `hsl(210 30% 96%)` : `hsl(222 28% 12%)`);

      // Extended branding variables for shadows, glows and gradients
      root.style.setProperty('--glow-primary', `0 0 20px hsl(${palette.primary} / 0.3), 0 0 40px hsl(${palette.primary} / 0.1)`);
      root.style.setProperty('--radial-glow-1', `hsl(${palette.primary} / 0.05)`);
      root.style.setProperty('--radial-glow-2', `hsl(${palette.primary} / 0.08)`);
      root.style.setProperty('--radial-accent-glow', `hsl(${palette.accent} / 0.04)`);
      root.style.setProperty('--shadow-brand-20', `0 0 20px hsl(${palette.primary} / 0.2)`);
      root.style.setProperty('--shadow-brand-40', `0 0 40px hsl(${palette.primary} / 0.4)`);
      root.style.setProperty('--shadow-brand-60', `0 0 60px hsl(${palette.primary} / 0.1)`);
    };

    updateColors();

    // Listen for theme transitions (.dark class changes on html element)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          updateColors();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Dynamic document title and favicon override
    if (branding.brandName) {
      document.title = `${branding.brandName} Clinical Suite`;
    }
    
    if (branding.faviconUrl) {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = branding.faviconUrl;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = branding.faviconUrl;
        document.head.appendChild(newLink);
      }
    }

    return () => observer.disconnect();
  }, [branding, brandingLoaded]);

  return (
    <BrandingContext.Provider value={{ branding, brandingLoaded, refreshBranding: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};
