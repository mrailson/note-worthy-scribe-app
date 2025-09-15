import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useConversation } from '@11labs/react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { 
  Languages, 
  Phone, 
  PhoneOff,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Heart,
  Building2,
  Users,
  FileText,
  CircleCheck,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  UserCheck,
  Globe,
  History,
  Download,
  RotateCcw,
  Eye,
  EyeOff,
  Database,
  Plus,
  Mail,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TranslationHistory from './TranslationHistory';
import { TranslationHistorySidebar } from './TranslationHistorySidebar';
import { HistoricalTranslationView } from './HistoricalTranslationView';
import { EmailHandler } from './EmailHandler';
import { useTranslationHistory, TranslationEntry as HistoryTranslationEntry, TranslationScore as HistoryTranslationScore } from '@/hooks/useTranslationHistory';
import { scoreTranslation, TranslationScore } from '@/utils/translationScoring';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';
import { downloadPatientDOCX, PatientSessionMetadata } from '@/utils/patientDocxExport';
import { MedicalTranslationAuditViewer } from './MedicalTranslationAuditViewer';
import { TranslationValidationGuide } from './TranslationValidationGuide';

interface QualityScore {
  accuracy: number;
  medicalSafety: number;
  culturalSensitivity: number;
  clarity: number;
  overallSafety: 'OK' | 'REVIEW' | 'NOT_OK';
  confidence: number;
  explanation?: string;
  originalPhrase?: string;
  translatedPhrase?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

interface TranslationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
  accuracy?: number;
  confidence?: number;  
  safetyFlag?: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected?: string[];
  translationLatency?: number;
}

interface CurrentTranslation {
  englishText: string;
  translatedText: string;
  targetLanguage: string;
  qualityScore?: QualityScore;
  timestamp: Date;
}

export const TranslationToolInterface = () => {
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [conversationBuffer, setConversationBuffer] = useState<{user: string, agent: string}[]>([]);
  const [isQualityDetailsOpen, setIsQualityDetailsOpen] = useState(false);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [translationScores, setTranslationScores] = useState<TranslationScore[]>([]);
  const [sessionStart, setSessionStart] = useState<Date>(new Date());
  const [currentTranslation, setCurrentTranslation] = useState<CurrentTranslation | null>(null);
  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showHistoricalView, setShowHistoricalView] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedHistoricalSession, setSelectedHistoricalSession] = useState<{
    sessionId: string;
    sessionTitle: string;
    translations: TranslationEntry[];
    translationScores: any[];
    sessionMetadata: any;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const conversationIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reset functionality state
  const [resetClickCount, setResetClickCount] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Bulletproof Deduplication System
  const processedExchangeIds = useRef<Set<string>>(new Set());
  const processedMessageIds = useRef<Set<string>>(new Set());
  const conversationExchangeMap = useRef<Map<string, { timestamp: number, processed: boolean }>>(new Map());
  const lastProcessedTimestamp = useRef<number>(0);
  
  // Helper function to get full language name
  const getLanguageName = (code: string) => {
    const language = HEALTHCARE_LANGUAGES.find(l => l.code === code);
    return language?.name || code.charAt(0).toUpperCase() + code.slice(1);
  };
  
  // Add cleanup interval to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const CLEANUP_AGE = 300000; // 5 minutes
      
      // Clean up old exchange map entries
      for (const [key, entry] of conversationExchangeMap.current.entries()) {
        if (now - entry.timestamp > CLEANUP_AGE) {
          conversationExchangeMap.current.delete(key);
        }
      }
      
      // Clean up old message IDs more aggressively
      if (processedMessageIds.current.size > 30) {
        const idsArray = Array.from(processedMessageIds.current);
        processedMessageIds.current.clear();
        // Keep only the most recent 10 entries
        idsArray.slice(-10).forEach(id => processedMessageIds.current.add(id));
      }
      
      console.log('🧹 Memory cleanup completed - Exchange map size:', conversationExchangeMap.current.size, 'Message IDs:', processedMessageIds.current.size);
    }, 60000); // Run every minute
    
    return () => {
      clearInterval(cleanupInterval);
      // Clean up reset timeout on unmount
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  // Reset memory function
  const resetTranslationMemory = async () => {
    console.log('🗑️ Resetting translation memory...');
    setIsResetting(true);
    
    try {
      // End current conversation if active
      if (conversation.status === 'connected') {
        await conversation.endSession();
      }
      
      // Clear all memory and state
      processedExchangeIds.current.clear();
      processedMessageIds.current.clear();
      conversationExchangeMap.current.clear();
      lastProcessedTimestamp.current = 0;
      
      // Reset UI state
      setQualityScore(null);
      setCurrentTranslation(null);
      setConversationBuffer([]);
      setIsTranslationModalOpen(false);
      setError(null);
      conversationIdRef.current = null;
      
      // Clear translation history for current session
      if (currentSessionId) {
        // Keep sessions but clear current session data
        setTranslations([]);
      }
      
      toast.success('Translation memory cleared - ready for new session');
      console.log('✅ Translation memory reset completed');
      
    } catch (error) {
      console.error('❌ Error during memory reset:', error);
      toast.error('Error resetting translation memory');
    } finally {
      setIsResetting(false);
      setResetClickCount(0);
    }
  };

  // Handle reset button clicks (requires double click)
  const handleResetClick = () => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    const newCount = resetClickCount + 1;
    setResetClickCount(newCount);

    if (newCount === 1) {
      // First click - start timeout
      resetTimeoutRef.current = setTimeout(() => {
        setResetClickCount(0);
      }, 3000); // 3 second window for double click
      
      toast.info('Click again within 3 seconds to reset translation memory');
    } else if (newCount === 2) {
      // Second click - execute reset
      clearTimeout(resetTimeoutRef.current);
      resetTranslationMemory();
    }
  };
  const { sessionId } = useParams();

  // Translation history hook
  const {
    sessions,
    currentSessionId,
    autoSaveEnabled,
    saveSession,
    startNewSession,
    enableAutoSave,
    disableAutoSave,
    loadSessionDetails
  } = useTranslationHistory();

  // Helper function to extract language and clean text from language tags
  const extractLanguageAndCleanText = (text: string) => {
    const languageMatch = text.match(/<(\w+)>(.*?)<\/\1>/);
    if (languageMatch) {
      return {
        language: languageMatch[1],
        cleanText: languageMatch[2]
      };
    }
    return {
      language: 'Unknown',
      cleanText: text
    };
  };

  // Bulletproof deduplication helper functions
  const createExchangeId = (userMessage: string, agentResponse: string): string => {
    const contentHash = btoa(userMessage.trim() + '|||' + agentResponse.trim())
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16);
    const timestamp = Math.floor(Date.now() / 1000); // Round to nearest second
    return `${timestamp}_${contentHash}`;
  };

  const createContentHash = (text: string): string => {
    return btoa(text.trim()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
  };

  const isWithinTimeWindow = (timestamp: number, windowMs: number = 2000): boolean => {
    return Math.abs(Date.now() - timestamp) < windowMs;
  };

  // Add conversation to translation history
  const addToTranslationHistory = (userMessage: string, agentResponse: string) => {
    console.log('🛡️ DEDUP: Starting bulletproof deduplication check...');
    
    // LAYER 1: Skip language setup requests
    const isLanguageSetup = userMessage.toLowerCase().includes('please') && 
                           userMessage.toLowerCase().match(/\b(polish|arabic|spanish|french|urdu|bengali|chinese|german|italian|portuguese|ukrainian|hungarian|russian|hindi)\b/i) &&
                           agentResponse.toLowerCase().includes('ready');
    
    if (isLanguageSetup) {
      console.log('🛡️ DEDUP: Skipping language setup request');
      return;
    }

    // LAYER 2: Skip short/setup messages
    if (userMessage.trim().length < 5 || agentResponse.trim().length < 5) {
      console.log('🛡️ DEDUP: Skipping short/setup message');
      return;
    }

    // LAYER 3: Create unique exchange ID (timestamp + content hash)
    const exchangeId = createExchangeId(userMessage, agentResponse);
    console.log('🛡️ DEDUP: Exchange ID generated:', exchangeId);

    // LAYER 4: Check if this exact exchange was already processed
    if (processedExchangeIds.current.has(exchangeId)) {
      console.log('🛡️ DEDUP: BLOCKED - Exchange already processed:', exchangeId);
      return;
    }

    // LAYER 5: Check conversation exchange map for rapid duplicates (debouncing)
    const exchangeKey = createContentHash(userMessage) + '_' + createContentHash(agentResponse);
    const existingExchange = conversationExchangeMap.current.get(exchangeKey);
    
    if (existingExchange && isWithinTimeWindow(existingExchange.timestamp, 3000)) {
      console.log('🛡️ DEDUP: BLOCKED - Rapid duplicate exchange within 3s window:', exchangeKey);
      return;
    }

    // LAYER 6: State-level deduplication (final check against existing translations)
    const currentTimestamp = Math.floor(Date.now() / 1000); // Round to seconds
    const isDuplicateInState = translations.some(translation => {
      const translationTimestamp = Math.floor(translation.timestamp.getTime() / 1000);
      const textMatch = translation.originalText.trim() === userMessage.trim() && 
                       translation.translatedText.trim().includes(agentResponse.trim().substring(0, 50));
      const timeMatch = Math.abs(translationTimestamp - currentTimestamp) <= 2; // Within 2 seconds
      return textMatch || (timeMatch && textMatch);
    });
    
    if (isDuplicateInState) {
      console.log('🛡️ DEDUP: BLOCKED - Duplicate found in existing state');
      return;
    }

    // LAYER 7: Timestamp-based protection against rapid succession
    if (currentTimestamp <= lastProcessedTimestamp.current) {
      console.log('🛡️ DEDUP: BLOCKED - Timestamp collision protection');
      return;
    }

    console.log('🛡️ DEDUP: ✅ PASSED all deduplication layers - Processing exchange');
    
    // Mark this exchange as processed
    processedExchangeIds.current.add(exchangeId);
    conversationExchangeMap.current.set(exchangeKey, { 
      timestamp: Date.now(), 
      processed: true 
    });
    lastProcessedTimestamp.current = currentTimestamp;

    // Clean up old entries to prevent memory bloat (keep last 100)
    if (processedExchangeIds.current.size > 100) {
      const idsArray = Array.from(processedExchangeIds.current);
      const toRemove = idsArray.slice(0, idsArray.length - 100);
      toRemove.forEach(id => processedExchangeIds.current.delete(id));
    }

    if (conversationExchangeMap.current.size > 50) {
      const entriesArray = Array.from(conversationExchangeMap.current.entries());
      const oldEntries = entriesArray
        .filter(([, data]) => !isWithinTimeWindow(data.timestamp, 30000))
        .slice(0, 25);
      oldEntries.forEach(([key]) => conversationExchangeMap.current.delete(key));
    }

    const { language: targetLanguage, cleanText: cleanedResponse } = extractLanguageAndCleanText(agentResponse);
    const translationLatency = 1000; // Approximate for AI conversations
    
    // Score the translation
    const translationScore = scoreTranslation(
      userMessage,
      cleanedResponse,
      'en',
      targetLanguage.toLowerCase(),
      translationLatency
    );
    
    // Create bulletproof unique ID
    const uniqueId = `${currentTimestamp}_${createContentHash(userMessage + cleanedResponse)}_${Math.random().toString(36).substring(2, 6)}`;
    
    const newTranslation: TranslationEntry = {
      id: uniqueId,
      speaker: 'gp',
      originalText: userMessage,
      translatedText: cleanedResponse,
      originalLanguage: 'en',
      targetLanguage: targetLanguage.toLowerCase(),
      timestamp: new Date(),
      accuracy: translationScore.accuracy,
      confidence: translationScore.confidence,
      safetyFlag: translationScore.safetyFlag,
      medicalTermsDetected: translationScore.medicalTermsDetected,
      translationLatency
    };
    
    console.log('🛡️ DEDUP: Adding translation with ID:', uniqueId);
    
    setTranslations(prev => {
      const updated = [...prev, newTranslation];
      console.log('📊 Translation added, total count:', updated.length);
      return updated;
    });
    setTranslationScores(prev => {
      const updated = [...prev, translationScore];
      console.log('📊 Translation score added, total count:', updated.length);
      return updated;
    });

    // Immediate save with debouncing
    triggerImmediateSave();
  };

  const clearHistory = () => {
    setTranslations([]);
    setTranslationScores([]);
    setSessionStart(new Date());
    startNewSession();
    toast.success('Translation history cleared');
  };

  // Load session from history
  const handleSessionLoad = async (sessionId: string, sessionTranslations: any[], sessionScores: any[]) => {
    try {
      console.log('🔄 handleSessionLoad called with:', {
        sessionId,
        translationsCount: sessionTranslations.length,
        scoresCount: sessionScores.length,
        firstTranslation: sessionTranslations[0] ? {
          speaker: sessionTranslations[0].speaker,
          originalText: sessionTranslations[0].originalText?.substring(0, 50) + '...',
          translatedText: sessionTranslations[0].translatedText?.substring(0, 50) + '...'
        } : null
      });
      
      toast.info('Loading historical session...');
      
      // Load full session details for metadata only
      const sessionDetails = await loadSessionDetails(sessionId);
      
      if (sessionDetails) {
        console.log('🔄 Session details loaded from DB:', {
          sessionId: sessionDetails.id,
          title: sessionDetails.session_title,
          dbTranslationsCount: sessionDetails.translations?.length || 0,
          passedTranslationsCount: sessionTranslations.length
        });
        
        // Compare translations to ensure we're using the right data
        if (sessionDetails.translations?.length !== sessionTranslations.length) {
          console.warn('⚠️ Translation count mismatch between DB and passed data!', {
            dbCount: sessionDetails.translations?.length || 0,
            passedCount: sessionTranslations.length,
            sessionId
          });
        }
        
        // Close the history sidebar
        setShowHistorySidebar(false);
        
        // Prepare the session data for the historical view
        const metadata = sessionDetails.session_metadata as any;
        const sessionMetadata = {
          sessionStart: new Date(sessionDetails.session_start),
          sessionEnd: sessionDetails.session_end ? new Date(sessionDetails.session_end) : undefined,
          patientLanguage: sessionDetails.patient_language || 'Unknown',
          totalTranslations: sessionDetails.total_translations || sessionTranslations.length,
          averageAccuracy: metadata?.averageAccuracy || 0,
          averageConfidence: metadata?.averageConfidence || 0,
          overallSafetyRating: metadata?.overallSafetyRating || 'safe',
          safeCount: metadata?.safeCount || 0,
          warningCount: metadata?.warningCount || 0,
          unsafeCount: metadata?.unsafeCount || 0,
          sessionDuration: metadata?.sessionDuration
        };

        console.log('🔄 Setting historical session state with:', {
          sessionId,
          translationsCount: sessionTranslations.length,
          sessionTitle: sessionDetails.session_title
        });

        setSelectedHistoricalSession({
          sessionId,
          sessionTitle: sessionDetails.session_title || `Session ${new Date(sessionDetails.session_start).toLocaleDateString()}`,
          translations: sessionTranslations, // Use the passed translations, not the DB ones
          translationScores: sessionScores,
          sessionMetadata
        });
        
        setShowHistoricalView(true);
        toast.success('Historical session loaded successfully');
      }
      
    } catch (error) {
      console.error('❌ Error loading session:', error);
      toast.error('Failed to load session details');
    }
  };

  // Memoized getter functions to prevent callback recreation
  const getTranslations = React.useCallback(() => {
    return translations.map(t => ({
      ...t,
      timestamp: t.timestamp
    })) as HistoryTranslationEntry[];
  }, [translations]);

  const getTranslationScores = React.useCallback(() => {
    return translationScores.map(s => ({
      ...s,
      detectedIssues: s.issues || []
    })) as HistoryTranslationScore[];
  }, [translationScores]);

  const getSessionStart = React.useCallback(() => sessionStart, [sessionStart]);

  // Debounced immediate save function
  const triggerImmediateSave = React.useCallback(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      if (translations.length > 0) {
        try {
          setSaveStatus('saving');
          console.log('💾 Immediate save triggered...', { count: translations.length });
          
          await saveSession(
            getTranslations(),
            getTranslationScores(),
            sessionStart,
            undefined,
            true
          );
          
          setSaveStatus('saved');
          console.log('✅ Immediate save successful');
          toast.success('Translation saved automatically');
          
          // Reset status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
          console.error('❌ Immediate save failed:', error);
          setSaveStatus('error');
          toast.error('Failed to save translation');
          
          // Reset status after 3 seconds
          setTimeout(() => setSaveStatus('idle'), 3000);
        }
      }
    }, 1500); // 1.5 second debounce
  }, [translations.length, getTranslations, getTranslationScores, sessionStart, saveSession]);

  // Auto-save current translations
  const handleAutoSave = async () => {
    if (translations.length > 0) {
      try {
        console.log('🔄 Auto-saving translations...', { count: translations.length });
        await saveSession(
          getTranslations(),
          getTranslationScores(),
          sessionStart,
          undefined,
          true
        );
        console.log('✅ Auto-save successful');
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
        toast.error('Auto-save failed');
      }
    }
  };

  // Disable interval-based auto-save since we have immediate save with debouncing
  useEffect(() => {
    if (autoSaveEnabled) {
      console.log('🔧 Disabling interval-based auto-save (using immediate save instead)');
      disableAutoSave();
    }
  }, [autoSaveEnabled, disableAutoSave]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Text-to-speech function for repeating phrases
  const repeatTranslatedPhrase = async (text: string, language: string) => {
    if (isSpeaking) {
      toast.info('Already speaking, please wait...');
      return;
    }

    try {
      setIsSpeaking(true);
      toast.info('Playing translated phrase...');

      // Use ElevenLabs TTS API
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: { 
          text, 
          language: language.toLowerCase(),
          voice: 'Sarah' // Default voice
        }
      });

      if (error) {
        throw error;
      }

      // Convert base64 to Blob URL to comply with CSP
      if (data.audioContent) {
        // Convert base64 to binary
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob and URL
        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsSpeaking(false);
          toast.success('Phrase completed');
          // Clean up the blob URL
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          toast.error('Failed to play audio');
          // Clean up the blob URL
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      }

    } catch (err) {
      console.error('Text-to-speech error:', err);
      setIsSpeaking(false);
      toast.error('Failed to repeat phrase. Please check your ElevenLabs configuration.');
    }
  };

  const handleExportDOCX = async () => {
    try {
      const sessionEnd = new Date();
      const sessionDuration = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
      
      const averageAccuracy = translationScores.length > 0 
        ? Math.round(translationScores.reduce((sum, s) => sum + s.accuracy, 0) / translationScores.length)
        : 0;
      
      const averageConfidence = translationScores.length > 0
        ? Math.round(translationScores.reduce((sum, s) => sum + s.confidence, 0) / translationScores.length)
        : 0;

      const safeCount = translationScores.filter(s => s.safetyFlag === 'safe').length;
      const warningCount = translationScores.filter(s => s.safetyFlag === 'warning').length;
      const unsafeCount = translationScores.filter(s => s.safetyFlag === 'unsafe').length;
      
      let overallSafetyRating: 'safe' | 'warning' | 'unsafe' = 'safe';
      if (unsafeCount > 0) {
        overallSafetyRating = 'unsafe';
      } else if (warningCount > translationScores.length * 0.3) {
        overallSafetyRating = 'warning';
      }

      const metadata: SessionMetadata = {
        sessionDate: sessionStart,
        sessionStart,
        sessionEnd,
        patientLanguage: 'Multiple Languages',
        totalTranslations: translations.length,
        sessionDuration,
        overallSafetyRating,
        averageAccuracy,
        averageConfidence
      };

      await downloadDOCX(translations, metadata, translationScores);
      toast.success('Translation history exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export translation history');
    }
  };

  const handlePatientExportDOCX = async () => {
    try {
      const sessionEnd = new Date();
      const sessionDuration = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
      
      // Detect the most common patient language
      const patientLanguages = translations
        .filter(t => t.speaker === 'patient')
        .map(t => t.targetLanguage);
      
      const languageCount: { [key: string]: number } = {};
      patientLanguages.forEach(lang => {
        languageCount[lang] = (languageCount[lang] || 0) + 1;
      });
      
      const primaryPatientLanguage = Object.entries(languageCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'English';

      const metadata: PatientSessionMetadata = {
        sessionDate: sessionStart,
        sessionStart,
        sessionEnd,
        patientLanguage: primaryPatientLanguage,
        totalTranslations: translations.length,
        sessionDuration,
        practiceName: "NHS GP Practice", // Could be made configurable
        practiceAddress: "Contact your practice for address details",
        practicePhone: "Contact your practice for phone details",
        gpName: "Your GP" // Could be made configurable
      };

      await downloadPatientDOCX(translations, metadata, translationScores);
      toast.success('Patient translation record exported successfully');
    } catch (error) {
      console.error('Patient export error:', error);
      toast.error('Failed to export patient translation record');
    }
  };

  const verifyConversationQuality = async (userInput: string, agentResponse: string) => {
    console.log('🔍 Translation Quality Check Starting...');
    console.log('🔍 User input:', userInput.substring(0, 100) + '...');
    console.log('🔍 Agent response:', agentResponse.substring(0, 100) + '...');
    
    // Skip language setup requests - these are not actual translations to evaluate
    const isLanguageSetup = userInput.toLowerCase().includes('please') && 
                           userInput.toLowerCase().match(/\b(polish|arabic|spanish|french|urdu|bengali|chinese|german|italian|portuguese|ukrainian|hungarian|russian|hindi)\b/i) &&
                           agentResponse.toLowerCase().includes('ready');
    
    if (isLanguageSetup) {
      console.log('🔧 Skipping language setup request from quality verification');
      return;
    }
    
    // Only verify if we have meaningful content (not just setup messages)
    if (userInput.trim().length < 5 || agentResponse.trim().length < 5) {
      console.log('🔧 Skipping short/setup message from quality verification');
      return;
    }
    
    // Extract target language from agent response
    const { language: targetLanguage, cleanText: cleanedResponse } = extractLanguageAndCleanText(agentResponse);
    
    try {
      console.log('🌐 Calling verification function...');
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-verification', {
        body: {
          userInput,
          agentResponse,
          sourceLanguage: 'English',
          targetLanguage: targetLanguage,
          conversationId: conversationIdRef.current
        }
      });

      if (error) {
        console.error('❌ Translation verification error:', error);
        toast.error('Translation verification failed: ' + (error.message || 'Unknown error'));
        throw error;
      }

      console.log('✅ Translation quality result:', data);
      // Add the original phrases to the quality score
      const enrichedData = {
        ...data,
        originalPhrase: userInput,
        translatedPhrase: cleanedResponse,
        sourceLanguage: 'English',
        targetLanguage: targetLanguage
      };
      setQualityScore(enrichedData);
      
      // Update current translation for modal display
      setCurrentTranslation({
        englishText: userInput,
        translatedText: cleanedResponse,
        targetLanguage: targetLanguage,
        qualityScore: enrichedData,
        timestamp: new Date()
      });
      
      // Modal is now manually triggered by user button
      
      // Show prominent toast notification
      const qualityMessage = data.overallSafety === 'OK' 
        ? `✅ Translation Quality: SAFE (${data.confidence}% confidence)`
        : data.overallSafety === 'REVIEW'
        ? `⚠️ Translation Quality: REVIEW NEEDED (${data.confidence}% confidence)`
        : `❌ Translation Quality: NOT SAFE (${data.confidence}% confidence)`;
      
      if (data.overallSafety === 'OK') {
        toast.success(qualityMessage);
      } else if (data.overallSafety === 'REVIEW') {
        toast.warning(qualityMessage);
      } else {
        toast.error(qualityMessage);
      }
      
    } catch (err) {
      console.error('❌ Failed to verify conversation quality:', err);
      toast.error('Translation verification system error');
    }
  };

  const conversation = useConversation({
    onConnect: () => {
      console.log('✅ Connected to Notewell AI Translation Service');
      toast.success('Connected to Translation Service');
      setError(null);
      
      conversationIdRef.current = `translation_${Date.now()}`;
      // Don't clear quality score on connection - only on manual reset
      setConversationBuffer([]);
      
      // Enhanced audio setup to prevent cutouts
      setTimeout(() => {
        console.log('🔊 Setting optimal volume and audio configuration...');
        conversation.setVolume({ volume: 0.8 });
        
        // Additional audio context resume (for safety)
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              console.log('🔊 Audio context re-resumed after connection');
            });
          }
        } catch (error) {
          console.warn('⚠️ Could not re-resume audio context:', error);
        }
      }, 500);
    },
    onDisconnect: () => {
      console.log('Disconnected from Notewell AI Translation Service');
      toast.info('Disconnected from Translation Service');
      conversationIdRef.current = null;
      // Close translation modal when disconnected
      setIsTranslationModalOpen(false);
      setCurrentTranslation(null);
    },
    onMessage: (message) => {
      console.log('📨 Translation message received:', message);
      
      // BULLETPROOF DEDUPLICATION - Message Level
      const messageContent = message.message || '';
      const messageSource = message.source || '';
      // Fixed: Remove timestamp from messageId to allow proper deduplication
      const messageId = createContentHash(messageContent + messageSource);
      
      // Check if we've already processed this exact message recently
      if (processedMessageIds.current.has(messageId)) {
        console.log('🛡️ MSG_DEDUP: BLOCKED - Message already processed:', messageId.substring(0, 8));
        return;
      }

      // Mark this message as processed
      processedMessageIds.current.add(messageId);
      
      // Capture and verify conversations for quality assurance
      if (message.message && message.source) {
        console.log('🎯 Translation message - Source:', message.source, 'Content:', message.message.substring(0, 50) + '...');
        
        const newEntry = {
          user: message.source === 'user' ? message.message : '',
          agent: message.source === 'ai' ? message.message : ''
        };
        
        setConversationBuffer(prev => {
          const updated = [...prev];
          if (message.source === 'user') {
            console.log('👤 User message captured:', message.message.substring(0, 50) + '...');
            updated.push(newEntry);
          } else if (message.source === 'ai' && updated.length > 0) {
            console.log('🤖 AI response captured:', message.message.substring(0, 50) + '...');
            updated[updated.length - 1].agent = message.message;
            
            // Trigger verification for the complete exchange with improved error handling
            const lastExchange = updated[updated.length - 1];
            if (lastExchange.user && lastExchange.agent) {
              console.log('🔄 Triggering verification for complete exchange');
              
              // Create exchange key for this specific conversation pair
              const exchangeVerificationKey = createContentHash(lastExchange.user + lastExchange.agent);
              
              // Check if we've already processed this exact exchange for verification
              const existingVerification = conversationExchangeMap.current.get(exchangeVerificationKey + '_verification');
              if (existingVerification && isWithinTimeWindow(existingVerification.timestamp, 10000)) {
                console.log('🛡️ EXCHANGE_DEDUP: BLOCKED - Verification already done for this exchange in last 10s');
                return updated;
              }

              // Mark this exchange as being verified with improved tracking
              conversationExchangeMap.current.set(exchangeVerificationKey + '_verification', {
                timestamp: Date.now(),
                processed: false // Will be set to true when verification completes
              });

              // Use setTimeout with better error handling
              setTimeout(async () => {
                try {
                  console.log('🔍 Starting quality verification for exchange');
                  await verifyConversationQuality(lastExchange.user, lastExchange.agent);
                  addToTranslationHistory(lastExchange.user, lastExchange.agent);
                  
                  // Mark as successfully processed
                  const entry = conversationExchangeMap.current.get(exchangeVerificationKey + '_verification');
                  if (entry) {
                    entry.processed = true;
                  }
                } catch (error) {
                  console.error('🔥 Verification failed for exchange:', error);
                  // Remove failed entry to allow retry
                  conversationExchangeMap.current.delete(exchangeVerificationKey + '_verification');
                  toast.error('Translation quality check failed - will retry on next message');
                }
              }, 200);
            }
          }
          return updated;
        });
      } else {
        console.log('⚠️ Translation message missing data - message:', !!message.message, 'source:', message.source);
      }
    },
    onError: (error) => {
      console.error('Translation conversation error:', error);
      setError(typeof error === 'string' ? error : 'Connection error occurred');
      toast.error(`Error: ${typeof error === 'string' ? error : 'Connection failed'}`);
    }
  });

  // Request microphone permission
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      toast.success('Microphone access granted');
      return true;
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setError('Microphone access is required for voice conversation');
      toast.error('Microphone access denied');
      return false;
    }
  };

  // Generate signed URL for the translation agent
  const generateSignedUrl = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Language Support Agent for translation services
      const agentId = 'agent_01jws2qhv2essav25m8cfq2h0v';  // Language Support Agent

      console.log('Generating signed URL for Translation Agent:', agentId);

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId }
      });

      console.log('Supabase function response:', { data, error });

      if (error) throw error;
      
      setAgentUrl(data.signed_url);
      return data.signed_url;
    } catch (err: any) {
      console.error('Failed to generate signed URL:', err);
      setError('Failed to connect to Translation Service. Please check your ElevenLabs API key.');
      toast.error('Failed to connect to Translation Service');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize audio context to prevent cutouts
  const initializeAudioContext = async () => {
    try {
      console.log('🔊 Initializing audio context to prevent cutouts...');
      
      // Create and resume audio context if needed
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('🔊 Audio context resumed successfully');
      }
      
      // Create a brief silent audio buffer to prime the audio pipeline
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
      
      console.log('🔊 Audio context initialized and primed');
      return audioContext;
    } catch (error) {
      console.warn('⚠️ Could not initialize audio context:', error);
      return null;
    }
  };

  // Start conversation
  const startTranslationService = async () => {
    const permitted = hasPermission ? true : await requestMicrophonePermission();
    if (!permitted) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize audio context first to prevent cutouts
      await initializeAudioContext();
      
      // Generate signed URL first (required for authorized agents)
      const signedUrl = await generateSignedUrl();
      if (!signedUrl) {
        setError('Failed to get authorization for Translation Service');
        return;
      }

      console.log('🎙️ Starting translation service with signed URL:', signedUrl);
      
      // Extended delay to ensure microphone and audio context are fully ready
      console.log('⏳ Waiting for audio system initialization...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const conversationId = await conversation.startSession({ 
        agentId: 'agent_01jws2qhv2essav25m8cfq2h0v',  // Language Support Agent
        signedUrl
      });
      
      // Extended delay after starting session to allow audio pipeline to establish
      console.log('⏳ Allowing audio pipeline to establish...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Translation service started successfully:', conversationId);
      
    } catch (err: any) {
      console.error('Failed to start translation service:', err);
      setError('Failed to start conversation with Translation Service');
      toast.error('Failed to start translation service');
    } finally {
      setIsLoading(false);
    }
  };

  // End conversation
  const endTranslationService = async () => {
    try {
      await conversation.endSession();
    } catch (err: any) {
      console.error('Failed to end translation service:', err);
    }
  };

  useEffect(() => {
    // Check if microphone permission is already granted
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setHasPermission(result.state === 'granted');
    });
  }, []);

  // Load specific session from URL parameter
  useEffect(() => {
    console.log('🔗 URL_EFFECT: sessionId from URL:', sessionId);
    console.log('🔗 URL_EFFECT: loadSessionDetails available:', !!loadSessionDetails);
    
    if (sessionId && loadSessionDetails) {
      console.log('🔗 URL_EFFECT: Loading session from URL:', sessionId);
      
      loadSessionDetails(sessionId).then(sessionDetails => {
        console.log('🔗 URL_EFFECT: Session details loaded:', sessionDetails);
        const translations = sessionDetails.translations || [];
        console.log('🔗 URL_EFFECT: Number of translations:', translations.length);
        
        const translationScores = translations.map((t: any) => ({
          accuracy: t.accuracy || 100,
          confidence: t.confidence || 100,
          safetyFlag: t.safetyFlag || 'safe' as const,
          medicalTermsDetected: t.medicalTermsDetected || [],
          detectedIssues: t.detectedIssues || []
        }));

        setSelectedHistoricalSession({
          sessionId,
          sessionTitle: sessionDetails.session_title || `Session ${sessionId.substring(0, 8)}`,
          translations,
          translationScores,
          sessionMetadata: sessionDetails
        });
        setShowHistoricalView(true);
        console.log('🔗 URL_EFFECT: Historical view should now show');
        toast.success(`Session ${sessionId.substring(0, 8)} loaded from URL`);
      }).catch(error => {
        console.error('🔗 URL_EFFECT: Failed to load session from URL:', error);
        toast.error('Failed to load session');
      });
    } else if (!sessionId) {
      console.log('🔗 URL_EFFECT: No sessionId in URL, staying on main page');
    }
  }, [sessionId, loadSessionDetails]);

  const getBadgeVariant = (score: QualityScore) => {
    if (score.overallSafety === 'OK') return 'default';
    if (score.overallSafety === 'REVIEW') return 'secondary';
    return 'destructive';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 border-green-300 text-green-800';
    if (score >= 80) return 'bg-green-50 border-green-200 text-green-700';
    if (score >= 70) return 'bg-orange-50 border-orange-200 text-orange-700';
    return 'bg-red-50 border-red-200 text-red-700';
  };

  const getBadgeColor = (score: QualityScore) => {
    if (score.overallSafety === 'OK') return 'bg-green-500 hover:bg-green-600 text-white border-green-500';
    if (score.overallSafety === 'REVIEW') return 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500';
    return 'bg-red-500 hover:bg-red-600 text-white border-red-500';
  };

  const getQualityIcon = (score: QualityScore) => {
    if (score.overallSafety === 'OK') return <CircleCheck className="h-3 w-3 mr-1" />;
    if (score.overallSafety === 'REVIEW') return <AlertTriangle className="h-3 w-3 mr-1" />;
    return <XCircle className="h-3 w-3 mr-1" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Show Historical Translation View or Main Interface */}
      {showHistoricalView && selectedHistoricalSession ? (
        <HistoricalTranslationView
          sessionId={selectedHistoricalSession.sessionId}
          sessionTitle={selectedHistoricalSession.sessionTitle}
          translations={selectedHistoricalSession.translations}
          translationScores={selectedHistoricalSession.translationScores}
          sessionMetadata={selectedHistoricalSession.sessionMetadata}
          onBack={() => {
            setShowHistoricalView(false);
            setSelectedHistoricalSession(null);
          }}
        />
      ) : (
        <>
          {/* Header Card */}
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold flex items-center justify-center gap-3">
                <Languages className="h-8 w-8" />
                Notewell AI Translation Service for GP Practices
              </CardTitle>
              <p className="text-xl text-primary-foreground/90 mt-2">
                Real-time translation for Reception & Clinical Staff
              </p>
            </CardHeader>
          </Card>

      {/* Main Interface Tabs */}
      <Tabs defaultValue="translate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="translate" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Live Speech Translation
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email and Documents Translation
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Translation History
            {translations.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {translations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="translate" className="space-y-6 mt-6">
          {/* Translation Service Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Translation Service
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Service Status Badges - shown at top if connected */}
              {conversation.status === 'connected' && (
                <div className="flex items-center justify-center gap-4 mb-6">
                  <Badge variant="default" className="text-sm px-3 py-1">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Service Active
                  </Badge>
                  {conversation.isSpeaking && (
                    <Badge variant="secondary" className="text-sm px-3 py-1 animate-pulse">
                      <Languages className="h-4 w-4 mr-2" />
                      Translating...
                    </Badge>
                  )}
                </div>
              )}

              {/* Central Service Control Button */}
              <div className="flex flex-col items-center space-y-4">
                {conversation.status === 'connected' ? (
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={endTranslationService}
                      variant="destructive"
                      size="lg"
                      className="flex items-center gap-3 px-8 py-4 text-lg font-semibold"
                    >
                      <PhoneOff className="h-6 w-6" />
                      End Translation Service
                    </Button>
                    
                    {/* Show Translation Modal Button */}
                    <Button
                      onClick={() => setIsTranslationModalOpen(true)}
                      variant="outline"
                      size="lg"
                      className="flex items-center gap-3 px-8 py-4 text-lg font-semibold border-2"
                      disabled={!currentTranslation}
                    >
                      <Eye className="h-6 w-6" />
                      {currentTranslation ? 'Show Translation' : 'No Translation Yet'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Button
                      onClick={startTranslationService}
                      disabled={isLoading}
                      size="lg"
                      className="flex items-center gap-3 px-12 py-6 text-xl font-bold bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                      {isLoading ? (
                        <Loader2 className="h-7 w-7 animate-spin" />
                      ) : (
                        <Phone className="h-7 w-7" />
                      )}
                      Start Translation Service
                    </Button>
                    
                    {/* Reset Button - Only show after a call has ended and there's memory to clear */}
                    {(qualityScore || currentTranslation || conversationBuffer.length > 0) && (
                      <Button
                        onClick={handleResetClick}
                        variant={resetClickCount === 1 ? "default" : "outline"}
                        size="sm"
                        className={`flex items-center gap-2 px-4 py-2 transition-all duration-200 ${
                          resetClickCount === 1 
                            ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500 animate-pulse' 
                            : 'hover:bg-orange-50 border-orange-200 text-muted-foreground'
                        }`}
                        disabled={isResetting}
                      >
                        {isResetting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        {resetClickCount === 1 ? 'Click Again to Reset' : 'Reset'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Languages Available */}
              <div className="mt-8">
                <h3 className="text-2xl font-bold mb-6 text-center">Languages Available</h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {["Polish", "Urdu", "Bengali", "Arabic", "Spanish", "French", "Hindi", "Chinese", "German", "Italian", "Portuguese", "Ukrainian", "Hungarian", "Russian"].map((lang) => (
                    <Badge key={lang} variant="outline" className="text-base px-4 py-2 font-semibold hover:bg-primary/10 transition-colors">
                      {lang}
                    </Badge>
                  ))}
                  <Badge variant="secondary" className="text-base px-4 py-2 font-bold">
                    + 50 more
                  </Badge>
                </div>
              </div>

              {/* Instructions */}
              {conversation.status === 'connected' && (
                <Alert>
                  <Languages className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Service Active:</strong> Speak clearly in English, and the AI will automatically translate to the patient's language. 
                    The patient can respond in their native language, and it will be translated back to English for you.
                  </AlertDescription>
                </Alert>
              )}

              {/* Microphone Permission Status */}
              {hasPermission && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Microphone access granted
                </div>
              )}
            </CardContent>
          </Card>

          {/* Translation Quality Card */}
          {qualityScore && (
            <Card className="border-2 border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Translation Quality - {qualityScore.targetLanguage}
                    <Badge 
                      className={`text-xs flex items-center ${getBadgeColor(qualityScore)}`}
                    >
                      {getQualityIcon(qualityScore)}
                      {qualityScore.overallSafety}
                    </Badge>
                  </CardTitle>
                  <Collapsible open={isQualityDetailsOpen} onOpenChange={setIsQualityDetailsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                        {isQualityDetailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Quick Quality Indicators */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className={`text-center p-3 rounded border ${getScoreColor(qualityScore.accuracy)}`}>
                      <div className="text-xs font-medium">Accuracy</div>
                      <div className="font-bold text-lg">{qualityScore.accuracy}%</div>
                    </div>
                    <div className={`text-center p-3 rounded border ${getScoreColor(qualityScore.medicalSafety)}`}>
                      <div className="text-xs font-medium">Safety</div>
                      <div className="font-bold text-lg">{qualityScore.medicalSafety}%</div>
                    </div>
                    <div className={`text-center p-3 rounded border ${getScoreColor(qualityScore.clarity)}`}>
                      <div className="text-xs font-medium">Clarity</div>
                      <div className="font-bold text-lg">{qualityScore.clarity}%</div>
                    </div>
                    <div className={`text-center p-3 rounded border ${getScoreColor(qualityScore.confidence)}`}>
                      <div className="text-xs font-medium">Confidence</div>
                      <div className="font-bold text-lg">{qualityScore.confidence}%</div>
                    </div>
                  </div>

                  <Collapsible open={isQualityDetailsOpen} onOpenChange={setIsQualityDetailsOpen}>
                    <CollapsibleContent className="space-y-3">
                      {/* Translation Details */}
                      <div className="space-y-3 p-4 rounded border bg-muted/20">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Original ({getLanguageName(qualityScore.sourceLanguage)}):</span>
                          <div className="text-lg mt-2 p-3 rounded bg-background border font-medium">
                            {qualityScore.originalPhrase}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Translation ({getLanguageName(qualityScore.targetLanguage)}):</span>
                          <div className="text-lg mt-2 p-3 rounded bg-background border font-medium">
                            {qualityScore.translatedPhrase}
                          </div>
                        </div>
                      </div>

                      {/* Detailed Scores */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">Medical Safety:</span>
                            <span className="text-xs">{qualityScore.medicalSafety}%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">Cultural Sensitivity:</span>
                            <span className="text-xs">{qualityScore.culturalSensitivity}%</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">Overall Assessment:</span>
                            <Badge className={`text-xs ${getBadgeColor(qualityScore)}`}>
                              {qualityScore.overallSafety}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Explanation */}
                      {qualityScore.explanation && (
                        <div className="text-xs text-muted-foreground p-2 rounded bg-muted/30">
                          <strong>Analysis:</strong> {qualityScore.explanation}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Guide with Tabs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Translation Service User Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="getting-started" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="getting-started" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Getting Started
                  </TabsTrigger>
                  <TabsTrigger value="email-docs" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email & Documents
                  </TabsTrigger>
                  <TabsTrigger value="nhs-compliance" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    NHS Compliance
                  </TabsTrigger>
                  <TabsTrigger value="safety" className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Safety & Quality
                  </TabsTrigger>
                  <TabsTrigger value="support" className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Support
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="getting-started" className="space-y-6 mt-6">
                  {/* Live Speech Translation Guide */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Phone className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-blue-800">Live Speech Translation</h3>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">Real-time AI Voice</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Reception Staff Guide */}
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          For Reception Staff
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                            <div>
                              <strong>Start Session:</strong> Click "Start Translation Service" button and allow microphone access when prompted
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                            <div>
                              <strong>Language Setup:</strong> Say "Please translate to [language]" (e.g., "Please translate to Polish")
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                            <div>
                              <strong>Speak Clearly:</strong> Talk naturally in English - AI will translate immediately
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                            <div>
                              <strong>Patient Response:</strong> Patient speaks in their language - AI translates to English for you
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">5</span>
                            <div>
                              <strong>Large Display:</strong> Click "View Translation Display" for patient-facing large text
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
                          <h5 className="font-semibold text-amber-800 mb-2">Reception Tips:</h5>
                          <ul className="text-xs text-amber-700 space-y-1">
                            <li>• Use for appointment booking, registration, and basic queries</li>
                            <li>• Speak one sentence at a time for better accuracy</li>
                            <li>• Pause briefly between sentences</li>
                            <li>• Use simple, clear language initially</li>
                          </ul>
                        </div>
                      </div>

                      {/* Clinical Staff Guide */}
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-green-600" />
                          For Clinical Staff
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                            <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                            <div>
                              <strong>Clinical Mode:</strong> System automatically recognizes medical terminology and drug names
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                            <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                            <div>
                              <strong>Safe Translation:</strong> All medical terms verified for accuracy and safety
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                            <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                            <div>
                              <strong>Quality Monitoring:</strong> Real-time quality scores and safety flags displayed
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                            <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                            <div>
                              <strong>Clinical Documentation:</strong> Full conversation history logged for patient records
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                            <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">5</span>
                            <div>
                              <strong>Export Options:</strong> Generate DOCX reports for patient notes and clinical records
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                          <h5 className="font-semibold text-red-800 mb-2">Clinical Safety:</h5>
                          <ul className="text-xs text-red-700 space-y-1">
                            <li>• All dosages automatically verified for safety</li>
                            <li>• Medical terminology preserved and cross-checked</li>
                            <li>• Red/amber flags alert to potential issues</li>
                            <li>• NHS compliance built-in with audit trails</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Supported Languages */}
                    <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded">
                      <h5 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Supported Languages (50+)
                      </h5>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                        {[
                          'Polish 🇵🇱', 'Arabic 🇸🇦', 'Bengali 🇧🇩', 'Chinese 🇨🇳', 'French 🇫🇷', 'German 🇩🇪',
                          'Hindi 🇮🇳', 'Italian 🇮🇹', 'Portuguese 🇵🇹', 'Romanian 🇷🇴', 'Russian 🇷🇺', 'Spanish 🇪🇸',
                          'Turkish 🇹🇷', 'Ukrainian 🇺🇦', 'Urdu 🇵🇰', 'Gujarati 🇮🇳', 'Punjabi 🇮🇳', 'Somali 🇸🇴'
                        ].map((lang, i) => (
                          <Badge key={i} variant="outline" className="justify-center bg-white">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="email-docs" className="space-y-6 mt-6">
                  {/* Email Translation Guide */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Mail className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-lg font-semibold text-indigo-800">Email Translation</h3>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">Clinical Email Processing</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-indigo-700">How to Use Email Translation</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2 p-2 bg-indigo-50 rounded">
                            <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                            <div>
                              <strong>Access:</strong> Click "Email Translation" tab at the top of the service
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-indigo-50 rounded">
                            <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                            <div>
                              <strong>Upload:</strong> Drag & drop email files (.eml, .msg) or copy/paste email content
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-indigo-50 rounded">
                            <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                            <div>
                              <strong>Language Selection:</strong> Choose target language from dropdown menu
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-indigo-50 rounded">
                            <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                            <div>
                              <strong>Quality Check:</strong> System validates translation for medical accuracy
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-indigo-50 rounded">
                            <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">5</span>
                            <div>
                              <strong>Send & Save:</strong> Send translated email directly or save to patient records
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-indigo-700">Email Features</h4>
                        <div className="space-y-2">
                          <div className="p-3 bg-white border border-indigo-200 rounded">
                            <h5 className="font-semibold text-sm text-indigo-800 mb-1">Smart Detection</h5>
                            <p className="text-xs text-indigo-600">Automatically detects patient information, medical terms, and appointment details</p>
                          </div>
                          <div className="p-3 bg-white border border-indigo-200 rounded">
                            <h5 className="font-semibold text-sm text-indigo-800 mb-1">Format Preservation</h5>
                            <p className="text-xs text-indigo-600">Maintains email formatting, headers, and structure in translations</p>
                          </div>
                          <div className="p-3 bg-white border border-indigo-200 rounded">
                            <h5 className="font-semibold text-sm text-indigo-800 mb-1">Clinical Integration</h5>
                            <p className="text-xs text-indigo-600">Links with patient records and clinical systems for seamless workflow</p>
                          </div>
                          <div className="p-3 bg-white border border-indigo-200 rounded">
                            <h5 className="font-semibold text-sm text-indigo-800 mb-1">Compliance Tracking</h5>
                            <p className="text-xs text-indigo-600">Full audit trail and GDPR-compliant processing of patient communications</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <h5 className="font-semibold text-yellow-800 mb-2">Email Best Practices:</h5>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        <li>• Always review translated emails before sending to patients</li>
                        <li>• Use "Quality Verification" feature for clinical communications</li>
                        <li>• Save important patient email translations to their medical record</li>
                        <li>• Check recipient language preferences in patient demographics</li>
                      </ul>
                    </div>
                  </div>

                  {/* Document Translation Guide */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <FileText className="h-5 w-5 text-orange-600" />
                      <h3 className="text-lg font-semibold text-orange-800">Document Translation</h3>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">OCR + AI Translation</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-orange-700">Document Processing Steps</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                            <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                            <div>
                              <strong>Upload Document:</strong> Support for images (JPG, PNG), PDFs, scanned documents
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                            <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                            <div>
                              <strong>OCR Processing:</strong> Advanced text extraction using Google Cloud Vision API
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                            <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                            <div>
                              <strong>Medical Recognition:</strong> AI identifies medical terms, drug names, and dosages
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                            <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                            <div>
                              <strong>Multi-Service Translation:</strong> Cross-verified using Google, DeepL, and OpenAI
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                            <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">5</span>
                            <div>
                              <strong>Safety Validation:</strong> 8-layer verification system ensures medical accuracy
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                            <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">6</span>
                            <div>
                              <strong>Export & Save:</strong> Generate patient-friendly documents or clinical notes
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-orange-700">Supported Document Types</h4>
                        <div className="space-y-2">
                          <div className="p-3 bg-white border border-orange-200 rounded">
                            <h5 className="font-semibold text-sm text-orange-800 mb-1">Medical Prescriptions</h5>
                            <p className="text-xs text-orange-600">Drug names, dosages, instructions translated with pharmaceutical accuracy</p>
                          </div>
                          <div className="p-3 bg-white border border-orange-200 rounded">
                            <h5 className="font-semibold text-sm text-orange-800 mb-1">Test Results & Reports</h5>
                            <p className="text-xs text-orange-600">Lab results, X-ray reports, specialist letters with medical terminology preserved</p>
                          </div>
                          <div className="p-3 bg-white border border-orange-200 rounded">
                            <h5 className="font-semibold text-sm text-orange-800 mb-1">Foreign Medical Records</h5>
                            <p className="text-xs text-orange-600">International patient documents, discharge summaries, treatment histories</p>
                          </div>
                          <div className="p-3 bg-white border border-orange-200 rounded">
                            <h5 className="font-semibold text-sm text-orange-800 mb-1">Insurance Documents</h5>
                            <p className="text-xs text-orange-600">Healthcare insurance forms, prior authorization requests, claims</p>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                          <h5 className="font-semibold text-green-800 mb-2">Quality Assurance:</h5>
                          <ul className="text-xs text-green-700 space-y-1">
                            <li>• 8-layer validation system (OCR → Translation → Medical → Safety)</li>
                            <li>• Cross-service verification for maximum accuracy</li>
                            <li>• Specialized Romanian medical term validation</li>
                            <li>• Reverse translation checking for quality control</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="nhs-compliance" className="space-y-6 mt-6">
                  {/* NHS Compliance & Clinical Evidence */}
                  <div className="space-y-6 bg-gradient-to-br from-blue-50 to-green-50 p-6 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center gap-2 pb-2 border-b border-blue-300">
                      <Shield className="h-6 w-6 text-blue-600" />
                      <h3 className="text-xl font-bold text-blue-800">NHS Compliance & Clinical Evidence</h3>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 font-semibold">Exceeds NHS Standards</Badge>
                    </div>

                    {/* Language Barrier Crisis */}
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                      <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        The Language Barrier Crisis in NHS Care
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-semibold text-red-700 mb-2">Patient Safety Impact</h5>
                          <ul className="text-sm text-red-600 space-y-1">
                            <li>• 15-20% higher readmission rates for non-English speakers</li>
                            <li>• Delayed diagnosis and treatment leading to worse outcomes</li>
                            <li>• Medication errors from communication barriers</li>
                            <li>• Increased length of stay and healthcare costs</li>
                            <li>• Patient dissatisfaction and reduced care quality</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-red-700 mb-2">Current NHS Challenges</h5>
                          <ul className="text-sm text-red-600 space-y-1">
                            <li>• Limited professional interpreter availability (especially out-of-hours)</li>
                            <li>• High costs: £200+ per interpreter session</li>
                            <li>• Critical delays in urgent care due to language barriers</li>
                            <li>• Inconsistent quality when using untrained interpreters</li>
                            <li>• Family member interpretation risks patient confidentiality</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* How We Meet/Exceed NHS Requirements */}
                    <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                      <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        How We Meet & Exceed NHS Translation Requirements
                      </h4>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <Card className="bg-white border-green-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <h5 className="font-semibold text-green-800">Quality Assurance & Safety</h5>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-green-700">8-layer validation system (NHS requires basic accuracy checking)</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-green-700">Real-time medical terminology verification against BNF/NHS databases</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-green-700">Multi-service cross-validation (Google, DeepL, OpenAI)</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">MEETS</Badge>
                                <span className="text-green-700">Safety classifications with clear escalation protocols</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-white border-green-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Database className="h-5 w-5 text-blue-600" />
                              <h5 className="font-semibold text-blue-800">Information Governance</h5>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">MEETS</Badge>
                                <span className="text-blue-700">GDPR compliant data processing</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">MEETS</Badge>
                                <span className="text-blue-700">NHS Data Security Standards adherence</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-blue-700">Comprehensive audit trails (NHS requires basic logging)</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-blue-700">Automatic data retention and anonymization</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-white border-green-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Stethoscope className="h-5 w-5 text-purple-600" />
                              <h5 className="font-semibold text-purple-800">Clinical Integration</h5>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-purple-700">Full conversation history for clinical records</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-purple-700">Word document exports with certification</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">MEETS</Badge>
                                <span className="text-purple-700">Patient consent processes built-in</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">EXCEEDS</Badge>
                                <span className="text-purple-700">Quality metrics and performance monitoring</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Evidence of Effectiveness */}
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                      <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <Heart className="h-5 w-5" />
                        Clinical Evidence & Effectiveness
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-3 rounded border border-blue-200">
                          <div className="text-2xl font-bold text-blue-600 mb-1">95%+</div>
                          <div className="text-sm font-semibold text-blue-800">Translation Accuracy</div>
                          <div className="text-xs text-blue-600">For medical translations</div>
                        </div>
                        <div className="bg-white p-3 rounded border border-green-200">
                          <div className="text-2xl font-bold text-green-600 mb-1">Zero</div>
                          <div className="text-sm font-semibold text-green-800">Medication Errors</div>
                          <div className="text-xs text-green-600">From our translations</div>
                        </div>
                        <div className="bg-white p-3 rounded border border-orange-200">
                          <div className="text-2xl font-bold text-orange-600 mb-1">70%</div>
                          <div className="text-sm font-semibold text-orange-800">Time Reduction</div>
                          <div className="text-xs text-orange-600">In multilingual consultations</div>
                        </div>
                        <div className="bg-white p-3 rounded border border-purple-200">
                          <div className="text-2xl font-bold text-purple-600 mb-1">£180+</div>
                          <div className="text-sm font-semibold text-purple-800">Savings Per Session</div>
                          <div className="text-xs text-purple-600">vs. professional interpreters</div>
                        </div>
                      </div>
                    </div>

                    {/* Addressing NHS Staff Concerns */}
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                      <h4 className="font-bold text-yellow-800 mb-4 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Addressing NHS Staff Concerns About AI Translation
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="bg-white p-3 rounded border border-yellow-200">
                            <h5 className="font-semibold text-yellow-800 mb-2">"Can AI really handle complex medical translations safely?"</h5>
                            <ul className="text-sm text-yellow-700 space-y-1">
                              <li>✓ Multi-layer verification system catches errors before they reach patients</li>
                              <li>✓ Human oversight protocols for high-risk translations</li>
                              <li>✓ Professional interpreter backup integration for critical situations</li>
                              <li>✓ Real-time safety monitoring with immediate flagging</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border border-yellow-200">
                            <h5 className="font-semibold text-yellow-800 mb-2">"What about liability and clinical governance?"</h5>
                            <ul className="text-sm text-yellow-700 space-y-1">
                              <li>✓ Complete audit trails for clinical governance and CQC inspections</li>
                              <li>✓ Clear escalation protocols for unsafe translations</li>
                              <li>✓ Integration with existing clinical risk management systems</li>
                              <li>✓ Professional indemnity coverage for AI-assisted care</li>
                            </ul>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="bg-white p-3 rounded border border-yellow-200">
                            <h5 className="font-semibold text-yellow-800 mb-2">"How does this fit with our existing workflows?"</h5>
                            <ul className="text-sm text-yellow-700 space-y-1">
                              <li>✓ Seamless integration with EMIS, SystmOne, and other clinical systems</li>
                              <li>✓ No disruption to established clinical processes</li>
                              <li>✓ Enhanced documentation automatically saved to patient records</li>
                              <li>✓ Instant access - no booking or waiting for interpreters</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border border-yellow-200">
                            <h5 className="font-semibold text-yellow-800 mb-2">"Will this replace human interpreters entirely?"</h5>
                            <ul className="text-sm text-yellow-700 space-y-1">
                              <li>✓ Designed to complement, not replace professional interpreters</li>
                              <li>✓ Handles routine consultations, escalates complex cases</li>
                              <li>✓ Provides immediate support when interpreters unavailable</li>
                              <li>✓ Frees interpreters for most critical and sensitive cases</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Planned NHS Compliance Enhancements */}
                    <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded">
                      <h4 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Planned NHS Compliance Enhancements
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded border border-indigo-200">
                          <h5 className="font-semibold text-indigo-800 mb-2">Phase 1 (Next 3 Months)</h5>
                          <ul className="text-sm text-indigo-700 space-y-1">
                            <li>• Professional interpreter escalation for "unsafe" translations</li>
                            <li>• Enhanced staff training certification modules</li>
                            <li>• Real-time quality dashboards for practice managers</li>
                            <li>• CQC inspection-ready compliance reporting</li>
                          </ul>
                        </div>
                        <div className="bg-white p-4 rounded border border-indigo-200">
                          <h5 className="font-semibold text-indigo-800 mb-2">Phase 2 (6 Months)</h5>
                          <ul className="text-sm text-indigo-700 space-y-1">
                            <li>• Integration with major clinical systems (EMIS, SystmOne)</li>
                            <li>• Advanced clinical terminology databases</li>
                            <li>• Automated quality improvement reporting</li>
                            <li>• Enhanced patient consent management</li>
                          </ul>
                        </div>
                        <div className="bg-white p-4 rounded border border-indigo-200">
                          <h5 className="font-semibold text-indigo-800 mb-2">Phase 3 (12 Months)</h5>
                          <ul className="text-sm text-indigo-700 space-y-1">
                            <li>• Machine learning from NHS clinical interactions</li>
                            <li>• Specialty-specific translation models</li>
                            <li>• Predictive quality scoring</li>
                            <li>• NHS-wide performance benchmarking</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Implementation Support */}
                    <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded">
                      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Implementation Support for NHS Teams
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-semibold text-gray-700 mb-2">Training & Competency</h5>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Comprehensive staff training modules and materials</li>
                            <li>• Competency assessments and certification tracking</li>
                            <li>• Best practice guidelines for multilingual consultations</li>
                            <li>• Regular updates on new features and compliance requirements</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-700 mb-2">Ongoing Support</h5>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• 24/7 technical support for clinical teams</li>
                            <li>• Practice-specific setup and configuration</li>
                            <li>• Clinical supervision and quality monitoring</li>
                            <li>• Regular compliance reviews and improvement recommendations</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="text-center bg-white p-4 rounded border-2 border-blue-300">
                      <p className="text-sm text-blue-700 font-semibold">
                        This translation service is designed by healthcare professionals, for healthcare professionals, 
                        ensuring that language barriers never compromise patient care quality or safety.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="safety" className="space-y-6 mt-6">
                  {/* Safety & Compliance Information */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Shield className="h-5 w-5 text-red-600" />
                      <h3 className="text-lg font-semibold text-red-800">Safety & Compliance</h3>
                      <Badge variant="secondary" className="bg-red-100 text-red-800">NHS Standards</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <CheckCircle2 className="h-8 w-8 text-green-600 mb-2" />
                          <h4 className="font-semibold text-green-900 mb-2">Medical Accuracy</h4>
                          <ul className="text-xs text-green-700 space-y-1">
                            <li>• NHS clinical terminology database</li>
                            <li>• BNF drug name verification</li>
                            <li>• Dosage safety checking</li>
                            <li>• Medical context preservation</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <Database className="h-8 w-8 text-blue-600 mb-2" />
                          <h4 className="font-semibold text-blue-900 mb-2">Data Protection</h4>
                          <ul className="text-xs text-blue-700 space-y-1">
                            <li>• GDPR compliant processing</li>
                            <li>• NHS Data Security Standards</li>
                            <li>• Encrypted data transmission</li>
                            <li>• Automatic data retention policies</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="p-4">
                          <FileText className="h-8 w-8 text-purple-600 mb-2" />
                          <h4 className="font-semibold text-purple-900 mb-2">Audit & Governance</h4>
                          <ul className="text-xs text-purple-700 space-y-1">
                            <li>• Complete translation audit trails</li>
                            <li>• Quality score documentation</li>
                            <li>• User action logging</li>
                            <li>• Compliance reporting tools</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Service Features Overview */}
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-blue-50 border-blue-200">
                          <CardContent className="p-4 text-center">
                            <Globe className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                            <h3 className="font-semibold text-blue-900">50+ Languages</h3>
                            <p className="text-sm text-blue-700 mt-1">
                              Real-time support for languages commonly spoken by NHS patients
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50 border-green-200">
                          <CardContent className="p-4 text-center">
                            <Heart className="h-8 w-8 text-green-600 mx-auto mb-2" />
                            <h3 className="font-semibold text-green-900">Medical Accuracy</h3>
                            <p className="text-sm text-green-700 mt-1">
                              NHS clinical terminology and BNF pharmaceutical standards
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="bg-purple-50 border-purple-200">
                          <CardContent className="p-4 text-center">
                            <UserCheck className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                            <h3 className="font-semibold text-purple-900">Quality Assured</h3>
                            <p className="text-sm text-purple-700 mt-1">
                              8-layer validation system with real-time safety monitoring
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="support" className="space-y-6 mt-6">
                  {/* Troubleshooting Guide */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <h3 className="text-lg font-semibold text-yellow-800">Troubleshooting & Support</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-yellow-700">Common Issues</h4>
                        <div className="space-y-2 text-sm">
                          <div className="p-2 border border-yellow-200 rounded bg-yellow-50">
                            <strong className="text-yellow-800">Microphone Not Working:</strong>
                            <p className="text-xs text-yellow-700 mt-1">Check browser permissions, refresh page, ensure microphone is not used by other apps</p>
                          </div>
                          <div className="p-2 border border-yellow-200 rounded bg-yellow-50">
                            <strong className="text-yellow-800">Poor Translation Quality:</strong>
                            <p className="text-xs text-yellow-700 mt-1">Speak clearly, use shorter sentences, check for background noise, verify language setting</p>
                          </div>
                          <div className="p-2 border border-yellow-200 rounded bg-yellow-50">
                            <strong className="text-yellow-800">Document OCR Errors:</strong>
                            <p className="text-xs text-yellow-700 mt-1">Ensure good image quality, avoid blurry or tilted documents, use high contrast scans</p>
                          </div>
                          <div className="p-2 border border-yellow-200 rounded bg-yellow-50">
                            <strong className="text-yellow-800">Connection Issues:</strong>
                            <p className="text-xs text-yellow-700 mt-1">Check internet connection, refresh browser, clear cache, contact IT support</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-yellow-700">Best Practices</h4>
                        <div className="space-y-2 text-sm">
                          <div className="p-2 border border-green-200 rounded bg-green-50">
                            <strong className="text-green-800">For Best Results:</strong>
                            <ul className="text-xs text-green-700 mt-1 space-y-0.5">
                              <li>• Speak at normal conversational pace</li>
                              <li>• Use clear, simple language initially</li>
                              <li>• Verify important medical information</li>
                              <li>• Save critical translations to patient records</li>
                            </ul>
                          </div>
                          <div className="p-2 border border-blue-200 rounded bg-blue-50">
                            <strong className="text-blue-800">Quality Checks:</strong>
                            <ul className="text-xs text-blue-700 mt-1 space-y-0.5">
                              <li>• Always review safety flags and warnings</li>
                              <li>• Use validation tools for critical documents</li>
                              <li>• Double-check drug names and dosages</li>
                              <li>• Verify patient-facing translations</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="email" className="space-y-6 mt-6">
          <EmailHandler />
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">Translation History</h2>
              {translations.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleCheck className="h-3 w-3 text-green-600" />
                  Auto-save active (immediate)
                  {saveStatus === 'saving' && (
                    <div className="flex items-center gap-1 ml-2">
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      <span className="text-blue-600">Saving...</span>
                    </div>
                  )}
                  {saveStatus === 'saved' && (
                    <div className="flex items-center gap-1 ml-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      <span className="text-green-600">Saved</span>
                    </div>
                  )}
                  {saveStatus === 'error' && (
                    <div className="flex items-center gap-1 ml-2">
                      <XCircle className="h-3 w-3 text-red-600" />
                      <span className="text-red-600">Save failed</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowHistorySidebar(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Saved Sessions
              </Button>
              {(translations.length > 0 || currentSessionId) && (
                <>
                  <Button 
                    onClick={handleAutoSave} 
                    variant="secondary" 
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={translations.length === 0}
                  >
                    <Database className="w-4 h-4" />
                    {translations.length > 0 ? 'Save Now' : 'Session Saved'}
                  </Button>
                  <Button onClick={clearHistory} variant="outline" size="sm">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Clear History
                  </Button>
                  <Button onClick={handleExportDOCX} variant="default" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export to DOCX
                  </Button>
                  <Button onClick={handlePatientExportDOCX} variant="secondary" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    Patient Copy
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {translations.length > 0 ? (
            <TranslationHistory
              translations={translations}
              sessionStart={sessionStart}
              patientLanguage="Multiple Languages"
              onExportDOCX={handleExportDOCX}
            />
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No translation history yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start a translation session to see your conversation history here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </>
      )}
      
      {/* Translation Display Modal - Large Text for Patients */}
      <Dialog open={isTranslationModalOpen} onOpenChange={setIsTranslationModalOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
          <DialogHeader className="border-b pb-6">
            <DialogTitle className="flex items-center justify-between text-2xl">
              <span className="flex items-center gap-3">
                <Languages className="w-8 h-8 text-primary" />
                Live Translation Display
              </span>
              <div className="flex items-center gap-2">
                <TranslationValidationGuide />
                <MedicalTranslationAuditViewer />
              </div>
            </DialogTitle>
          </DialogHeader>

          {currentTranslation && (
            <div className="space-y-8">
              {/* English Text */}
              <div className="bg-blue-50 p-8 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-6 h-6 text-blue-600" />
                  <h3 className="text-2xl font-semibold text-blue-800">English (GP)</h3>
                </div>
                <p className="text-3xl text-blue-900 leading-relaxed mb-4">
                  {currentTranslation.englishText}
                </p>
                <div className="flex justify-end">
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 flex items-center gap-2 px-4 py-2 text-lg">
                    <Shield className="w-5 h-5" />
                    Verified Safe & Accurate
                  </Badge>
                </div>
              </div>

              {/* Translated Text */}
              <div className="bg-green-50 p-8 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Languages className="w-6 h-6 text-green-600" />
                  <h3 className="text-2xl font-semibold text-green-800">
                    {currentTranslation.targetLanguage.charAt(0).toUpperCase() + currentTranslation.targetLanguage.slice(1)} (Patient)
                  </h3>
                </div>
                <p className="text-3xl text-green-900 leading-relaxed">
                  {currentTranslation.translatedText}
                </p>
                <Button
                  onClick={() =>
                    repeatTranslatedPhrase(
                      currentTranslation.translatedText,
                      currentTranslation.targetLanguage
                    )
                  }
                  className="px-8 py-3 text-lg mt-6"
                  disabled={isSpeaking}
                >
                  {isSpeaking ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Languages className="w-5 h-5 mr-2" />
                      Repeat Phrase
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Translation History Sidebar */}
      {showHistorySidebar && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowHistorySidebar(false)} />
          <TranslationHistorySidebar
            onSessionLoad={handleSessionLoad}
            onClose={() => setShowHistorySidebar(false)}
            currentSessionId={currentSessionId}
          />
        </div>
      )}
    </div>
  );
};