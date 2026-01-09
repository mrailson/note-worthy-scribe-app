import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX, Square } from 'lucide-react';

interface AudioControlsProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  isSpeaking: boolean;
  onStopAudio: () => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  isSpeaking,
  onStopAudio
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
    </div>
  );
};
