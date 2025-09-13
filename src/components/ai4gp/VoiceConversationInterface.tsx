import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX, Play, Pause, Settings } from 'lucide-react';
import { SimpleBrowserMic, SimpleBrowserMicRef } from './SimpleBrowserMic';
import MessageRenderer from '../MessageRenderer';
import { MessagesList } from './MessagesList';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/ai4gp';
import { cn } from '@/lib/utils';

interface VoiceConversationInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  className?: string;
}

export const VoiceConversationInterface: React.FC<VoiceConversationInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  className = ''
}) => {
  const { toast } = useToast();
  const micRef = useRef<SimpleBrowserMicRef>(null);
  
  // Voice interface state
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('alloy');

  // Available ElevenLabs voices
  const voices = [
    { id: 'alloy', name: 'Alloy' },
    { id: 'echo', name: 'Echo' },
    { id: 'shimmer', name: 'Shimmer' },
    { id: 'sage', name: 'Sage' }
  ];

  // Handle transcript updates from mic
  const handleTranscriptUpdate = useCallback((text: string) => {
    setCurrentTranscript(text);
  }, []);

  // Handle recording state
  const handleRecordingStart = useCallback(() => {
    setIsListening(true);
    setCurrentTranscript('');
  }, []);

  // Send message when recording stops and we have text
  useEffect(() => {
    if (!isListening && currentTranscript.trim()) {
      console.log('🎙️ Sending voice message:', currentTranscript);
      onSendMessage(currentTranscript);
      setCurrentTranscript('');
    }
  }, [isListening, currentTranscript, onSendMessage]);

  // Text-to-speech function using ElevenLabs
  const speakText = useCallback(async (text: string) => {
    if (!text.trim() || !autoSpeak) return;

    try {
      setIsSpeaking(true);
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: {
          text: text,
          voice: selectedVoice
        }
      });

      if (error) {
        throw error;
      }

      if (data?.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        setCurrentAudio(audio);
        
        audio.onended = () => {
          setIsSpeaking(false);
          setCurrentAudio(null);
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          setCurrentAudio(null);
        };
        
        await audio.play();
      }
    } catch (error) {
      console.error('❌ Text-to-speech error:', error);
      setIsSpeaking(false);
      toast({
        title: "Speech Error",
        description: "Failed to play AI response audio.",
        variant: "destructive",
      });
    }
  }, [autoSpeak, selectedVoice, toast]);

  // Auto-speak new AI messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !isLoading && autoSpeak) {
        // Small delay to ensure message is fully rendered
        setTimeout(() => {
          speakText(lastMessage.content);
        }, 500);
      }
    }
  }, [messages, isLoading, speakText, autoSpeak]);

  // Stop current audio
  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsSpeaking(false);
    }
  }, [currentAudio]);

  // Toggle auto-speak
  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak(prev => !prev);
    if (!autoSpeak) {
      stopAudio();
    }
  }, [autoSpeak, stopAudio]);

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Voice Controls Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mic className="w-5 h-5 text-primary" />
              Voice Conversation
              {isListening && <Badge variant="secondary" className="animate-pulse">Listening...</Badge>}
              {isSpeaking && <Badge variant="outline" className="animate-pulse">Speaking...</Badge>}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Auto-speak toggle */}
              <Button
                variant={autoSpeak ? "default" : "outline"}
                size="sm"
                onClick={toggleAutoSpeak}
                className="px-3"
              >
                {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="ml-1 hidden sm:inline">
                  {autoSpeak ? 'Auto-speak On' : 'Auto-speak Off'}
                </span>
              </Button>

              {/* Stop audio button */}
              {isSpeaking && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopAudio}
                  className="px-3"
                >
                  <Pause className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">Stop</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex flex-col items-center gap-4">
            {/* Voice input area */}
            <div className="flex flex-col items-center gap-2 w-full">
              <SimpleBrowserMic
                ref={micRef}
                onTranscriptUpdate={handleTranscriptUpdate}
                onRecordingStart={handleRecordingStart}
                disabled={isLoading || isSpeaking}
                className="justify-center"
              />
              
              {/* Live transcript preview */}
              {currentTranscript && (
                <div className="bg-muted/50 rounded-lg p-3 max-w-md text-center">
                  <p className="text-sm text-muted-foreground mb-1">Current transcript:</p>
                  <p className="text-sm">{currentTranscript}</p>
                </div>
              )}
            </div>

            {/* Voice settings */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <select 
                  value={selectedVoice} 
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="bg-background border rounded px-2 py-1 text-sm"
                >
                  {voices.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Display */}
      <div className="flex-1 min-h-0">
        <MessagesList
          messages={messages}
          isLoading={isLoading}
          expandedMessage={null}
          setExpandedMessage={() => {}}
        />
      </div>

      {/* Voice Status Footer */}
      <div className="mt-4 pt-3 border-t">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isListening ? "bg-red-500 animate-pulse" : "bg-gray-300"
            )} />
            <span>Microphone</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isSpeaking ? "bg-blue-500 animate-pulse" : "bg-gray-300"
            )} />
            <span>AI Voice</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              autoSpeak ? "bg-green-500" : "bg-gray-300"
            )} />
            <span>Auto-speak</span>
          </div>
        </div>
      </div>
    </div>
  );
};