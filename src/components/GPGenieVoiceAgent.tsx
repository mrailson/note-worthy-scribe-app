import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Mic, ExternalLink } from 'lucide-react';

const GP_GENIE_URL = 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jwry2fzme7xsb2mwzatxseyt';

interface GPGenieVoiceAgentProps {
  onClose?: () => void;
  initialTab?: string; // Legacy prop - ignored
}

export default function GPGenieVoiceAgent({ onClose }: GPGenieVoiceAgentProps) {
  const handleStartConversation = () => {
    window.open(GP_GENIE_URL, '_blank', 'noopener,noreferrer');
  };

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
            <Button onClick={handleStartConversation} size="lg" className="w-full">
              <Mic className="mr-2 h-4 w-4" />
              Start Conversation
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>

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