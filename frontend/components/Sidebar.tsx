import { FileText, Search, Info, Replace, History, Undo2, Download, Upload, Plus } from 'lucide-react';

type View = 'editor' | 'info' | 'bulk' | 'history';

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  hasMetadata: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onExport: () => void;
  onImport: () => void;
  onNew: () => void;
}

const navItems: { id: View; label: string; icon: any }[] = [
  { id: 'editor', label: 'String Editor', icon: Search },
  { id: 'info', label: 'Metadata Info', icon: Info },
  { id: 'bulk', label: 'Bulk Replace', icon: Replace },
  { id: 'history', label: 'Activity Log', icon: History },
];

export default function Sidebar({ view, onViewChange, hasMetadata, onUndo, canUndo, onExport, onImport, onNew }: Props) {
  return (
    <aside className="w-56 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">MetaDataStringEditor</h2>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                view === item.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-[var(--border)] space-y-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:pointer-events-none"
        >
          <Undo2 size={16} />
          Undo
        </button>
        <button
          onClick={onExport}
          disabled={!canUndo}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:pointer-events-none"
        >
          <Download size={16} />
          Export Project
        </button>
        <button
          onClick={onImport}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
        >
          <Upload size={16} />
          Import Project
        </button>
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
        >
          <Plus size={16} />
          New File
        </button>
      </div>
    </aside>
  );
}
