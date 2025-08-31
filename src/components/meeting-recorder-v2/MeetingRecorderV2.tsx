import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, History, Settings, Sparkles, FileText } from 'lucide-react';
import { useRecordingManager, RecordingSettings } from './hooks/useRecordingManager';
import { RecordingControls } from './components/recording/RecordingControls';
import { RecordingDashboard } from './components/recording/RecordingDashboard';
import { LiveTranscriptDisplay } from './components/recording/LiveTranscriptDisplay';
import { MeetingHistoryManager } from './components/meeting-history/MeetingHistoryManager';
import { TranscriptManager } from './components/transcript/TranscriptManager';

interface MeetingRecorderV2Props {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: Partial<RecordingSettings>;
}

export const MeetingRecorderV2 = ({
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate,
  initialSettings
}: MeetingRecorderV2Props) => {
  const {
    state,
    settings,
    setSettings,
    startRecording,
    stopRecording,
    resetRecording,
    formatDuration
  } = useRecordingManager(
    onTranscriptUpdate,
    onDurationUpdate,
    onWordCountUpdate,
    initialSettings
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Tabs defaultValue="record" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-accent/20">
          <TabsTrigger value="record" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Record
          </TabsTrigger>
          <TabsTrigger value="transcript" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Features
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Meeting Recorder V2</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RecordingControls
                state={state}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onResetRecording={resetRecording}
              />

              <RecordingDashboard
                state={state}
                formatDuration={formatDuration}
              />

              <LiveTranscriptDisplay
                transcripts={state.realtimeTranscripts}
                isRecording={state.isRecording}
                transcriptionService={settings.transcriberService}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Transcript Management</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptManager
                transcripts={state.realtimeTranscripts}
                fullTranscript={state.transcript}
                isRecording={state.isRecording}
                wordCount={state.wordCount}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Meeting History</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingHistoryManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Recording Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Settings panel coming soon...</p>
                <div className="mt-4 text-sm">
                  <p>Current transcriber: {settings.transcriberService}</p>
                  <p>Meeting type: {settings.meetingType}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>AI-powered meeting insights coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};