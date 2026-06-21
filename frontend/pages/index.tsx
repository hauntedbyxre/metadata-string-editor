import { useState, useCallback, useEffect, useRef } from 'react';
import type { MetadataFileInfo, EditAction, StringEntry } from '../utils/types';
import { uploadMetadata, fetchStrings, getSession, editString, bulkReplace, undoEdit, exportProject, importProject, getDownloadUrl } from '../utils/api';
import UploadZone from '../components/UploadZone';
import Sidebar from '../components/Sidebar';
import MetadataInfo from '../components/MetadataInfo';
import StringTable from '../components/StringTable';
import SearchBar from '../components/SearchBar';
import BulkReplace from '../components/BulkReplace';
import ActivityLog from '../components/ActivityLog';
import ThemeToggle from '../components/ThemeToggle';

const PAGE_SIZE = 500;

type View = 'editor' | 'info' | 'bulk' | 'history';

export default function Home({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MetadataFileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [stringsLoaded, setStringsLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('editor');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'text' | 'regex'>('text');
  const [history, setHistory] = useState<EditAction[]>([]);
  const [activeStringIndex, setActiveStringIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingString, setEditingString] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimeout = useRef<ReturnType<typeof setTimeout>>();
  const loadingRef = useRef(false);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleUpload = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const { meta, sessionId } = await uploadMetadata(f);
      setFile(f);
      setSessionId(sessionId);
      setMetadata({ ...meta, strings: [], stringLiterals: [] });
      setHistory([]);
      setSearchQuery('');
      setActiveStringIndex(null);
      setEditingString(false);
      setStringsLoaded(0);
      loadingRef.current = false;
      // start loading strings in background
      loadAllStrings(sessionId, meta.stringCount);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  async function loadAllStrings(sessionId: string, totalCount: number) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const allStrings: StringEntry[] = [];
    let offset = 0;
    while (offset < totalCount) {
      try {
        const page = await fetchStrings(sessionId, offset, PAGE_SIZE);
        allStrings.push(...page.strings);
        offset += PAGE_SIZE;
        setStringsLoaded(allStrings.length);
        setMetadata(prev => prev ? { ...prev, strings: [...allStrings] } : prev);
      } catch {
        break;
      }
    }
    loadingRef.current = false;
  }

  const handleEditString = useCallback(async (index: number, newValue: string) => {
    if (!sessionId || !metadata) return;
    try {
      const action = await editString(sessionId, { target: 'strings', index, newValue });
      setMetadata(prev => {
        if (!prev) return prev;
        const strings = [...(prev.strings || [])];
        strings[index] = { ...strings[index], value: newValue };
        return { ...prev, strings };
      });
      setHistory(prev => [...prev, action]);
      setEditingString(false);
      showNotification(`String #${index} updated`);
    } catch (e: any) {
      setError(e.message);
    }
  }, [sessionId, metadata, showNotification]);

  const handleBulkReplace = useCallback(async (find: string, replace: string, useRegex: boolean) => {
    if (!sessionId || !metadata) return;
    try {
      const result = await bulkReplace(sessionId, { find, replace, useRegex, target: 'strings' });
      setMetadata(prev => {
        if (!prev) return prev;
        const strings = (prev.strings || []).map(s => {
          const action = result.actions.find(a => a.index === s.index);
          return action ? { ...s, value: action.newValue } : s;
        });
        return { ...prev, strings };
      });
      setHistory(prev => [...prev, ...result.actions]);
      showNotification(`${result.actions.length} strings replaced`);
    } catch (e: any) {
      setError(e.message);
    }
  }, [sessionId, metadata, showNotification]);

  const handleUndo = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await undoEdit(sessionId);
      setMetadata(prev => {
        if (!prev) return prev;
        const strings = [...(prev.strings || [])];
        strings[result.undone.index] = { ...strings[result.undone.index], value: result.undone.oldValue };
        return { ...prev, strings };
      });
      setHistory(prev => prev.slice(0, -1));
      showNotification('Undo successful');
    } catch (e: any) {
      setError(e.message);
    }
  }, [sessionId, showNotification]);

  const handleExport = useCallback(async () => {
    if (!sessionId) return;
    try {
      const project = await exportProject(sessionId);
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'metadata-edits.json';
      a.click();
      URL.revokeObjectURL(url);
      showNotification('Project exported');
    } catch (e: any) {
      setError(e.message);
    }
  }, [sessionId, showNotification]);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      if (!sessionId || !e.target.files[0]) return;
      try {
        const text = await e.target.files[0].text();
        const project = JSON.parse(text);
        const result = await importProject(sessionId, project);
        const refreshed = await getSession(sessionId);
        setMetadata(prev => prev ? { ...prev, ...refreshed } : prev);
        setHistory([]);
        setStringsLoaded(0);
        loadAllStrings(sessionId, refreshed.stringCount);
        showNotification(`${result.applied} edits imported`);
      } catch (e: any) {
        setError(e.message);
      }
    };
    input.click();
  }, [sessionId, showNotification]);

  const curStrings = metadata?.strings || [];
  const filteredStrings = curStrings.filter(s => {
    if (!searchQuery) return true;
    if (searchMode === 'regex') {
      try {
        return new RegExp(searchQuery).test(s.value);
      } catch { return false; }
    }
    return s.value.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const loadingMore = metadata && stringsLoaded < metadata.stringCount;

  if (!metadata) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">MetaDataStringEditor</h1>
            <p className="text-[var(--text-muted)] mt-2">Unity IL2CPP global-metadata.dat editor</p>
          </div>
          <UploadZone onUpload={handleUpload} loading={loading} />
          {error && <p className="text-[var(--error)] mt-4 text-center text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg-primary)]">
      <Sidebar
        view={view}
        onViewChange={setView}
        hasMetadata={!!metadata}
        onUndo={handleUndo}
        canUndo={history.length > 0}
        onExport={handleExport}
        onImport={handleImport}
        onNew={() => { setMetadata(null); setSessionId(null); setFile(null); setHistory([]); setStringsLoaded(0); }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-[var(--border)] flex items-center px-4 gap-3 bg-[var(--bg-secondary)]">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {file?.name} — {loadingMore ? `${stringsLoaded}/${metadata.stringCount}` : metadata.stringCount} strings
          </span>
          <div className="ml-auto flex items-center gap-2">
            {history.length > 0 && (
              <a
                href={getDownloadUrl(sessionId || '')}
                download={metadata.fileName}
                className="text-xs px-3 py-1.5 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] no-underline"
              >
                Download Modified
              </a>
            )}
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </header>

        {view === 'info' && (
          <div className="flex-1 overflow-auto p-6">
            <MetadataInfo metadata={metadata} />
          </div>
        )}

        {view === 'bulk' && (
          <div className="flex-1 overflow-auto p-6">
            <BulkReplace onReplace={handleBulkReplace} />
          </div>
        )}

        {view === 'history' && (
          <div className="flex-1 overflow-auto p-6">
            <ActivityLog actions={history} />
          </div>
        )}

        {view === 'editor' && (
          <div className="flex-1 flex flex-col min-h-0">
            <SearchBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              mode={searchMode}
              onModeChange={setSearchMode}
              totalCount={curStrings.length}
              filteredCount={filteredStrings.length}
            />
            {loadingMore && (
              <div className="px-4 py-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                Loading strings... {stringsLoaded}/{metadata.stringCount}
              </div>
            )}
            <div className="flex-1 overflow-auto">
              <StringTable
                strings={filteredStrings}
                activeIndex={activeStringIndex}
                onSelect={setActiveStringIndex}
                onEdit={handleEditString}
              />
            </div>
          </div>
        )}
      </div>

      {notification && (
        <div className="fixed bottom-4 right-4 bg-[var(--accent)] text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {notification}
        </div>
      )}
    </div>
  );
}
