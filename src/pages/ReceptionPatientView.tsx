import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Languages, WifiOff, Mail, Volume2, VolumeX } from 'lucide-react';
import { useReceptionTranslation, TranslationMessage } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';
import { supabase } from '@/integrations/supabase/client';
import { PatientEmailChatModal } from '@/components/admin-dictate/PatientEmailChatModal';
import { PatientVoiceRecorder } from '@/components/admin-dictate/PatientVoiceRecorder';
import { toast } from '@/hooks/use-toast';

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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Unlock audio on mobile - must be called from user interaction
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return true;
    
    try {
      // Create or resume AudioContext (required on iOS/Safari)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Play a silent audio to unlock playback on iOS
      const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAbD/kwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAALqAJAAADAAAgAAAAAA/+MYxBsLqAJCAADAAAgAAAACgAAAAA=');
      silentAudio.volume = 0.01;
      await silentAudio.play();
      silentAudio.pause();
      
      setAudioUnlocked(true);
      console.log('🔊 Audio unlocked for mobile');
      return true;
    } catch (err) {
      console.warn('Failed to unlock audio:', err);
      return false;
    }
  }, [audioUnlocked]);

  // Audio playback for translations
  const handlePlayAudio = useCallback(async (messageId: string, text: string, languageCode: string) => {
    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setPlayingAudioId(null);
    }

    // If clicking on already playing audio, just stop
    if (playingAudioId === messageId) {
      return;
    }

    // Unlock audio on first interaction (required for mobile)
    await unlockAudio();

    setLoadingAudioId(messageId);

    try {
      // Use gp-translation-tts which returns base64 audio
      const response = await supabase.functions.invoke('gp-translation-tts', {
        body: { 
          text, 
          languageCode
        }
      });

      if (response.error) throw response.error;

      const audioContent = response.data?.audioContent;
      if (!audioContent) throw new Error('No audio content returned');

      // Create audio from base64 using data URI (works on all browsers including mobile Safari)
      const audioUrl = `data:audio/mpeg;base64,${audioContent}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      // Ensure AudioContext is active (helps with iOS)
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      audio.onended = () => {
        setPlayingAudioId(null);
        currentAudioRef.current = null;
      };
      
      audio.onerror = (e) => {
        console.error('Audio error event:', e);
        setPlayingAudioId(null);
        setLoadingAudioId(null);
        currentAudioRef.current = null;
        toast({
          title: 'Audio Error',
          description: 'Could not play audio. Please try again.',
          variant: 'destructive'
        });
      };

      audio.oncanplaythrough = async () => {
        try {
          setLoadingAudioId(null);
          setPlayingAudioId(messageId);
          await audio.play();
        } catch (playErr) {
          console.error('Play error:', playErr);
          setPlayingAudioId(null);
          toast({
            title: 'Playback Error',
            description: 'Tap the screen first, then try playing audio.',
            variant: 'destructive'
          });
        }
      };

      // Fallback: If oncanplaythrough doesn't fire quickly, try playing anyway
      setTimeout(async () => {
        if (loadingAudioId === messageId && audio.readyState >= 2) {
          try {
            setLoadingAudioId(null);
            setPlayingAudioId(messageId);
            await audio.play();
          } catch (e) {
            console.warn('Fallback play failed:', e);
          }
        }
      }, 500);

    } catch (err) {
      console.error('Audio playback error:', err);
      setLoadingAudioId(null);
      setPlayingAudioId(null);
      toast({
        title: 'Audio Error',
        description: 'Failed to generate audio. Please try again.',
        variant: 'destructive'
      });
    }
  }, [playingAudioId, unlockAudio, loadingAudioId]);

  // Handle voice transcription from PatientVoiceRecorder
  const handleVoiceTranscription = useCallback((text: string) => {
    setInputText(prev => prev ? `${prev} ${text}` : text);
  }, []);

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
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b p-3 bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            <span className="font-semibold">{phrases.liveTranslation}</span>
            {languageInfo && (
              <Badge variant="secondary" className="ml-1">
                {languageInfo.flag}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isConnected ? 'secondary' : 'outline'} 
              className="text-xs"
            >
              {isConnected ? `●` : `○`}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setShowEmailModal(true)}
              disabled={messages.length === 0}
            >
              <Mail className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Latest message - prominent display */}
      {latestStaffMessage && (
        <div className="p-4 bg-secondary/50 border-b shrink-0">
          <p className="text-xs text-muted-foreground mb-1 text-center">{phrases.receptionSays}</p>
          <p className="text-xl md:text-2xl text-center font-medium leading-relaxed">
            {latestStaffMessage.translatedText}
          </p>
        </div>
      )}

      {/* Message history */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="space-y-3 max-w-lg mx-auto p-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">
              <Languages className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-base">{phrases.waitingForReception}</p>
              <p className="text-sm mt-1">{phrases.messagesWillAppear}</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const messageId = msg.id || `msg-${index}`;
              const isStaffMessage = msg.speaker === 'staff';
              const displayText = isStaffMessage ? msg.translatedText : msg.originalText;
              const audioLang = isStaffMessage ? langCode : 'en';
              
              return (
                <div
                  key={messageId}
                  className={`flex ${msg.speaker === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 ${
                      msg.speaker === 'patient'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    <p className="text-base leading-relaxed">
                      {displayText}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      {msg.speaker === 'patient' ? (
                        <p className="text-xs opacity-70">{phrases.sentToReception}</p>
                      ) : (
                        <span />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 ${msg.speaker === 'patient' ? 'text-primary-foreground hover:bg-primary-foreground/20' : ''}`}
                        onClick={() => handlePlayAudio(messageId, displayText, audioLang)}
                        disabled={loadingAudioId === messageId}
                      >
                        {loadingAudioId === messageId ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            <span className="text-xs">{phrases.loadingAudio}</span>
                          </>
                        ) : playingAudioId === messageId ? (
                          <>
                            <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                            <span className="text-xs">{phrases.playing}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3 w-3 mr-1" />
                            <span className="text-xs">{phrases.playAudio}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isTranslating && (
            <div className="flex justify-end">
              <div className="bg-primary/50 text-primary-foreground rounded-2xl rounded-br-sm p-3">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-3 bg-background shrink-0 pb-safe">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={languageInfo ? phrases.typeInLanguage.replace('{language}', languageInfo.name) : phrases.typeYourMessage}
              className="min-h-[50px] resize-none text-base"
              rows={2}
            />
            <PatientVoiceRecorder
              onTranscription={handleVoiceTranscription}
              language={langCode}
              disabled={isTranslating}
              phrases={{
                tapToSpeak: phrases.tapToSpeak,
                recording: phrases.recording,
                transcribing: phrases.transcribing,
                voiceError: phrases.voiceError,
              }}
            />
          </div>
          <Button
            className="w-full mt-2"
            onClick={handleSend}
            disabled={!inputText.trim() || isTranslating}
          >
            {isTranslating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {phrases.send}
          </Button>
        </div>
      </div>

      {/* Email Modal */}
      <PatientEmailChatModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        messages={messages}
        phrases={phrases}
        languageName={languageInfo?.name || 'Unknown'}
      />
    </div>
  );
};

export default ReceptionPatientView;
