import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bot, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AIModel } from '@/hooks/useAIModelPreference';

interface ModelSelectorProps {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
}) => {
  const isGrok = selectedModel === 'grok';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/50">
            <div className="flex items-center space-x-1">
              <Bot className={`w-3 h-3 transition-colors ${!isGrok ? 'text-primary' : 'text-muted-foreground/50'}`} />
              <Label className={`text-xs cursor-pointer transition-colors ${!isGrok ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                Claude
              </Label>
            </div>
            
            <Switch
              checked={isGrok}
              onCheckedChange={(checked) => onModelChange(checked ? 'grok' : 'claude')}
              className="scale-75"
            />
            
            <div className="flex items-center space-x-1">
              <Label className={`text-xs cursor-pointer transition-colors ${isGrok ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                Grok
              </Label>
              <Zap className={`w-3 h-3 transition-colors ${isGrok ? 'text-primary' : 'text-muted-foreground/50'}`} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">AI Model Selection</p>
            <p className="text-xs text-muted-foreground mt-1">
              Currently using: <span className="font-medium text-foreground">{selectedModel === 'claude' ? 'Claude (Anthropic)' : 'Grok (xAI)'}</span>
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};