import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, History, Plus, Settings } from 'lucide-react';
import { LoginForm } from '@/components/LoginForm';
import { MessagesList } from '@/components/ai4gp/MessagesList';
import { InputArea } from '@/components/ai4gp/InputArea';
import MessageRenderer from '@/components/MessageRenderer';
import { QuickActionsPanel } from '@/components/ai4gp/QuickActionsPanel';
import { SettingsModal } from '@/components/ai4gp/SettingsModal';
import { SearchHistorySidebar } from '@/components/ai4gp/SearchHistorySidebar';
import { useAI4GPService } from '@/hooks/useAI4GPService';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { generateWordDocument, generatePowerPoint } from '@/utils/documentGenerators';
import { Message } from '@/types/ai4gp';

const AI4GPService = () => {
  const { user, loading } = useAuth();
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-5');
  const [cardSize, setCardSize] = useState('default');
  const [cardHeight, setCardHeight] = useState(400);

  const {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    uploadedFiles,
    setUploadedFiles,
    sessionMemory,
    setSessionMemory,
    includeLatestUpdates,
    setIncludeLatestUpdates,
    handleSend,
    handleNewSearch
  } = useAI4GPService();

  const { practiceContext } = usePracticeContext();
  
  const {
    searchHistory,
    clearAllHistory,
    deleteSearch,
    loadPreviousSearch
  } = useSearchHistory();

  const handleSendWithContext = () => {
    handleSend(practiceContext);
  };

  const handleLoadPreviousSearch = (search: any) => {
    loadPreviousSearch(search, setMessages);
    setShowSearchHistory(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Search History Sidebar */}
      {showSearchHistory && (
        <SearchHistorySidebar
          searchHistory={searchHistory}
          onLoadSearch={handleLoadPreviousSearch}
          onDeleteSearch={deleteSearch}
          onClearAllHistory={clearAllHistory}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Card className="flex-1 flex flex-col h-full">
          <CardHeader className="border-b px-3 py-2 sm:px-6 sm:py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-sm sm:text-base">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                <span className="hidden sm:inline">AI 4 GP Service</span>
                <span className="sm:hidden">AI4GP</span>
                
                {/* History button next to title */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSearchHistory(!showSearchHistory)}
                  className="ml-3 px-2 sm:px-3"
                >
                  <History className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline text-xs">History</span>
                </Button>
              </CardTitle>
              
               <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="px-2 sm:px-3"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline text-xs">Settings</span>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewSearch}
                  className="px-2 sm:px-3"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline text-xs">New</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 relative min-h-0">
            {/* Chat Content Area */}
            <div className="flex-1 flex flex-col min-h-0" style={{ paddingBottom: '140px' }}>
              {messages.length === 0 ? (
                /* Welcome Screen - Compact, mobile-optimized */
                <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                  <div className="w-full max-w-2xl mx-auto">
                    <p className="text-center text-muted-foreground text-xs sm:text-sm mb-2 sm:mb-3">
                      Get started with these common queries:
                    </p>
                    <QuickActionsPanel
                      showAllQuickActions={showAllQuickActions}
                      setShowAllQuickActions={setShowAllQuickActions}
                      setInput={setInput}
                    />
                  </div>
                </div>
              ) : (
                /* Messages Area */
                <MessagesList
                  messages={messages}
                  isLoading={isLoading}
                  expandedMessage={expandedMessage}
                  setExpandedMessage={setExpandedMessage}
                  onExportWord={generateWordDocument}
                  onExportPowerPoint={generatePowerPoint}
                  cardHeight={cardHeight}
                />
              )}
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="absolute bottom-0 left-0 right-0">
              <InputArea
                input={input}
                setInput={setInput}
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                onSend={handleSendWithContext}
                isLoading={isLoading}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expanded Message Dialog */}
      <Dialog open={!!expandedMessage} onOpenChange={() => setExpandedMessage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {expandedMessage?.role === 'user' ? 'Your Message' : 'AI Response'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm">
            {expandedMessage && (
              <MessageRenderer
                message={expandedMessage}
                onExpandMessage={() => {}}
                onExportWord={generateWordDocument}
                onExportPowerPoint={generatePowerPoint}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        sessionMemory={sessionMemory}
        onSessionMemoryChange={setSessionMemory}
        includeLatestUpdates={includeLatestUpdates}
        onIncludeLatestUpdatesChange={setIncludeLatestUpdates}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        cardSize={cardSize}
        onCardSizeChange={setCardSize}
        cardHeight={cardHeight}
        onCardHeightChange={setCardHeight}
      />
    </div>
  );
};

export default AI4GPService;