import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Bot, 
  Phone, 
  PhoneOff,
  Settings,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Stethoscope,
  Heart,
  Shield,
  Building2,
  Users,
  FileText,
  PhoneCall
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const GPGenieVoiceAgent = ({ initialTab = 'gp-genie' }: { initialTab?: string }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const prevVolumeRef = useRef(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLanguageIndex, setCurrentLanguageIndex] = useState(0);

  const languageRotation = [
    { code: 'en', text: 'Test Language Support Service' },
    { code: 'de', text: 'Testen Sie den Sprachunterstützungsdienst' },
    { code: 'fr', text: 'Tester le service d\'assistance linguistique' },
    { code: 'ar', text: 'اختبار خدمة الدعم اللغوي' }
  ];

  const conversation = useConversation({
    onConnect: () => {
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      console.log(`Connected to ${serviceName}`);
      toast.success(`Connected to ${serviceName}`);
      setError(null);
    },
    onDisconnect: () => {
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      console.log(`Disconnected from ${serviceName}`);
      toast.info(`Disconnected from ${serviceName}`);
    },
    onMessage: (message) => {
      console.log('Message:', message);
      // Explicitly suppress transcript display
    },
    onError: (error) => {
      console.error('Conversation error:', error);
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

  // Generate signed URL for the agent
  const generateSignedUrl = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Select agent ID based on active tab
      const agentId = activeTab === 'gp-genie' 
        ? 'agent_01jwry2fzme7xsb2mwzatxseyt'  // GP Genie
        : activeTab === 'pm-genie'
        ? 'agent_01jzsg04q1fwy9bfydkhszan7s'  // PM Genie
        : 'agent_01jwrz44tyefdvhtvt7c622rj7';  // Oak Lane Patient Line

      console.log(`[${activeTab}] Generating signed URL for agentId:`, agentId);

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId }
      });

      console.log(`[${activeTab}] Supabase function response:`, { data, error });

      if (error) throw error;
      
      setAgentUrl(data.signed_url);
      return data.signed_url;
    } catch (err: any) {
      console.error('Failed to generate signed URL:', err);
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      setError(`Failed to connect to ${serviceName}. Please check your ElevenLabs API key.`);
      toast.error(`Failed to connect to ${serviceName}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Start conversation
  const startConversation = async () => {
    const permitted = hasPermission ? true : await requestMicrophonePermission();
    if (!permitted) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Generate signed URL first (required for authorized agents)
      const signedUrl = await generateSignedUrl();
      if (!signedUrl) {
        const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
        setError(`Failed to get authorization for ${serviceName}`);
        return;
      }

      console.log(`[${activeTab}] Starting conversation with signed URL:`, signedUrl);
      const conversationId = await conversation.startSession({ 
        agentId: activeTab === 'gp-genie' 
          ? 'agent_01jwry2fzme7xsb2mwzatxseyt'  // GP Genie
          : activeTab === 'pm-genie'
          ? 'agent_01jzsg04q1fwy9bfydkhszan7s'  // PM Genie
          : 'agent_01jwrz44tyefdvhtvt7c622rj7',  // Oak Lane Patient Line
        signedUrl
      });
      
      console.log(`[${activeTab}] Conversation started successfully:`, conversationId);

      // Apply current volume immediately after connect
      await conversation.setVolume({ volume: isMuted ? 0 : volume });
      console.log('Conversation started:', conversationId);
      
    } catch (err: any) {
      console.error('Failed to start conversation:', err);
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      setError(`Failed to start conversation with ${serviceName}`);
      toast.error('Failed to start conversation');
    } finally {
      setIsLoading(false);
    }
  };

  // Start language support test conversation
  const startLanguageTestConversation = async () => {
    const permitted = hasPermission ? true : await requestMicrophonePermission();
    if (!permitted) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Generate signed URL for language support agent
      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: 'agent_01jws2qhv2essav25m8cfq2h0v' }
      });

      if (error) throw error;
      
      console.log('Starting language test conversation with signed URL');
      const conversationId = await conversation.startSession({ 
        agentId: 'agent_01jws2qhv2essav25m8cfq2h0v',
        signedUrl: data.signed_url
      });

      // Apply current volume immediately after connect
      await conversation.setVolume({ volume: isMuted ? 0 : volume });
      console.log('Language test conversation started:', conversationId);
      
    } catch (err: any) {
      console.error('Failed to start language test conversation:', err);
      setError(`Failed to start language test conversation`);
      toast.error('Failed to start language test conversation');
    } finally {
      setIsLoading(false);
    }
  };

  // End conversation
  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (err: any) {
      console.error('Failed to end conversation:', err);
    }
  };

  // Handle volume change
  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    if (conversation.status === 'connected' && !isMuted) {
      await conversation.setVolume({ volume: newVolume });
    }
  };

  // Toggle sound mute
  const toggleSoundMute = async () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    try {
      if (conversation.status === 'connected') {
        if (newMutedState) {
          // store current volume and mute
          prevVolumeRef.current = volume;
          await conversation.setVolume({ volume: 0 });
          toast.info('Speaker muted');
        } else {
          // restore previous volume
          const restore = prevVolumeRef.current ?? 0.8;
          setVolume(restore);
          await conversation.setVolume({ volume: restore });
          toast.info('Speaker unmuted');
        }
      } else {
        toast.info(newMutedState ? 'Speaker muted' : 'Speaker unmuted');
      }
    } catch (err) {
      console.error('Sound toggle failed:', err);
      toast.error('Failed to toggle speaker');
      // Revert state if operation failed
      setIsMuted(!newMutedState);
    }
  };

  const toggleMicMute = async () => {
    const newState = !isMicMuted;
    setIsMicMuted(newState);

    try {
      if (conversation.status === 'connected') {
        // The ElevenLabs SDK doesn't have direct mic mute, so we use a workaround
        // We can't pause just the microphone without ending the session
        // This is a limitation of the current SDK
        toast.info(newState ? 'Microphone muted (visual only - connection stays open)' : 'Microphone unmuted');
      } else {
        toast.info(newState ? 'Microphone muted' : 'Microphone unmuted');
      }
    } catch (err) {
      console.error('Mic toggle failed:', err);
      toast.error('Failed to toggle microphone');
      // Revert state if operation failed
      setIsMicMuted(!newState);
    }
  };

  useEffect(() => {
    // Check if microphone permission is already granted
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setHasPermission(result.state === 'granted');
    });
  }, []);

  useEffect(() => {
    // Language rotation for the test button
    const interval = setInterval(() => {
      setCurrentLanguageIndex((prevIndex) => (prevIndex + 1) % languageRotation.length);
    }, 3000); // Rotate every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {activeTab === 'gp-genie' ? (
              <>
                <Stethoscope className="h-6 w-6 text-primary" />
                GP Genie Voice Assistant
              </>
            ) : activeTab === 'pm-genie' ? (
              <>
                <Building2 className="h-6 w-6 text-primary" />
                PM Genie Voice Assistant
              </>
            ) : (
              <>
                <PhoneCall className="h-6 w-6 text-primary" />
                Oak Lane Patient Line
              </>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              {activeTab === 'gp-genie' ? 'Clinical Voice AI' : activeTab === 'pm-genie' ? 'Practice Management AI' : 'Patient Telephone Triage'}
            </Badge>
            {conversation.status === 'connected' && (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>
        </div>
        
        {/* Service Selection Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gp-genie" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              GP Genie
            </TabsTrigger>
            <TabsTrigger value="pm-genie" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              PM Genie
            </TabsTrigger>
            <TabsTrigger value="patient-line" className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              Oak Lane Patient Line
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <p className="text-sm text-muted-foreground mt-3">
          {activeTab === 'gp-genie' 
            ? 'Speak naturally with GP Genie, your AI assistant for clinical guidance, patient reassurance advice, and evidence-based medicine support.'
            : activeTab === 'pm-genie'
            ? 'Speak with PM Genie, your calm and knowledgeable voice assistant for GP Practice Management in Northamptonshire, providing operational, HR, and practice management guidance.'
            : 'Oak Lane Patient Line - Accessible telephone triage for all patients using any phone line. Perfect for those who prefer traditional telephone communication, have limited IT skills, or need multilingual support.'
          }
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {(error.includes('Failed to start conversation with GP Genie') && activeTab === 'gp-genie') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jwry2fzme7xsb2mwzatxseyt" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Try GP Genie Direct Link
                  </a>
                  <p className="text-xs mt-1 text-muted-foreground">Use this backup link to access GP Genie directly</p>
                </div>
              )}
              {(error.includes('Failed to start conversation with PM Genie') && activeTab === 'pm-genie') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jzsg04q1fwy9bfydkhszan7s" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Try PM Genie Direct Link
                  </a>
                  <p className="text-xs mt-1 text-muted-foreground">Use this backup link to access PM Genie directly</p>
                </div>
              )}
              {(error.includes('Failed to start conversation with Oak Lane Patient Line') && activeTab === 'patient-line') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jwrz44tyefdvhtvt7c622rj7" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Try Oak Lane Patient Line Direct Link
                  </a>
                  <p className="text-xs mt-1 text-muted-foreground">Use this backup link to access Oak Lane Patient Line directly</p>
                </div>
              )}
              {error.includes('Failed to start language test conversation') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jws2qhv2essav25m8cfq2h0v" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Try Translation Service Direct Link
                  </a>
                  <p className="text-xs mt-1 text-muted-foreground">Use this backup link to access the Translation Service directly</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Permission Alert */}
        {!hasPermission && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Microphone access is required for voice conversation. 
              <Button 
                variant="link" 
                className="p-0 ml-1 h-auto"
                onClick={requestMicrophonePermission}
              >
                Grant permission
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Interface */}
        <div className="flex flex-col items-center space-y-6 py-8">
          {/* Status Indicator */}
          <div className="text-center space-y-2">
            
            <div className="space-y-1">
              <p className="font-medium">
                {conversation.status === 'connected' 
                  ? conversation.isSpeaking 
                    ? `${activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line'} is speaking...` 
                    : `Listening for your ${activeTab === 'gp-genie' ? 'clinical' : activeTab === 'pm-genie' ? 'practice management' : 'patient triage'} question...`
                  : 'Ready to connect'
                }
              </p>
               <p className="text-sm text-muted-foreground">
                 {conversation.status === 'connected'
                   ? activeTab === 'gp-genie'
                     ? 'Ask about patient care, clinical protocols, or consultation guidance'
                     : activeTab === 'pm-genie'
                     ? 'Ask about operational matters, HR guidance, or practice management'
                     : 'Ask about symptoms, health concerns, or medical guidance'
                   : activeTab === 'gp-genie'
                   ? `Click start to talk with GP Genie`
                   : activeTab === 'pm-genie'
                   ? `Click start to talk with PM Genie`
                   : `Click start to talk with Patient Triage service Demo`
                 }
               </p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-4">
            {conversation.status === 'connected' ? (
              <Button 
                onClick={endConversation}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2"
              >
                <PhoneOff className="h-5 w-5" />
                End Consultation
              </Button>
            ) : (
              <Button 
                onClick={startConversation}
                disabled={!hasPermission || isLoading}
                size="lg"
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Phone className="h-5 w-5" />
                )}
                {isLoading ? 'Connecting...' : 'Start the Conversation'}
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Content Based on Selected Service */}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="gp-genie" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  What GP Genie Can Help With
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>Patient Reassurance:</strong> Scripts and approaches for anxious patients</p>
                  <p>• <strong>Clinical Guidance:</strong> Evidence-based advice for common presentations</p>
                  <p>• <strong>Consultation Skills:</strong> Communication techniques and difficult conversations</p>
                  <p>• <strong>Safety Netting:</strong> When to worry, red flags, and follow-up advice</p>
                  <p>• <strong>Documentation Help:</strong> Note templates and coding guidance</p>
                  <p>• <strong>Prescribing Support:</strong> Drug interactions, dosing, and alternatives</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Sources & Clinical Intelligence
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>NICE Guidelines & CKS:</strong> Latest clinical evidence and recommendations</p>
                  <p>• <strong>BMJ Best Practice:</strong> Evidence-based clinical decision support</p>
                  <p>• <strong>BNF & MHRA Alerts:</strong> Prescribing guidance and safety alerts</p>
                  <p>• <strong>Clinical Prediction Rules:</strong> QRISK, CHA2DS2-VASc scoring systems</p>
                  <p>• <strong>QOF & CQC Standards:</strong> Quality frameworks and regulatory compliance</p>
                  <p>• <strong>Cochrane Reviews:</strong> Systematic evidence synthesis</p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="pm-genie" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  What PM Genie Can Help With
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>Patient Complaints:</strong> Professional handling and resolution strategies</p>
                  <p>• <strong>Staff Management:</strong> Sickness, recruitment, and rota planning</p>
                  <p>• <strong>ARRS & QOF:</strong> Additional roles, Quality Outcomes Framework guidance</p>
                  <p>• <strong>CQC Inspections:</strong> Preparation strategies and compliance requirements</p>
                  <p>• <strong>HR Letters & Policies:</strong> Template creation and policy guidance</p>
                  <p>• <strong>NHS Updates:</strong> Latest NHS England and ICB guidance</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Practice Management Intelligence
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>IIF & PCN Funding:</strong> Investment and Incentive Framework guidance</p>
                  <p>• <strong>NHS Contract Management:</strong> GMS, PMS, and APMS contract advice</p>
                  <p>• <strong>Staff Development:</strong> Training requirements and career progression</p>
                  <p>• <strong>Financial Management:</strong> Budget planning and cost optimization</p>
                  <p>• <strong>Digital Transformation:</strong> System implementations and workflow optimization</p>
                  <p>• <strong>Regulatory Compliance:</strong> GDPR, IG, and clinical governance</p>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="patient-line" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-primary" />
                  Oak Lane Patient Line Features
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>No Smartphone Required:</strong> Works with any landline or mobile phone</p>
                  <p>• <strong>Simple to Use:</strong> Just dial and speak - no apps or internet needed</p>
                  <p>• <strong>Multilingual Support:</strong> Available in multiple languages for diverse communities</p>
                  <p>• <strong>24/7 Availability:</strong> Accessible any time of day for urgent triage</p>
                  <p>• <strong>IT-Free Experience:</strong> Perfect for elderly patients and those with limited tech skills</p>
                  <p>• <strong>Clear Audio Quality:</strong> Optimized for older telephone systems and hearing aids</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  Patient Accessibility Benefits
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>Language Barriers:</strong> Helps non-English speakers access healthcare guidance</p>
                  <p>• <strong>Digital Divide:</strong> Bridges the gap for patients without modern technology</p>
                  <p>• <strong>Hearing Impairments:</strong> Compatible with traditional hearing aids and amplified phones</p>
                  <p>• <strong>Elderly-Friendly:</strong> Familiar telephone interface reduces anxiety and confusion</p>
                  <p>• <strong>Rural Communities:</strong> Works with basic phone infrastructure in remote areas</p>
                  <p>• <strong>Economic Accessibility:</strong> No data charges or app downloads required</p>
                </div>
                <div className="mt-3 pt-2 border-t border-muted">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs transition-all duration-300"
                    onClick={startLanguageTestConversation}
                    disabled={!hasPermission || isLoading}
                  >
                    <PhoneCall className="h-3 w-3 mr-1" />
                    {languageRotation[currentLanguageIndex].text}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Features */}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="gp-genie" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Stethoscope className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Clinical Expertise</h4>
                <p className="text-xs text-muted-foreground">
                  NICE guidelines, RCGP protocols, and evidence-based clinical decision support
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Heart className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Patient Reassurance</h4>
                <p className="text-xs text-muted-foreground">
                  Effective communication strategies for anxious patients and difficult consultations
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Shield className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Safety Netting</h4>
                <p className="text-xs text-muted-foreground">
                  Red flag recognition, when to refer, and comprehensive follow-up planning
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="pm-genie" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Building2 className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Practice Operations</h4>
                <p className="text-xs text-muted-foreground">
                  Staff management, rotas, and operational efficiency guidance for GP practices
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">HR & Compliance</h4>
                <p className="text-xs text-muted-foreground">
                  Professional complaint handling and CQC inspection preparation strategies
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">NHS Frameworks</h4>
                <p className="text-xs text-muted-foreground">
                  QOF, IIF, ARRS roles, and PCN funding guidance with latest NHS updates
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="patient-line" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <PhoneCall className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Universal Access</h4>
                <p className="text-xs text-muted-foreground">
                  Any phone works - landline, mobile, or payphone. No internet or apps required
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Language Support</h4>
                <p className="text-xs text-muted-foreground">
                  Multi-language triage service supporting diverse community healthcare needs
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Heart className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Inclusive Design</h4>
                <p className="text-xs text-muted-foreground">
                  Designed for elderly, disabled, and digitally excluded patients
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Usage Tips */}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="gp-genie" className="mt-0">
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">💡 How to Use GP Genie</h4>
              <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <p>• Speak naturally about your clinical scenario or patient concern</p>
                <p>• Ask for specific guidance: "How do I reassure a patient about chest pain?"</p>
                <p>• Request templates: "Give me safety netting advice for abdominal pain"</p>
                <p>• Get prescribing help: "What are the alternatives to amoxicillin?"</p>
                <p>• Practice difficult conversations with role-play scenarios</p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="pm-genie" className="mt-0">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h4 className="font-medium text-sm mb-2 text-green-900 dark:text-green-100">💡 How to Use PM Genie</h4>
              <div className="text-xs text-green-800 dark:text-green-200 space-y-1">
                <p>• Ask about operational challenges: "How do I handle staff sickness cover?"</p>
                <p>• Get complaint guidance: "Help me respond to a patient complaint professionally"</p>
                <p>• Request HR templates: "Draft a recruitment letter for a practice nurse"</p>
                <p>• QOF & funding queries: "Explain the latest IIF requirements"</p>
                <p>• CQC preparation: "What should I prepare for our next inspection?"</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GPGenieVoiceAgent;