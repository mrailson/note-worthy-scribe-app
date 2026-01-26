import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Settings, Monitor, Check, Volume2, FileStack } from 'lucide-react';

type SystemAudioService = 'whisper' | 'assemblyai';

interface TranslationSettingsModalProps {
  systemAudioService: SystemAudioService;
  onServiceChange: (service: SystemAudioService) => void;
  isCapturingSystemAudio: boolean;
  onToggleSystemAudio: () => void;
  autoPlayAudio: boolean;
  onAutoPlayChange: (enabled: boolean) => void;
  showDocumentTranslate: boolean;
  onShowDocumentTranslateChange: (enabled: boolean) => void;
}

export const TranslationSettingsModal: React.FC<TranslationSettingsModalProps> = ({
  systemAudioService,
  onServiceChange,
  isCapturingSystemAudio,
  onToggleSystemAudio,
  autoPlayAudio,
  onAutoPlayChange,
  showDocumentTranslate,
  onShowDocumentTranslateChange,
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          title="Translation Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Translation Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Document Translate Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <FileStack className={`h-5 w-5 ${showDocumentTranslate ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <Label className="text-base font-medium">Document Translate</Label>
                <p className="text-sm text-muted-foreground">
                  Show the Document Translate mode option
                </p>
              </div>
            </div>
            <Switch
              checked={showDocumentTranslate}
              onCheckedChange={onShowDocumentTranslateChange}
            />
          </div>

          {/* Auto-Play Audio Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <Volume2 className={`h-5 w-5 ${autoPlayAudio ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <Label className="text-base font-medium">Auto-Play Audio</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically play translated audio after sending
                </p>
              </div>
            </div>
            <Switch
              checked={autoPlayAudio}
              onCheckedChange={onAutoPlayChange}
            />
          </div>

          {/* System Audio Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <Monitor className={`h-5 w-5 ${isCapturingSystemAudio ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <div>
                <Label className="text-base font-medium">System Audio</Label>
                <p className="text-sm text-muted-foreground">
                  Capture audio from videos or browser tabs
                </p>
              </div>
            </div>
            <Switch
              checked={isCapturingSystemAudio}
              onCheckedChange={onToggleSystemAudio}
              className="data-[state=checked]:bg-amber-600"
            />
          </div>

          {/* System Audio Transcription Service */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium">Transcription Service</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose the transcription service for system audio.
            </p>
            
            <RadioGroup
              value={systemAudioService}
              onValueChange={(value) => onServiceChange(value as SystemAudioService)}
              disabled={isCapturingSystemAudio}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="whisper" id="whisper" />
                <Label htmlFor="whisper" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Whisper (Batch)</p>
                      <p className="text-sm text-muted-foreground">
                        Processes audio in 10-second chunks. Higher accuracy.
                      </p>
                    </div>
                    {systemAudioService === 'whisper' && (
                      <Badge variant="default" className="ml-2">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="assemblyai" id="assemblyai" />
                <Label htmlFor="assemblyai" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">AssemblyAI (Real-time)</p>
                      <p className="text-sm text-muted-foreground">
                        Streams transcription in real-time. Lower latency.
                      </p>
                    </div>
                    {systemAudioService === 'assemblyai' && (
                      <Badge variant="default" className="ml-2">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {isCapturingSystemAudio && (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Monitor className="h-4 w-4 animate-pulse" />
                Stop system audio capture to change service.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
