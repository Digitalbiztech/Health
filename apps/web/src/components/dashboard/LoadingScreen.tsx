import { Dna, FileText, Activity, Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  currentFileName: string;
}

export function LoadingScreen({ currentFileName }: LoadingScreenProps) {
  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center px-6">
      <div className="relative w-36 h-36 flex items-center justify-center mb-8">
        {/* Animated orb */}
        <div
          className="absolute inset-0 rounded-full border-4 border-dashed border-[var(--primary)]/40 animate-spin"
          style={{ animationDuration: '6s' }}
        />
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center animate-pulse-glow"
          style={{
            background: 'linear-gradient(135deg, var(--primary-glow), rgba(184, 168, 154, 0.2))',
            boxShadow: '0 0 25px rgba(212, 189, 173, 0.4)',
          }}
        >
          <Dna className="w-10 h-10 animate-float" style={{ color: 'var(--primary-text)' }} />
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
        Analyzing Your Lab Results
      </h3>
      <p className="text-sm mb-8 text-center max-w-sm" style={{ color: 'var(--muted-foreground)' }}>
        File: <span className="font-semibold text-[var(--primary-text)]">{currentFileName}</span>
      </p>

      {/* 3 Staggered Processing Steps */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        {[
          { label: 'Extracting biomarkers', icon: FileText, delay: 0 },
          { label: 'Calculating ranges', icon: Activity, delay: 0.2 },
          { label: 'Generating insights', icon: Sparkles, delay: 0.4 },
        ].map((step) => (
          <div
            key={step.label}
            className="glass-card rounded-xl p-4 flex items-center justify-between border-border/40 shadow-sm"
            style={{
              animation: 'fade-in-up 0.5s ease-out forwards',
              animationDelay: `${step.delay}s`,
              opacity: 0,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--primary-glow)' }}
              >
                <step.icon className="w-4 h-4" style={{ color: 'var(--primary-text)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {step.label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
              <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
