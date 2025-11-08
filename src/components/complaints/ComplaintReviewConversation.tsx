import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConversation } from '@11labs/react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Clock } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';

interface ComplaintReviewConversationProps {
  complaintId: string;
  onReviewComplete?: () => void;
}

export function ComplaintReviewConversation({
  complaintId,
  onReviewComplete,
}: ComplaintReviewConversationProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const startTimeRef = useRef<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      startTimeRef.current = new Date();
      setConversationStarted(true);
      setIsInitializing(false);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      showToast.error('Conversation error: ' + error, { section: 'complaints' });
      setIsInitializing(false);
    },
    onMessage: (message) => {
      console.log('Message received:', message);
      
      // Capture transcript from user and assistant messages
      if (message.source === 'user') {
        setTranscript((prev) => prev + `\n[User]: ${message.message}`);
      } else if (message.source === 'ai') {
        setTranscript((prev) => prev + `\n[AI]: ${message.message}`);
      }
    },
    clientTools: {
      captureChallenge: (parameters: { challenge: string; severity: 'minor' | 'moderate' | 'significant' }) => {
        console.log('Challenge captured:', parameters);
        setChallenges((prev) => [...prev, parameters]);
        return 'Challenge recorded';
      },
      captureResponse: (parameters: { response: string; addresses_challenge_id?: string }) => {
        console.log('Response captured:', parameters);
        setResponses((prev) => [...prev, parameters]);
        return 'Response recorded';
      },
      captureRecommendation: (parameters: { recommendation: string; priority: 'low' | 'medium' | 'high' }) => {
        console.log('Recommendation captured:', parameters);
        setRecommendations((prev) => [...prev, parameters]);
        return 'Recommendation recorded';
      },
      endReviewSession: (parameters: { overall_assessment: string }) => {
        console.log('Session ending:', parameters);
        setTranscript((prev) => prev + `\n[AI Summary]: ${parameters.overall_assessment}`);
        return 'Session ended';
      },
    },
  });

  const handleStartConversation = async () => {
    setIsInitializing(true);
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('Fetching signed URL from edge function...');
      
      // Get signed URL from our edge function
      const { data, error } = await supabase.functions.invoke('complaint-review-agent', {
        body: { complaintId },
      });

      if (error) {
        // Check if it's a configuration error
        if (error.message && error.message.includes('ElevenLabs')) {
          showToast.error('AI Review requires ElevenLabs configuration. Please contact your administrator.', { section: 'complaints' });
        } else {
          showToast.error(error.message || 'Failed to initialise conversation', { section: 'complaints' });
        }
        setIsInitializing(false);
        return;
      }

      if (!data?.signed_url) {
        showToast.error('Configuration error: No signed URL received. Please contact your administrator.', { section: 'complaints' });
        setIsInitializing(false);
        return;
      }

      console.log('Starting conversation with signed URL...');
      
      // Start the conversation
      await conversation.startSession({
        signedUrl: data.signed_url,
      });

      showToast.success('Review conversation started', { section: 'complaints' });
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      showToast.error(error.message || 'Failed to start conversation', { section: 'complaints' });
      setIsInitializing(false);
    }
  };

  const handleEndConversation = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      const endTime = new Date();
      const duration = elapsedTime;

      console.log('Ending conversation and processing review...');

      // End the conversation
      await conversation.endSession();
      setConversationStarted(false);

      // Process the conversation
      const { data, error } = await supabase.functions.invoke('process-review-conversation', {
        body: {
          complaintId,
          transcript,
          challenges,
          responses,
          recommendations,
          duration,
          startedAt: startTimeRef.current?.toISOString(),
          endedAt: endTime.toISOString(),
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to process conversation');
      }

      showToast.success('Review conversation saved successfully', { section: 'complaints' });
      
      // Reset state
      setElapsedTime(0);
      setTranscript('');
      setChallenges([]);
      setResponses([]);
      setRecommendations([]);
      startTimeRef.current = null;

      // Notify parent
      onReviewComplete?.();
    } catch (error: any) {
      console.error('Failed to end conversation:', error);
      showToast.error(error.message || 'Failed to save conversation', { section: 'complaints' });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Review Conversation</h3>
          <p className="text-sm text-muted-foreground">
            Discuss and critically review this complaint with an AI assistant
          </p>
        </div>
        {conversationStarted && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span className="font-mono">{formatTime(elapsedTime)}</span>
            {elapsedTime >= 300 && (
              <span className="text-orange-500 text-xs">(Time limit reached)</span>
            )}
          </div>
        )}
      </div>

      {!conversationStarted ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-muted-foreground text-centre max-w-md">
            Start a 1-5 minute voice conversation with an AI assistant to thoroughly review this complaint.
            The AI will ask probing questions and help identify areas for improvement.
          </p>
          <Button
            onClick={handleStartConversation}
            disabled={isInitializing}
            size="lg"
            className="gap-2"
          >
            {isInitializing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Initialising...
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Start AI Review Conversation
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connection status */}
          <div className="flex items-centre justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-centre gap-2">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Connected - AI is listening</span>
            </div>
            {conversation.isSpeaking && (
              <div className="flex items-centre gap-1">
                <div className="h-2 w-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="h-3 w-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="h-4 w-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="h-3 w-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                <div className="h-2 w-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
                <span className="text-xs text-muted-foreground ml-2">AI speaking...</span>
              </div>
            )}
          </div>

          {/* Captured insights */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-muted/30 rounded">
              <span className="font-medium">Challenges:</span> {challenges.length}
            </div>
            <div className="p-2 bg-muted/30 rounded">
              <span className="font-medium">Responses:</span> {responses.length}
            </div>
            <div className="p-2 bg-muted/30 rounded">
              <span className="font-medium">Recommendations:</span> {recommendations.length}
            </div>
          </div>

          {/* End conversation button */}
          <Button
            onClick={handleEndConversation}
            variant="destructive"
            className="w-full gap-2"
          >
            <PhoneOff className="h-4 w-4" />
            End Conversation & Save Review
          </Button>

          <p className="text-xs text-muted-foreground text-centre">
            The conversation will be transcribed and analysed to generate a comprehensive review note.
          </p>
        </div>
      )}
    </Card>
  );
}
