import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X, Mic, History, FileText, Plus } from 'lucide-react';
import { useAdminDictation } from '@/hooks/useAdminDictation';
import { AdminDictateTemplates } from './AdminDictateTemplates';
import { AdminDictateTextArea } from './AdminDictateTextArea';
import { AdminDictateQuickActions } from './AdminDictateQuickActions';
import { AdminDictateHistory } from './AdminDictateHistory';
import { AdminDictateViewToggle } from './AdminDictateViewToggle';

interface AdminDictatePanelProps {
  onClose: () => void;
}

export const AdminDictatePanel: React.FC<AdminDictatePanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'dictate' | 'history'>('dictate');
  
  const {
    status,
    content,
    setContent,
    selectedTemplate,
    setSelectedTemplate,
    duration,
    wordCount,
    history,
    isLoadingHistory,
    error,
    isFormatting,
    systemAudioEnabled,
    setSystemAudioEnabled,
    originalContent,
    cleanedContent,
    showCleaned,
    autoCleanEnabled,
    setAutoCleanEnabled,
    formatDuration,
    templates,
    isRecording,
    isConnecting,
    startDictation,
    stopDictation,
    newDictation,
    copyToClipboard,
    loadSession,
    deleteSession,
    fetchHistory,
    toggleShowCleaned,
    triggerManualClean,
  } = useAdminDictation();

  const handleLoadSession = (session: any) => {
    loadSession(session);
    setActiveTab('dictate');
  };

  return (
    <Card className="flex flex-col h-full border-0 shadow-none">
      <CardHeader className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Admin Dictate</CardTitle>
            {isRecording && (
              <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary border-primary/20">
                Listening
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {(isRecording || content) && (
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>⏱ {formatDuration(duration)}</span>
            <span>📝 {wordCount} words</span>
          </div>
        )}
      </CardHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'dictate' | 'history')} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
          <TabsTrigger value="dictate" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Dictate
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dictate" className="flex-1 flex flex-col min-h-0 mt-0 p-4 gap-4">
          {/* Template Selection - show when idle and no content */}
          {status === 'idle' && !content && (
            <AdminDictateTemplates
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
            />
          )}

          {/* New Dictation button when content exists */}
          {content && status === 'idle' && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={newDictation}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                New Dictation
              </Button>
              
              {/* View Toggle */}
              <AdminDictateViewToggle
                showCleaned={showCleaned}
                onToggle={toggleShowCleaned}
                autoCleanEnabled={autoCleanEnabled}
                onAutoCleanChange={setAutoCleanEnabled}
                hasCleanedContent={!!cleanedContent}
                isFormatting={isFormatting}
                onManualClean={triggerManualClean}
              />
            </div>
          )}

          {/* Quick Actions */}
          <AdminDictateQuickActions
            status={status}
            isRecording={isRecording}
            isConnecting={isConnecting}
            hasContent={!!content}
            isFormatting={isFormatting}
            systemAudioEnabled={systemAudioEnabled}
            onSystemAudioChange={setSystemAudioEnabled}
            onStart={startDictation}
            onStop={stopDictation}
            onCopy={() => copyToClipboard()}
            onClear={newDictation}
          />

          {/* Text Area */}
          <div className="flex-1 min-h-0">
            <AdminDictateTextArea
              content={content}
              onChange={setContent}
              status={status}
              error={error}
              disabled={isRecording || isConnecting}
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 mt-0 p-4">
          <AdminDictateHistory
            sessions={history}
            isLoading={isLoadingHistory}
            onLoadSession={handleLoadSession}
            onDeleteSession={deleteSession}
            onRefresh={fetchHistory}
            formatDuration={formatDuration}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
};
