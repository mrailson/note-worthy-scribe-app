import React, { useState } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

const GP_GENIE_AGENT_ID = 'agent_01jwry2fzme7xsb2mwzatxseyt';

interface GPGenieVoiceAgentProps {
  onClose?: () => void;
  initialTab?: string; // Legacy prop - ignored
}

export default function GPGenieVoiceAgent({ onClose }: GPGenieVoiceAgentProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      console.log('GP Genie: Connected');
      setIsConnecting(false);
      toast.success('Connected to GP Genie');
    },
    onDisconnect: () => {
      console.log('GP Genie: Disconnected');
      setIsConnecting(false);
      toast.info('Disconnected from GP Genie');
    },
    onError: (error) => {
      console.error('GP Genie error:', error);
      setIsConnecting(false);
      toast.error('Connection failed');
    }
  });

  const startConversation = async () => {
    try {
      console.log('GP Genie: Starting conversation...');
      setIsConnecting(true);
      
      // Request microphone permission  
      console.log('GP Genie: Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('GP Genie: Microphone permission granted');
      
      // Get signed URL
      console.log('GP Genie: Getting signed URL from edge function...');
      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: GP_GENIE_AGENT_ID }
      });

      if (error) {
        console.error('GP Genie: Edge function error:', error);
        throw error;
      }

      if (!data?.signed_url) {
        console.error('GP Genie: No signed URL received:', data);
        throw new Error('No signed URL received from server');
      }
      
      console.log('GP Genie: Got signed URL, starting ElevenLabs session...');
      
      // Start conversation
      await conversation.startSession({ signedUrl: data.signed_url });
      console.log('GP Genie: Session started successfully');
      
    } catch (error) {
      console.error('GP Genie: Failed to start conversation:', error);
      setIsConnecting(false);
      
      let errorMessage = 'Failed to start conversation';
      if (error.message?.includes('microphone') || error.message?.includes('permission')) {
        errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
      } else if (error.message?.includes('ELEVENLABS_API_KEY')) {
        errorMessage = 'ElevenLabs API key not configured. Please check your settings.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to end conversation:', error);
    }
  };

  const isConnected = conversation.status === 'connected';

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            GP Genie Voice Assistant
          </CardTitle>
          <CardDescription>
            AI-powered voice assistant for medical consultations and clinical support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            {!isConnected && !isConnecting ? (
              <Button 
                onClick={startConversation} 
                size="lg" 
                className="w-full"
                disabled={isConnecting}
              >
                <Mic className="mr-2 h-4 w-4" />
                Start Conversation
              </Button>
            ) : isConnecting ? (
              <Button disabled size="lg" className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </Button>
            ) : (
              <Button 
                onClick={endConversation} 
                size="lg" 
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                <MicOff className="mr-2 h-4 w-4" />
                End Conversation
              </Button>
            )}
          </div>

          {isConnected && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                🔴 Live - Speak now
              </p>
            </div>
          )}

          {onClose && (
            <div className="flex justify-end pt-4">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}