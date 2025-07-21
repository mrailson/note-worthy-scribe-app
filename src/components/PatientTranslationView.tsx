import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Volume2, VolumeX, Languages, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TranslationEntry {
  id: string;
  speaker: 'GP' | 'Patient';
  originalText: string;
  translatedText: string;
  timestamp: Date;
  languageCode: string;
  isPlaying?: boolean;
}

interface PatientTranslationViewProps {
  selectedLanguage: string;
  languageName: string;
  languageFlag: string;
  isRecording: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  realtimeTranscripts?: any[];
}

const HEALTHCARE_LANGUAGES = [
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', voice: 'ar-XA-Wavenet-A' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', voice: 'bn-IN-Wavenet-A' },
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬', voice: 'bg-BG-Standard-A' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳', voice: 'cmn-CN-Wavenet-A' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷', voice: 'hr-HR-Wavenet-A' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', voice: 'cs-CZ-Wavenet-A' },
  { code: 'da', name: 'Danish', flag: '🇩🇰', voice: 'da-DK-Wavenet-A' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', voice: 'nl-NL-Wavenet-A' },
  { code: 'fr', name: 'French', flag: '🇫🇷', voice: 'fr-FR-Wavenet-A' },
  { code: 'de', name: 'German', flag: '🇩🇪', voice: 'de-DE-Wavenet-A' },
  { code: 'el', name: 'Greek', flag: '🇬🇷', voice: 'el-GR-Wavenet-A' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', voice: 'hi-IN-Wavenet-A' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', voice: 'hu-HU-Wavenet-A' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', voice: 'it-IT-Wavenet-A' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', voice: 'pl-PL-Wavenet-A' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', voice: 'pt-PT-Wavenet-A' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴', voice: 'ro-RO-Wavenet-A' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', voice: 'ru-RU-Wavenet-A' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', voice: 'es-ES-Wavenet-A' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', voice: 'tr-TR-Wavenet-A' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', voice: 'ur-IN-Wavenet-A' }
];

export const PatientTranslationView = ({
  selectedLanguage,
  languageName,
  languageFlag,
  isRecording,
  isMuted,
  onMuteToggle,
  realtimeTranscripts = []
}: PatientTranslationViewProps) => {
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<Array<{text: string, languageCode: string, id: string}>>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = useState(false);

  const translateText = async (text: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          targetLanguage,
          sourceLanguage
        }
      });

      if (error) throw error;
      return data.translatedText;
    } catch (error: any) {
      console.error('Translation failed:', error);
      return text;
    }
  };

  const speakText = async (text: string, languageCode: string, id: string) => {
    if (isMuted) return;
    
    audioQueueRef.current.push({ text, languageCode, id });
    
    if (!isCurrentlyPlaying) {
      processAudioQueue();
    }
  };

  const processAudioQueue = async () => {
    if (audioQueueRef.current.length === 0 || isCurrentlyPlaying) return;
    
    setIsCurrentlyPlaying(true);
    const audioItem = audioQueueRef.current.shift()!;
    
    try {
      const language = HEALTHCARE_LANGUAGES.find(l => l.code === audioItem.languageCode);
      if (!language?.voice) {
        processNextInQueue();
        return;
      }

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: audioItem.text,
          languageCode: audioItem.languageCode,
          voiceName: language.voice
        }
      });

      if (error) throw error;

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      const audioData = `data:audio/mp3;base64,${data.audioContent}`;
      const audio = new Audio(audioData);
      currentAudioRef.current = audio;
      
      audio.onended = () => processNextInQueue();
      audio.onerror = () => processNextInQueue();

      await audio.play();
    } catch (error: any) {
      console.error('TTS Error:', error);
      processNextInQueue();
    }
  };

  const processNextInQueue = () => {
    setIsCurrentlyPlaying(false);
    currentAudioRef.current = null;
    
    setTimeout(() => {
      if (audioQueueRef.current.length > 0) {
        processAudioQueue();
      }
    }, 100);
  };

  const processTranscriptForTranslation = async (transcriptText: string) => {
    if (!transcriptText.trim()) return;
    
    setIsTranslating(true);
    
    try {
      // Detect if this is likely patient speech (contains non-English words or patterns)
      // For now, we'll assume anything from "Patient:" is patient speech
      const isPatientSpeech = transcriptText.toLowerCase().includes('patient:');
      
      let speaker: 'GP' | 'Patient';
      let sourceLanguage: string;
      let targetLanguage: string;
      let originalText: string;
      
      if (isPatientSpeech) {
        // Patient speaking in their language -> translate to English
        speaker = 'Patient';
        sourceLanguage = selectedLanguage;
        targetLanguage = 'en';
        originalText = transcriptText.replace(/patient:\s*/i, '').trim();
      } else {
        // GP speaking in English -> translate to patient's language
        speaker = 'GP';
        sourceLanguage = 'en';
        targetLanguage = selectedLanguage;
        originalText = transcriptText.replace(/gp:\s*|doctor:\s*/i, '').trim();
      }
      
      const translatedText = await translateText(originalText, targetLanguage, sourceLanguage);
      
      const newTranslation: TranslationEntry = {
        id: Date.now().toString(),
        speaker,
        originalText,
        translatedText,
        timestamp: new Date(),
        languageCode: targetLanguage
      };
      
      setTranslations(prev => [...prev.slice(-9), newTranslation]);
      
      // Auto-play the translated text
      if (!isMuted) {
        speakText(translatedText, targetLanguage, newTranslation.id);
      }
      
    } catch (error) {
      console.error('Translation processing error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // Process new transcripts
  useEffect(() => {
    const latestTranscript = realtimeTranscripts?.[realtimeTranscripts.length - 1];
    if (latestTranscript?.isFinal && latestTranscript.text.trim()) {
      const fullText = `${latestTranscript.speaker}: ${latestTranscript.text}`;
      processTranscriptForTranslation(fullText);
    }
  }, [realtimeTranscripts, selectedLanguage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [translations]);

  // Clear audio queue when muted
  useEffect(() => {
    if (isMuted) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      audioQueueRef.current = [];
      setIsCurrentlyPlaying(false);
    }
  }, [isMuted]);

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-elegant border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-bold">Translation Interface</h2>
              <p className="text-sm text-muted-foreground">
                English ↔ {languageFlag} {languageName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isRecording && (
              <Badge variant="default" className="bg-red-500 animate-pulse">
                <Mic className="h-3 w-3 mr-1" />
                Recording
              </Badge>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={onMuteToggle}
              className="flex items-center gap-2"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea 
          ref={scrollAreaRef}
          className="h-[500px] p-6"
        >
          {translations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <Languages className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Ready for Translation
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Start speaking to see real-time translations. GP speech will be translated to {languageName}, 
                and patient speech will be translated to English.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {translations.map((translation) => (
                <div
                  key={translation.id}
                  className={`flex flex-col gap-3 p-4 rounded-lg border-2 ${
                    translation.speaker === 'GP'
                      ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                      : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant={translation.speaker === 'GP' ? 'default' : 'secondary'}
                      className={`${
                        translation.speaker === 'GP'
                          ? 'bg-blue-600 text-white'
                          : 'bg-green-600 text-white'
                      }`}
                    >
                      {translation.speaker}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {translation.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="grid gap-3">
                    {/* Original Text */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Original ({translation.speaker === 'GP' ? 'English' : languageName}):
                      </p>
                      <p className="text-sm">{translation.originalText}</p>
                    </div>
                    
                    {/* Translated Text */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Translation ({translation.speaker === 'GP' ? languageName : 'English'}):
                      </p>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-medium flex-1">{translation.translatedText}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => speakText(translation.translatedText, translation.languageCode, translation.id)}
                          disabled={isMuted}
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTranslating && (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                    <span className="text-sm">Translating...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};