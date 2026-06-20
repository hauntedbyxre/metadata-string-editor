import { useState } from 'react';
import { Replace } from 'lucide-react';

interface Props {
  onReplace: (find: string, replace: string, useRegex: boolean) => void;
}

export default function BulkReplace({ onReplace }: Props) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [useRegex, setUseRegex] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!find) return;
    onReplace(find, replace, useRegex);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border)]">
        <div className="flex items-center gap-2 mb-4">
          <Replace size={18} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Bulk Find & Replace</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Find</label>
            <input
              value={find}
              onChange={e => setFind(e.target.value)}
              placeholder="Text to find..."
              className="w-full font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Replace With</label>
            <input
              value={replace}
              onChange={e => setReplace(e.target.value)}
              placeholder="Replacement text..."
              className="w-full font-mono text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={e => setUseRegex(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">Use regular expressions</span>
          </label>

          <button
            type="submit"
            disabled={!find}
            className="w-full py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            Replace All
          </button>
        </form>
      </div>
    </div>
  );
}
