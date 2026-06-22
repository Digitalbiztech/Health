import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, User, Eye, EyeOff, Loader2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { apiFetch, BYPASS_AUTH } from '@/lib/api';
import { useAuth, type AccountType } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { useBranding } from '@/hooks/useBranding';

export default function Login() {
  const navigate = useNavigate();
  const { setPreferredAccountType, mockLogin } = useAuth();
  const { branding } = useBranding();

  // ── State ──────────────────────────────────────────────────
  const [isSignUp, setIsSignUp] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('STAFF');
  const [email, setEmail] = useState('user@gmail.com');
  const [password, setPassword] = useState('password');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPatient = accountType === 'PATIENT';

  // ── Handlers ───────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (BYPASS_AUTH) {
        if (mockLogin) {
          mockLogin(email, accountType);
          toast.success('Signed in successfully (Bypass Mode)!');
          navigate('/', { replace: true });
        }
        setLoading(false);
        return;
      }

      if (isSignUp) {
        if (isPatient) {
          // Patient signup → POST to backend
          const res = await apiFetch<{
            status: string;
            data: {
              patient: { id: string };
              session: {
                access_token: string;
                refresh_token: string;
              } | null;
            };
          }>('/auth/patient/signup', {
            method: 'POST',
            body: JSON.stringify({
              email,
              password,
              firstName,
              lastName,
              dateOfBirth,
              gender,
            }),
          });

          if (res.data.session) {
            await supabase.auth.setSession({
              access_token: res.data.session.access_token,
              refresh_token: res.data.session.refresh_token,
            });
            setPreferredAccountType('PATIENT');
            toast.success('Account created successfully!');
            navigate('/', { replace: true });
          } else {
            toast.success('Account created! Please sign in.');
            setIsSignUp(false);
          }
        } else {
          // Staff signup → Supabase directly
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                account_type: 'STAFF',
                first_name: firstName,
                last_name: lastName,
              },
            },
          });

          if (error) throw error;

          setPreferredAccountType('STAFF');
          toast.success('Account created! Check your email for verification.');
          setIsSignUp(false);
        }
      } else {
        // Sign in → Supabase for both types
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setPreferredAccountType(accountType);
        toast.success('Signed in successfully!');
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 relative"
      style={{ background: 'var(--background)' }}
    >
      {/* Theme Switcher */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Logo */}
      <div className="mb-8 animate-fade-in-up flex flex-col items-center">
        {branding.logoMainUrl ? (
          <img
            src={branding.logoMainUrl}
            alt={`${branding.brandName} Logo`}
            className="h-24 w-auto object-contain"
          />
        ) : (
          <span className="text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            {branding.brandName}
          </span>
        )}
      </div>

      {/* Card */}
      <div
        className="glass-card w-full max-w-md rounded-2xl p-8 animate-fade-in-up"
        style={{
          animationDelay: '0.1s',
          borderColor: 'color-mix(in srgb, var(--border) 40%, transparent)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Title */}
        <h2
          className="text-xl font-semibold text-center mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--muted-foreground)' }}>
          {isSignUp
            ? 'Fill in your details to get started'
            : 'Sign in to your account'}
        </p>

        {/* Account Type Toggle */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(['STAFF', 'PATIENT'] as const).map((type) => {
            const active = accountType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium',
                  'border transition-all duration-200 cursor-pointer',
                  active
                    ? 'border-primary bg-primary/10 text-primary-text'
                    : 'border-transparent bg-transparent hover:bg-primary/5',
                )}
                style={{
                  borderColor: active
                    ? 'var(--primary)'
                    : 'color-mix(in srgb, var(--border) 40%, transparent)',
                  color: active ? 'var(--primary-text)' : 'var(--muted-foreground)',
                  background: active
                    ? 'var(--primary-glow)'
                    : 'color-mix(in srgb, var(--background) 50%, transparent)',
                }}
              >
                {type === 'STAFF' ? (
                  <Stethoscope className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                {type === 'STAFF' ? 'Clinician' : 'Patient'}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name fields — signup only */}
          {isSignUp && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'var(--input)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'var(--input)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>
          )}

          {/* Patient-only fields — signup only */}
          {isSignUp && isPatient && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label
                  htmlFor="dateOfBirth"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Date of Birth
                </label>
                <div className="relative">
                  <input
                    id="dateOfBirth"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
                    style={{
                      background: 'var(--input)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <CalendarDays
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--muted-foreground)' }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="gender"
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Gender
                </label>
                <select
                  id="gender"
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 appearance-none cursor-pointer"
                  style={{
                    background: 'var(--input)',
                    color: gender ? 'var(--foreground)' : 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                >
                  <option value="" disabled>
                    Select gender
                  </option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
              style={{
                background: 'var(--input)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              defaultValue={"user@gmail.com"}
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-2.5 pr-11 text-sm outline-none transition-all duration-200"
                style={{
                  background: 'var(--input)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-colors cursor-pointer"
                style={{ color: 'var(--muted-foreground)' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200',
              'flex items-center justify-center gap-2 cursor-pointer',
              'hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed',
            )}
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              boxShadow: 'var(--glow-primary)',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isSignUp ? 'Creating account…' : 'Signing in…'}
              </>
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Toggle sign up / sign in */}
        <p className="text-center text-sm mt-6" style={{ color: 'var(--muted-foreground)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-medium transition-colors cursor-pointer hover:underline text-primary-text"
            style={{ color: 'var(--primary-text)' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>

      {/* Footer */}
      {branding.showPoweredBy && (
        <p
          className="mt-8 text-[10px] font-semibold uppercase tracking-[0.3em] opacity-35 animate-fade-in-up"
          style={{ color: 'var(--muted-foreground)', animationDelay: '0.2s' }}
        >
          {branding.poweredByText || 'POWERED BY HUUMANIZE'}
        </p>
      )}
    </div>
  );
}
