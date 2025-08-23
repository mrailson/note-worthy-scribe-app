import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Minus, ChevronDown } from 'lucide-react';
import { quickActions, practiceManagerQuickActions, QuickAction } from '@/constants/quickActions';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import AITestModal from '@/components/AITestModal';

interface QuickActionsPanelProps {
  showAllQuickActions: boolean;
  setShowAllQuickActions: (show: boolean) => void;
  setInput: (input: string) => void;
  selectedRole?: 'gp' | 'practice-manager';
  onOpenAITestModal?: () => void;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  showAllQuickActions,
  setShowAllQuickActions,
  setInput,
  selectedRole = 'gp',
  onOpenAITestModal
}) => {
  const { practiceContext, practiceDetails } = usePracticeContext();
  const isMobile = useIsMobile();
  const [isAITestModalOpen, setIsAITestModalOpen] = useState(false);
  
  // Get the appropriate actions based on selected role
  const currentActions = selectedRole === 'practice-manager' ? practiceManagerQuickActions : quickActions;
  
  // Show only 3 actions on mobile, 4 on desktop
  const maxVisibleActions = isMobile ? 3 : 4;
  const visibleActions = showAllQuickActions ? currentActions : currentActions.slice(0, maxVisibleActions);

  // Function to replace practice placeholders with actual practice information
  const enhancePromptWithPracticeInfo = (prompt: string) => {
    if (!prompt.toLowerCase().includes('my practice') && !prompt.toLowerCase().includes('[practice')) {
      return prompt;
    }

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

    // Add practice context to the end of the prompt if it mentions practice
    if ((prompt.toLowerCase().includes('my practice') || prompt.toLowerCase().includes('[practice')) && practiceContext.practiceName) {
      enhancedPrompt += `\n\nPRACTICE CONTEXT:\n- Practice Name: ${practiceContext.practiceName}`;
      
      if (practiceDetails?.address) {
        enhancedPrompt += `\n- Address: ${practiceDetails.address}`;
      }
      if (practiceDetails?.email) {
        enhancedPrompt += `\n- Email: ${practiceDetails.email}`;
      }
      if (practiceDetails?.phone) {
        enhancedPrompt += `\n- Phone: ${practiceDetails.phone}`;
      }
      if (practiceContext.pcnName) {
        enhancedPrompt += `\n- PCN: ${practiceContext.pcnName}`;
      }
      if (practiceContext.practiceManagerName) {
        enhancedPrompt += `\n- Practice Manager: ${practiceContext.practiceManagerName}`;
      }
      if (practiceDetails?.email_signature) {
        enhancedPrompt += `\n- Email Signature: Available in practice settings`;
      }
      if (practiceDetails?.letter_signature) {
        enhancedPrompt += `\n- Letter Signature: Available in practice settings`;
      }
    }

    return enhancedPrompt;
  };

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visibleActions.map((action, index) => {
            const IconComponent = action.icon;
            
            const handleClick = () => {
              if (action.action === 'open-ai-test-modal') {
                if (onOpenAITestModal) {
                  onOpenAITestModal();
                } else {
                  setIsAITestModalOpen(true);
                }
              } else if (!action.submenu) {
                setInput(enhancePromptWithPracticeInfo(action.prompt));
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
                      className="justify-between text-left h-auto py-2 px-3 w-full"
                    >
                      <div className="flex items-center">
                        <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{action.label}</span>
                      </div>
                      <ChevronDown className="w-3 h-3 ml-1" />
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
                        onClick={() => setInput(enhancePromptWithPracticeInfo(subItem.prompt))}
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
                className="justify-start text-left h-auto py-2 px-3"
                onClick={handleClick}
              >
                <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">{action.label}</span>
              </Button>
            );
          })}
        </div>
        
        {/* Don't show expand button on mobile, and only show if there are more actions than visible */}
        {!isMobile && currentActions.length > maxVisibleActions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllQuickActions(!showAllQuickActions)}
            className="w-full"
          >
            {showAllQuickActions ? (
              <>
                <Minus className="w-4 h-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
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
    </>
  );
};