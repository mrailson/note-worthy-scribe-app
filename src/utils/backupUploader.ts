/**
 * Uploads backup audio segments from IndexedDB to Supabase Storage
 * and records metadata in meeting_audio_backups table.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  getSegments,
  getSession,
  updateSession,
  listAllSessions,
  type BackupSession,
} from '@/utils/offlineAudioStore';

function getExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export async function uploadBackupSegments(
  sessionId: string,
  userId: string,
  meetingId: string,
  backupReason?: string,
): Promise<string[]> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Backup session not found');

  const segments = await getSegments(sessionId);
  if (segments.length === 0) throw new Error('No segments to upload');

  const ext = getExtension(session.format);
  const uploadedPaths: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const storagePath = `${userId}/${meetingId}/backup-segment-${i}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('meeting-audio-backups')
      .upload(storagePath, segments[i].blob, {
        contentType: session.format || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[BackupUploader] Failed to upload segment ${i}:`, {
        message: uploadError.message,
        statusCode: (uploadError as any).statusCode,
        error: uploadError,
        storagePath,
        bucketId: 'meeting-audio-backups',
        contentType: session.format || 'audio/webm',
        blobSize: segments[i].blob.size,
      });
      throw uploadError;
    }

    uploadedPaths.push(storagePath);
  }

  // Insert a single metadata record for the whole backup
  const totalDurationSeconds = Math.round(
    segments.reduce((sum, s) => sum + s.durationMs, 0) / 1000
  );
  const totalSize = segments.reduce((sum, s) => sum + s.blob.size, 0);

  const { error: metaError } = await supabase
    .from('meeting_audio_backups')
    .insert({
      meeting_id: meetingId,
      user_id: userId,
      file_path: uploadedPaths[0], // primary path; all segments share the folder
      file_size: totalSize,
      duration_seconds: totalDurationSeconds,
      backup_reason: backupReason || 'offline_backup',
    });

  if (metaError) {
    console.error('[BackupUploader] Failed to insert metadata:', metaError);
    // Don't throw — files are uploaded, metadata is secondary
  }

  // Update IndexedDB session with remote paths
  await updateSession(sessionId, {
    remoteFilePaths: uploadedPaths,
    status: 'pending',
  });

  console.log(`[BackupUploader] Uploaded ${uploadedPaths.length} segments for session ${sessionId}`);
  return uploadedPaths;
}

/**
 * Finds sessions marked as pending_upload and attempts to upload them.
 */
export async function uploadPendingBackups(): Promise<void> {
  if (!navigator.onLine) return;

  const allSessions = await listAllSessions();
  const pending = allSessions.filter(
    (s) => s.status === 'pending_upload' && s.userId
  );

  for (const session of pending) {
    try {
      await uploadBackupSegments(
        session.id,
        session.userId!,
        session.meetingId || session.id,
        'deferred_upload',
      );
    } catch (err) {
      console.warn('[BackupUploader] Deferred upload failed for', session.id, err);
    }
  }
}
