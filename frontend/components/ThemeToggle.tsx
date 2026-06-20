import { Moon, Sun } from 'lucide-react';

interface Props {
  theme: string;
  setTheme: (t: string) => void;
}

export default function ThemeToggle({ theme, setTheme }: Props) {
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
