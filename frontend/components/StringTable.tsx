import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { StringEntry } from '../utils/types';
import { Edit2, Check, X } from 'lucide-react';

const ROW_HEIGHT = 36;
const OVERSCAN = 10;

interface Props {
  strings: StringEntry[];
  activeIndex: number | null;
  onSelect: (index: number | null) => void;
  onEdit: (index: number, value: string) => void;
}

export default function StringTable({ strings, activeIndex, onSelect, onEdit }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalHeight = strings.length * ROW_HEIGHT;

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil((containerRef.current?.clientHeight || 600) / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(strings.length, start + visibleCount);
    return { start, end };
  }, [scrollTop, strings.length]);

  const visibleStrings = useMemo(
    () => strings.slice(visibleRange.start, visibleRange.end),
    [strings, visibleRange.start, visibleRange.end]
  );

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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  if (strings.length === 0) {
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

      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ maxHeight: 'calc(100vh - 160px)' }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleStrings.map(entry => {
            const top = entry.index * ROW_HEIGHT;
            return (
              <div
                key={entry.index}
                className={`flex items-center border-b border-[var(--border)] text-sm transition-colors group absolute left-0 right-0 ${
                  activeIndex === entry.index ? 'bg-[var(--accent)]/5' : 'hover:bg-[var(--bg-secondary)]'
                }`}
                style={{ top, height: ROW_HEIGHT }}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}