import React from 'react';
import { Label } from '@/components/ui/label';
import { Zap, Sparkles, Brain } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AIModel } from '@/hooks/useAIModelPreference';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ModelSelectorProps {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
}

const MODEL_OPTIONS: { value: AIModel; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'grok-beta', 
    label: 'Speed', 
    icon: <Zap className="w-3 h-3" />,
    description: 'Grok - Fastest responses'
  },
  { 
    value: 'google/gemini-3-flash-preview', 
    label: 'Balanced', 
    icon: <Sparkles className="w-3 h-3" />,
    description: 'Gemini 3 Flash - Best balance of speed & quality (recommended)'
  },
  { 
    value: 'openai/gpt-5-mini', 
    label: 'Quality', 
    icon: <Brain className="w-3 h-3" />,
    description: 'GPT-5 - Highest accuracy for complex tasks'
  },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
}) => {
  const currentModel = MODEL_OPTIONS.find(m => m.value === selectedModel) || MODEL_OPTIONS[1];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center p-1.5 rounded-md bg-muted/50">
            <ToggleGroup 
              type="single" 
              value={selectedModel}
              onValueChange={(value) => value && onModelChange(value as AIModel)}
              className="gap-0.5"
            >
              {MODEL_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.description}
                  className="flex items-center gap-1 px-2 py-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {option.icon}
                  <span className="hidden sm:inline">{option.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center max-w-xs">
            <p className="font-medium">AI Model Selection</p>
            <p className="text-xs text-muted-foreground mt-1">
              Currently using: <span className="font-medium text-foreground">{currentModel.label}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{currentModel.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};