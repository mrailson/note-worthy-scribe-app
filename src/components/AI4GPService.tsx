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
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col relative">
          <CardHeader className="border-b px-3 py-2 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-sm sm:text-base">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                <span className="hidden sm:inline">AI 4 GP Service</span>
                <span className="sm:hidden">AI4GP</span>
              </CardTitle>
              
               <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="px-2 sm:px-3"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearchHistory(!showSearchHistory)}
                  className="px-2 sm:px-3"
                >
                  <History className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">History</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewSearch}
                  className="px-2 sm:px-3"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New</span>
                </Button>
               </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 relative">
            {messages.length === 0 ? (
              /* Welcome Screen - Compact, mobile-optimized */
              <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                <div className="text-center space-y-2 sm:space-y-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-foreground">Welcome to AI4GP</h2>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-md mx-auto">
                      Your AI assistant for clinical guidance, protocol development,
                      and evidence-based practice support.
                    </p>
                  </div>
                </div>
                
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
              />
            )}

            {/* Input Area */}
            <InputArea
              input={input}
              setInput={setInput}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              onSend={handleSendWithContext}
              isLoading={isLoading}
            />
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
      />
    </div>
  );
};

export default AI4GPService;