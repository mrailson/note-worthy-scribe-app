// ─────────────────────────────────────────────
// utils/syncRecordings.ts
// Finds all locally-stored recordings and uploads them to Supabase.
// Called automatically by ConnectionToggle after login or on app load.
//
// Adjusted to match the existing NoteWell schema:
//   IndexedDB: "notewell_recordings_v1" / store "recordings"
//   Supabase table: "meetings"
// ─────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

interface PendingRecording {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
  title?: string;
}

// ── IndexedDB config — matches NoteWellRecorderMobile.jsx ─────────────────
const DB_NAME = "notewell_recordings_v1";
const STORE   = "recordings";

// ── Load pending recordings from IndexedDB ────────────────────────────────

async function loadPendingRecordings(): Promise<PendingRecording[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        resolve([]);
        return;
      }
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => resolve(getAllRequest.result ?? []);
      getAllRequest.onerror = () => resolve([]);
    };

    request.onerror = () => resolve([]);
  });
}

// ── Remove a synced recording from the local store ────────────────────────

async function removePendingRecording(id: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        resolve();
        return;
      }
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
    };
    request.onerror = () => resolve();
  });
}

// ── Upload a single recording to Supabase ─────────────────────────────────

async function uploadRecording(recording: PendingRecording): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Determine duration in minutes from metadata if available
  const durationMins = Math.round(
    (new Date().getTime() - new Date(recording.createdAt).getTime()) / 60000
  );

  // Insert as a meeting — matches the existing recorder sync pattern
  const { error: insertError } = await supabase
    .from("meetings")
    .upsert({
      id: recording.id,
      user_id: user.id,
      title: recording.title ?? `Mobile Recording ${new Date(recording.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      status: "completed",
      meeting_type: "general",
      start_time: new Date(recording.createdAt).toISOString(),
      end_time: new Date().toISOString(),
      duration_minutes: durationMins,
      import_source: "mobile_offline",
      primary_transcript_source: "whisper",
    });

  if (insertError) throw insertError;
}

// ── Main export ───────────────────────────────────────────────────────────

export async function syncPendingRecordings(): Promise<{ synced: number; failed: number }> {
  const pending = await loadPendingRecordings();

  let synced = 0;
  let failed = 0;

  for (const recording of pending) {
    try {
      await uploadRecording(recording);
      await removePendingRecording(recording.id);
      synced++;
    } catch (err) {
      console.error(`Failed to sync recording ${recording.id}:`, err);
      failed++;
    }
  }

  console.log(`Sync complete: ${synced} uploaded, ${failed} failed`);
  return { synced, failed };
}

// ── Helper: save a new recording locally (call this from your recorder) ──

export async function savePendingRecording(
  blob: Blob,
  mimeType: string,
  title?: string
): Promise<string> {
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add({
        id,
        blob,
        mimeType,
        title,
        createdAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
}

// ── Helper: count how many recordings are waiting to sync ─────────────────

export async function countPendingRecordings(): Promise<number> {
  const pending = await loadPendingRecordings();
  return pending.length;
}
