import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  X,
  Pause,
  Play,
  Volume2,
  VolumeX,
  AArrowUp,
  AArrowDown,
  RotateCcw,
} from 'lucide-react';
import { TextSize } from './TeleprompterDisplay';

interface PatientQuickSettingsProps {
  isPaused: boolean;
  onPauseToggle: () => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
  onReplayLast: () => void;
  onClose: () => void;
  canReplay: boolean;
  className?: string;
}

const TEXT_SIZE_ORDER: TextSize[] = ['normal', 'large', 'xlarge'];

export const PatientQuickSettings: React.FC<PatientQuickSettingsProps> = ({
  isPaused,
  onPauseToggle,
  isMuted,
  onMuteToggle,
  volume,
  onVolumeChange,
  textSize,
  onTextSizeChange,
  onReplayLast,
  onClose,
  canReplay,
  className,
}) => {
  const currentSizeIndex = TEXT_SIZE_ORDER.indexOf(textSize);

  const handleTextSizeUp = () => {
    if (currentSizeIndex < TEXT_SIZE_ORDER.length - 1) {
      onTextSizeChange(TEXT_SIZE_ORDER[currentSizeIndex + 1]);
    }
  };

  const handleTextSizeDown = () => {
    if (currentSizeIndex > 0) {
      onTextSizeChange(TEXT_SIZE_ORDER[currentSizeIndex - 1]);
    }
  };

  return (
    <div
      className={cn(
        'absolute top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-6 py-4 bg-background/80 backdrop-blur-sm border-b',
        className
      )}
    >
      {/* Left: Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-12 w-12"
        aria-label="Close patient view"
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Centre: Main controls */}
      <div className="flex items-center gap-2">
        {/* Pause/Resume - prominent */}
        <Button
          variant={isPaused ? 'default' : 'outline'}
          size="lg"
          onClick={onPauseToggle}
          className={cn(
            'gap-2 min-w-[120px]',
            isPaused && 'bg-amber-500 hover:bg-amber-600 text-white'
          )}
        >
          {isPaused ? (
            <>
              <Play className="h-5 w-5" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-5 w-5" />
              Pause
            </>
          )}
        </Button>
      </div>

      {/* Right: Audio and text controls */}
      <div className="flex items-center gap-3">
        {/* Audio mute */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMuteToggle}
          className="h-12 w-12"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Volume2 className="h-6 w-6" />
          )}
        </Button>

        {/* Volume slider */}
        <div className="w-24 hidden sm:block">
          <Slider
            value={[volume * 100]}
            onValueChange={(value) => onVolumeChange(value[0] / 100)}
            max={100}
            step={5}
            disabled={isMuted}
            className="cursor-pointer"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border mx-2" />

        {/* Text size controls */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleTextSizeDown}
          disabled={currentSizeIndex === 0}
          className="h-12 w-12"
          aria-label="Decrease text size"
        >
          <AArrowDown className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleTextSizeUp}
          disabled={currentSizeIndex === TEXT_SIZE_ORDER.length - 1}
          className="h-12 w-12"
          aria-label="Increase text size"
        >
          <AArrowUp className="h-6 w-6" />
        </Button>

        {/* Divider */}
        <div className="w-px h-8 bg-border mx-2" />

        {/* Replay last */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onReplayLast}
          disabled={!canReplay}
          className="h-12 w-12"
          aria-label="Replay last audio"
        >
          <RotateCcw className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};
