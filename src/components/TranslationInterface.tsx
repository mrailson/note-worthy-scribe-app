import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Volume2, VolumeX, Languages, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

interface TranslationEntry {
  id: string;
  original: string;
  translated: string;
  speaker: string;
  timestamp: Date;
  languageCode: string;
}

interface TranslationInterfaceProps {
  transcript: string;
  isRecording: boolean;
  onLanguageChange: (languageCode: string) => void;
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
  { code: 'en', name: 'English', flag: '🇬🇧', voice: 'en-GB-Wavenet-A' },
  { code: 'et', name: 'Estonian', flag: '🇪🇪', voice: 'et-EE-Standard-A' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮', voice: 'fi-FI-Wavenet-A' },
  { code: 'fr', name: 'French', flag: '🇫🇷', voice: 'fr-FR-Wavenet-A' },
  { code: 'de', name: 'German', flag: '🇩🇪', voice: 'de-DE-Wavenet-A' },
  { code: 'el', name: 'Greek', flag: '🇬🇷', voice: 'el-GR-Wavenet-A' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', voice: 'hi-IN-Wavenet-A' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', voice: 'hu-HU-Wavenet-A' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', voice: 'it-IT-Wavenet-A' },
  { code: 'lv', name: 'Latvian', flag: '🇱🇻', voice: 'lv-LV-Standard-A' },
  { code: 'lt', name: 'Lithuanian', flag: '🇱🇹', voice: 'lt-LT-Standard-A' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴', voice: 'nb-NO-Wavenet-A' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', voice: 'pl-PL-Wavenet-A' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', voice: 'pt-PT-Wavenet-A' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴', voice: 'ro-RO-Wavenet-A' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', voice: 'ru-RU-Wavenet-A' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰', voice: 'sk-SK-Wavenet-A' },
  { code: 'sl', name: 'Slovenian', flag: '🇸🇮', voice: 'sl-SI-Wavenet-A' },
  { code: 'so', name: 'Somali', flag: '🇸🇴', voice: 'so-SO-Standard-A' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', voice: 'es-ES-Wavenet-A' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', voice: 'sv-SE-Wavenet-A' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', voice: 'tr-TR-Wavenet-A' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', voice: 'uk-UA-Wavenet-A' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', voice: 'ur-IN-Wavenet-A' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', voice: 'vi-VN-Wavenet-A' }
];

export const TranslationInterface = ({ transcript, isRecording, onLanguageChange }: TranslationInterfaceProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioQueue = useRef<Array<{text: string, id: string}>>([]);
  const isProcessingAudio = useRef(false);
  const lastTranscriptLength = useRef(0);
  const lastTranslatedContent = useRef<string>('');

  const handleLanguageSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    setIsTranslationEnabled(true);
    onLanguageChange(languageCode);
    toast.success(`Translation enabled for ${HEALTHCARE_LANGUAGES.find(l => l.code === languageCode)?.name}`);
  };

  const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          targetLanguage,
          sourceLanguage: 'en'
        }
      });

      if (error) throw error;
      return data.translatedText;
    } catch (error: any) {
      toast.error(`Translation failed: ${error.message}`);
      return text;
    }
  };

  const speakTranslation = async (text: string, languageCode: string, id: string) => {
    if (isMuted) return; // Skip speaking if muted
    
    try {
      setIsSpeaking(true);
      const language = HEALTHCARE_LANGUAGES.find(l => l.code === languageCode);
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text,
          languageCode,
          voiceName: language?.voice
        }
      });

      if (error) throw error;

      // Create audio from base64
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      return new Promise<void>((resolve) => {
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.play().catch(() => resolve());
      });
    } catch (error: any) {
      console.error('Speech failed:', error);
    }
  };

  const processAudioQueue = async () => {
    if (isProcessingAudio.current || audioQueue.current.length === 0) return;
    
    isProcessingAudio.current = true;
    
    while (audioQueue.current.length > 0) {
      const item = audioQueue.current.shift();
      if (item) {
        await speakTranslation(item.text, selectedLanguage, item.id);
      }
    }
    
    isProcessingAudio.current = false;
    setIsSpeaking(false);
  };

  const playTranslation = async (text: string, languageCode: string, id: string) => {
    if (isPlaying === id) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(null);
      return;
    }

    try {
      setIsPlaying(id);
      const language = HEALTHCARE_LANGUAGES.find(l => l.code === languageCode);
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text,
          languageCode,
          voiceName: language?.voice
        }
      });

      if (error) throw error;

      // Create audio from base64
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setIsPlaying(null);
          URL.revokeObjectURL(audioUrl);
        };
        audioRef.current.onerror = () => {
          setIsPlaying(null);
          URL.revokeObjectURL(audioUrl);
          toast.error('Failed to play audio');
        };
        await audioRef.current.play();
      }
    } catch (error: any) {
      setIsPlaying(null);
      toast.error(`Audio playback failed: ${error.message}`);
    }
  };

  const handleIncorrectTranslation = async () => {
    if (!selectedLanguage || translations.length === 0) return;
    
    try {
      setIsTranslating(true);
      const apologyMessage = "I am sorry, that last translation was incorrect, I will repeat it now.";
      const translatedApology = await translateText(apologyMessage, selectedLanguage);
      
      // Speak the apology in the local language
      if (!isMuted) {
        await speakTranslation(translatedApology, selectedLanguage, 'apology-' + Date.now());
      }
      
      // Then repeat the last translation
      const lastTranslation = translations[0];
      if (lastTranslation && autoSpeak && !isMuted) {
        setTimeout(() => {
          speakTranslation(lastTranslation.translated, selectedLanguage, lastTranslation.id);
        }, 1000); // Wait 1 second before repeating
      }
      
      toast.success('Apology spoken in ' + HEALTHCARE_LANGUAGES.find(l => l.code === selectedLanguage)?.name);
    } catch (error: any) {
      toast.error(`Failed to speak apology: ${error.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Auto-translate new transcript content
  useEffect(() => {
    if (!isTranslationEnabled || !selectedLanguage || !autoTranslate || !transcript) return;

    console.log('Translation useEffect triggered:', { 
      transcript: transcript.slice(-100), 
      length: transcript.length, 
      lastLength: lastTranscriptLength.current 
    });

    const currentLength = transcript.length;
    if (currentLength <= lastTranscriptLength.current) {
      console.log('No new content, skipping translation');
      return;
    }

    // Clear any existing timer
    const timer = setTimeout(() => {
      const newContent = transcript.slice(lastTranscriptLength.current);
      
      console.log('Processing new content for translation:', { 
        newContent: newContent.slice(-50), 
        length: newContent.length 
      });
      
      // Only translate if we have meaningful content (8+ characters)
      // and either complete sentences or substantial phrases
      const trimmedContent = newContent.trim();
      const hasCompleteSentence = /[.!?]+\s*$/.test(trimmedContent);
      const hasSubstantialContent = trimmedContent.length >= 8;
      const wordCount = trimmedContent.split(/\s+/).filter(word => word.length > 0).length;
      
      console.log('Translation criteria check:', {
        hasCompleteSentence,
        hasSubstantialContent,
        wordCount,
        trimmedContent: trimmedContent.slice(-30)
      });
      
      // Only translate if we have:
      // 1. A complete sentence with punctuation, OR
      // 2. At least 8 characters AND 3+ words (substantial phrase)
      if (!hasCompleteSentence && (!hasSubstantialContent || wordCount < 3)) {
        console.log('Skipping translation - criteria not met');
        return;
      }
      
      lastTranscriptLength.current = currentLength;

      const translateNewContent = async () => {
        console.log('Starting translation process...');
        setIsTranslating(true);
        
        let contentToTranslate = trimmedContent;
        
        // If we have complete sentences, extract the last complete one
        if (hasCompleteSentence) {
          const sentences = trimmedContent.split(/[.!?]+/).filter(s => s.trim().length > 3);
          if (sentences.length > 0) {
            contentToTranslate = sentences[sentences.length - 1].trim();
          }
        }
        
        console.log('Content to translate:', contentToTranslate);
        
        // Check if we've already translated this exact content
        if (contentToTranslate === lastTranslatedContent.current) {
          console.log('Already translated this content, skipping to prevent duplication');
          setIsTranslating(false);
          return;
        }
        
        // Only translate if we have meaningful content
        if (contentToTranslate.length < 3) {
          console.log('Content too short, skipping translation');
          setIsTranslating(false);
          return;
        }

        // Update last translated content
        lastTranslatedContent.current = contentToTranslate;

        try {
          console.log('Calling translation service...');
          const translated = await translateText(contentToTranslate, selectedLanguage);
          console.log('Translation received:', translated);
          
          const entry: TranslationEntry = {
            id: Date.now().toString() + Math.random(),
            original: contentToTranslate,
            translated,
            speaker: contentToTranslate.toLowerCase().includes('patient') ? 'Patient' : 'GP',
            timestamp: new Date(),
            languageCode: selectedLanguage
          };
          
          // Replace the previous translation to always show the latest
          setTranslations(prev => [entry]);
          
          // Auto-speak if enabled
          if (autoSpeak && translated.trim().length > 0) {
            console.log('Adding to audio queue:', translated.slice(0, 50));
            // Clear the audio queue and add the new translation
            audioQueue.current = [{ text: translated, id: entry.id }];
          }
        } catch (error) {
          console.error('Translation failed:', error);
        }
        
        setIsTranslating(false);
      };

      translateNewContent();
    }, 1500); // Reduced to 1.5 seconds for faster response

    return () => clearTimeout(timer);
  }, [transcript, isTranslationEnabled, selectedLanguage, autoTranslate]);

  // Process audio queue when new items are added
  useEffect(() => {
    if (autoSpeak && audioQueue.current.length > 0 && !isProcessingAudio.current) {
      processAudioQueue();
    }
  }, [translations, autoSpeak]);

  const selectedLang = HEALTHCARE_LANGUAGES.find(l => l.code === selectedLanguage);

  if (!isTranslationEnabled) {
    return (
      <Card className="border-accent/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Real-time Translation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a language to enable real-time translation during the consultation.
            </p>
            <Select onValueChange={handleLanguageSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose patient's language" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {HEALTHCARE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <div className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Translation: {selectedLang?.flag} {selectedLang?.name}
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Auto-translate</label>
              <Switch 
                checked={autoTranslate}
                onCheckedChange={setAutoTranslate}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Auto-speak</label>
              <Switch 
                checked={autoSpeak}
                onCheckedChange={setAutoSpeak}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="h-8 w-8 p-0"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsTranslationEnabled(false);
                setTranslations([]);
                onLanguageChange('');
              }}
            >
              Disable
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {isTranslating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Translating...
              </div>
            )}
            {isSpeaking && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Volume2 className="h-4 w-4 animate-pulse" />
                Speaking translation...
              </div>
            )}
          </div>
          
          <div className="border rounded-lg p-4 min-h-[200px]">
            {translations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Languages className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Translations will appear here as the consultation progresses</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show only the latest translation */}
                {translations.slice(0, 1).map((entry) => (
                  <div key={entry.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={entry.speaker === 'GP' ? 'default' : 'secondary'} className="text-sm">
                        {entry.speaker}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Latest • {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                      <div className="text-sm text-muted-foreground">
                        <strong>English:</strong> 
                        <div className="mt-1 text-foreground">{entry.original}</div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-muted-foreground">{selectedLang?.name}:</strong>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => playTranslation(entry.translated, entry.languageCode, entry.id)}
                            className="h-8 w-8 p-0"
                          >
                            {isPlaying === entry.id ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <div className="text-lg font-medium text-foreground">
                          {entry.translated}
                        </div>
                      </div>
                    </div>
                    
                    {translations.length > 1 && (
                      <div className="text-center">
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {translations.length - 1} previous translation{translations.length > 2 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Incorrect Translation Button */}
          {translations.length > 0 && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleIncorrectTranslation}
                disabled={isTranslating || isSpeaking}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                Incorrect Translation
              </Button>
            </div>
          )}
          
          <audio ref={audioRef} className="hidden" />
        </div>
      </CardContent>
    </Card>
  );
};