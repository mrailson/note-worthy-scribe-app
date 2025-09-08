import React, { useState, useRef, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  Globe
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export const TranslationToolInterface = () => {
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [conversationBuffer, setConversationBuffer] = useState<{user: string, agent: string}[]>([]);
  const [isQualityDetailsOpen, setIsQualityDetailsOpen] = useState(false);
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

      // Translation service agent ID
      const agentId = 'agent_01jwrz44tyefdvhtvt7c622rj7';  // Translation Service Agent

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
        agentId: 'agent_01jwrz44tyefdvhtvt7c622rj7',  // Translation Service Agent
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
                  Press "Start Translation Service" button below
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

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              {conversation.status === 'connected' ? (
                <Button
                  onClick={endTranslationService}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Translation Service
                </Button>
              ) : (
                <Button
                  onClick={startTranslationService}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  Start Translation Service
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {conversation.status === 'connected' && (
                <Badge variant="default" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Service Active
                </Badge>
              )}
              {conversation.isSpeaking && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  <Languages className="h-3 w-3 mr-1" />
                  Translating...
                </Badge>
              )}
            </div>
          </div>

          {/* Instructions */}
          {conversation.status === 'connected' && (
            <Alert>
              <Languages className="h-4 w-4" />
              <AlertDescription>
                <strong>Service Active:</strong> Speak clearly in English, and the AI will automatically translate to the patient's language. 
                Patient responses will be translated back to English. All conversations are quality-verified for medical accuracy.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Translation Quality Status */}
      {qualityScore && (
        <Card className="border-2" style={{
          borderColor: qualityScore.overallSafety === 'OK' ? 'rgb(34 197 94)' : 
                     qualityScore.overallSafety === 'REVIEW' ? 'rgb(234 179 8)' : 'rgb(239 68 68)'
        }}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium mb-2">
                  Translation Quality: {qualityScore.overallSafety === 'OK' ? 'Verified Safe' : 
                                      qualityScore.overallSafety === 'REVIEW' ? 'Review Recommended' : 'Quality Issues Detected'}
                  {qualityScore.targetLanguage && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Translated to {qualityScore.targetLanguage})
                    </span>
                  )}
                </div>
                
                <Badge 
                  variant={getBadgeVariant(qualityScore)}
                  className="text-xs"
                >
                  {getQualityIcon(qualityScore)}
                  {qualityScore.confidence}% Confidence
                </Badge>
              </div>
              
              {/* Original and Translated Phrases */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Original Phrase:</p>
                  <p className="text-sm">{qualityScore.originalPhrase}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">AI Response:</p>
                  <p className="text-sm">{qualityScore.translatedPhrase}</p>
                </div>
              </div>

              {/* Quality Details - Collapsible */}
              <Collapsible 
                open={isQualityDetailsOpen} 
                onOpenChange={setIsQualityDetailsOpen}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                    <span className="text-sm font-medium">View Quality Details</span>
                    {isQualityDetailsOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Accuracy:</span>
                      <span className="font-medium">{qualityScore.accuracy}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Medical Safety:</span>
                      <span className="font-medium">{qualityScore.medicalSafety}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Cultural Sensitivity:</span>
                      <span className="font-medium">{qualityScore.culturalSensitivity}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Clarity:</span>
                      <span className="font-medium">{qualityScore.clarity}%</span>
                    </div>
                  </div>
                  {qualityScore.explanation && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs font-medium mb-1">Quality Assessment:</p>
                      <p className="text-xs text-muted-foreground">{qualityScore.explanation}</p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};