import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (t: Theme) => {
    switch (t) {
      case 'light':
        return <Sun className="w-4.5 h-4.5 text-[var(--primary-text)]" />;
      case 'dark':
        return <Moon className="w-4.5 h-4.5 text-[var(--primary-text)]" />;
      case 'system':
        return <Laptop className="w-4.5 h-4.5 text-[var(--primary-text)]" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-xl flex items-center justify-center border cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 bg-card hover:bg-border/10"
        style={{ borderColor: 'var(--border)' }}
        title="Toggle Theme"
      >
        <span className="transition-transform duration-500 hover:rotate-12">
          {getIcon(theme)}
        </span>
      </button>

      {open && (
        <div 
          className="absolute right-0 mt-2 w-32 rounded-xl border p-1 shadow-lg z-50 glass-card animate-scale-in"
          style={{ borderColor: 'var(--border)' }}
        >
          {(['light', 'dark', 'system'] as const).map((t) => {
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => {
                  setTheme(t);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer border-0 bg-transparent text-muted-foreground transition-all duration-200",
                  active ? "text-foreground bg-primary/10" : "hover:bg-border/30 hover:text-foreground"
                )}
                style={{
                  color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  background: active ? 'var(--primary-glow)' : 'transparent',
                }}
              >
                {getIcon(t)}
                <span className="capitalize">{t}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
