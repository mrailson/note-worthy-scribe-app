import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Minus, ChevronDown } from 'lucide-react';
import { quickActions, practiceManagerQuickActions, QuickAction } from '@/constants/quickActions';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useIsMobile, useDeviceInfo } from '@/hooks/use-mobile';
import AITestModal from '@/components/AITestModal';
import MeetingNotesInterface from '@/components/MeetingNotesInterface';
import { PowerPointGenerator } from '@/components/PowerPointGenerator';
import { QRCodeGeneratorModal } from '@/components/QRCodeGeneratorModal';
import { AudioUploadModal } from '@/components/AudioUploadModal';
import { TeamsTranscriptImportModal } from '@/components/meeting/TeamsTranscriptImportModal';
import { QuickImageModal } from '@/components/QuickImageModal';
import { ImageStudioModal } from '@/components/ai4gp/ImageStudioModal';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface QuickActionsPanelProps {
  showAllQuickActions: boolean;
  setShowAllQuickActions: (show: boolean) => void;
  setInput: (input: string) => void;
  selectedRole?: 'gp' | 'practice-manager';
  onOpenAITestModal?: () => void;
  onInsertIntoChat?: (message: string) => void;
  onQuickResponse?: (response: string) => void;
  onOpenDocumentTranslate?: () => void;
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  showAllQuickActions,
  setShowAllQuickActions,
  setInput,
  selectedRole = 'gp',
  onOpenAITestModal,
  onInsertIntoChat,
  onQuickResponse,
  onOpenDocumentTranslate,
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview'
}) => {
  const navigate = useNavigate();
  const { practiceContext, practiceDetails } = usePracticeContext();
  const isMobile = useIsMobile();
  const deviceInfo = useDeviceInfo();
  const [isAITestModalOpen, setIsAITestModalOpen] = useState(false);
  const [showMeetingNotesInterface, setShowMeetingNotesInterface] = useState(false);
  const [isPowerPointOpen, setIsPowerPointOpen] = useState(false);
  const [isQRCodeGeneratorOpen, setIsQRCodeGeneratorOpen] = useState(false);
  const [isAudioUploadOpen, setIsAudioUploadOpen] = useState(false);
  const [isTeamsImportOpen, setIsTeamsImportOpen] = useState(false);
  const [isQuickImageOpen, setIsQuickImageOpen] = useState(false);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  
  // Force cache refresh - removed ConsultationCheckerModal completely
  console.log('QuickActionsPanel rendered - cache refresh');
  
  // Add event listener for QR Code Generator
  useEffect(() => {
    const handleOpenQRCodeGenerator = () => {
      setIsQRCodeGeneratorOpen(true);
    };

    window.addEventListener('openQRCodeGenerator', handleOpenQRCodeGenerator);
    
    return () => {
      window.removeEventListener('openQRCodeGenerator', handleOpenQRCodeGenerator);
    };
  }, []);
  
  // Get the appropriate actions based on selected role
  const currentActions = selectedRole === 'practice-manager' ? practiceManagerQuickActions : quickActions;
  
  // Show only 3 actions on mobile, 4 on desktop
  const maxVisibleActions = isMobile ? 3 : 4;
  const visibleActions = showAllQuickActions ? currentActions : currentActions.slice(0, maxVisibleActions);

  // Function to replace practice placeholders with actual practice information
  const enhancePromptWithPracticeInfo = (prompt: string, actionLabel?: string) => {
    console.log('🔧 QuickActions: Enhancing prompt for action:', actionLabel);
    console.log('🏥 QuickActions: Practice context available:', practiceContext);
    console.log('📋 QuickActions: Practice details available:', practiceDetails);
    let enhancedPrompt = prompt;
    
    if (practiceContext.practiceName) {
      enhancedPrompt = enhancedPrompt.replace(/\[practice name\]/gi, practiceContext.practiceName);
      enhancedPrompt = enhancedPrompt.replace(/my practice/gi, practiceContext.practiceName);
    }
    
    if (practiceDetails) {
      if (practiceDetails.address) {
        enhancedPrompt = enhancedPrompt.replace(/\[practice address\]/gi, practiceDetails.address);
      }
      if (practiceDetails.email) {
        enhancedPrompt = enhancedPrompt.replace(/\[practice email\]/gi, practiceDetails.email);
      }
      if (practiceDetails.phone) {
        enhancedPrompt = enhancedPrompt.replace(/\[practice phone\]/gi, practiceDetails.phone);
      }
      if (practiceDetails.website) {
        enhancedPrompt = enhancedPrompt.replace(/\[practice website\]/gi, practiceDetails.website);
      }
    }
    
    if (practiceContext.pcnName) {
      enhancedPrompt = enhancedPrompt.replace(/\[pcn name\]/gi, practiceContext.pcnName);
    }

    // Add practice context to the end of the prompt if it mentions practice OR is a complaint response
    const isComplaintResponse = prompt.toLowerCase().includes('complaint response') || 
                               prompt.toLowerCase().includes('complaint helper') ||
                               actionLabel?.toLowerCase().includes('complaint');
    const mentionsPractice = prompt.toLowerCase().includes('my practice') || 
                           prompt.toLowerCase().includes('[practice') ||
                           isComplaintResponse;
    
    console.log('🔍 QuickActions: Detection results:', { 
      isComplaintResponse, 
      mentionsPractice, 
      hasPracticeName: !!practiceContext.practiceName 
    });
    
    if ((mentionsPractice || isComplaintResponse) && practiceContext.practiceName) {
      console.log('✅ QuickActions: Adding practice details to prompt');
      enhancedPrompt += `\n\nYOUR PRACTICE DETAILS (use these actual details, not placeholders):
- Practice Name: ${practiceContext.practiceName}`;
      
      if (practiceDetails?.address || practiceContext.practiceAddress) {
        enhancedPrompt += `\n- Practice Address: ${practiceDetails?.address || practiceContext.practiceAddress}`;
      }
      if (practiceDetails?.phone || practiceContext.practicePhone) {
        enhancedPrompt += `\n- Practice Phone: ${practiceDetails?.phone || practiceContext.practicePhone}`;
      }
      if (practiceDetails?.email || practiceContext.practiceEmail) {
        enhancedPrompt += `\n- Practice Email: ${practiceDetails?.email || practiceContext.practiceEmail}`;
      }
      if (practiceDetails?.website || practiceContext.practiceWebsite) {
        enhancedPrompt += `\n- Practice Website: ${practiceDetails?.website || practiceContext.practiceWebsite}`;
      }
      if (practiceContext.pcnName) {
        enhancedPrompt += `\n- PCN: ${practiceContext.pcnName}`;
      }
      if (practiceContext.practiceManagerName) {
        enhancedPrompt += `\n- Practice Manager: ${practiceContext.practiceManagerName}`;
      }
      if (practiceContext.userFullName) {
        enhancedPrompt += `\n- User Name: ${practiceContext.userFullName}`;
      }
      if (practiceDetails?.email_signature || practiceContext.emailSignature) {
        enhancedPrompt += `\n- Email Signature: Available in practice settings`;
      }
      if (practiceDetails?.letter_signature || practiceContext.letterSignature) {
        enhancedPrompt += `\n- Letter Signature: Available in practice settings`;
      }
      
      if (isComplaintResponse) {
        enhancedPrompt += `\n\nIMPORTANT: Use the actual practice details above in your response. Do NOT use placeholder text like "[Your Practice Address]" or "[Phone Number]". Replace all placeholders with the real information provided above.`;
      }
    } else {
      console.log('❌ QuickActions: NOT adding practice details because:', {
        mentionsPractice,
        isComplaintResponse,
        hasPracticeName: !!practiceContext.practiceName
      });
    }

    console.log('📝 QuickActions: Final enhanced prompt length:', enhancedPrompt.length);
    console.log('📝 QuickActions: Enhanced prompt preview:', enhancedPrompt.substring(0, 200) + '...');
    return enhancedPrompt;
  };

  return (
    <>
      {/* Meeting Notes Interface - Show when activated */}
      {showMeetingNotesInterface && (
        <div className="mb-6 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Meeting Notes Service</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowMeetingNotesInterface(false)}
            >
              ✕
            </Button>
          </div>
          <MeetingNotesInterface />
        </div>
      )}

      <div className={cn(
        "space-y-2",
        deviceInfo.isIPhone && "space-y-3"
      )}>
        <div className={cn(
          "grid gap-2",
          deviceInfo.isIPhone ? "grid-cols-1 gap-3" : "grid-cols-1 sm:grid-cols-2 gap-2"
        )}>
          {visibleActions.map((action, index) => {
            const IconComponent = action.icon;
            
            const handleClick = () => {
              if (action.action === 'open-ai-test-modal') {
                if (onOpenAITestModal) {
                  onOpenAITestModal();
                } else {
                  setIsAITestModalOpen(true);
                }
              } else if (action.action === 'open-drug-lookup-modal') {
                // Trigger the drug lookup modal
                window.dispatchEvent(new CustomEvent('openDrugModal'));
              } else if (action.action === 'open-powerpoint-generator') {
                setIsPowerPointOpen(true);
              } else if (action.action === 'translate-document') {
                // Trigger the document translate modal
                if (onOpenDocumentTranslate) {
                  onOpenDocumentTranslate();
                }
              } else if (action.action && action.action.startsWith('open-test-transcripts')) {
                // Navigate to test transcripts page with appropriate tab
                const tab = action.action.replace('open-test-transcripts-', '');
                window.open(`/test-transcripts#${tab}`, '_blank');
              } else if (action.action === 'open-meeting-recorder') {
                // Navigate to Meeting Recorder page (Index)
                navigate('/');
              } else if (action.action === 'open-audio-upload') {
                setIsAudioUploadOpen(true);
              } else if (action.action === 'open-teams-import') {
                setIsTeamsImportOpen(true);
              } else if (action.action === 'open-quick-image-modal') {
                setIsQuickImageOpen(true);
              } else if (action.action === 'open-image-studio') {
                setIsImageStudioOpen(true);
              } else if (!action.submenu) {
                setInput(enhancePromptWithPracticeInfo(action.prompt, action.label));
              }
            };

            // If action has a submenu, render a dropdown
            if (action.submenu && action.submenu.length > 0) {
              console.log('Rendering submenu for:', action.label, action.submenu);
              return (
                <DropdownMenu key={index}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "justify-between text-left h-auto w-full",
                        deviceInfo.isIPhone ? "py-3 px-4 min-h-[48px]" : "py-2 px-3"
                      )}
                    >
                      <div className="flex items-center">
                        <IconComponent className={cn(
                          "flex-shrink-0 mr-2",
                          deviceInfo.isIPhone ? "w-5 h-5" : "w-4 h-4"
                        )} />
                        <span className={cn(
                          "truncate",
                          deviceInfo.isIPhone && "text-base"
                        )}>{action.label}</span>
                      </div>
                      <ChevronDown className={cn(
                        "ml-1",
                        deviceInfo.isIPhone ? "w-4 h-4" : "w-3 h-3"
                      )} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-64 bg-popover border border-border shadow-lg z-[9999]"
                    sideOffset={8}
                  >
                    {action.submenu.map((subItem, subIndex) => (
                      <DropdownMenuItem
                        key={subIndex}
                        onClick={() => {
                          if (subItem.action === 'open-ai-test-modal') {
                            if (onOpenAITestModal) {
                              onOpenAITestModal();
                            } else {
                              setIsAITestModalOpen(true);
                            }
                           } else if (subItem.action === 'open-drug-lookup-modal') {
                             // Trigger the drug lookup modal
                             window.dispatchEvent(new CustomEvent('openDrugModal'));
                           } else if (subItem.action === 'open-powerpoint-generator') {
                             setIsPowerPointOpen(true);
                           } else if (subItem.action === 'translate-document') {
                             // Trigger the document translate modal
                             if (onOpenDocumentTranslate) {
                               onOpenDocumentTranslate();
                             }
                           } else if (subItem.action && subItem.action.startsWith('open-test-transcripts')) {
                            // Navigate to test transcripts page with appropriate tab
                            const tab = subItem.action.replace('open-test-transcripts-', '');
                            window.open(`/test-transcripts#${tab}`, '_blank');
                            } else if (subItem.action === 'open-meeting-recorder') {
                              // Navigate to Meeting Recorder page (Index)
                              navigate('/');
                            } else if (subItem.action === 'open-audio-upload') {
                              setIsAudioUploadOpen(true);
                            } else if (subItem.action === 'open-teams-import') {
                              setIsTeamsImportOpen(true);
                            } else if (subItem.action === 'open-quick-image-modal') {
                              setIsQuickImageOpen(true);
                            } else {
                            setInput(enhancePromptWithPracticeInfo(subItem.prompt, subItem.label));
                          }
                        }}
                        className="cursor-pointer text-popover-foreground hover:bg-accent hover:text-accent-foreground px-3 py-2"
                      >
                        {subItem.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left h-auto",
                  deviceInfo.isIPhone ? "py-3 px-4 min-h-[48px]" : "py-2 px-3"
                )}
                onClick={handleClick}
              >
                <IconComponent className={cn(
                  "flex-shrink-0 mr-2",
                  deviceInfo.isIPhone ? "w-5 h-5" : "w-4 h-4"
                )} />
                <span className={cn(
                  "truncate",
                  deviceInfo.isIPhone && "text-base"
                )}>{action.label}</span>
              </Button>
            );
          })}
        </div>
        
        {/* Show expand button if there are more actions than visible */}
        {currentActions.length > maxVisibleActions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllQuickActions(!showAllQuickActions)}
            className={cn(
              "w-full",
              deviceInfo.isIPhone && "py-3 min-h-[48px] text-base"
            )}
          >
            {showAllQuickActions ? (
              <>
                <Minus className={cn(deviceInfo.isIPhone ? "w-5 h-5 mr-2" : "w-4 h-4 mr-2")} />
                Show Less
              </>
            ) : (
              <>
                <Plus className={cn(deviceInfo.isIPhone ? "w-5 h-5 mr-2" : "w-4 h-4 mr-2")} />
                Show More ({currentActions.length - maxVisibleActions} more)
              </>
            )}
          </Button>
        )}
      </div>

      {/* AI Test Modal */}
      <AITestModal 
        open={isAITestModalOpen} 
        onOpenChange={setIsAITestModalOpen} 
      />
      
      {/* PowerPoint Generator Modal */}
      <PowerPointGenerator
        open={isPowerPointOpen}
        onOpenChange={setIsPowerPointOpen}
      />
      
      {/* QR Code Generator Modal */}
      <QRCodeGeneratorModal
        open={isQRCodeGeneratorOpen}
        onOpenChange={setIsQRCodeGeneratorOpen}
      />
      
      {/* Audio Upload Modal */}
      <AudioUploadModal
        open={isAudioUploadOpen}
        onOpenChange={setIsAudioUploadOpen}
      />
      
      {/* Teams Transcript Import Modal */}
      <TeamsTranscriptImportModal
        open={isTeamsImportOpen}
        onOpenChange={setIsTeamsImportOpen}
      />
      
      {/* Quick Image Modal */}
      <QuickImageModal
        open={isQuickImageOpen}
        onOpenChange={setIsQuickImageOpen}
      />
      
      {/* Image Studio Modal */}
      <ImageStudioModal
        open={isImageStudioOpen}
        onOpenChange={setIsImageStudioOpen}
        imageGenerationModel={imageGenerationModel}
      />
    </>
  );
};