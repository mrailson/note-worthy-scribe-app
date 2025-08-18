import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { quickActions, practiceManagerQuickActions } from '@/constants/quickActions';
import { usePracticeContext } from '@/hooks/usePracticeContext';

interface QuickActionsPanelProps {
  showAllQuickActions: boolean;
  setShowAllQuickActions: (show: boolean) => void;
  setInput: (input: string) => void;
  selectedRole?: 'gp' | 'practice-manager';
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  showAllQuickActions,
  setShowAllQuickActions,
  setInput,
  selectedRole = 'gp'
}) => {
  const { practiceContext, practiceDetails } = usePracticeContext();
  
  // Get the appropriate actions based on selected role
  const currentActions = selectedRole === 'practice-manager' ? practiceManagerQuickActions : quickActions;
  
  const visibleActions = showAllQuickActions ? currentActions : currentActions.slice(0, 4);

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
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visibleActions.map((action, index) => {
          const IconComponent = action.icon;
          return (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="justify-start text-left h-auto py-2 px-3"
              onClick={() => setInput(enhancePromptWithPracticeInfo(action.prompt))}
            >
              <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">{action.label}</span>
            </Button>
          );
        })}
      </div>
      
      {currentActions.length > 4 && (
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
              Show More ({currentActions.length - 4} more)
            </>
          )}
        </Button>
      )}
    </div>
  );
};