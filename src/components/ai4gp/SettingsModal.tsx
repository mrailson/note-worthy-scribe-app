import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Clock, Save, Loader2, MapPin, Type, Layout, Monitor, Eye, BookOpen, Minimize2, Settings, Volume2, Image } from 'lucide-react';
import { toast } from 'sonner';
import { VoicePreviewDemo } from './VoicePreviewDemo';

export type ImageGenerationModel = 'google/gemini-2.5-flash-image' | 'google/gemini-3-pro-image-preview' | 'openai/gpt-image-1';

export const IMAGE_MODEL_OPTIONS: { value: ImageGenerationModel; label: string; description: string }[] = [
  { 
    value: 'google/gemini-3-pro-image-preview', 
    label: 'Gemini 3 Pro Image (Recommended)', 
    description: 'Next-gen - highest quality, best accuracy' 
  },
  { 
    value: 'google/gemini-2.5-flash-image', 
    label: 'Nano Banana', 
    description: 'Fast with good quality - lighter tasks' 
  },
  { 
    value: 'openai/gpt-image-1', 
    label: 'OpenAI GPT Image', 
    description: 'OpenAI DALL-E successor - excellent detail & control' 
  }
];

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
  chatHistoryRetentionDays: number;
  onChatHistoryRetentionDaysChange: (days: number) => void;
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
  hideGPClinical: boolean;
  onHideGPClinicalChange: (enabled: boolean) => void;
  imageGenerationModel: ImageGenerationModel;
  onImageGenerationModelChange: (model: ImageGenerationModel) => void;
}


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
  chatHistoryRetentionDays,
  onChatHistoryRetentionDaysChange,
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
  hideGPClinical,
  onHideGPClinicalChange,
  imageGenerationModel,
  onImageGenerationModelChange,
}) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-xl border-border/50 shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="px-8 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            AI4GP Settings
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="display" className="flex-1 flex flex-col min-h-0">
          {/* Tab Navigation */}
          <div className="px-8 pt-4 pb-2 bg-muted/30">
            <TabsList className="grid w-full grid-cols-5 h-11 p-1 bg-muted/50 rounded-lg">
              <TabsTrigger 
                value="display" 
                className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Monitor className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Display</span>
              </TabsTrigger>
              <TabsTrigger 
                value="session" 
                className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Brain className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Session</span>
              </TabsTrigger>
              <TabsTrigger 
                value="local" 
                className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <MapPin className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Local</span>
              </TabsTrigger>
              <TabsTrigger 
                value="media" 
                className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Image className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Media</span>
              </TabsTrigger>
              <TabsTrigger 
                value="data" 
                className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Clock className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Data</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0 px-8 py-6">
            {/* Display & Accessibility Tab */}
            <TabsContent value="display" className="mt-0 space-y-8">
              {/* Text & Layout Section */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Text Size */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Type className="h-4 w-4 text-primary" />
                    Text Size
                  </Label>
                  <Select value={textSize} onValueChange={onTextSizeChange}>
                    <SelectTrigger className="h-11 bg-background">
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
                    <Layout className="h-4 w-4 text-primary" />
                    Interface Density
                  </Label>
                  <Select value={interfaceDensity} onValueChange={onInterfaceDensityChange}>
                    <SelectTrigger className="h-11 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-[9999]">
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="spacious">Spacious</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Container Width - Full Width */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  Container Width
                </Label>
                <Select value={containerWidth} onValueChange={onContainerWidthChange}>
                  <SelectTrigger className="h-11 bg-background">
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
                  Adjust spacing and padding for your preferred workflow
                </p>
              </div>

              {/* Accessibility Section */}
              <div className="space-y-5 pt-6 border-t">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Accessibility
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <Label htmlFor="high-contrast" className="text-sm font-medium cursor-pointer">
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

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <Label htmlFor="reading-font" className="text-sm font-medium cursor-pointer">
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

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <Label htmlFor="auto-collapse-prompts" className="text-sm font-medium cursor-pointer">
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
              </div>

              {/* Display Preview */}
              <div className="p-4 bg-muted/40 rounded-xl border border-border/50">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Preview</div>
                <div 
                  className={`text-sm ai4gp-text-scaled ${readingFont ? 'ai4gp-font-applied' : ''} leading-relaxed`}
                  style={{ fontSize: `calc(0.875rem * var(--ai4gp-text-scale))` }}
                >
                  This is how text will appear with your current settings. 
                  The interface will use {interfaceDensity} spacing on a {containerWidth} container.
                  {highContrast && ' High contrast mode is enabled.'} 
                  {readingFont && ' Reading font is active.'}
                </div>
              </div>
            </TabsContent>

            {/* Session & Interface Tab */}
            <TabsContent value="session" className="mt-0 space-y-8">
              {/* Session Settings */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Session Settings
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <Label htmlFor="response-metrics" className="text-sm font-medium cursor-pointer">
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

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <Label htmlFor="ai-service" className="text-sm font-medium cursor-pointer">
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
                </div>
              </div>

              {/* Interface Features */}
              <div className="space-y-5 pt-6 border-t">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Interface Features
                </h3>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <Label htmlFor="hide-gp-clinical" className="text-sm font-medium cursor-pointer">
                      Hide GP/Clinical Features
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Hide the "For GP/Clinical" option and AI4GP service from the interface
                    </p>
                  </div>
                  <Switch
                    id="hide-gp-clinical"
                    checked={hideGPClinical}
                    onCheckedChange={(checked) => {
                      onHideGPClinicalChange(checked);
                      onSaveSettings?.();
                    }}
                  />
                </div>
                
                {hideGPClinical && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="text-sm font-medium text-purple-800 dark:text-purple-300">👁️ GP/Clinical Features Hidden</div>
                    <div className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                      The "For GP/Clinical" option is now hidden from the interface
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Local Policy Tab */}
            <TabsContent value="local" className="mt-0 space-y-8">
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Local Policy Guidance
                </h3>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <Label htmlFor="northamptonshire-icb" className="text-sm font-medium cursor-pointer">
                      Northamptonshire ICB
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable local guidance and traffic-light medicines policy
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      northamptonshireICB 
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
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
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="text-sm font-medium text-green-800 dark:text-green-300">🏥 Northamptonshire ICB Active</div>
                    <div className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Local medicines policies, pathways, and traffic-light guidance enabled
                    </div>
                  </div>
                )}

                <div className="p-5 bg-muted/30 rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground text-center">
                    More local ICB policies coming soon...
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Media Tab (Image & Voice) */}
            <TabsContent value="media" className="mt-0 space-y-8">
              {/* Image Generation */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  Image Generation
                </h3>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">AI Model for Images</Label>
                  <Select 
                    value={imageGenerationModel} 
                    onValueChange={onImageGenerationModelChange}
                  >
                    <SelectTrigger className="h-11 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-[9999]">
                      {IMAGE_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {IMAGE_MODEL_OPTIONS.find(o => o.value === imageGenerationModel)?.description}
                  </p>
                </div>
                
                <div className="p-4 bg-pink-50 dark:bg-pink-950/30 rounded-xl border border-pink-200 dark:border-pink-800">
                  <div className="text-xs font-medium text-pink-700 dark:text-pink-300 uppercase tracking-wide">Currently Using</div>
                  <div className="text-sm font-medium text-pink-800 dark:text-pink-200 mt-1">
                    {IMAGE_MODEL_OPTIONS.find(o => o.value === imageGenerationModel)?.label || 'Nano Banana'}
                  </div>
                </div>
              </div>

              {/* Voice Settings */}
              <div className="space-y-5 pt-6 border-t">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  Voice Settings
                </h3>

                <VoicePreviewDemo 
                  onSelectVoice={(voiceId, voiceName) => {
                    localStorage.setItem('audioVoiceSelection', voiceId);
                    localStorage.setItem('audioVoiceName', voiceName);
                  }}
                />
              </div>
            </TabsContent>

            {/* Data & Privacy Tab */}
            <TabsContent value="data" className="mt-0 space-y-8">
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Chat History Retention
                </h3>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <Label htmlFor="chat-retention" className="text-sm font-medium">
                      Auto-delete chat history after
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Protected searches marked with a star will not be deleted automatically
                    </p>
                  </div>
                  <Select 
                    value={(chatHistoryRetentionDays || 30).toString()} 
                    onValueChange={(value) => onChatHistoryRetentionDaysChange(parseInt(value))}
                  >
                    <SelectTrigger className="w-36 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="365">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
                  <div className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">Automatic Cleanup Active</div>
                  <div className="text-sm text-red-800 dark:text-red-200 mt-1">
                    Chat history older than {(chatHistoryRetentionDays || 30) === 1 ? '1 day' : 
                      (chatHistoryRetentionDays || 30) === 7 ? '7 days' : 
                      (chatHistoryRetentionDays || 30) === 30 ? '30 days' : '12 months'} 
                    {' '}will be automatically deleted daily at 02:00
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-8 py-4 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Settings are auto-saved when changed
            </p>
            <Button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 h-10 px-5"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
