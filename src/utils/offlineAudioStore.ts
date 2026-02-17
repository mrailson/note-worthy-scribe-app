/**
 * IndexedDB wrapper for offline backup audio sessions and segments.
 * Database: "offline-backups" with two object stores: "sessions" and "segments".
 */

export interface BackupSession {
  id: string;
  meetingId?: string;
  title?: string;
  createdAt: string;
  duration: number; // seconds
  segmentCount: number;
  format: string;
  status: 'recording' | 'pending' | 'pending_upload' | 'processing' | 'completed' | 'error';
  transcript?: string;
  errorMessage?: string;
  remoteFilePaths?: string[];
  userId?: string;
}

export interface BackupSegment {
  id: string;
  sessionId: string;
  index: number;
  blob: Blob;
  durationMs: number;
  overlapMs: number;
  createdAt: string;
}

const DB_NAME = 'offline-backups';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const SEGMENTS_STORE = 'segments';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SEGMENTS_STORE)) {
        const segStore = db.createObjectStore(SEGMENTS_STORE, { keyPath: 'id' });
        segStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function createSession(session: BackupSession): Promise<void> {
  const db = await openDB();
  await req(tx(db, SESSIONS_STORE, 'readwrite').put(session));
  db.close();
}

export async function updateSession(id: string, updates: Partial<BackupSession>): Promise<void> {
  const db = await openDB();
  const store = tx(db, SESSIONS_STORE, 'readwrite');
  const existing = await req<BackupSession | undefined>(store.get(id));
  if (existing) {
    await req(store.put({ ...existing, ...updates }));
  }
  db.close();
}

export async function getSession(id: string): Promise<BackupSession | undefined> {
  const db = await openDB();
  const result = await req<BackupSession | undefined>(tx(db, SESSIONS_STORE, 'readonly').get(id));
  db.close();
  return result;
}

export async function listPendingSessions(): Promise<BackupSession[]> {
  const db = await openDB();
  const all = await req<BackupSession[]>(tx(db, SESSIONS_STORE, 'readonly').getAll());
  db.close();
  return all.filter(s => s.status === 'pending' || s.status === 'pending_upload' || s.status === 'error');
}

export async function listAllSessions(): Promise<BackupSession[]> {
  const db = await openDB();
  const all = await req<BackupSession[]>(tx(db, SESSIONS_STORE, 'readonly').getAll());
  db.close();
  return all;
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDB();
  // Delete all segments for this session
  const segStore = db.transaction(SEGMENTS_STORE, 'readwrite').objectStore(SEGMENTS_STORE);
  const index = segStore.index('sessionId');
  const segKeys = await req<IDBValidKey[]>(index.getAllKeys(id));
  for (const key of segKeys) {
    segStore.delete(key);
  }
  // Delete session
  await req(tx(db, SESSIONS_STORE, 'readwrite').delete(id));
  db.close();
}

export async function saveSegment(segment: BackupSegment): Promise<void> {
  const db = await openDB();
  await req(tx(db, SEGMENTS_STORE, 'readwrite').put(segment));
  db.close();
}

export async function getSegments(sessionId: string): Promise<BackupSegment[]> {
  const db = await openDB();
  const store = db.transaction(SEGMENTS_STORE, 'readonly').objectStore(SEGMENTS_STORE);
  const index = store.index('sessionId');
  const segments = await req<BackupSegment[]>(index.getAll(sessionId));
  db.close();
  return segments.sort((a, b) => a.index - b.index);
}

export async function clearCompletedSessions(): Promise<void> {
  const db = await openDB();
  const all = await req<BackupSession[]>(tx(db, SESSIONS_STORE, 'readonly').getAll());
  for (const session of all) {
    if (session.status === 'completed') {
      await deleteSession(session.id);
    }
  }
  db.close();
}
