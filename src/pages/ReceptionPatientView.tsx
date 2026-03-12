import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Languages, WifiOff, Mail, ShieldX } from 'lucide-react';
import { useReceptionTranslation } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';
import { supabase } from '@/integrations/supabase/client';
import { PatientEmailChatModal } from '@/components/admin-dictate/PatientEmailChatModal';
import { PatientVoiceRecorderLive } from '@/components/admin-dictate/PatientVoiceRecorderLive';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  // Handle voice transcription from PatientVoiceRecorder
  const handleVoiceTranscription = useCallback((text: string) => {
    setInputText(prev => prev ? `${prev} ${text}` : text);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const result = await sendMessage(inputText.trim());
    
    // Handle blocked content - don't clear input, show dialog
    if (result?.blocked) {
      setShowBlockedDialog(true);
      return;
    }
    
    // Only clear input if message was sent successfully
    if (result?.success !== false) {
      setInputText('');
    }
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
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(0, 94, 184, 0.1)' }}>
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#005EB8' }} />
          </div>
          <p className="text-base text-muted-foreground">{phrases.connectingToSession}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <WifiOff className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold mb-2">{phrases.connectionError}</h1>
            <p className="text-muted-foreground text-sm">{error ? getErrorMessage(error) : connectionError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestStaffMessage = [...messages].reverse().find(m => m.speaker === 'staff');

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* ── NHS-BRANDED HEADER ── */}
      <div className="shrink-0 text-white p-4" style={{ background: 'linear-gradient(135deg, #003087, #005EB8)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{phrases.liveTranslation}</p>
              <p className="text-[0.65rem]" style={{ color: 'rgba(255,255,255,0.6)' }}>GP Practice</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {languageInfo && (
              <span className="text-lg">{languageInfo.flag}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
              onClick={() => setShowEmailModal(true)}
              disabled={messages.length === 0}
            >
              <Mail className="h-4 w-4" />
            </Button>
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : ''}`} style={!isConnected ? { background: 'rgba(255,255,255,0.3)' } : {}} />
          </div>
        </div>
      </div>

      {/* ── CONNECTION LOST BANNER ── */}
      {!isConnected && messages.length > 0 && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 shrink-0">
          <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
            <WifiOff className="h-4 w-4" />
            <span className="font-medium">{phrases.connectionLost}</span>
            <Loader2 className="h-3 w-3 animate-spin" />
          </div>
        </div>
      )}

      {/* ── LATEST STAFF MESSAGE — PROMINENT ── */}
      {latestStaffMessage && (
        <div className="px-4 py-5 border-b shrink-0 bg-gradient-to-b from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background">
          <div className="flex items-center gap-1.5 mb-2 justify-center">
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 94, 184, 0.1)' }}>
              <span className="text-[0.6rem]">🏥</span>
            </div>
            <p className="text-xs font-medium text-primary">{phrases.receptionSays}</p>
          </div>
          <p className="text-xl md:text-2xl text-center font-medium leading-relaxed text-foreground">
            {latestStaffMessage.translatedText}
          </p>
          <p className="text-[0.65rem] text-muted-foreground text-center mt-2">
            {new Date(latestStaffMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      {/* ── MESSAGE HISTORY ── */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="space-y-3 max-w-lg mx-auto p-3">
          {messages.length === 0 ? (
            /* ── EMPTY STATE ── */
            <div className="text-center px-6 py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Languages className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">{phrases.waitingForReception}</h2>
              <p className="text-sm text-muted-foreground mb-6">{phrases.messagesWillAppear}</p>
              
              {/* Connection indicator */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
                isConnected 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isConnected ? phrases.connected : phrases.connecting}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const messageId = msg.id || `msg-${index}`;
                const isStaffMessage = msg.speaker === 'staff';
                const displayText = isStaffMessage ? msg.translatedText : msg.originalText;
                const isLatest = index === messages.length - 1;
                
                return (
                  <div
                    key={messageId}
                    className={`flex ${isStaffMessage ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        isStaffMessage
                          ? 'bg-card border border-border rounded-bl-md shadow-sm'
                          : 'bg-primary text-primary-foreground rounded-br-md shadow-sm'
                      } ${isLatest 
                        ? (isStaffMessage ? 'ring-2 ring-emerald-200 dark:ring-emerald-800' : 'ring-2 ring-primary/30')
                        : ''
                      }`}
                    >
                      {/* Speaker label */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[0.65rem] font-semibold ${
                          isStaffMessage ? 'text-primary' : 'text-primary-foreground/70'
                        }`}>
                          {isStaffMessage ? `🏥 ${phrases.receptionSays}` : phrases.you}
                        </span>
                      </div>
                      <p className="text-[0.95rem] leading-relaxed">{displayText}</p>
                      {/* Sent confirmation for patient messages */}
                      {!isStaffMessage && (
                        <p className="text-[0.6rem] mt-1.5 text-primary-foreground/50">{phrases.sentToReception}</p>
                      )}
                      {/* Timestamp */}
                      <p className={`text-[0.6rem] mt-1 ${
                        isStaffMessage ? 'text-muted-foreground' : 'text-primary-foreground/50'
                      }`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Privacy note */}
              <div className="text-center py-2 px-4">
                <p className="text-[0.6rem] text-muted-foreground/50">
                  🔒 {phrases.privacyNote}
                </p>
              </div>
            </>
          )}

          {isTranslating && (
            <div className="flex justify-end">
              <div className="bg-primary/50 text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── INPUT AREA ── */}
      <div className="border-t p-3 bg-background shrink-0 pb-safe">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={languageInfo ? phrases.typeInLanguage.replace('{language}', languageInfo.name) : phrases.typeYourMessage}
                className="min-h-[48px] max-h-[120px] resize-none text-base rounded-2xl border-2 focus:border-primary"
                rows={1}
              />
            </div>
            <PatientVoiceRecorderLive
              onTranscription={handleVoiceTranscription}
              language={langCode}
              disabled={isTranslating}
              phrases={{
                tapToSpeak: phrases.tapToSpeak,
                recording: phrases.recording,
                transcribing: phrases.transcribing,
                voiceError: phrases.voiceError,
                listening: phrases.listening,
                tapToStop: phrases.tapToStop,
              }}
            />
          </div>
          <Button
            className="w-full mt-2 rounded-xl h-11 text-base font-semibold"
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

      {/* Blocked Content Alert */}
      <AlertDialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <AlertDialogContent className="border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" />
              {phrases.blockedTitle || 'Message Blocked'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {phrases.blockedMessage || 'This message contains language that cannot be sent. Please rephrase your message.'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowBlockedDialog(false)}>
              {phrases.editMessage || 'Edit Message'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReceptionPatientView;
