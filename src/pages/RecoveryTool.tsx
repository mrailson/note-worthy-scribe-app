import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listAllSessions, getSegments, updateSession, deleteSession, type BackupSession, type BackupSegment } from '@/utils/offlineAudioStore';

/**
 * Emergency IndexedDB Recovery Tool
 * 
 * Scans both IndexedDB databases used by the recorder:
 *  1. "offline-backups" — sessions + segments (offlineAudioStore)
 *  2. "notewell_recording_recovery" — audio_chunks (recordingSessionPersistence)
 * 
 * Allows inspecting, downloading, and force-uploading stranded recordings.
 */

interface RecoveryChunk {
  id: number;
  sessionId: string;
  chunk: Blob;
  timestamp: number;
}

interface RecoveryDBSession {
  source: 'offline-backups' | 'notewell_recording_recovery';
  sessionId: string;
  session?: BackupSession;
  segments?: BackupSegment[];
  chunks?: RecoveryChunk[];
  totalSize: number;
  totalDuration: number;
  createdAt: string;
}

// Read all from notewell_recording_recovery DB
async function readRecoveryDB(): Promise<RecoveryChunk[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open('notewell_recording_recovery', 1);
    request.onerror = () => resolve([]);
    request.onupgradeneeded = () => {
      // DB doesn't exist yet, nothing to recover
      request.result.close();
      resolve([]);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('audio_chunks')) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction('audio_chunks', 'readonly');
      const store = tx.objectStore('audio_chunks');
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve(getAll.result || []);
      };
      getAll.onerror = () => {
        db.close();
        resolve([]);
      };
    };
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function RecoveryToolPage() {
  const [sessions, setSessions] = useState<RecoveryDBSession[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [lsSession, setLsSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    // Check localStorage for active recording session
    try {
      const raw = localStorage.getItem('notewell_active_recording');
      if (raw) setLsSession(JSON.parse(raw));
    } catch {}
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    const found: RecoveryDBSession[] = [];

    // 1. Scan offline-backups (offlineAudioStore)
    try {
      const allSessions = await listAllSessions();
      for (const session of allSessions) {
        const segments = await getSegments(session.id);
        const totalSize = segments.reduce((sum, s) => sum + (s.blob?.size || 0), 0);
        const totalDuration = segments.reduce((sum, s) => sum + (s.durationMs || 0), 0) / 1000;
        found.push({
          source: 'offline-backups',
          sessionId: session.id,
          session,
          segments,
          totalSize,
          totalDuration: totalDuration || session.duration || 0,
          createdAt: session.createdAt,
        });
      }
    } catch (err) {
      console.warn('Failed to scan offline-backups:', err);
    }

    // 2. Scan notewell_recording_recovery
    try {
      const chunks = await readRecoveryDB();
      if (chunks.length > 0) {
        // Group by sessionId
        const grouped: Record<string, RecoveryChunk[]> = {};
        for (const chunk of chunks) {
          const sid = chunk.sessionId || 'unknown';
          if (!grouped[sid]) grouped[sid] = [];
          grouped[sid].push(chunk);
        }
        for (const [sid, chunkList] of Object.entries(grouped)) {
          const sorted = chunkList.sort((a, b) => a.timestamp - b.timestamp);
          const totalSize = sorted.reduce((sum, c) => sum + (c.chunk?.size || 0), 0);
          found.push({
            source: 'notewell_recording_recovery',
            sessionId: sid,
            chunks: sorted,
            totalSize,
            totalDuration: 0,
            createdAt: sorted[0]?.timestamp ? new Date(sorted[0].timestamp).toISOString() : 'Unknown',
          });
        }
      }
    } catch (err) {
      console.warn('Failed to scan notewell_recording_recovery:', err);
    }

    setSessions(found);
    setScanned(true);
    setScanning(false);
  }, []);

  const downloadSession = useCallback(async (s: RecoveryDBSession) => {
    let blobs: Blob[] = [];
    let mimeType = 'audio/webm';

    if (s.source === 'offline-backups' && s.segments) {
      blobs = s.segments.map(seg => seg.blob);
      mimeType = s.session?.format || 'audio/webm';
    } else if (s.chunks) {
      blobs = s.chunks.map(c => c.chunk);
    }

    if (blobs.length === 0) {
      alert('No audio data found for this session.');
      return;
    }

    const merged = new Blob(blobs, { type: mimeType });
    const url = URL.createObjectURL(merged);
    const a = document.createElement('a');
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    a.href = url;
    a.download = `recovery-${s.sessionId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const uploadSession = useCallback(async (s: RecoveryDBSession) => {
    if (!user) {
      alert('You must be logged in to upload. Please log in first.');
      return;
    }

    setUploadingId(s.sessionId);
    setUploadStatus(prev => ({ ...prev, [s.sessionId]: 'Preparing upload...' }));

    try {
      let blobs: Blob[] = [];
      let mimeType = 'audio/webm';

      if (s.source === 'offline-backups' && s.segments) {
        blobs = s.segments.map(seg => seg.blob);
        mimeType = s.session?.format || 'audio/webm';
      } else if (s.chunks) {
        blobs = s.chunks.map(c => c.chunk);
      }

      if (blobs.length === 0) {
        throw new Error('No audio data found');
      }

      // Create a meeting record first
      const now = new Date().toISOString();
      const title = s.session?.title || `Recovered Recording ${new Date(s.createdAt).toLocaleDateString('en-GB')}`;
      
      setUploadStatus(prev => ({ ...prev, [s.sessionId]: 'Creating meeting record...' }));

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title,
          status: 'processing',
          start_time: s.createdAt,
          duration_minutes: Math.round(s.totalDuration / 60) || 1,
          word_count: 0,
        })
        .select('id')
        .single();

      if (meetingError) throw meetingError;

      const meetingId = meeting.id;
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';

      // Upload each segment as a backup
      for (let i = 0; i < blobs.length; i++) {
        setUploadStatus(prev => ({ ...prev, [s.sessionId]: `Uploading segment ${i + 1}/${blobs.length}...` }));
        const storagePath = `${user.id}/${meetingId}/backup-segment-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('meeting-audio-backups')
          .upload(storagePath, blobs[i], {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload failed for segment ${i}:`, uploadError);
          throw uploadError;
        }
      }

      // Insert backup metadata
      const totalSize = blobs.reduce((sum, b) => sum + b.size, 0);
      setUploadStatus(prev => ({ ...prev, [s.sessionId]: 'Saving metadata...' }));

      await supabase.from('meeting_audio_backups').insert({
        meeting_id: meetingId,
        user_id: user.id,
        file_path: `${user.id}/${meetingId}/backup-segment-0.${ext}`,
        file_size: totalSize,
        duration_seconds: Math.round(s.totalDuration) || 0,
        backup_reason: 'emergency_recovery',
      });

      // If this was from offline-backups, update the session status
      if (s.source === 'offline-backups') {
        await updateSession(s.sessionId, { status: 'completed', meetingId });
      }

      setUploadStatus(prev => ({ ...prev, [s.sessionId]: `✅ Uploaded! Meeting ID: ${meetingId}` }));
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadStatus(prev => ({ ...prev, [s.sessionId]: `❌ Failed: ${err.message}` }));
    } finally {
      setUploadingId(null);
    }
  }, [user]);

  return (
    <div style={{ 
      padding: '16px', 
      maxWidth: 600, 
      margin: '0 auto', 
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      color: '#1a1a2e'
    }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🔧 Recording Recovery Tool</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Scans IndexedDB for stranded offline recordings that weren't synced to the server.
      </p>

      {/* Auth status */}
      <div style={{ 
        padding: '10px 14px', 
        borderRadius: 8, 
        marginBottom: 16,
        fontSize: 13,
        background: user ? '#e8f5e9' : '#fff3e0',
        border: `1px solid ${user ? '#a5d6a7' : '#ffcc80'}`,
      }}>
        {user ? (
          <>✅ Logged in as <strong>{user.email}</strong></>
        ) : (
          <>⚠️ Not logged in — you can scan and download, but uploading requires login.</>
        )}
      </div>

      {/* localStorage session */}
      {lsSession && (
        <div style={{ 
          padding: '10px 14px', 
          borderRadius: 8, 
          marginBottom: 16,
          fontSize: 13,
          background: '#e3f2fd',
          border: '1px solid #90caf9',
        }}>
          <strong>📋 Active session in localStorage:</strong>
          <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            Session ID: {lsSession.sessionId}<br />
            Title: {lsSession.meetingTitle || '(none)'}<br />
            Status: {lsSession.status}<br />
            Started: {new Date(lsSession.startedAt).toLocaleString('en-GB')}<br />
            Last heartbeat: {new Date(lsSession.lastHeartbeat).toLocaleString('en-GB')}
          </div>
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={scan}
        disabled={scanning}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 10,
          border: 'none',
          background: scanning ? '#ccc' : '#1a73e8',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: scanning ? 'wait' : 'pointer',
          marginBottom: 20,
        }}
      >
        {scanning ? '🔍 Scanning IndexedDB...' : scanned ? '🔄 Re-scan IndexedDB' : '🔍 Scan for Lost Recordings'}
      </button>

      {/* Results */}
      {scanned && sessions.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: 30, 
          color: '#999',
          background: '#f5f5f5',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 14 }}>No recordings found in IndexedDB on this device.</div>
          <div style={{ fontSize: 12, marginTop: 8, color: '#aaa' }}>
            Make sure you're using the same browser that was used to record.
          </div>
        </div>
      )}

      {sessions.map((s) => (
        <div
          key={`${s.source}-${s.sessionId}`}
          style={{
            border: '1px solid #e0e0e0',
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {s.session?.title || `Session ${s.sessionId.slice(0, 8)}...`}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                Source: {s.source === 'offline-backups' ? '📦 Offline Backups DB' : '🔄 Recovery DB'}
              </div>
            </div>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: s.session?.status === 'completed' ? '#e8f5e9' : '#fff3e0',
              color: s.session?.status === 'completed' ? '#2e7d32' : '#e65100',
              fontWeight: 600,
            }}>
              {s.session?.status || 'unknown'}
            </span>
          </div>

          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
            <div>📅 Created: {new Date(s.createdAt).toLocaleString('en-GB')}</div>
            <div>📊 Segments: {s.segments?.length || s.chunks?.length || 0}</div>
            <div>💾 Size: {formatBytes(s.totalSize)}</div>
            {s.totalDuration > 0 && <div>⏱️ Duration: {formatDuration(s.totalDuration)}</div>}
            {s.session?.format && <div>🎵 Format: {s.session.format}</div>}
            {s.session?.meetingId && <div>🔗 Meeting ID: {s.session.meetingId}</div>}
            {s.session?.userId && <div>👤 User ID: {s.session.userId}</div>}
          </div>

          {/* Upload status */}
          {uploadStatus[s.sessionId] && (
            <div style={{ 
              marginTop: 8, 
              padding: '6px 10px', 
              borderRadius: 6, 
              fontSize: 12,
              background: uploadStatus[s.sessionId].startsWith('✅') ? '#e8f5e9' 
                : uploadStatus[s.sessionId].startsWith('❌') ? '#fce4ec' 
                : '#e3f2fd',
            }}>
              {uploadStatus[s.sessionId]}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => downloadSession(s)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: '1px solid #1a73e8',
                background: '#fff',
                color: '#1a73e8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⬇️ Download
            </button>
            <button
              onClick={() => uploadSession(s)}
              disabled={!user || uploadingId === s.sessionId}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: 'none',
                background: !user ? '#ccc' : '#1a73e8',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: !user ? 'not-allowed' : 'pointer',
              }}
            >
              {uploadingId === s.sessionId ? '⏳ Uploading...' : '☁️ Upload'}
            </button>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 24, fontSize: 11, color: '#aaa', textAlign: 'center', paddingBottom: 40 }}>
        This tool reads data directly from this browser's IndexedDB. It must be run on the same device and browser that was used to record.
      </div>
    </div>
  );
}
