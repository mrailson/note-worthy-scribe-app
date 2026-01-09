import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX, Square, Send, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AudioControlsProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  isSpeaking: boolean;
  onStopAudio: () => void;
  silenceThreshold: number;
  onSilenceThresholdChange: (threshold: number) => void;
  onManualSend: () => void;
  isListening: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  isSpeaking,
  onStopAudio,
  silenceThreshold,
  onSilenceThresholdChange,
  onManualSend,
  isListening
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Volume</Label>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onMuteToggle}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="flex items-center gap-3">
        <VolumeX className="h-4 w-4 text-muted-foreground" />
        <Slider
          value={[isMuted ? 0 : volume * 100]}
          onValueChange={([val]) => onVolumeChange(val / 100)}
          max={100}
          step={1}
          className="flex-1"
          disabled={isMuted}
        />
        <Volume2 className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="text-xs text-center text-muted-foreground">
        {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
      </div>

      {/* Silence threshold slider */}
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Wait Time
          </Label>
          <span className="text-xs text-muted-foreground">
            {(silenceThreshold / 1000).toFixed(1)}s
          </span>
        </div>
        <Slider
          value={[silenceThreshold]}
          onValueChange={([val]) => onSilenceThresholdChange(val)}
          min={1000}
          max={5000}
          step={500}
          className="flex-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Time to wait after speech before processing
        </p>
      </div>

      {/* Manual send button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onManualSend}
            disabled={!isListening}
          >
            <Send className="h-4 w-4" />
            Send Now
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Immediately process current speech without waiting</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
