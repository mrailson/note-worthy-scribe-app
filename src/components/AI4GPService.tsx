import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { Sparkles, History, Plus, Settings, Sparkles as GenieIcon, Newspaper, MoreVertical, Building2, Cpu, ImageIcon, Palette, Zap, BarChart3, TestTube, Info, Copy } from 'lucide-react';
import { LoginForm } from '@/components/LoginForm';
import { MessagesList } from '@/components/ai4gp/MessagesList';
import { InputArea, InputAreaRef } from '@/components/ai4gp/InputArea';
import { FloatingMobileInput } from '@/components/ai4gp/FloatingMobileInput';
import { useIsMobile } from '@/hooks/use-mobile';
import MessageRenderer from '@/components/MessageRenderer';
import { QuickActionsPanel } from '@/components/ai4gp/QuickActionsPanel';
import { SettingsModal } from '@/components/ai4gp/SettingsModal';
import { SearchHistorySidebar } from '@/components/ai4gp/SearchHistorySidebar';
import { ModelSelector } from '@/components/ai4gp/ModelSelector';
import { MicroBanner, ShortCard, FullModal, getAuditLine } from '@/components/ai4gp/DisclaimerComponents';
import { useAI4GPDisclaimer } from '@/hooks/useAI4GPDisclaimer';
import { useAI4GPService } from '@/hooks/useAI4GPService';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useAIModelPreference } from '@/hooks/useAIModelPreference';
import { generateWordDocument, generatePowerPoint } from '@/utils/documentGenerators';
import { Message } from '@/types/ai4gp';
import GPGenieVoiceAgent from '@/components/GPGenieVoiceAgent';
import NewsPanel from '@/components/NewsPanel';
import ImageCreate from '@/pages/ImageCreate';
import PracticeImageMaker from '@/pages/PracticeImageMaker';
import { QuickImageModal } from '@/components/QuickImageModal';
import { AIModelVerificationChart } from '@/components/AIModelVerificationChart';
import { AITestModal } from '@/components/AITestModal';
import { useToast } from '@/hooks/use-toast';


const AI4GPService = () => {
  const inputRef = useRef<InputAreaRef>(null);
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // Disclaimer management
  const { showDisclaimer, loading: disclaimerLoading, hideDisclaimer } = useAI4GPDisclaimer();
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  
  const [showNews, setShowNews] = useState(false);
  const [showImageCreate, setShowImageCreate] = useState(false);
  const [showImageService, setShowImageService] = useState(false);
  const [showQuickImageModal, setShowQuickImageModal] = useState(false);
  const [showVerificationChart, setShowVerificationChart] = useState(false);
  const [showAITestModal, setShowAITestModal] = useState(false);
  
  const [selectedRole, setSelectedRole] = useState<'gp' | 'practice-manager'>('gp');

  const { selectedModel: aiModel, setSelectedModel: setAIModel } = useAIModelPreference();

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
    verificationLevel,
    setVerificationLevel,
    showResponseMetrics,
    setShowResponseMetrics,
    selectedModel,
    setSelectedModel,
    useOpenAI,
    setUseOpenAI,
    showRenderTimes,
    setShowRenderTimes,
    showAIService,
    setShowAIService,
    handleSend,
    handleNewSearch,
    handleQuickResponse,
    isClinical,
    setIsClinical,
    saveUserSettings
  } = useAI4GPService();

  const { practiceContext } = usePracticeContext();
  
  const {
    searchHistory,
    clearAllHistory,
    deleteSearch,
    loadPreviousSearch
  } = useSearchHistory();

  const handleSendWithContext = () => {
    // Map the AI model preference to the appropriate model string for the backend
    const modelToUse = aiModel === 'grok' ? 'grok-beta' : 'gpt-5';
    handleSend(practiceContext, modelToUse);
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

  // Check if we need to show disclaimer modal on first use
  React.useEffect(() => {
    if (!disclaimerLoading && showDisclaimer) {
      setShowDisclaimerModal(true);
    }
  }, [disclaimerLoading, showDisclaimer]);

  const handleDisclaimerAccept = () => {
    setShowDisclaimerModal(false);
  };

  const handleDisclaimerDoNotShowAgain = () => {
    hideDisclaimer();
    setShowDisclaimerModal(false);
  };

  const copyAuditLine = () => {
    navigator.clipboard.writeText(getAuditLine());
    toast({
      description: "Audit line copied to clipboard",
    });
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
        className="flex-1 flex flex-col bg-background relative h-full overflow-hidden" 
        data-component="ai4gp-service"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex flex-1 min-h-0">
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
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="border-b px-3 py-2 sm:px-6 sm:py-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-sm sm:text-base">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            onClick={() => {
                              setMessages([]);
                              setInput('');
                              setUploadedFiles([]);
                              setShowAIChat(false);
                            }}
                            className="flex items-center hover:opacity-80 transition-opacity cursor-pointer group relative"
                          >
                            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
                            <div className="flex flex-col">
                              <span className="hidden sm:inline">AI 4 GP Service</span>
                              <span className="sm:hidden">AI4GP</span>
                              <span className="text-[10px] text-muted-foreground/60 -mt-1 hidden sm:block">Click for New Search</span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Click to Clear Chat</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
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
                    
                    {/* Model Selector next to History */}
                    <div className="ml-2 hidden sm:block">
                      <ModelSelector
                        selectedModel={aiModel}
                        onModelChange={setAIModel}
                      />
                    </div>
                  </CardTitle>
                  
                   <div className="flex items-center gap-1 sm:gap-2">
                    {/* Settings Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSettings(true)}
                      className="px-2 sm:px-3"
                    >
                      <Settings className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline text-xs">Settings</span>
                    </Button>
                    
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
                        <DropdownMenuItem onClick={handleNewSearch}>
                          <Plus className="w-4 h-4 mr-2" />
                          New Search
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAIChat(!showAIChat)}>
                          <GenieIcon className="w-4 h-4 mr-2" />
                          GP Genie
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowNews(!showNews)}>
                          <Newspaper className="w-4 h-4 mr-2" />
                          GP News
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Palette className="w-4 h-4 mr-2" />
                            Image Service
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => setShowQuickImageModal(true)}>
                              <Zap className="w-4 h-4 mr-2" />
                              Quick Image
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowImageService(!showImageService)}>
                              <Palette className="w-4 h-4 mr-2" />
                              Practice Image Maker
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => setShowAITestModal(true)}>
                          <TestTube className="w-4 h-4 mr-2" />
                          AI Model Tester
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAboutModal(true)}>
                          <Info className="w-4 h-4 mr-2" />
                          About & Terms
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

              {/* Image Creation Service Display */}
              {showImageCreate && (
                <div className="flex-1 overflow-y-auto p-4 bg-background">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-lg">Image Creation Service</h4>
                    <button
                      onClick={() => setShowImageCreate(false)}
                      className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded hover:bg-muted/50"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <ImageCreate />
                </div>
              )}

              {/* Image Service Display */}
              {showImageService && (
                <div className="flex-1 overflow-y-auto p-4 bg-background">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-lg">Practice Image Maker</h4>
                    <button
                      onClick={() => setShowImageService(false)}
                      className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded hover:bg-muted/50"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <PracticeImageMaker />
                </div>
              )}

              {/* Main Chat Content - Only show when services are not active */}
              {!showImageCreate && !showImageService && (
                <CardContent className="flex-1 flex flex-col p-0 relative min-h-0 overflow-hidden">
                  {messages.length === 0 ? (
                    /* Welcome Screen - Compact, mobile-optimized */
                    <div className="flex-1 p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                                  ? 'bg-background text-foreground shadow-sm font-bold'
                                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:font-medium'
                              }`}
                            >
                              For GP/Clinical
                            </button>
                            <button
                              onClick={() => setSelectedRole('practice-manager')}
                              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all ${
                                selectedRole === 'practice-manager'
                                  ? 'bg-background text-foreground shadow-sm font-bold'
                                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:font-medium'
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
                          onOpenAITestModal={() => setShowAITestModal(true)}
                        />
                        
                        {/* Short Card Disclaimer */}
                        <div className="mt-6">
                          <ShortCard />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Messages Area */
                    <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <MessagesList
                        messages={messages}
                        isLoading={isLoading}
                        expandedMessage={expandedMessage}
                        setExpandedMessage={setExpandedMessage}
                        onExportWord={generateWordDocument}
                        onExportPowerPoint={generatePowerPoint}
                        showResponseMetrics={showResponseMetrics}
                        showRenderTimes={showRenderTimes}
                        showAIService={showAIService}
                        onQuickResponse={(response) => {
                          const modelToUse = aiModel === 'grok' ? 'grok-beta' : 'gpt-5';
                          handleQuickResponse(response, practiceContext, modelToUse);
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Input Area at Bottom - Desktop only */}
                  {!showNews && !showSettings && !showImageService && !isMobile && (
                    <div className="border-t">
                      <InputArea
                        ref={inputRef}
                        input={input}
                        setInput={setInput}
                        uploadedFiles={uploadedFiles}
                        setUploadedFiles={setUploadedFiles}
                        onSend={handleSendWithContext}
                        isLoading={isLoading}
                        isClinical={isClinical}
                        setIsClinical={setIsClinical}
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Floating Input - Outside main container to avoid overflow clipping */}
      {isMobile && !showNews && !showSettings && !showImageService && (
        <FloatingMobileInput
          ref={inputRef}
          input={input}
          setInput={setInput}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          onSend={handleSendWithContext}
          isLoading={isLoading}
          isClinical={isClinical}
          setIsClinical={setIsClinical}
        />
      )}



      {/* Expanded Message Dialog */}
      <Dialog open={!!expandedMessage} onOpenChange={() => setExpandedMessage(null)}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] h-[95vh] p-0 flex flex-col">
          <DialogHeader className="p-4 pb-2 flex-shrink-0 border-b">
            <DialogTitle className="text-left">
              {expandedMessage?.role === 'user' ? 'Your Message' : 'AI Response'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            {expandedMessage && (
              <div className="prose prose-sm w-full pb-20" style={{ maxWidth: 'none' }}>
                <MessageRenderer
                  message={expandedMessage}
                  onExpandMessage={() => {}}
                  onExportWord={generateWordDocument}
                  onExportPowerPoint={generatePowerPoint}
                  isModal={true} // Hide avatar and scroll arrow in modal
                  onCloseModal={() => setExpandedMessage(null)} // Close modal function
                  showResponseMetrics={showResponseMetrics}
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
        verificationLevel={verificationLevel}
        onVerificationLevelChange={setVerificationLevel}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        showResponseMetrics={showResponseMetrics}
        onShowResponseMetricsChange={setShowResponseMetrics}
        showRenderTimes={showRenderTimes}
        onShowRenderTimesChange={setShowRenderTimes}
        showAIService={showAIService}
        onShowAIServiceChange={setShowAIService}
        useOpenAI={useOpenAI}
        onUseOpenAIChange={setUseOpenAI}
        onSaveSettings={saveUserSettings}
      />

      {/* Quick Image Modal */}
      <QuickImageModal 
        open={showQuickImageModal} 
        onOpenChange={setShowQuickImageModal} 
      />

      {/* AI Model Verification Chart Modal */}
      <Dialog open={showVerificationChart} onOpenChange={setShowVerificationChart}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-left">AI Model Verification Performance</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <AIModelVerificationChart />
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Test Modal */}
      <AITestModal 
        open={showAITestModal} 
        onOpenChange={setShowAITestModal} 
      />

      {/* Disclaimer Modal - First Time Use */}
      <FullModal 
        open={showDisclaimerModal}
        onOpenChange={setShowDisclaimerModal}
        onAccept={handleDisclaimerAccept}
        onDoNotShowAgain={handleDisclaimerDoNotShowAgain}
      />

      {/* About Modal - Manual Access */}
      <FullModal 
        open={showAboutModal}
        onOpenChange={setShowAboutModal}
        onAccept={() => setShowAboutModal(false)}
        onDoNotShowAgain={() => {
          hideDisclaimer();
          setShowAboutModal(false);
        }}
      />
    </>
  );
};

export default AI4GPService;