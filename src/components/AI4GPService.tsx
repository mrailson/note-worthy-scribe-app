import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, History, Plus } from 'lucide-react';
import { LoginForm } from '@/components/LoginForm';
import { MessagesList } from '@/components/ai4gp/MessagesList';
import { InputArea } from '@/components/ai4gp/InputArea';
import { QuickActionsPanel } from '@/components/ai4gp/QuickActionsPanel';
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
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col relative">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-primary" />
                AI 4 GP Service
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearchHistory(!showSearchHistory)}
                >
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewSearch}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New
                </Button>
              </div>
            </div>

            {/* Settings */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Switch
                  id="session-memory"
                  checked={sessionMemory}
                  onCheckedChange={setSessionMemory}
                />
                <Label htmlFor="session-memory">Session Memory</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="latest-updates"
                  checked={includeLatestUpdates}
                  onCheckedChange={setIncludeLatestUpdates}
                />
                <Label htmlFor="latest-updates">Web Search</Label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 relative">
            {messages.length === 0 ? (
              /* Welcome Screen */
              <div className="flex-1 flex flex-col p-8 space-y-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">Welcome to AI4GP</h2>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                      Your AI assistant for clinical guidance, protocol development,
                      and evidence-based practice support.
                    </p>
                  </div>
                </div>
                
                <div className="w-full max-w-2xl mx-auto">
                  <p className="text-center text-muted-foreground mb-4">
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
          <div className="whitespace-pre-wrap text-sm">
            {expandedMessage?.content}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AI4GPService;