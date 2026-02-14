import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mic, MicOff, X, QrCode, Loader2, Check, Volume2, Pause, Play, Send,
  FileText, MoreVertical, Wifi, WifiOff, Smartphone, GraduationCap,
  ShieldX, AlertTriangle, MessageCircle, FileStack, Trash2
} from 'lucide-react';
import { LiveTranslationSetupModal } from '@/components/admin-dictate/LiveTranslationSetupModal';
import { useReceptionTranslation, TranslationMessage } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { generateTranslationReportDocx } from '@/utils/generateTranslationReportDocx';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { getWebSpeechLanguageCode } from '@/utils/webSpeechLanguages';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Reuse the localised label maps from the desktop view
const GP_PRACTICE_SAID: Record<string, string> = {
  en: "GP Practice said:", ar: "قالت العيادة:", zh: "诊所说：", fr: "Le cabinet médical a dit :",
  de: "Die Praxis sagte:", hi: "जीपी प्रैक्टिस ने कहा:", it: "Lo studio medico ha detto:",
  es: "La consulta médica dijo:", pl: "Gabinet lekarski powiedział:", pt: "A clínica disse:",
  ro: "Cabinetul medical a spus:", ru: "Клиника сказала:", tr: "Sağlık merkezi dedi:",
  ur: "جی پی پریکٹس نے کہا:", bn: "জিপি প্র্যাকটিস বলেছে:", pa: "ਜੀਪੀ ਪ੍ਰੈਕਟਿਸ ਨੇ ਕਿਹਾ:",
};

const PATIENT_SAID: Record<string, string> = {
  en: "Patient said:", ar: "قال المريض:", zh: "患者说：", fr: "Le patient a dit :",
  de: "Der Patient sagte:", hi: "मरीज ने कहा:", it: "Il paziente ha detto:",
  es: "El paciente dijo:", pl: "Pacjent powiedział:", pt: "O paciente disse:",
  ro: "Pacientul a spus:", ru: "Пациент сказал:", tr: "Hasta dedi:",
  ur: "مریض نے کہا:", bn: "রোগী বলেছে:", pa: "ਮਰੀਜ਼ ਨੇ ਕਿਹਾ:",
};

const PLAY_AUDIO: Record<string, string> = {
  en: "Play Audio", ar: "تشغيل الصوت", zh: "播放音频", fr: "Lire l'audio",
  de: "Audio abspielen", hi: "ऑडियो चलाएं", es: "Reproducir audio",
};

// ElevenLabs supported language codes
const ELEVENLABS_SUPPORTED = [
  'en', 'ar', 'zh', 'fr', 'de', 'hi', 'it', 'es', 'pl', 'pt', 'ro', 'ru',
  'tr', 'uk', 'vi', 'ja', 'ko', 'bg', 'cs', 'da', 'nl', 'el', 'hu', 'id',
  'sv', 'no', 'fi', 'he', 'th', 'tl', 'ms', 'sk', 'hr'
];

export const MobileReceptionTranslation: React.FC = () => {
  // Setup state
  const [showSetupModal, setShowSetupModal] = useState(true);
  const [session, setSession] = useState<{
    id: string; token: string; language: string;
    isTrainingMode?: boolean; trainingScenario?: string;
  } | null>(null);

  const handleSessionCreated = (sessionId: string, token: string, language: string, isTraining?: boolean, scenario?: string) => {
    setShowSetupModal(false);
    setSession({ id: sessionId, token, language, isTrainingMode: isTraining, trainingScenario: scenario });
  };

  const handleClose = () => {
    setSession(null);
    setShowSetupModal(true);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <LiveTranslationSetupModal
          isOpen={showSetupModal}
          onClose={() => window.history.back()}
          onSessionCreated={handleSessionCreated}
        />
      </div>
    );
  }

  return (
    <MobileTranslationSession
      sessionId={session.id}
      sessionToken={session.token}
      patientLanguage={session.language}
      isTrainingMode={session.isTrainingMode}
      trainingScenario={session.trainingScenario}
      onClose={handleClose}
    />
  );
};

// ── Active session component ──────────────────────────────────────
interface MobileTranslationSessionProps {
  sessionId: string;
  sessionToken: string;
  patientLanguage: string;
  isTrainingMode?: boolean;
  trainingScenario?: string;
  onClose: () => void;
}

const MobileTranslationSession: React.FC<MobileTranslationSessionProps> = ({
  sessionId, sessionToken, patientLanguage, isTrainingMode = false, trainingScenario = 'general_enquiry', onClose,
}) => {
  // Core hook
  const {
    messages, isConnected, isTranslating, patientConnected,
    contentWarning, blockedContent, sendMessage, endSession,
    deleteMessage, updateMessage, clearContentWarning, clearBlockedContent,
  } = useReceptionTranslation({ sessionToken, sessionId, patientLanguage, isStaff: true });

  const { practiceContext } = usePracticeContext();
  const practiceName = practiceContext?.practiceName || 'Our Practice';
  const languageInfo = HEALTHCARE_LANGUAGES.find(l => l.code === patientLanguage);

  // UI states
  const [speakerMode, setSpeakerMode] = useState<'staff' | 'patient'>('staff');
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [pendingSpeaker, setPendingSpeaker] = useState<'staff' | 'patient'>('staff');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [introSent, setIntroSent] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [translationMode, setTranslationMode] = useState<'live-chat' | 'document-translate'>('live-chat');
  const [isTrainingReplyLoading, setIsTrainingReplyLoading] = useState(false);

  // Audio states
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [loadingAudio, setLoadingAudio] = useState<Record<string, boolean>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Speech recognition refs
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const stoppedByUserRef = useRef(false);
  const speakerModeRef = useRef<'staff' | 'patient'>('staff');
  const lastInterimRef = useRef('');
  const transcriptRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMicPausedRef = useRef(false);

  const patientUrl = `https://gpnotewell.co.uk/reception-translate?session=${sessionToken}`;

  // Sync refs
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { speakerModeRef.current = speakerMode; }, [speakerMode]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Generate QR code
  useEffect(() => {
    QRCode.toDataURL(patientUrl, { width: 300, margin: 2 }).then(setQrCodeUrl);
  }, [patientUrl]);

  // Show blocked dialog
  useEffect(() => { if (blockedContent) setShowBlockedDialog(true); }, [blockedContent]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, isTranslating, transcript]);

  // Patient connected toast
  const prevPatientRef = useRef(false);
  useEffect(() => {
    if (patientConnected && !prevPatientRef.current) showToast.success('Patient has connected');
    prevPatientRef.current = patientConnected;
  }, [patientConnected]);

  // ── Speech Recognition Setup ──────────────────────────────────
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-GB';
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event: any) => {
      if (isMicPausedRef.current) return;
      let finalT = '', interimT = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalT += event.results[i][0].transcript + ' ';
        else interimT += event.results[i][0].transcript;
      }
      finalT = finalT.trim();
      lastInterimRef.current = interimT;

      if (finalT) {
        lastInterimRef.current = '';
        const isPatient = speakerModeRef.current === 'patient';
        setPendingSpeaker(isPatient ? 'patient' : 'staff');
        setPendingTranscript(prev => prev ? `${prev} ${finalT}` : finalT);
        if (!isPatient) setShowConfirmation(true);
        setTranscript('');
      } else if (interimT) {
        setTranscript(interimT);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        showToast.error('Microphone permission denied');
        setIsListening(false);
      }
    };

    recognitionRef.current.onstart = () => { isStartingRef.current = false; };

    recognitionRef.current.onend = () => {
      isStartingRef.current = false;
      if (isListeningRef.current && !stoppedByUserRef.current) {
        // Preserve patient interim
        if (speakerModeRef.current === 'patient') {
          const text = [lastInterimRef.current.trim(), transcriptRef.current.trim()].filter(Boolean).join(' ');
          if (text) {
            lastInterimRef.current = '';
            setPendingTranscript(prev => prev ? `${prev} ${text}` : text);
            setTranscript('');
          }
        }
        setTimeout(() => {
          if (isListeningRef.current && !isStartingRef.current && recognitionRef.current) {
            try {
              isStartingRef.current = true;
              const lang = speakerModeRef.current === 'staff' ? 'en-GB' : getWebSpeechLanguageCode(patientLanguage);
              recognitionRef.current.lang = lang;
              recognitionRef.current.start();
            } catch (e: any) {
              isStartingRef.current = false;
            }
          }
        }, speakerModeRef.current === 'patient' ? 10 : 150);
      }
    };

    return () => { stoppedByUserRef.current = true; recognitionRef.current?.stop(); };
  }, [patientLanguage]);

  // ── Toggle Listening ──────────────────────────────────────────
  const toggleListening = useCallback(async () => {
    if (isListening) {
      stoppedByUserRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (isStartingRef.current || isConnecting) return;

    try {
      setIsConnecting(true);
      await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!recognitionRef.current) {
        showToast.error('Speech recognition not supported');
        setIsConnecting(false);
        return;
      }

      stoppedByUserRef.current = false;
      isStartingRef.current = true;
      recognitionRef.current.lang = speakerMode === 'staff' ? 'en-GB' : getWebSpeechLanguageCode(patientLanguage);

      try {
        recognitionRef.current.start();
        setIsListening(true);
        if (!introSent) {
          const intro = `Welcome to ${practiceName}. We would like to use our translation service to help us communicate with you today. A staff member will control the session. When you see the large green microphone, you can speak naturally in your own language. When you have finished speaking, please indicate to the staff member and they will activate the translation. Are you happy for us to use this service?`;
          sendMessage(intro, 'staff');
          setIntroSent(true);
        }
      } catch (e: any) {
        isStartingRef.current = false;
        if (e?.name === 'InvalidStateError') setIsListening(true);
        else throw e;
      }
    } catch {
      showToast.error('Failed to start microphone');
      setIsListening(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isListening, isConnecting, introSent, practiceName, sendMessage, speakerMode, patientLanguage]);

  // ── Speaker Mode Toggle ───────────────────────────────────────
  const handleSpeakerModeChange = useCallback((newMode: 'staff' | 'patient') => {
    const prev = speakerModeRef.current;
    if (prev === 'patient' && newMode === 'staff') {
      const accumulated = [pendingTranscript?.trim(), lastInterimRef.current.trim(), transcript.trim()].filter(Boolean).join(' ');
      if (accumulated) {
        setPendingSpeaker('patient');
        setPendingTranscript(accumulated);
        setShowConfirmation(true);
      }
      lastInterimRef.current = '';
      setTranscript('');
    }

    setSpeakerMode(newMode);
    if (recognitionRef.current) {
      recognitionRef.current.lang = newMode === 'staff' ? 'en-GB' : getWebSpeechLanguageCode(patientLanguage);
      if (isListeningRef.current && !stoppedByUserRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    }
  }, [patientLanguage, pendingTranscript, transcript]);

  // ── Confirmation handlers ─────────────────────────────────────
  const handleConfirmSend = useCallback(async () => {
    if (!pendingTranscript) return;
    const result = await sendMessage(pendingTranscript, pendingSpeaker);
    if (result.blocked) { setShowConfirmation(false); return; }
    if (result.warning) showToast.warning('Message sent with warning');

    setPendingTranscript(null);
    setShowConfirmation(false);

    // Training mode AI reply
    if (isTrainingMode && pendingSpeaker === 'staff') {
      const history = messages.map(m => ({
        speaker: m.speaker,
        englishText: m.speaker === 'staff' ? m.originalText : (m.translatedText || m.originalText),
        translatedText: m.translatedText || '',
      }));
      history.push({ speaker: 'staff', englishText: pendingTranscript, translatedText: '' });
      setIsTrainingReplyLoading(true);
      setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('translation-training-reply', {
            body: { conversationHistory: history, patientLanguage, scenario: trainingScenario },
          });
          if (error) throw error;
          if (data?.patientReply) await sendMessage(data.patientReply, 'patient');
        } catch (err) {
          console.error('Training reply error:', err);
        } finally {
          setIsTrainingReplyLoading(false);
        }
      }, 800);
    }

    // Auto-switch speaker mode after send (300ms delay as per desktop)
    setTimeout(() => {
      handleSpeakerModeChange(pendingSpeaker === 'staff' ? 'patient' : 'staff');
    }, 300);
  }, [pendingTranscript, pendingSpeaker, sendMessage, isTrainingMode, messages, patientLanguage, trainingScenario, handleSpeakerModeChange]);

  const handleCancelSend = useCallback(() => {
    setPendingTranscript(null);
    setShowConfirmation(false);
  }, []);

  // ── End Session ───────────────────────────────────────────────
  const handleEndSession = async () => {
    await endSession(sessionId);
    onClose();
  };

  // ── Audio Playback ────────────────────────────────────────────
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return true;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return false;
      if (!audioContextRef.current) audioContextRef.current = new Ctx();
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      const buf = audioContextRef.current.createBuffer(1, 1, audioContextRef.current.sampleRate);
      const src = audioContextRef.current.createBufferSource();
      src.buffer = buf;
      src.connect(audioContextRef.current.destination);
      src.start(0);
      setAudioUnlocked(true);
      return true;
    } catch { return false; }
  }, [audioUnlocked]);

  const base64ToBlobUrl = useCallback((b64: string, mime = 'audio/mpeg') => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }, []);

  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setPlayingAudioId(null);
    }
    isMicPausedRef.current = false;
  }, []);

  const playAudioForMessage = useCallback(async (messageId: string, text: string, langCode: string) => {
    await unlockAudio();
    stopCurrentAudio();
    isMicPausedRef.current = true;

    const playFromUrl = async (url: string) => {
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.preload = 'auto';
      audio.load();
      audio.onended = () => { setPlayingAudioId(null); currentAudioRef.current = null; isMicPausedRef.current = false; };
      audio.onerror = () => { setPlayingAudioId(null); currentAudioRef.current = null; isMicPausedRef.current = false; showToast.error('Failed to play audio'); };
      setPlayingAudioId(messageId);
      await audio.play();
    };

    if (audioUrls[messageId]) { await playFromUrl(audioUrls[messageId]); return; }
    if (loadingAudio[messageId]) return;

    setLoadingAudio(prev => ({ ...prev, [messageId]: true }));
    try {
      const endpoint = ELEVENLABS_SUPPORTED.includes(langCode) ? 'gp-translation-tts' : 'text-to-speech';
      const { data, error } = await supabase.functions.invoke(endpoint, { body: { text, languageCode: langCode } });
      if (error) throw error;
      if (data?.audioContent) {
        const url = base64ToBlobUrl(data.audioContent);
        setAudioUrls(prev => ({ ...prev, [messageId]: url }));
        setLoadingAudio(prev => ({ ...prev, [messageId]: false }));
        await playFromUrl(url);
      } else {
        setLoadingAudio(prev => ({ ...prev, [messageId]: false }));
      }
    } catch {
      setLoadingAudio(prev => ({ ...prev, [messageId]: false }));
      showToast.error('Failed to load audio');
    }
  }, [audioUrls, loadingAudio, unlockAudio, stopCurrentAudio, base64ToBlobUrl]);

  // ── Report Download ───────────────────────────────────────────
  const handleDownloadReport = async () => {
    if (messages.length === 0) return;
    setIsGeneratingReport(true);
    try {
      await generateTranslationReportDocx({
        messages, patientLanguage,
        patientLanguageName: languageInfo?.name || patientLanguage,
        sessionStart: new Date(), sessionEnd: new Date(),
        practiceInfo: { name: practiceContext?.practiceName, address: practiceContext?.practiceAddress, logoUrl: practiceContext?.logoUrl },
      });
      showToast.success('Report downloaded');
    } catch { showToast.error('Failed to generate report'); }
    finally { setIsGeneratingReport(false); }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ WebkitOverflowScrolling: 'touch' as any }}>
      {/* Training Mode Banner */}
      {isTrainingMode && (
        <div className="bg-amber-500 text-white text-center py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" />
          TRAINING MODE — AI patient
        </div>
      )}

      {/* Header */}
      <div className="border-b px-3 py-2 flex items-center justify-between min-h-[48px]">
        <div className="flex items-center gap-2 min-w-0">
          {languageInfo && (
            <Badge variant="outline" className="text-xs shrink-0">
              {languageInfo.flag} {languageInfo.name}
            </Badge>
          )}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            {!isTrainingMode && (
              <span className={`text-xs ${patientConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
                {patientConnected ? '● Patient' : 'Waiting…'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isTrainingMode && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowQRModal(true)}>
              <QrCode className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadReport} disabled={isGeneratingReport || messages.length === 0}>
                <FileText className="h-4 w-4 mr-2" />
                Download Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEndConfirm(true)} className="text-destructive">
                <X className="h-4 w-4 mr-2" />
                End Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mode toggle pills */}
      <div className="flex items-center justify-center gap-1 p-2 bg-muted/30 border-b">
        <button
          onClick={() => setTranslationMode('live-chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
            translationMode === 'live-chat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Live Chat
        </button>
        <button
          onClick={() => setTranslationMode('document-translate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
            translationMode === 'document-translate' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          <FileStack className="h-3.5 w-3.5" />
          Document
        </button>
      </div>

      {/* Document translate placeholder */}
      {translationMode === 'document-translate' ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <FileStack className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Document translation is optimised for desktop.</p>
            <p className="text-xs text-muted-foreground mt-1">Please use a desktop device for document translation.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Chat Area */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="p-3 space-y-3 pb-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Mic className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Tap the microphone to start</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <MobileMessageBubble
                    key={msg.id || idx}
                    message={msg}
                    patientLanguage={patientLanguage}
                    languageFlag={languageInfo?.flag}
                    isLatest={idx === messages.length - 1}
                    isLoadingAudio={!!loadingAudio[msg.id]}
                    isPlayingAudio={playingAudioId === msg.id}
                    onPlayAudio={(text) => playAudioForMessage(msg.id, text, patientLanguage)}
                    onStopAudio={stopCurrentAudio}
                    onDelete={() => deleteMessage(msg.id)}
                  />
                ))
              )}

              {/* Live transcript */}
              {transcript && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 animate-pulse">
                  <p className="text-xs font-medium text-primary mb-1">🎤 Listening…</p>
                  <p className="text-sm">{transcript}</p>
                </div>
              )}

              {/* Confirmation popup */}
              {showConfirmation && pendingTranscript && (
                <div className={`p-3 rounded-xl border-2 ${
                  pendingSpeaker === 'patient'
                    ? 'bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-600'
                    : 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700'
                }`}>
                  <p className="text-xs font-medium mb-2">
                    {pendingSpeaker === 'patient' ? '🗣️ Patient:' : '🇬🇧 You:'}
                  </p>
                  <textarea
                    value={pendingTranscript}
                    onChange={(e) => setPendingTranscript(e.target.value)}
                    className="w-full text-sm bg-transparent border border-border rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    rows={Math.max(2, Math.ceil(pendingTranscript.length / 35))}
                    data-confirmation-textarea
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={handleCancelSend}>
                      <X className="h-3.5 w-3.5" /> Discard
                    </Button>
                    <Button size="sm" className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmSend}>
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                </div>
              )}

              {isTranslating && (
                <div className="text-center text-xs text-muted-foreground py-2">Translating…</div>
              )}

              {/* Training AI typing */}
              {isTrainingMode && isTrainingReplyLoading && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-600">
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  Patient is typing…
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Bottom Toolbar */}
          <div className="border-t bg-background pb-safe">
            {/* Speaker mode pills */}
            <div className="flex items-center justify-center gap-1 pt-2 px-3">
              <button
                onClick={() => handleSpeakerModeChange('staff')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[32px] ${
                  speakerMode === 'staff'
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                🇬🇧 You
              </button>
              <button
                onClick={() => handleSpeakerModeChange('patient')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[32px] ${
                  speakerMode === 'patient'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {languageInfo?.flag || '🗣️'} Patient
              </button>
            </div>

            {/* Mic button */}
            <div className="flex items-center justify-center py-3 px-4">
              <button
                onClick={toggleListening}
                disabled={isConnecting}
                className={`relative h-16 w-16 rounded-full flex items-center justify-center transition-all touch-manipulation ${
                  isListening
                    ? speakerMode === 'patient'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse'
                      : 'bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 animate-pulse'
                    : isConnecting
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-muted border-2 border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isConnecting ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : isListening ? (
                  <Mic className="h-7 w-7" />
                ) : (
                  <MicOff className="h-7 w-7" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-xs mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center text-sm">
              <QrCode className="h-4 w-4" />
              Patient QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <p className="text-sm font-medium text-primary mb-3">{practiceName}</p>
            {qrCodeUrl && (
              <div className="bg-white p-3 rounded-xl shadow-md mb-3">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{languageInfo?.flag} {languageInfo?.name}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(patientUrl);
                showToast.success('Link copied');
              }}
            >
              Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Session Confirmation */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End translation session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the patient and end the session. You can download a report first from the menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndSession} className="bg-destructive text-destructive-foreground">
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocked Content Dialog */}
      <AlertDialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" /> Message Blocked
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockedContent?.reason || 'This message was blocked due to inappropriate content.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setShowBlockedDialog(false); clearBlockedContent(); }}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Message Bubble Component ──────────────────────────────────────
interface MobileMessageBubbleProps {
  message: TranslationMessage;
  patientLanguage: string;
  languageFlag?: string;
  isLatest: boolean;
  isLoadingAudio: boolean;
  isPlayingAudio: boolean;
  onPlayAudio: (text: string) => void;
  onStopAudio: () => void;
  onDelete: () => void;
}

const MobileMessageBubble: React.FC<MobileMessageBubbleProps> = ({
  message, patientLanguage, languageFlag, isLatest,
  isLoadingAudio, isPlayingAudio, onPlayAudio, onStopAudio, onDelete,
}) => {
  const isStaff = message.speaker === 'staff';
  const englishText = isStaff ? message.originalText : message.translatedText;
  const patientText = isStaff ? message.translatedText : message.originalText;
  const langConfig = HEALTHCARE_LANGUAGES.find(l => l.code === patientLanguage);
  const hasTTS = langConfig?.hasElevenLabsVoice || langConfig?.hasGoogleTTSVoice;

  return (
    <div className={`rounded-xl overflow-hidden border ${
      isLatest
        ? isStaff ? 'ring-2 ring-blue-400 ring-offset-1' : 'ring-2 ring-slate-400 ring-offset-1'
        : ''
    } ${isStaff ? 'border-blue-200 dark:border-blue-800' : 'border-slate-300 dark:border-slate-600'}`}>
      {/* English section */}
      <div className={`p-3 ${isStaff ? 'bg-primary text-primary-foreground' : 'bg-slate-100 dark:bg-slate-800'}`}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium opacity-80">
            🇬🇧 {isStaff ? 'You said:' : (PATIENT_SAID[patientLanguage] || PATIENT_SAID['en'])}
          </p>
          {isStaff && (
            <button onClick={onDelete} className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed">{englishText}</p>
      </div>

      {/* Patient language section */}
      <div className={`p-3 ${isStaff
        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
        : 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300'
      }`}>
        <p className="text-xs font-medium opacity-70 mb-1">
          {languageFlag} {isStaff
            ? (GP_PRACTICE_SAID[patientLanguage] || GP_PRACTICE_SAID['en'])
            : (PATIENT_SAID[patientLanguage] || PATIENT_SAID['en'])}
        </p>
        <p className="text-base leading-relaxed">{patientText}</p>

        {/* Audio button - only for staff messages with TTS support */}
        {isStaff && hasTTS && (
          <Button
            variant={isPlayingAudio ? 'default' : 'outline'}
            size="sm"
            className="w-full mt-2 min-h-[40px]"
            onClick={() => isPlayingAudio ? onStopAudio() : onPlayAudio(patientText)}
            disabled={isLoadingAudio}
          >
            {isLoadingAudio ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
            ) : isPlayingAudio ? (
              <><Pause className="h-4 w-4 mr-2" /> Stop</>
            ) : (
              <><Volume2 className="h-4 w-4 mr-2" /> {PLAY_AUDIO[patientLanguage] || PLAY_AUDIO['en']}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
