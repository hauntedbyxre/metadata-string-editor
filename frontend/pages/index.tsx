import { useState, useCallback, useRef } from 'react';
import type { MetadataFileInfo, EditAction, StringEntry, ViewMode } from '../utils/types';
import { uploadMetadata, fetchStrings, fetchStringLiterals, searchStrings, searchLiterals, getSession, editString, bulkReplace, undoEdit, exportProject, importProject, getDownloadUrl } from '../utils/api';
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
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('editor');
  const [viewMode, setViewMode] = useState<ViewMode>('literals');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'text' | 'regex'>('text');
  const [history, setHistory] = useState<EditAction[]>([]);
  const [activeStringIndex, setActiveStringIndex] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimeout = useRef<ReturnType<typeof setTimeout>>();

  const [displayedStrings, setDisplayedStrings] = useState<(StringEntry | import('../utils/types').StringLiteralEntry)[]>([]);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [stringsOffset, setStringsOffset] = useState(0);
  const [stringsLoading, setStringsLoading] = useState(false);
  const stringsEndRef = useRef(false);
  const loadGenRef = useRef(0);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  async function loadStrings(sid: string, query: string, regex: boolean, offset: number, append: boolean, mode?: ViewMode) {
    const useMode = mode ?? viewMode;
    const gen = ++loadGenRef.current;
    setStringsLoading(true);
    try {
      const isLiterals = useMode === 'literals';
      let result: any;
      if (query) {
        result = isLiterals
          ? await searchLiterals(sid, query, offset, PAGE_SIZE, regex)
          : await searchStrings(sid, query, offset, PAGE_SIZE, regex);
      } else {
        result = isLiterals
          ? await fetchStringLiterals(sid, offset, PAGE_SIZE)
          : await fetchStrings(sid, offset, PAGE_SIZE);
      }
      if (gen !== loadGenRef.current) return;
      const items = result.strings || [];
      setDisplayedStrings(prev => append ? [...prev, ...items] : items);
      setTotalFiltered(result.total);
      setStringsOffset(offset + items.length);
      stringsEndRef.current = items.length < PAGE_SIZE;
    } catch (e: any) {
      if (gen !== loadGenRef.current) return;
      showNotification(`Error: ${e.message || 'failed to load strings'}`);
    } finally {
      if (gen === loadGenRef.current) setStringsLoading(false);
    }
  }

  const handleUpload = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const { meta, sessionId } = await uploadMetadata(f);
      showNotification(`Upload OK, session=${sessionId.slice(0,8)}..., literals=${meta.stringLiteralCount}, strings=${meta.stringCount}`);
      setFile(f);
      setSessionId(sessionId);
      setMetadata({ ...meta, strings: [], stringLiterals: [] });
      setHistory([]);
      setSearchQuery('');
      const initialMode: ViewMode = meta.stringLiteralCount > 0 ? 'literals' : 'strings';
      setViewMode(initialMode);
      setActiveStringIndex(null);
      setDisplayedStrings([]);
      setTotalFiltered(0);
      setStringsOffset(0);
      stringsEndRef.current = false;
      loadStrings(sessionId, '', false, 0, false, initialMode);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const handleSearch = useCallback((query: string, mode: 'text' | 'regex') => {
    setSearchQuery(query);
    setSearchMode(mode);
    if (!sessionId) return;
    setDisplayedStrings([]);
    setStringsOffset(0);
    stringsEndRef.current = false;
    loadStrings(sessionId, query, mode === 'regex', 0, false, viewMode);
  }, [sessionId, viewMode]);

  const handleLoadMore = useCallback(() => {
    if (!sessionId || stringsEndRef.current || stringsLoading) return;
    loadStrings(sessionId, searchQuery, searchMode === 'regex', stringsOffset, true, viewMode);
  }, [sessionId, searchQuery, searchMode, stringsOffset, stringsLoading, viewMode]);

  const handleEditString = useCallback(async (index: number, newValue: string) => {
    if (!sessionId || !metadata) return;
    try {
      const target = viewMode === 'literals' ? 'stringLiterals' : 'strings';
      const action = await editString(sessionId, { target, index, newValue });
      setDisplayedStrings(prev => prev.map(s => s.index === index ? { ...s, value: newValue } : s));
      setHistory(prev => [...prev, action]);
      showNotification(`${target === 'stringLiterals' ? 'Literal' : 'String'} #${index} updated`);
    } catch (e: any) {
      setError(e.message);
    }
  }, [sessionId, metadata, showNotification, viewMode]);

  const handleBulkReplace = useCallback(async (find: string, replace: string, useRegex: boolean) => {
    if (!sessionId || !metadata) return;
    try {
      const target = viewMode === 'literals' ? 'stringLiterals' : 'strings';
      const result = await bulkReplace(sessionId, { find, replace, useRegex, target });
      showNotification(`${result.actions.length} ${target} replaced`);
      setHistory(prev => [...prev, ...result.actions]);
    } catch (e: any) {
      setError(e.message);
    }
  }, [sessionId, metadata, showNotification, viewMode]);

  const handleUndo = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await undoEdit(sessionId);
      setDisplayedStrings(prev => prev.map(s => s.index === result.undone.index ? { ...s, value: result.undone.oldValue } : s));
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
        showNotification(`${result.applied} edits imported`);
      } catch (e: any) {
        setError(e.message);
      }
    };
    input.click();
  }, [sessionId, showNotification]);

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
        onNew={() => { setMetadata(null); setSessionId(null); setFile(null); setHistory([]); setDisplayedStrings([]); setViewMode('literals'); }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-[var(--border)] flex items-center px-4 gap-3 bg-[var(--bg-secondary)]">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {file?.name}
          </span>
          <div className="flex items-center gap-1 text-xs border border-[var(--border)] rounded overflow-hidden">
            <button
              onClick={() => {
                setViewMode('literals');
                setDisplayedStrings([]);
                setStringsOffset(0);
                stringsEndRef.current = false;
                if (sessionId) loadStrings(sessionId, '', false, 0, false, 'literals');
              }}
              className={`px-2 py-1 ${viewMode === 'literals' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Literals ({metadata.stringLiteralCount})
            </button>
            <button
              onClick={() => {
                setViewMode('strings');
                setDisplayedStrings([]);
                setStringsOffset(0);
                stringsEndRef.current = false;
                if (sessionId) loadStrings(sessionId, '', false, 0, false, 'strings');
              }}
              className={`px-2 py-1 ${viewMode === 'strings' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Strings ({metadata.stringCount})
            </button>
          </div>
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
              onQueryChange={q => handleSearch(q, searchMode)}
              mode={searchMode}
              onModeChange={m => handleSearch(searchQuery, m)}
              totalCount={totalFiltered}
              filteredCount={displayedStrings.length}
            />
            <div className="flex-1 overflow-auto">
              <StringTable
                strings={displayedStrings}
                activeIndex={activeStringIndex}
                onSelect={setActiveStringIndex}
                onEdit={handleEditString}
                onLoadMore={handleLoadMore}
                hasMore={!stringsEndRef.current}
                loading={stringsLoading}
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