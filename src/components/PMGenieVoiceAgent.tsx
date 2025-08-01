import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PMGenieVoiceAgent = () => {
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to PM Genie');
      toast.success('Connected to PM Genie');
      setError(null);
    },
    onDisconnect: () => {
      console.log('Disconnected from PM Genie');
      toast.info('Disconnected from PM Genie');
    },
    onMessage: (message) => {
      console.log('Message:', message);
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      setError(typeof error === 'string' ? error : 'Connection error occurred');
      toast.error(`Error: ${typeof error === 'string' ? error : 'Connection failed'}`);
    }
  });

  // Request microphone permission
  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      toast.success('Microphone access granted');
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setError('Microphone access is required for voice conversation');
      toast.error('Microphone access denied');
    }
  };

  // Generate signed URL for the agent
  const generateSignedUrl = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: 'agent_01jzsg04q1fwy9bfydkhszan7s' }
      });

      if (error) throw error;
      
      setAgentUrl(data.signed_url);
      return data.signed_url;
    } catch (err: any) {
      console.error('Failed to generate signed URL:', err);
      setError('Failed to connect to PM Genie. Please check your ElevenLabs API key.');
      toast.error('Failed to connect to PM Genie');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Start conversation
  const startConversation = async () => {
    if (!hasPermission) {
      await requestMicrophonePermission();
      if (!hasPermission) return;
    }

    try {
      setIsLoading(true);
      
      // Generate signed URL first
      const url = await generateSignedUrl();
      if (!url) {
        setError('Failed to get authorization for PM Genie');
        return;
      }

      console.log('Starting conversation with URL:', url);
      const conversationId = await conversation.startSession({ agentId: 'agent_01jzsg04q1fwy9bfydkhszan7s' });
      
    } catch (err: any) {
      console.error('Failed to start conversation:', err);
      setError('Failed to start conversation with PM Genie');
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
    if (conversation.status === 'connected') {
      await conversation.setVolume({ volume: newVolume });
    }
  };

  useEffect(() => {
    // Check if microphone permission is already granted
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setHasPermission(result.state === 'granted');
    });
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            PM Genie Voice Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Voice AI
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
          Speak naturally with PM Genie, your AI assistant specialized in NHS GP practice management.
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
                    ? 'PM Genie is speaking...' 
                    : 'Listening...'
                  : 'Ready to connect'
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {conversation.status === 'connected'
                  ? 'Speak naturally - PM Genie will respond in real-time'
                  : 'Click start to begin your voice conversation'
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
                End Conversation
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
                {isLoading ? 'Connecting...' : 'Start Conversation'}
              </Button>
            )}
          </div>

          {/* Volume Control */}
          {conversation.status === 'connected' && (
            <div className="flex items-center gap-3 w-full max-w-xs">
              <VolumeX className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Settings className="h-6 w-6 mx-auto mb-2 text-primary" />
            <h4 className="font-medium text-sm mb-1">NHS Expertise</h4>
            <p className="text-xs text-muted-foreground">
              Specialized knowledge of GP practice management, CQC compliance, and NHS policies
            </p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Mic className="h-6 w-6 mx-auto mb-2 text-primary" />
            <h4 className="font-medium text-sm mb-1">Natural Conversation</h4>
            <p className="text-xs text-muted-foreground">
              Speak naturally and get instant voice responses in real-time
            </p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Bot className="h-6 w-6 mx-auto mb-2 text-primary" />
            <h4 className="font-medium text-sm mb-1">Intelligent Assistant</h4>
            <p className="text-xs text-muted-foreground">
              Get help with policies, procedures, compliance, and daily operations
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PMGenieVoiceAgent;