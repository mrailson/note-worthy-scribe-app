import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollText, History, Mic, Home, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useDictation } from '@/hooks/useDictation';
import { DictationTextArea } from './DictationTextArea';
import { DictationTemplates } from './DictationTemplates';
import { DictationHistoryPanel } from './DictationHistoryPanel';
import { DictationQuickActions } from './DictationQuickActions';
import { DictationViewToggle } from './DictationViewToggle';

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
              Notewell Dictate
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
          {/* Development Disclaimer */}
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
              <strong>⚠️ Development Build</strong> – Transcription accuracy is not yet clinical-grade. For demonstration and evaluation only; do not use for real patient care.
            </AlertDescription>
          </Alert>

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

              {/* View Toggle - show after recording stops with content */}
              {dictation.status === 'idle' && dictation.content && !dictation.isRecording && (
                <DictationViewToggle
                  showCleaned={dictation.showCleaned}
                  onToggle={dictation.toggleShowCleaned}
                  autoCleanEnabled={dictation.autoCleanEnabled}
                  onAutoCleanChange={dictation.setAutoCleanEnabled}
                  hasCleanedContent={Boolean(dictation.cleanedContent)}
                  isFormatting={dictation.isFormatting}
                  onManualClean={dictation.triggerManualClean}
                />
              )}

              {/* Quick Actions Bar with integrated Start/Stop button */}
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
                status={dictation.status}
                isConnecting={dictation.isConnecting}
                onStart={dictation.startDictation}
                onStop={dictation.stopDictation}
                systemAudioEnabled={dictation.systemAudioEnabled}
                onSystemAudioChange={dictation.setSystemAudioEnabled}
              />

              {/* Main Text Area */}
              <DictationTextArea
                content={dictation.content}
                onChange={dictation.setContent}
                status={dictation.status}
                error={dictation.error}
                isRecording={dictation.isRecording}
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
