import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Bot, Clock, Zap, Save, TestTube, CheckCircle, XCircle, Loader2, Shield, MapPin } from 'lucide-react';
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
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Fast and reliable for clinical tasks',
    recommended: true
  },
  {
    id: 'deepseek-v3',
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
  onSaveSettings
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
    const testPrompt = "What day is it today?";
    const modelsToTest = ['gpt-5-2025-08-07', 'claude-4-opus', 'gpt-4-turbo', 'deepseek-v3', 'grok-beta', 'gemini-1.5-pro'];
    
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
          {/* API Testing Section */}
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
                    Verify all AI services are working with the prompt "What day is it today?"
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

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="render-times" className="text-sm font-medium">
                    Show Render Times
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display response timing metrics
                  </p>
                </div>
                <Switch
                  id="render-times"
                  checked={showRenderTimes}
                  onCheckedChange={onShowRenderTimesChange}
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