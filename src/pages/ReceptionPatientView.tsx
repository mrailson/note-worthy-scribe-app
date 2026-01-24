import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Send, Loader2, Languages, WifiOff } from 'lucide-react';
import { useReceptionTranslation, TranslationMessage } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';
import { supabase } from '@/integrations/supabase/client';

const ReceptionPatientView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('session') || '';
  
  const [sessionData, setSessionData] = useState<{
    id: string;
    patient_language: string;
    is_active: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const langCode = sessionData?.patient_language || 'en';
  const phrases = getPatientViewPhrases(langCode);

  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      if (!sessionToken) {
        setError('invalid_link');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('reception_translation_sessions')
          .select('id, patient_language, is_active, expires_at')
          .eq('session_token', sessionToken)
          .single();

        if (fetchError || !data) {
          setError('session_not_found');
          setIsLoading(false);
          return;
        }

        if (!data.is_active || new Date(data.expires_at) < new Date()) {
          setError('session_ended');
          setIsLoading(false);
          return;
        }

        setSessionData(data);
      } catch (err) {
        console.error('Session validation error:', err);
        setError('connection_error');
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, [sessionToken]);

  const {
    messages,
    isConnected,
    isTranslating,
    sendMessage,
    error: connectionError
  } = useReceptionTranslation({
    sessionToken,
    patientLanguage: langCode,
    isStaff: false
  });

  const languageInfo = sessionData 
    ? HEALTHCARE_LANGUAGES.find(l => l.code === sessionData.patient_language)
    : null;

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Speech recognition setup
  useEffect(() => {
    if (!sessionData?.patient_language) return;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      
      const langMap: Record<string, string> = {
        'ar': 'ar-SA', 'zh': 'zh-CN', 'fr': 'fr-FR', 'de': 'de-DE',
        'hi': 'hi-IN', 'it': 'it-IT', 'es': 'es-ES', 'pl': 'pl-PL',
        'pt': 'pt-PT', 'ru': 'ru-RU', 'tr': 'tr-TR', 'ur': 'ur-PK',
        'bn': 'bn-BD', 'pa': 'pa-IN', 'gu': 'gu-IN', 'ta': 'ta-IN',
        'te': 'te-IN', 'uk': 'uk-UA', 'vi': 'vi-VN', 'th': 'th-TH',
        'nl': 'nl-NL', 'el': 'el-GR', 'cs': 'cs-CZ', 'ro': 'ro-RO',
        'hu': 'hu-HU', 'da': 'da-DK',
      };
      
      recognitionRef.current.lang = langMap[sessionData.patient_language] || sessionData.patient_language;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputText(prev => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }

    return () => { recognitionRef.current?.stop(); };
  }, [sessionData?.patient_language]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    await sendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getErrorMessage = (errorKey: string) => {
    const errorPhrases = getPatientViewPhrases(langCode);
    switch (errorKey) {
      case 'invalid_link': return errorPhrases.invalidLink;
      case 'session_not_found': return errorPhrases.sessionNotFound;
      case 'session_ended': return errorPhrases.sessionEnded;
      default: return errorPhrases.connectionError;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">{phrases.connectingToSession}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <WifiOff className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">{phrases.connectionError}</h1>
            <p className="text-muted-foreground">{error ? getErrorMessage(error) : connectionError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestStaffMessage = [...messages].reverse().find(m => m.speaker === 'staff');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-primary text-primary-foreground">
        <div className="flex items-center justify-center gap-2">
          <Languages className="h-5 w-5" />
          <span className="font-semibold">{phrases.liveTranslation}</span>
          {languageInfo && (
            <Badge variant="secondary" className="ml-2">
              {languageInfo.flag} {languageInfo.name}
            </Badge>
          )}
        </div>
        <Badge 
          variant={isConnected ? 'secondary' : 'outline'} 
          className="mx-auto mt-2 block w-fit"
        >
          {isConnected ? `● ${phrases.connected}` : `○ ${phrases.connecting}`}
        </Badge>
      </div>

      {/* Latest message - prominent display */}
      {latestStaffMessage && (
        <div className="p-6 bg-secondary/50 border-b">
          <p className="text-sm text-muted-foreground mb-2 text-center">{phrases.receptionSays}</p>
          <p className="text-2xl md:text-3xl text-center font-medium leading-relaxed">
            {latestStaffMessage.translatedText}
          </p>
        </div>
      )}

      {/* Message history */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-lg mx-auto">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Languages className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">{phrases.waitingForReception}</p>
              <p className="text-sm mt-2">{phrases.messagesWillAppear}</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex ${msg.speaker === 'patient' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    msg.speaker === 'patient'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  <p className="text-lg leading-relaxed">
                    {msg.speaker === 'staff' ? msg.translatedText : msg.originalText}
                  </p>
                  {msg.speaker === 'patient' && (
                    <p className="text-xs mt-2 opacity-70">{phrases.sentToReception}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {isTranslating && (
            <div className="flex justify-end">
              <div className="bg-primary/50 text-primary-foreground rounded-2xl rounded-br-sm p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-4 bg-background">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={languageInfo ? phrases.typeInLanguage.replace('{language}', languageInfo.name) : phrases.typeYourMessage}
              className="min-h-[60px] resize-none text-lg"
              rows={2}
            />
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                variant={isListening ? 'destructive' : 'outline'}
                className="h-full aspect-square"
                onClick={toggleListening}
              >
                {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
            </div>
          </div>
          <Button
            className="w-full mt-2"
            size="lg"
            onClick={handleSend}
            disabled={!inputText.trim() || isTranslating}
          >
            {isTranslating ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Send className="h-5 w-5 mr-2" />
            )}
            {phrases.send}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReceptionPatientView;
