import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Mic, History, ScrollText, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminDictation } from '@/hooks/useAdminDictation';
import { AdminDictateTextArea } from './AdminDictateTextArea';
import { AdminDictateQuickActions } from './AdminDictateQuickActions';
import { AdminDictateHistoryTabs } from '@/components/admin-dictate/AdminDictateHistoryTabs';
import { AdminDictateViewToggle } from './AdminDictateViewToggle';
import { AdminDictateServiceToggle } from './AdminDictateServiceToggle';


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
    transcriptionService,
    setTranscriptionService,
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
    saveOnBlur,
  } = useAdminDictation();

  const handleLoadSession = (session: any) => {
    loadSession(session);
    setActiveTab('dictate');
  };

  return (
    <Card className="flex flex-col h-full border-0 shadow-none">
      <CardHeader className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Dictate</CardTitle>
            
            {/* Inline tab icons */}
            <div className="flex items-center gap-1 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'dictate' ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setActiveTab('dictate')}
                  >
                    <ScrollText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Dictate</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'history' ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setActiveTab('history')}
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">History</TooltipContent>
              </Tooltip>
            </div>
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

        <TabsContent value="dictate" className="flex-1 flex flex-col min-h-0 mt-0 p-4 gap-4">
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
                hasOriginalContent={!!originalContent}
                hasCleanedContent={!!cleanedContent}
                isFormatting={isFormatting}
                onManualClean={triggerManualClean}
              />
            </div>
          )}

          {/* Service Toggle - only show when idle */}
          {status === 'idle' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Transcription Service:</span>
              <AdminDictateServiceToggle
                service={transcriptionService}
                onServiceChange={setTranscriptionService}
                disabled={isRecording || isConnecting}
              />
            </div>
          )}

          {/* Quick Actions - always show for dictation */}
          <AdminDictateQuickActions
            status={status}
            isRecording={isRecording}
            isConnecting={isConnecting}
            hasContent={!!content}
            isFormatting={isFormatting}
            systemAudioEnabled={systemAudioEnabled}
            content={content}
            cleanedContent={cleanedContent || ''}
            templateName={templates.find(t => t.id === selectedTemplate)?.name || 'Dictation'}
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
              onBlur={saveOnBlur}
              status={status}
              error={error}
              disabled={isConnecting}
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 mt-0 p-4">
          <AdminDictateHistoryTabs
            onLoadDictation={(content, templateType) => {
              setContent(content);
              setSelectedTemplate(templateType as any);
            }}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
};
