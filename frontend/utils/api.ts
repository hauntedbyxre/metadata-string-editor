import {
  MetadataFileInfo, StringEntry, StringLiteralEntry, EditAction, EditRequest,
  BulkReplaceRequest, EditProject,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

const UPLOAD_URL = 'https://metadata.nullbin.xyz';

export async function uploadMetadata(file: File): Promise<{ meta: { sessionId: string; fileName: string; fileSize: number; header: any; stringCount: number; stringLiteralCount: number }; sessionId: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${UPLOAD_URL}/api/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  const meta = await res.json();
  return { meta, sessionId: meta.sessionId };
}

export async function fetchStrings(sessionId: string, offset: number, limit: number): Promise<{ total: number; offset: number; limit: number; strings: StringEntry[] }> {
  return request(`/api/strings/${sessionId}?offset=${offset}&limit=${limit}`);
}

export async function fetchStringLiterals(sessionId: string, offset: number, limit: number): Promise<{ total: number; offset: number; limit: number; strings: StringLiteralEntry[] }> {
  return request(`/api/string-literals/${sessionId}?offset=${offset}&limit=${limit}`);
}

export async function searchStrings(sessionId: string, query: string, offset: number, limit: number, useRegex: boolean): Promise<{ total: number; offset: number; limit: number; strings: StringEntry[] }> {
  const params = new URLSearchParams({ q: query, offset: String(offset), limit: String(limit), use_regex: String(useRegex) });
  return request(`/api/search/${sessionId}?${params}`);
}

export async function searchLiterals(sessionId: string, query: string, offset: number, limit: number, useRegex: boolean): Promise<{ total: number; offset: number; limit: number; strings: StringLiteralEntry[] }> {
  const params = new URLSearchParams({ q: query, offset: String(offset), limit: String(limit), use_regex: String(useRegex) });
  return request(`/api/search-literals/${sessionId}?${params}`);
}

export async function getSession(sessionId: string): Promise<MetadataFileInfo> {
  return request(`/api/session/${sessionId}`);
}

export async function editString(sessionId: string, req: EditRequest): Promise<EditAction> {
  return request(`/api/edit/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function bulkReplace(sessionId: string, req: BulkReplaceRequest): Promise<{ actions: EditAction[] }> {
  return request(`/api/bulk-replace/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getHistory(sessionId: string): Promise<{ history: EditAction[] }> {
  return request(`/api/history/${sessionId}`);
}

export async function undoEdit(sessionId: string): Promise<{ undone: EditAction }> {
  return request(`/api/undo/${sessionId}`, { method: 'POST' });
}

export async function exportProject(sessionId: string): Promise<EditProject> {
  return request(`/api/export-project/${sessionId}`, { method: 'POST' });
}

export async function importProject(sessionId: string, project: EditProject): Promise<{ applied: number }> {
  return request(`/api/import-project/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(project),
  });
}

export function getDownloadUrl(sessionId: string): string {
  return `${UPLOAD_URL}/api/download/${sessionId}`;
}
