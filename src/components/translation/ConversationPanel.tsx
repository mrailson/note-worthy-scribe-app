import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TranslationEntry } from '@/components/translation/TranslationEntry';
import { ConversationEntry as ConversationEntryType } from '@/hooks/useGPTranslation';
import { Mic, Languages } from 'lucide-react';

interface ConversationPanelProps {
  conversation: ConversationEntryType[];
  currentTranscript: string;
  speakerMode: 'gp' | 'patient';
  selectedLanguage: string;
  selectedLanguageName: string;
  selectedLanguageFlag: string;
  onPlayAudio: (text: string, languageCode: string) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversation,
  currentTranscript,
  speakerMode,
  selectedLanguage,
  selectedLanguageName,
  selectedLanguageFlag,
  onPlayAudio,
  isProcessing,
  isSpeaking
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, currentTranscript]);

  const hasContent = conversation.length > 0 || currentTranscript;

  return (
    <Card className="h-[calc(100vh-200px)] flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Conversation
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              🇬🇧 English
            </Badge>
            <span className="text-muted-foreground">↔</span>
            <Badge variant="outline" className="gap-1">
              {selectedLanguageFlag || '🌐'} {selectedLanguageName || 'Select language'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        {!hasContent ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Languages className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-medium mb-2">Ready to Translate</h3>
            <p className="max-w-md">
              Select a language and start the session. Speak clearly and the system will 
              transcribe, translate, and speak the translation in real-time.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full px-4" ref={scrollRef as any}>
            <div className="space-y-4 py-4">
              {conversation.map((entry) => (
                <TranslationEntry
                  key={entry.id}
                  entry={entry}
                  selectedLanguageName={selectedLanguageName}
                  selectedLanguageFlag={selectedLanguageFlag}
                  onPlayAudio={onPlayAudio}
                  isSpeaking={isSpeaking}
                />
              ))}
              
              {/* Live transcript indicator */}
              {currentTranscript && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-dashed animate-pulse">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                    <Badge variant={speakerMode === 'gp' ? 'default' : 'secondary'}>
                      {speakerMode === 'gp' ? 'GP' : 'Patient'}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm italic">"{currentTranscript}"</p>
                    {isProcessing && (
                      <p className="text-xs text-muted-foreground mt-1">Processing...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
