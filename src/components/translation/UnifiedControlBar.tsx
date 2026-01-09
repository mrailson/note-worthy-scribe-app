import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Pause, 
  Play, 
  Volume2, 
  VolumeX, 
  Clock, 
  Send, 
  RotateCcw,
  FileText,
  Square,
  Minus,
  Plus
} from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { TextSize } from './TeleprompterDisplay';

interface UnifiedControlBarProps {
  // Language & Speaker
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  speakerMode: 'gp' | 'patient';
  onSpeakerModeChange: (mode: 'gp' | 'patient') => void;
  
  // Pause/Resume
  isPaused: boolean;
  onPauseToggle: () => void;
  
  // Silence threshold
  silenceThreshold: number;
  onSilenceThresholdChange: (value: number) => void;
  
  // Manual send
  onManualSend: () => void;
  isListening: boolean;
  
  // Volume
  isMuted: boolean;
  onMuteToggle: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  
  // Text size
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
  
  // Replay
  onReplayLast: () => void;
  
  // English text display
  latestEnglishText: string;
  
  // Session actions
  onExport: () => void;
  onEndSession: () => void;
}

export const UnifiedControlBar: React.FC<UnifiedControlBarProps> = ({
  selectedLanguage,
  onLanguageChange,
  speakerMode,
  onSpeakerModeChange,
  isPaused,
  onPauseToggle,
  silenceThreshold,
  onSilenceThresholdChange,
  onManualSend,
  isListening,
  isMuted,
  onMuteToggle,
  volume,
  onVolumeChange,
  textSize,
  onTextSizeChange,
  onReplayLast,
  latestEnglishText,
  onExport,
  onEndSession,
}) => {
  const textSizes: TextSize[] = ['normal', 'large', 'xlarge'];
  const currentSizeIndex = textSizes.indexOf(textSize);
  
  const handleTextSizeDown = () => {
    if (currentSizeIndex > 0) {
      onTextSizeChange(textSizes[currentSizeIndex - 1]);
    }
  };
  
  const handleTextSizeUp = () => {
    if (currentSizeIndex < textSizes.length - 1) {
      onTextSizeChange(textSizes[currentSizeIndex + 1]);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50">
      {/* Row 1: Primary Controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border/50">
        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <LanguageSelector
            value={selectedLanguage}
            onChange={onLanguageChange}
            disabled={false}
          />
        </div>

        {/* Speaker Mode Toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={speakerMode === 'gp' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeakerModeChange('gp')}
            className="h-8 px-3 text-xs font-medium"
          >
            <span className="hidden sm:inline mr-1">🩺</span> GP
          </Button>
          <Button
            variant={speakerMode === 'patient' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeakerModeChange('patient')}
            className="h-8 px-3 text-xs font-medium"
          >
            <span className="hidden sm:inline mr-1">👤</span> Patient
          </Button>
        </div>

        {/* Pause/Resume */}
        <Button
          variant={isPaused ? 'default' : 'outline'}
          size="sm"
          onClick={onPauseToggle}
          className="h-8 px-3"
        >
          {isPaused ? (
            <>
              <Play className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Resume</span>
            </>
          ) : (
            <>
              <Pause className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Pause</span>
            </>
          )}
        </Button>

        {/* Silence Threshold */}
        <div className="hidden md:flex items-center gap-2 min-w-[140px]">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[silenceThreshold]}
            onValueChange={(value) => onSilenceThresholdChange(value[0])}
            min={0.5}
            max={5}
            step={0.5}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground w-8">{silenceThreshold}s</span>
        </div>

        {/* Manual Send */}
        <Button
          variant="outline"
          size="sm"
          onClick={onManualSend}
          disabled={!isListening}
          className="h-8 px-2"
          title="Send audio now"
        >
          <Send className="h-4 w-4" />
        </Button>

        {/* Volume Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMuteToggle}
            className="h-8 w-8 p-0"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <div className="hidden sm:block w-16">
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={(value) => onVolumeChange(value[0])}
              min={0}
              max={100}
              step={5}
              disabled={isMuted}
            />
          </div>
        </div>

        {/* Text Size Controls */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTextSizeDown}
            disabled={currentSizeIndex === 0}
            className="h-8 w-8 p-0"
            title="Decrease text size"
          >
            <span className="text-sm font-medium">A</span>
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTextSizeUp}
            disabled={currentSizeIndex === textSizes.length - 1}
            className="h-8 w-8 p-0"
            title="Increase text size"
          >
            <span className="text-sm font-medium">A</span>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Replay Last */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onReplayLast}
          className="h-8 w-8 p-0"
          title="Replay last audio"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 2: English Text & Session Actions */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* English Text Display */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">🇬🇧</span>
          <p className="text-sm text-muted-foreground truncate">
            {latestEnglishText || 'Waiting for conversation...'}
          </p>
        </div>

        {/* Session Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-8"
          >
            <FileText className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Report</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onEndSession}
            className="h-8"
          >
            <Square className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">End Session</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
