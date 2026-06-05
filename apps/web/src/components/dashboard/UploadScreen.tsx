import type { RefObject } from 'react';
import { Loader2, Upload, FileText, Activity, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadScreenProps {
  uploading: boolean;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  handleFileUpload: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onNavigateToDashboard?: (section?: string) => void;
}

export function UploadScreen({
  uploading,
  isDragging,
  setIsDragging,
  handleFileUpload,
  fileInputRef,
  onNavigateToDashboard,
}: UploadScreenProps) {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col items-center text-center">
      {/* Centered freestanding logo */}
      <div className="mb-8 animate-fade-in-up">
        <img
          src="/logo/041323 YC LogoDeck_Main-WG copy.png"
          alt="Your Concierge MD Logo"
          className="h-28 w-auto object-contain mx-auto"
        />
      </div>

      <p
        className="text-base mb-10 max-w-xl animate-fade-in-up font-medium leading-relaxed"
        style={{ color: 'var(--muted-foreground)', animationDelay: '0.05s' }}
      >
        Upload your bloodwork PDF and get a clean, personalized report with charts, reference ranges, and AI-generated insights — in seconds.
      </p>

      {/* Real Drop & Upload zone */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        accept=".pdf"
        className="hidden"
      />

      <div
        className={cn(
          "w-full min-h-[240px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all duration-300 cursor-pointer group animate-fade-in-up",
          isDragging
            ? "border-[var(--primary)] bg-[var(--primary)]/10"
            : "border-[var(--primary)]/20 hover:border-[var(--primary)]/60 bg-card/10 hover:bg-[var(--primary)]/5"
        )}
        style={{ animationDelay: '0.1s' }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileUpload(file);
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 mb-2"
          style={{ background: 'var(--primary-glow)' }}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary-text)' }} />
          ) : (
            <Upload className="w-6 h-6" style={{ color: 'var(--primary-text)' }} />
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="font-bold text-lg text-foreground">
            {uploading ? 'Uploading and securing report buffer...' : 'Drop lab PDF here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse — PDF only, max 20MB
          </p>
        </div>
        {!uploading && (
          <span
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md pointer-events-none transition-all duration-200"
            style={{
              background: 'var(--primary)',
              boxShadow: 'var(--glow-primary)',
            }}
          >
            <FileText className="w-4 h-4" />
            Select PDF
          </span>
        )}
      </div>

      {/* Feature Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-12 animate-fade-in-up"
        style={{ animationDelay: '0.15s' }}
      >
        {[
          {
            icon: FileText,
            title: 'All Panels',
            iconBg: 'bg-blue-500/10',
            iconColor: 'text-blue-400',
            description: 'CMP, CBC, Lipids, Thyroid & more',
            section: 'panels',
          },
          {
            icon: Activity,
            title: 'Visual Ranges',
            iconBg: 'bg-emerald-500/10',
            iconColor: 'text-emerald-400',
            description: 'See exactly where each value falls',
            section: 'ranges',
          },
          {
            icon: Lightbulb,
            title: 'AI Insights',
            iconBg: 'bg-violet-500/10',
            iconColor: 'text-violet-400',
            description: 'Plain-language explanations',
            section: 'insights',
          },
        ].map((feature, i) => (
          <button
            key={feature.title}
            onClick={() => onNavigateToDashboard?.(feature.section)}
            className="glass-card rounded-2xl p-6 flex flex-col items-center gap-2 transition-all duration-200 hover:shadow-lg hover:bg-border/20 active:scale-[0.98] cursor-pointer border-0 bg-transparent text-center"
            style={{ animationDelay: `${0.15 + i * 0.04}s` }}
          >
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", feature.iconBg, feature.iconColor)}>
              <feature.icon className="w-5 h-5" />
            </div>
            <span
              className="text-base font-bold text-foreground"
            >
              {feature.title}
            </span>
            <span
              className="text-xs text-muted-foreground leading-relaxed max-w-[180px] mx-auto"
            >
              {feature.description}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
