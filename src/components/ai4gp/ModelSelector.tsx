import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Brain, Shield } from 'lucide-react';

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  tier: 'premium' | 'standard' | 'stable' | 'openai';
  provider: 'google' | 'openai';
  badge?: string;
  badgeClass?: string;
  infoNote?: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Fastest & most cost-efficient. Best for general queries.',
    tier: 'standard',
    provider: 'google',
    badge: 'Recommended',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    description: 'Most intelligent. Best for complex reasoning & clinical queries. May be slower.',
    tier: 'premium',
    provider: 'google',
    badge: 'Premium',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    infoNote: 'Most capable model. May experience occasional delays during high demand.',
  },
  {
    id: 'google/gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    description: 'Proven reliability. Good all-rounder.',
    tier: 'stable',
    provider: 'google',
    badge: 'Stable',
    badgeClass: 'bg-muted text-muted-foreground border-border',
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

const DEFAULT_MODEL = 'google/gemini-2.5-flash';

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

  const googleModels = AVAILABLE_MODELS.filter(m => m.provider === 'google');
  const openaiModels = AVAILABLE_MODELS.filter(m => m.provider === 'openai');

  const getTierIcon = (model: ModelOption) => {
    if (model.tier === 'premium') return <Sparkles className="h-3 w-3 text-purple-500" />;
    if (model.tier === 'stable') return <Shield className="h-3 w-3 text-muted-foreground" />;
    if (model.tier === 'openai') return <Brain className="h-3 w-3 text-blue-500" />;
    return <Zap className="h-3 w-3 text-green-500" />;
  };

  return (
    <TooltipProvider>
      <Select value={selectedModel} onValueChange={onModelChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger className={compact ? "h-8 text-xs bg-muted/50 border-border/50 w-auto min-w-[160px]" : "h-11 bg-background"}>
              <SelectValue placeholder="Select model">
                <span className="flex items-center gap-1.5">
                  {currentModel && getTierIcon(currentModel)}
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
            <SelectLabel className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Zap className="h-3 w-3" /> Google Models
            </SelectLabel>
            {googleModels.map(m => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    {getTierIcon(m)}
                    <span>{m.label}</span>
                    {m.badge && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${m.badgeClass}`}>
                        {m.badge}
                      </Badge>
                    )}
                  </div>
                  {m.infoNote && (
                    <span className="text-[10px] text-muted-foreground ml-5 leading-tight">
                      {m.infoNote}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
          {openaiModels.length > 0 && (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-1.5 text-blue-500">
                <Brain className="h-3 w-3" /> OpenAI
              </SelectLabel>
              {openaiModels.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <Brain className="h-3 w-3 text-blue-500" />
                    <span>{m.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </TooltipProvider>
  );
};
