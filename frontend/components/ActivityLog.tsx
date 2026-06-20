import type { EditAction } from '../utils/types';

interface Props {
  actions: EditAction[];
}

export default function ActivityLog({ actions }: Props) {
  if (actions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
        No modifications yet
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Activity Log</h3>

      <div className="space-y-1">
        {actions.map((action, i) => (
          <div
            key={i}
            className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border)] text-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-[var(--accent)] uppercase">
                {action.type}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                string #{action.index}
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs font-mono">
              <span className="text-[var(--error)] line-through shrink-0 max-w-[200px] truncate">
                {action.oldValue}
              </span>
              <span className="text-[var(--text-muted)] shrink-0">→</span>
              <span className="text-[var(--success)] max-w-[200px] truncate">
                {action.newValue}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
