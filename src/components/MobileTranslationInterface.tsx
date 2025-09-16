import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, Mic, Languages, Square } from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslationEntry {
  id: string;
  speaker: 'staff' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
}

export const MobileTranslationInterface = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('fr');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<TranslationEntry[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<'staff' | 'patient'>('staff');
  
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedLang = HEALTHCARE_LANGUAGES.find(lang => lang.code === selectedLanguage);

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentSpeaker === 'staff' ? 'en-GB' : selectedLanguage;
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const transcript = lastResult[0].transcript.trim();
          if (transcript) {
            handleSpeechResult(transcript);
          }
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast.error('Speech recognition failed');
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentSpeaker, selectedLanguage]);

  const handleSpeechResult = async (transcript: string) => {
    const isFromStaff = currentSpeaker === 'staff';
    const sourceLanguage = isFromStaff ? 'en' : selectedLanguage;
    const targetLanguage = isFromStaff ? selectedLanguage : 'en';
    
    // Add to conversation history
    const entry: TranslationEntry = {
      id: Date.now().toString(),
      speaker: currentSpeaker,
      originalText: transcript,
      translatedText: '',
      originalLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      timestamp: new Date()
    };
    
    setConversationHistory(prev => [...prev, entry]);
    
    // Translate the speech
    await translateText(transcript, targetLanguage, sourceLanguage, entry.id);
  };

  const translateText = async (text: string, targetLang: string, sourceLang: string = 'en', entryId?: string) => {
    if (!text.trim()) return;

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text-simple', {
        body: {
          text: text,
          toLang: targetLang,
          fromLang: sourceLang
        }
      });

      if (error) {
        console.error('Translation error:', error);
        toast.error('Translation failed');
        return;
      }

      const translatedText = data.translatedText;
      
      // Update conversation history if this was from speech
      if (entryId) {
        setConversationHistory(prev => 
          prev.map(entry => 
            entry.id === entryId 
              ? { ...entry, translatedText }
              : entry
          )
        );
        
        // Auto-play the translation with ElevenLabs
        await playTranslationAudio(translatedText, targetLang);
      }

    } catch (error) {
      console.error('Error translating:', error);
      toast.error('Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const playTranslationAudio = async (text: string, languageCode: string) => {
    setIsPlaying(true);
    try {
      // Use ElevenLabs TTS for better quality
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: text,
          languageCode: languageCode
        }
      });

      if (error) {
        console.error('ElevenLabs TTS error:', error);
        // Fallback to browser speech synthesis
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageCode;
        utterance.rate = 0.8;
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        speechSynthesis.speak(utterance);
        return;
      }

      // Play the ElevenLabs audio
      const audioData = data.audioData;
      const audioBlob = new Blob([
        Uint8Array.from(atob(audioData), c => c.charCodeAt(0))
      ], { type: 'audio/mpeg' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
      
    } catch (error) {
      console.error('Speech error:', error);
      setIsPlaying(false);
      toast.error('Speech playback failed');
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition not supported');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Update recognition language based on current speaker
      recognitionRef.current.lang = currentSpeaker === 'staff' ? 'en-GB' : selectedLanguage;
      recognitionRef.current.start();
    }
  };

  const switchSpeaker = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    }
    setCurrentSpeaker(prev => prev === 'staff' ? 'patient' : 'staff');
  };

  const clearHistory = () => {
    setConversationHistory([]);
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    // Update recognition language if listening
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.lang = currentSpeaker === 'staff' ? 'en-GB' : langCode;
          recognitionRef.current.start();
        }
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col flex-1">
        
        {/* Header */}
        <div className="text-center py-4 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Languages className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Quick Translate</h1>
          </div>
          <p className="text-sm text-muted-foreground">Live two-way translation for staff</p>
        </div>

        {/* Language Selector */}
        <Card className="p-4 bg-white/80 backdrop-blur-sm mb-4 flex-shrink-0">
          <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full h-12 text-base">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedLang?.flag || '🌐'}</span>
                <SelectValue placeholder="Select language" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white border shadow-lg z-50">
              {HEALTHCARE_LANGUAGES.filter(lang => lang.code !== 'none').map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{language.flag}</span>
                    <span>{language.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Live Translation Controls */}
        <Card className="p-4 bg-white/90 backdrop-blur-sm mb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Live Translation</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              className="text-xs"
            >
              Clear
            </Button>
          </div>

          <div className="space-y-3">
            {/* Speaker Toggle */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant={currentSpeaker === 'staff' ? 'default' : 'outline'}
                size="sm"
                onClick={switchSpeaker}
                disabled={isListening}
                className="flex-1"
              >
                🇬🇧 Staff
              </Button>
              <Button
                variant={currentSpeaker === 'patient' ? 'default' : 'outline'}
                size="sm"
                onClick={switchSpeaker}
                disabled={isListening}
                className="flex-1"
              >
                {selectedLang?.flag} Patient
              </Button>
            </div>

            {/* Microphone Control */}
            <div className="flex justify-center">
              <Button
                onClick={toggleListening}
                disabled={isTranslating || isPlaying}
                className={`h-16 w-16 rounded-full ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : currentSpeaker === 'staff'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {isListening ? (
                  <Square className="h-6 w-6 text-white" />
                ) : (
                  <Mic className="h-6 w-6 text-white" />
                )}
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {isListening
                ? `Listening to ${currentSpeaker}...`
                : `Tap to start listening to ${currentSpeaker}`
              }
            </p>
          </div>
        </Card>

        {/* Conversation History - Expanded */}
        <Card className="bg-white/90 backdrop-blur-sm flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b flex-shrink-0">
            <h3 className="font-medium">Conversation</h3>
          </div>
          <div 
            ref={scrollRef}
            className="flex-1 p-4 overflow-y-auto space-y-3"
          >
            {conversationHistory.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm text-center">
                  Start speaking to begin the conversation.<br />
                  Select who is speaking and tap the microphone.
                </p>
              </div>
            ) : (
              conversationHistory.map((entry) => (
                <div key={entry.id} className="space-y-2">
                  <div className={`p-3 rounded-lg ${
                    entry.speaker === 'staff' ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-teal-50 border-l-4 border-teal-400'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">
                        {entry.speaker === 'staff' ? '🇬🇧 Staff' : `${selectedLang?.flag} Patient`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.timestamp.toLocaleTimeString('en-GB', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-base">{entry.originalText}</p>
                  </div>
                  {entry.translatedText && (
                    <div className={`p-3 rounded-lg ml-6 ${
                      entry.speaker === 'staff' 
                        ? 'bg-teal-100 border-l-4 border-teal-500' 
                        : 'bg-blue-100 border-l-4 border-blue-500'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              Translation to {entry.speaker === 'staff' ? selectedLang?.name : 'English'}:
                            </span>
                          </div>
                          <p className="text-base">{entry.translatedText}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playTranslationAudio(
                            entry.translatedText, 
                            entry.targetLanguage
                          )}
                          disabled={isPlaying}
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          {isPlaying ? (
                            <div className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};