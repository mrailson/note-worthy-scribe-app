import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2, User, Users, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationEntry } from '@/hooks/useGPTranslation';

interface TranslationEntryProps {
  entry: ConversationEntry;
  selectedLanguageName: string;
  selectedLanguageFlag: string;
  onPlayAudio: (text: string, languageCode: string) => void;
  isSpeaking: boolean;
}

export const TranslationEntry: React.FC<TranslationEntryProps> = ({
  entry,
  selectedLanguageName,
  selectedLanguageFlag,
  onPlayAudio,
  isSpeaking
}) => {
  const isGP = entry.speaker === 'gp';
  
  return (
    <div 
      className={cn(
        "rounded-lg border p-4 space-y-3",
        isGP ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" 
             : "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isGP ? (
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
          <Badge variant={isGP ? 'default' : 'secondary'} className="text-xs">
            {isGP ? 'GP (English)' : `Patient (${selectedLanguageName})`}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(entry.timestamp).toLocaleTimeString('en-GB', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        
        {entry.confidence !== undefined && (
          <div className="flex items-center gap-1">
            {entry.confidence >= 0.8 ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-amber-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {Math.round(entry.confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* English Column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              🇬🇧 English
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onPlayAudio(entry.englishText, 'en')}
              disabled={isSpeaking}
            >
              <Volume2 className="h-3 w-3 mr-1" />
              <span className="text-xs">Play</span>
            </Button>
          </div>
          <p className={cn(
            "text-sm leading-relaxed p-3 rounded-md",
            isGP 
              ? "bg-white dark:bg-background font-medium" 
              : "bg-muted/50"
          )}>
            {entry.englishText}
          </p>
        </div>

        {/* Patient Language Column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              {selectedLanguageFlag} {selectedLanguageName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onPlayAudio(entry.translatedText, entry.languageCode)}
              disabled={isSpeaking}
            >
              <Volume2 className="h-3 w-3 mr-1" />
              <span className="text-xs">Play</span>
            </Button>
          </div>
          <p className={cn(
            "text-sm leading-relaxed p-3 rounded-md",
            !isGP 
              ? "bg-white dark:bg-background font-medium" 
              : "bg-muted/50"
          )}>
            {entry.translatedText}
          </p>
        </div>
      </div>
    </div>
  );
};
