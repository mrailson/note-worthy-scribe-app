import React, { useState, useEffect, useRef } from 'react';
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
  PhoneCall,
  CircleCheck,
  AlertTriangle,
  XCircle,
  Download
} from 'lucide-react';
import { useConversation } from '@11labs/react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useGenieHistory } from '@/hooks/useGenieHistory';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Packer } from 'docx';
import { saveAs } from 'file-saver';

interface QualityScore {
  accuracy: number;
  medicalSafety: number;
  culturalSensitivity: number;
  clarity: number;
  overallSafety: 'OK' | 'REVIEW' | 'NOT_OK';
  confidence: number;
  explanation?: string;
}

interface ConversationMessage {
  user: string;
  agent: string;
  timestamp: string;
  userTimestamp?: string;
  agentTimestamp?: string;
}

const PMGenieVoiceAgent = () => {
  const { profile } = useUserProfile();
  const { saveSession } = useGenieHistory();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [conversationBuffer, setConversationBuffer] = useState<ConversationMessage[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const conversationStartTime = useRef<Date | null>(null);

  const verifyConversationQuality = async (userInput: string, agentResponse: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-verification', {
        body: {
          userInput,
          agentResponse,
          sourceLanguage: 'English',
          targetLanguage: 'Multi-language',
          conversationId: conversationIdRef.current
        }
      });

      if (error) {
        console.error('Verification error:', error);
        return;
      }

      setQualityScore(data);
      console.log('Quality verification result:', data);
    } catch (err) {
      console.error('Failed to verify conversation quality:', err);
    }
  };

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to PM Genie');
      toast.success('Connected to PM Genie');
      setError(null);
      conversationIdRef.current = `conv_${Date.now()}`;
      conversationStartTime.current = new Date();
      setQualityScore(null);
      console.log('🔄 Clearing conversation buffer on NEW connection');
      setConversationBuffer([]);
    },
    onDisconnect: async () => {
      console.log('Disconnected from PM Genie. Buffer length:', conversationBuffer.length);
      toast.info('Disconnected from PM Genie');
      
      // Save to history
      if (conversationBuffer.length > 0 && conversationStartTime.current) {
        console.log('💾 Saving PM Genie session to history...');
        await saveSession(
          'pm-genie',
          conversationBuffer,
          conversationStartTime.current,
          new Date(),
          true // email was sent
        );
      }
      
      // Backup: Send transcript if buffer has content and wasn't already sent
      if (conversationBuffer.length > 0 && profile?.email && conversationIdRef.current) {
        console.log(`📧 Sending PM Genie transcript on disconnect to ${profile.email}...`);
        
        try {
          await supabase.functions.invoke('send-genie-transcript-email', {
            body: {
              userEmail: profile.email,
              serviceName: 'PM Genie',
              conversationBuffer: conversationBuffer,
              conversationId: conversationIdRef.current,
              serviceType: 'pm-genie'
            }
          });
        } catch (err) {
          console.error('Failed to send transcript on disconnect:', err);
        }
      }
      
      conversationIdRef.current = null;
      console.log('✅ Keeping conversation buffer for download. Buffer length:', conversationBuffer.length);
      // Keep conversation buffer for download - don't clear
    },
    onMessage: (message) => {
      console.log('PM Genie message:', message);
      
      // Capture conversation for verification with timestamps
      if (message.message && message.source) {
        const timestamp = new Date().toISOString();
        
        const newEntry: ConversationMessage = {
          user: message.source === 'user' ? message.message : '',
          agent: message.source === 'ai' ? message.message : '',
          timestamp: timestamp,
          userTimestamp: message.source === 'user' ? timestamp : undefined,
          agentTimestamp: message.source === 'ai' ? timestamp : undefined
        };
        
        setConversationBuffer(prev => {
          const updated = [...prev];
          if (message.source === 'user') {
            updated.push(newEntry);
            console.log('💬 Added user message to buffer. New length:', updated.length);
          } else if (message.source === 'ai' && updated.length > 0) {
            updated[updated.length - 1].agent = message.message;
            updated[updated.length - 1].agentTimestamp = timestamp;
            console.log('💬 Added AI response to buffer. Buffer length:', updated.length);
            // Trigger verification for the complete exchange
            const lastExchange = updated[updated.length - 1];
            if (lastExchange.user && lastExchange.agent) {
              verifyConversationQuality(lastExchange.user, lastExchange.agent);
            }
          }
          return updated;
        });
      }
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
      console.log('[PM Genie] Generating signed URL for agentId: agent_01jzsg04q1fwy9bfydkhszan7s');
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: 'agent_01jzsg04q1fwy9bfydkhszan7s' }
      });

      console.log('[PM Genie] Supabase function response:', { data, error });

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

      console.log('[PM Genie] Starting conversation with signed URL:', signedUrl);
      const conversationId = await conversation.startSession({ 
        agentId: 'agent_01jzsg04q1fwy9bfydkhszan7s',
        signedUrl
      });

      console.log('[PM Genie] Conversation started successfully:', conversationId);
      
    } catch (err: any) {
      console.error('Failed to start conversation:', err);
      setError('Failed to start conversation with PM Genie');
      toast.error('Failed to start conversation');
    } finally {
      setIsLoading(false);
    }
  };

  // Download transcript as Word document
  const downloadTranscript = async () => {
    if (conversationBuffer.length === 0) {
      toast.error('No conversation to download');
      return;
    }

    const serviceName = 'PM Genie';
    
    // Get conversation metadata
    const startTime = conversationBuffer[0]?.timestamp 
      ? new Date(conversationBuffer[0].timestamp)
      : new Date();
    
    const endTime = conversationBuffer[conversationBuffer.length - 1]?.agentTimestamp
      ? new Date(conversationBuffer[conversationBuffer.length - 1].agentTimestamp)
      : new Date();
    
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60);

    // Create Word document with professional NHS-style formatting
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title with NHS Blue
          new Paragraph({
            text: 'Notewell AI',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Notewell AI',
                bold: true,
                size: 32,
                color: '005EB8', // NHS Blue
                font: 'Calibri'
              })
            ]
          }),
          
          // Service name with emerald green
          new Paragraph({
            text: `${serviceName} - Conversation Transcript`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `${serviceName} - Conversation Transcript`,
                bold: true,
                size: 28,
                color: '10B981', // Emerald-500
                font: 'Calibri'
              })
            ]
          }),

          // Metadata table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: 'Start Time:', bold: true, font: 'Calibri', size: 22 })]
                    })],
                    width: { size: 30, type: WidthType.PERCENTAGE }
                  }),
                  new TableCell({
                    children: [new Paragraph(startTime.toLocaleString('en-GB', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    }))],
                    width: { size: 70, type: WidthType.PERCENTAGE }
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: 'End Time:', bold: true, font: 'Calibri', size: 22 })]
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph(endTime.toLocaleString('en-GB', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    }))]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: 'Duration:', bold: true, font: 'Calibri', size: 22 })]
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph(`${duration} minutes`)]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: 'Messages:', bold: true, font: 'Calibri', size: 22 })]
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph(`${conversationBuffer.filter(m => m.user).length} user messages`)]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }),

          // Conversation History heading
          new Paragraph({
            text: 'Conversation History',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 200 },
            children: [
              new TextRun({
                text: 'Conversation History',
                bold: true,
                size: 24,
                color: '10B981', // Emerald-500
                font: 'Calibri'
              })
            ]
          }),

          // Conversation messages
          ...conversationBuffer.flatMap(msg => {
            const messages: Paragraph[] = [];
            
            if (msg.user) {
              const time = msg.userTimestamp ? 
                new Date(msg.userTimestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
              
              messages.push(
                new Paragraph({
                  spacing: { before: 200, after: 100 },
                  children: [
                    new TextRun({
                      text: `[${time}] You:`,
                      bold: true,
                      color: '2563EB',
                      size: 22,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 120 },
                  indent: { left: 360 },
                  children: [
                    new TextRun({
                      text: msg.user,
                      size: 22,
                      color: '374151',
                      font: 'Calibri'
                    })
                  ]
                })
              );
            }
            
            if (msg.agent) {
              const time = msg.agentTimestamp ? 
                new Date(msg.agentTimestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
              
              messages.push(
                new Paragraph({
                  spacing: { before: 200, after: 100 },
                  children: [
                    new TextRun({
                      text: `[${time}] ${serviceName}:`,
                      bold: true,
                      color: '10B981', // Emerald-500
                      size: 22,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 120 },
                  indent: { left: 360 },
                  children: [
                    new TextRun({
                      text: msg.agent,
                      size: 22,
                      color: '374151',
                      font: 'Calibri'
                    })
                  ]
                })
              );
            }
            
            return messages;
          }),

          new Paragraph({ text: '', spacing: { before: 400 } }),

          // Footer
          new Paragraph({
            text: 'Generated by Notewell AI',
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: 'Generated by Notewell AI',
                size: 18,
                color: '9CA3AF',
                font: 'Calibri',
                italics: true
              })
            ]
          })
        ]
      }]
    });

    // Generate and download the document
    try {
      const blob = await Packer.toBlob(doc);
      const timestamp = new Date().toISOString().split('T')[0];
      saveAs(blob, `PM-Genie-Transcript-${timestamp}.docx`);
      toast.success('Transcript downloaded successfully');
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error('Failed to download transcript');
    }
  };

  // End conversation
  const endConversation = async () => {
    try {
      // Save to history
      if (conversationBuffer.length > 0 && conversationStartTime.current) {
        await saveSession(
          'pm-genie',
          conversationBuffer,
          conversationStartTime.current,
          new Date(),
          true // email was sent
        );
      }
      
      // Send transcript email silently BEFORE ending session
      if (conversationBuffer.length > 0 && profile?.email) {
        console.log(`📧 Sending PM Genie transcript to ${profile.email}...`);
        
        const { data, error } = await supabase.functions.invoke('send-genie-transcript-email', {
          body: {
            userEmail: profile.email,
            serviceName: 'PM Genie',
            conversationBuffer: conversationBuffer,
            conversationId: conversationIdRef.current,
            serviceType: 'pm-genie'
          }
        });
        
        if (error) {
          console.error('Failed to send transcript email:', error);
          // Silent - don't show error to user
        } else {
          console.log('✅ PM Genie transcript email sent successfully');
        }
      }
      
      // Now end the session
      await conversation.endSession();
      console.log('PM Genie conversation ended');
      
      // Keep buffer for download - don't clear until page navigation
      
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
            {qualityScore && (
              <Badge 
                variant={qualityScore.overallSafety === 'OK' ? 'default' : 
                        qualityScore.overallSafety === 'REVIEW' ? 'secondary' : 'destructive'} 
                className="text-xs"
              >
                {qualityScore.overallSafety === 'OK' ? (
                  <CircleCheck className="h-3 w-3 mr-1" />
                ) : qualityScore.overallSafety === 'REVIEW' ? (
                  <AlertTriangle className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                Quality: {qualityScore.overallSafety}
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

          {/* Download Transcript Button - Debug info */}
          <div className="w-full flex flex-col items-center gap-2">
            {(() => {
              console.log('🔍 PM Genie Download button check - Buffer length:', conversationBuffer.length, 'Status:', conversation.status);
              if (conversationBuffer.length > 0) {
                return (
                  <Button 
                    onClick={downloadTranscript}
                    variant="default"
                    size="default"
                    className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    Download Transcript ({conversationBuffer.length} messages)
                  </Button>
                );
              } else if (conversation.status === 'disconnected' && conversationIdRef.current === null) {
                return (
                  <p className="text-sm text-muted-foreground">
                    Start a conversation to download a transcript
                  </p>
                );
              }
              return null;
            })()}
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