import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listAllSessions, getSegments, updateSession, type BackupSession, type BackupSegment } from '@/utils/offlineAudioStore';

interface RecoveryChunk {
  id: number;
  sessionId: string;
  chunk: Blob;
  timestamp: number;
}

interface MobileRecordingChunk {
  index: number;
  arrayBuffer: ArrayBuffer;
  mimeType?: string;
  durationMs?: number;
}

interface MobileRecording {
  id: string;
  title?: string;
  createdAt: number | string;
  duration?: number;
  size?: number;
  mimeType?: string;
  audioData?: ArrayBuffer;
  chunks?: MobileRecordingChunk[];
  chunkCount?: number;
  status?: string;
  capturedLiveTranscript?: string;
  meetingId?: string;
}

interface RecoveryDBSession {
  source: 'offline-backups' | 'notewell_recording_recovery' | 'notewell_recordings_v1';
  sessionId: string;
  session?: BackupSession;
  segments?: BackupSegment[];
  chunks?: RecoveryChunk[];
  mobileRecording?: MobileRecording;
  totalSize: number;
  totalDuration: number;
  createdAt: string;
}

async function readRecoveryDB(): Promise<RecoveryChunk[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open('notewell_recording_recovery', 1);
    request.onerror = () => resolve([]);
    request.onupgradeneeded = () => {
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

async function readMobileRecorderDB(): Promise<MobileRecording[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open('notewell_recordings_v1', 1);
    request.onerror = () => resolve([]);
    request.onupgradeneeded = () => {
      request.result.close();
      resolve([]);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('recordings')) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve((getAll.result || []) as MobileRecording[]);
      };
      getAll.onerror = () => {
        db.close();
        resolve([]);
      };
    };
  });
}

function buildMobileRecordingBlobs(recording: MobileRecording): { blobs: Blob[]; mimeType: string } {
  if (Array.isArray(recording.chunks) && recording.chunks.length > 0) {
    const mimeType = recording.mimeType || recording.chunks[0]?.mimeType || 'audio/webm';
    return {
      blobs: recording.chunks.map((chunk) => new Blob([chunk.arrayBuffer], { type: chunk.mimeType || mimeType })),
      mimeType,
    };
  }

  if (recording.audioData) {
    const mimeType = recording.mimeType || 'audio/webm';
    return {
      blobs: [new Blob([recording.audioData], { type: mimeType })],
      mimeType,
    };
  }

  return { blobs: [], mimeType: recording.mimeType || 'audio/webm' };
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

function getSessionBlobs(s: RecoveryDBSession): { blobs: Blob[]; mimeType: string } {
  if (s.source === 'offline-backups' && s.segments) {
    return {
      blobs: s.segments.map((seg) => seg.blob),
      mimeType: s.session?.format || 'audio/webm',
    };
  }

  if (s.source === 'notewell_recording_recovery' && s.chunks) {
    return {
      blobs: s.chunks.map((chunk) => chunk.chunk),
      mimeType: 'audio/webm',
    };
  }

  if (s.source === 'notewell_recordings_v1' && s.mobileRecording) {
    return buildMobileRecordingBlobs(s.mobileRecording);
  }

  return { blobs: [], mimeType: 'audio/webm' };
}

function getSessionTitle(s: RecoveryDBSession): string {
  return s.session?.title || s.mobileRecording?.title || `Session ${s.sessionId.slice(0, 8)}...`;
}

function getSessionStatus(s: RecoveryDBSession): string {
  return s.session?.status || s.mobileRecording?.status || 'unknown';
}

function getSourceLabel(source: RecoveryDBSession['source']): string {
  if (source === 'offline-backups') return '📦 Offline Backups DB';
  if (source === 'notewell_recordings_v1') return '📱 iPhone Offline Recorder DB';
  return '🔄 Recovery DB';
}

export default function RecoveryToolPage() {
  const [sessions, setSessions] = useState<RecoveryDBSession[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [lsSession, setLsSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    try {
      const raw = localStorage.getItem('notewell_active_recording');
      if (raw) setLsSession(JSON.parse(raw));
    } catch {}
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    const found: RecoveryDBSession[] = [];

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

    try {
      const chunks = await readRecoveryDB();
      if (chunks.length > 0) {
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
            createdAt: sorted[0]?.timestamp ? new Date(sorted[0].timestamp).toISOString() : new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn('Failed to scan notewell_recording_recovery:', err);
    }

    try {
      const mobileRecordings = await readMobileRecorderDB();
      for (const recording of mobileRecordings) {
        const { blobs } = buildMobileRecordingBlobs(recording);
        const totalSize = recording.size || blobs.reduce((sum, blob) => sum + blob.size, 0);
        const totalDuration = recording.duration || 0;
        found.push({
          source: 'notewell_recordings_v1',
          sessionId: recording.id,
          mobileRecording: recording,
          totalSize,
          totalDuration,
          createdAt: new Date(recording.createdAt).toISOString(),
        });
      }
    } catch (err) {
      console.warn('Failed to scan notewell_recordings_v1:', err);
    }

    found.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setSessions(found);
    setScanned(true);
    setScanning(false);
  }, []);

  const downloadSession = useCallback(async (s: RecoveryDBSession) => {
    const { blobs, mimeType } = getSessionBlobs(s);

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
      const { blobs, mimeType } = getSessionBlobs(s);

      if (blobs.length === 0) {
        throw new Error('No audio data found');
      }

      const title = getSessionTitle(s) || `Recovered Recording ${new Date(s.createdAt).toLocaleDateString('en-GB')}`;

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

      for (let i = 0; i < blobs.length; i++) {
        setUploadStatus(prev => ({ ...prev, [s.sessionId]: `Uploading segment ${i + 1}/${blobs.length}...` }));
        const storagePath = `${user.id}/${meetingId}/backup-segment-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('meeting-audio-backups')
          .upload(storagePath, blobs[i], {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) throw uploadError;
      }

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

  const emailSession = useCallback(async (s: RecoveryDBSession) => {
    if (!user) {
      alert('You must be logged in to email files. Please log in first.');
      return;
    }

    setEmailingId(s.sessionId);
    setUploadStatus(prev => ({ ...prev, [s.sessionId]: '📧 Preparing email...' }));

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user.id)
        .single();

      if (!profile?.email) {
        throw new Error('No email address found in your profile');
      }

      const { blobs, mimeType } = getSessionBlobs(s);
      if (blobs.length === 0) throw new Error('No audio data found');

      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const title = getSessionTitle(s);

      // Convert blobs to base64 and batch to stay under 15MB per email
      const MAX_RAW_PER_EMAIL = 10.9 * 1024 * 1024;
      const chunkData: { base64: string; rawSize: number; index: number }[] = [];

      for (let i = 0; i < blobs.length; i++) {
        const buf = await blobs[i].arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        chunkData.push({ base64: btoa(binary), rawSize: buf.byteLength, index: i });
      }

      const batches: typeof chunkData[] = [];
      let currentBatch: typeof chunkData = [];
      let currentSize = 0;
      for (const chunk of chunkData) {
        if (currentSize + chunk.rawSize > MAX_RAW_PER_EMAIL && currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentSize = 0;
        }
        currentBatch.push(chunk);
        currentSize += chunk.rawSize;
      }
      if (currentBatch.length > 0) batches.push(currentBatch);

      const totalEmails = batches.length;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const partLabel = totalEmails > 1 ? ` — Part ${i + 1} of ${totalEmails}` : '';
        setUploadStatus(prev => ({ ...prev, [s.sessionId]: `📧 Sending email${totalEmails > 1 ? ` ${i + 1} of ${totalEmails}` : ''}...` }));

        const extraAttachments = batch.map((ch) => ({
          content: ch.base64,
          filename: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_chunk${ch.index + 1}.${ext}`,
          type: mimeType,
        }));

        const totalSizeMB = (batch.reduce((sum, ch) => sum + ch.rawSize, 0) / (1024 * 1024)).toFixed(1);
        const htmlContent = `
          <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto">
            <h2 style="color:#1565c0;margin-bottom:12px">🔧 Recovery Tool — ${title}${partLabel}</h2>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Attached ${batch.length === 1 ? 'is 1 audio file' : `are ${batch.length} audio files`}
              recovered from IndexedDB for <strong>"${title}"</strong>.
            </p>
            <p style="color:#64748b;font-size:13px">
              Size: ${formatBytes(s.totalSize)}${s.totalDuration > 0 ? ` · Duration: ${formatDuration(s.totalDuration)}` : ''}
              ${totalEmails > 1 ? ` · This is part ${i + 1} of ${totalEmails} (${totalSizeMB} MB)` : ''}
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
            <p style="color:#94a3b8;font-size:11px">Sent from Notewell AI Recovery Tool</p>
          </div>
        `;

        const { data, error } = await supabase.functions.invoke('send-meeting-email-resend', {
          body: {
            to_email: profile.email,
            subject: `Recovery: ${title}${partLabel}`,
            html_content: htmlContent,
            from_name: 'Notewell AI',
            extra_attachments: extraAttachments,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Email send failed');
      }

      setUploadStatus(prev => ({ ...prev, [s.sessionId]: totalEmails > 1 ? `✅ Audio sent across ${totalEmails} emails` : '✅ Audio emailed successfully' }));
    } catch (err: any) {
      console.error('Email failed:', err);
      setUploadStatus(prev => ({ ...prev, [s.sessionId]: `❌ Email failed: ${err.message}` }));
    } finally {
      setEmailingId(null);
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
        Scans IndexedDB for stranded offline recordings that were not synced to the server.
      </p>

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
            Make sure you are using the same browser that was used to record.
          </div>
        </div>
      )}

      {sessions.map((s) => {
        const status = getSessionStatus(s);
        const segmentCount = s.segments?.length || s.chunks?.length || s.mobileRecording?.chunkCount || s.mobileRecording?.chunks?.length || 0;

        return (
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
                  {getSessionTitle(s)}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  Source: {getSourceLabel(s.source)}
                </div>
              </div>
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: status === 'completed' || status === 'transcribed' ? '#e8f5e9' : '#fff3e0',
                color: status === 'completed' || status === 'transcribed' ? '#2e7d32' : '#e65100',
                fontWeight: 600,
              }}>
                {status}
              </span>
            </div>

            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
              <div>📅 Created: {new Date(s.createdAt).toLocaleString('en-GB')}</div>
              <div>📊 Segments: {segmentCount}</div>
              <div>💾 Size: {formatBytes(s.totalSize)}</div>
              {s.totalDuration > 0 && <div>⏱️ Duration: {formatDuration(s.totalDuration)}</div>}
              {s.session?.format && <div>🎵 Format: {s.session.format}</div>}
              {s.mobileRecording?.mimeType && <div>🎵 Format: {s.mobileRecording.mimeType}</div>}
              {s.session?.meetingId && <div>🔗 Meeting ID: {s.session.meetingId}</div>}
              {s.mobileRecording?.meetingId && <div>🔗 Meeting ID: {s.mobileRecording.meetingId}</div>}
              {s.session?.userId && <div>👤 User ID: {s.session.userId}</div>}
              {s.mobileRecording?.capturedLiveTranscript && (
                <div>📝 Live transcript rescue: {s.mobileRecording.capturedLiveTranscript.split(/\s+/).filter(Boolean).length} words</div>
              )}
            </div>

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
        );
      })}

      <div style={{ marginTop: 24, fontSize: 11, color: '#aaa', textAlign: 'center', paddingBottom: 40 }}>
        This tool reads data directly from this browser&rsquo;s IndexedDB. It must be run on the same device and browser that was used to record.
      </div>
    </div>
  );
}
