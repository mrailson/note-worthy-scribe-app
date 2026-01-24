import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Mic,
  Loader2,
  MicOff, 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Wifi, 
  WifiOff,
  Volume2,
  Trash2,
  FileText,
  Maximize2
} from 'lucide-react';
import { useReceptionTranslation, TranslationMessage } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { generateTranslationReportDocx } from '@/utils/generateTranslationReportDocx';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';

// Translated instructions for patients
const QR_INSTRUCTIONS: Record<string, {
  scanInstruction: string;
  welcomeMessage: string;
}> = {
  en: {
    scanInstruction: 'Please scan this QR code with your phone camera',
    welcomeMessage: 'Welcome to {practice}. This service will help us communicate with you in your language.'
  },
  fr: {
    scanInstruction: 'Veuillez scanner ce code QR avec la caméra de votre téléphone',
    welcomeMessage: 'Bienvenue à {practice}. Ce service nous aidera à communiquer avec vous dans votre langue.'
  },
  es: {
    scanInstruction: 'Por favor escanee este código QR con la cámara de su teléfono',
    welcomeMessage: 'Bienvenido a {practice}. Este servicio nos ayudará a comunicarnos con usted en su idioma.'
  },
  pl: {
    scanInstruction: 'Proszę zeskanować ten kod QR aparatem telefonu',
    welcomeMessage: 'Witamy w {practice}. Ta usługa pomoże nam komunikować się z Państwem w Państwa języku.'
  },
  ro: {
    scanInstruction: 'Vă rugăm să scanați acest cod QR cu camera telefonului',
    welcomeMessage: 'Bine ați venit la {practice}. Acest serviciu ne va ajuta să comunicăm cu dumneavoastră în limba dumneavoastră.'
  },
  pt: {
    scanInstruction: 'Por favor, digitalize este código QR com a câmara do seu telemóvel',
    welcomeMessage: 'Bem-vindo a {practice}. Este serviço irá ajudar-nos a comunicar consigo na sua língua.'
  },
  ar: {
    scanInstruction: 'يرجى مسح رمز QR هذا بكاميرا هاتفك',
    welcomeMessage: 'مرحبًا بكم في {practice}. ستساعدنا هذه الخدمة على التواصل معكم بلغتكم.'
  },
  bn: {
    scanInstruction: 'অনুগ্রহ করে আপনার ফোনের ক্যামেরা দিয়ে এই QR কোডটি স্ক্যান করুন',
    welcomeMessage: '{practice}-এ স্বাগতম। এই পরিষেবাটি আমাদের আপনার ভাষায় আপনার সাথে যোগাযোগ করতে সাহায্য করবে।'
  },
  gu: {
    scanInstruction: 'કૃપા કરીને તમારા ફોનના કેમેરાથી આ QR કોડ સ્કેન કરો',
    welcomeMessage: '{practice}માં સ્વાગત છે. આ સેવા અમને તમારી ભાષામાં તમારી સાથે વાતચીત કરવામાં મદદ કરશે.'
  },
  hi: {
    scanInstruction: 'कृपया अपने फोन के कैमरे से इस QR कोड को स्कैन करें',
    welcomeMessage: '{practice} में आपका स्वागत है। यह सेवा हमें आपकी भाषा में आपसे संवाद करने में मदद करेगी।'
  },
  pa: {
    scanInstruction: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਫ਼ੋਨ ਦੇ ਕੈਮਰੇ ਨਾਲ ਇਸ QR ਕੋਡ ਨੂੰ ਸਕੈਨ ਕਰੋ',
    welcomeMessage: '{practice} ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਇਹ ਸੇਵਾ ਸਾਨੂੰ ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰੇਗੀ।'
  },
  ur: {
    scanInstruction: 'براہ کرم اپنے فون کے کیمرے سے اس QR کوڈ کو اسکین کریں',
    welcomeMessage: '{practice} میں خوش آمدید۔ یہ سروس ہمیں آپ کی زبان میں آپ سے بات چیت کرنے میں مدد کرے گی۔'
  },
  zh: {
    scanInstruction: '请用手机摄像头扫描此二维码',
    welcomeMessage: '欢迎来到{practice}。这项服务将帮助我们用您的语言与您交流。'
  },
  'zh-TW': {
    scanInstruction: '請用手機相機掃描此二維碼',
    welcomeMessage: '歡迎來到{practice}。這項服務將幫助我們用您的語言與您交流。'
  },
  so: {
    scanInstruction: 'Fadlan sawir koodhkan QR-ga kamaradda telefoonkaaga',
    welcomeMessage: 'Ku soo dhawoow {practice}. Adeeggan wuxuu naga caawin doonaa inaan kugula xiriirno luqaddaada.'
  },
  ti: {
    scanInstruction: 'በጃኻ ብካመራ ተሌፎንካ እዚ QR ኮድ ስካን ግበር',
    welcomeMessage: 'ናብ {practice} እንቋዕ ብደሓን መጻእካ። እዚ ኣገልግሎት ብቋንቋኻ ምሳኻ ንምርኻብ ክሕግዘና እዩ።'
  },
  tr: {
    scanInstruction: 'Lütfen bu QR kodunu telefonunuzun kamerasıyla tarayın',
    welcomeMessage: '{practice}\'a hoş geldiniz. Bu hizmet sizinle kendi dilinizde iletişim kurmamıza yardımcı olacaktır.'
  },
  it: {
    scanInstruction: 'Si prega di scansionare questo codice QR con la fotocamera del telefono',
    welcomeMessage: 'Benvenuto a {practice}. Questo servizio ci aiuterà a comunicare con Lei nella Sua lingua.'
  },
  de: {
    scanInstruction: 'Bitte scannen Sie diesen QR-Code mit Ihrer Handykamera',
    welcomeMessage: 'Willkommen bei {practice}. Dieser Service wird uns helfen, in Ihrer Sprache mit Ihnen zu kommunizieren.'
  },
  ru: {
    scanInstruction: 'Пожалуйста, отсканируйте этот QR-код камерой телефона',
    welcomeMessage: 'Добро пожаловать в {practice}. Этот сервис поможет нам общаться с вами на вашем языке.'
  },
  fa: {
    scanInstruction: 'لطفاً این کد QR را با دوربین گوشی خود اسکن کنید',
    welcomeMessage: 'به {practice} خوش آمدید. این سرویس به ما کمک می‌کند تا به زبان شما با شما ارتباط برقرار کنیم.'
  },
  ku: {
    scanInstruction: 'Ji kerema xwe vê koda QR-ê bi kameraya têlefona xwe bişopîne',
    welcomeMessage: 'Tu bi xêr hatî {practice}. Ev xizmet dê ji me re bibe alîkar ku em bi zimanê te bi te re têkiliyê daynin.'
  },
  vi: {
    scanInstruction: 'Vui lòng quét mã QR này bằng camera điện thoại của bạn',
    welcomeMessage: 'Chào mừng bạn đến {practice}. Dịch vụ này sẽ giúp chúng tôi giao tiếp với bạn bằng ngôn ngữ của bạn.'
  },
  th: {
    scanInstruction: 'กรุณาสแกน QR code นี้ด้วยกล้องโทรศัพท์ของคุณ',
    welcomeMessage: 'ยินดีต้อนรับสู่ {practice} บริการนี้จะช่วยให้เราสื่อสารกับคุณในภาษาของคุณ'
  },
  tl: {
    scanInstruction: 'Pakiscan ang QR code na ito gamit ang camera ng iyong telepono',
    welcomeMessage: 'Maligayang pagdating sa {practice}. Ang serbisyong ito ay makakatulong sa amin na makipag-usap sa iyo sa iyong wika.'
  },
  ne: {
    scanInstruction: 'कृपया तपाईंको फोनको क्यामेराले यो QR कोड स्क्यान गर्नुहोस्',
    welcomeMessage: '{practice}मा स्वागत छ। यो सेवाले हामीलाई तपाईंको भाषामा तपाईंसँग कुराकानी गर्न मद्दत गर्नेछ।'
  },
  sw: {
    scanInstruction: 'Tafadhali scan msimbo huu wa QR kwa kamera ya simu yako',
    welcomeMessage: 'Karibu {practice}. Huduma hii itatusaidia kuwasiliana nawe kwa lugha yako.'
  },
  am: {
    scanInstruction: 'እባክዎ ይህንን QR ኮድ በስልክዎ ካሜራ ይቃኙ',
    welcomeMessage: 'ወደ {practice} እንኳን በደህና መጡ። ይህ አገልግሎት በእርስዎ ቋንቋ ከእርስዎ ጋር ለመገናኘት ይረዳናል።'
  }
};

const getQRInstructions = (langCode: string, practiceName: string) => {
  const instructions = QR_INSTRUCTIONS[langCode] || QR_INSTRUCTIONS['en'];
  return {
    scanInstruction: instructions.scanInstruction,
    welcomeMessage: instructions.welcomeMessage.replace('{practice}', practiceName || 'our practice')
  };
};

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
  const [largeQrCodeUrl, setLargeQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [sessionStartTime] = useState<Date>(new Date());
  const [showExpandedQR, setShowExpandedQR] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const stoppedByUserRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { practiceContext } = usePracticeContext();
  const practiceName = practiceContext?.practiceName || 'Our Practice';

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

  // Generate QR codes (small and large versions)
  useEffect(() => {
    // Small QR for sidebar
    QRCode.toDataURL(patientUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
    
    // Large QR for expanded modal
    QRCode.toDataURL(patientUrl, {
      width: 400,
      margin: 3,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setLargeQrCodeUrl);
  }, [patientUrl]);
  
  // Get localized instructions
  const qrInstructions = getQRInstructions(patientLanguage, practiceName);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Keep refs in sync with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Speech recognition setup - create instance once
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-GB';
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event: any) => {
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

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      switch (event.error) {
        case 'no-speech':
          // Non-fatal - continue listening
          console.log('No speech detected, continuing...');
          break;
        case 'aborted':
          // Happens on restart, not a real error
          console.log('Recognition aborted (likely restart)');
          break;
        case 'not-allowed':
          showToast.error('Microphone permission denied');
          setIsListening(false);
          isListeningRef.current = false;
          break;
        case 'network':
          showToast.error('Network error during speech recognition');
          break;
        default:
          console.error('Unhandled speech error:', event.error);
      }
    };

    recognitionRef.current.onstart = () => {
      console.log('✅ Speech recognition started');
      isStartingRef.current = false;
    };

    recognitionRef.current.onend = () => {
      isStartingRef.current = false;
      
      // Only restart if still supposed to be listening and not stopped by user
      if (isListeningRef.current && !stoppedByUserRef.current) {
        console.log('Speech recognition ended, restarting...');
        setTimeout(() => {
          if (isListeningRef.current && !isStartingRef.current && recognitionRef.current) {
            try {
              isStartingRef.current = true;
              recognitionRef.current.start();
            } catch (e: any) {
              isStartingRef.current = false;
              if (e?.name !== 'InvalidStateError' && !`${e}`.includes('already started')) {
                console.warn('Restart failed:', e);
              }
            }
          }
        }, 300);
      } else {
        console.log('Speech recognition ended');
      }
    };

    return () => {
      stoppedByUserRef.current = true;
      recognitionRef.current?.stop();
    };
  }, [sendMessage]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      // Stop listening
      stoppedByUserRef.current = true;
      isStartingRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Prevent double-starts
    if (isStartingRef.current || isConnecting) {
      console.log('Already starting, ignoring');
      return;
    }

    try {
      setIsConnecting(true);
      
      // Pre-flight: ensure microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone permission granted');
      } catch (permErr) {
        console.error('❌ Microphone permission error:', permErr);
        showToast.error('Microphone permission denied or unavailable');
        setIsConnecting(false);
        return;
      }

      // Check if recognition is supported
      if (!recognitionRef.current) {
        showToast.error('Speech recognition not supported in this browser');
        setIsConnecting(false);
        return;
      }

      // Start recognition
      stoppedByUserRef.current = false;
      isStartingRef.current = true;
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e: any) {
        isStartingRef.current = false;
        if (e?.name === 'InvalidStateError' || `${e}`.includes('already started')) {
          console.warn('Recognition already started, setting state');
          setIsListening(true);
        } else {
          throw e;
        }
      }
    } catch (error: any) {
      console.error('Failed to start speech recognition:', error);
      showToast.error('Failed to start microphone');
      setIsListening(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isListening, isConnecting]);

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
        practiceInfo: {
          name: practiceContext?.practiceName,
          address: practiceContext?.practiceAddress,
          logoUrl: practiceContext?.logoUrl,
        },
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
              variant={isListening ? 'destructive' : isConnecting ? 'secondary' : 'default'}
              className="h-16 w-16 rounded-full"
              onClick={toggleListening}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isListening ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {isConnecting ? 'Connecting...' : isListening ? 'Listening... Click to stop' : 'Click to start speaking'}
          </p>
        </div>

        {/* QR Code panel */}
        <div className="w-72 border-l p-4 flex flex-col items-center bg-muted/30 overflow-y-auto min-h-0">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Patient QR Code
          </h2>

          {qrCodeUrl && (
            <Card
              className="mb-3 cursor-pointer transition-transform hover:scale-105 group relative overflow-hidden"
              onClick={() => setShowExpandedQR(true)}
            >
              <CardContent className="p-3">
                <img
                  src={qrCodeUrl}
                  alt="Patient QR Code"
                  className="block w-36 h-36"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg">
                  <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions in patient's language */}
          <div className="mb-3 p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center w-full">
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-1">
              {languageInfo?.flag} {languageInfo?.name}
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              {qrInstructions.scanInstruction}
            </p>
          </div>

          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleCopyLink}>
              {copied ? (
                <><Check className="h-3 w-3 mr-1" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> Copy Link</>
              )}
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowExpandedQR(true)}>
              <Maximize2 className="h-3 w-3 mr-1" />
              Expand
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-background border text-xs w-full">
            <p className="font-medium mb-1">How it works:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              <li>Patient scans QR code</li>
              <li>You speak in English</li>
              <li>Patient sees translation</li>
              <li>Patient types/speaks reply</li>
              <li>You see English translation</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Expanded QR Code Modal */}
      <Dialog open={showExpandedQR} onOpenChange={setShowExpandedQR}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <QrCode className="h-5 w-5" />
              Patient's Language
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-6">
            {/* Practice name */}
            <p className="text-lg font-semibold text-primary mb-4">{practiceName}</p>
            
            {/* Large QR Code */}
            {largeQrCodeUrl && (
              <div className="bg-white p-4 rounded-xl shadow-lg mb-6">
                <img src={largeQrCodeUrl} alt="Patient QR Code" className="w-72 h-72" />
              </div>
            )}
            
            {/* Instructions in patient's language - prominent */}
            <div className="w-full max-w-sm p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border border-violet-200 dark:border-violet-800 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-2xl">{languageInfo?.flag}</span>
                <span className="font-semibold text-violet-700 dark:text-violet-300">{languageInfo?.name}</span>
              </div>
              <p className="text-base text-violet-800 dark:text-violet-200 mb-3 font-medium">
                {qrInstructions.scanInstruction}
              </p>
              <p className="text-sm text-violet-600 dark:text-violet-400">
                {qrInstructions.welcomeMessage}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
