// Client for the ViolaHub backend (ARCHITECTURE.md §3.7).
// Feature-flagged: with no VITE_API_BASE set, apiEnabled() is false and the app
// falls back to the offline simulation, so the deployed prototype still works.

import type { Feedback } from './types';

const BASE: string = import.meta.env.VITE_API_BASE ?? '';

export function apiEnabled(): boolean {
  return BASE.length > 0;
}

const TOKEN_KEY = 'violahub_token';

function token(): string {
  return import.meta.env.VITE_API_TOKEN
    ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) ?? '' : '');
}

export function authToken(): string {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) ?? '' : '';
}

export function setAuthToken(t: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface AuthResult { token: string; user_id: string; name: string; role: string }

export async function register(email: string, password: string, name: string, role: string): Promise<AuthResult> {
  return req<AuthResult>('/api/v1/auth/register', {
    method: 'POST', body: JSON.stringify({ email, password, name, role }),
  });
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return req<AuthResult>('/api/v1/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface UploadUri { recording_id: string; upload_url: string; blob_url: string; expires_at: string }
type Kind = 'feedback' | 'transcription' | 'omr';

async function requestUploadUri(kind: Kind, skill: string, ext = 'wav'): Promise<UploadUri> {
  return req<UploadUri>('/api/v1/recordings/upload-uri', {
    method: 'POST', body: JSON.stringify({ kind, skill, ext }),
  });
}

async function putBlob(uploadUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  if (!res.ok) throw new Error(`blob upload → ${res.status}`);
}

async function startAnalyze(id: string, blobUrl: string, kind: Kind, skill: string): Promise<void> {
  await req(`/api/v1/recordings/${id}/analyze`, {
    method: 'POST', body: JSON.stringify({ blob_url: blobUrl, kind, skill }),
  });
}

interface RecordingStatus { status: string; feedback?: Feedback }

async function getRecording(id: string): Promise<RecordingStatus> {
  return req<RecordingStatus>(`/api/v1/recordings/${id}`, { method: 'GET' });
}

async function subscribeUrl(id: string): Promise<string> {
  const { url } = await req<{ url: string }>(`/api/v1/recordings/${id}/subscribe`, { method: 'GET' });
  return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function poll(id: string): Promise<Feedback> {
  for (let i = 0; i < 40; i++) {
    const r = await getRecording(id);
    if (r.status === 'completed' && r.feedback) return r.feedback;
    if (r.status === 'failed') throw new Error('analysis failed');
    await sleep(1500);
  }
  throw new Error('analysis timed out');
}

async function waitForResult(id: string): Promise<Feedback> {
  // Prefer the real-time Web PubSub channel; fall back to polling.
  let url: string;
  try { url = await subscribeUrl(id); } catch { return poll(id); }
  return new Promise<Feedback>((resolve, reject) => {
    const ws = new WebSocket(url);
    const fallback = setTimeout(() => { ws.close(); poll(id).then(resolve, reject); }, 60_000);
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.status === 'completed') {
          clearTimeout(fallback);
          ws.close();
          resolve(m.result as Feedback);
        }
      } catch { /* ignore non-JSON frames */ }
    };
    ws.onerror = () => { clearTimeout(fallback); ws.close(); poll(id).then(resolve, reject); };
  });
}

/** Full real pipeline: upload → analyze → await the scored result. */
export async function runFeedbackAnalysis(blob: Blob, skill: string): Promise<Feedback> {
  const up = await requestUploadUri('feedback', skill);
  await putBlob(up.upload_url, blob);
  await startAnalyze(up.recording_id, up.blob_url, 'feedback', skill);
  return waitForResult(up.recording_id);
}

/** Upload a recording and kick off analysis; returns the recording id. */
export async function uploadRecording(blob: Blob, skill: string, level: string): Promise<string> {
  const up = await requestUploadUri('feedback', skill);
  await putBlob(up.upload_url, blob);
  await req(`/api/v1/recordings/${up.recording_id}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ blob_url: up.blob_url, kind: 'feedback', skill, level }),
  });
  return up.recording_id;
}

/** Submit a teacher assessment (the labeled training record). */
export async function submitAssessment(body: Record<string, unknown>): Promise<void> {
  await req('/api/v1/assessments', { method: 'POST', body: JSON.stringify(body) });
}

/** Upload a photo/scan of sheet music for OMR (image → MusicXML). Returns the recording id. */
export async function uploadSheetScan(blob: Blob): Promise<string> {
  const ext = blob.type.includes('png') ? 'png' : 'jpg';
  const up = await requestUploadUri('omr', 'reading', ext);
  await putBlob(up.upload_url, blob);
  await req(`/api/v1/recordings/${up.recording_id}/analyze`, {
    method: 'POST', body: JSON.stringify({ blob_url: up.blob_url, kind: 'omr', skill: 'reading' }),
  });
  return up.recording_id;
}
