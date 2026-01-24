import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Wifi, 
  WifiOff,
  Volume2,
  Trash2,
  Download,
  FileText
} from 'lucide-react';
import { useReceptionTranslation, TranslationMessage } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { generateTranslationReportDocx } from '@/utils/generateTranslationReportDocx';

interface ReceptionTranslationViewProps {
  sessionId: string;
  sessionToken: string;
  patientLanguage: string;
  onClose: () => void;
}

export const ReceptionTranslationView: React.FC<ReceptionTranslationViewProps> = ({
  sessionId,
  sessionToken,
  patientLanguage,
  onClose
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [sessionStartTime] = useState<Date>(new Date());
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isConnected,
    isTranslating,
    sendMessage,
    endSession,
    deleteMessage
  } = useReceptionTranslation({
    sessionToken,
    patientLanguage,
    isStaff: true
  });

  const languageInfo = HEALTHCARE_LANGUAGES.find(l => l.code === patientLanguage);
  const patientUrl = `${window.location.origin}/reception-translate?session=${sessionToken}`;

  // Generate QR code
  useEffect(() => {
    QRCode.toDataURL(patientUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
  }, [patientUrl]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Speech recognition setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-GB';

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          sendMessage(finalTranscript);
          setTranscript('');
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current?.start();
        }
      };
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [sendMessage, isListening]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(patientUrl);
    setCopied(true);
    showToast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEndSession = async () => {
    await endSession(sessionId);
    onClose();
  };

  const playAudio = async (text: string, languageCode: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, languageCode }
      });
      
      if (error) throw error;
      
      if (data?.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        await audio.play();
      }
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  const handleDownloadReport = async () => {
    if (messages.length === 0) {
      showToast.error('No messages to include in report');
      return;
    }

    setIsGeneratingReport(true);
    try {
      await generateTranslationReportDocx({
        messages,
        patientLanguage,
        patientLanguageName: languageInfo?.name || patientLanguage,
        sessionStart: sessionStartTime,
        sessionEnd: new Date(),
      });
      showToast.success('Translation report downloaded successfully');
    } catch (error) {
      console.error('Report generation error:', error);
      showToast.error('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const renderMessage = (msg: TranslationMessage, index: number) => {
    const isStaffMessage = msg.speaker === 'staff';

    return (
      <div
        key={msg.id || index}
        className={`flex gap-4 ${isStaffMessage ? '' : 'flex-row-reverse'}`}
      >
        {/* English column */}
        <div className={`flex-1 ${isStaffMessage ? '' : 'text-right'}`}>
          <div className={`inline-block max-w-full rounded-lg p-3 ${
            isStaffMessage 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium">
                {isStaffMessage ? '🇬🇧 You said:' : '🇬🇧 Patient said (translated):'}
              </p>
              {isStaffMessage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => deleteMessage(msg.id)}
                  title="Delete message"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-lg">
              {isStaffMessage ? msg.originalText : msg.translatedText}
            </p>
          </div>
        </div>

        {/* Patient language column */}
        <div className={`flex-1 ${isStaffMessage ? 'text-right' : ''}`}>
          <div className={`inline-block max-w-full rounded-lg p-3 ${
            isStaffMessage 
              ? 'bg-secondary' 
              : 'bg-accent text-accent-foreground'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium">
                {languageInfo?.flag} {isStaffMessage ? 'Translated:' : 'Patient said:'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => playAudio(
                  isStaffMessage ? msg.translatedText : msg.originalText,
                  patientLanguage
                )}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-lg">
              {isStaffMessage ? msg.translatedText : msg.originalText}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Live Translation</h1>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Connected</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Waiting for patient</>
            )}
          </Badge>
          {languageInfo && (
            <Badge variant="outline">
              {languageInfo.flag} {languageInfo.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadReport}
            disabled={isGeneratingReport || messages.length === 0}
          >
            {isGeneratingReport ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Download Report
              </>
            )}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleEndSession}>
            <X className="h-4 w-4 mr-2" />
            End Session
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation panel */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Badge variant="outline" className="text-base px-3 py-1">
                🇬🇧 English (You)
              </Badge>
              <span className="text-muted-foreground">↔</span>
              <Badge variant="outline" className="text-base px-3 py-1">
                {languageInfo?.flag} {languageInfo?.name} (Patient)
              </Badge>
            </div>
          </div>

          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-lg">Waiting for conversation to start...</p>
                  <p className="text-sm mt-2">Click the microphone button to speak</p>
                </div>
              ) : (
                messages.map(renderMessage)
              )}

              {/* Live transcript */}
              {transcript && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="inline-block max-w-full rounded-lg p-3 bg-primary/50 text-primary-foreground animate-pulse">
                      <p className="text-sm font-medium mb-1">🎤 Listening...</p>
                      <p className="text-lg">{transcript}</p>
                    </div>
                  </div>
                  <div className="flex-1" />
                </div>
              )}

              {isTranslating && (
                <div className="text-center text-muted-foreground py-2">
                  Translating...
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Microphone control */}
          <div className="pt-4 flex justify-center">
            <Button
              size="lg"
              variant={isListening ? 'destructive' : 'default'}
              className="h-16 w-16 rounded-full"
              onClick={toggleListening}
            >
              {isListening ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {isListening ? 'Listening... Click to stop' : 'Click to start speaking'}
          </p>
        </div>

        {/* QR Code panel */}
        <div className="w-80 border-l p-6 flex flex-col items-center justify-center bg-muted/30">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Patient QR Code
          </h2>

          {qrCodeUrl && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <img src={qrCodeUrl} alt="Patient QR Code" className="w-48 h-48" />
              </CardContent>
            </Card>
          )}

          <p className="text-sm text-muted-foreground text-center mb-4">
            Ask the patient to scan this QR code with their phone camera
          </p>

          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? (
              <><Check className="h-4 w-4 mr-2" /> Copied!</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" /> Copy Link</>
            )}
          </Button>

          <div className="mt-6 p-4 rounded-lg bg-background border text-sm">
            <p className="font-medium mb-2">How it works:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Patient scans QR code</li>
              <li>You speak in English</li>
              <li>Patient sees translation</li>
              <li>Patient types/speaks reply</li>
              <li>You see English translation</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
