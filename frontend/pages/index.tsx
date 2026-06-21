import { useState, useCallback, useEffect, useRef } from 'react';
import type { MetadataFileInfo, EditAction, StringEntry } from '../utils/types';
import { uploadMetadata, getSession, editString, bulkReplace, undoEdit, exportProject, importProject, getDownloadUrl } from '../utils/api';
import UploadZone from '../components/UploadZone';
import Sidebar from '../components/Sidebar';
import MetadataInfo from '../components/MetadataInfo';
import StringTable from '../components/StringTable';
import SearchBar from '../components/SearchBar';
import BulkReplace from '../components/BulkReplace';
import ActivityLog from '../components/ActivityLog';
import ThemeToggle from '../components/ThemeToggle';

type View = 'editor' | 'info' | 'bulk' | 'history';

export default function Home({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MetadataFileInfo | null>(null);
  const [loading, setLoading] = useState(false);
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

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleUpload = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);

    if (f.size > 4 * 1024 * 1024) {
      setError(
        `File is ${(f.size / 1024 / 1024).toFixed(1)} MB — Vercel's free tier limits uploads to 4.5 MB. ` +
        `Upload directly at http://216.128.158.141/ (no size limits). ` +
        `After uploading, copy the session ID from the VPS site and add ?session=ID to this URL to continue editing.`
      );
      setLoading(false);
      return;
    }

    try {
      const { metadata, sessionId } = await uploadMetadata(f);
      setFile(f);
      setMetadata(metadata);
      setSessionId(sessionId);
      setHistory([]);
      setSearchQuery('');
      setActiveStringIndex(null);
      setEditingString(false);
      showNotification(`Loaded ${metadata.strings.length} strings`);
    } catch (e: any) {
      if (e.message?.includes('FUNCTION_PAYLOAD_TOO_LARGE') || e.message?.includes('413')) {
        setError(
          'File too large for Vercel free tier (limit: 4.5 MB). ' +
          'Use http://216.128.158.141/ to upload this file.'
        );
      } else {
        setError(e.message || 'Upload failed');
      }
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const handleEditString = useCallback(async (index: number, newValue: string) => {
    if (!sessionId || !metadata) return;
    try {
      const action = await editString(sessionId, { target: 'strings', index, newValue });
      setMetadata(prev => {
        if (!prev) return prev;
        const strings = [...prev.strings];
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
        const strings = prev.strings.map(s => {
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
        const strings = [...prev.strings];
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
        setMetadata(refreshed);
        setHistory(refreshed ? [] : []);
        showNotification(`${result.applied} edits imported`);
      } catch (e: any) {
        setError(e.message);
      }
    };
    input.click();
  }, [sessionId, showNotification]);

  const filteredStrings = metadata?.strings.filter(s => {
    if (!searchQuery) return true;
    if (searchMode === 'regex') {
      try {
        return new RegExp(searchQuery).test(s.value);
      } catch { return false; }
    }
    return s.value.toLowerCase().includes(searchQuery.toLowerCase());
  }) ?? [];

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
        onNew={() => { setMetadata(null); setSessionId(null); setFile(null); setHistory([]); }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-[var(--border)] flex items-center px-4 gap-3 bg-[var(--bg-secondary)]">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {file?.name} — {metadata.strings.length} strings
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
              totalCount={metadata.strings.length}
              filteredCount={filteredStrings.length}
            />
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
