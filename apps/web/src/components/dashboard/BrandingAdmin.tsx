import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Palette, Type, Image, Sun, Moon, FileText, Save, RotateCcw,
  Upload, X, Loader2, ChevronDown, ChevronRight, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBranding } from '@/hooks/useBranding';
import { getBrandingMe, updateBrandingMe, uploadBrandingLogo } from '@/lib/api';
import { DEFAULT_BRANDING, type TenantBranding } from '@app/shared';

// ─── Color Helpers ───────────────────────────────────────────

function hslStringToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return '#888888';
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHslString(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16) / 255;
    g = parseInt(hex.slice(3, 5), 16) / 255;
    b = parseInt(hex.slice(5, 7), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ─── Sub-Components ──────────────────────────────────────────

function SectionHeader({ icon: Icon, title, open, onToggle }: {
  icon: React.ElementType; title: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 py-3 px-1 text-left cursor-pointer bg-transparent border-0 group"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--primary-glow)]">
        <Icon className="w-4 h-4 text-[var(--primary-text)]" />
      </div>
      <span className="text-sm font-bold text-foreground flex-1">{title}</span>
      {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = hslStringToHex(value);
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-foreground w-32 shrink-0">{label}</label>
      <div className="relative">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(hexToHslString(e.target.value))}
          className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5"
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{value}</span>
    </div>
  );
}

function LogoSlot({ label, url, slot, uploading, onUpload, onRemove }: {
  label: string; url: string | null; slot: string;
  uploading: string | null; onUpload: (f: File, s: string) => void; onRemove: (s: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploading === slot;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <div
        className={cn(
          "relative w-full h-28 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all group",
          url ? "border-border bg-card/50" : "border-[var(--primary)]/20 hover:border-[var(--primary)]/50 bg-muted/20"
        )}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f, slot);
            e.target.value = '';
          }}
        />
        {isUploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[var(--primary-text)]" />
        ) : url ? (
          <>
            <img src={url} alt={label} className="max-h-20 max-w-[80%] object-contain" />
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(slot); }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="w-5 h-5" />
            <span className="text-[10px]">Click to upload</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Live Preview ────────────────────────────────────────────

function LivePreview({ draft }: { draft: TenantBranding }) {
  const lightPrimary = `hsl(${draft.colors.light.primary})`;
  const lightText = `hsl(${draft.colors.light.primaryText})`;
  const lightAccent = `hsl(${draft.colors.light.accent})`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <Eye className="w-4 h-4 text-[var(--primary-text)]" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Preview</span>
      </div>

      {/* Header Preview */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
          {draft.logoMainUrl ? (
            <img src={draft.logoMainUrl} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <span className="text-sm font-bold" style={{ color: lightText }}>{draft.brandName}</span>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full" style={{ background: lightPrimary, opacity: 0.3 }} />
            <div className="w-16 h-3 rounded-full bg-border/60" />
          </div>
        </div>
      </div>

      {/* Card Preview */}
      <div className="rounded-xl border border-border p-5 flex flex-col items-center gap-3" style={{ background: 'var(--card)' }}>
        {draft.logoIconUrl ? (
          <img src={draft.logoIconUrl} alt="Icon" className="w-12 h-12 rounded-lg object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: lightPrimary }}>
            {draft.brandName.substring(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-bold" style={{ color: lightText }}>{draft.brandName}</span>
        {draft.tagline && <span className="text-[10px] text-muted-foreground">{draft.tagline}</span>}
        <button className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white border-0 mt-1" style={{ background: lightPrimary }}>
          Sample Button
        </button>
      </div>

      {/* PDF Header Preview */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: draft.pdf.headerBg }}>
          <div className="w-1 h-6 rounded-full" style={{ background: draft.pdf.accentColor }} />
          <span className="text-xs font-bold text-white">{draft.brandName} — PDF Report</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-2 bg-card">
          <div className="h-2 w-20 rounded-full" style={{ background: draft.pdf.accentColor, opacity: 0.5 }} />
          <div className="h-2 w-32 rounded-full bg-border/40" />
        </div>
      </div>

      {/* Footer Preview */}
      {draft.showPoweredBy && (
        <div className="text-center py-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/40">
            {draft.poweredByText}
          </span>
        </div>
      )}

      {/* Color Swatches */}
      <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/30 bg-muted/10">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Palette</span>
        <div className="flex gap-2">
          {[lightPrimary, lightText, lightAccent, draft.pdf.accentColor, draft.pdf.headerBg].map((c, i) => (
            <div key={i} className="w-8 h-8 rounded-lg border border-border shadow-sm" style={{ background: c }} title={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function BrandingAdmin() {
  const { refreshBranding } = useBranding();
  const [draft, setDraft] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [saved, setSaved] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  // Section toggles
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true, logos: true, colorsLight: false, colorsDark: false, pdf: false,
  });
  const toggle = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const loadBranding = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBrandingMe();
      setDraft(data);
      setSaved(data);
    } catch (err) {
      console.error('Failed to load branding:', err);
      toast.error('Failed to load branding configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBranding(); }, [loadBranding]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateBrandingMe(draft);
      setSaved(result);
      setDraft(result);
      await refreshBranding();
      toast.success('Branding saved and applied!');
    } catch (err) {
      console.error('Failed to save branding:', err);
      toast.error('Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      const result = await updateBrandingMe(DEFAULT_BRANDING);
      setSaved(result);
      setDraft(result);
      await refreshBranding();
      toast.success('Branding reset to defaults');
    } catch (err) {
      toast.error('Failed to reset branding');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File, slot: string) => {
    try {
      setUploadingSlot(slot);
      const result = await uploadBrandingLogo(file, slot);
      setDraft(result);
      setSaved(result);
      await refreshBranding();
      toast.success('Logo uploaded!');
    } catch (err) {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleLogoRemove = (slot: string) => {
    const fieldMap: Record<string, keyof TenantBranding> = {
      main: 'logoMainUrl', icon: 'logoIconUrl', letterform: 'logoLetterformUrl', favicon: 'faviconUrl',
    };
    const key = fieldMap[slot];
    if (key) setDraft((d) => ({ ...d, [key]: null }));
  };

  const updateDraft = <K extends keyof TenantBranding>(key: K, value: TenantBranding[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const updateLightColor = (key: string, value: string) => {
    setDraft((d) => ({ ...d, colors: { ...d.colors, light: { ...d.colors.light, [key]: value } } }));
  };

  const updateDarkColor = (key: string, value: string) => {
    setDraft((d) => ({ ...d, colors: { ...d.colors, dark: { ...d.colors.dark, [key]: value } } }));
  };

  const updatePdf = (key: string, value: string) => {
    setDraft((d) => ({ ...d, pdf: { ...d.pdf, [key]: value } }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary-text)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-glow)' }}>
            <Palette className="w-5 h-5 text-[var(--primary-text)]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Brand Configuration</h2>
            <p className="text-[11px] text-muted-foreground">Customize your organization's identity, logos, and color palette</p>
          </div>
        </div>
        {isDirty && (
          <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes
          </span>
        )}
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form (3/5) */}
        <div className="lg:col-span-3 flex flex-col gap-1">
          {/* ── Identity ── */}
          <SectionHeader icon={Type} title="Identity & Text" open={openSections.identity} onToggle={() => toggle('identity')} />
          {openSections.identity && (
            <div className="pl-11 pb-5 flex flex-col gap-4 animate-fade-in">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Brand Name</label>
                <input
                  type="text" value={draft.brandName}
                  onChange={(e) => updateDraft('brandName', e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-border bg-background text-foreground focus:outline-none focus:border-[var(--primary-text)] focus:ring-1 focus:ring-[var(--primary-text)]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Tagline</label>
                <input
                  type="text" value={draft.tagline || ''}
                  onChange={(e) => updateDraft('tagline', e.target.value || null)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-border bg-background text-foreground focus:outline-none focus:border-[var(--primary-text)] focus:ring-1 focus:ring-[var(--primary-text)]"
                  placeholder="e.g., AI-Powered Clinical Insights"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Powered By Text</label>
                <input
                  type="text" value={draft.poweredByText}
                  onChange={(e) => updateDraft('poweredByText', e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-border bg-background text-foreground focus:outline-none focus:border-[var(--primary-text)] focus:ring-1 focus:ring-[var(--primary-text)]"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateDraft('showPoweredBy', !draft.showPoweredBy)}
                  className={cn(
                    "w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer border-0",
                    draft.showPoweredBy ? "bg-[var(--primary-text)]" : "bg-border"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    draft.showPoweredBy ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
                <span className="text-xs text-muted-foreground">Show "Powered By" footer</span>
              </div>
            </div>
          )}

          <hr className="border-border/20" />

          {/* ── Logos ── */}
          <SectionHeader icon={Image} title="Logo Assets" open={openSections.logos} onToggle={() => toggle('logos')} />
          {openSections.logos && (
            <div className="pl-11 pb-5 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <LogoSlot label="Main Logo" url={draft.logoMainUrl} slot="main" uploading={uploadingSlot} onUpload={handleLogoUpload} onRemove={handleLogoRemove} />
                <LogoSlot label="Icon / Square" url={draft.logoIconUrl} slot="icon" uploading={uploadingSlot} onUpload={handleLogoUpload} onRemove={handleLogoRemove} />
                <LogoSlot label="Letterform" url={draft.logoLetterformUrl} slot="letterform" uploading={uploadingSlot} onUpload={handleLogoUpload} onRemove={handleLogoRemove} />
                <LogoSlot label="Favicon" url={draft.faviconUrl} slot="favicon" uploading={uploadingSlot} onUpload={handleLogoUpload} onRemove={handleLogoRemove} />
              </div>
            </div>
          )}

          <hr className="border-border/20" />

          {/* ── Light Colors ── */}
          <SectionHeader icon={Sun} title="Light Mode Colors" open={openSections.colorsLight} onToggle={() => toggle('colorsLight')} />
          {openSections.colorsLight && (
            <div className="pl-11 pb-5 flex flex-col gap-3 animate-fade-in">
              <ColorField label="Primary" value={draft.colors.light.primary} onChange={(v) => updateLightColor('primary', v)} />
              <ColorField label="Primary Foreground" value={draft.colors.light.primaryForeground} onChange={(v) => updateLightColor('primaryForeground', v)} />
              <ColorField label="Primary Text" value={draft.colors.light.primaryText} onChange={(v) => updateLightColor('primaryText', v)} />
              <ColorField label="Primary Glow" value={draft.colors.light.primaryGlow} onChange={(v) => updateLightColor('primaryGlow', v)} />
              <ColorField label="Accent" value={draft.colors.light.accent} onChange={(v) => updateLightColor('accent', v)} />
            </div>
          )}

          <hr className="border-border/20" />

          {/* ── Dark Colors ── */}
          <SectionHeader icon={Moon} title="Dark Mode Colors" open={openSections.colorsDark} onToggle={() => toggle('colorsDark')} />
          {openSections.colorsDark && (
            <div className="pl-11 pb-5 flex flex-col gap-3 animate-fade-in">
              <ColorField label="Primary" value={draft.colors.dark.primary} onChange={(v) => updateDarkColor('primary', v)} />
              <ColorField label="Primary Foreground" value={draft.colors.dark.primaryForeground} onChange={(v) => updateDarkColor('primaryForeground', v)} />
              <ColorField label="Primary Text" value={draft.colors.dark.primaryText} onChange={(v) => updateDarkColor('primaryText', v)} />
              <ColorField label="Accent" value={draft.colors.dark.accent} onChange={(v) => updateDarkColor('accent', v)} />
            </div>
          )}

          <hr className="border-border/20" />

          {/* ── PDF Theme ── */}
          <SectionHeader icon={FileText} title="PDF Theme" open={openSections.pdf} onToggle={() => toggle('pdf')} />
          {openSections.pdf && (
            <div className="pl-11 pb-5 flex flex-col gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground w-32 shrink-0">Accent Color</label>
                <input type="color" value={draft.pdf.accentColor} onChange={(e) => updatePdf('accentColor', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5" />
                <span className="text-[10px] font-mono text-muted-foreground">{draft.pdf.accentColor}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground w-32 shrink-0">Header Background</label>
                <input type="color" value={draft.pdf.headerBg} onChange={(e) => updatePdf('headerBg', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5" />
                <span className="text-[10px] font-mono text-muted-foreground">{draft.pdf.headerBg}</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Theme Preset</label>
                <select
                  value={draft.pdf.themePreset}
                  onChange={(e) => updatePdf('themePreset', e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border border-border bg-background text-foreground cursor-pointer focus:outline-none focus:border-[var(--primary-text)]"
                >
                  <option value="warm-gold">Warm Gold</option>
                  <option value="cool-blue">Cool Blue</option>
                  <option value="emerald">Emerald</option>
                  <option value="slate">Slate</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview (2/5) */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 glass-card rounded-2xl p-5 border border-border/40 shadow-md">
            <LivePreview draft={draft} />
          </div>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-0 z-20 -mx-6 px-6 py-4 flex items-center justify-between gap-4 border-t border-border/40"
        style={{ background: 'color-mix(in srgb, var(--card) 95%, transparent)', backdropFilter: 'blur(12px)' }}>
        <button
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-border hover:bg-border/20 text-muted-foreground hover:text-foreground transition-all cursor-pointer bg-transparent disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer border-0 disabled:opacity-50 hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'var(--primary-text)', boxShadow: 'var(--glow-primary)' }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
