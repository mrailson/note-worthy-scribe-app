import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Bot, Clock, Zap, Save, TestTube, CheckCircle, XCircle, Loader2, Shield, MapPin, Type, Layout, Monitor, Eye, BookOpen, Minimize2, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  showRenderTimes: boolean;
  onShowRenderTimesChange: (enabled: boolean) => void;
  showAIService: boolean;
  onShowAIServiceChange: (enabled: boolean) => void;
  useOpenAI: boolean;
  onUseOpenAIChange: (enabled: boolean) => void;
  northamptonshireICB: boolean;
  onNorthamptonshireICBChange: (enabled: boolean) => void;
  onSaveSettings?: () => void;
  // Display Settings
  textSize: 'smallest' | 'smaller' | 'small' | 'default' | 'medium' | 'large' | 'larger' | 'largest';
  onTextSizeChange: (size: 'smallest' | 'smaller' | 'small' | 'default' | 'medium' | 'large' | 'larger' | 'largest') => void;
  interfaceDensity: 'compact' | 'comfortable' | 'spacious';
  onInterfaceDensityChange: (density: 'compact' | 'comfortable' | 'spacious') => void;
  containerWidth: 'narrow' | 'standard' | 'wide' | 'full';
  onContainerWidthChange: (width: 'narrow' | 'standard' | 'wide' | 'full') => void;
  highContrast: boolean;
  onHighContrastChange: (enabled: boolean) => void;
  readingFont: boolean;
  onReadingFontChange: (enabled: boolean) => void;
  autoCollapseUserPrompts: boolean;
  onAutoCollapseUserPromptsChange: (enabled: boolean) => void;
}

interface ApiTestResult {
  model: string;
  status: 'pending' | 'success' | 'error';
  responseTime?: number;
  response?: string;
  error?: string;
}

const AI_MODELS = [
  {
    id: 'gpt-5-2025-08-07',
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
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'OpenAI',
    description: 'Advanced multimodal AI with vision capabilities'
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Fast and reliable for clinical tasks',
    recommended: true
  },
  {
    id: 'deepseek-chat',
    name: 'Deepseek V3',
    provider: 'Deepseek',
    description: 'High-performance reasoning and code understanding'
  },
  {
    id: 'grok-beta',
    name: 'Grok',
    provider: 'xAI',
    description: 'Real-time information and conversational AI'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    description: 'Advanced language understanding'
  },
  {
    id: 'z-ai-model',
    name: 'Z AI',
    provider: 'Z AI',
    description: 'Advanced AI with specialized capabilities'
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
  showRenderTimes,
  onShowRenderTimesChange,
  showAIService,
  onShowAIServiceChange,
  useOpenAI,
  onUseOpenAIChange,
  northamptonshireICB,
  onNorthamptonshireICBChange,
  onSaveSettings,
  textSize,
  onTextSizeChange,
  interfaceDensity,
  onInterfaceDensityChange,
  containerWidth,
  onContainerWidthChange,
  highContrast,
  onHighContrastChange,
  readingFont,
  onReadingFontChange,
  autoCollapseUserPrompts,
  onAutoCollapseUserPromptsChange,
}) => {
  const selectedModelInfo = AI_MODELS.find(model => model.id === selectedModel) || AI_MODELS.find(model => model.recommended) || AI_MODELS[0];
  const [testResults, setTestResults] = useState<ApiTestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      if (onSaveSettings) {
        await onSaveSettings();
      }
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const testApiServices = async () => {
    setIsTesting(true);
    const testPrompt = "what is Metformin";
    const modelsToTest = ['gpt-5-2025-08-07', 'claude-4-opus', 'gpt-4o', 'gpt-4-turbo', 'deepseek-chat', 'grok-beta', 'gemini-1.5-pro', 'z-ai-model'];
    
    // Initialize test results
    const initialResults: ApiTestResult[] = modelsToTest.map(model => ({
      model,
      status: 'pending'
    }));
    setTestResults(initialResults);

    // Test each model
    for (let i = 0; i < modelsToTest.length; i++) {
      const model = modelsToTest[i];
      const startTime = Date.now();
      
      try {
        console.log(`Testing ${model}...`);
        
        const { data, error } = await supabase.functions.invoke('ai-api-test', {
          body: {
            model: model,
            prompt: testPrompt
          }
        });

        const responseTime = Date.now() - startTime;
        
        if (error) {
          console.error(`Error testing ${model}:`, error);
          throw error;
        }

        if (!data.success) {
          throw new Error(data.error || 'API test failed');
        }

        console.log(`${model} test successful:`, data);

        setTestResults(prev => prev.map(result => 
          result.model === model 
            ? { 
                ...result, 
                status: 'success', 
                responseTime: data.responseTime || responseTime, 
                response: data.response || 'Test successful'
              }
            : result
        ));
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        console.error(`${model} test failed:`, error);
        
        setTestResults(prev => prev.map(result => 
          result.model === model 
            ? { 
                ...result, 
                status: 'error', 
                responseTime, 
                error: error.message || 'Unknown error'
              }
            : result
        ));
      }
    }
    
    setIsTesting(false);
  };

  const getStatusIcon = (status: ApiTestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI4GP Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
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
                  <SelectContent className="bg-popover border border-border z-[9999]">
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
                  <Label htmlFor="response-metrics" className="text-sm font-medium">
                    Show Performance Metrics
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display response time, token usage, and performance metrics
                  </p>
                </div>
                <Switch
                  id="response-metrics"
                  checked={showResponseMetrics}
                  onCheckedChange={(checked) => {
                    onShowResponseMetricsChange(checked);
                    onShowRenderTimesChange(checked);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="ai-service" className="text-sm font-medium">
                    Show AI Service
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display which AI model was used
                  </p>
                </div>
                <Switch
                  id="ai-service"
                  checked={showAIService}
                  onCheckedChange={onShowAIServiceChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Display & Accessibility Settings */}
          <Card className="border-blue-200 bg-gradient-to-r from-background to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-4 w-4 text-blue-600" />
                Display & Accessibility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Text Size */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Type className="h-3 w-3" />
                  Text Size
                </Label>
                <Select value={textSize} onValueChange={onTextSizeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border z-[9999]">
                    <SelectItem value="smallest">Smallest (0.75x)</SelectItem>
                    <SelectItem value="smaller">Smaller (0.875x)</SelectItem>
                    <SelectItem value="small">Small (1.0x)</SelectItem>
                    <SelectItem value="default">Default (1.125x)</SelectItem>
                    <SelectItem value="medium">Medium (1.25x)</SelectItem>
                    <SelectItem value="large">Large (1.375x)</SelectItem>
                    <SelectItem value="larger">Larger (1.5x)</SelectItem>
                    <SelectItem value="largest">Largest (1.625x)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Interface Density */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Layout className="h-3 w-3" />
                  Interface Density
                </Label>
                <Select value={interfaceDensity} onValueChange={onInterfaceDensityChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border z-[9999]">
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="spacious">Spacious</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Adjust spacing and padding for your preferred workflow
                </p>
              </div>

              {/* Container Width */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Monitor className="h-3 w-3" />
                  Container Width
                </Label>
                <Select value={containerWidth} onValueChange={onContainerWidthChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border z-[9999]">
                    <SelectItem value="narrow">Narrow</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="wide">Wide</SelectItem>
                    <SelectItem value="full">Full Width</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optimize content width for your screen and preferences
                </p>
              </div>

              {/* Accessibility Options */}
              <div className="space-y-4 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="high-contrast" className="text-sm font-medium flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      High Contrast Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enhanced contrast for better visibility
                    </p>
                  </div>
                  <Switch
                    id="high-contrast"
                    checked={highContrast}
                    onCheckedChange={onHighContrastChange}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="reading-font" className="text-sm font-medium flex items-center gap-2">
                      <BookOpen className="h-3 w-3" />
                      Reading Font
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Dyslexia-friendly font for better readability
                    </p>
                  </div>
                  <Switch
                    id="reading-font"
                    checked={readingFont}
                    onCheckedChange={onReadingFontChange}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-collapse-prompts" className="text-sm font-medium flex items-center gap-2">
                      <Minimize2 className="h-3 w-3" />
                      Auto-collapse User Prompts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically collapse your messages to keep interface clean
                    </p>
                  </div>
                  <Switch
                    id="auto-collapse-prompts"
                    checked={autoCollapseUserPrompts}
                    onCheckedChange={onAutoCollapseUserPromptsChange}
                  />
                </div>
              </div>

              {/* Display Preview */}
              <div className="p-3 bg-muted rounded-lg border">
                <div className="text-sm font-medium mb-2">Preview</div>
                <div 
                  className={`text-xs ai4gp-text-scaled ${readingFont ? 'ai4gp-font-applied' : ''}`}
                  style={{ fontSize: `calc(0.75rem * var(--ai4gp-text-scale))` }}
                >
                  This is how text will appear with your current settings. 
                  The interface will use {interfaceDensity} spacing on a {containerWidth} container.
                  {highContrast && ' High contrast mode is enabled.'} 
                  {readingFont && ' Reading font is active.'}
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Local Policy Settings */}
          <Card className="border-green-200 bg-gradient-to-r from-background to-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-green-600" />
                Local Policy Guidance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="northamptonshire-icb" className="text-sm font-medium">
                    Northamptonshire ICB
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable Northamptonshire Integrated Care Board local guidance and traffic-light medicines policy
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {northamptonshireICB ? 'Active' : 'Disabled'}
                  </span>
                  <Switch
                    id="northamptonshire-icb"
                    checked={northamptonshireICB}
                    onCheckedChange={onNorthamptonshireICBChange}
                  />
                </div>
              </div>
              
              {northamptonshireICB && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm font-medium text-green-800">🏥 Northamptonshire ICB Active</div>
                  <div className="text-xs text-green-700 mt-1">
                    Local medicines policies, pathways, and traffic-light guidance enabled
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Testing Section - Moved to bottom */}
          <Card className="border-amber-200 bg-gradient-to-r from-background to-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TestTube className="h-4 w-4 text-amber-600" />
                API Services Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Test All API Services
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Verify all AI services are working with the prompt "what is Metformin"
                  </p>
                </div>
                <Button 
                  onClick={testApiServices}
                  disabled={isTesting}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  {isTesting ? 'Testing...' : 'Test APIs'}
                </Button>
              </div>
              
              {testResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Test Results:</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {testResults.map((result) => (
                      <div key={result.model} className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {getStatusIcon(result.status)}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm">
                              {AI_MODELS.find(m => m.id === result.model)?.name || result.model}
                            </div>
                            {result.responseTime && (
                              <div className="text-xs text-muted-foreground">
                                {result.responseTime}ms
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground max-w-xs">
                          {result.status === 'success' && result.response && (
                            <div className="text-green-600 truncate">
                              {result.response.substring(0, 50)}...
                            </div>
                          )}
                          {result.status === 'error' && result.error && (
                            <div className="text-destructive">
                              {result.error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              Settings are auto-saved when changed
            </div>
            <Button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};