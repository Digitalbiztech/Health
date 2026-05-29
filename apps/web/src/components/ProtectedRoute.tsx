import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Route guard — requires an active Supabase session.
 * Shows a loading spinner while checking, redirects to /login if unauthenticated.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--background)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          {/* Spinner */}
          <div
            className="w-10 h-10 rounded-full border-3 border-transparent animate-spin"
            style={{
              borderTopColor: '#D4BDAD',
              borderRightColor: '#D4BDAD',
            }}
          />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
