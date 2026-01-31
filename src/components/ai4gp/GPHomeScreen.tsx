import React, { useState } from 'react';
import { 
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { gpCategories, type MainCategory, type SubCategory, type PromptItem } from './gpPromptCategories';
import { ContextBanner } from './ContextBanner';

interface GPHomeScreenProps {
  setInput: (text: string) => void;
  focusInput?: () => void;
}

type ActiveView = 
  | { type: 'main' }
  | { type: 'subcategories'; category: MainCategory }
  | { type: 'prompts'; category: MainCategory; subCategory: SubCategory };

export const GPHomeScreen: React.FC<GPHomeScreenProps> = ({ setInput, focusInput }) => {
  const { practiceContext, practiceDetails } = usePracticeContext();
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'main' });
  const [showBanner, setShowBanner] = useState(false);

  const enhancePrompt = (prompt: string) => {
    if (!prompt) return prompt;
    
    let enhanced = prompt;
    
    // Add practice details for prompts that need them
    if (practiceContext.practiceName && (
      prompt.toLowerCase().includes('practice') ||
      prompt.toLowerCase().includes('response') ||
      prompt.toLowerCase().includes('complaint') ||
      prompt.toLowerCase().includes('letter')
    )) {
      enhanced += `\n\nYOUR PRACTICE DETAILS:\n- Practice Name: ${practiceContext.practiceName}`;
      if (practiceDetails?.address || practiceContext.practiceAddress) {
        enhanced += `\n- Address: ${practiceDetails?.address || practiceContext.practiceAddress}`;
      }
      if (practiceDetails?.phone || practiceContext.practicePhone) {
        enhanced += `\n- Phone: ${practiceDetails?.phone || practiceContext.practicePhone}`;
      }
      if (practiceDetails?.email || practiceContext.practiceEmail) {
        enhanced += `\n- Email: ${practiceDetails?.email || practiceContext.practiceEmail}`;
      }
    }
    
    return enhanced;
  };

  const showPromptInsertedToast = () => {
    toast.success('Prompt inserted', {
      description: 'Add clinical details below the prompt for best results.',
      duration: 3000,
    });
  };

  const handleCategoryClick = (category: MainCategory) => {
    if (category.focusOnly) {
      focusInput?.();
    } else if (category.subCategories.length > 0) {
      setActiveView({ type: 'subcategories', category });
    }
  };

  const handleSubCategoryClick = (category: MainCategory, subCategory: SubCategory) => {
    if (subCategory.prompts.length > 0) {
      setActiveView({ type: 'prompts', category, subCategory });
    }
  };

  const handlePromptClick = (prompt: PromptItem) => {
    setInput(enhancePrompt(prompt.prompt));
    setActiveView({ type: 'main' });
    setShowBanner(true);
    showPromptInsertedToast();
  };

  const handleBack = () => {
    if (activeView.type === 'prompts') {
      setActiveView({ type: 'subcategories', category: activeView.category });
    } else {
      setActiveView({ type: 'main' });
    }
  };

  const renderCard = (
    id: string,
    shortTitle: string,
    title: string,
    description: string,
    Icon: React.ElementType,
    gradient: string,
    onClick: () => void
  ) => (
    <Tooltip key={id}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "group flex items-center gap-2 p-2.5",
            "bg-card border border-border rounded-lg",
            "hover:border-primary/50 hover:bg-accent/50",
            "transition-all duration-150",
            "text-left min-w-0 overflow-hidden"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            "bg-gradient-to-br",
            gradient
          )}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {shortTitle}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </TooltipContent>
    </Tooltip>
  );

  const renderSimpleCard = (
    id: string,
    shortTitle: string,
    Icon: React.ElementType,
    gradient: string,
    onClick: () => void
  ) => (
    <button
      key={id}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 p-2.5",
        "bg-card border border-border rounded-lg",
        "hover:border-primary/50 hover:bg-accent/50",
        "transition-all duration-150",
        "text-left min-w-0 overflow-hidden"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
        "bg-gradient-to-br",
        gradient
      )}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
        {shortTitle}
      </span>
    </button>
  );

  return (
    <div className="p-3 sm:p-4">
      <div className="space-y-3">
        {activeView.type === 'main' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl mx-auto">
              {gpCategories.map((category) => 
                renderCard(
                  category.id,
                  category.shortTitle,
                  category.title,
                  category.description,
                  category.icon,
                  category.gradient,
                  () => handleCategoryClick(category)
                )
              )}
            </div>


            {/* Context Banner - full width, positioned below buttons */}
            {showBanner && (
              <div className="w-full pt-4">
                <ContextBanner onDismiss={() => setShowBanner(false)} />
              </div>
            )}
          </>
        ) : activeView.type === 'subcategories' ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to main menu</span>
            </button>
            
            <div className="flex items-center gap-2 justify-center">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                "bg-gradient-to-br",
                activeView.category.gradient
              )}>
                <activeView.category.icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-medium text-foreground">{activeView.category.title}</h3>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeView.category.subCategories.map((subCategory) => 
                renderCard(
                  subCategory.id,
                  subCategory.shortTitle,
                  subCategory.title,
                  subCategory.description,
                  subCategory.icon,
                  subCategory.gradient,
                  () => handleSubCategoryClick(activeView.category, subCategory)
                )
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {activeView.category.shortTitle}</span>
            </button>
            
            <div className="flex items-center gap-2 justify-center">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                "bg-gradient-to-br",
                activeView.subCategory.gradient
              )}>
                <activeView.subCategory.icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-medium text-foreground">{activeView.subCategory.title}</h3>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeView.subCategory.prompts.map((prompt) => 
                renderSimpleCard(
                  prompt.id,
                  prompt.shortTitle,
                  activeView.subCategory.icon,
                  activeView.subCategory.gradient,
                  () => handlePromptClick(prompt)
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
