import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { getDashboardPath } from '@/lib/navigation';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="text-center animate-fade-in-up">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(212, 189, 173, 0.1)' }}
        >
          <FileQuestion className="w-10 h-10" style={{ color: 'var(--primary)' }} />
        </div>

        <h1
          className="text-5xl font-bold mb-2"
          style={{ color: 'var(--foreground)' }}
        >
          404
        </h1>
        <p className="text-lg mb-8" style={{ color: 'var(--muted-foreground)' }}>
          This page doesn't exist.
        </p>

        <button
          onClick={() => navigate(getDashboardPath(), { replace: true })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            color: 'white',
            boxShadow: '0 4px 14px rgba(212, 189, 173, 0.35)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
