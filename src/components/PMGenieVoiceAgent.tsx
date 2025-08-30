import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Phone, 
  PhoneOff, 
  AlertCircle, 
  CheckCircle2,
  Users,
  ClipboardList,
  Shield,
  FileText,
  TrendingUp,
  Calendar,
  Building2,
  PhoneCall
} from 'lucide-react';
import { useConversation } from '@11labs/react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const PMGenieVoiceAgent = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);

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
      console.log('PM Genie message:', message);
    },
    onError: (error) => {
      console.error('PM Genie conversation error:', error);
      setError(typeof error === 'string' ? error : 'Connection error occurred');
      toast.error(`Error: ${typeof error === 'string' ? error : 'Connection failed'}`);
    }
  });

  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      return true;
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setError('Microphone access is required for voice consultation');
      return false;
    }
  };

  const generateSignedUrl = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentType: 'pm-genie' }
      });

      if (error) throw error;
      if (!data?.signed_url) throw new Error('No signed URL received');

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
    const permitted = hasPermission ? true : await requestMicrophonePermission();
    if (!permitted) return;

    try {
      setIsLoading(true);
      setError(null);

      const signedUrl = agentUrl || await generateSignedUrl();
      if (!signedUrl) {
        setError('Failed to get authorization for PM Genie');
        return;
      }

      console.log('Starting conversation with signed URL');
      const conversationId = await conversation.startSession({ 
        signedUrl
      });

      console.log('PM Genie conversation started:', conversationId);
      
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
      console.log('PM Genie conversation ended');
    } catch (err) {
      console.error('Error ending conversation:', err);
    }
  };

  useEffect(() => {
    // Check if microphone permission is already granted
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setHasPermission(result.state === 'granted');
    });
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">PM Genie</CardTitle>
              <p className="text-sm text-muted-foreground">Practice Management Voice Assistant</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-xs">
              Practice Management AI
            </Badge>
            {conversation.status === 'connected' && (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-4 mt-4">
          <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
            Meet your calm, confident, and knowledgeable voice assistant for GP Practice Management in Northamptonshire, UK. 
            PM Genie provides clear spoken answers to operational, HR, and practice management questions using NHS guidance 
            and real-world experience. Speak naturally and professionally to get the support you need for your practice.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Permission Alert */}
        {!hasPermission && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Microphone access is required for voice consultation with PM Genie. 
              Click "Start the Conversation" to grant permission.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {error.includes('Failed to start conversation with PM Genie') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jwry2fzme7xsb2mwzatxseyt" 
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
            </AlertDescription>
          </Alert>
        )}

        {/* Main Interface */}
        <div className="flex flex-col items-center gap-6">
          {/* Status Display */}
          <div className="text-center space-y-2">
            <div className="space-y-1">
              <p className="font-medium">
                {conversation.status === 'connected' 
                  ? conversation.isSpeaking 
                    ? 'PM Genie is speaking...' 
                    : 'Listening for your practice management question...'
                  : 'Ready to connect'
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {conversation.status === 'connected'
                  ? 'Ask about HR, operations, compliance, or practice management guidance'
                  : 'Click start to talk with PM Genie'
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
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Phone className="h-5 w-5" />
                )}
                {isLoading ? 'Connecting...' : 'Start the Conversation'}
              </Button>
            )}
          </div>
        </div>

        {/* What PM Genie Can Help With & Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              What PM Genie Can Help With
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• <strong>Patient Complaints:</strong> Professional handling procedures and responses</li>
              <li>• <strong>Staff Management:</strong> Sickness, recruitment, and rota planning</li>
              <li>• <strong>ARRS Roles:</strong> Additional roles reimbursement scheme guidance</li>
              <li>• <strong>Quality Frameworks:</strong> QOF and IIF compliance support</li>
              <li>• <strong>PCN Funding:</strong> Primary Care Network requirements and guidance</li>
              <li>• <strong>CQC Inspections:</strong> Preparation and compliance strategies</li>
              <li>• <strong>HR Templates:</strong> Policy creation and letter writing</li>
              <li>• <strong>NHS Updates:</strong> Latest England and ICB guidance</li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Key Features & Benefits
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• <strong>NHS-Specific:</strong> Tailored for UK practice management</li>
              <li>• <strong>Real-time Support:</strong> Instant voice responses to your queries</li>
              <li>• <strong>Professional Tone:</strong> Calm, confident, and knowledgeable</li>
              <li>• <strong>Concise Answers:</strong> Clear, actionable advice for busy managers</li>
              <li>• <strong>Current Information:</strong> Up-to-date NHS and regulatory guidance</li>
              <li>• <strong>Natural Conversation:</strong> Speak as you would to a colleague</li>
            </ul>
          </div>
        </div>

        {/* Practice Management Focus Areas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <FileText className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <h5 className="font-medium text-sm mb-1">HR & Staff Management</h5>
            <p className="text-xs text-muted-foreground">Policies, recruitment, absence management, and team development</p>
          </div>
          
          <div className="text-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <TrendingUp className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <h5 className="font-medium text-sm mb-1">Quality & Compliance</h5>
            <p className="text-xs text-muted-foreground">QOF, IIF, CQC preparation, and regulatory compliance</p>
          </div>
          
          <div className="text-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <Calendar className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <h5 className="font-medium text-sm mb-1">Operations & Planning</h5>
            <p className="text-xs text-muted-foreground">Daily operations, PCN funding, and strategic planning</p>
          </div>
        </div>

        {/* Usage Tips */}
        <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-3 text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usage Tips for Best Results
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ul className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
              <li>• Speak clearly and naturally - no need for formal language</li>
              <li>• Ask specific questions for more targeted guidance</li>
              <li>• Mention your practice context when relevant</li>
            </ul>
            <ul className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
              <li>• Request examples or templates when needed</li>
              <li>• Ask for step-by-step guidance on complex processes</li>
              <li>• Feel free to ask follow-up questions for clarity</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PMGenieVoiceAgent;