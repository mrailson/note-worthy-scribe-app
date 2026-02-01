import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDualTranscription } from '@/hooks/useDualTranscription';
import { DualRecordingControls } from '@/components/DualRecordingControls';
import { TranscriptPanel } from '@/components/gpscribe/TranscriptPanel';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export const DualTranscriptionDemo: React.FC = () => {
  const {
    state,
    startDualTranscription,
    stopDualTranscription,
    toggleService,
    setPrimarySource
  } = useDualTranscription();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-white/80 backdrop-blur-sm border-2 border-white/20 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dual Transcription System
            </CardTitle>
            <p className="text-lg text-muted-foreground mt-2">
              Proof of concept: Assembly AI (real-time) + Whisper (chunked) redundancy
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Badge variant="outline" className="bg-green-50 text-green-700">
                ✓ Real-time streaming with Assembly AI
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                ✓ High-accuracy batch with Whisper
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                ✓ Built-in redundancy
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Controls */}
        <DualRecordingControls
          state={state}
          onStart={startDualTranscription}
          onStop={stopDualTranscription}
          onToggleService={toggleService}
          onSetPrimarySource={setPrimarySource}
        />

        <Separator />

        {/* Transcription Panel */}
        <TranscriptPanel
          transcript={
            state.primarySource === 'merged' ? state.mergedTranscript :
            state.primarySource === 'whisper' ? state.whisperTranscript : 
            state.assemblyTranscript
          }
          isRecording={state.isRecording}
          realtimeTranscripts={state.isRecording ? [state.assemblyTranscript].filter(Boolean) : []}
          assemblyTranscript={state.assemblyTranscript}
          assemblyStatus={state.assemblyStatus}
          assemblyConfidence={state.assemblyConfidence}
          assemblyEnabled={state.assemblyEnabled}
          primarySource={state.primarySource}
          onPrimarySourceChange={setPrimarySource}
        />

        {/* Status Footer */}
        {state.isRecording && (
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium">Recording Active</span>
                  </div>
                  <Badge variant="outline">
                    Primary: {state.primarySource === 'assembly' ? 'Assembly AI' : 'Whisper'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  {state.assemblyEnabled && (
                    <span>Assembly: {state.assemblyTranscript.split(' ').filter(w => w.length > 0).length} words</span>
                  )}
                  {state.whisperEnabled && (
                    <span>Whisper: {state.whisperTranscript.split(' ').filter(w => w.length > 0).length} words</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};