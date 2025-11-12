import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Shield,
  Building2,
  Users,
  FileText,
  PhoneCall,
  CircleCheck,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';

interface QualityScore {
  accuracy: number;
  medicalSafety: number;
  culturalSensitivity: number;
  clarity: number;
  overallSafety: 'OK' | 'REVIEW' | 'NOT_OK';
  confidence: number;
  explanation?: string;
  originalPhrase?: string;
  translatedPhrase?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

interface ConversationMessage {
  user: string;
  agent: string;
  timestamp: string;
  userTimestamp?: string;
  agentTimestamp?: string;
}

const GPGenieVoiceAgent = ({ initialTab = 'gp-genie' }: { initialTab?: string }) => {
  const { profile } = useUserProfile();
  const deviceInfo = useDeviceInfo();
  const getLanguageName = (code: string) => {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase();
    const base = lower.split('-')[0];
    const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
    return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
  };
  const [activeTab, setActiveTab] = useState(initialTab);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const prevVolumeRef = useRef(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLanguageIndex, setCurrentLanguageIndex] = useState(0);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [conversationBuffer, setConversationBuffer] = useState<ConversationMessage[]>([]);
  const [isQualityDetailsOpen, setIsQualityDetailsOpen] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());

  const languageRotation = [
    { code: 'en', text: 'Test Language Support Service' },
    { code: 'de', text: 'Testen Sie den Sprachunterstützungsdienst' },
    { code: 'fr', text: 'Tester le service d\'assistance linguistique' },
    { code: 'ar', text: 'اختبار خدمة الدعم اللغوي' }
  ];

  // Helper function to extract language and clean text from language tags
  const extractLanguageAndCleanText = (text: string) => {
    const languageMatch = text.match(/<(\w+)>(.*?)<\/\1>/);
    if (languageMatch) {
      return {
        language: languageMatch[1],
        cleanText: languageMatch[2]
      };
    }
    return {
      language: 'Unknown',
      cleanText: text
    };
  };

  const verifyConversationQuality = async (userInput: string, agentResponse: string) => {
    // Only verify for Oak Lane Patient Line (patient-line tab)
    if (activeTab !== 'patient-line') return;
    
    console.log('🔍 [Oak Lane Verification] Starting quality check...');
    console.log('🔍 User input:', userInput.substring(0, 100) + '...');
    console.log('🔍 Agent response:', agentResponse.substring(0, 100) + '...');
    
    // Extract target language from agent response
    const { language: targetLanguage, cleanText: cleanedResponse } = extractLanguageAndCleanText(agentResponse);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-verification', {
        body: {
          userInput,
          agentResponse,
          sourceLanguage: 'English',
          targetLanguage: targetLanguage,
          conversationId: conversationIdRef.current
        }
      });

      if (error) {
        console.error('❌ Oak Lane verification error:', error);
        toast.error('Translation verification failed');
        return;
      }

      console.log('✅ Oak Lane translation quality result:', data);
      // Add the original phrases to the quality score
      const enrichedData = {
        ...data,
        originalPhrase: userInput,
        translatedPhrase: cleanedResponse,
        sourceLanguage: 'English',
        targetLanguage: targetLanguage
      };
      setQualityScore(enrichedData);
      
      // Show prominent toast notification
      const qualityMessage = data.overallSafety === 'OK' 
        ? `✅ Translation Quality: SAFE (${data.confidence}% confidence)`
        : data.overallSafety === 'REVIEW'
        ? `⚠️ Translation Quality: REVIEW NEEDED (${data.confidence}% confidence)`
        : `❌ Translation Quality: NOT SAFE (${data.confidence}% confidence)`;
      
      if (data.overallSafety === 'OK') {
        toast.success(qualityMessage);
      } else if (data.overallSafety === 'REVIEW') {
        toast.warning(qualityMessage);
      } else {
        toast.error(qualityMessage);
      }
      
    } catch (err) {
      console.error('❌ Failed to verify Oak Lane conversation quality:', err);
      toast.error('Translation verification system error');
    }
  };

  // Test function to manually trigger verification
  const testVerification = async () => {
    console.log('🧪 Testing verification system...');
    await verifyConversationQuality(
      "I have a headache and feel dizzy", 
      "Based on your symptoms, I recommend resting and staying hydrated. If symptoms persist, please consult a doctor."
    );
  };

  const conversation = useConversation({
    onConnect: () => {
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      console.log(`Connected to ${serviceName}`);
      toast.success(`Connected to ${serviceName}`);
      setError(null);
      
      // Initialize for ALL services - clear old buffer
      conversationIdRef.current = `${activeTab}_${Date.now()}`;
      setQualityScore(null);
      setConversationBuffer([]); // Clear old conversation when starting new one
      processedMessageIds.current.clear(); // Clear message deduplication tracking
    },
    onDisconnect: async () => {
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      console.log(`Disconnected from ${serviceName}`);
      toast.info(`Disconnected from ${serviceName}`);
      
      // Backup: Send transcript if buffer has content and wasn't already sent
      if (conversationBuffer.length > 0 && profile?.email && conversationIdRef.current) {
        console.log(`📧 Sending ${serviceName} transcript on disconnect to ${profile.email}...`);
        
        try {
          await supabase.functions.invoke('send-genie-transcript-email', {
            body: {
              userEmail: profile.email,
              serviceName: serviceName,
              conversationBuffer: conversationBuffer,
              conversationId: conversationIdRef.current,
              serviceType: activeTab
            }
          });
        } catch (err) {
          console.error('Failed to send transcript on disconnect:', err);
        }
      }
      
      conversationIdRef.current = null;
      // Keep conversation buffer for download - don't clear until page navigation
    },
    onMessage: (message) => {
      console.log('📨 Message received:', message);
      
      // Capture conversation for ALL services with timestamps
      if (message.message && message.source) {
        // Create unique message ID based on content only (not timestamp) to prevent duplicates
        const messageId = `${message.source}-${message.message}`;
        
        // Skip if we've already processed this exact message recently
        if (processedMessageIds.current.has(messageId)) {
          console.log('⚠️ Skipping duplicate message:', message.message.substring(0, 50) + '...');
          return;
        }
        
        processedMessageIds.current.add(messageId);
        
        // Clean up old message IDs after 10 seconds
        setTimeout(() => {
          processedMessageIds.current.delete(messageId);
        }, 10000);
        
        console.log('🎯 Message - Source:', message.source, 'Content:', message.message.substring(0, 50) + '...');
        
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
            console.log('👤 User message captured:', message.message.substring(0, 50) + '...');
            updated.push(newEntry);
          } else if (message.source === 'ai' && updated.length > 0) {
            console.log('🤖 AI response captured:', message.message.substring(0, 50) + '...');
            updated[updated.length - 1].agent = message.message;
            updated[updated.length - 1].agentTimestamp = timestamp;
            
            // Trigger verification ONLY for Oak Lane Patient Line
            if (activeTab === 'patient-line') {
              const lastExchange = updated[updated.length - 1];
              if (lastExchange.user && lastExchange.agent) {
                console.log('🔄 Triggering verification for Oak Lane exchange');
                verifyConversationQuality(lastExchange.user, lastExchange.agent);
              }
            }
          }
          return updated;
        });
      }
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

      // Select agent ID based on active tab
      const agentId = activeTab === 'gp-genie' 
        ? 'agent_01jwry2fzme7xsb2mwzatxseyt'  // GP Genie
        : activeTab === 'pm-genie'
        ? 'agent_01jzsg04q1fwy9bfydkhszan7s'  // PM Genie
        : 'agent_01jwrz44tyefdvhtvt7c622rj7';  // Oak Lane Patient Line

      console.log(`[${activeTab}] Generating signed URL for agentId:`, agentId);

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId }
      });

      console.log(`[${activeTab}] Supabase function response:`, { data, error });

      if (error) throw error;
      
      setAgentUrl(data.signed_url);
      return data.signed_url;
    } catch (err: any) {
      console.error('Failed to generate signed URL:', err);
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      setError(`Failed to connect to ${serviceName}. Please check your ElevenLabs API key.`);
      toast.error(`Failed to connect to ${serviceName}`);
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
        const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
        setError(`Failed to get authorization for ${serviceName}`);
        return;
      }

      console.log(`[${activeTab}] Starting conversation with signed URL:`, signedUrl);
      const conversationId = await conversation.startSession({ 
        agentId: activeTab === 'gp-genie' 
          ? 'agent_01jwry2fzme7xsb2mwzatxseyt'  // GP Genie
          : activeTab === 'pm-genie'
          ? 'agent_01jzsg04q1fwy9bfydkhszan7s'  // PM Genie
          : 'agent_01jwrz44tyefdvhtvt7c622rj7',  // Oak Lane Patient Line
        signedUrl
      });
      
      console.log(`[${activeTab}] Conversation started successfully:`, conversationId);
      
      // AUDIO CUTOUT FIX: Do not set volume programmatically after connection - this causes interruptions
      console.log('✅ Connection established without programmatic volume changes');
      
      console.log('Conversation started:', conversationId);
      
    } catch (err: any) {
      console.error('Failed to start conversation:', err);
      const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
      setError(`Failed to start conversation with ${serviceName}`);
      toast.error('Failed to start conversation');
    } finally {
      setIsLoading(false);
    }
  };

  // Start language support test conversation
  const startLanguageTestConversation = async () => {
    const permitted = hasPermission ? true : await requestMicrophonePermission();
    if (!permitted) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Generate signed URL for language support agent
      const { data, error } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: 'agent_01jws2qhv2essav25m8cfq2h0v' }
      });

      if (error) throw error;
      
      console.log('Starting language test conversation with signed URL');
      const conversationId = await conversation.startSession({ 
        agentId: 'agent_01jws2qhv2essav25m8cfq2h0v',
        signedUrl: data.signed_url
      });

      // AUDIO CUTOUT FIX: Do not set volume programmatically after connection - this causes interruptions
      console.log('✅ Language test connection established without programmatic volume changes');
      
      console.log('Language test conversation started:', conversationId);
      
    } catch (err: any) {
      console.error('Failed to start language test conversation:', err);
      setError(`Failed to start language test conversation`);
      toast.error('Failed to start language test conversation');
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

    const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
    
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
          
          // Service name
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
                color: '2563EB', // Blue-600
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
                color: '2563EB',
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
                  text: msg.user,
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
                      color: '10B981',
                      size: 22,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  text: msg.agent,
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

          new Paragraph({ text: '', spacing: { before: 400, after: 200 } }),

          // COMPREHENSIVE DISCLAIMER
          new Paragraph({
            text: 'IMPORTANT DISCLAIMER',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'IMPORTANT DISCLAIMER',
                bold: true,
                size: 24,
                color: 'DC2626', // Red-600
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '⚠️ NOT AN APPROVED NHS CLINICAL TOOL',
                bold: true,
                size: 22,
                color: 'DC2626',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            text: 'This tool is provided by Notewell AI for concept testing and demonstration purposes only. It is NOT approved, endorsed, or validated for use within NHS clinical settings for patient diagnosis, treatment, or clinical decision-making.',
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'This tool is provided by Notewell AI for concept testing and demonstration purposes only. It is NOT approved, endorsed, or validated for use within NHS clinical settings for patient diagnosis, treatment, or clinical decision-making.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '• ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'Non-Clinical Use Only: ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'This service must NOT be used for patient diagnosis, treatment planning, prescribing, or any clinical decision-making that impacts patient safety or care outcomes.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '• ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'No Regulatory Approval: ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'This system has not received MHRA approval, CE marking, or any regulatory clearance as a medical device. It has not undergone clinical safety validation required for NHS deployment.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '• ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'Concept Testing Only: ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'This service is being evaluated for potential future NHS use but is currently in early-stage concept testing with non-patient-facing administrative and operational scenarios only.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '• ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'No Warranty or Liability: ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'Notewell AI provides this service "as is" without any warranties of accuracy, reliability, or fitness for any clinical purpose. Users assume all risk and responsibility for any outcomes resulting from use of this service.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '• ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'Data Protection Notice: ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'Do NOT input identifiable patient information, personal health records, or any sensitive clinical data. This system is not approved for processing NHS patient data under Data Protection Act 2018 or UK GDPR requirements for clinical systems.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '• ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'Translation Accuracy Warning: ',
                bold: true,
                size: 20,
                font: 'Calibri'
              }),
              new TextRun({
                text: 'AI-generated translations may contain errors, mistranslations, or culturally inappropriate content. All translations should be independently verified by qualified human translators before clinical use.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: 'By using this service, you acknowledge that you have read, understood, and accept these limitations and disclaimers. If you require clinical-grade translation, diagnosis support, or patient-facing AI tools, please use only NHS-approved and clinically validated systems.',
                bold: true,
                size: 20,
                color: 'DC2626',
                font: 'Calibri'
              })
            ]
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
                color: '6B7280',
                italics: true,
                font: 'Calibri'
              })
            ]
          }),
          
          new Paragraph({
            text: `Document created: ${new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}`,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Document created: ${new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}`,
                size: 18,
                color: '6B7280',
                italics: true,
                font: 'Calibri'
              })
            ]
          })
        ]
      }]
    });

    // Generate and download
    try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${serviceName.replace(/ /g, '-')}-transcript-${Date.now()}.docx`);
      toast.success('Transcript downloaded as Word document');
    } catch (error) {
      console.error('Failed to generate Word document:', error);
      toast.error('Failed to generate document');
    }
  };

  // End conversation
  const endConversation = async () => {
    try {
      // Send transcript email silently BEFORE ending session
      if (conversationBuffer.length > 0 && profile?.email) {
        const serviceName = activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line';
        console.log(`📧 Sending ${serviceName} transcript to ${profile.email}...`);
        
        const { data, error } = await supabase.functions.invoke('send-genie-transcript-email', {
          body: {
            userEmail: profile.email,
            serviceName: serviceName,
            conversationBuffer: conversationBuffer,
            conversationId: conversationIdRef.current,
            serviceType: activeTab
          }
        });
        
        if (error) {
          console.error('Failed to send transcript email:', error);
          toast.warning('Email delivery failed - use Download Transcript button', {
            duration: 5000
          });
        } else {
          console.log(`✅ ${serviceName} transcript email sent successfully`);
          toast.success('Transcript sent to your email', {
            duration: 3000
          });
        }
      }
      
      // Now end the session
      await conversation.endSession();
      
      // Keep buffer for download - clear only on new conversation or page leave
      conversationIdRef.current = null;
      
    } catch (err: any) {
      console.error('Failed to end conversation:', err);
    }
  };

  // Handle volume change (user-triggered only)
  const handleVolumeChange = async (newVolume: number) => {
    console.log('🎚️ User-triggered volume change:', newVolume);
    setVolume(newVolume);
    if (conversation.status === 'connected' && !isMuted) {
      try {
        await conversation.setVolume({ volume: newVolume });
        console.log('✅ User volume change applied successfully');
      } catch (err) {
        console.error('❌ User volume change failed:', err);
      }
    }
  };

  // Toggle sound mute (user-triggered only)
  const toggleSoundMute = async () => {
    const newMutedState = !isMuted;
    console.log('🎚️ User-triggered mute toggle:', newMutedState);
    setIsMuted(newMutedState);
    
    try {
      if (conversation.status === 'connected') {
        if (newMutedState) {
          // store current volume and mute
          prevVolumeRef.current = volume;
          await conversation.setVolume({ volume: 0 });
          console.log('✅ User mute applied successfully');
          toast.info('Speaker muted');
        } else {
          // restore previous volume
          const restore = prevVolumeRef.current ?? 0.8;
          setVolume(restore);
          await conversation.setVolume({ volume: restore });
          console.log('✅ User unmute applied successfully');
          toast.info('Speaker unmuted');
        }
      } else {
        toast.info(newMutedState ? 'Speaker muted' : 'Speaker unmuted');
      }
    } catch (err) {
      console.error('❌ User sound toggle failed:', err);
      toast.error('Failed to toggle speaker');
      // Revert state if operation failed
      setIsMuted(!newMutedState);
    }
  };

  const toggleMicMute = async () => {
    const newState = !isMicMuted;
    setIsMicMuted(newState);

    try {
      if (conversation.status === 'connected') {
        // The ElevenLabs SDK doesn't have direct mic mute, so we use a workaround
        // We can't pause just the microphone without ending the session
        // This is a limitation of the current SDK
        toast.info(newState ? 'Microphone muted (visual only - connection stays open)' : 'Microphone unmuted');
      } else {
        toast.info(newState ? 'Microphone muted' : 'Microphone unmuted');
      }
    } catch (err) {
      console.error('Mic toggle failed:', err);
      toast.error('Failed to toggle microphone');
      // Revert state if operation failed
      setIsMicMuted(!newState);
    }
  };

  useEffect(() => {
    // Check if microphone permission is already granted
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setHasPermission(result.state === 'granted');
    });
  }, []);

  useEffect(() => {
    // Language rotation for the test button
    const interval = setInterval(() => {
      setCurrentLanguageIndex((prevIndex) => (prevIndex + 1) % languageRotation.length);
    }, 3000); // Rotate every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className={cn(
      "w-full max-w-6xl mx-auto",
      deviceInfo.isIPhone && "sm:border border-0 sm:rounded-lg rounded-none shadow-none sm:shadow-sm"
    )}>
      <CardHeader className={cn(
        deviceInfo.isIPhone && "sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-4"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "flex items-center gap-2",
            deviceInfo.isIPhone && "text-base"
          )}>
            {activeTab === 'gp-genie' ? (
              <>
                <Stethoscope className="h-6 w-6 text-primary" />
                GP Genie Voice Assistant
              </>
            ) : activeTab === 'pm-genie' ? (
              <>
                <Building2 className="h-6 w-6 text-primary" />
                PM Genie Voice Assistant
              </>
            ) : (
              <>
                <PhoneCall className="h-6 w-6 text-primary" />
                Oak Lane Patient Line
              </>
            )}
          </CardTitle>
          {!deviceInfo.isIPhone && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                {activeTab === 'gp-genie' ? 'Clinical Voice AI' : activeTab === 'pm-genie' ? 'Practice Management AI' : 'Patient Telephone Triage'}
              </Badge>
            {conversation.status === 'connected' && (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {activeTab === 'patient-line' && qualityScore && (
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
                Translation Quality: {qualityScore.overallSafety}
              </Badge>
            )}
            </div>
          )}
        </div>
        
        {/* Service Selection Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={cn(
            "grid w-full grid-cols-3",
            deviceInfo.isIPhone && "h-auto"
          )}>
            <TabsTrigger 
              value="gp-genie" 
              className={cn(
                "flex items-center gap-2",
                deviceInfo.isIPhone && "flex-col min-h-[52px] px-2 py-3 text-xs"
              )}
            >
              <Stethoscope className={cn("h-4 w-4", deviceInfo.isIPhone && "h-5 w-5")} />
              <span className={deviceInfo.isIPhone ? "text-[11px] leading-none" : ""}>GP Genie</span>
            </TabsTrigger>
            <TabsTrigger 
              value="pm-genie" 
              className={cn(
                "flex items-center gap-2",
                deviceInfo.isIPhone && "flex-col min-h-[52px] px-2 py-3 text-xs"
              )}
            >
              <Building2 className={cn("h-4 w-4", deviceInfo.isIPhone && "h-5 w-5")} />
              <span className={deviceInfo.isIPhone ? "text-[11px] leading-none" : ""}>PM Genie</span>
            </TabsTrigger>
            <TabsTrigger 
              value="patient-line" 
              className={cn(
                "flex items-center gap-2",
                deviceInfo.isIPhone && "flex-col min-h-[52px] px-2 py-3 text-xs"
              )}
            >
              <PhoneCall className={cn("h-4 w-4", deviceInfo.isIPhone && "h-5 w-5")} />
              <span className={deviceInfo.isIPhone ? "text-[11px] leading-none" : ""}>
                {deviceInfo.isIPhone ? "Oak Lane" : "Oak Lane Patient Line"}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <p className={cn(
          "text-sm text-muted-foreground mt-3",
          deviceInfo.isIPhone && "text-xs"
        )}>
          {activeTab === 'gp-genie' 
            ? 'Speak naturally with GP Genie, your AI assistant for clinical guidance, patient reassurance advice, and evidence-based medicine support.'
            : activeTab === 'pm-genie'
            ? 'Speak with PM Genie, your calm and knowledgeable voice assistant for GP Practice Management in Northamptonshire, providing operational, HR, and practice management guidance.'
            : 'Oak Lane Patient Line - Accessible telephone triage for all patients using any phone line. Perfect for those who prefer traditional telephone communication, have limited IT skills, or need multilingual support.'
          }
        </p>
      </CardHeader>
      
      <CardContent className={cn(
        "space-y-6",
        deviceInfo.isIPhone && "px-4 pb-safe"
      )}>
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {(error.includes('Failed to start conversation with GP Genie') && activeTab === 'gp-genie') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jwry2fzme7xsb2mwzatxseyt" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Try GP Genie Direct Link
                  </a>
                  <p className="text-xs mt-1 text-muted-foreground">Use this backup link to access GP Genie directly</p>
                </div>
              )}
              {(error.includes('Failed to start conversation with PM Genie') && activeTab === 'pm-genie') && (
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
              {(error.includes('Failed to start conversation with Oak Lane Patient Line') && activeTab === 'patient-line') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jwrz44tyefdvhtvt7c622rj7" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Try Oak Lane Patient Line Direct Link
                  </a>
                  <p className="text-xs mt-1 text-muted-foreground">Use this backup link to access Oak Lane Patient Line directly</p>
                </div>
              )}
              {error.includes('Failed to start language test conversation') && (
                <div className="mt-3">
                  <a 
                    href="https://elevenlabs.io/app/talk-to?agent_id=agent_01jws2qhv2essav25m8cfq2h0v" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Try Translation Service Direct Link
                  </a>
                  <p className="text-xs mt-1 text-muted-foreground">Use this backup link to access the Translation Service directly</p>
                </div>
              )}
            </AlertDescription>
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
        <div className={cn(
          "flex flex-col items-center space-y-6 py-8",
          deviceInfo.isIPhone && "py-4 space-y-4"
        )}>
          {/* Translation Quality Status - Only for Oak Lane Patient Line */}
          {activeTab === 'patient-line' && qualityScore && (
            <div className="w-full max-w-md">
              <Alert variant={qualityScore.overallSafety === 'OK' ? 'default' : 
                             qualityScore.overallSafety === 'REVIEW' ? 'default' : 'destructive'} 
                     className={qualityScore.overallSafety === 'OK' ? 'border-green-200 bg-green-50' : 
                               qualityScore.overallSafety === 'REVIEW' ? 'border-yellow-200 bg-yellow-50' : ''}>
                {qualityScore.overallSafety === 'OK' ? (
                  <CircleCheck className="h-4 w-4 text-green-600" />
                ) : qualityScore.overallSafety === 'REVIEW' ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="font-medium mb-2">
                    Translation Quality: {qualityScore.overallSafety === 'OK' ? 'Verified Safe' : 
                                        qualityScore.overallSafety === 'REVIEW' ? 'Review Recommended' : 'Quality Issues Detected'}
                    {qualityScore.targetLanguage && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Translated to {getLanguageName(qualityScore.targetLanguage)})
                      </span>
                    )}
                  </div>
                  
                   {/* Original and Translated Phrases */}
                  <div className="space-y-2 mb-3">
                    <div className="text-xs">
                      <span className="font-medium text-muted-foreground">Original Phrase:</span>
                      <p className="mt-1 p-2 bg-muted/50 rounded text-foreground">{qualityScore.originalPhrase}</p>
                    </div>
                    <div className="text-xs">
                      <span className="font-medium text-muted-foreground">AI Response:</span>
                      <p className="mt-1 p-2 bg-muted/50 rounded text-foreground">{qualityScore.translatedPhrase}</p>
                    </div>
                  </div>

                  {/* Collapsible Quality Details */}
                  <Collapsible open={isQualityDetailsOpen} onOpenChange={setIsQualityDetailsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs hover:bg-transparent">
                        <span className="flex items-center gap-1">
                          {isQualityDetailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isQualityDetailsOpen ? 'Hide' : 'Show'} Quality Details
                        </span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      <div className="text-xs space-y-1">
                        <div>Accuracy: {qualityScore.accuracy}% | Medical Safety: {qualityScore.medicalSafety}%</div>
                        <div>Cultural Sensitivity: {qualityScore.culturalSensitivity}% | Clarity: {qualityScore.clarity}%</div>
                        {qualityScore.explanation && (
                          <div className="text-muted-foreground mt-2 p-2 bg-muted/30 rounded">{qualityScore.explanation}</div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </AlertDescription>
              </Alert>
            </div>
          )}


          {/* Status Indicator */}
          <div className="text-center space-y-2">
            
            <div className="space-y-1">
              <p className={cn(
                "font-medium",
                deviceInfo.isIPhone && "text-base"
              )}>
                {conversation.status === 'connected' 
                  ? conversation.isSpeaking 
                    ? `${activeTab === 'gp-genie' ? 'GP Genie' : activeTab === 'pm-genie' ? 'PM Genie' : 'Oak Lane Patient Line'} is speaking...` 
                    : `Listening for your ${activeTab === 'gp-genie' ? 'clinical' : activeTab === 'pm-genie' ? 'practice management' : 'patient triage'} question...`
                  : 'Ready to connect'
                }
              </p>
               <p className={cn(
                 "text-sm text-muted-foreground",
                 deviceInfo.isIPhone && "text-xs"
               )}>
                 {conversation.status === 'connected'
                   ? activeTab === 'gp-genie'
                     ? 'Ask about patient care, clinical protocols, or consultation guidance'
                     : activeTab === 'pm-genie'
                     ? 'Ask about operational matters, HR guidance, or practice management'
                     : 'Ask about symptoms, health concerns, or medical guidance'
                   : activeTab === 'gp-genie'
                   ? `Click start to talk with GP Genie`
                   : activeTab === 'pm-genie'
                   ? `Click start to talk with PM Genie`
                   : `Click start to talk with Patient Triage service Demo`
                 }
               </p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              {conversation.status === 'connected' ? (
                <Button 
                  onClick={endConversation}
                  variant="destructive"
                  size="lg"
                  className={cn(
                    "flex items-center gap-2",
                    deviceInfo.isIPhone && "min-h-[56px] text-base px-8"
                  )}
                >
                  <PhoneOff className={cn("h-5 w-5", deviceInfo.isIPhone && "h-6 w-6")} />
                  End Consultation
                </Button>
              ) : (
                <Button 
                  onClick={startConversation}
                  disabled={!hasPermission || isLoading}
                  size="lg"
                  className={cn(
                    "flex items-center gap-2",
                    deviceInfo.isIPhone && "min-h-[56px] text-base px-8"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className={cn("h-5 w-5 animate-spin", deviceInfo.isIPhone && "h-6 w-6")} />
                  ) : (
                    <Phone className={cn("h-5 w-5", deviceInfo.isIPhone && "h-6 w-6")} />
                  )}
                  {deviceInfo.isIPhone 
                    ? (isLoading ? 'Connecting...' : 'Start Call') 
                    : (isLoading ? 'Connecting...' : 'Start the Conversation')
                  }
                </Button>
              )}
            </div>
            
            {/* Download Transcript Button */}
            {conversationBuffer.length > 0 && (
              <Button 
                onClick={downloadTranscript}
                variant="outline"
                size="sm"
                className={cn(
                  "flex items-center gap-2",
                  deviceInfo.isIPhone && "min-h-[48px] text-sm px-6"
                )}
              >
                <Download className={cn("h-4 w-4", deviceInfo.isIPhone && "h-5 w-5")} />
                Download Transcript
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Content Based on Selected Service */}
        {!deviceInfo.isIPhone && (
          <>
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="gp-genie" className="mt-0">
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
          </TabsContent>
          
          <TabsContent value="pm-genie" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  What PM Genie Can Help With
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>Patient Complaints:</strong> Professional handling and resolution strategies</p>
                  <p>• <strong>Staff Management:</strong> Sickness, recruitment, and rota planning</p>
                  <p>• <strong>ARRS & QOF:</strong> Additional roles, Quality Outcomes Framework guidance</p>
                  <p>• <strong>CQC Inspections:</strong> Preparation strategies and compliance requirements</p>
                  <p>• <strong>HR Letters & Policies:</strong> Template creation and policy guidance</p>
                  <p>• <strong>NHS Updates:</strong> Latest NHS England and ICB guidance</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Practice Management Intelligence
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>IIF & PCN Funding:</strong> Investment and Incentive Framework guidance</p>
                  <p>• <strong>NHS Contract Management:</strong> GMS, PMS, and APMS contract advice</p>
                  <p>• <strong>Staff Development:</strong> Training requirements and career progression</p>
                  <p>• <strong>Financial Management:</strong> Budget planning and cost optimization</p>
                  <p>• <strong>Digital Transformation:</strong> System implementations and workflow optimization</p>
                  <p>• <strong>Regulatory Compliance:</strong> GDPR, IG, and clinical governance</p>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="patient-line" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-primary" />
                  Oak Lane Patient Line Features
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>No Smartphone Required:</strong> Works with any landline or mobile phone</p>
                  <p>• <strong>Simple to Use:</strong> Just dial and speak - no apps or internet needed</p>
                  <p>• <strong>Multilingual Support:</strong> Available in multiple languages for diverse communities</p>
                  <p>• <strong>24/7 Availability:</strong> Accessible any time of day for urgent triage</p>
                  <p>• <strong>IT-Free Experience:</strong> Perfect for elderly patients and those with limited tech skills</p>
                  <p>• <strong>Clear Audio Quality:</strong> Optimized for older telephone systems and hearing aids</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  Patient Accessibility Benefits
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>Language Barriers:</strong> Helps non-English speakers access healthcare guidance</p>
                  <p>• <strong>Digital Divide:</strong> Bridges the gap for patients without modern technology</p>
                  <p>• <strong>Hearing Impairments:</strong> Compatible with traditional hearing aids and amplified phones</p>
                  <p>• <strong>Elderly-Friendly:</strong> Familiar telephone interface reduces anxiety and confusion</p>
                  <p>• <strong>Rural Communities:</strong> Works with basic phone infrastructure in remote areas</p>
                  <p>• <strong>Economic Accessibility:</strong> No data charges or app downloads required</p>
                </div>
                <div className="mt-3 pt-2 border-t border-muted">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs transition-all duration-300"
                    onClick={startLanguageTestConversation}
                    disabled={!hasPermission || isLoading}
                  >
                    <PhoneCall className="h-3 w-3 mr-1" />
                    {languageRotation[currentLanguageIndex].text}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Features */}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="gp-genie" className="mt-0">
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
          </TabsContent>
          
          <TabsContent value="pm-genie" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Building2 className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Practice Operations</h4>
                <p className="text-xs text-muted-foreground">
                  Staff management, rotas, and operational efficiency guidance for GP practices
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">HR & Compliance</h4>
                <p className="text-xs text-muted-foreground">
                  Professional complaint handling and CQC inspection preparation strategies
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">NHS Frameworks</h4>
                <p className="text-xs text-muted-foreground">
                  QOF, IIF, ARRS roles, and PCN funding guidance with latest NHS updates
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="patient-line" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <PhoneCall className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Universal Access</h4>
                <p className="text-xs text-muted-foreground">
                  Any phone works - landline, mobile, or payphone. No internet or apps required
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Language Support</h4>
                <p className="text-xs text-muted-foreground">
                  Multi-language triage service supporting diverse community healthcare needs
                </p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Heart className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-medium text-sm mb-1">Inclusive Design</h4>
                <p className="text-xs text-muted-foreground">
                  Designed for elderly, disabled, and digitally excluded patients
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Usage Tips */}
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="gp-genie" className="mt-0">
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
          </TabsContent>
          
          <TabsContent value="pm-genie" className="mt-0">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h4 className="font-medium text-sm mb-2 text-green-900 dark:text-green-100">💡 How to Use PM Genie</h4>
              <div className="text-xs text-green-800 dark:text-green-200 space-y-1">
                <p>• Ask about operational challenges: "How do I handle staff sickness cover?"</p>
                <p>• Get complaint guidance: "Help me respond to a patient complaint professionally"</p>
                <p>• Request HR templates: "Draft a recruitment letter for a practice nurse"</p>
                <p>• QOF & funding queries: "Explain the latest IIF requirements"</p>
                <p>• CQC preparation: "What should I prepare for our next inspection?"</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GPGenieVoiceAgent;