import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { apiFetch, ApiError, BYPASS_AUTH } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────

export type AccountType = 'STAFF' | 'PATIENT';
export type StaffRole = 'USER' | 'ADMIN' | 'DOCTOR';

export interface StaffPrincipal {
  accountType: 'STAFF';
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: StaffRole;
  organizationId: string | null;
}

export interface PatientPrincipal {
  accountType: 'PATIENT';
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string;
  gender: string;
  organizationId: string | null;
}

export type Principal = StaffPrincipal | PatientPrincipal;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  principal: Principal | null;
  principalLoading: boolean;
  principalError: string | null;
  preferredAccountType: AccountType;
  setPreferredAccountType: (type: AccountType) => void;
  refreshPrincipal: () => Promise<void>;
  signOut: () => Promise<void>;
  mockLogin?: (email: string, type: AccountType) => void; // Added for bypass mode
}

// ─── Context ─────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [principalLoading, setPrincipalLoading] = useState(false);
  const [principalError, setPrincipalError] = useState<string | null>(null);
  const [preferredAccountType, setPreferredAccountType] = useState<AccountType>(
    () => (localStorage.getItem('preferredAccountType') as AccountType) || 'STAFF',
  );

  // Persist preferred account type
  useEffect(() => {
    localStorage.setItem('preferredAccountType', preferredAccountType);
  }, [preferredAccountType]);

  // ── Principal Resolution ─────────────────────────────────

  const resolvePrincipal = useCallback(async () => {
    setPrincipalLoading(true);
    setPrincipalError(null);

    // Try preferred endpoint first
    const preferred = preferredAccountType === 'PATIENT' ? '/auth/patient/me' : '/auth/staff/me';
    const fallback = preferredAccountType === 'PATIENT' ? '/auth/staff/me' : '/auth/patient/me';

    try {
      const res = await apiFetch<{ status: string; data: Principal }>(preferred);
      setPrincipal(res.data);
      setPrincipalLoading(false);
      return;
    } catch (err) {
      // Only fall back on 401 (wrong account type)
      if (err instanceof ApiError && err.status === 401) {
        try {
          const res = await apiFetch<{ status: string; data: Principal }>(fallback);
          setPrincipal(res.data);
          // Update preferred to match what actually resolved
          setPreferredAccountType(res.data.accountType);
          setPrincipalLoading(false);
          return;
        } catch (fallbackErr) {
          if (fallbackErr instanceof ApiError && fallbackErr.status !== 401) {
            setPrincipalError((fallbackErr as ApiError).message);
          }
        }
      } else if (err instanceof ApiError) {
        setPrincipalError(err.message);
      }
    }

    setPrincipalLoading(false);
  }, [preferredAccountType]);

  const refreshPrincipal = useCallback(async () => {
    if (session) {
      await resolvePrincipal();
    }
  }, [session, resolvePrincipal]);

  // ── Supabase Session Listener ────────────────────────────

  useEffect(() => {
    if (BYPASS_AUTH) {
      // Initialize with mock session to skip login by default
      const defaultRole = (localStorage.getItem('preferredAccountType') as AccountType) || 'STAFF';
      const mockUser: User = {
        id: defaultRole === 'STAFF' ? 'mock-staff-id' : 'mock-patient-id',
        email: defaultRole === 'STAFF' ? 'mock.staff@example.com' : 'mock.patient@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };
      const mockSession: Session = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser,
      };

      // Check if user has explicitly logged out
      const hasLoggedOut = localStorage.getItem('mockLoggedOut') === 'true';
      if (hasLoggedOut) {
        setSession(null);
      } else {
        setSession(mockSession);
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (!s) {
          setPrincipal(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Resolve principal whenever session changes
  useEffect(() => {
    if (session) {
      resolvePrincipal();
    } else {
      setPrincipal(null);
    }
  }, [session, resolvePrincipal]);

  // ── Sign Out ─────────────────────────────────────────────

  const signOut = useCallback(async () => {
    if (BYPASS_AUTH) {
      localStorage.setItem('mockLoggedOut', 'true');
      setSession(null);
      setPrincipal(null);
      return;
    }
    await supabase.auth.signOut();
    setPrincipal(null);
    setSession(null);
  }, []);

  // ── Mock Login (Bypass mode only) ─────────────────────────

  const mockLogin = useCallback((email: string, type: AccountType) => {
    localStorage.removeItem('mockLoggedOut');
    setPreferredAccountType(type);
    const mockUser: User = {
      id: type === 'STAFF' ? 'mock-staff-id' : 'mock-patient-id',
      email: email || (type === 'STAFF' ? 'mock.staff@example.com' : 'mock.patient@example.com'),
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
    const mockSession: Session = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: mockUser,
    };
    setSession(mockSession);
  }, [setPreferredAccountType]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        principal,
        principalLoading,
        principalError,
        preferredAccountType,
        setPreferredAccountType,
        refreshPrincipal,
        signOut,
        mockLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
