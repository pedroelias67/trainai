'use client';

import { useTheme } from '@/components/ThemeProvider';

const themes = [
  { id: 'dark', label: 'Escuro', icon: '🌑' },
  { id: 'dim', label: 'Dim', icon: '🌒' },
  { id: 'light', label: 'Claro', icon: '☀️' },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-2">
      {themes.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
            theme === t.id
              ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--bg-subtle)]'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
