import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Search, Bot, Clock } from 'lucide-react';

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
}

const AI_MODELS = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    description: 'Most advanced reasoning and analysis'
  },
  {
    id: 'claude-4-opus',
    name: 'Claude 4 Opus',
    provider: 'Anthropic',
    description: 'Superior reasoning and medical knowledge'
  },
  {
    id: 'claude-4-sonnet',
    name: 'Claude 4 Sonnet',
    provider: 'Anthropic',
    description: 'High performance with excellent efficiency'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Advanced multimodal reasoning capabilities'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    description: 'Fast and efficient for quick responses'
  },
  {
    id: 'grok-beta',
    name: 'Grok',
    provider: 'xAI',
    description: 'Real-time information and conversational AI'
  },
  {
    id: 'gpt-4-turbo',
    name: 'Recommended',
    provider: 'OpenAI',
    description: 'Fast and reliable for clinical tasks',
    recommended: true
  },
  {
    id: 'gemini-ultra',
    name: 'Gemini Ultra',
    provider: 'Google',
    description: 'Advanced multimodal capabilities'
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
  onShowResponseMetricsChange
}) => {
  const selectedModelInfo = AI_MODELS.find(model => model.id === selectedModel) || AI_MODELS.find(model => model.recommended) || AI_MODELS[0];

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

          {/* Session Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Session Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    Web Search
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include latest medical guidelines and updates
                  </p>
                </div>
                <Switch
                  id="web-search"
                  checked={includeLatestUpdates}
                  onCheckedChange={onIncludeLatestUpdatesChange}
                />
              </div>
              
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

        </div>
      </DialogContent>
    </Dialog>
  );
};