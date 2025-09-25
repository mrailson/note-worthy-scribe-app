import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LanguageDetector, WebSpeechLanguageDetector } from '@/utils/languageDetection';
import { EnhancedSpeechRecognition, TranscriptionService } from '@/utils/EnhancedSpeechRecognition';
import { useTranslationBuffering } from '@/hooks/useTranslationBuffering';

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
  const [transcriptionService, setTranscriptionService] = useState<TranscriptionService>('whisper');
  
  // Initialize translation buffering for pause detection
  const {
    isAudioBuffering,
    setIsAudioBuffering,
    incompleteMessageBuffer,
    setIncompleteMessageBuffer,
    lastProcessingTime,
    setLastProcessingTime,
    lastProcessingTimeRef,
    incompleteMessageBufferRef,
    bufferTimerRef,
    isCompleteSentence,
    resetBuffer
  } = useTranslationBuffering();
  
  // Get speaker settings from localStorage
  const getSpeakerSettings = () => {
    const saved = localStorage.getItem('manual-translation-speaker-settings');
    return saved ? JSON.parse(saved) : { patient: true, gp: true };
  };
  
  const languageDetectorRef = useRef<LanguageDetector | null>(null);
  const speechRecognitionRef = useRef<EnhancedSpeechRecognition | null>(null);
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

      // Initialize enhanced speech recognition with dependency on currentSession
      console.log('🎙️ Initializing enhanced speech recognition...');
      const sessionSnapshot = newSession;
      speechRecognitionRef.current = new EnhancedSpeechRecognition(
        (transcript) => {
          console.log('📝 Enhanced speech callback received:', transcript);
          try {
            const text = (transcript?.text || '').trim();
            const isFinal = !!transcript?.is_final;
            
            if (!text) {
              console.log('📝 Empty or whitespace transcript, ignoring');
              return;
            }
            
            if (!languageDetectorRef.current) {
              console.warn('⚠️ Language detector not ready yet, buffering ignored');
              return;
            }

            // Handle speech buffering with pause detection
            handleSpeechBuffering(text, isFinal, sessionSnapshot);
          } catch (e) {
            console.error('❌ Error handling transcript:', e);
          }
        },
        (error: string) => {
          console.error('❌ Enhanced speech recognition error:', error);
          setError(`Speech recognition error: ${error}`);
          setIsListening(false);
        },
        (status: string) => {
          console.log('🎙️ Enhanced speech recognition status:', status);
        },
        { 
          service: transcriptionService, 
          language: targetLanguageCode,
          autoFallback: true 
        }
      );

      console.log('✅ Enhanced speech recognition initialized');
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
      
      // EXPLICIT RULE: English = GP, Non-English = Patient (no exceptions)
      const speaker = detection.isEnglish ? 'gp' : 'patient';
      
      console.log('👤 Speaker assignment:', {
        detectedLanguage: detection.detectedLanguage,
        isEnglish: detection.isEnglish,
        suggestedSpeaker: detection.suggestedSpeaker,
        finalSpeaker: speaker,
        rule: detection.isEnglish ? 'English -> GP' : 'Non-English -> Patient'
      });
      
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

  // Handle speech buffering with pause detection
  const handleSpeechBuffering = useCallback((text: string, isFinal: boolean, sessionState: ManualTranslationSession) => {
    console.log('🎙️ Speech buffering:', { text: text.substring(0, 50), isFinal, bufferLength: incompleteMessageBuffer.length });
    
    // Filter out very short or low-quality segments
    if (text.length < 2) {
      console.log('📝 Text too short, ignoring:', text);
      return;
    }
    
    // Filter out repetitive punctuation patterns
    if (/^[.\s,!?]*$/.test(text)) {
      console.log('📝 Only punctuation/whitespace, ignoring:', text);
      return;
    }
    
    const currentTime = Date.now();
    lastProcessingTimeRef.current = currentTime;
    setLastProcessingTime(currentTime);
    
    if (!isFinal) {
      // For interim results, just log - don't process
      console.log('📝 Interim result, not processing:', text.substring(0, 50));
      return;
    }
    
    console.log('📝 Final result received, checking for buffering:', text);
    
    // Check if this is a complete sentence or meaningful segment
    const isComplete = isCompleteSentence(text);
    console.log('📝 Complete sentence check:', { text: text.substring(0, 50), isComplete });
    
    if (isComplete) {
      // Clear any existing timer
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      
      // Combine with any buffered text
      const finalText = incompleteMessageBuffer ? `${incompleteMessageBuffer} ${text}`.trim() : text;
      console.log('✅ Processing complete segment immediately:', finalText.substring(0, 50));
      
      // Reset buffer and process
      resetBuffer();
      processTranscript(finalText, sessionState);
    } else {
      // Buffer incomplete segments
      console.log('📝 Buffering incomplete segment:', text.substring(0, 50));
      setIsAudioBuffering(true);
      
      const newBuffer = incompleteMessageBuffer ? `${incompleteMessageBuffer} ${text}`.trim() : text;
      setIncompleteMessageBuffer(newBuffer);
      incompleteMessageBufferRef.current = newBuffer;
      
      // Clear existing timer
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
      }
      
      // Set timeout to process buffered content after pause
      bufferTimerRef.current = setTimeout(() => {
        console.log('⏰ Buffer timeout reached, processing buffered content:', incompleteMessageBufferRef.current.substring(0, 50));
        
        if (incompleteMessageBufferRef.current.trim().length > 1) {
          const bufferedText = incompleteMessageBufferRef.current;
          resetBuffer();
          processTranscript(bufferedText, sessionState);
        } else {
          resetBuffer();
        }
      }, 2500) as unknown as number; // 2.5 second timeout for processing buffered speech
    }
  }, [incompleteMessageBuffer, isCompleteSentence, resetBuffer, setIsAudioBuffering, setIncompleteMessageBuffer, setLastProcessingTime, lastProcessingTimeRef, bufferTimerRef]);

  const stopListening = useCallback(() => {
    speechRecognitionRef.current?.stopRecognition();
    setIsListening(false);
    
    // Clear any pending buffers when stopping
    resetBuffer();
  }, [resetBuffer]);

  const switchTranscriptionService = useCallback(async (service: TranscriptionService) => {
    console.log(`🔄 Switching transcription service to: ${service}`);
    setTranscriptionService(service);
    
    if (speechRecognitionRef.current && isActive) {
      await speechRecognitionRef.current.switchService(service);
    }
    
    toast.success(`Switched to ${service === 'deepgram' ? 'Deepgram' : 'Browser'} transcription`);
  }, [isActive]);

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

      console.log('🚀 Starting enhanced speech recognition...');
      await speechRecognitionRef.current.startRecognition();
      setIsListening(true);
      console.log('✅ Enhanced speech recognition started successfully');
      toast.success(`🎙️ Listening started (${transcriptionService === 'deepgram' ? 'Deepgram' : 'Browser'})`);
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      toast.error('Failed to start speech recognition');
    }
  }, [currentSession, isActive, isListening]);

  // This function is kept for backwards compatibility but is no longer used
  // Speech processing now goes through handleSpeechBuffering -> processTranscript

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
    
    // Clear buffering state
    resetBuffer();
    
    // Clean up speech recognition
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stopRecognition();
      speechRecognitionRef.current = null;
    }
    
    // Clear language detector
    languageDetectorRef.current = null;
    
    console.log('✅ Session cleared completely');
  }, [resetBuffer]);

  const updateTranslation = useCallback((index: number, updates: Partial<ManualTranslationEntry>) => {
    setTranslations(prev => prev.map((t, i) => 
      i === index ? { ...t, ...updates } : t
    ));
  }, []);

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
    switchTranscriptionService,
    updateTranslation,

    // Current service
    transcriptionService,

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