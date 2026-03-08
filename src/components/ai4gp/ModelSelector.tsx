import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Brain } from 'lucide-react';

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  tier: 'premium' | 'standard' | 'openai';
  provider: 'google' | 'openai';
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    description: 'Most intelligent — complex reasoning, coding, clinical queries',
    tier: 'premium',
    provider: 'google',
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash-Lite',
    description: 'Fastest & cheapest — 2.5× faster than previous Flash models',
    tier: 'standard',
    provider: 'google',
  },
  {
    id: 'google/gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    description: 'Balanced speed and quality',
    tier: 'standard',
    provider: 'google',
  },
  {
    id: 'openai/gpt-5',
    label: 'GPT-5',
    description: 'OpenAI flagship — strong reasoning and long context',
    tier: 'openai',
    provider: 'openai',
  },
  {
    id: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
    description: 'OpenAI balanced — lower cost, good quality',
    tier: 'openai',
    provider: 'openai',
  },
];

const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite-preview';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  compact?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  compact = false,
}) => {
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel);
  const displayLabel = currentModel?.label || 'Select model';

  const premiumModels = AVAILABLE_MODELS.filter(m => m.tier === 'premium');
  const standardModels = AVAILABLE_MODELS.filter(m => m.tier === 'standard');
  const openaiModels = AVAILABLE_MODELS.filter(m => m.tier === 'openai');

  return (
    <TooltipProvider>
      <Select value={selectedModel} onValueChange={onModelChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger className={compact ? "h-8 text-xs bg-muted/50 border-border/50 w-auto min-w-[160px]" : "h-11 bg-background"}>
              <SelectValue placeholder="Select model">
                <span className="flex items-center gap-1.5">
                  {currentModel?.tier === 'premium' && <Sparkles className="h-3 w-3 text-amber-500" />}
                  {currentModel?.tier === 'standard' && <Zap className="h-3 w-3 text-primary" />}
                  {currentModel?.tier === 'openai' && <Brain className="h-3 w-3 text-blue-500" />}
                  {displayLabel}
                </span>
              </SelectValue>
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{currentModel?.description}</p>
          </TooltipContent>
        </Tooltip>
        <SelectContent className="bg-popover border border-border z-[9999]">
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" /> Premium
            </SelectLabel>
            {premiumModels.map(m => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex items-center gap-2">
                  <span>{m.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1.5 text-primary">
              <Zap className="h-3 w-3" /> Standard
            </SelectLabel>
            {standardModels.map(m => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex items-center gap-2">
                  <span>{m.label}</span>
                  {m.id === DEFAULT_MODEL && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      Recommended
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1.5 text-blue-500">
              <Brain className="h-3 w-3" /> OpenAI
            </SelectLabel>
            {openaiModels.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </TooltipProvider>
  );
};
