import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Guide from '@/pages/Guide';
import NotFound from '@/pages/NotFound';
import Landing from '@/pages/Landing';
import { setDashboardPath } from '@/lib/navigation';

// Initialize the dashboard route path for the admin-dash / SaaS branch
setDashboardPath('/dashboard');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <ThemeProvider>
          <BrowserRouter>
          <AuthProvider>
            <OnboardingProvider>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                {/* Protected */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/guide" element={<Guide />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>

              {/* Toast notifications */}
              <Toaster
                position="top-right"
                richColors
                toastOptions={{
                  style: {
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  },
                }}
              />
            </OnboardingProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}

