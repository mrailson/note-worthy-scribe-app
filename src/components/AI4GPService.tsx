import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { Sparkles, History, Plus, Settings, Sparkles as GenieIcon, Newspaper, MoreVertical, Building2, Cpu, ImageIcon, Palette, Zap, BarChart3, TestTube, Info, Copy, Phone, Calendar, Mic, BookOpen, Languages, PanelLeft } from 'lucide-react';

// Component imports
import { LoginForm } from '@/components/LoginForm';
import { MessagesList } from '@/components/ai4gp/MessagesList';
import { InputArea, InputAreaRef } from '@/components/ai4gp/InputArea';
import { FloatingMobileInput, FloatingMobileInputRef } from '@/components/ai4gp/FloatingMobileInput';

import MessageRenderer from '@/components/MessageRenderer';
import { QuickActionsPanel } from '@/components/ai4gp/QuickActionsPanel';
import { PMHomeScreen } from '@/components/ai4gp/PMHomeScreen';
import { GPHomeScreen } from '@/components/ai4gp/GPHomeScreen';
import { SettingsModal } from '@/components/ai4gp/SettingsModal';
import { SearchHistorySidebar } from '@/components/ai4gp/SearchHistorySidebar';
import { MicroBanner, ShortCard, CollapsibleShortCard, FullModal, getAuditLine } from '@/components/ai4gp/DisclaimerComponents';
import { AI4GPSidebar } from '@/components/ai4gp/AI4GPSidebar';
import { RoleToggle } from '@/components/ai4gp/RoleToggle';

import NewsPanel from '@/components/NewsPanel';
import { BPCalculatorPanel } from '@/components/ai4gp/BPCalculatorPanel';
import ImageCreate from '@/pages/ImageCreate';
import PracticeImageMaker from '@/pages/PracticeImageMaker';
import { QuickImageModal } from '@/components/QuickImageModal';
import { AIModelVerificationChart } from '@/components/AIModelVerificationChart';
import { MeetingsDropdown } from '@/components/ai4gp/MeetingsDropdown';
import { DocumentTranslateModal } from '@/components/ai4gp/DocumentTranslateModal';
import { AI4GPUserGuide } from '@/components/ai4gp/AI4GPUserGuide';
import { TranslationToolInterface } from '@/components/TranslationToolInterface';
import { MeetingPreviewDrawer } from '@/components/ai4gp/MeetingPreviewDrawer';
import { PowerPointGenerationOverlay } from '@/components/PowerPointGenerationOverlay';
import { ImageBrandingDialog } from '@/components/ai4gp/ImageBrandingDialog';

  // Hook imports
import { useIsMobile, useDeviceInfo } from '@/hooks/use-mobile';
import { useAI4GPDisclaimer } from '@/hooks/useAI4GPDisclaimer';
import { useAI4GPService } from '@/hooks/useAI4GPService';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateWordDocument } from '@/utils/documentGenerators';
import { useGammaPowerPoint } from '@/hooks/useGammaPowerPoint';
import { useGammaPowerPointWithVoiceover } from '@/hooks/useGammaPowerPointWithVoiceover';
import { Message } from '@/types/ai4gp';
import { useQueryClient } from '@tanstack/react-query';
import { MeetingData } from '@/types/meetingTypes';
import { cn } from '@/lib/utils';


const AI4GPService = () => {
  const inputRef = useRef<InputAreaRef | FloatingMobileInputRef>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const isMobile = useIsMobile();
  const deviceInfo = useDeviceInfo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { generateWithGamma, isGenerating: isPowerPointGenerating } = useGammaPowerPoint();
  const { generateFullPresentation, isGenerating: isFullPowerPointGenerating, currentPhase } = useGammaPowerPointWithVoiceover();
  
  // Disclaimer management
  const { showDisclaimer, disclaimerCollapsed, updateCollapsedPreference, loading: disclaimerLoading, hideDisclaimer } = useAI4GPDisclaimer();
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  // Fetch recent meetings for dropdown
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['recent-meetings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, start_time, created_at, duration_minutes, word_count, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching recent meetings:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Return meeting data with existing word_count from database
      return data;
    },
    enabled: !!user?.id
  });
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [genieTab, setGenieTab] = useState<'gp-genie' | 'pm-genie'>('gp-genie');
  
  const [showNews, setShowNews] = useState(false);
  const [showBPCalculator, setShowBPCalculator] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showImageCreate, setShowImageCreate] = useState(false);
  const [showImageService, setShowImageService] = useState(false);
  const [showQuickImageModal, setShowQuickImageModal] = useState(false);
  const [showVerificationChart, setShowVerificationChart] = useState(false);
  const [showDocumentTranslate, setShowDocumentTranslate] = useState(false);
  const [previewMeetingId, setPreviewMeetingId] = useState<string | null>(null);
  const [showMeetingPreview, setShowMeetingPreview] = useState(false);
  
  const [selectedRole, setSelectedRole] = useState<'gp' | 'practice-manager'>('gp');
  const [setDrugNameFn, setSetDrugNameFn] = useState<((drugName: string) => void) | null>(null);
  
  // Sidebar collapsed state - persisted in localStorage, default to collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('ai4gp-sidebar-collapsed');
    return saved !== null ? saved === 'true' : true;
  });
  
  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('ai4gp-sidebar-collapsed', String(newState));
      return newState;
    });
  };

  // Helper to close all sidebar panels
  const closeAllPanels = () => {
    setShowNews(false);
    setShowBPCalculator(false);
    setShowTranslation(false);
    setShowSearchHistory(false);
  };

  // Panel toggle handlers that close other panels first
  const handleShowNews = () => {
    const wasOpen = showNews;
    closeAllPanels();
    if (!wasOpen) setShowNews(true);
  };

  const handleShowBPCalculator = () => {
    const wasOpen = showBPCalculator;
    closeAllPanels();
    if (!wasOpen) setShowBPCalculator(true);
  };

  const handleShowTranslation = () => {
    const wasOpen = showTranslation;
    closeAllPanels();
    if (!wasOpen) setShowTranslation(true);
  };

  const handleShowSearchHistory = () => {
    const wasOpen = showSearchHistory;
    closeAllPanels();
    if (!wasOpen) setShowSearchHistory(true);
  };


  // Local policy state - remove from component since it's now in the hook
  // const [northamptonshireICB, setNorthamptonshireICB] = useState(false);

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
    saveUserSettings,
    northamptonshireICB,
    setNorthamptonshireICB,
    // Display Settings
    textSize,
    setTextSize,
    interfaceDensity,
    setInterfaceDensity,
    containerWidth,
    setContainerWidth,
    highContrast,
    setHighContrast,
    readingFont,
    setReadingFont,
    autoCollapseUserPrompts,
    setAutoCollapseUserPrompts,
    chatHistoryRetentionDays,
    setChatHistoryRetentionDays,
    hideGPClinical,
    setHideGPClinical,
    imageGenerationModel,
    setImageGenerationModel,
    showBrandingDialog,
    setShowBrandingDialog,
    pendingImageRequest,
    handleBrandingConfirm,
    handleBrandingCancel
  } = useAI4GPService();

  const { practiceContext, practiceDetails } = usePracticeContext();
  
  // Invalidate meetings query when meetings are updated
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('ai4gp-meetings-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Meeting updated, invalidating AI4GP meetings query...', payload);
          queryClient.invalidateQueries({ queryKey: ['recent-meetings', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
  
  const {
    searchHistory,
    clearAllHistory,
    deleteSearch,
    loadFullSearch,
    toggleSearchFlag,
    toggleSearchProtection
  } = useSearchHistory();

  const handleSendWithContext = (messageOverride?: string) => {
    console.log('🏥 Practice context being sent to AI:', practiceContext);
    console.log('📋 Practice details available:', practiceDetails);
    // Use the selected model from settings
    handleSend(practiceContext, selectedModel, messageOverride);
  };

  const handleLoadPreviousSearch = async (search: any) => {
    // Load full messages from database (metadata-only list doesn't include messages)
    const messages = await loadFullSearch(search.id);
    if (messages) {
      setMessages(messages);
    }
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

  // Auto-scroll to input when AI response finishes
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        // Scroll to bottom to show input area
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
        
        // Also try to focus the input if it exists
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      }, 200);
    }
  }, [isLoading, messages.length]);

  // Check if we need to show disclaimer modal on first use
  React.useEffect(() => {
    if (!disclaimerLoading && showDisclaimer) {
      setShowDisclaimerModal(true);
    }
  }, [disclaimerLoading, showDisclaimer]);

  // Reset news panel on component mount (fixes Home button navigation)
  React.useEffect(() => {
    setShowNews(false);
  }, []);

  // Determine if GP/Clinical should be hidden (either by setting or ICB member status)
  const isIcbMember = profile?.northamptonshire_icb_active === true;
  const shouldHideGPClinical = hideGPClinical || isIcbMember;

  // Force Practice Manager role when GP/Clinical is hidden or user is ICB member
  React.useEffect(() => {
    if (shouldHideGPClinical && selectedRole === 'gp') {
      setSelectedRole('practice-manager');
    }
  }, [shouldHideGPClinical, selectedRole]);

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

  // Helper function to check if user hasn't logged in for a week or more
  const shouldShowDisclaimer = () => {
    if (!profile?.last_login) {
      // If no last login date, show disclaimer (new user)
      return true;
    }
    
    const lastLogin = new Date(profile.last_login);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Show disclaimer if last login was more than a week ago
    return lastLogin < oneWeekAgo;
  };

  // Helper function to get text scaling class
  const getTextScaleClass = (size: string) => {
    switch (size) {
      case 'smallest': return 'ai4gp-text-smallest';
      case 'smaller': return 'ai4gp-text-smaller';
      case 'small': return 'ai4gp-text-small';
      case 'default': return 'ai4gp-text-default';
      case 'medium': return 'ai4gp-text-medium';
      case 'large': return 'ai4gp-text-large';
      case 'larger': return 'ai4gp-text-larger';
      case 'largest': return 'ai4gp-text-largest';
      default: return 'ai4gp-text-default';
    }
  };

  return (
    <>
      <div 
        className={cn(
          "flex-1 flex bg-background relative h-full overflow-x-hidden",
          "ai4gp-container-sized ai4gp-font-applied ai4gp-text-scaled",
          getTextScaleClass(textSize),
          deviceInfo.isIPhone ? "iphone-optimized" : "",
          deviceInfo.hasNotch ? "iphone-notch-safe" : ""
        )}
        data-component="ai4gp-service"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          maxWidth: '100%',
          width: '100%',
          height: deviceInfo.supportsViewportUnits ? '100dvh' : '100vh'
        }}
      >
        {/* Left Sidebar - Desktop Only */}
        <AI4GPSidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          selectedRole={selectedRole}
          onNewSearch={handleNewSearch}
          onShowHistory={handleShowSearchHistory}
          onShowSettings={() => setShowSettings(true)}
          onShowNews={handleShowNews}
          onShowBPCalculator={handleShowBPCalculator}
          onShowTranslation={handleShowTranslation}
          onShowQuickImageModal={() => setShowQuickImageModal(true)}
          onShowImageService={() => setShowImageService(!showImageService)}
          onShowDocumentTranslate={() => setShowDocumentTranslate(true)}
          onShowUserGuide={() => setShowUserGuide(true)}
          onShowAllQuickActions={() => setShowAllQuickActions(true)}
          meetings={meetings as any}
          meetingsLoading={meetingsLoading}
          onSelectMeeting={(meetingId) => {
            setPreviewMeetingId(meetingId);
            setShowMeetingPreview(true);
          }}
        />

        <div className="flex flex-1 min-h-0 flex-col">
          <div className="flex flex-1 min-h-0">
            {/* Search History Sidebar */}
            {showSearchHistory && (
            <SearchHistorySidebar
              searchHistory={searchHistory}
              onLoadSearch={handleLoadPreviousSearch}
              onDeleteSearch={deleteSearch}
              onClearAllHistory={clearAllHistory}
              onClose={() => setShowSearchHistory(false)}
              onToggleFlag={toggleSearchFlag}
              onToggleProtection={toggleSearchProtection}
            />
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <Card className="flex-1 flex flex-col min-h-0 sm:border border-0 sm:rounded-lg rounded-none shadow-none sm:shadow-sm">
              <CardHeader className={cn(
                "border-b flex-shrink-0",
                deviceInfo.isIPhone 
                  ? "px-4 py-3 bg-background/95 backdrop-blur-sm sticky top-0 z-10" 
                  : "px-3 py-2 sm:px-6 sm:py-4"
              )}>
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center min-w-0 flex-1">
                    <CardTitle className="flex items-center text-sm sm:text-base min-w-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => {
                                setMessages([]);
                                setInput('');
                                setUploadedFiles([]);
                                setShowAIChat(false);
                                setShowNews(false);
                              }}
                              className={cn(
                                "flex items-center hover:opacity-80 transition-opacity cursor-pointer group relative",
                                deviceInfo.isIPhone && "min-h-[44px]"
                              )}
                            >
                              <Sparkles className={cn(
                                "text-primary flex-shrink-0",
                                deviceInfo.isIPhone ? "w-5 h-5 mr-2" : "w-4 h-4 sm:w-5 sm:h-5 mr-2"
                              )} />
                              <div className="flex flex-col min-w-0">
                                <span className="hidden sm:inline truncate">
                                  {selectedRole === 'practice-manager' ? 'AI 4 PM Service' : 'AI 4 GP Service'}
                                </span>
                                <span className={cn(
                                  "sm:hidden truncate font-semibold",
                                  deviceInfo.isIPhone && "text-base"
                                )}>
                                  {selectedRole === 'practice-manager' ? 'AI4PM' : 'AI4GP'}
                                </span>
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
                        className={cn(
                          "ml-2 sm:ml-3 flex-shrink-0",
                          deviceInfo.isIPhone ? "px-3 h-10 min-w-[44px]" : "px-2 sm:px-3"
                        )}
                      >
                        <History className={cn(
                          deviceInfo.isIPhone ? "w-4 h-4" : "w-3 h-3 sm:w-4 sm:h-4 sm:mr-1"
                        )} />
                        <span className="hidden sm:inline text-xs">History</span>
                      </Button>
                      
                      {/* Meetings dropdown */}
                      <MeetingsDropdown
                        meetings={meetings}
                        isLoading={meetingsLoading}
                      />
                    </CardTitle>
                  </div>

                  
                   <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            deviceInfo.isIPhone ? "px-3 h-10 min-w-[44px]" : "px-2 sm:px-3"
                          )}
                        >
                          <MoreVertical className={cn(
                            deviceInfo.isIPhone ? "w-4 h-4" : "w-3 h-3 sm:w-4 sm:h-4"
                          )} />
                          <span className="hidden sm:inline text-xs ml-1">Quick Pick</span>
                        </Button>
                      </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="w-48">
                         <DropdownMenuItem onClick={handleNewSearch}>
                           <Plus className="w-4 h-4 mr-2" />
                           New Search
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => navigate('/gp-translation')}>
                           <Languages className="w-4 h-4 mr-2" />
                           Translation Service
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => navigate('/gp-genie')}>
                           <GenieIcon className="w-4 h-4 mr-2" />
                           GP Genie
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => setShowUserGuide(true)}>
                           <BookOpen className="w-4 h-4 mr-2" />
                           User Guide & Help
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                      
                       {/* Settings Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSettings(true)}
                        className={cn(
                          deviceInfo.isIPhone ? "px-3 h-10 min-w-[44px]" : "px-2 sm:px-3"
                        )}
                      >
                        <Settings className={cn(
                          deviceInfo.isIPhone ? "w-4 h-4" : "w-3 h-3 sm:w-4 sm:h-4 sm:mr-1"
                        )} />
                        <span className="hidden sm:inline text-xs">Settings</span>
                      </Button>
                   </div>
                </div>
              </CardHeader>


              {/* AI Chat Display */}
              {showAIChat && (
                <div className="border-b bg-muted/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">{genieTab === 'gp-genie' ? 'GP Genie' : 'PM Genie'}</h4>
                    <button
                      onClick={() => setShowAIChat(false)}
                      className="text-muted-foreground hover:text-foreground text-sm"
                    >
                      ✕
                    </button>
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

              {/* News Panel - Inline Display */}
              {showNews && (
                <div className="flex-1 overflow-y-auto bg-background">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">GP News & Local Health News</h2>
                    <button
                      onClick={() => setShowNews(false)}
                      className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded hover:bg-muted/50"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="p-4">
                    <NewsPanel cleanView />
                  </div>
                </div>
              )}

              {/* BP Calculator Panel - Inline Display */}
              {showBPCalculator && (
                <div className="flex-1 overflow-y-auto bg-background">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">BP Average Service</h2>
                    <button
                      onClick={() => setShowBPCalculator(false)}
                      className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded hover:bg-muted/50"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="p-4">
                    <BPCalculatorPanel cleanView />
                  </div>
                </div>
              )}

              {/* Translation Panel - Inline Display */}
              {showTranslation && (
                <div className="flex-1 overflow-y-auto bg-background">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Translation Tool</h2>
                    <button
                      onClick={() => setShowTranslation(false)}
                      className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded hover:bg-muted/50"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="p-4">
                    <TranslationToolInterface />
                  </div>
                </div>
              )}

              {/* Main Chat Content - Only show when services are not active */}
              {!showImageCreate && !showImageService && !showNews && !showBPCalculator && !showTranslation && (
                <CardContent className={cn(
                  "flex-1 flex flex-col p-0 relative min-h-0 overflow-hidden",
                  deviceInfo.isIPhone && "pb-safe"
                )}>
                  {messages.length === 0 ? (
                    /* Welcome Screen - Compact, mobile-optimized */
                    <div className={cn(
                      "flex-1 overflow-y-auto space-y-3 sm:space-y-4",
                      isMobile ? "p-4 pb-24" : "p-3 sm:p-6"
                    )} style={{ WebkitOverflowScrolling: 'touch' }}>
                      <div className="w-full max-w-2xl mx-auto space-y-4">
                        {/* Mobile: Compact welcome with horizontal scrollable suggestions */}
                        {isMobile ? (
                          <div className="space-y-4 text-center">
                            <p className="text-sm text-muted-foreground">
                              Ask anything — clinical queries, practice questions, or upload files for analysis
                            </p>
                            
                            {/* Horizontal scrollable suggestion chips */}
                            <div className="overflow-x-auto pb-2 -mx-4 px-4">
                              <div className="flex gap-2 w-max">
                                {[
                                  "NICE hypertension",
                                  "Red flags headache",
                                  "CQC prep",
                                  "QOF diabetes"
                                ].map((query, index) => (
                                  <button
                                    key={index}
                                    onClick={() => setInput(query)}
                                    className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full whitespace-nowrap transition-colors"
                                  >
                                    {query}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            
                            {/* Role Selection Toggle */}
                            {!shouldHideGPClinical && (
                              <div className="flex justify-center mb-2">
                                <RoleToggle
                                  selectedRole={selectedRole}
                                  onRoleChange={setSelectedRole}
                                />
                              </div>
                            )}
                            
                            {/* Show PMHomeScreen for Practice Managers, GPHomeScreen for GP */}
                            {selectedRole === 'practice-manager' ? (
                              <PMHomeScreen
                                setInput={setInput}
                                focusInput={() => inputRef.current?.focus()}
                              />
                            ) : (
                              <GPHomeScreen
                                setInput={setInput}
                                focusInput={() => inputRef.current?.focus()}
                              />
                            )}
                            
                            {/* Collapsible Short Card Disclaimer - Only show for GP role and if user hasn't logged in for a week */}
                            {selectedRole === 'gp' && shouldShowDisclaimer() && (
                              <div className="mt-6">
                                <CollapsibleShortCard 
                                  isCollapsed={disclaimerCollapsed}
                                  onCollapsedChange={updateCollapsedPreference}
                                />
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Show User Prompts - Messages start here */}
                       </div>
                     </div>
                   ) : (
                    /* Messages Area */
                    <div className={cn(
                      "flex-1 min-h-0",
                      deviceInfo.isIPhone && "pb-24"
                    )}>
                      <MessagesList
                        messages={messages}
                        isLoading={isLoading}
                        expandedMessage={expandedMessage}
                        setExpandedMessage={setExpandedMessage}
                        onExportWord={generateWordDocument}
                        onExportPowerPoint={generateWithGamma}
                        onExportPowerPointWithVoiceover={generateFullPresentation}
                        showResponseMetrics={showResponseMetrics}
                        showRenderTimes={showRenderTimes}
                        showAIService={showAIService}
                        onSetDrugName={(drugName: string) => {
                          if (setDrugNameFn) {
                            setDrugNameFn(drugName);
                          }
                        }}
                        autoCollapseUserPrompts={autoCollapseUserPrompts}
                        onQuickResponse={(response) => {
                          // Use the selected model from settings
                          handleQuickResponse(response, practiceContext, selectedModel);
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Input Area at Bottom - Desktop only */}
                  {!showSettings && !showImageService && !isMobile && (
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
                        onNewChat={handleNewSearch}
                        userRole={practiceContext?.userRole}
                        practiceContext={practiceContext}
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Input - Outside main container to avoid overflow clipping */}
      {isMobile && !showSettings && !showImageService && (
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
          userRole={practiceContext?.userRole}
          isMobileView={isMobile}
        />
      )}




      {/* Expanded Message Dialog */}
      <Dialog open={!!expandedMessage} onOpenChange={(open) => !open && setExpandedMessage(null)}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] h-[95vh] p-0 flex flex-col">
          <DialogHeader className="p-4 pb-2 flex-shrink-0 border-b">
            <DialogTitle className="text-left">
              {expandedMessage?.role === 'user' ? 'Your Message' : 'AI Response'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            {expandedMessage && (
              <div className={`prose prose-sm w-full pb-20 ai4gp-text-scaled ${getTextScaleClass(textSize)}`} style={{ maxWidth: 'none' }}>
                <MessageRenderer
                  message={expandedMessage}
                  onExpandMessage={() => {}}
                  onExportWord={generateWordDocument}
                  onExportPowerPoint={generateWithGamma}
                  onExportPowerPointWithVoiceover={generateFullPresentation}
                  isModal={true} // Hide avatar and scroll arrow in modal
                  onCloseModal={() => setExpandedMessage(null)} // Close modal function
                  showResponseMetrics={showResponseMetrics}
                  autoCollapseUserPrompts={autoCollapseUserPrompts}
                />
              </div>
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
          northamptonshireICB={northamptonshireICB}
          onNorthamptonshireICBChange={setNorthamptonshireICB}
          onSaveSettings={saveUserSettings}
          textSize={textSize}
          onTextSizeChange={setTextSize}
          interfaceDensity={interfaceDensity}
          onInterfaceDensityChange={setInterfaceDensity}
          containerWidth={containerWidth}
          onContainerWidthChange={setContainerWidth}
          highContrast={highContrast}
          onHighContrastChange={setHighContrast}
          readingFont={readingFont}
          onReadingFontChange={setReadingFont}
          autoCollapseUserPrompts={autoCollapseUserPrompts}
          onAutoCollapseUserPromptsChange={setAutoCollapseUserPrompts}
          chatHistoryRetentionDays={chatHistoryRetentionDays}
          onChatHistoryRetentionDaysChange={setChatHistoryRetentionDays}
          hideGPClinical={hideGPClinical}
          onHideGPClinicalChange={setHideGPClinical}
          imageGenerationModel={imageGenerationModel}
          onImageGenerationModelChange={setImageGenerationModel}
        />

      {/* Quick Image Modal */}
      <QuickImageModal 
        open={showQuickImageModal} 
        onOpenChange={setShowQuickImageModal} 
      />

      {/* Document Translation Modal */}
      <DocumentTranslateModal
        isOpen={showDocumentTranslate}
        onClose={() => setShowDocumentTranslate(false)}
        onInsertToChat={(text) => setInput(input + (input ? '\n\n' : '') + text)}
      />

      {/* AI Model Verification Chart Modal */}
      <Dialog open={showVerificationChart} onOpenChange={setShowVerificationChart}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[98vh] h-[98vh] p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-left text-xl">AI Model Verification Performance</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <AIModelVerificationChart />
          </div>
        </DialogContent>
      </Dialog>

      {/* Disclaimer Modal - First Time Use - Only show for GP role and if user hasn't logged in for a week */}
      {selectedRole === 'gp' && shouldShowDisclaimer() && (
        <FullModal 
          open={showDisclaimerModal}
          onOpenChange={setShowDisclaimerModal}
          onAccept={handleDisclaimerAccept}
          onDoNotShowAgain={handleDisclaimerDoNotShowAgain}
        />
      )}

      {/* About Modal - Manual Access - Only show for GP role and if user hasn't logged in for a week */}
      {selectedRole === 'gp' && shouldShowDisclaimer() && (
        <FullModal 
          open={showAboutModal}
          onOpenChange={setShowAboutModal}
          onAccept={() => setShowAboutModal(false)}
          onDoNotShowAgain={() => {
            hideDisclaimer();
            setShowAboutModal(false);
          }}
        />
      )}

      {/* User Guide Modal */}
      <AI4GPUserGuide
        isOpen={showUserGuide}
        onClose={() => setShowUserGuide(false)}
      />

      {/* All Quick Actions Modal - Triggered from sidebar */}
      <Dialog open={showAllQuickActions} onOpenChange={setShowAllQuickActions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Quick Actions</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <QuickActionsPanel
              showAllQuickActions={true}
              setShowAllQuickActions={setShowAllQuickActions}
              setInput={setInput}
              selectedRole={selectedRole}
              onInsertIntoChat={setInput}
              onQuickResponse={(response) => handleQuickResponse(response, practiceContext, selectedModel)}
              onOpenDocumentTranslate={() => setShowDocumentTranslate(true)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting Preview Drawer */}
      <MeetingPreviewDrawer
        meetingId={previewMeetingId}
        open={showMeetingPreview}
        onOpenChange={setShowMeetingPreview}
      />

      {/* PowerPoint Generation Overlay */}
      <PowerPointGenerationOverlay 
        isVisible={isPowerPointGenerating || isFullPowerPointGenerating} 
        currentPhase={currentPhase}
        isFullVersion={isFullPowerPointGenerating}
      />

      {/* Image Branding Dialog */}
      <ImageBrandingDialog
        open={showBrandingDialog}
        onOpenChange={setShowBrandingDialog}
        practiceContext={practiceContext}
        onConfirm={(brandingLevel, customBranding) => handleBrandingConfirm(brandingLevel, customBranding, practiceContext)}
        onCancel={handleBrandingCancel}
        requestType={pendingImageRequest?.imageDetection?.requestType || 'general'}
      />

    </>
  );
};

export default AI4GPService;