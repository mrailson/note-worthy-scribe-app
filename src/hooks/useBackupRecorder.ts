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

// Minimum expected bytes per second at 16kbps mono opus
// 16000 bits/s = 2000 bytes/s, but with overhead/compression variance allow 500 bytes/s minimum
const MIN_BYTES_PER_SECOND = 500;

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
  // Track when the last non-trivial data chunk was received
  const lastDataTimestampRef = useRef(0);
  // Track if we've logged a stale-stream warning
  const staleWarningLoggedRef = useRef(false);
  // Health check interval
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Calculate the actual audio duration based on data rate rather than wall-clock time.
   * If the stream went stale (tracks ended/muted), wall-clock duration is inaccurate.
   */
  const estimateActualDuration = useCallback((blobSize: number, wallClockMs: number): number => {
    // At 16kbps opus, expected ~2000 bytes/second
    // Use data-rate estimate if it's significantly less than wall-clock duration
    const dataRateDurationMs = (blobSize / 2000) * 1000;
    const wallClockDurationMs = wallClockMs;

    // If data-rate duration is less than 50% of wall-clock, the stream likely went stale
    if (dataRateDurationMs < wallClockDurationMs * 0.5 && wallClockDurationMs > 30000) {
      console.warn(
        `[BackupRecorder] ⚠️ Data-rate duration (${Math.round(dataRateDurationMs / 1000)}s) ` +
        `much less than wall-clock (${Math.round(wallClockDurationMs / 1000)}s). ` +
        `Audio stream likely went stale. Using data-rate estimate.`
      );
      return dataRateDurationMs;
    }

    return wallClockDurationMs;
  }, []);

  /**
   * Monitor audio track health — detect ended/muted tracks
   */
  const startTrackMonitoring = useCallback((stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();

    for (const track of audioTracks) {
      const trackId = track.id;

      track.addEventListener('ended', () => {
        console.error(
          `[BackupRecorder] ❌ Audio track ENDED: ${track.label} (id: ${trackId}). ` +
          `Backup audio will be incomplete from this point.`
        );
      });

      track.addEventListener('mute', () => {
        console.warn(
          `[BackupRecorder] ⚠️ Audio track MUTED: ${track.label} (id: ${trackId}). ` +
          `Backup may contain silence.`
        );
      });

      track.addEventListener('unmute', () => {
        console.log(
          `[BackupRecorder] ✅ Audio track UNMUTED: ${track.label} (id: ${trackId})`
        );
      });
    }

    // Periodic health check: verify tracks are still alive and data is flowing
    if (healthCheckRef.current) clearInterval(healthCheckRef.current);
    healthCheckRef.current = setInterval(() => {
      const tracks = stream.getAudioTracks();
      const allEnded = tracks.every(t => t.readyState === 'ended');
      const allMuted = tracks.every(t => t.muted);

      if (allEnded) {
        console.error('[BackupRecorder] ❌ All audio tracks have ended — backup stream is dead');
      } else if (allMuted) {
        console.warn('[BackupRecorder] ⚠️ All audio tracks are muted — backup capturing silence');
      }

      // Check data freshness — if no new data in 30s, stream may be stale
      const timeSinceLastData = Date.now() - lastDataTimestampRef.current;
      if (lastDataTimestampRef.current > 0 && timeSinceLastData > 30000 && !isPausedRef.current) {
        if (!staleWarningLoggedRef.current) {
          console.warn(
            `[BackupRecorder] ⚠️ No new audio data received for ${Math.round(timeSinceLastData / 1000)}s ` +
            `— stream may be stale`
          );
          staleWarningLoggedRef.current = true;
        }
      } else {
        staleWarningLoggedRef.current = false;
      }
    }, 15000); // Check every 15 seconds
  }, []);

  const saveCurrentSegment = useCallback(async (recorder: MediaRecorder) => {
    return new Promise<void>((resolve) => {
      // Collect remaining data
      const onStop = async () => {
        recorder.removeEventListener('stop', onStop);
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];

        if (blob.size > 0 && sessionIdRef.current) {
          const segId = generateId();
          const wallClockMs = Date.now() - segmentStartRef.current;
          // Use data-rate-corrected duration instead of pure wall-clock
          const correctedDurationMs = estimateActualDuration(blob.size, wallClockMs);

          console.log(
            `[BackupRecorder] Segment save: blob=${blob.size} bytes, ` +
            `wall-clock=${Math.round(wallClockMs / 1000)}s, ` +
            `corrected=${Math.round(correctedDurationMs / 1000)}s`
          );

          await saveSegment({
            id: segId,
            sessionId: sessionIdRef.current,
            index: segmentIndexRef.current,
            blob,
            durationMs: correctedDurationMs,
            overlapMs: segmentIndexRef.current > 0 ? OVERLAP_MS : 0,
            createdAt: new Date().toISOString(),
          });
          segmentIndexRef.current += 1;
          setSegmentCount(segmentIndexRef.current);

          // Update session metadata
          await updateSession(sessionIdRef.current, {
            segmentCount: segmentIndexRef.current,
            duration: Math.round(correctedDurationMs / 1000),
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
  }, [estimateActualDuration]);

  const startNewSegmentRecorder = useCallback((stream: MediaStream): MediaRecorder => {
    const recorder = new MediaRecorder(stream, {
      mimeType: mimeTypeRef.current,
      audioBitsPerSecond: 16000, // 16kbps mono -- ~7MB/hour
    });
    chunksRef.current = [];
    segmentStartRef.current = Date.now();
    lastDataTimestampRef.current = Date.now();
    staleWarningLoggedRef.current = false;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        lastDataTimestampRef.current = Date.now();
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

    // Start track monitoring for health diagnostics
    startTrackMonitoring(stream);

    recorderRef.current = startNewSegmentRecorder(stream);
    setIsBackupActive(true);
    scheduleRotation();

    console.log('[BackupRecorder] Started backup session:', sessionId);
    return sessionId;
  }, [startNewSegmentRecorder, scheduleRotation, startTrackMonitoring]);

  const stopBackup = useCallback(async (
    transcriptSuccessful: boolean = false,
    userId?: string,
    meetingId?: string,
  ) => {
    console.log('[BackupRecorder] stopBackup called:', { transcriptSuccessful, userId, meetingId, sessionId: sessionIdRef.current });

    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }

    // Stop health check
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current);
      healthCheckRef.current = null;
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
            console.log('[BackupRecorder] Attempting upload on success path...');
            await uploadBackupSegments(sid, userId, meetingId || sid, 'success_backup');
            uploadSucceeded = true;
            console.log('[BackupRecorder] Upload succeeded on success path');
          } catch (err) {
            console.warn('[BackupRecorder] Upload on success failed:', err);
          }
        } else {
          console.log('[BackupRecorder] Skipping upload:', { online: navigator.onLine, hasUserId: !!userId });
        }
        if (uploadSucceeded) {
          // Don't delete session — keep it so badge can show from DB
          await updateSession(sid, { status: 'completed', userId, meetingId: meetingId || sid });
          console.log('[BackupRecorder] Live transcript succeeded — backup uploaded & marked completed');
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
