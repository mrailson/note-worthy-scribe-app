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
  consentGiven?: boolean;
  consentTimestamp?: Date;
  consentLanguage?: string;
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

  const startSession = useCallback(async (targetLanguageCode: string, targetLanguageName: string, consentGiven: boolean = false) => {
    try {
      console.log('🚀 Starting session with language:', { targetLanguageCode, targetLanguageName, consentGiven });
      setError(null);
      setIsActive(false); // Reset first

      // Ensure user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('❌ No authenticated session - cannot start manual translation session');
        toast.error('Please sign in to start a translation session');
        return;
      }
      
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

      const now = new Date();
      const sessionMetadata = {
        consentGiven,
        consentTimestamp: consentGiven ? now.toISOString() : null,
        consentLanguage: targetLanguageCode
      };

      // Create new session in database
      const { data: sessionData, error: sessionError } = await supabase
        .from('manual_translation_sessions')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          target_language_code: targetLanguageCode,
          target_language_name: targetLanguageName,
          session_start: now.toISOString(),
          is_active: true,
          total_exchanges: 0,
          average_accuracy: 0,
          average_confidence: 0,
          session_duration_seconds: 0,
          overall_safety_rating: 'safe' as const,
          session_metadata: sessionMetadata
        })
        .select()
        .maybeSingle();

      if (sessionError || !sessionData) {
        console.error('❌ Error creating session:', sessionError || 'No session returned');
        setError('Failed to start translation session');
        toast.error('Unable to start session (authentication required)');
        return;
      }

      console.log('✅ Session created:', sessionData);

      // Initialize language detection FIRST
      console.log('🔧 Initializing language detector...');
      languageDetectorRef.current = new LanguageDetector(targetLanguageCode, targetLanguageName);
      console.log('✅ Language detector initialized');

      // Set current session state
      const newSession: ManualTranslationSession = {
        id: sessionData.id,
        sessionTitle: `${targetLanguageName} Translation Session`,
        targetLanguageCode,
        targetLanguageName,
        totalExchanges: 0,
        sessionDurationSeconds: 0,
        averageAccuracy: 0,
        averageConfidence: 0,
        overallSafetyRating: 'safe',
        sessionStart: new Date(sessionData.session_start),
        isCompleted: false,
        entries: [],
        consentGiven: (sessionData.session_metadata as any)?.consentGiven || false,
        consentTimestamp: (sessionData.session_metadata as any)?.consentTimestamp ? new Date((sessionData.session_metadata as any).consentTimestamp) : undefined,
        consentLanguage: (sessionData.session_metadata as any)?.consentLanguage
      };

      setCurrentSession(newSession);
      setIsActive(true); // Set active BEFORE initializing speech recognition

      // Initialize speech recognition with dependency on currentSession
      console.log('🎙️ Initializing speech recognition...');
      const sessionSnapshot = newSession;
      speechRecognitionRef.current = new BrowserSpeechRecognition(
        (transcript: any) => {
          console.log('📝 Speech recognition callback received:', transcript);
          try {
            const text = (transcript?.text || '').trim();
            const isFinal = !!transcript?.isFinal;
            if (!text) {
              console.log('📝 Empty or whitespace transcript, ignoring');
              return;
            }
            if (!isFinal) {
              console.log('📝 Interim result, skipping:', text.substring(0, 50));
              return;
            }
            if (!languageDetectorRef.current) {
              console.warn('⚠️ Language detector not ready yet, buffering ignored');
              return;
            }
            // Use snapshot to avoid stale closure on currentSession
            processTranscript(text, sessionSnapshot);
          } catch (e) {
            console.error('❌ Error handling transcript:', e);
          }
        },
        (error: string) => {
          console.error('❌ Speech recognition error:', error);
          setError(`Speech recognition error: ${error}`);
          setIsListening(false);
        },
        (status: string) => {
          console.log('🎙️ Speech recognition status:', status);
        }
      );

      console.log('✅ Speech recognition initialized');
      await speechRecognitionRef.current?.setLanguage(targetLanguageCode);

      // Log consent to audit trail
      if (consentGiven) {
        await supabase.rpc('log_system_activity', {
          p_table_name: 'manual_translation_sessions',
          p_operation: 'CONSENT_OBTAINED',
          p_record_id: sessionData.id,
          p_new_values: {
            session_id: sessionData.id,
            consent_language: targetLanguageCode,
            consent_timestamp: now.toISOString(),
            language_name: targetLanguageName
          }
        });
      }
      
      console.log('🎉 Session started successfully!');
      
      // Auto-start listening after a brief delay to ensure all setup is complete
      setTimeout(() => {
        console.log('🎙️ Auto-starting listening...');
        if (speechRecognitionRef.current && !isListening) {
          startListening();
        }
      }, 1000); // Increased delay to ensure everything is ready

    } catch (error) {
      console.error('❌ Failed to start manual translation session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start session');
      toast.error('Failed to start translation session');
    }
  }, [isListening]);

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
    console.log('🎙️ Start listening called:', { 
      currentSession: !!currentSession, 
      speechRecognition: !!speechRecognitionRef.current, 
      isActive,
      isListening,
      languageDetector: !!languageDetectorRef.current
    });
    
    if (isListening) {
      console.log('ℹ️ Already listening, skipping start');
      return;
    }
    
    if (!isActive) {
      console.log('❌ Cannot start listening - session not active');
      toast.error('No active session');
      return;
    }
    
    if (!currentSession) {
      console.log('❌ Cannot start listening - no current session');
      toast.error('No active session');
      return;
    }
    
    if (!speechRecognitionRef.current) {
      console.log('❌ Cannot start listening - speech recognition not initialized');
      toast.error('Speech recognition not available');
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
      toast.success('🎙️ Listening started');
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      toast.error('Failed to start speech recognition');
    }
  }, [currentSession, isActive, isListening]);

  const handleSpeechResult = useCallback(async (text: string, isFinal: boolean) => {
    console.log('🔄 Processing speech result:', { 
      text, 
      isFinal, 
      hasCurrentSession: !!currentSession,
      hasLanguageDetector: !!languageDetectorRef.current,
      hasText: !!text.trim(),
      sessionId: currentSession?.id,
      targetLanguage: currentSession?.targetLanguageCode,
      isActive
    });
    
    // Enhanced requirement checking
    if (!isActive) {
      console.log('⚠️ Skipping speech result - session not active');
      return;
    }
    
    if (!currentSession) {
      console.log('⚠️ Skipping speech result - no current session');
      return;
    }
    
    if (!languageDetectorRef.current) {
      console.log('⚠️ Skipping speech result - language detector not initialized');
      return;
    }
    
    if (!text.trim()) {
      console.log('⚠️ Skipping speech result - empty text');
      return;
    }

    // Only process final results
    if (!isFinal) {
      console.log('📝 Interim result, skipping:', text.substring(0, 50));
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