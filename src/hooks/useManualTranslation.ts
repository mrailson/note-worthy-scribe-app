import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LanguageDetector, WebSpeechLanguageDetector } from '@/utils/languageDetection';
import { BrowserSpeechRecognition } from '@/utils/BrowserSpeechRecognition';

interface ManualTranslationEntry {
  id: string;
  exchangeNumber: number;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguageDetected: string;
  targetLanguage: string;
  detectionConfidence: number;
  translationAccuracy: number;
  translationConfidence: number;
  safetyFlag: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected: string[];
  processingTimeMs: number;
  timestamp: Date;
}

interface ManualTranslationSession {
  id: string;
  sessionTitle: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  totalExchanges: number;
  sessionDurationSeconds: number;
  averageAccuracy: number;
  averageConfidence: number;
  overallSafetyRating: 'safe' | 'warning' | 'unsafe';
  sessionStart: Date;
  sessionEnd?: Date;
  isCompleted: boolean;
  entries: ManualTranslationEntry[];
}

export const useManualTranslation = () => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentSession, setCurrentSession] = useState<ManualTranslationSession | null>(null);
  const [translations, setTranslations] = useState<ManualTranslationEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get speaker settings from localStorage
  const getSpeakerSettings = () => {
    const saved = localStorage.getItem('manual-translation-speaker-settings');
    return saved ? JSON.parse(saved) : { patient: true, gp: true };
  };
  
  const languageDetectorRef = useRef<LanguageDetector | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const webSpeechDetectorRef = useRef<WebSpeechLanguageDetector | null>(null);
  const exchangeCounterRef = useRef(0);

  // Initialize speech recognition
  useEffect(() => {
    console.log('🔧 Initializing WebSpeechLanguageDetector...');
    webSpeechDetectorRef.current = new WebSpeechLanguageDetector();
    console.log('✅ WebSpeechLanguageDetector initialized');
    
    // Check if speech recognition is supported
    const isSupported = webSpeechDetectorRef.current?.isSupported();
    console.log('🎙️ Speech recognition supported:', isSupported);
    
    return () => {
      speechRecognitionRef.current?.stopRecognition();
    };
  }, []);

  const startSession = useCallback(async (targetLanguageCode: string, targetLanguageName: string) => {
    try {
      console.log('🚀 Starting session with language:', { targetLanguageCode, targetLanguageName });
      setError(null);
      setIsActive(false); // Reset first
      
      // Stop any existing speech recognition first
      if (speechRecognitionRef.current) {
        console.log('🛑 Stopping existing speech recognition...');
        speechRecognitionRef.current.stopRecognition();
        setIsListening(false);
      }
      
      // Clear any previous session state
      setCurrentSession(null);
      setTranslations([]);
      exchangeCounterRef.current = 0;
      
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create new session in database
      const { data: sessionData, error: sessionError } = await supabase
        .from('manual_translation_sessions')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          target_language_code: targetLanguageCode,
          target_language_name: targetLanguageName,
          session_title: `Manual Translation - ${targetLanguageName}`,
          session_start: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Database session error:', sessionError);
        if (sessionError.message?.includes('JWT') || sessionError.message?.includes('401') || sessionError.message?.includes('Invalid Refresh Token')) {
          throw new Error('Authentication expired. Please refresh the page and log in again.');
        }
        throw sessionError;
      }

      console.log('📝 Session created in database:', sessionData);

      // Initialize session state
      const session: ManualTranslationSession = {
        id: sessionData.id,
        sessionTitle: sessionData.session_title,
        targetLanguageCode,
        targetLanguageName,
        totalExchanges: 0,
        sessionDurationSeconds: 0,
        averageAccuracy: 0,
        averageConfidence: 0,
        overallSafetyRating: 'safe',
        sessionStart: new Date(sessionData.session_start),
        isCompleted: false,
        entries: []
      };

      console.log('🎯 Setting current session:', session);
      setCurrentSession(session);

      // Initialize language detector with ONLY English and target language
      languageDetectorRef.current = new LanguageDetector(targetLanguageCode, targetLanguageName);
      console.log('🔧 LanguageDetector initialized');

      // Initialize speech recognition (create regardless; it self-checks support)
      speechRecognitionRef.current = new BrowserSpeechRecognition(
        (transcript) => {
          console.log('🎤 Speech recognition result:', transcript);
          // Use the current session state directly instead of handleSpeechResult callback
          const currentSessionState = session;
          if (currentSessionState && languageDetectorRef.current && transcript.text.trim() && transcript.isFinal) {
            console.log('✅ Processing final speech result immediately:', transcript.text);
            // Process the speech result inline to avoid callback dependency issues
            processTranscript(transcript.text, currentSessionState);
          }
        },
        (error) => {
          console.error('Speech recognition error:', error);
          toast.error('Speech recognition error: ' + error);
        },
        (status) => {
          console.log('Speech recognition status:', status);
        }
      );

      setIsActive(true);
      console.log('✅ Session started successfully for:', targetLanguageName);
      toast.success(`Manual translation session started for ${targetLanguageName}`);
      
      // Auto-start listening immediately after session initialization
      if (speechRecognitionRef.current) {
        try {
          console.log('🤖 Auto-starting speech recognition...');
          
          // Proactively request mic permission
          await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('✅ Microphone access confirmed for auto-start');
          
          await speechRecognitionRef.current.startRecognition();
          setIsListening(true);
          console.log('✅ Auto-started speech recognition successfully');
        } catch (autoStartError) {
          console.error('❌ Failed to auto-start listening:', autoStartError);
          // Don't show error toast here as the session started successfully
          // User can manually click Start Listening if needed
        }
      }
      
    } catch (error) {
      console.error('Failed to start manual translation session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start session');
      toast.error('Failed to start translation session');
    }
  }, []);

  // Inline processing function to avoid dependency issues
  const processTranscript = useCallback(async (text: string, sessionState: ManualTranslationSession) => {
    console.log('🌐 Starting translation process for:', text);
    setIsProcessing(true);
    
    try {
      // Detect language and determine speaker
      const detection = languageDetectorRef.current!.detectLanguage(text);
      console.log('🔍 Language detection result:', detection);
      
      const speaker = detection.suggestedSpeaker;
      
      // Determine source and target languages
      const sourceLanguage = detection.isEnglish ? 'en' : sessionState.targetLanguageCode;
      const targetLanguage = detection.isEnglish ? sessionState.targetLanguageCode : 'en';

      console.log('🔄 Translation direction:', {
        text: text.trim(),
        sourceLanguage,
        targetLanguage,
        speaker,
        sameLanguage: sourceLanguage === targetLanguage
      });

      let translatedText: string;
      let translationData: any = {
        accuracy: 100,
        confidence: 100,
        safetyFlag: 'safe',
        medicalTermsDetected: [],
        processingTimeMs: 0
      };

      // Check if source and target languages are the same
      if (sourceLanguage === targetLanguage) {
        console.log('⚠️ Same source and target language detected, skipping translation');
        translatedText = text.trim();
      } else {
        console.log('📡 Calling translation service:', {
          text: text.trim(),
          sourceLanguage,
          targetLanguage,
          speaker
        });

        // Call translation service
        const { data, error } = await supabase.functions.invoke('manual-translation-service', {
          body: {
            text: text.trim(),
            targetLanguage,
            sourceLanguage
          }
        });

        console.log('📥 Translation service response:', { data, error });

        if (error) throw error;

        translatedText = data.translatedText;
        translationData = data;
      }

      exchangeCounterRef.current++;

      // Create translation entry
      const entry: ManualTranslationEntry = {
        id: crypto.randomUUID(),
        exchangeNumber: exchangeCounterRef.current,
        speaker,
        originalText: text.trim(),
        translatedText: translatedText,
        originalLanguageDetected: sourceLanguage,
        targetLanguage,
        detectionConfidence: detection.confidence,
        translationAccuracy: translationData.accuracy,
        translationConfidence: translationData.confidence,
        safetyFlag: translationData.safetyFlag,
        medicalTermsDetected: translationData.medicalTermsDetected || [],
        processingTimeMs: translationData.processingTimeMs || 0,
        timestamp: new Date()
      };

      console.log('💾 Saving translation entry:', entry);

      // Save to database
      const { error: saveError } = await supabase
        .from('manual_translation_entries')
        .insert({
          session_id: sessionState.id,
          exchange_number: entry.exchangeNumber,
          speaker: entry.speaker,
          original_text: entry.originalText,
          translated_text: entry.translatedText,
          original_language_detected: entry.originalLanguageDetected,
          target_language: entry.targetLanguage,
          detection_confidence: entry.detectionConfidence,
          translation_accuracy: entry.translationAccuracy,
          translation_confidence: entry.translationConfidence,
          safety_flag: entry.safetyFlag,
          medical_terms_detected: entry.medicalTermsDetected,
          processing_time_ms: entry.processingTimeMs
        });

      if (saveError) {
        console.error('Failed to save translation entry:', saveError);
      } else {
        console.log('✅ Translation entry saved successfully');
      }

      // Update local state
      setTranslations(prev => [...prev, entry]);

      console.log('🎯 Translation completed successfully');

    } catch (error) {
      console.error('❌ Translation processing failed:', error);
      toast.error('Translation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    speechRecognitionRef.current?.stopRecognition();
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    console.log('🎙️ Start listening called:', { currentSession: !!currentSession, speechRecognition: !!speechRecognitionRef.current });
    
    if (!currentSession || !speechRecognitionRef.current) {
      toast.error('No active session or speech recognition not available');
      return;
    }

    try {
      setError(null);

      // Proactively request mic permission (improves reliability on some browsers)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access confirmed');
      } catch (permErr) {
        console.error('❌ Microphone permission error:', permErr);
        toast.error('Microphone permission denied');
        return;
      }

      console.log('🚀 Starting speech recognition...');
      await speechRecognitionRef.current.startRecognition();
      setIsListening(true);
      console.log('✅ Speech recognition started successfully');
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      toast.error('Failed to start speech recognition');
    }
  }, [currentSession]);

  const handleSpeechResult = useCallback(async (text: string, isFinal: boolean) => {
    console.log('🔄 Processing speech result:', { 
      text, 
      isFinal, 
      hasCurrentSession: !!currentSession,
      hasLanguageDetector: !!languageDetectorRef.current,
      hasText: !!text.trim(),
      sessionId: currentSession?.id,
      targetLanguage: currentSession?.targetLanguageCode
    });
    
    if (!currentSession || !languageDetectorRef.current || !text.trim()) {
      console.log('⚠️ Skipping speech result - missing requirements:', {
        hasCurrentSession: !!currentSession,
        hasLanguageDetector: !!languageDetectorRef.current,
        hasText: !!text.trim()
      });
      return;
    }

    // Only process final results
    if (!isFinal) {
      console.log('📝 Interim result, skipping:', text);
      return;
    }

    console.log('✅ Processing final speech result:', text);
    setIsProcessing(true);
    
    try {
      console.log('🌐 Starting translation process...');
      
      // Detect language and determine speaker
      const detection = languageDetectorRef.current.detectLanguage(text);
      console.log('🔍 Language detection result:', detection);
      
      const speaker = detection.suggestedSpeaker;
      const isToEnglish = detection.isEnglish ? false : true; // If detected English, translate to target language
      
      const sourceLanguage = detection.isEnglish ? 'en' : currentSession.targetLanguageCode;
      const targetLanguage = detection.isEnglish ? currentSession.targetLanguageCode : 'en';

      console.log('📡 Calling translation service:', {
        text: text.trim(),
        sourceLanguage,
        targetLanguage,
        speaker
      });

      // Call translation service
      const { data, error } = await supabase.functions.invoke('manual-translation-service', {
        body: {
          text: text.trim(),
          targetLanguage,
          sourceLanguage
        }
      });

      console.log('📥 Translation service response:', { data, error });

      if (error) throw error;

      exchangeCounterRef.current++;

      // Create translation entry
      const entry: ManualTranslationEntry = {
        id: crypto.randomUUID(),
        exchangeNumber: exchangeCounterRef.current,
        speaker,
        originalText: text.trim(),
        translatedText: data.translatedText,
        originalLanguageDetected: sourceLanguage,
        targetLanguage,
        detectionConfidence: detection.confidence,
        translationAccuracy: data.accuracy,
        translationConfidence: data.confidence,
        safetyFlag: data.safetyFlag,
        medicalTermsDetected: data.medicalTermsDetected || [],
        processingTimeMs: data.processingTimeMs || 1000,
        timestamp: new Date()
      };

      // Save to database
      const { error: insertError } = await supabase
        .from('manual_translation_entries')
        .insert({
          session_id: currentSession.id,
          exchange_number: entry.exchangeNumber,
          speaker: entry.speaker,
          original_text: entry.originalText,
          translated_text: entry.translatedText,
          original_language_detected: entry.originalLanguageDetected,
          target_language: entry.targetLanguage,
          detection_confidence: entry.detectionConfidence,
          translation_accuracy: entry.translationAccuracy,
          translation_confidence: entry.translationConfidence,
          safety_flag: entry.safetyFlag,
          medical_terms_detected: entry.medicalTermsDetected,
          processing_time_ms: entry.processingTimeMs,
        });

      if (insertError) throw insertError;

      // Update local state
      setTranslations(prev => [...prev, entry]);

      // Speak the translation using browser TTS with correct language
      if ('speechSynthesis' in window && data.translatedText) {
        const speakerSettings = getSpeakerSettings();
        const shouldSpeak = (speaker === 'gp' && speakerSettings.gp) || (speaker === 'patient' && speakerSettings.patient);
        
        if (shouldSpeak) {
          console.log('🗣️ Speaking translation in language:', targetLanguage, 'for speaker:', speaker);
          const utterance = new SpeechSynthesisUtterance(data.translatedText);
          
          // Set correct language for TTS
          if (targetLanguage === 'en') {
            utterance.lang = 'en-GB'; // British English
          } else {
            // Map language codes to proper TTS language codes
            const languageMap: Record<string, string> = {
              'de': 'de-DE',
              'fr': 'fr-FR', 
              'es': 'es-ES',
              'it': 'it-IT',
              'pt': 'pt-PT',
              'ru': 'ru-RU',
              'zh': 'zh-CN',
              'ar': 'ar-SA',
              'hi': 'hi-IN',
              'pl': 'pl-PL',
              'tr': 'tr-TR',
              'bn': 'bn-BD',
              'ur': 'ur-PK'
            };
            utterance.lang = languageMap[targetLanguage] || targetLanguage;
          }
          
          utterance.rate = 0.9;
          utterance.pitch = 1;
          utterance.volume = 0.8;
          
          // Stop any current speech before starting new one
          speechSynthesis.cancel();
          speechSynthesis.speak(utterance);
          
          console.log('🗣️ TTS started for language:', utterance.lang);
        } else {
          console.log('🔇 TTS disabled for speaker:', speaker);
        }
      }

      toast.success(`Translation: ${speaker === 'gp' ? '👨‍⚕️' : '👤'} ${text.substring(0, 30)}... → ${data.translatedText.substring(0, 30)}...`);

    } catch (error) {
      console.error('❌ Translation processing error:', error);
      setError(error instanceof Error ? error.message : 'Translation failed');
      toast.error('Translation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      console.log('✅ Translation processing completed');
      setIsProcessing(false);
    }
  }, [currentSession]);

  const endSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      const sessionEnd = new Date();
      const sessionDuration = Math.floor((sessionEnd.getTime() - currentSession.sessionStart.getTime()) / 1000);
      
      // Calculate session statistics
      const averageAccuracy = translations.length > 0 
        ? translations.reduce((sum, t) => sum + t.translationAccuracy, 0) / translations.length 
        : 0;
      
      const averageConfidence = translations.length > 0 
        ? translations.reduce((sum, t) => sum + t.translationConfidence, 0) / translations.length 
        : 0;

      const unsafeCount = translations.filter(t => t.safetyFlag === 'unsafe').length;
      const warningCount = translations.filter(t => t.safetyFlag === 'warning').length;
      
      const overallSafetyRating: 'safe' | 'warning' | 'unsafe' = 
        unsafeCount > 0 ? 'unsafe' : 
        warningCount > translations.length * 0.3 ? 'warning' : 'safe';

      // Update session in database
      const { error } = await supabase
        .from('manual_translation_sessions')
        .update({
          session_end: sessionEnd.toISOString(),
          session_duration_seconds: sessionDuration,
          total_exchanges: translations.length,
          average_accuracy: Math.round(averageAccuracy * 100) / 100,
          average_confidence: Math.round(averageConfidence * 100) / 100,
          overall_safety_rating: overallSafetyRating,
          is_completed: true
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      // Stop any ongoing speech recognition
      stopListening();
      
      // Update local state
      setCurrentSession(prev => prev ? {
        ...prev,
        sessionEnd,
        sessionDurationSeconds: sessionDuration,
        totalExchanges: translations.length,
        averageAccuracy,
        averageConfidence,
        overallSafetyRating,
        isCompleted: true,
        entries: translations
      } : null);

      setIsActive(false);
      toast.success('Manual translation session completed');

    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session properly');
    }
  }, [currentSession, translations, stopListening]);

  const clearSession = useCallback(() => {
    console.log('🧹 Clearing session state completely');
    setCurrentSession(null);
    setTranslations([]);
    setIsActive(false);
    setIsListening(false);
    setError(null);
    setIsProcessing(false);
    exchangeCounterRef.current = 0;
    
    // Clean up speech recognition
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stopRecognition();
      speechRecognitionRef.current = null;
    }
    
    // Clear language detector
    languageDetectorRef.current = null;
    
    console.log('✅ Session cleared completely');
  }, [currentSession, languageDetectorRef]);

  return {
    // Session state
    isActive,
    currentSession,
    translations,
    isListening,
    isProcessing,
    error,

    // Actions
    startSession,
    endSession,
    clearSession,
    startListening,
    stopListening,

    // Computed values
    sessionStats: currentSession ? {
      duration: currentSession.sessionEnd 
        ? Math.floor((currentSession.sessionEnd.getTime() - currentSession.sessionStart.getTime()) / 1000)
        : Math.floor((new Date().getTime() - currentSession.sessionStart.getTime()) / 1000),
      exchangeCount: translations.length,
      averageAccuracy: translations.length > 0 
        ? Math.round(translations.reduce((sum, t) => sum + t.translationAccuracy, 0) / translations.length)
        : 0,
      safetyStatus: translations.filter(t => t.safetyFlag === 'unsafe').length > 0 ? 'unsafe' : 
                   translations.filter(t => t.safetyFlag === 'warning').length > translations.length * 0.3 ? 'warning' : 'safe'
    } : null
  };
};