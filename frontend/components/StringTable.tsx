import { useState, useRef, useEffect, useCallback } from 'react';
import type { StringEntry } from '../utils/types';
import { Edit2, Check, X, Loader2 } from 'lucide-react';

interface Props {
  strings: StringEntry[];
  activeIndex: number | null;
  onSelect: (index: number | null) => void;
  onEdit: (index: number, value: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export default function StringTable({ strings, activeIndex, onSelect, onEdit, onLoadMore, hasMore, loading }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingIndex]);

  const startEditing = useCallback((entry: StringEntry) => {
    setEditingIndex(entry.index);
    setEditValue(entry.value);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingIndex !== null) {
      onEdit(editingIndex, editValue);
      setEditingIndex(null);
    }
  }, [editingIndex, editValue, onEdit]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  }, [saveEdit, cancelEdit]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !onLoadMore || !hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loading]);

  if (strings.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
        No matching strings
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border)] flex text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        <div className="w-16 px-3 py-2 shrink-0">#</div>
        <div className="w-20 px-3 py-2 shrink-0">Offset</div>
        <div className="flex-1 px-3 py-2">Value</div>
        <div className="w-16 px-3 py-2 shrink-0"></div>
      </div>

      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 160px)' }} onScroll={handleScroll}>
        {strings.map(entry => (
          <div
            key={entry.index}
            className={`flex items-center border-b border-[var(--border)] text-sm transition-colors group ${
              activeIndex === entry.index ? 'bg-[var(--accent)]/5' : 'hover:bg-[var(--bg-secondary)]'
            }`}
            onClick={() => onSelect(entry.index === activeIndex ? null : entry.index)}
          >
            <div className="w-16 px-3 py-2 text-[var(--text-muted)] font-mono text-xs shrink-0">
              {entry.index}
            </div>
            <div className="w-20 px-3 py-2 text-[var(--text-muted)] font-mono text-xs shrink-0">
              0x{entry.offset.toString(16)}
            </div>
            <div className="flex-1 px-3 py-2 min-w-0">
              {editingIndex === entry.index ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-sm"
                />
              ) : (
                <span className="text-[var(--text-primary)] truncate block font-mono text-xs">
                  {entry.value}
                </span>
              )}
            </div>
            <div className="w-16 px-3 py-2 shrink-0 flex items-center gap-1">
              {editingIndex === entry.index ? (
                <>
                  <button onClick={e => { e.stopPropagation(); saveEdit(); }} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--success)]">
                    <Check size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); cancelEdit(); }} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--error)]">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); startEditing(entry); }}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] opacity-0 group-hover:opacity-100"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center justify-center py-4 text-[var(--text-muted)] text-sm gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading...
          </div>
        )}
        {!hasMore && strings.length > 0 && (
          <div className="text-center py-3 text-xs text-[var(--text-muted)]">
            All {strings.length} strings shown
          </div>
        )}
      </div>
    </div>
  );
}