import { ShieldAlert, RotateCcw } from 'lucide-react';

interface ErrorScreenProps {
  errorMessage: string;
  onTryAgain: () => void;
}

export function ErrorScreen({ errorMessage, onTryAgain }: ErrorScreenProps) {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(212, 23, 23, 0.1)' }}
      >
        <ShieldAlert className="w-8 h-8 text-[#D41717]" />
      </div>

      <h3 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--foreground)' }}>
        Analysis Failed
      </h3>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        {errorMessage || 'Secure optical extraction server failed to classify the report contents.'}
      </p>

      <button
        onClick={onTryAgain}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all shadow-md hover:scale-[1.02] cursor-pointer"
        style={{ background: 'var(--primary-text)' }}
      >
        <RotateCcw className="w-4 h-4" />
        Try Again
      </button>
    </main>
  );
}
