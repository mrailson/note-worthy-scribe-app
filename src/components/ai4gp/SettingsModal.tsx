import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Search, Bot, Clock, Zap } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionMemory: boolean;
  onSessionMemoryChange: (enabled: boolean) => void;
  includeLatestUpdates: boolean;
  onIncludeLatestUpdatesChange: (enabled: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  showResponseMetrics: boolean;
  onShowResponseMetricsChange: (enabled: boolean) => void;
  lightningMode: boolean;
  onLightningModeChange: (enabled: boolean) => void;
}

const AI_MODELS = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    description: 'Most advanced flagship model with current web access',
    recommended: true
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    description: 'Fast and efficient GPT-5 variant'
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    description: 'Reliable GPT-4 model'
  },
  {
    id: 'o3',
    name: 'O3',
    provider: 'OpenAI',
    description: 'Advanced reasoning model'
  },
  {
    id: 'o4-mini',
    name: 'O4 Mini',
    provider: 'OpenAI',
    description: 'Fast reasoning model'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (Legacy)',
    provider: 'OpenAI',
    description: 'Legacy fast model'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Legacy)',
    provider: 'OpenAI',
    description: 'Legacy powerful model'
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    description: 'Google\'s flagship model'
  }
];


export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  sessionMemory,
  onSessionMemoryChange,
  includeLatestUpdates,
  onIncludeLatestUpdatesChange,
  selectedModel,
  onModelChange,
  showResponseMetrics,
  onShowResponseMetricsChange,
  lightningMode,
  onLightningModeChange
}) => {
  const selectedModelInfo = AI_MODELS.find(model => model.id === selectedModel) || AI_MODELS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI4GP Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* AI Model Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedModel} onValueChange={onModelChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.recommended && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <div className="font-medium">{selectedModelInfo.name} by {selectedModelInfo.provider}</div>
                <div className="mt-1">{selectedModelInfo.description}</div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="lightning-mode" className="text-sm font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    Lightning Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ultra-fast responses with basic web search - disables files and memory
                  </p>
                </div>
                <Switch
                  id="lightning-mode"
                  checked={lightningMode}
                  onCheckedChange={onLightningModeChange}
                />
              </div>

              {!lightningMode && (
                <>
                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="session-memory" className="text-sm font-medium">
                        Session Memory
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Remember conversation context throughout the session
                      </p>
                    </div>
                    <Switch
                      id="session-memory"
                      checked={sessionMemory}
                      onCheckedChange={onSessionMemoryChange}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="web-search" className="text-sm font-medium flex items-center gap-1">
                        <Search className="h-3 w-3" />
                        Real-Time Web Search
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Access current information from NHS, gov.uk, and authoritative sources
                      </p>
                    </div>
                    <Switch
                      id="web-search"
                      checked={includeLatestUpdates}
                      onCheckedChange={onIncludeLatestUpdatesChange}
                    />
                  </div>
                </>
              )}
              
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="response-metrics" className="text-sm font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Response Metrics
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show response time and model used for each AI response
                  </p>
                </div>
                <Switch
                  id="response-metrics"
                  checked={showResponseMetrics}
                  onCheckedChange={onShowResponseMetricsChange}
                />
              </div>
            </CardContent>
          </Card>

          {lightningMode && (
            <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
              <div className="flex items-center gap-1 font-medium">
                <Zap className="h-3 w-3" />
                Lightning Mode Active
              </div>
              <div className="mt-1">
                File uploads and session memory are disabled. Basic web search is available for maximum speed.
              </div>
            </div>
          )}

          {/* Session Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Advanced Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            </CardContent>
          </Card>

        </div>
      </DialogContent>
    </Dialog>
  );
};