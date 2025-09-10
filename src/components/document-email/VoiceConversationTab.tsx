import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic } from 'lucide-react';

interface VoiceConversationTabProps {
  resetTrigger: number;
}

export const VoiceConversationTab = ({ resetTrigger }: VoiceConversationTabProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            AI Voice Conversation Translation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-6 border rounded-lg bg-muted/30">
              <div className="text-center space-y-3">
                <Mic className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold">ElevenLabs Voice Translation</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time voice conversation translation using ElevenLabs AI agent.
                  This feature enables live interpretation between GP and patient.
                </p>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <p><strong>How it works:</strong></p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Connect to ElevenLabs AI agent for real-time conversation</li>
                <li>Automatic language detection and translation</li>
                <li>Quality scoring and safety assessment</li>
                <li>Session history and transcript export</li>
              </ul>
            </div>
            
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                The full ElevenLabs voice conversation interface will be integrated here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};