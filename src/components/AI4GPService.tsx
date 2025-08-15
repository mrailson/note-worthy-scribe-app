import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sparkles, History, Plus, Settings, Sparkles as GenieIcon, Newspaper, MoreVertical } from 'lucide-react';
import { LoginForm } from '@/components/LoginForm';
import { MessagesList } from '@/components/ai4gp/MessagesList';
import { InputArea, InputAreaRef } from '@/components/ai4gp/InputArea';
import MessageRenderer from '@/components/MessageRenderer';
import { QuickActionsPanel } from '@/components/ai4gp/QuickActionsPanel';
import { SettingsModal } from '@/components/ai4gp/SettingsModal';
import { SearchHistorySidebar } from '@/components/ai4gp/SearchHistorySidebar';
import { useAI4GPService } from '@/hooks/useAI4GPService';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { generateWordDocument, generatePowerPoint } from '@/utils/documentGenerators';
import { Message } from '@/types/ai4gp';
import GPGenieVoiceAgent from '@/components/GPGenieVoiceAgent';
import NewsPanel from '@/components/NewsPanel';

const AI4GPService = () => {
  const inputRef = useRef<InputAreaRef>(null);
  const { user, loading } = useAuth();
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'gp' | 'practice-manager'>('gp');
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

  const handleScrollToInput = () => {
    // Scroll to bottom of viewport
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
    // Focus the input after a small delay to ensure scroll completes
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
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
    <>
      <div 
        className="h-full flex flex-col bg-background relative" 
        data-component="ai4gp-service"
      >
        <div className="flex h-full">
          {/* Search History Sidebar */}
          {showSearchHistory && (
          <SearchHistorySidebar
            searchHistory={searchHistory}
            onLoadSearch={handleLoadPreviousSearch}
            onDeleteSearch={deleteSearch}
            onClearAllHistory={clearAllHistory}
            onClose={() => setShowSearchHistory(false)}
          />
          )}

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            <Card className="flex-1 flex flex-col h-full">
              <CardHeader className="border-b px-3 py-2 sm:px-6 sm:py-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-sm sm:text-base">
                    <button 
                      onClick={() => {
                        setMessages([]);
                        setInput('');
                        setUploadedFiles([]);
                        setShowAIChat(false);
                      }}
                      className="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                      <span className="hidden sm:inline">AI 4 GP Service</span>
                      <span className="sm:hidden">AI4GP</span>
                    </button>
                    
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2 sm:px-3"
                        >
                          <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline text-xs ml-1">Quick Pick</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setShowSettings(true)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAIChat(!showAIChat)}>
                          <GenieIcon className="w-4 h-4 mr-2" />
                          GP Genie
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowNews(!showNews)}>
                          <Newspaper className="w-4 h-4 mr-2" />
                          GP News
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleNewSearch}>
                          <Plus className="w-4 h-4 mr-2" />
                          New Search
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              {/* AI Chat Display */}
              {showAIChat && (
                <div className="border-b bg-muted/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">GP Genie</h4>
                    <button
                      onClick={() => setShowAIChat(false)}
                      className="text-muted-foreground hover:text-foreground text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <GPGenieVoiceAgent />
                  </div>
                </div>
              )}


              <CardContent className="flex-1 flex flex-col p-0 relative min-h-0 overflow-hidden">
                {messages.length === 0 ? (
                  /* Welcome Screen - Compact, mobile-optimized */
                  <div className="flex-1 p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto">
                    <div className="w-full max-w-2xl mx-auto">
                      <p className="text-center text-muted-foreground text-xs sm:text-sm mb-3">
                        Get started with these common queries:
                      </p>
                      
                      {/* Role Selection */}
                      <div className="flex justify-center mb-4">
                        <div className="flex bg-muted rounded-lg p-1">
                          <button
                            onClick={() => setSelectedRole('gp')}
                            className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all ${
                              selectedRole === 'gp'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            For GP
                          </button>
                          <button
                            onClick={() => setSelectedRole('practice-manager')}
                            className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all ${
                              selectedRole === 'practice-manager'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            For Practice Managers
                          </button>
                        </div>
                      </div>
                      
                      <QuickActionsPanel
                        showAllQuickActions={showAllQuickActions}
                        setShowAllQuickActions={setShowAllQuickActions}
                        setInput={setInput}
                        selectedRole={selectedRole}
                      />
                    </div>
                  </div>
                ) : (
                  /* Messages Area */
                  <div className="flex-1 overflow-y-auto">
                    <MessagesList
                      messages={messages}
                      isLoading={isLoading}
                      expandedMessage={expandedMessage}
                      setExpandedMessage={setExpandedMessage}
                      onExportWord={generateWordDocument}
                      onExportPowerPoint={generatePowerPoint}
                    />
                  </div>
                )}
                
                {/* Input Area at Bottom */}
                {!showNews && !showAIChat && !showSettings && (
                  <div className="border-t bg-background">
                    <InputArea
                      ref={inputRef}
                      input={input}
                      setInput={setInput}
                      uploadedFiles={uploadedFiles}
                      setUploadedFiles={setUploadedFiles}
                      onSend={handleSendWithContext}
                      isLoading={isLoading}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>


      {/* Expanded Message Dialog */}
      <Dialog open={!!expandedMessage} onOpenChange={() => setExpandedMessage(null)}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] h-[95vh] p-0 flex flex-col">
          <DialogHeader className="p-4 pb-2 flex-shrink-0 border-b">
            <DialogTitle className="text-left">
              {expandedMessage?.role === 'user' ? 'Your Message' : 'AI Response'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 mobile-container overflow-y-auto px-2 sm:px-4">
            {expandedMessage && (
              <div className="prose prose-sm w-full pb-20" style={{ maxWidth: 'none' }}>
                <MessageRenderer
                  message={expandedMessage}
                  onExpandMessage={() => {}}
                  onExportWord={generateWordDocument}
                  onExportPowerPoint={generatePowerPoint}
                  isModal={true} // Hide avatar and scroll arrow in modal
                  onCloseModal={() => setExpandedMessage(null)} // Close modal function
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* News Modal */}
      <Dialog open={showNews} onOpenChange={setShowNews}>
        <DialogContent className="max-w-[100vw] w-[100vw] max-h-[100vh] h-[100vh] overflow-y-auto p-0 m-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-left">GP News & Local Health News</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <NewsPanel />
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
    </>
  );
};

export default AI4GPService;