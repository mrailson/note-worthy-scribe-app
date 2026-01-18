import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollText, History, Mic, Home, MonitorSpeaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDictation } from '@/hooks/useDictation';
import { DictationControls } from './DictationControls';
import { DictationTextArea } from './DictationTextArea';
import { DictationTemplates } from './DictationTemplates';
import { DictationHistoryPanel } from './DictationHistoryPanel';
import { DictationQuickActions } from './DictationQuickActions';

export function DictationPanel() {
  const dictation = useDictation();
  const [activeTab, setActiveTab] = useState<'dictate' | 'history'>('dictate');

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Mic className="h-5 w-5 text-primary" />
              GP Dictation
            </CardTitle>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'dictate' | 'history')}>
              <TabsList className="h-9">
                <TabsTrigger value="dictate" className="gap-1.5 px-3">
                  <ScrollText className="h-4 w-4" />
                  <span className="hidden sm:inline">Dictate</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5 px-3">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time speech-to-text for medical consultations and letters
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeTab === 'dictate' ? (
            <>
              {/* Template Selection - only show when not recording and no content */}
              {dictation.status === 'idle' && !dictation.content && (
                <DictationTemplates
                  templates={dictation.templates}
                  selectedTemplate={dictation.selectedTemplate}
                  onSelectTemplate={dictation.setSelectedTemplate}
                />
              )}

              {/* Back to Templates button - show when there's content */}
              {dictation.status === 'idle' && dictation.content && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={dictation.newDictation}
                    className="gap-1.5"
                  >
                    <Home className="h-4 w-4" />
                    New Dictation
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Start a new dictation with template options
                  </span>
                </div>
              )}

              {/* Quick Actions Bar */}
              <DictationQuickActions
                content={dictation.content}
                wordCount={dictation.wordCount}
                duration={dictation.duration}
                formatDuration={dictation.formatDuration}
                onCopyAll={() => dictation.copyToClipboard()}
                onClear={dictation.newDictation}
                onSave={() => dictation.finalizeDictation()}
                onFormatAndClean={dictation.formatAndClean}
                isRecording={dictation.isRecording}
                isFormatting={dictation.isFormatting}
                currentSessionId={dictation.currentSessionId}
              />

              {/* Main Text Area */}
              <DictationTextArea
                content={dictation.content}
                onChange={dictation.setContent}
                status={dictation.status}
                error={dictation.error}
                isRecording={dictation.isRecording}
              />

              {/* System Audio Capture Toggle */}
              {dictation.status === 'idle' && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <MonitorSpeaker className="h-4 w-4" />
                    </div>
                    <div>
                      <Label htmlFor="system-audio-dictate" className="font-medium text-sm cursor-pointer">
                        Capture PC Audio
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Record audio playing on your computer (e.g., phone software, video calls)
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="system-audio-dictate"
                    checked={dictation.systemAudioEnabled}
                    onCheckedChange={dictation.setSystemAudioEnabled}
                  />
                </div>
              )}

              {/* Recording Controls */}
              <DictationControls
                status={dictation.status}
                isRecording={dictation.isRecording}
                isConnecting={dictation.isConnecting}
                onStart={dictation.startDictation}
                onStop={dictation.stopDictation}
                hasContent={!!dictation.content.trim()}
              />
            </>
          ) : (
            <DictationHistoryPanel
              sessions={dictation.history}
              isLoading={dictation.isLoadingHistory}
              onLoadSession={(session) => {
                dictation.loadSession(session);
                setActiveTab('dictate');
              }}
              onDeleteSession={dictation.deleteSession}
              onRefresh={dictation.fetchHistory}
              formatDuration={dictation.formatDuration}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
