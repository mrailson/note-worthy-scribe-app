/**
 * Recording Session Persistence
 * 
 * Persists recording session state to localStorage and audio chunks to IndexedDB
 * to enable recovery after page refresh or accidental navigation.
 */

import { safeSetItem } from '@/utils/localStorageManager';

// ─── Types ───────────────────────────────────────────────────────────

export interface PersistedRecordingSession {
  sessionId: string;        // Supabase meeting ID
  startedAt: string;        // ISO timestamp
  attendees: PersistedAttendee[];
  agendaItems: { id: string; text: string }[];
  groupId: string | null;
  groupName: string | null;
  meetingFormat: string | null;
  meetingTitle: string | null;
  status: 'recording' | 'paused';
  lastHeartbeat: string;    // ISO timestamp
}

export interface PersistedAttendee {
  id: string | number;
  name: string;
  initials: string;
  role: string;
  org: string;
  status: 'present' | 'apologies' | 'absent';
  contact_id?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const STORAGE_KEY = 'notewell_active_recording';
const HEARTBEAT_INTERVAL_MS = 10_000; // 10 seconds
const HEARTBEAT_STALE_THRESHOLD_MS = 30_000; // 30 seconds
const SESSION_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── localStorage persistence ────────────────────────────────────────

export function persistRecordingSession(session: PersistedRecordingSession): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(session));
}

export function getPersistedSession(): PersistedRecordingSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedRecordingSession;
  } catch {
    return null;
  }
}

export function clearPersistedSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function updateHeartbeat(): void {
  const session = getPersistedSession();
  if (!session) return;
  session.lastHeartbeat = new Date().toISOString();
  persistRecordingSession(session);
}

// ─── Session state checks ────────────────────────────────────────────

export function isSessionStale(session: PersistedRecordingSession): boolean {
  const started = new Date(session.startedAt).getTime();
  return Date.now() - started > SESSION_STALE_THRESHOLD_MS;
}

export function isHeartbeatRecent(session: PersistedRecordingSession): boolean {
  const lastBeat = new Date(session.lastHeartbeat).getTime();
  return Date.now() - lastBeat < HEARTBEAT_STALE_THRESHOLD_MS;
}

/**
 * Calculates approximate captured duration from startedAt to lastHeartbeat
 */
export function getApproxCapturedMinutes(session: PersistedRecordingSession): number {
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.lastHeartbeat).getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}

// ─── Heartbeat manager ──────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(): void {
  stopHeartbeat();
  updateHeartbeat();
  heartbeatTimer = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ─── IndexedDB for audio chunks ─────────────────────────────────────

const DB_NAME = 'notewell_recording_recovery';
const DB_VERSION = 1;
const STORE_NAME = 'audio_chunks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioChunk(sessionId: string, chunk: Blob): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({
      sessionId,
      chunk,
      timestamp: Date.now(),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[RecoveryDB] Failed to save audio chunk:', err);
  }
}

export async function getAudioChunks(sessionId: string): Promise<Blob[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    const results = await new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return results
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => r.chunk);
  } catch (err) {
    console.warn('[RecoveryDB] Failed to read audio chunks:', err);
    return [];
  }
}

export async function clearAudioChunks(sessionId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionId');
    const request = index.getAllKeys(sessionId);
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    for (const key of keys) {
      store.delete(key);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[RecoveryDB] Failed to clear audio chunks:', err);
  }
}

export async function clearAllAudioChunks(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[RecoveryDB] Failed to clear all audio chunks:', err);
  }
}
