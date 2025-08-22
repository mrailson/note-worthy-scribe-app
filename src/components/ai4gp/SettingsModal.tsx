import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Bot, Clock, Zap } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionMemory: boolean;
  onSessionMemoryChange: (enabled: boolean) => void;
  verificationLevel: string;
  onVerificationLevelChange: (level: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  showResponseMetrics: boolean;
  onShowResponseMetricsChange: (enabled: boolean) => void;
  useOpenAI: boolean;
  onUseOpenAIChange: (enabled: boolean) => void;
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
    id: 'gpt-4-turbo',
    name: 'Recommended',
    provider: 'OpenAI',
    description: 'Fast and reliable for clinical tasks',
    recommended: true
  },
  {
    id: 'grok-beta',
    name: 'Grok',
    provider: 'xAI',
    description: 'Real-time information and conversational AI'
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  sessionMemory,
  onSessionMemoryChange,
  verificationLevel,
  onVerificationLevelChange,
  selectedModel,
  onModelChange,
  showResponseMetrics,
  onShowResponseMetricsChange,
  useOpenAI,
  onUseOpenAIChange
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
          {/* OpenAI Toggle */}
          <Card className="border-primary/20 bg-gradient-to-r from-background to-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Use OpenAI Models
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="use-openai" className="text-sm font-medium">
                    OpenAI Integration
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Switch to OpenAI's powerful models for enhanced performance
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {useOpenAI ? 'OpenAI' : 'Default'}
                  </span>
                  <Switch
                    id="use-openai"
                    checked={useOpenAI}
                    onCheckedChange={onUseOpenAIChange}
                  />
                </div>
              </div>
              
              {useOpenAI && (
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-sm font-medium text-primary">✨ OpenAI Active</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Using advanced OpenAI models for superior AI responses
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" />
                AI Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model-select" className="text-sm font-medium">
                  Select AI Model
                </Label>
                <Select value={selectedModel} onValueChange={onModelChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="font-medium">
                              {model.name} {model.recommended && '⭐'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {model.provider} • {model.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedModelInfo && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium">{selectedModelInfo.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedModelInfo.description}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4" />
                Session Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="session-memory" className="text-sm font-medium">
                    Session Memory
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Remember conversation context across messages
                  </p>
                </div>
                <Switch
                  id="session-memory"
                  checked={sessionMemory}
                  onCheckedChange={onSessionMemoryChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="verification-level" className="text-sm font-medium">
                  Data Verification Level
                </Label>
                <Select value={verificationLevel} onValueChange={onVerificationLevelChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">
                      <div className="space-y-1">
                        <div className="font-medium">Standard</div>
                        <div className="text-xs text-muted-foreground">Cached knowledge + basic search</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="latest">
                      <div className="space-y-1">
                        <div className="font-medium">Latest Updates</div>
                        <div className="text-xs text-muted-foreground">Real-time trusted source fetching</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="maximum">
                      <div className="space-y-1">
                        <div className="font-medium">Maximum Verification</div>
                        <div className="text-xs text-muted-foreground">Cross-reference multiple live sources</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {verificationLevel === 'standard' && 'Fast responses using AI knowledge base with basic web search'}
                  {verificationLevel === 'latest' && 'Live data from NHS, NICE, BNF, MHRA with verification panels'}
                  {verificationLevel === 'maximum' && 'Multiple source cross-referencing with confidence scoring'}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="response-metrics" className="text-sm font-medium">
                    Show Response Metrics
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display response time and token usage
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