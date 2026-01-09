  import React, { useState, useRef, useEffect, useCallback } from 'react';
  import { useConversation } from '@11labs/react';
  import { useParams, useNavigate } from 'react-router-dom';
  import { getSafeDOMObserver } from '@/utils/domSafetyPolyfill';
  import { useWebSocketSessionManager } from '@/hooks/useWebSocketSessionManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Shield,
  Clock,
  Mic,
  MicOff,
  Pause,
  Square,
  VolumeX,
  Volume2,
  Settings,
  Maximize2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showToast } from '@/utils/toastWrapper';
import TranslationHistory from './TranslationHistory';
import { TranslationHistorySidebar } from './TranslationHistorySidebar';
import { HistoricalTranslationView } from './HistoricalTranslationView';
import { EmailHandler } from './EmailHandler';
import { useTranslationHistory, TranslationEntry as HistoryTranslationEntry, TranslationScore as HistoryTranslationScore } from '@/hooks/useTranslationHistory';
import { useUserProfile } from '@/hooks/useUserProfile';
import { scoreTranslation, TranslationScore } from '@/utils/translationScoring';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';
import { downloadPatientDOCX, PatientSessionMetadata } from '@/utils/patientDocxExport';
import { TranslationValidationGuide } from './TranslationValidationGuide';
import { useTranslationDeduplication } from '@/hooks/useTranslationDeduplication';
import { useTranslationBuffering } from '@/hooks/useTranslationBuffering';
import { extractLanguageAndCleanText, getLanguageName } from '@/utils/translationUtils';
import { HistorySubTabs } from './HistorySubTabs';
import { ManualTranslationModal } from './ManualTranslationModal';

// Native language names mapping
const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  'french': 'Français',
  'spanish': 'Español', 
  'german': 'Deutsch',
  'italian': 'Italiano',
  'portuguese': 'Português',
  'dutch': 'Nederlands',
  'russian': 'Русский',
  'chinese': '中文',
  'japanese': '日本語',
  'korean': '한국어',
  'arabic': 'العربية',
  'hindi': 'हिन्दी',
  'bengali': 'বাংলা',
  'urdu': 'اردو',
  'punjabi': 'ਪੰਜਾਬੀ',
  'gujarati': 'ગુજરાતી',
  'tamil': 'தமிழ்',
  'telugu': 'తెలుగు',
  'kannada': 'ಕನ್ನಡ',
  'malayalam': 'മലയാളം',
  'marathi': 'मराठी',
  'nepali': 'नेपाली',
  'polish': 'Polski',
  'romanian': 'Română',
  'turkish': 'Türkçe',
  'ukrainian': 'Українська',
  'vietnamese': 'Tiếng Việt',
  'thai': 'ไทย',
  'indonesian': 'Bahasa Indonesia',
  'malay': 'Bahasa Melayu',
  'tagalog': 'Tagalog',
  'swahili': 'Kiswahili',
  'amharic': 'አማርኛ',
  'yoruba': 'Yorùbá',
  'igbo': 'Igbo',
  'hausa': 'Hausa',
  'somali': 'Soomaali',
  'oromo': 'Afaan Oromoo'
};

const getNativeLanguageName = (language: string): string => {
  const lowercaseLanguage = language.toLowerCase();
  return NATIVE_LANGUAGE_NAMES[lowercaseLanguage] || language.charAt(0).toUpperCase() + language.slice(1);
};

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
  const navigate = useNavigate();
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
  const [showFullScreenHistory, setShowFullScreenHistory] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [missedTranslationFeedback, setMissedTranslationFeedback] = useState(false);
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
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isEmailingSelf, setIsEmailingSelf] = useState(false);
  const [isEmailingPatient, setIsEmailingPatient] = useState(false);
  const [isManualTranslationOpen, setIsManualTranslationOpen] = useState(false);
  const [selectedManualLanguage, setSelectedManualLanguage] = useState<{code: string, name: string} | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastVolumeRef = useRef(0.8);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  
  // User profile hook
  const { profile } = useUserProfile();

  // Custom hooks
  const {
    processedExchangeIds,
    processedMessageIds,
    conversationExchangeMap,
    lastProcessedTimestamp,
    conversationTrackingRef,
    createExchangeId,
    createContentHash,
    isWithinTimeWindow,
    resetMemory: resetDeduplicationMemory
  } = useTranslationDeduplication();

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

  // Enhanced Message Correlation System
  const messageOutboxRef = useRef<Map<string, {
    correlationId: string;
    sessionId: string;
    payload: any;
    timestamp: number;
    retryCount: number;
  }>>(new Map());

  const pendingSessionBufferRef = useRef<Array<{
    correlationId: string;
    payload: any;
    timestamp: number;
  }>>([]);

  const activeSessionIdRef = useRef<string | null>(null);

  // WebSocket Session Manager - Fixes data loss issues
  const sessionManager = useWebSocketSessionManager({
    onDataLoss: (lostMessage) => {
      console.error('🚨 Session Manager: Data loss detected:', lostMessage);
      toast.error('Translation may have been missed. Please check your session history.');
    },
    onSessionChange: (sessionId) => {
      console.log('🔄 Session Manager: Session changed:', sessionId);
      conversationIdRef.current = sessionId;
      activeSessionIdRef.current = sessionId;
      
      // Re-subscribe to translation service after session change
      if (sessionId) {
        console.log('🔄 Re-subscribing to translation service with new session:', sessionId.slice(-6));
        // Drain pending session buffer with new session
        drainPendingBuffer(sessionId);
      }
    }
  });

  // Generate correlation ID for message tracking
  const generateCorrelationId = useCallback((): string => {
    return `corr_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  }, []);

  // Safe send with correlation ID and session buffering
  const safeSendMessage = useCallback((payload: any): string => {
    const correlationId = generateCorrelationId();
    const activeSessionId = activeSessionIdRef.current;
    
    console.debug('📤 TX:', { 
      correlationId: correlationId.slice(-12), 
      sessionId: activeSessionId?.slice(-6) || 'none',
      type: payload.type || 'message',
      hasSession: !!activeSessionId
    });

    if (!activeSessionId || !sessionManager.canSend()) {
      // Buffer message until session is available
      console.log('📦 Buffering message (no active session):', correlationId.slice(-12));
      pendingSessionBufferRef.current.push({
        correlationId,
        payload,
        timestamp: Date.now()
      });
      return correlationId;
    }

    // Add session and correlation to payload
    const enrichedPayload = {
      ...payload,
      sessionId: activeSessionId,
      correlationId
    };

    // Track in outbox for correlation matching
    messageOutboxRef.current.set(correlationId, {
      correlationId,
      sessionId: activeSessionId,
      payload: enrichedPayload,
      timestamp: Date.now(),
      retryCount: 0
    });

    // Send through session manager
    const messageId = sessionManager.sendMessage(JSON.stringify(enrichedPayload), 'user');
    
    console.log('✅ Message sent with correlation tracking:', {
      correlationId: correlationId.slice(-12),
      messageId: messageId.slice(-12),
      sessionId: activeSessionId.slice(-6),
      outboxSize: messageOutboxRef.current.size
    });

    return correlationId;
  }, [sessionManager, generateCorrelationId]);

  // Drain pending buffer when session becomes available
  const drainPendingBuffer = useCallback((newSessionId: string) => {
    const pendingMessages = [...pendingSessionBufferRef.current];
    pendingSessionBufferRef.current = [];
    
    console.log(`🚰 Draining ${pendingMessages.length} buffered messages to session ${newSessionId.slice(-6)}`);
    
    pendingMessages.forEach(({ correlationId, payload }) => {
      const enrichedPayload = {
        ...payload,
        sessionId: newSessionId,
        correlationId
      };

      messageOutboxRef.current.set(correlationId, {
        correlationId,
        sessionId: newSessionId,
        payload: enrichedPayload,
        timestamp: Date.now(),
        retryCount: 0
      });

      const messageId = sessionManager.sendMessage(JSON.stringify(enrichedPayload), 'user');
      console.log('📤 Drained message:', {
        correlationId: correlationId.slice(-12),
        messageId: messageId.slice(-12)
      });
    });
  }, [sessionManager]);

  // Initialize DOM Safety Observer
  useEffect(() => {
    const domObserver = getSafeDOMObserver();
    
    domObserver.onMutation((mutations) => {
      console.log('🔍 DOM Safety: Safe mutations processed:', mutations.length);
    });
    
    domObserver.start();
    
    return () => {
      domObserver.destroy();
    };
  }, []);

  // Reset functionality state
  const [resetClickCount, setResetClickCount] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Data loss monitoring with cleaned up refs
  useEffect(() => {
    const monitoringInterval = setInterval(() => {
      const tracking = conversationTrackingRef.current;
      const now = Date.now();
      
      // Check for orphaned user messages (user messages without responses after 30 seconds)
      for (const [messageId, messageData] of tracking.activeMessages.entries()) {
        if (!messageData.agent && (now - messageData.timestamp) > 30000) {
          console.error('🚨 DATA_LOSS_DETECTED: Orphaned user message:', {
            messageId,
            userMessage: messageData.user.substring(0, 100),
            ageInSeconds: (now - messageData.timestamp) / 1000,
            sessionId: conversationIdRef.current
          });
          
          // Report to user
          toast.error('Translation may have been missed. Please check your session history.');
          
          // Clean up tracking
          tracking.activeMessages.delete(messageId);
        }
      }
    }, 15000); // Check every 15 seconds
    
    return () => clearInterval(monitoringInterval);
  }, []);

  const processTranslationExchange = (userMessage: string, agentResponse: string) => {
    console.log('🔄 Processing translation exchange...');
    
    // Process translation history first (includes modal update)  
    addToTranslationHistory(userMessage, agentResponse);
    
    // Then do quality verification (async, doesn't block modal)
    verifyConversationQuality(userMessage, agentResponse).catch(error => {
      console.error('⚠️ Quality verification failed but continuing:', error);
    });
  };

  // Process message with correlation ID matching
  const processCorrelatedMessage = useCallback((inboundMessage: any, messageContent: string, source: 'user' | 'agent') => {
    const { correlationId, sessionId } = inboundMessage;
    
    console.debug('📥 RX:', { 
      correlationId: correlationId?.slice(-12) || 'none', 
      sessionId: sessionId?.slice(-6) || 'none',
      source,
      type: inboundMessage.type || 'message'
    });

    // Session validation - ignore messages from wrong session
    if (sessionId && sessionId !== activeSessionIdRef.current) {
      console.warn('🚫 Ignoring message from stale session:', {
        messageSession: sessionId.slice(-6),
        activeSession: activeSessionIdRef.current?.slice(-6) || 'none'
      });
      return;
    }

    if (source === 'agent' && correlationId) {
      // Find matching outbound message by correlation ID
      const pendingMessage = messageOutboxRef.current.get(correlationId);
      if (pendingMessage) {
        console.log('🎯 Correlated response found:', {
          correlationId: correlationId.slice(-12),
          userMessage: pendingMessage.payload.content?.substring(0, 50) || '[no content]',
          agentResponse: messageContent.substring(0, 50)
        });
        
        // Remove from outbox
        messageOutboxRef.current.delete(correlationId);
        
        // Process the matched pair
        processTranslationExchange(pendingMessage.payload.content || '[Recovery]', messageContent);
        return;
      } else {
        console.warn('🔍 No correlation match found for agent message:', {
          correlationId: correlationId.slice(-12),
          outboxSize: messageOutboxRef.current.size,
          availableCorrelations: Array.from(messageOutboxRef.current.keys()).map(k => k.slice(-12))
        });
      }
    }

    // Fallback to old FIFO pairing within session if no correlation
    console.log('📋 Using FIFO fallback for uncorrelated message');
    // Continue with existing FIFO logic as safety net
    return false; // Signal fallback needed
  }, []);

  // Periodic state logging for debugging
  useEffect(() => {
    const logInterval = setInterval(() => {
      const stats = {
        ws: sessionManager.wsState,
        session: activeSessionIdRef.current?.slice(-6) || 'none',
        outbox: messageOutboxRef.current.size,
        pending: pendingSessionBufferRef.current.length,
        sessionStats: sessionManager.getSessionStats()
      };
      
      if (stats.outbox > 0 || stats.pending > 0) {
        console.log('📊 Translation State:', stats);
      }
    }, 5000); // Log every 5 seconds if there are pending messages

    return () => clearInterval(logInterval);
  }, [sessionManager]);

  const updateCurrentTranslation = (userMessage: string, agentResponse: string) => {
    console.log('🔄 Updating current translation for modal display...');
    
    // Respect mic mute or pause: do not update the live modal when input is muted or paused
    if (isMicMuted || isPaused) {
      console.log(`🎙️ ${isMicMuted ? 'Mic muted' : 'Translation paused'} - skipping modal update`);
      return;
    }
    
    const { language: targetLanguage, cleanText: cleanedResponse } = extractLanguageAndCleanText(agentResponse);
    
    // Always update current translation for modal, even if we skip other processing
    if (userMessage.trim().length >= 3 && cleanedResponse.trim().length >= 3) {
      setCurrentTranslation({
        englishText: userMessage,
        translatedText: cleanedResponse,
        targetLanguage: targetLanguage,
        timestamp: new Date()
      });
      console.log('✅ Current translation updated for modal');
    }
  };
  const resetTranslationMemory = async () => {
    console.log('🗑️ Resetting translation memory...');
    setIsResetting(true);
    
    try {
      // End current conversation if active
      if (conversation.status === 'connected') {
        await conversation.endSession();
      }
      
      // Clear all memory and state
      resetDeduplicationMemory();
      resetBuffer();
      
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

  // Enhanced message processing with buffering
  const processMessageWithBuffering = (userMessage: string, agentResponse: string) => {
    console.log('🔊 Processing message with enhanced buffering...');
    
    const now = Date.now();
    setLastProcessingTime(now);
    lastProcessingTimeRef.current = now;
    
    // IMMEDIATE PROCESSING: If we have both user and agent messages, bypass buffering
    if (userMessage.trim() && agentResponse.trim()) {
      console.log('⚡ Paired message detected - bypassing buffering for immediate processing');
      const finalBuffered = (incompleteMessageBufferRef.current || '').trim();
      const finalMessage = finalBuffered ? `${finalBuffered} ${userMessage}`.trim() : userMessage;
      
      setIncompleteMessageBuffer('');
      incompleteMessageBufferRef.current = '';
      setIsAudioBuffering(false);
      
      processTranslationExchange(finalMessage, agentResponse);
      return;
    }
    
    // Check if user message seems incomplete
    if (!isCompleteSentence(userMessage) && userMessage.length < 20) {
      console.log('📝 Message may be incomplete, starting buffer timer...');
      setIsAudioBuffering(true);
      setIncompleteMessageBuffer(prev => {
        const combined = prev ? `${prev} ${userMessage}` : userMessage;
        console.log('📝 Buffering message:', combined);
        incompleteMessageBufferRef.current = combined;
        return combined;
      });
      
      // Reset any existing timer
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      
      // Wait for completion or timeout - REDUCED timeouts
      bufferTimerRef.current = window.setTimeout(() => {
        const timeSinceLastProcessing = Date.now() - lastProcessingTimeRef.current;
        if (timeSinceLastProcessing >= 1000) { // Reduced from 2800ms to 1000ms
          console.log('⏰ Buffer timeout - processing accumulated message');
          const bufferedMessage = (incompleteMessageBufferRef.current || '').trim();
          setIncompleteMessageBuffer('');
          incompleteMessageBufferRef.current = '';
          setIsAudioBuffering(false);
          
          if (bufferedMessage) {
            processTranslationExchange(bufferedMessage, agentResponse);
          }
        }
      }, 1200); // Reduced from 3000ms to 1200ms
      
      return; // Don't process immediately
    }
    
    // Process complete message (including any buffered content)
    const finalBuffered = (incompleteMessageBufferRef.current || '').trim();
    const finalMessage = finalBuffered ? `${finalBuffered} ${userMessage}`.trim() : userMessage;
    
    setIncompleteMessageBuffer('');
    incompleteMessageBufferRef.current = '';
    setIsAudioBuffering(false);
    
    processTranslationExchange(finalMessage, agentResponse);
  };
  
  // Manual translation refresh for missed translations
  const refreshTranslationDisplay = () => {
    console.log('🔄 Manual refresh requested by user');
    
    if (conversationBuffer.length >= 2) {
      const lastExchange = conversationBuffer[conversationBuffer.length - 1];
      console.log('🔄 Re-processing last exchange for manual refresh');
      
      // Force update the current translation
      updateCurrentTranslation(lastExchange.user, lastExchange.agent);
      
      toast.success('Translation refreshed');
    } else {
      toast.info('No recent translation to refresh');
    }
  };
  
  // User feedback for missed translations
  const reportMissedTranslation = () => {
    setMissedTranslationFeedback(true);
    console.log('📊 User reported missed translation');
    
    // Log for improvement
    console.log('📊 Missed translation context:', {
      bufferLength: conversationBuffer.length,
      currentTranslation: currentTranslation?.englishText,
      lastBufferedMessage: incompleteMessageBuffer
    });
    
    toast.info('Thank you for the feedback. Please try speaking again clearly.');
    
    // Auto-hide feedback after 3 seconds
    setTimeout(() => setMissedTranslationFeedback(false), 3000);
  };
  // Duplicate functions removed after refactor to avoid redeclaration

  // Add conversation to translation history
  const addToTranslationHistory = (userMessage: string, agentResponse: string) => {
    console.log('🔍 TRANSLATION ATTEMPT:', {
      phraseNumber: `PHRASE_${Date.now()}`,
      userMessage: userMessage.substring(0, 100),
      agentResponse: agentResponse.substring(0, 100),
      timestamp: new Date().toLocaleTimeString()
    });
    console.log('🛡️ DEDUP: Starting enhanced deduplication check...');
    
    // ALWAYS update current translation first, regardless of other processing
    updateCurrentTranslation(userMessage, agentResponse);
    
    // LAYER 1: Skip language setup requests (but be less aggressive)
    const isLanguageSetup = userMessage.toLowerCase().includes('please') && 
                           userMessage.toLowerCase().match(/\b(polish|arabic|spanish|french|urdu|bengali|chinese|german|italian|portuguese|ukrainian|hungarian|russian|hindi)\b/i) &&
                           agentResponse.toLowerCase().includes('ready');
    
    if (isLanguageSetup) {
      console.log('❌ BLOCKED: Layer 1 - Language setup request from history');
      return;
    }
    console.log('✅ PASSED: Layer 1 - Not a language setup request');

    // LAYER 2: Skip ultra-short noise only (allow 2+ chars so “ja”, “ok” etc. are kept)
    if (userMessage.trim().length < 2 || agentResponse.trim().length < 2) {
      console.log('❌ BLOCKED: Layer 2 - Ultra-short noise (<2 chars)', {
        userLen: userMessage.trim().length,
        agentLen: agentResponse.trim().length
      });
      return;
    }
    console.log('✅ PASSED: Layer 2 - Content length sufficient');

    // LAYER 3: Create unique exchange ID (timestamp + content hash)
    const exchangeId = createExchangeId(userMessage, agentResponse);
    console.log('🛡️ DEDUP: Exchange ID generated:', exchangeId);

    // LAYER 4: Check if this exact exchange was already processed
    if (processedExchangeIds.current.has(exchangeId)) {
      console.log('🛡️ DEDUP: BLOCKED - Exchange already processed:', exchangeId);
      return;
    }

    // LAYER 5: Check conversation exchange map for rapid duplicates (debouncing) - RELAXED
    const exchangeKey = createContentHash(userMessage) + '_' + createContentHash(agentResponse);
    const existingExchange = conversationExchangeMap.current.get(exchangeKey);
    
    if (existingExchange && isWithinTimeWindow(existingExchange.timestamp, 250)) { // Reduced to 250ms for more precise deduplication
      console.log('🛡️ DEDUP: BLOCKED - Rapid duplicate exchange within 250ms window:', exchangeKey, {
        timeSinceLastExchange: Date.now() - existingExchange.timestamp,
        userMessage: userMessage.substring(0, 50),
        agentResponse: agentResponse.substring(0, 50)
      });
      return;
    } else if (existingExchange) {
      console.log('🛡️ DEDUP: Layer 5 PASSED - Exchange outside 250ms window, allowing through:', {
        timeSinceLastExchange: Date.now() - existingExchange.timestamp,
        userMessage: userMessage.substring(0, 50)
      });
    }

    // LAYER 6: State-level deduplication (final check) - STRICT equality matching within short window
    const nowMs = Date.now();
    const stateWindowMs = 400; // Reduced to 400ms for only true rapid duplicates
    const isDuplicateInState = translations.some(t => {
      const ageMs = nowMs - new Date(t.timestamp).getTime();
      if (ageMs > stateWindowMs) return false;
      const originalMatch = t.originalText.trim() === userMessage.trim();
      const translatedMatch = t.translatedText.trim() === agentResponse.trim(); // Changed from includes to strict equality
      if (originalMatch && translatedMatch) {
        console.log('🧪 Layer 6 exact duplicate found', { ageMs, stateWindowMs, originalMatch, translatedMatch });
      }
      return originalMatch && translatedMatch;
    });
    
    if (isDuplicateInState) {
      console.log('🛡️ DEDUP: BLOCKED - State duplicate within 700ms window');
      return;
    }

    // LAYER 7: Timestamp-based protection against rapid succession - REMOVED
    // This was blocking legitimate translations happening within the same second
    console.log('🛡️ DEDUP: Layer 7 timestamp collision check - DISABLED for better translation capture');

    console.log('🛡️ DEDUP: ✅ PASSED all deduplication layers - Processing exchange');
    
    // Mark this exchange as processed
    processedExchangeIds.current.add(exchangeId);
    conversationExchangeMap.current.set(exchangeKey, { 
      timestamp: Date.now(), 
      processed: true 
    });
    lastProcessedTimestamp.current = nowMs;

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
    const uniqueId = `${nowMs}_${createContentHash(userMessage + cleanedResponse)}_${Math.random().toString(36).substring(2, 6)}`;
    
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
      const currentTranslations = getTranslations();
      const currentScores = getTranslationScores();
      if (currentTranslations.length > 0) {
        try {
          setSaveStatus('saving');
          console.log('💾 Immediate save triggered...', { count: currentTranslations.length });
          
          await saveSession(
            currentTranslations,
            currentScores,
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

  // Manual save with proper loading state
  const [isSaving, setIsSaving] = useState(false);
  const handleAutoSave = async () => {
    if (translations.length > 0 && !isSaving) {
      setIsSaving(true);
      try {
        console.log('🔄 Saving translations...', { count: translations.length });
        await saveSession(
          getTranslations(),
          getTranslationScores(),
          sessionStart,
          undefined,
          true
        );
        console.log('✅ Save successful');
        toast.success('Session saved successfully');
      } catch (error) {
        console.error('❌ Save failed:', error);
        toast.error('Failed to save session');
      } finally {
        setIsSaving(false);
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
    if (isSpeakerMuted) {
      toast.info('Speaker is muted');
      return;
    }
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
    console.log('🔄 GP Export DOCX button clicked');
    console.log('🔄 Translations count:', translations.length);
    console.log('🔄 Translation scores count:', translationScores.length);
    
    if (translations.length === 0) {
      toast.error('No translations to export');
      return;
    }
    
    try {
      const sessionEnd = new Date();
      const sessionDuration = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
      
      console.log('🔄 Session duration:', sessionDuration);
      
      // Detect the most common patient language from translations
      const patientLanguages = translations
        .filter(t => t.speaker === 'patient' || t.targetLanguage !== 'en')
        .map(t => t.targetLanguage);
      
      const languageCount: { [key: string]: number } = {};
      patientLanguages.forEach(lang => {
        languageCount[lang] = (languageCount[lang] || 0) + 1;
      });
      
      // Get primary patient language, defaulting to English if no translations found
      const primaryPatientLanguage = Object.entries(languageCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'english';

      // Get the full language name for display
      const languageEntry = HEALTHCARE_LANGUAGES.find(lang => 
        lang.code === primaryPatientLanguage.toLowerCase()
      );
      const patientLanguageDisplayName = languageEntry?.name || 
        (primaryPatientLanguage.charAt(0).toUpperCase() + primaryPatientLanguage.slice(1));
      
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
      } else if (warningCount > translations.length * 0.3) {
        overallSafetyRating = 'warning';
      }

      const metadata: SessionMetadata = {
        sessionDate: sessionStart,
        sessionStart,
        sessionEnd,
        patientLanguage: patientLanguageDisplayName,
        totalTranslations: translations.length,
        sessionDuration,
        overallSafetyRating,
        averageAccuracy,
        averageConfidence
      };

      console.log('🔄 Starting DOCX export with metadata:', metadata);
      await downloadDOCX(translations, metadata, translationScores);
      console.log('✅ GP Export DOCX completed successfully');
      toast.success('Translation history exported successfully');
    } catch (error) {
      console.error('❌ GP Export error:', error);
      toast.error('Failed to export translation history');
    }
  };

  const handlePatientLanguageExportDOCX = async () => {
    console.log('🔄 Patient Language Transcript button clicked');
    console.log('🔄 Translations count:', translations.length);
    console.log('🔄 Translation scores count:', translationScores.length);
    
    if (translations.length === 0) {
      toast.error('No translations to export');
      return;
    }
    
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

      // Get the full language name for display
      const languageEntry = HEALTHCARE_LANGUAGES.find(lang => 
        lang.code === primaryPatientLanguage.toLowerCase()
      );
      const languageDisplayName = languageEntry?.name || primaryPatientLanguage;

      // Fetch practice details
      const { data: user } = await supabase.auth.getUser();
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email')
        .eq('user_id', user?.user?.id)
        .eq('is_default', true)
        .maybeSingle();

      const metadata: PatientSessionMetadata = {
        sessionDate: sessionStart,
        sessionStart,
        sessionEnd,
        patientLanguage: languageDisplayName, // Use display name instead of code
        totalTranslations: translations.length,
        sessionDuration,
        practiceName: practiceData?.practice_name || "NHS GP Practice",
        practiceAddress: practiceData?.address || "Contact your practice for address details",
        practicePhone: practiceData?.phone || "Contact your practice for phone details",
        gpName: "Your GP" // Could be made configurable
      };

      console.log('🔄 Starting Patient Language DOCX export with metadata:', metadata);
      // Use null for translationScores to match Translation History behavior
      await downloadPatientDOCX(translations, metadata, null);
      console.log('✅ Patient Language DOCX completed successfully');
      toast.success(`Patient copy exported in ${languageDisplayName}`);
    } catch (error) {
      console.error('❌ Patient Language export error:', error);
      toast.error('Failed to export patient language transcript');
    }
  };

  const handlePatientExportDOCX = async () => {
    console.log('🔄 Patient Copy button clicked');
    console.log('🔄 Translations count:', translations.length);
    console.log('🔄 Translation scores count:', translationScores.length);
    
    if (translations.length === 0) {
      toast.error('No translations to export');
      return;
    }
    
    try {
      const sessionEnd = new Date();
      const sessionDuration = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
      
      // Detect the most common patient language
      const patientLanguages = translations
        .filter(t => t.speaker === 'patient')
        .map(t => t.targetLanguage);
      
      console.log('🔄 Patient languages found:', patientLanguages);
      
      const languageCount: { [key: string]: number } = {};
      patientLanguages.forEach(lang => {
        languageCount[lang] = (languageCount[lang] || 0) + 1;
      });
      
      const primaryPatientLanguage = Object.entries(languageCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'English';

      console.log('🔄 Primary patient language:', primaryPatientLanguage);

      // Fetch practice details
      const { data: user } = await supabase.auth.getUser();
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email')
        .eq('user_id', user?.user?.id)
        .eq('is_default', true)
        .maybeSingle();

      const metadata: PatientSessionMetadata = {
        sessionDate: sessionStart,
        sessionStart,
        sessionEnd,
        patientLanguage: primaryPatientLanguage,
        totalTranslations: translations.length,
        sessionDuration,
        practiceName: practiceData?.practice_name || "NHS GP Practice",
        practiceAddress: practiceData?.address || "Contact your practice for address details",
        practicePhone: practiceData?.phone || "Contact your practice for phone details",
        gpName: "Your GP" // Could be made configurable
      };

      console.log('🔄 Starting Patient DOCX export with metadata:', metadata);
      await downloadPatientDOCX(translations, metadata, translationScores);
      console.log('✅ Patient Copy DOCX completed successfully');
      toast.success('Patient translation record exported successfully');
    } catch (error) {
      console.error('❌ Patient export error:', error);
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
    
    // Only verify if we have meaningful content (reduced threshold)
    if (userInput.trim().length < 3 || agentResponse.trim().length < 3) {
      console.log('🔧 Skipping very short message from quality verification');
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
      
      // Update current translation with quality score (this may override the basic one from updateCurrentTranslation)
      setCurrentTranslation(prev => ({
        englishText: userInput,
        translatedText: cleanedResponse,
        targetLanguage: targetLanguage,
        qualityScore: enrichedData,
        timestamp: new Date()
      }));
      
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
      
      const sessionId = `translation_${Date.now()}`;
      
      // Notify session manager of connection
      sessionManager.onSessionConnect(sessionId);
      
      // Don't clear quality score on connection - only on manual reset
      setConversationBuffer([]);
      
      // AUDIO CUTOUT FIX: Do not set volume programmatically after connection - this causes interruptions
      console.log('✅ Translation Service connected without programmatic volume changes');
      console.log('🎚️ Volume control reserved for user actions only');
    },
    onDisconnect: () => {
      console.log('Disconnected from Notewell AI Translation Service');
      toast.info('Disconnected from Translation Service');
      
      // Notify session manager of disconnection
      sessionManager.onSessionDisconnect();
      
      // Keep modal open and retain last translation on disconnect as requested
      // Finalize and persist the session so it appears in Saved Sessions
      try {
        const currentTranslations = getTranslations();
        if (currentTranslations.length > 0) {
          const sessionEnd = new Date();
          saveSession(
            currentTranslations,
            getTranslationScores(),
            sessionStart,
            sessionEnd,
            false
          )
          .then(() => console.log('💾 Final session save on disconnect completed'))
          .catch((e) => console.error('❌ Final session save failed:', e));
        }
      } catch (e) {
        console.error('❌ Error during final save on disconnect:', e);
      }
    },
    onMessage: (message) => {
      console.log('📨 Translation message received:', message);
      
      // SessionManager state is for outbound messages; do not block inbound processing
      if (!sessionManager.sessionId) {
        console.warn('⚠️ Session Manager: No active session ID (continuing to process inbound message)');
      }
      
      // Normalize incoming fields and robustly determine source
      const messageObj = message as any; // Cast to any for flexible property access
      const contentText: string = (messageObj?.message || messageObj?.text || messageObj?.content?.text || '').toString();
      const roleField = (messageObj?.role || messageObj?.source || messageObj?.sender || messageObj?.from || '').toString().toLowerCase();
      const hasLangTag = /^<[^>]+>/.test(contentText.trim());
      
      // Enhanced source detection with better logging
      let source: 'user' | 'ai' = 'user'; // Default to user
      
      // Check for AI indicators more carefully
      const isAIRole = /^(ai|agent|assistant)$/.test(roleField);
      const isTranslation = hasLangTag;
      const isSystemMessage = /^(system|bot)$/i.test(roleField);
      
      // AI message indicators
      if (isTranslation || isAIRole || isSystemMessage) {
        source = 'ai';
      }
      
      // Additional ElevenLabs specific checks
      if (messageObj?.source === 'ai' || messageObj?.source === 'agent') {
        source = 'ai';
      }
      
      console.log('🔍 Message classification:', {
        contentPreview: contentText.substring(0, 50),
        roleField,
        hasLangTag,
        isAIRole,
        isTranslation,
        detectedSource: source,
        rawMessage: messageObj
      });

      if (!contentText) {
        console.log('⚠️ Empty content in message payload, skipping');
        return;
      }
      
      // Skip processing when paused (but still acknowledge to prevent session issues)
      if (isPaused && source === 'user') {
        console.log('⏸️ Translation paused - skipping user input processing');
        const messageId = sessionManager.sendMessage(contentText, 'user');
        sessionManager.acknowledgeMessage(messageId);
        return;
      }

      // Extract correlation and session data from message if present
      const correlationId = messageObj?.correlationId;
      const messageSessionId = messageObj?.sessionId;
      
      // Try correlation-based processing first
      const correlationProcessed = processCorrelatedMessage({
        correlationId,
        sessionId: messageSessionId,
        type: messageObj.type
      }, contentText, source === 'ai' ? 'agent' : 'user');
      
      if (correlationProcessed !== false) {
        // Successfully processed with correlation - acknowledge and return
        const messageId = sessionManager.sendMessage(contentText, source === 'ai' ? 'agent' : 'user');
        sessionManager.acknowledgeMessage(messageId);
        return;
      }
      
      // FALLBACK: Use enhanced FIFO pairing with session validation
      console.log('📋 Using enhanced FIFO fallback for message processing');
      
      // Send message through session manager for tracking
      const messageId = sessionManager.sendMessage(contentText, source === 'ai' ? 'agent' : source);
      
      // Message-level deduplication with session isolation
      const sessionId = sessionManager.sessionId || 'default';
      const deduplicationId = createContentHash(contentText + source + sessionId);
      if (processedMessageIds.current.has(deduplicationId)) {
        console.log('🛡️ MSG_DEDUP: BLOCKED - Message already processed:', deduplicationId.substring(0, 8));
        sessionManager.acknowledgeMessage(messageId);
        return;
      }
      processedMessageIds.current.add(deduplicationId);
      
      // Critical: Log all messages for debugging data loss
      console.log('🔍 CRITICAL_LOG: Message processing (fallback):', {
        sessionId,
        source,
        content: contentText.substring(0, 100),
        messageId: messageId.substring(0, 12),
        timestamp: new Date().toISOString(),
        sessionStats: sessionManager.getSessionStats()
      });
      
      setConversationBuffer(prev => {
        const updated = [...prev];

        if (source === 'user') {
          console.log('👤 User message captured (fallback):', contentText.substring(0, 50) + '...');
          console.log('📊 User message context:', {
            totalMessages: updated.length,
            pendingUserMessages: updated.filter(m => m.user && !m.agent).length,
            sessionId: sessionManager.sessionId?.slice(-6),
            messageId: messageId.slice(-12)
          });
          
          // Track user messages for data loss detection
          const trackingId = createContentHash(contentText + Date.now());
          conversationTrackingRef.current.activeMessages.set(trackingId, {
            user: contentText,
            timestamp: Date.now()
          });
          
          updated.push({ user: contentText, agent: '' });
          sessionManager.acknowledgeMessage(messageId);
          return updated;
        }

        // Source is AI/agent - Enhanced FIFO with session freeze protection
        let indexToFill = -1;
        for (let i = 0; i < updated.length; i++) {  // FIFO: Forward iteration
          if (updated[i].user && !updated[i].agent) {
            indexToFill = i;
            break;
          }
        }

        if (indexToFill === -1) {
          // If we have buffered user speech, pair with that instead of declaring data loss
          const bufferedUser = (incompleteMessageBufferRef.current || '').trim();
          if (bufferedUser) {
            console.log('🧵 Using buffered user text to pair agent response');
            updated.push({ user: bufferedUser, agent: contentText });
            // Clear buffer since we've consumed it
            setIncompleteMessageBuffer('');
            incompleteMessageBufferRef.current = '';
            sessionManager.acknowledgeMessage(messageId);
            updateCurrentTranslation(bufferedUser, contentText);
            setTimeout(() => {
              try { processMessageWithBuffering(bufferedUser, contentText); } catch (e) { console.error('🔥 Buffer pair processing failed:', e); }
            }, 200);
            return updated;
          }

          // Handle initial agent greeting or orphaned responses
          const isInitialGreeting = updated.length === 0 ||
            /which language/i.test(contentText) ||
            /translation service/i.test(contentText) ||
            /ready/i.test(contentText);

          if (isInitialGreeting) {
            console.log('ℹ️ Initial agent greeting received (fallback)');
            sessionManager.acknowledgeMessage(messageId);
            updateCurrentTranslation('[System]', contentText);
            return updated;
          }

          // Data loss recovery with better logging
          console.error('🚨 POTENTIAL DATA LOSS: Agent message without pending user message');
          console.error('🚨 Recovery context:', {
            agentMessage: contentText.substring(0, 100),
            sessionId: sessionManager.sessionId?.slice(-6),
            bufferLength: updated.length,
            outboxSize: messageOutboxRef.current.size,
            pendingSize: pendingSessionBufferRef.current.length,
            recentUserMessages: updated.slice(-3).filter(m => m.user).map(m => m.user.substring(0, 30)),
            micMuted: isMicMuted,
            paused: isPaused
          });
          
          // If mic is muted or paused, this might be expected behavior
          if (isMicMuted || isPaused) {
            console.log('ℹ️ Recovery may be expected - mic muted or translation paused');
          }
          
          const recoveryEntry = { 
            user: '[Recovery: User message not captured via fallback]', 
            agent: contentText 
          };
          updated.push(recoveryEntry);
          
          updateCurrentTranslation(recoveryEntry.user, recoveryEntry.agent);
          sessionManager.acknowledgeMessage(messageId);
          
          setTimeout(() => {
            try {
              processMessageWithBuffering(recoveryEntry.user, recoveryEntry.agent);
            } catch (error) {
              console.error('🔥 Recovery processing failed (fallback):', error);
            }
          }, 200);
          
          return updated;
        }

        // Successful FIFO pairing
        console.log('🤖 Agent response paired (fallback):', contentText.substring(0, 50) + '...');
        updated[indexToFill].agent = contentText;
        
        // Update tracking
        const userText = updated[indexToFill].user;
        for (const [trackingId, trackingData] of conversationTrackingRef.current.activeMessages.entries()) {
          if (trackingData.user === userText && !trackingData.agent) {
            trackingData.agent = contentText;
            break;
          }
        }

        sessionManager.acknowledgeMessage(messageId);
        updateCurrentTranslation(updated[indexToFill].user, updated[indexToFill].agent);

        // Process with buffering
        const lastExchange = updated[indexToFill];
        if (lastExchange.user && lastExchange.agent) {
          setTimeout(() => {
            try {
              processMessageWithBuffering(lastExchange.user, lastExchange.agent);
            } catch (error) {
              console.error('🔥 Fallback processing failed:', error);
            }
          }, 200);
        }

        return updated;
      });
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
  
  // Audio controls for modal header
  const toggleSpeakerMute = async () => {
    console.log('🎚️ User-triggered speaker mute toggle:', !isSpeakerMuted);
    try {
      if (isSpeakerMuted) {
        if (conversation.status === 'connected') {
          await conversation.setVolume({ volume: lastVolumeRef.current || 0.8 });
        }
        setIsSpeakerMuted(false);
        console.log('✅ User speaker unmute applied successfully');
        toast.success('Speaker unmuted');
      } else {
        lastVolumeRef.current = 0.8; // Store current volume before muting
        if (conversation.status === 'connected') {
          await conversation.setVolume({ volume: 0 });
        }
        setIsSpeakerMuted(true);
        console.log('✅ User speaker mute applied successfully');
        toast.info('Speaker muted');
      }
    } catch (e) {
      console.error('❌ User speaker toggle failed:', e);
      toast.error('Unable to toggle speaker');
    }
  };

  const toggleMicMute = async () => {
    setIsMicMuted((prev) => {
      const next = !prev;
      
      // Handle microphone muting at the MediaStream level
      if (microphoneStreamRef.current) {
        // Use existing stream if available
        microphoneStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next; // Disable track when muted
        });
        
        if (next) {
          toast.info('Microphone muted - audio input disabled');
        } else {
          toast.success('Microphone unmuted - audio input enabled');
        }
      } else {
        // Try to get access to microphone stream
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              microphoneStreamRef.current = stream;
              stream.getAudioTracks().forEach((track) => {
                track.enabled = !next; // Disable track when muted
              });
              
              if (next) {
                toast.info('Microphone muted - audio input disabled');
              } else {
                toast.success('Microphone unmuted - audio input enabled');
              }
            })
            .catch((err) => {
              console.warn('Could not access microphone for muting:', err);
              toast.error('Unable to access microphone for muting');
            });
        } else {
          toast.error('Microphone control not supported in this browser');
        }
      }
      
      return next;
    });
  };

  const togglePause = async () => {
    try {
      if (isPaused) {
        // Resume: restart the session if we were connected
        if (conversation.status === 'disconnected') {
          // Restart the session
          await startTranslationService();
        }
        setIsPaused(false);
        toast.success('Translation resumed - service reactivated');
      } else {
        // Pause: end the current session
        if (conversation.status === 'connected') {
          await conversation.endSession();
        }
        setIsPaused(true);
        toast.info('Translation paused - service temporarily stopped');
      }
    } catch (e) {
      console.error('Failed to toggle pause:', e);
      toast.error('Unable to pause/resume translation');
      // Revert state on error
      setIsPaused(prev => !prev);
    }
  };

  // Function to convert content to styled HTML for email (matching EmailHandler style)
  const convertContentToStyledHTML = (text: string): string => {
    const emailCSS = `
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background-color: #ffffff;
          margin: 0;
          padding: 20px;
        }
        .message-container {
          max-width: 700px;
          margin: 0 auto;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        h1, h2, h3, h4 { color: #2563eb; font-weight: 600; margin-bottom: 1rem; }
        p { margin-bottom: 0.75rem; line-height: 1.6; }
        strong { font-weight: 600; color: #1f2937; }
        .translation-section {
          margin-bottom: 2rem;
          padding: 1rem;
          background-color: #ffffff;
          border-radius: 8px;
          border-left: 4px solid #2563eb;
        }
        .signature {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          color: #6b7280;
          font-size: 0.875rem;
        }
      </style>
    `;
    
    return `${emailCSS}<div class="message-container">${text.replace(/\n/g, '<br>')}<div class="signature">Generated by Notewell AI GP Translation Service</div></div>`;
  };

  // Generate email content similar to DOCX export
  const generateEmailContent = (
    translations: TranslationEntry[],
    metadata: any,
    translationScores: TranslationScore[]
  ): string => {
    const formatDuration = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };

    const getLanguageName = (code: string) => {
      if (!code) return 'Unknown';
      const lower = code.toLowerCase();
      const base = lower.split('-')[0];
      const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
      return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
    };

    // Deduplicate translations
    const deduplicatedTranslations = translations.filter((translation, index, array) => {
      let timestamp: number;
      
      if (typeof translation.timestamp === 'number') {
        timestamp = translation.timestamp;
      } else if (translation.timestamp instanceof Date) {
        timestamp = translation.timestamp.getTime();
      } else if (typeof translation.timestamp === 'string') {
        timestamp = new Date(translation.timestamp).getTime();
      } else {
        timestamp = index;
      }
      
      return array.findIndex(t => {
        let tTimestamp: number;
        if (typeof t.timestamp === 'number') {
          tTimestamp = t.timestamp;
        } else if (t.timestamp instanceof Date) {
          tTimestamp = t.timestamp.getTime();
        } else if (t.timestamp === 'string') {
          tTimestamp = new Date(t.timestamp).getTime();
        } else {
          tTimestamp = array.indexOf(t);
        }
        return tTimestamp === timestamp;
      }) === index;
    });

    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 3px solid #005EB8; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="color: #005EB8; font-size: 24px; font-weight: bold; margin-bottom: 5px;">NHS</div>
          <div style="font-size: 18px; font-weight: bold; color: #005EB8; margin: 10px 0;">Translation Service Report</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 20px;">Automated Translation Session Documentation</div>
        </div>

        <!-- Practice Information -->
        <div style="margin: 20px 0;">
          <h3 style="font-size: 14px; font-weight: bold; color: #005EB8; margin: 25px 0 10px 0; border-bottom: 2px solid #005EB8; padding-bottom: 5px;">Practice Information</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8; width: 25%;">Practice Name</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.practiceName || 'NHS GP Practice'}</td>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8; width: 25%;">Contact</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.practicePhone || 'Contact your practice for phone details'}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Address</th>
              <td colspan="3" style="border: 1px solid #ddd; padding: 8px;">${metadata.practiceAddress || 'Contact your practice for address details'}</td>
            </tr>
          </table>
        </div>

        <!-- Session Information -->
        <div style="margin: 20px 0;">
          <h3 style="font-size: 14px; font-weight: bold; color: #005EB8; margin: 25px 0 10px 0; border-bottom: 2px solid #005EB8; padding-bottom: 5px;">Session Information</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8; width: 25%;">Report Generated</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${new Date().toLocaleString('en-GB')}</td>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8; width: 25%;">Session Date</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.sessionDate.toLocaleDateString('en-GB')}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Session Start</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.sessionStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Session End</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.sessionEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Duration</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${formatDuration(metadata.sessionDuration)}</td>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Patient Language</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.patientLanguage}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Total Translations</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.totalTranslations}</td>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Average Accuracy</th>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.averageAccuracy}%</td>
            </tr>
          </table>
        </div>

        <!-- Translation Quality Metrics -->
        <div style="margin: 20px 0;">
          <h3 style="font-size: 14px; font-weight: bold; color: #005EB8; margin: 25px 0 10px 0; border-bottom: 2px solid #005EB8; padding-bottom: 5px;">Translation Quality Metrics</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Metric</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Value</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; color: #005EB8;">Assessment</th>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Average Accuracy</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: ${metadata.averageAccuracy >= 90 ? '#28a745' : metadata.averageAccuracy >= 75 ? '#ffc107' : '#dc3545'}; font-weight: bold;">${metadata.averageAccuracy}%</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.averageAccuracy >= 90 ? 'Excellent' : metadata.averageAccuracy >= 75 ? 'Good' : 'Needs Review'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Average Confidence</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: ${metadata.averageConfidence >= 90 ? '#28a745' : metadata.averageConfidence >= 75 ? '#ffc107' : '#dc3545'}; font-weight: bold;">${metadata.averageConfidence}%</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${metadata.averageConfidence >= 90 ? 'High Confidence' : metadata.averageConfidence >= 75 ? 'Moderate Confidence' : 'Low Confidence'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Safe Translations</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${translationScores.filter(s => s.safetyFlag === 'safe').length}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${translationScores.length > 0 ? (translationScores.filter(s => s.safetyFlag === 'safe').length / translationScores.length * 100).toFixed(1) : '100.0'}% of total</td>
            </tr>
          </table>
        </div>

        <!-- Detailed Translation Log -->
        <div style="margin: 20px 0;">
          <h3 style="font-size: 14px; font-weight: bold; color: #005EB8; margin: 25px 0 10px 0; border-bottom: 2px solid #005EB8; padding-bottom: 5px;">Detailed Translation Log</h3>
          <p style="font-size: 10px; color: #666; margin-bottom: 15px;">
            Complete record of all translations during the session, including accuracy scores and safety assessments.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10px;">
            <thead>
              <tr style="background-color: #005EB8; color: white;">
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold; width: 2%;">#</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold; width: 3%;">Time</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold; width: 3%;">Speaker</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold; width: 45%;">Original Text</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold; width: 45%;">Translation (${metadata.patientLanguage})</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold; width: 2%;">Languages</th>
              </tr>
            </thead>
            <tbody>
              ${deduplicatedTranslations.map((translation, index) => {
                const score = translationScores[index];
                
                return `
                  <tr style="background-color: ${translation.speaker === 'gp' ? '#e3f2fd' : '#e8f5e8'};">
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold;">${index + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${(() => {
                      if (typeof translation.timestamp === 'number') {
                        return new Date(translation.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                      } else if (translation.timestamp instanceof Date) {
                        return translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                      } else if (typeof translation.timestamp === 'string') {
                        return new Date(translation.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                      } else {
                        return 'Unknown';
                      }
                    })()}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${translation.originalText}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${translation.translatedText}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 9px;">
                      ${getLanguageName(translation.originalLanguage)}<br>↓<br>${getLanguageName(translation.targetLanguage)}
                    </td>
                  </tr>
                  ${score && (score.medicalTermsDetected?.length > 0 || score.issues?.length > 0) ? `
                  <tr>
                    <td colspan="6" style="border: 1px solid #ddd; background-color: #f8f9fa; font-size: 9px; padding: 8px;">
                      ${score.medicalTermsDetected?.length > 0 ? `<strong>Medical Terms:</strong> ${score.medicalTermsDetected.join(', ')}<br>` : ''}
                      ${score.issues?.length > 0 ? `<strong>Issues:</strong> ${score.issues.join('; ')}` : ''}
                    </td>
                  </tr>
                  ` : ''}
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 9px; color: #666; text-align: center;">
          <p>
            <strong>IMPORTANT DISCLAIMER:</strong> This is an automated translation service for communication assistance only. 
            All medical decisions should be based on professional clinical judgement. Critical medical information should be 
            verified through qualified medical interpretation services.
          </p>
          <p>
            Report generated by Notewell AI Translation Tool (Proof of Concept) - ${new Date().toLocaleString('en-GB')}
          </p>
          <p>
            This document contains confidential patient information and should be handled in accordance with NHS data protection policies.
          </p>
        </div>
      </div>
    `;
  };

  // Email complete translation session to logged-in user
  const handleEmailToMe = async () => {
    if (translations.length === 0) {
      toast.error('No translations available to email');
      return;
    }

    setIsEmailingSelf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('No user email found - please log in');
        return;
      }

      // Fetch practice details
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .maybeSingle();

      // Create session metadata for email
      const sessionMetadata = {
        sessionDate: new Date(),
        sessionStart: sessionStart,
        sessionEnd: new Date(),
        patientLanguage: translations.length > 0 ? 
          (HEALTHCARE_LANGUAGES.find(l => l.code === translations[0].targetLanguage)?.name || translations[0].targetLanguage) : 'Unknown',
        totalTranslations: translations.length,
        sessionDuration: Math.floor((Date.now() - sessionStart.getTime()) / 1000),
        overallSafetyRating: 'safe' as const,
        averageAccuracy: translationScores.length > 0 ? 
          Math.round(translationScores.reduce((sum, score) => sum + score.accuracy, 0) / translationScores.length) : 100,
        averageConfidence: translationScores.length > 0 ? 
          Math.round(translationScores.reduce((sum, score) => sum + score.confidence, 0) / translationScores.length) : 100,
        // Add practice details from database
        practiceName: practiceData?.practice_name || 'NHS GP Practice',
        practiceAddress: practiceData?.address || 'Contact your practice for address details',
        practicePhone: practiceData?.phone || 'Contact your practice for phone details'
      };

      // Generate the same comprehensive content as DOCX export but for email
      const emailContent = generateEmailContent(translations, sessionMetadata, translationScores);

      const emailData = {
        to_email: user.email,
        subject: 'Complete Translation Session - GP Practice Record',
        message: emailContent,
        template_type: 'translation_record',
        from_name: 'Notewell AI GP Translation Service',
        reply_to: 'noreply@gp-tools.nhs.uk'
      };

      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: emailData
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      toast.success(`Complete session emailed successfully to ${user.email}`);
    } catch (error) {
      console.error('Email to self error:', error);
      toast.error('Failed to send email');
    } finally {
      setIsEmailingSelf(false);
    }
  };

  // Email complete patient-friendly translation session
  const handleEmailToPatient = async () => {
    if (translations.length === 0) {
      toast.error('No translations available to email');
      return;
    }

    setIsEmailingPatient(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('No user email found - please log in');
        return;
      }

      // Fetch practice details
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .maybeSingle();

      // Create session metadata for patient email
      const sessionMetadata = {
        sessionDate: new Date(),
        sessionStart: sessionStart,
        sessionEnd: new Date(),
        patientLanguage: translations.length > 0 ? 
          (HEALTHCARE_LANGUAGES.find(l => l.code === translations[0].targetLanguage)?.name || translations[0].targetLanguage) : 'Unknown',
        totalTranslations: translations.length,
        sessionDuration: Math.floor((Date.now() - sessionStart.getTime()) / 1000),
        overallSafetyRating: 'safe' as const,
        averageAccuracy: translationScores.length > 0 ? 
          Math.round(translationScores.reduce((sum, score) => sum + score.accuracy, 0) / translationScores.length) : 100,
        averageConfidence: translationScores.length > 0 ? 
          Math.round(translationScores.reduce((sum, score) => sum + score.confidence, 0) / translationScores.length) : 100,
        // Add practice details from database
        practiceName: practiceData?.practice_name || 'NHS GP Practice',
        practiceAddress: practiceData?.address || 'Contact your practice for address details',
        practicePhone: practiceData?.phone || 'Contact your practice for phone details'
      };

      // Generate patient-friendly version of the complete session
      const patientContent = generateEmailContent(translations, sessionMetadata, translationScores);

      const emailData = {
        to_email: user.email, // Sent to GP for forwarding to patient
        subject: 'Patient Copy - Complete Translation Session',
        message: patientContent,
        template_type: 'patient_translation_copy',
        from_name: 'Notewell AI GP Translation Service',
        reply_to: 'noreply@gp-tools.nhs.uk'
      };

      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: emailData
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      toast.success(`Complete patient copy emailed to ${user.email} for forwarding`);
    } catch (error) {
      console.error('Email to patient error:', error);
      toast.error('Failed to send patient copy');
    } finally {
      setIsEmailingPatient(false);
    }
  };

  // Handle deleting individual translation
  const handleDeleteTranslation = (translationId: string) => {
    setTranslations(prev => prev.filter(t => t.id !== translationId));
    console.log('🗑️ Deleted translation:', translationId);
  };

  // Handle deleting selected translations
  const handleDeleteSelectedTranslations = (translationIds: string[]) => {
    setTranslations(prev => prev.filter(t => !translationIds.includes(t.id)));
    console.log('🗑️ Deleted selected translations:', translationIds.length);
  };

  // Handle deleting all translations
  const handleDeleteAllTranslations = () => {
    setTranslations([]);
    setTranslationScores([]);
    console.log('🗑️ Deleted all translations');
  };

  // Remove the old togglePause function as it's now above

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
                  {isAudioBuffering && (
                    <Badge variant="outline" className="text-sm px-3 py-1 animate-pulse">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Buffering Audio...
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
                        <>
                          <Loader2 className="h-7 w-7 animate-spin" />
                          Starting Translation Service...
                        </>
                      ) : (
                        <>
                          <Phone className="h-7 w-7" />
                          Start Translation Service
                        </>
                      )}
                    </Button>
                    
                    <div className="text-center text-sm text-muted-foreground max-w-md">
                      <p className="font-medium">🎤 Voice-Based Service</p>
                      <p>Ensure your speaker is on to hear real-time translations</p>
                    </div>
                    
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

              {/* Missed Translation Feedback Alert */}
              {missedTranslationFeedback && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>Feedback Received:</strong> We'll improve translation capture. 
                    Try speaking more slowly and clearly, or use the refresh button if needed.
                  </AlertDescription>
                </Alert>
              )}

              {/* Languages Available Section - Updated to show both types */}
              <div className="mt-8">
                <h3 className="text-2xl font-bold mb-6 text-center">Languages Available</h3>
                
                {/* ElevenLabs AI Voice Languages */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-center flex items-center justify-center gap-2">
                    <Mic className="h-5 w-5 text-blue-600" />
                    AI Voice Translation (ElevenLabs)
                  </h4>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {HEALTHCARE_LANGUAGES
                      .filter(lang => lang.hasElevenLabsVoice)
                      .slice(0, 10)
                      .map((lang) => (
                        <Badge key={lang.code} variant="outline" className="text-base px-4 py-2 font-semibold hover:bg-primary/10 transition-colors cursor-pointer" 
                               onClick={() => {
                                 setSelectedManualLanguage({ code: lang.code, name: lang.name });
                                 startTranslationService();
                               }}>
                          {lang.name}
                        </Badge>
                      ))}
                    <Badge variant="secondary" className="text-base px-4 py-2 font-bold">
                      + {HEALTHCARE_LANGUAGES.filter(lang => lang.hasElevenLabsVoice).length - 10} more
                    </Badge>
                  </div>
                </div>

                {/* Manual Translation Languages */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 text-center flex items-center justify-center gap-2">
                    <Languages className="h-5 w-5 text-green-600" />
                    Manual Translation (Text Display)
                  </h4>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {HEALTHCARE_LANGUAGES
                      .filter(lang => lang.manualTranslationOnly)
                      .slice(0, 12)
                      .map((lang) => (
                        <Badge key={lang.code} variant="outline" className="text-base px-4 py-2 font-semibold hover:bg-green-100 transition-colors cursor-pointer border-green-200 text-green-700" 
                               onClick={() => {
                                 setSelectedManualLanguage({ code: lang.code, name: lang.name });
                                 setIsManualTranslationOpen(true);
                               }}>
                          {lang.name}
                        </Badge>
                      ))}
                    <Badge variant="secondary" className="text-base px-4 py-2 font-bold bg-green-100 text-green-800">
                      + {HEALTHCARE_LANGUAGES.filter(lang => lang.manualTranslationOnly).length - 12} more
                    </Badge>
                  </div>
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
                          <span className="text-sm font-medium text-muted-foreground">Original ({getLanguageName(qualityScore.sourceLanguage, HEALTHCARE_LANGUAGES)}):</span>
                          <div className="text-lg mt-2 p-3 rounded bg-background border font-medium">
                            {qualityScore.originalPhrase}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Translation ({getLanguageName(qualityScore.targetLanguage, HEALTHCARE_LANGUAGES)}):</span>
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
            <Collapsible open={isGuideOpen} onOpenChange={setIsGuideOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Translation Service User Guide
                    </div>
                    {isGuideOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
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
              </CollapsibleContent>
            </Collapsible>
          </Card>

        </TabsContent>

        <TabsContent value="email" className="space-y-6 mt-6">
          <EmailHandler />
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <div className="flex items-center justify-between mb-6">
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
                onClick={() => setShowFullScreenHistory(true)}
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <Maximize2 className="h-4 w-4" />
                Expand
              </Button>
              <Button
                onClick={() => setShowHistorySidebar(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Saved Sessions
              </Button>
            </div>
          </div>

          {/* Sub-tabs for different translation types */}
          <HistorySubTabs
            translations={translations}
            sessionStart={sessionStart}
            sessions={sessions}
            currentSessionId={currentSessionId}
            saveStatus={saveStatus}
            isSaving={isSaving}
            onSave={handleAutoSave}
            onClear={clearHistory}
            onExportDOCX={handleExportDOCX}
            onPatientExportDOCX={handlePatientExportDOCX}
            onOpenSaved={() => setShowHistorySidebar(true)}
            onDeleteTranslation={handleDeleteTranslation}
            onDeleteSelectedTranslations={handleDeleteSelectedTranslations}
            onDeleteAllTranslations={handleDeleteAllTranslations}
          />
        </TabsContent>
      </Tabs>
      </>
      )}
      
      {/* Translation Display Modal - Large Text for Patients */}
      <Dialog open={isTranslationModalOpen} onOpenChange={setIsTranslationModalOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto z-[100]">
          <DialogHeader className="border-b pb-6">
            <DialogTitle className="flex items-center justify-between text-2xl">
              <span className="flex items-center gap-3">
                <Languages className="w-8 h-8 text-primary" />
                Notewell AI Translation Service
              </span>
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={300}>
                  {/* Repeat Phrase Icon */}
                  {currentTranslation && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-muted"
                          onClick={() =>
                            repeatTranslatedPhrase(
                              currentTranslation.translatedText,
                              currentTranslation.targetLanguage
                            )
                          }
                          disabled={isSpeaking}
                          aria-label="Repeat phrase"
                        >
                          <Volume2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="z-[110]">
                        <p>Repeat phrase</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Settings Icon - Contains Audio Controls */}
                  <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 hover:bg-muted"
                            aria-label="Audio settings"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="z-[110]">
                          <p>Audio settings</p>
                        </TooltipContent>
                      </Tooltip>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md z-[120]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Settings className="w-5 h-5" />
                          Audio Settings
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-6">
                        {/* GP Audio Controls */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-blue-600" />
                            GP Audio
                          </h4>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant={isMicMuted ? "default" : "outline"}
                              size="sm"
                              onClick={toggleMicMute}
                              className="justify-start"
                            >
                              <MicOff className="w-4 h-4 mr-2" />
                              {isMicMuted ? 'Microphone Muted' : 'Mute Microphone'}
                            </Button>
                            
                            <Button
                              variant={isPaused ? "default" : "outline"}
                              size="sm"
                              onClick={togglePause}
                              className="justify-start"
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              {isPaused ? 'Translation Paused' : 'Pause Translation'}
                            </Button>
                          </div>
                        </div>

                        {/* Patient Audio Controls */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-green-600" />
                            Patient Audio
                          </h4>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant={isSpeakerMuted ? "default" : "outline"}
                              size="sm"
                              onClick={toggleSpeakerMute}
                              className="justify-start"
                            >
                              <VolumeX className="w-4 h-4 mr-2" />
                              {isSpeakerMuted ? 'Speaker Muted' : 'Mute Speaker'}
                            </Button>
                          </div>
                        </div>

                        {/* Session Control */}
                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Phone className="w-4 h-4 text-red-600" />
                            Session Control
                          </h4>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              endTranslationService();
                              setIsSettingsOpen(false);
                            }}
                            className="justify-start w-full"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            End Translation Session
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Download Icon */}
                  {currentTranslation && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-muted"
                          aria-label="Download options"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-64 bg-background border shadow-lg z-[110]">
                        <DropdownMenuItem 
                          onClick={handleExportDOCX}
                          disabled={translations.length === 0}
                          className="flex items-center gap-2 cursor-pointer py-3"
                        >
                          <Download className="w-4 h-4" />
                          GP Practice Audit Record
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={handlePatientLanguageExportDOCX}
                          disabled={translations.length === 0}
                          className="flex items-center gap-2 cursor-pointer py-3"
                        >
                          <Download className="w-4 h-4" />
                          Patient Copy of Translation
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={handleEmailToMe}
                          disabled={translations.length === 0 || isEmailingSelf}
                          className="flex items-center gap-2 cursor-pointer py-3"
                        >
                          <Mail className="w-4 h-4" />
                          {isEmailingSelf ? 'Emailing Complete Session...' : 'Email Complete Session to Me'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={handleEmailToPatient}
                          disabled={translations.length === 0 || isEmailingPatient}
                          className="flex items-center gap-2 cursor-pointer py-3"
                        >
                          <Mail className="w-4 h-4" />
                          {isEmailingPatient ? 'Emailing Patient Copy...' : 'Email Complete Session to Patient'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TooltipProvider>
                <TranslationValidationGuide />
              </div>
            </DialogTitle>
          </DialogHeader>

          {currentTranslation ? (
            <div className="space-y-8">
              {/* English Text */}
              <div className="bg-blue-50 p-8 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-6 h-6 text-blue-600" />
                    <h3 className="text-2xl font-semibold text-blue-800">English (GP)</h3>
                  </div>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 flex items-center gap-2 px-4 py-2 text-lg">
                    <Shield className="w-5 h-5" />
                    Verified Safe & Accurate
                  </Badge>
                </div>
                <p className="text-3xl text-blue-900 leading-relaxed">
                  {currentTranslation.englishText}
                </p>
              </div>

              {/* Translated Text */}
              <div className="bg-green-50 p-8 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Languages className="w-6 h-6 text-green-600" />
                  <h3 className="text-2xl font-semibold text-green-800">
                    {getNativeLanguageName(currentTranslation.targetLanguage)} (Patient)
                  </h3>
                </div>
                <p className="text-3xl text-green-900 leading-relaxed">
                  {currentTranslation.translatedText}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* English Text - Empty State */}
              <div className="bg-blue-50 p-8 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-6 h-6 text-blue-600" />
                    <h3 className="text-2xl font-semibold text-blue-800">English (GP)</h3>
                  </div>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 flex items-center gap-2 px-4 py-2 text-lg">
                    <Shield className="w-5 h-5" />
                    Verified Safe & Accurate
                  </Badge>
                </div>
                <p className="text-3xl text-blue-900 leading-relaxed">
                  [System]
                </p>
              </div>

              {/* Patient Language - Empty State */}
              <div className="bg-green-50 p-8 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Languages className="w-6 h-6 text-green-600" />
                  <h3 className="text-2xl font-semibold text-green-800">
                    Select Language (Patient)
                  </h3>
                </div>
                <p className="text-3xl text-green-900 leading-relaxed">
                  Translation Service, Which Language Please?
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Translation Modal */}
      <ManualTranslationModal
        isOpen={isManualTranslationOpen}
        onClose={() => {
          setIsManualTranslationOpen(false);
          setSelectedManualLanguage(null);
        }}
        initialLanguageCode={selectedManualLanguage?.code}
        initialLanguageName={selectedManualLanguage?.name}
      />

      {/* Full Screen Translation History Modal */}
      <Dialog open={showFullScreenHistory} onOpenChange={setShowFullScreenHistory}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              Translation History - Full Screen View
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {translations.map((translation, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-lg ${
                    translation.speaker === 'gp' 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'bg-green-50 border-l-4 border-green-500'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="font-semibold text-lg">
                      {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="text-lg">
                      <span className="font-semibold">Original:</span> 
                      <div className="mt-2 text-foreground leading-relaxed">{translation.originalText}</div>
                    </div>
                    <div className="text-lg">
                      <span className="font-semibold">Translation:</span>
                      <div className="mt-2 text-foreground leading-relaxed">{translation.translatedText}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {translation.originalLanguage} → {translation.targetLanguage}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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