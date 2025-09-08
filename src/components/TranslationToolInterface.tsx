import React, { useState, useRef, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Languages, 
  Phone, 
  PhoneOff,
  AlertCircle,
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
  EyeOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TranslationHistory from './TranslationHistory';
import { scoreTranslation, TranslationScore } from '@/utils/translationScoring';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';

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
  const conversationIdRef = useRef<string | null>(null);

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

  // Add conversation to translation history
  const addToTranslationHistory = (userMessage: string, agentResponse: string) => {
    // Skip language setup requests - these are not actual translations
    const isLanguageSetup = userMessage.toLowerCase().includes('please') && 
                           userMessage.toLowerCase().match(/\b(polish|arabic|spanish|french|urdu|bengali|chinese|german|italian|portuguese|ukrainian|hungarian|russian|hindi)\b/i) &&
                           agentResponse.toLowerCase().includes('ready');
    
    if (isLanguageSetup) {
      console.log('🔧 Skipping language setup request from translation history');
      return;
    }

    const { language: targetLanguage, cleanText: cleanedResponse } = extractLanguageAndCleanText(agentResponse);
    
    // Only track if we have meaningful content (not just setup messages)
    if (userMessage.trim().length < 5 || cleanedResponse.trim().length < 5) {
      console.log('🔧 Skipping short/setup message from translation history');
      return;
    }
    
    const translationLatency = 1000; // Approximate for AI conversations
    
    // Score the translation
    const translationScore = scoreTranslation(
      userMessage,
      cleanedResponse,
      'en',
      targetLanguage.toLowerCase(),
      translationLatency
    );
    
    const newTranslation: TranslationEntry = {
      id: Date.now().toString(),
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
    
    setTranslations(prev => [...prev, newTranslation]);
    setTranslationScores(prev => [...prev, translationScore]);
  };

  const clearHistory = () => {
    setTranslations([]);
    setTranslationScores([]);
    setSessionStart(new Date());
    toast.success('Translation history cleared');
  };

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

      // Play the audio
      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audio.play();
        
        audio.onended = () => {
          setIsSpeaking(false);
          toast.success('Phrase completed');
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          toast.error('Failed to play audio');
        };
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

  const verifyConversationQuality = async (userInput: string, agentResponse: string) => {
    console.log('🔍 Translation Quality Check Starting...');
    console.log('🔍 User input:', userInput.substring(0, 100) + '...');
    console.log('🔍 Agent response:', agentResponse.substring(0, 100) + '...');
    
    // Extract target language from agent response
    const { language: targetLanguage, cleanText: cleanedResponse } = extractLanguageAndCleanText(agentResponse);
    
    try {
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
        toast.error('Translation verification failed');
        return;
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
      console.log('Connected to NHS Translation Service');
      toast.success('Connected to Translation Service');
      setError(null);
      
      conversationIdRef.current = `translation_${Date.now()}`;
      setQualityScore(null);
      setConversationBuffer([]);
    },
    onDisconnect: () => {
      console.log('Disconnected from NHS Translation Service');
      toast.info('Disconnected from Translation Service');
      conversationIdRef.current = null;
      // Close translation modal when disconnected
      setIsTranslationModalOpen(false);
      setCurrentTranslation(null);
    },
    onMessage: (message) => {
      console.log('📨 Translation message received:', message);
      
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
            // Trigger verification for the complete exchange
            const lastExchange = updated[updated.length - 1];
            if (lastExchange.user && lastExchange.agent) {
              console.log('🔄 Triggering verification for complete exchange');
              verifyConversationQuality(lastExchange.user, lastExchange.agent);
              // Add to translation history
              addToTranslationHistory(lastExchange.user, lastExchange.agent);
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

  // Start conversation
  const startTranslationService = async () => {
    const permitted = hasPermission ? true : await requestMicrophonePermission();
    if (!permitted) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Generate signed URL first (required for authorized agents)
      const signedUrl = await generateSignedUrl();
      if (!signedUrl) {
        setError('Failed to get authorization for Translation Service');
        return;
      }

      console.log('Starting translation service with signed URL:', signedUrl);
      const conversationId = await conversation.startSession({ 
        agentId: 'agent_01jws2qhv2essav25m8cfq2h0v',  // Language Support Agent
        signedUrl
      });
      
      console.log('Translation service started successfully:', conversationId);
      
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

  const getBadgeVariant = (score: QualityScore) => {
    if (score.overallSafety === 'OK') return 'default';
    if (score.overallSafety === 'REVIEW') return 'secondary';
    return 'destructive';
  };

  const getQualityIcon = (score: QualityScore) => {
    if (score.overallSafety === 'OK') return <CircleCheck className="h-3 w-3 mr-1" />;
    if (score.overallSafety === 'REVIEW') return <AlertTriangle className="h-3 w-3 mr-1" />;
    return <XCircle className="h-3 w-3 mr-1" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Card */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold flex items-center justify-center gap-3">
            <Languages className="h-8 w-8" />
            NHS Translation Service for GP Practices
          </CardTitle>
          <p className="text-xl text-primary-foreground/90 mt-2">
            Real-time medical translation for Reception & Clinical Staff
          </p>
        </CardHeader>
      </Card>

      {/* Main Interface Tabs */}
      <Tabs defaultValue="translate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="translate" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Live Translation
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
                      variant={getBadgeVariant(qualityScore)} 
                      className="text-xs flex items-center"
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
                    <div className={`text-center p-2 rounded ${qualityScore.accuracy < 70 ? 'bg-red-500 text-white' : 'bg-muted/50'}`}>
                      <div className={`text-xs ${qualityScore.accuracy < 70 ? 'text-red-100' : 'text-muted-foreground'}`}>Accuracy</div>
                      <div className="font-bold text-sm">{qualityScore.accuracy}%</div>
                    </div>
                    <div className={`text-center p-2 rounded ${qualityScore.medicalSafety < 70 ? 'bg-red-500 text-white' : 'bg-muted/50'}`}>
                      <div className={`text-xs ${qualityScore.medicalSafety < 70 ? 'text-red-100' : 'text-muted-foreground'}`}>Safety</div>
                      <div className="font-bold text-sm">{qualityScore.medicalSafety}%</div>
                    </div>
                    <div className={`text-center p-2 rounded ${qualityScore.clarity < 70 ? 'bg-red-500 text-white' : 'bg-muted/50'}`}>
                      <div className={`text-xs ${qualityScore.clarity < 70 ? 'text-red-100' : 'text-muted-foreground'}`}>Clarity</div>
                      <div className="font-bold text-sm">{qualityScore.clarity}%</div>
                    </div>
                    <div className={`text-center p-2 rounded ${qualityScore.confidence < 70 ? 'bg-red-500 text-white' : 'bg-muted/50'}`}>
                      <div className={`text-xs ${qualityScore.confidence < 70 ? 'text-red-100' : 'text-muted-foreground'}`}>Confidence</div>
                      <div className="font-bold text-sm">{qualityScore.confidence}%</div>
                    </div>
                  </div>

                  <Collapsible open={isQualityDetailsOpen} onOpenChange={setIsQualityDetailsOpen}>
                    <CollapsibleContent className="space-y-3">
                      {/* Translation Details */}
                      <div className="space-y-2 p-3 rounded border bg-muted/20">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Original ({qualityScore.sourceLanguage}):</span>
                          <div className="text-sm mt-1 p-2 rounded bg-background border">
                            {qualityScore.originalPhrase}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Translation ({qualityScore.targetLanguage}):</span>
                          <div className="text-sm mt-1 p-2 rounded bg-background border">
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
                            <Badge variant={getBadgeVariant(qualityScore)} className="text-xs">
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

          {/* User Guide Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                How to Use This Service
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reception Staff Guide */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    For Reception Staff
                  </h3>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">1.</span>
                      Press "Start Translation Service" button above
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">2.</span>
                      Speak clearly in English to schedule appointments
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">3.</span>
                      AI translates your words into patient's language
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">4.</span>
                      Patient responds in their language, AI translates to English
                    </li>
                  </ul>
                </div>

                {/* Clinical Staff Guide */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-green-600" />
                    For Clinical Staff
                  </h3>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">1.</span>
                      Use during consultations for real-time translation
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">2.</span>
                      Medical terms are translated with clinical accuracy
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">3.</span>
                      Quality verification ensures patient safety
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">4.</span>
                      All translations are logged for clinical governance
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-center">
                <Globe className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-blue-900">Multi-Language Support</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Supports 50+ languages commonly spoken by NHS patients
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <Heart className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-900">Medical Accuracy</h3>
                <p className="text-sm text-green-700 mt-1">
                  Trained on NHS clinical terminology and protocols
                </p>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4 text-center">
                <UserCheck className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-purple-900">Quality Assured</h3>
                <p className="text-sm text-purple-700 mt-1">
                  Real-time quality verification for patient safety
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Translation History</h2>
            <div className="flex gap-2">
              {translations.length > 0 && (
                <>
                  <Button onClick={clearHistory} variant="outline" size="sm">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Clear History
                  </Button>
                  <Button onClick={handleExportDOCX} variant="default" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export to DOCX
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
                {/* Quality Indicator for Staff */}
                {currentTranslation?.qualityScore && (
                  <div className="flex items-center gap-2">
                    {currentTranslation.qualityScore.overallSafety === 'OK' && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-lg px-4 py-2">
                        <CheckCircle2 className="w-6 h-6 mr-2" />
                        Safe Translation
                      </Badge>
                    )}
                    {currentTranslation.qualityScore.overallSafety === 'REVIEW' && (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-lg px-4 py-2">
                        <AlertTriangle className="w-6 h-6 mr-2" />
                        Review Needed
                      </Badge>
                    )}
                    {currentTranslation.qualityScore.overallSafety === 'NOT_OK' && (
                      <Badge className="bg-red-100 text-red-800 border-red-200 text-lg px-4 py-2">
                        <XCircle className="w-6 h-6 mr-2" />
                        Translation Issue
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsTranslationModalOpen(false)}
                      className="h-10 w-10 p-0"
                    >
                      <EyeOff className="w-6 h-6" />
                    </Button>
                  </div>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {currentTranslation && (
            <div className="space-y-12 pt-8">
              {/* English Text - For Staff Reference */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-10">
                <div className="flex items-center gap-3 mb-6">
                  <Globe className="w-8 h-8 text-blue-600" />
                  <span className="font-semibold text-blue-800 text-2xl">English (Staff)</span>
                </div>
                <p className="text-4xl text-blue-900 font-medium leading-relaxed">
                  {currentTranslation.englishText}
                </p>
              </div>

              {/* Translated Text - Large for Patient */}
              <div className="bg-green-50 border-4 border-green-300 rounded-lg p-12">
                <div className="flex items-center gap-4 mb-8">
                  <Languages className="w-12 h-12 text-green-600" />
                  <span className="font-bold text-green-800 text-3xl">
                    {currentTranslation.targetLanguage}
                  </span>
                  {/* Visual Quality Indicator */}
                  <div className="ml-auto">
                    {currentTranslation.qualityScore?.overallSafety === 'OK' && (
                      <div className="flex items-center gap-3 bg-green-100 px-6 py-3 rounded-full">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                        <span className="text-green-800 font-semibold text-2xl">Good Translation</span>
                      </div>
                    )}
                    {currentTranslation.qualityScore?.overallSafety === 'REVIEW' && (
                      <div className="flex items-center gap-3 bg-yellow-100 px-6 py-3 rounded-full">
                        <AlertTriangle className="w-12 h-12 text-yellow-600" />
                        <span className="text-yellow-800 font-semibold text-2xl">Check Translation</span>
                      </div>
                    )}
                    {currentTranslation.qualityScore?.overallSafety === 'NOT_OK' && (
                      <div className="flex items-center gap-3 bg-red-100 px-6 py-3 rounded-full">
                        <XCircle className="w-12 h-12 text-red-600" />
                        <span className="text-red-800 font-semibold text-2xl">Translation Issue</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-7xl text-green-900 font-semibold leading-relaxed tracking-wide">
                  {currentTranslation.translatedText}
                </p>
              </div>

              {/* Quality Metrics for Staff */}
              {currentTranslation.qualityScore && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      currentTranslation.qualityScore.accuracy >= 70 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {currentTranslation.qualityScore.accuracy}%
                    </div>
                    <div className="text-sm text-gray-600">Accuracy</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      currentTranslation.qualityScore.medicalSafety >= 70 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {currentTranslation.qualityScore.medicalSafety}%
                    </div>
                    <div className="text-sm text-gray-600">Safety</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      currentTranslation.qualityScore.clarity >= 70 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {currentTranslation.qualityScore.clarity}%
                    </div>
                    <div className="text-sm text-gray-600">Clarity</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      currentTranslation.qualityScore.confidence >= 70 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {currentTranslation.qualityScore.confidence}%
                    </div>
                    <div className="text-sm text-gray-600">Confidence</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 pt-6">
                <Button 
                  onClick={() => setIsTranslationModalOpen(false)}
                  className="px-8 py-3 text-lg"
                >
                  Close Display
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (currentTranslation) {
                      repeatTranslatedPhrase(currentTranslation.translatedText, currentTranslation.targetLanguage);
                    }
                  }}
                  className="px-8 py-3 text-lg"
                >
                  <Languages className="w-5 h-5 mr-2" />
                  Repeat Phrase
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};