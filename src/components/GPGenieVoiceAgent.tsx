import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const GPGenieVoiceAgent = () => {
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const prevVolumeRef = useRef(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to GP Genie');
      toast.success('Connected to GP Genie');
      setError(null);
    },
    onDisconnect: () => {
      console.log('Disconnected from GP Genie');
      toast.info('Disconnected from GP Genie');
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

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: 'agent_01jwry2fzme7xsb2mwzatxseyt' }
      });

      if (error) throw error;
      
      setAgentUrl(data.signed_url);
      return data.signed_url;
    } catch (err: any) {
      console.error('Failed to generate signed URL:', err);
      setError('Failed to connect to GP Genie. Please check your ElevenLabs API key.');
      toast.error('Failed to connect to GP Genie');
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
        setError('Failed to get authorization for GP Genie');
        return;
      }

      console.log('Starting conversation with signed URL');
      const conversationId = await conversation.startSession({ 
        signedUrl
      });

      // Apply current volume immediately after connect
      await conversation.setVolume({ volume: isMuted ? 0 : volume });
      console.log('Conversation started:', conversationId);
      
    } catch (err: any) {
      console.error('Failed to start conversation:', err);
      setError('Failed to start conversation with GP Genie');
      toast.error('Failed to start conversation');
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
    
    if (conversation.status === 'connected') {
      if (newMutedState) {
        // store current volume and mute
        prevVolumeRef.current = volume;
        await conversation.setVolume({ volume: 0 });
      } else {
        // restore previous volume
        const restore = prevVolumeRef.current ?? 0.8;
        setVolume(restore);
        await conversation.setVolume({ volume: restore });
      }
      toast.info(newMutedState ? 'Sound muted' : 'Sound unmuted');
    }
  };

  const toggleMicMute = async () => {
    const newState = !isMicMuted;
    setIsMicMuted(newState);

    // The ElevenLabs SDK doesn't support pausing input directly
    // So we just update the UI state - the user can end/restart if needed
    toast.info(newState ? 'Microphone muted' : 'Microphone unmuted');
  };

  useEffect(() => {
    // Check if microphone permission is already granted
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setHasPermission(result.state === 'granted');
    });
  }, []);

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            GP Genie Voice Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Clinical Voice AI
            </Badge>
            {conversation.status === 'connected' && (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Speak naturally with GP Genie, your AI assistant for clinical guidance, patient reassurance advice, and evidence-based medicine support.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
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
                    ? 'GP Genie is speaking...' 
                    : 'Listening for your clinical question...'
                  : 'Ready to connect'
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {conversation.status === 'connected'
                  ? 'Ask about patient care, clinical protocols, or consultation guidance'
                  : 'Click start to talk with GP Genie'
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

          {/* Audio Controls */}
          {conversation.status === 'connected' && (
            <div className="space-y-4 w-full max-w-md">
              {/* Mute Controls */}
              <div className="flex items-center justify-center gap-6">
                <Button
                  variant={isMicMuted ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleMicMute}
                  className="flex items-center gap-2"
                >
                  {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isMicMuted ? 'Unmute' : 'Mute'}
                </Button>
                
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleSoundMute}
                  className="flex items-center gap-2"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {isMuted ? 'Sound Off' : 'Sound On'}
                </Button>
              </div>
              
              {/* Volume Slider */}
              <div className="flex items-center gap-3">
                <VolumeX className="h-4 w-4 text-muted-foreground" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  disabled={isMuted}
                  className="flex-1 disabled:opacity-50"
                />
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground min-w-[3ch]">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* What GP Genie Can Help With & Sources */}
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

        {/* Features */}
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

        {/* Usage Tips */}
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
      </CardContent>
    </Card>
  );
};

export default GPGenieVoiceAgent;