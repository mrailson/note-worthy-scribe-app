import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
  Plus,
  Stethoscope,
  MessageCircle
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
  
  // Voice activity
  isVoiceActive: boolean;
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
  latestSpeaker: 'gp' | 'patient' | null;
  
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
  isVoiceActive,
  isMuted,
  onMuteToggle,
  volume,
  onVolumeChange,
  textSize,
  onTextSizeChange,
  onReplayLast,
  latestEnglishText,
  latestSpeaker,
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

        {/* Speaker Mode Toggle with Waveform */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          <Button
            variant={speakerMode === 'gp' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeakerModeChange('gp')}
            className="h-8 px-3 text-xs font-medium relative overflow-hidden"
          >
            <span className="hidden sm:inline mr-1">🩺</span> GP
            {speakerMode === 'gp' && isListening && (
              <span className="ml-1.5 flex items-center gap-0.5">
                {isVoiceActive ? (
                  // Active waveform animation
                  <>
                    <span className="w-0.5 h-3 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.3s' }} />
                    <span className="w-0.5 h-4 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.2s', animationDelay: '0.1s' }} />
                    <span className="w-0.5 h-2 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.4s', animationDelay: '0.05s' }} />
                    <span className="w-0.5 h-3.5 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.25s', animationDelay: '0.15s' }} />
                  </>
                ) : (
                  // Idle listening indicator (small static bars)
                  <>
                    <span className="w-0.5 h-1.5 bg-primary-foreground/50 rounded-full" />
                    <span className="w-0.5 h-1.5 bg-primary-foreground/50 rounded-full" />
                    <span className="w-0.5 h-1.5 bg-primary-foreground/50 rounded-full" />
                  </>
                )}
              </span>
            )}
          </Button>
          <Button
            variant={speakerMode === 'patient' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeakerModeChange('patient')}
            className="h-8 px-3 text-xs font-medium relative overflow-hidden"
          >
            <span className="hidden sm:inline mr-1">👤</span> Patient
            {speakerMode === 'patient' && isListening && (
              <span className="ml-1.5 flex items-center gap-0.5">
                {isVoiceActive ? (
                  // Active waveform animation
                  <>
                    <span className="w-0.5 h-3 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.3s' }} />
                    <span className="w-0.5 h-4 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.2s', animationDelay: '0.1s' }} />
                    <span className="w-0.5 h-2 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.4s', animationDelay: '0.05s' }} />
                    <span className="w-0.5 h-3.5 bg-primary-foreground rounded-full animate-pulse" style={{ animationDuration: '0.25s', animationDelay: '0.15s' }} />
                  </>
                ) : (
                  // Idle listening indicator
                  <>
                    <span className="w-0.5 h-1.5 bg-primary-foreground/50 rounded-full" />
                    <span className="w-0.5 h-1.5 bg-primary-foreground/50 rounded-full" />
                    <span className="w-0.5 h-1.5 bg-primary-foreground/50 rounded-full" />
                  </>
                )}
              </span>
            )}
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

        {/* Silence Threshold Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" title="Adjust wait time">
              <Clock className="h-4 w-4" />
              <span className="text-xs text-muted-foreground">{(silenceThreshold / 1000).toFixed(1)}s</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" side="top">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Wait Time</span>
                <span className="text-sm text-muted-foreground">{(silenceThreshold / 1000).toFixed(1)}s</span>
              </div>
              <Slider
                value={[silenceThreshold]}
                onValueChange={(value) => onSilenceThresholdChange(value[0])}
                min={1000}
                max={5000}
                step={500}
              />
              <p className="text-xs text-muted-foreground">Pause before processing speech</p>
            </div>
          </PopoverContent>
        </Popover>

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
        {/* English Text Display with contextual label */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {latestSpeaker === 'gp' ? (
            <div className="flex items-center gap-2 flex-shrink-0 text-primary">
              <Stethoscope className="h-5 w-5" />
              <span className="text-sm font-semibold whitespace-nowrap">I am Translating:</span>
            </div>
          ) : latestSpeaker === 'patient' ? (
            <div className="flex items-center gap-2 flex-shrink-0 text-amber-600">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-semibold whitespace-nowrap">The Patient Says:</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-semibold whitespace-nowrap">Waiting:</span>
            </div>
          )}
          <p className="text-lg font-medium text-foreground truncate">
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
