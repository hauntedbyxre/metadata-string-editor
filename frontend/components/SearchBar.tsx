import { Search, Regex } from 'lucide-react';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  mode: 'text' | 'regex';
  onModeChange: (m: 'text' | 'regex') => void;
  totalCount: number;
  filteredCount: number;
}

export default function SearchBar({ query, onQueryChange, mode, onModeChange, totalCount, filteredCount }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="relative flex-1 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search strings..."
          className="w-full pl-9 pr-3 py-1.5 text-sm"
        />
      </div>

      <button
        onClick={() => onModeChange(mode === 'text' ? 'regex' : 'text')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          mode === 'regex'
            ? 'bg-[var(--accent)] text-white'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
        }`}
      >
        <Regex size={14} />
        Regex
      </button>

      <span className="text-xs text-[var(--text-muted)]">
        {filteredCount} / {totalCount}
      </span>
    </div>
  );
}
