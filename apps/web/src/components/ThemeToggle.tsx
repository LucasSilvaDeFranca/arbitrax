'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition w-full
        text-gray-600 hover:bg-gray-50
        dark:text-slate-400 dark:hover:bg-slate-800"
      title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
    </button>
  );
}
