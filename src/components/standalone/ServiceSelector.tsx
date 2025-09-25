import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Mic, Zap, Sparkles } from 'lucide-react';

interface ServiceSelectorProps {
  currentService: 'whisper' | 'deepgram';
  onServiceChange: () => void;
  cleaningEnabled: boolean;
  onCleaningToggle: () => void;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  currentService,
  onServiceChange,
  cleaningEnabled,
  onCleaningToggle
}) => {
  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Service Selection */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Transcription:</Label>
        <Button
          onClick={onServiceChange}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          {currentService === 'whisper' ? (
            <>
              <Mic className="h-4 w-4" />
              Whisper
              <Badge variant="default" className="ml-1">Primary</Badge>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Deepgram
              <Badge variant="secondary" className="ml-1">Real-time</Badge>
            </>
          )}
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* NHS Cleaning Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <Label htmlFor="nhs-cleaning" className="text-sm font-medium">
            NHS Auto-Clean
          </Label>
        </div>
        <Switch
          id="nhs-cleaning"
          checked={cleaningEnabled}
          onCheckedChange={onCleaningToggle}
        />
        <Badge variant={cleaningEnabled ? "default" : "secondary"}>
          {cleaningEnabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>
    </div>
  );
};