import React from 'react';
import { Card } from '@/components/ui/card';
import { useStandaloneRecorder } from '@/hooks/useStandaloneRecorder';
import { RecorderControls } from './RecorderControls';
import { TranscriptViewer } from './TranscriptViewer';
import { ServiceSelector } from './ServiceSelector';
import { RecordingTimer } from './RecordingTimer';
import { VolumeIndicator } from './VolumeIndicator';

export const RecorderInterface = () => {
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
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleMute,
    toggleTranscriptionService,
    toggleCleaning,
    toggleShowCleaned,
    exportTranscript,
    clearTranscript
  } = useStandaloneRecorder();

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
          </div>
        </div>
      </Card>

      {/* Recording Controls */}
      <Card className="p-6">
        <RecorderControls
          isRecording={isRecording}
          isPaused={isPaused}
          isMuted={isMuted}
          isTranscribing={isTranscribing}
          transcript={transcript}
          onStart={startRecording}
          onStop={stopRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onToggleMute={toggleMute}
          onExport={exportTranscript}
          onClear={clearTranscript}
        />
      </Card>

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