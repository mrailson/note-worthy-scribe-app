import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  X,
  Plus,
  Download,
  Edit3,
  Image as ImageIcon,
  RectangleVertical,
  RectangleHorizontal,
  Square,
  FileText,
  Share2,
  BookOpen,
  MonitorPlay,
  Layers,
  Building2,
  Check,
} from 'lucide-react';
import { useQuickImageGeneration, LayoutOption, PurposeOption } from '@/hooks/useQuickImageGeneration';
import { CompactMicButton } from '@/components/ai4gp/studio/CompactMicButton';

interface QuickImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenImageStudio?: () => void;
  imageModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
}

const layoutOptions: { value: LayoutOption; label: string; icon: React.ReactNode }[] = [
  { value: 'portrait', label: 'Portrait', icon: <RectangleVertical className="h-4 w-4" /> },
  { value: 'landscape', label: 'Landscape', icon: <RectangleHorizontal className="h-4 w-4" /> },
  { value: 'square', label: 'Square', icon: <Square className="h-4 w-4" /> },
];

const purposeOptions: { value: PurposeOption; label: string; icon: React.ReactNode }[] = [
  { value: 'poster', label: 'Poster', icon: <FileText className="h-4 w-4" /> },
  { value: 'social', label: 'Social', icon: <Share2 className="h-4 w-4" /> },
  { value: 'leaflet', label: 'Leaflet', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'waiting-room', label: 'Display', icon: <MonitorPlay className="h-4 w-4" /> },
  { value: 'general', label: 'General', icon: <Layers className="h-4 w-4" /> },
];

export function QuickImageModal({
  open,
  onOpenChange,
  onOpenImageStudio,
  imageModel = 'google/gemini-2.5-flash-image-preview',
}: QuickImageModalProps) {
  const {
    settings,
    isGenerating,
    generationProgress,
    currentResult,
    practiceContext,
    updateSettings,
    resetSettings,
    generateImage,
    clearResult,
  } = useQuickImageGeneration();

  const [newMessage, setNewMessage] = useState('');

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      resetSettings();
      clearResult();
    }
  }, [open, resetSettings, clearResult]);

  const handleAddMessage = () => {
    if (newMessage.trim()) {
      updateSettings({
        keyMessages: [...settings.keyMessages, newMessage.trim()],
      });
      setNewMessage('');
    }
  };

  const handleRemoveMessage = (index: number) => {
    updateSettings({
      keyMessages: settings.keyMessages.filter((_, i) => i !== index),
    });
  };

  const handleGenerate = async () => {
    await generateImage(imageModel);
  };

  const handleDownload = () => {
    if (currentResult?.url) {
      const link = document.createElement('a');
      link.href = currentResult.url;
      link.download = `quick-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleVoiceResult = (transcript: string) => {
    updateSettings({
      description: transcript,
    });
  };

  const hasLogo = !!practiceContext?.logoUrl;
  const hasPracticeName = !!practiceContext?.practiceName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Image Generator
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Result Display */}
            {currentResult && (
              <Card className="p-4 bg-accent/50 border-accent">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-accent-foreground flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Image Generated!
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      {onOpenImageStudio && (
                        <Button size="sm" variant="outline" onClick={onOpenImageStudio}>
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={currentResult.url}
                      alt="Generated image"
                      className="w-full h-auto max-h-[300px] object-contain"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={clearResult}
                  >
                    Generate Another
                  </Button>
                </div>
              </Card>
            )}

            {/* Generation Progress */}
            {isGenerating && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium">Generating your image...</span>
                  </div>
                  <Progress value={generationProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    This usually takes 10-20 seconds
                  </p>
                </div>
              </Card>
            )}

            {/* Main Input - Description */}
            {!currentResult && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    What do you want to create?
                  </Label>
                  <div className="relative">
                    <Textarea
                      id="description"
                      placeholder="e.g., A flu vaccination reminder poster with autumn colours..."
                      value={settings.description}
                      onChange={(e) => updateSettings({ description: e.target.value })}
                      className="min-h-[100px] pr-12 resize-none"
                      disabled={isGenerating}
                    />
                    <div className="absolute right-2 bottom-2">
                      <CompactMicButton
                        onTranscriptUpdate={handleVoiceResult}
                        currentValue={settings.description}
                        disabled={isGenerating}
                      />
                    </div>
                  </div>
                </div>

                {/* Layout & Purpose Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Layout Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Layout</Label>
                    <div className="flex gap-1">
                      {layoutOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={settings.layout === option.value ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => updateSettings({ layout: option.value })}
                          disabled={isGenerating}
                        >
                          {option.icon}
                          <span className="hidden sm:inline">{option.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Purpose Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Purpose</Label>
                    <div className="flex gap-1 flex-wrap">
                      {purposeOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={settings.purpose === option.value ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 min-w-[60px] gap-1 px-2"
                          onClick={() => updateSettings({ purpose: option.value })}
                          disabled={isGenerating}
                        >
                          {option.icon}
                          <span className="hidden sm:inline text-xs">{option.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Practice Branding */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4" />
                    Practice Branding
                  </div>

                  {hasPracticeName ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="include-name"
                          checked={settings.includePracticeName}
                          onCheckedChange={(checked) =>
                            updateSettings({ includePracticeName: checked })
                          }
                          disabled={isGenerating}
                        />
                        <Label htmlFor="include-name" className="text-sm cursor-pointer">
                          Include practice name
                        </Label>
                      </div>
                      <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {practiceContext?.practiceName}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No practice name configured. Set up your practice details to include branding.
                    </p>
                  )}

                  {hasLogo && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="include-logo"
                          checked={settings.includeLogoSpace}
                          onCheckedChange={(checked) =>
                            updateSettings({ includeLogoSpace: checked })
                          }
                          disabled={isGenerating}
                        />
                        <Label htmlFor="include-logo" className="text-sm cursor-pointer">
                          Reserve space for logo
                        </Label>
                      </div>
                      <div className="h-8 w-8 rounded border bg-muted overflow-hidden">
                        <img
                          src={practiceContext?.logoUrl}
                          alt="Practice logo"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </Card>

                {/* Key Messages */}
                <div className="space-y-2">
                  <Label className="text-sm">Key Messages (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Book now: 0800 123 456"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMessage();
                        }
                      }}
                      disabled={isGenerating}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddMessage}
                      disabled={isGenerating || !newMessage.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {settings.keyMessages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {settings.keyMessages.map((message, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {message}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => handleRemoveMessage(index)}
                            disabled={isGenerating}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        {!currentResult && (
          <div className="flex justify-between items-center pt-4 border-t">
            {onOpenImageStudio && (
              <Button variant="ghost" size="sm" onClick={onOpenImageStudio}>
                <Edit3 className="h-4 w-4 mr-1" />
                Advanced Studio
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !settings.description.trim()}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
