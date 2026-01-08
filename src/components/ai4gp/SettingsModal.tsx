import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Clock, Save, Loader2, MapPin, Type, Layout, Monitor, Eye, BookOpen, Minimize2, Settings, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { VoicePreviewDemo } from './VoicePreviewDemo';

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
        className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        }}
      >
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Settings className="h-4 h-4 sm:h-5 sm:w-5 text-primary" />
            AI4GP Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">

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


          {/* Interface Features */}
          <Card className="border-purple-200 bg-gradient-to-r from-background to-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4 text-purple-600" />
                Interface Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="hide-gp-clinical" className="text-sm font-medium">
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
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm font-medium text-purple-800">👁️ GP/Clinical Features Hidden</div>
                  <div className="text-xs text-purple-700 mt-1">
                    The "For GP/Clinical" option is now hidden from the interface
                  </div>
                </div>
              )}
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

          {/* Chat History Retention */}
          <Card className="border-red-200 bg-gradient-to-r from-background to-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-red-600" />
                Chat History Retention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
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
                  <SelectTrigger className="w-40">
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
              
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm font-medium text-red-800">🗑️ Automatic Cleanup Active</div>
                <div className="text-xs text-red-700 mt-1">
                  Chat history older than {(chatHistoryRetentionDays || 30) === 1 ? '1 day' : 
                    (chatHistoryRetentionDays || 30) === 7 ? '7 days' : 
                    (chatHistoryRetentionDays || 30) === 30 ? '30 days' : '12 months'} 
                  will be automatically deleted daily at 02:00
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voice Settings */}
          <Card className="border-orange-200 bg-gradient-to-r from-background to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Volume2 className="h-4 w-4 text-orange-600" />
                Voice Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VoicePreviewDemo 
                onSelectVoice={(voiceId, voiceName) => {
                  // Store the selected voice
                  localStorage.setItem('audioVoiceSelection', voiceId);
                  localStorage.setItem('audioVoiceName', voiceName);
                }}
              />
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