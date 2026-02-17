import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useStandaloneRecorder } from '@/hooks/useStandaloneRecorder';
import { useBackupRecorder } from '@/hooks/useBackupRecorder';
import { useIsMobile } from '@/hooks/use-mobile';
import { RecorderControls } from './RecorderControls';
import { TranscriptViewer } from './TranscriptViewer';
import { ServiceSelector } from './ServiceSelector';
import { RecordingTimer } from './RecordingTimer';
import { VolumeIndicator } from './VolumeIndicator';
import { BackupIndicator } from '@/components/offline/BackupIndicator';
import { BackupRecoveryPrompt } from '@/components/offline/BackupRecoveryPrompt';
import { supabase } from '@/integrations/supabase/client';

export const RecorderInterface = () => {
  const isMobile = useIsMobile();
  const [backupEnabled, setBackupEnabled] = useState(isMobile);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);

  const {
    isRecording,
    isPaused,
    isMuted,
    transcript,
    cleanedTranscript,
    showCleaned,
    duration,
    volume,
    transcriptionService,
    cleaningEnabled,
    isTranscribing,
    browserFallbackWordCount,
    useWhisperCount,
    startRecording: startLiveRecording,
    stopRecording: stopLiveRecording,
    pauseRecording,
    resumeRecording,
    toggleMute,
    toggleTranscriptionService,
    toggleCleaning,
    toggleShowCleaned,
    exportTranscript,
    clearTranscript
  } = useStandaloneRecorder();

  const {
    isBackupActive,
    segmentCount,
    startBackup,
    stopBackup,
    pauseBackup,
    resumeBackup,
  } = useBackupRecorder();

  const handleStart = useCallback(async () => {
    await startLiveRecording();

    if (backupEnabled) {
      // Give the live recorder a moment to acquire the stream, then grab it
      // The StandaloneTranscriber creates the stream internally
      // We need to get it after start — slight delay to ensure it's ready
      setTimeout(async () => {
        try {
          // Get a fresh stream clone for backup (shares same mic, no extra prompt)
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          await startBackup(stream);
        } catch (err) {
          console.warn('[BackupRecorder] Could not start backup:', err);
        }
      }, 500);
    }
  }, [startLiveRecording, backupEnabled, startBackup]);

  const handleStop = useCallback(async () => {
    await stopLiveRecording();

    if (isBackupActive) {
      const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
      const transcriptSuccessful = wordCount > 5;

      // Get current user for upload
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      await stopBackup(transcriptSuccessful, userId, undefined);

      if (!transcriptSuccessful) {
        setShowRecoveryPrompt(true);
      }
    }
  }, [stopLiveRecording, isBackupActive, stopBackup, transcript]);

  const handlePause = useCallback(async () => {
    await pauseRecording();
    if (isBackupActive) pauseBackup();
  }, [pauseRecording, isBackupActive, pauseBackup]);

  const handleResume = useCallback(async () => {
    await resumeRecording();
    if (isBackupActive) resumeBackup();
  }, [resumeRecording, isBackupActive, resumeBackup]);

  const handleProcessBackupNow = useCallback(() => {
    setShowRecoveryPrompt(false);
    // The PendingBackupsList on the page will show the session
    // User can process from there
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleKeepForLater = useCallback(() => {
    setShowRecoveryPrompt(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Service Configuration */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ServiceSelector
            currentService={transcriptionService}
            onServiceChange={toggleTranscriptionService}
            cleaningEnabled={cleaningEnabled}
            onCleaningToggle={toggleCleaning}
          />
          
          <div className="flex items-center gap-4">
            <RecordingTimer duration={duration} isRecording={isRecording} />
            <VolumeIndicator volume={volume} isMuted={isMuted} />
            <BackupIndicator isActive={isBackupActive} segmentCount={segmentCount} />
          </div>
        </div>
      </Card>

      {/* Backup Checkbox (only before recording) */}
      {!isRecording && (
        <div className="flex items-start gap-2 px-1">
          <Checkbox
            id="backup-enabled"
            checked={backupEnabled}
            onCheckedChange={(checked) => setBackupEnabled(checked === true)}
          />
          <div className="grid gap-0.5 leading-none">
            <label
              htmlFor="backup-enabled"
              className="text-sm font-medium cursor-pointer"
            >
              Save local backup {isMobile ? '(recommended)' : ''}
            </label>
            <p className="text-xs text-muted-foreground">
              Keeps a copy of the audio on your device in case of connection issues
            </p>
          </div>
        </div>
      )}

      {/* Recording Controls */}
      <Card className="p-6">
        <RecorderControls
          isRecording={isRecording}
          isPaused={isPaused}
          isMuted={isMuted}
          isTranscribing={isTranscribing}
          transcript={transcript}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          onToggleMute={toggleMute}
          onExport={exportTranscript}
          onClear={clearTranscript}
        />
      </Card>

      {/* Recovery Prompt */}
      {showRecoveryPrompt && (
        <BackupRecoveryPrompt
          onProcessNow={handleProcessBackupNow}
          onKeepForLater={handleKeepForLater}
        />
      )}

      {/* Transcript Display */}
      <TranscriptViewer
        transcript={transcript}
        cleanedTranscript={cleanedTranscript}
        showCleaned={showCleaned}
        cleaningEnabled={cleaningEnabled}
        onToggleView={toggleShowCleaned}
        isTranscribing={isTranscribing}
        browserFallbackWordCount={browserFallbackWordCount}
        useWhisperCount={useWhisperCount}
      />
    </div>
  );
};
