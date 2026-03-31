import React from 'react';
import { GeminiLiveVoiceAgent } from '@/components/gemini/GeminiLiveVoiceAgent';

interface VoiceConversationTabProps {
  resetTrigger: number;
}

export const VoiceConversationTab = ({ resetTrigger }: VoiceConversationTabProps) => {
  return (
    <div className="space-y-4">
      <GeminiLiveVoiceAgent />
    </div>
  );
};
