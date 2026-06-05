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
      <div
        className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 animate-fade-in-up animate-float overflow-hidden border border-border/20 shadow-lg bg-card"
      >
        <img
          src="/logo/040523 YC LogoDeck_Main-FC.jpg"
          alt="Auriem Logo"
          className="w-24 h-24 "
        />
      </div>

      <h2
        className="text-3xl font-bold tracking-tight mb-2 animate-fade-in-up"
        style={{ color: 'var(--foreground)', animationDelay: '0.05s' }}
      >
        Analyze Your Lab Results
      </h2>
      <p
        className="text-base mb-10 max-w-md animate-fade-in-up"
        style={{ color: 'var(--muted-foreground)', animationDelay: '0.1s' }}
      >
        Upload your blood work report and get AI-powered insights, biomarker visualization, and personalized health recommendations.
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
          "w-full min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 p-8 transition-all duration-300 cursor-pointer group animate-fade-in-up",
          isDragging ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-border hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]"
        )}
        style={{ animationDelay: '0.15s' }}
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
          className="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ background: 'var(--primary-glow)' }}
        >
          {uploading ? (
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--primary-text)' }} />
          ) : (
            <Upload className="w-7 h-7" style={{ color: 'var(--primary-text)' }} />
          )}
        </div>
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
            {uploading ? 'Uploading and securing report buffer...' : 'Drop your lab report here or click to browse'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            PDF only · Max 20MB
          </p>
        </div>
        <span
          className="px-4 py-2 rounded-lg text-sm font-medium pointer-events-none transition-all"
          style={{
            background: 'var(--primary-text)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Choose File
        </span>
      </div>

      {/* Feature Grid */}
      <div
        className="grid grid-cols-3 gap-4 w-full mt-12 animate-fade-in-up"
        style={{ animationDelay: '0.2s' }}
      >
        {[
          {
            icon: FileText,
            title: 'All Panels',
            color: 'var(--primary)',
            section: 'panels',
          },
          {
            icon: Activity,
            title: 'Visual Ranges',
            color: 'var(--status-normal)',
            section: 'ranges',
          },
          {
            icon: Lightbulb,
            title: 'AI Insights',
            color: 'var(--primary-text)',
            section: 'insights',
          },
        ].map((feature, i) => (
          <button
            key={feature.title}
            onClick={() => onNavigateToDashboard?.(feature.section)}
            className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 transition-all duration-200 hover:shadow-lg hover:bg-border/20 active:scale-[0.98] cursor-pointer border-0 bg-transparent"
            style={{ animationDelay: `${0.2 + i * 0.04}s` }}
          >
            <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              {feature.title}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
