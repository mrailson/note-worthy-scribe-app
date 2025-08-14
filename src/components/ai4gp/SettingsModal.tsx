import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Search, Bot, Maximize2 } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionMemory: boolean;
  onSessionMemoryChange: (enabled: boolean) => void;
  includeLatestUpdates: boolean;
  onIncludeLatestUpdatesChange: (enabled: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  cardSize: string;
  onCardSizeChange: (size: string) => void;
  cardHeight: number;
  onCardHeightChange: (height: number) => void;
}

const AI_MODELS = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    description: 'Most advanced reasoning and analysis',
    recommended: true
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
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Fast and reliable for clinical tasks'
  },
  {
    id: 'gemini-ultra',
    name: 'Gemini Ultra',
    provider: 'Google',
    description: 'Advanced multimodal capabilities'
  }
];

const CARD_SIZES = [
  { id: 'xs', name: 'Extra Small', description: 'Compact messages for quick scanning' },
  { id: 'sm', name: 'Small', description: 'Condensed layout for more content per screen' },
  { id: 'md', name: 'Medium', description: 'Balanced size for comfortable reading' },
  { id: 'default', name: 'Default', description: 'Standard size with optimal readability' },
  { id: 'lg', name: 'Large', description: 'Enhanced visibility for detailed content' },
  { id: 'xl', name: 'Extra Large', description: 'Maximum readability for complex responses' },
  { id: 'full', name: 'Full Width', description: 'Complete screen utilization' }
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
  cardSize,
  onCardSizeChange,
  cardHeight,
  onCardHeightChange
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
            </CardContent>
          </Card>

          {/* Message Card Size */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                Message Card Size
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={cardSize} onValueChange={onCardSizeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select card size" />
                </SelectTrigger>
                <SelectContent>
                  {CARD_SIZES.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{size.name}</span>
                        {size.id === 'default' && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <div className="font-medium">{CARD_SIZES.find(s => s.id === cardSize)?.name || 'Default'}</div>
                <div className="mt-1">{CARD_SIZES.find(s => s.id === cardSize)?.description || 'Standard size with optimal readability'}</div>
              </div>
              
              {/* Card Height Slider */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Card Height</Label>
                <div className="px-2">
                  <Slider
                    value={[cardHeight]}
                    onValueChange={(value) => onCardHeightChange(value[0])}
                    max={800}
                    min={200}
                    step={50}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Compact ({cardHeight}px)</span>
                  <span>Spacious</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adjust message card height to reduce white space and keep input boxes visible
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};