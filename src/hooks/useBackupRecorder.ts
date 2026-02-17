import { useState, useRef, useCallback } from 'react';
import {
  createSession,
  updateSession,
  saveSegment,
  deleteSession,
  type BackupSession,
} from '@/utils/offlineAudioStore';
import { uploadBackupSegments } from '@/utils/backupUploader';

const MAX_SEGMENT_MS = 60 * 60 * 1000; // 60 minutes
const OVERLAP_MS = 10_000; // 10 seconds
const ROTATE_LEAD_MS = OVERLAP_MS; // start new recorder 10s before stopping old

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getBackupMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const t of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    } catch {}
  }
  return 'audio/webm';
}

export function useBackupRecorder() {
  const [isBackupActive, setIsBackupActive] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const segmentIndexRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentStartRef = useRef(0);
  const mimeTypeRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isPausedRef = useRef(false);

  const saveCurrentSegment = useCallback(async (recorder: MediaRecorder) => {
    return new Promise<void>((resolve) => {
      // Collect remaining data
      const onStop = async () => {
        recorder.removeEventListener('stop', onStop);
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];

        if (blob.size > 0 && sessionIdRef.current) {
          const segId = generateId();
          const durationMs = Date.now() - segmentStartRef.current;
          await saveSegment({
            id: segId,
            sessionId: sessionIdRef.current,
            index: segmentIndexRef.current,
            blob,
            durationMs,
            overlapMs: segmentIndexRef.current > 0 ? OVERLAP_MS : 0,
            createdAt: new Date().toISOString(),
          });
          segmentIndexRef.current += 1;
          setSegmentCount(segmentIndexRef.current);

          // Update session metadata
          await updateSession(sessionIdRef.current, {
            segmentCount: segmentIndexRef.current,
            duration: Math.round(durationMs / 1000),
          });
        }
        resolve();
      };

      recorder.addEventListener('stop', onStop);
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        recorder.removeEventListener('stop', onStop);
        resolve();
      }
    });
  }, []);

  const startNewSegmentRecorder = useCallback((stream: MediaStream): MediaRecorder => {
    const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
    chunksRef.current = [];
    segmentStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start(5000); // collect data every 5s for reliability
    return recorder;
  }, []);

  const scheduleRotation = useCallback(() => {
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);

    // Start new recorder at (MAX - OVERLAP) so both run for 10s overlap
    rotationTimerRef.current = setTimeout(async () => {
      if (!streamRef.current || !isBackupActive) return;

      const oldRecorder = recorderRef.current;

      // Try to start new recorder before stopping old (dual-recorder overlap)
      try {
        const newRecorder = startNewSegmentRecorder(streamRef.current);
        recorderRef.current = newRecorder;

        // Stop old recorder after overlap period
        setTimeout(async () => {
          if (oldRecorder && oldRecorder.state !== 'inactive') {
            await saveCurrentSegment(oldRecorder);
          }
        }, OVERLAP_MS);
      } catch {
        // iOS fallback: stop old first, then start new (no overlap, but safe)
        if (oldRecorder) {
          await saveCurrentSegment(oldRecorder);
        }
        recorderRef.current = startNewSegmentRecorder(streamRef.current);
      }

      // Schedule next rotation
      scheduleRotation();
    }, MAX_SEGMENT_MS - ROTATE_LEAD_MS);
  }, [isBackupActive, saveCurrentSegment, startNewSegmentRecorder]);

  const startBackup = useCallback(async (stream: MediaStream): Promise<string> => {
    const sessionId = generateId();
    sessionIdRef.current = sessionId;
    segmentIndexRef.current = 0;
    setSegmentCount(0);
    streamRef.current = stream;
    mimeTypeRef.current = getBackupMimeType();
    isPausedRef.current = false;

    const session: BackupSession = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      duration: 0,
      segmentCount: 0,
      format: mimeTypeRef.current,
      status: 'recording',
    };
    await createSession(session);

    recorderRef.current = startNewSegmentRecorder(stream);
    setIsBackupActive(true);
    scheduleRotation();

    console.log('[BackupRecorder] Started backup session:', sessionId);
    return sessionId;
  }, [startNewSegmentRecorder, scheduleRotation]);

  const stopBackup = useCallback(async (
    transcriptSuccessful: boolean = false,
    userId?: string,
    meetingId?: string,
  ) => {
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      await saveCurrentSegment(recorderRef.current);
    }
    recorderRef.current = null;
    setIsBackupActive(false);

    const sid = sessionIdRef.current;

    if (sid) {
      if (transcriptSuccessful) {
        // Try to upload even on success — 24h retention safety net
        let uploadSucceeded = false;
        if (navigator.onLine && userId) {
          try {
            await uploadBackupSegments(sid, userId, meetingId || sid, 'success_backup');
            uploadSucceeded = true;
          } catch (err) {
            console.warn('[BackupRecorder] Upload on success failed:', err);
          }
        }
        if (uploadSucceeded) {
          await deleteSession(sid);
          console.log('[BackupRecorder] Live transcript succeeded — backup uploaded & local deleted');
        } else {
          // Keep local copy and mark for deferred upload
          await updateSession(sid, { status: 'pending_upload', userId, meetingId: meetingId || sid });
          console.log('[BackupRecorder] Upload failed on success path — kept local, marked pending_upload');
        }
      } else {
        // Update with user/meeting info for deferred upload
        await updateSession(sid, {
          userId,
          meetingId: meetingId || sid,
        });

        if (navigator.onLine && userId) {
          try {
            await uploadBackupSegments(sid, userId, meetingId || sid, 'transcript_failure');
            await updateSession(sid, { status: 'pending' });
            console.log('[BackupRecorder] Backup uploaded, session pending for processing');
          } catch (err) {
            console.warn('[BackupRecorder] Upload failed, marking pending_upload:', err);
            await updateSession(sid, { status: 'pending_upload' });
          }
        } else {
          await updateSession(sid, { status: 'pending_upload' });
          console.log('[BackupRecorder] Offline — marked pending_upload for later');
        }
      }
    }

    sessionIdRef.current = null;
    streamRef.current = null;
  }, [saveCurrentSegment]);

  const pauseBackup = useCallback(() => {
    isPausedRef.current = true;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
    }
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
  }, []);

  const resumeBackup = useCallback(() => {
    isPausedRef.current = false;
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
    }
    scheduleRotation();
  }, [scheduleRotation]);

  return {
    isBackupActive,
    segmentCount,
    startBackup,
    stopBackup,
    pauseBackup,
    resumeBackup,
    sessionId: sessionIdRef.current,
  };
}
