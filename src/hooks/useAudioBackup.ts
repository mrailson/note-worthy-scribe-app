import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

interface AudioBackupConfig {
  /** Meeting ID to associate backups with */
  meetingId: string | null;
  /** User ID for storage path */
  userId: string | null;
  /** Whether backup is active */
  isActive: boolean;
  /** Interval in ms between backups (default: 60000 = 1 minute) */
  backupIntervalMs?: number;
  /** Max backup size in bytes before forced save (default: 10MB) */
  maxBackupSizeBytes?: number;
}

interface AudioBackupState {
  /** Whether backup system is running */
  isRunning: boolean;
  /** Number of backups saved */
  backupCount: number;
  /** Total bytes backed up */
  totalBytesBackedUp: number;
  /** Last backup timestamp */
  lastBackupTime: Date | null;
  /** Last backup error if any */
  lastError: string | null;
  /** Current buffer size in bytes */
  currentBufferSize: number;
}

export function useAudioBackup(config: AudioBackupConfig) {
  const {
    meetingId,
    userId,
    isActive,
    backupIntervalMs = 60000, // 1 minute
    maxBackupSizeBytes = 10 * 1024 * 1024 // 10MB
  } = config;

  const [state, setState] = useState<AudioBackupState>({
    isRunning: false,
    backupCount: 0,
    totalBytesBackedUp: 0,
    lastBackupTime: null,
    lastError: null,
    currentBufferSize: 0
  });

  // Audio data buffer
  const audioBufferRef = useRef<Blob[]>([]);
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backupCountRef = useRef<number>(0);
  const totalBytesRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  /**
   * Save current buffer to Supabase storage
   */
  const saveBackup = useCallback(async (isFinal: boolean = false) => {
    if (!meetingId || !userId || audioBufferRef.current.length === 0) {
      console.log('🔒 Audio backup: No data to save or missing IDs');
      return false;
    }

    if (isProcessingRef.current) {
      console.log('🔒 Audio backup: Already processing, skipping');
      return false;
    }

    isProcessingRef.current = true;

    try {
      // Combine all buffered chunks into a single blob
      const audioBlob = new Blob(audioBufferRef.current, { type: 'audio/webm;codecs=opus' });
      const bufferSize = audioBlob.size;
      
      // Clear buffer immediately after creating blob
      audioBufferRef.current = [];
      
      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupNumber = backupCountRef.current + 1;
      const filename = `${meetingId}/${timestamp}_backup_${backupNumber}${isFinal ? '_final' : ''}.webm`;
      const storagePath = `${userId}/${filename}`;

      console.log(`💾 Audio backup: Saving ${bufferSize} bytes as backup #${backupNumber}`);

      // Upload to Supabase storage
      const { data, error: uploadError } = await supabase.storage
        .from('meeting-audio-backups')
        .upload(storagePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Audio backup upload failed:', uploadError);
        setState(prev => ({
          ...prev,
          lastError: uploadError.message,
          currentBufferSize: 0
        }));
        return false;
      }

      // Log backup info - database insert skipped due to schema mismatch
      console.log(`💾 Audio backup saved to storage: ${storagePath}, size: ${bufferSize} bytes`);
      
      // Note: meeting_audio_backups table has different schema than expected
      // Backup is stored in Supabase Storage and can be recovered from there

      backupCountRef.current = backupNumber;
      totalBytesRef.current += bufferSize;

      setState(prev => ({
        ...prev,
        backupCount: backupNumber,
        totalBytesBackedUp: totalBytesRef.current,
        lastBackupTime: new Date(),
        lastError: null,
        currentBufferSize: 0
      }));

      console.log(`✅ Audio backup #${backupNumber} saved: ${bufferSize} bytes`);
      return true;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Audio backup error:', error);
      setState(prev => ({
        ...prev,
        lastError: message
      }));
      return false;

    } finally {
      isProcessingRef.current = false;
    }
  }, [meetingId, userId]);

  /**
   * Add audio chunk to backup buffer
   */
  const addAudioChunk = useCallback((chunk: Blob) => {
    if (!isActive || !chunk.size) return;

    audioBufferRef.current.push(chunk);
    
    const currentSize = audioBufferRef.current.reduce((sum, b) => sum + b.size, 0);
    
    setState(prev => ({
      ...prev,
      currentBufferSize: currentSize
    }));

    // Force save if buffer exceeds max size
    if (currentSize >= maxBackupSizeBytes) {
      console.log('📦 Audio backup: Buffer size exceeded, forcing save');
      saveBackup(false).catch(console.error);
    }
  }, [isActive, maxBackupSizeBytes, saveBackup]);

  /**
   * Start the backup system with a media stream
   */
  const startBackup = useCallback((stream: MediaStream) => {
    if (!meetingId || !userId) {
      console.warn('⚠️ Cannot start audio backup: missing meetingId or userId');
      return;
    }

    console.log('🎙️ Starting audio backup system');
    
    audioStreamRef.current = stream;
    audioBufferRef.current = [];
    backupCountRef.current = 0;
    totalBytesRef.current = 0;

    // Create a separate MediaRecorder for backup
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000 // Lower bitrate for backup
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          addAudioChunk(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('❌ Audio backup recorder error:', event);
        setState(prev => ({
          ...prev,
          lastError: 'Recorder error'
        }));
      };

      // Request data every 10 seconds
      recorder.start(10000);
      mediaRecorderRef.current = recorder;

      // Start periodic backup saves
      backupIntervalRef.current = setInterval(() => {
        if (audioBufferRef.current.length > 0) {
          saveBackup(false).catch(console.error);
        }
      }, backupIntervalMs);

      setState({
        isRunning: true,
        backupCount: 0,
        totalBytesBackedUp: 0,
        lastBackupTime: null,
        lastError: null,
        currentBufferSize: 0
      });

      console.log('✅ Audio backup system started');

    } catch (error) {
      console.error('❌ Failed to start audio backup:', error);
      setState(prev => ({
        ...prev,
        lastError: 'Failed to start backup recorder'
      }));
    }
  }, [meetingId, userId, addAudioChunk, saveBackup, backupIntervalMs]);

  /**
   * Stop the backup system and save final backup
   */
  const stopBackup = useCallback(async () => {
    console.log('🛑 Stopping audio backup system');

    // Clear interval
    if (backupIntervalRef.current) {
      clearInterval(backupIntervalRef.current);
      backupIntervalRef.current = null;
    }

    // Stop recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Save final backup
    if (audioBufferRef.current.length > 0) {
      await saveBackup(true);
    }

    setState(prev => ({
      ...prev,
      isRunning: false
    }));

    console.log('✅ Audio backup system stopped');
  }, [saveBackup]);

  // Cleanup on unmount or when inactive
  useEffect(() => {
    if (!isActive && state.isRunning) {
      stopBackup().catch(console.error);
    }

    return () => {
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isActive, state.isRunning, stopBackup]);

  return {
    ...state,
    startBackup,
    stopBackup,
    addAudioChunk,
    saveBackup
  };
}
