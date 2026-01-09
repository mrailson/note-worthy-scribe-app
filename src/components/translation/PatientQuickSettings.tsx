import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  Pause,
  Play,
  Volume2,
  VolumeX,
  AArrowUp,
  AArrowDown,
  RotateCcw,
  User,
  Users,
} from 'lucide-react';
import { TextSize } from './TeleprompterDisplay';
import { getSortedLanguages } from '@/constants/elevenLabsLanguages';

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
  speakerMode: 'gp' | 'patient';
  onSpeakerModeChange: (mode: 'gp' | 'patient') => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
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
  speakerMode,
  onSpeakerModeChange,
  selectedLanguage,
  onLanguageChange,
  className,
}) => {
  const currentSizeIndex = TEXT_SIZE_ORDER.indexOf(textSize);
  const languages = getSortedLanguages().filter(l => l.code !== 'en');

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
      {/* Left: Close button and language selector */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-12 w-12"
          aria-label="Close patient view"
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Language selector */}
        <Select value={selectedLanguage} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-[180px] h-10">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Centre: Pause and Speaker mode controls */}
      <div className="flex items-center gap-3">
        {/* Speaker mode toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/50">
          <Button
            variant={speakerMode === 'gp' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeakerModeChange('gp')}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            GP
          </Button>
          <Button
            variant={speakerMode === 'patient' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeakerModeChange('patient')}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Patient
          </Button>
        </div>

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
