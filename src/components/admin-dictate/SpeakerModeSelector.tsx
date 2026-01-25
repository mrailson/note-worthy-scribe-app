import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Users, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceWaveform } from '@/components/translation/VoiceWaveform';

interface SpeakerModeSelectorProps {
  mode: 'staff' | 'patient';
  onModeChange: (mode: 'staff' | 'patient') => void;
  patientLanguageName: string;
  patientLanguageFlag?: string;
  isListening: boolean;
  disabled?: boolean;
}

export const SpeakerModeSelector: React.FC<SpeakerModeSelectorProps> = ({
  mode,
  onModeChange,
  patientLanguageName,
  patientLanguageFlag,
  isListening,
  disabled
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Toggle buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mode === 'staff' ? 'default' : 'outline'}
          className={cn(
            "h-auto py-3 flex flex-col gap-1 relative transition-all",
            mode === 'staff' && isListening && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => onModeChange('staff')}
          disabled={disabled}
        >
          {mode === 'staff' && isListening && (
            <span className="absolute top-2 right-2">
              <Mic className="h-4 w-4 animate-pulse text-red-500" />
            </span>
          )}
          <User className="h-5 w-5" />
          <div className="text-center">
            <div className="font-semibold text-sm">Receptionist</div>
            <div className="text-xs opacity-70">🇬🇧 English</div>
          </div>
        </Button>
        
        <Button
          variant={mode === 'patient' ? 'default' : 'outline'}
          className={cn(
            "h-auto py-3 flex flex-col gap-1 relative transition-all",
            mode === 'patient' && "bg-emerald-600 hover:bg-emerald-700 text-white",
            mode === 'patient' && isListening && "ring-2 ring-emerald-400 ring-offset-2"
          )}
          onClick={() => onModeChange('patient')}
          disabled={disabled}
        >
          {mode === 'patient' && isListening && (
            <span className="absolute top-2 right-2">
              <Mic className="h-4 w-4 animate-pulse text-red-500" />
            </span>
          )}
          <Users className="h-5 w-5" />
          <div className="text-center">
            <div className="font-semibold text-sm">Patient</div>
            <div className="text-xs opacity-70">{patientLanguageFlag} {patientLanguageName}</div>
          </div>
        </Button>
      </div>

      {/* Status indicator */}
      <div className="text-center">
        <Badge 
          variant="outline" 
          className={cn(
            "px-3 py-1.5 text-sm gap-2 transition-all",
            mode === 'staff' 
              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" 
              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
          )}
        >
          {isListening ? (
            <>
              <VoiceWaveform isActive={true} className={mode === 'staff' ? 'text-blue-500' : 'text-emerald-500'} />
              Listening for {mode === 'staff' ? 'English' : patientLanguageName}...
            </>
          ) : (
            <>
              {mode === 'staff' 
                ? '🇬🇧 English → Patient language' 
                : `${patientLanguageFlag} ${patientLanguageName} → English`
              }
            </>
          )}
        </Badge>
      </div>
    </div>
  );
};
