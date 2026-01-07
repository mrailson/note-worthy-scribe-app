import React, { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from "@/hooks/use-mobile";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import { 
  Send, 
  Mic, 
  Paperclip, 
  FileText, 
  Mail, 
  CheckSquare, 
  Calendar,
  Sparkles,
  Bot,
  User,
  Brain,
  Download,
  Copy,
  Trash2,
  Settings,
  MessageSquare,
  HelpCircle,
  Clock,
  Shield,
  Users,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  FileDown,
  Presentation,
  History,
  Eye,
  Image,
  Type,
  X,
  Loader2,
  Expand,
  Minimize,
  Volume2,
  VolumeX,
  PhoneOff,
  Newspaper,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  Menu,
  BarChart3
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { LoginForm } from '@/components/LoginForm';
import { SpeechToText } from '@/components/SpeechToText';
import MessageRenderer from '@/components/MessageRenderer';

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';
import PMGenieVoiceAgent from '@/components/PMGenieVoiceAgent';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import NewsPanel from '@/components/NewsPanel';

// Helper function to get file type icon
const getFileTypeIcon = (fileName: string, fileType?: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const type = fileType?.toLowerCase();
  
  if (type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
    return Image;
  }
  if (type?.startsWith('text/') || fileName.includes('Pasted text')) {
    return Type;
  }
  if (['msg', 'eml'].includes(extension || '')) {
    return Mail;
  }
  return FileText;
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
  isLoading?: boolean;
}

interface SearchHistory {
  id: string;
  title: string;
  brief_overview?: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

interface PracticeContext {
  practiceName?: string;
  practiceManagerName?: string;
  pcnName?: string;
  neighbourhoodName?: string;
  otherPracticesInPCN?: string[];
  logoUrl?: string;
}

const AI4PMService = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<'claude' | 'gpt' | 'chatgpt5'>('chatgpt5'); // Fixed to ChatGPT 5.0
  const [sessionMemory, setSessionMemory] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [apiKeyMissing, setApiKeyMissing] = useState<{claude: boolean, gpt: boolean}>({claude: false, gpt: false});
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [activeTab, setActiveTab] = useState('ai-service');
  const [practiceContext, setPracticeContext] = useState<PracticeContext>({});
  const [chatBoxSize, setChatBoxSize] = useState('default'); // 'small', 'default', 'large', 'extra-large'
  const [includePracticeBranding, setIncludePracticeBranding] = useState(true);
  const [practiceDetails, setPracticeDetails] = useState<any>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [includeLatestWeb, setIncludeLatestWeb] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null); // Track current conversation
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(() => {
    const saved = localStorage.getItem('ai4pm-history-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  const [showVoiceAgent, setShowVoiceAgent] = useState(false);
  const [showChatGPTVoice, setShowChatGPTVoice] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(() => {
    const saved = localStorage.getItem('ai4pm-voice-muted');
    return saved ? JSON.parse(saved) : false;
  });
  const voiceChatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageContentRef = useRef<string>('');
  
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  // Scroll when messages array changes or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Scroll when last message content changes (for streaming/rendering)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.content !== lastMessageContentRef.current) {
      lastMessageContentRef.current = lastMessage.content;
      scrollToBottom();
    }
  }, [messages]);

  // Load search history and practice context on component mount
  useEffect(() => {
    if (user) {
      loadSearchHistoryList();
      loadPracticeContext();
    }
  }, [user]);

  // File input setup
  useEffect(() => {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileSelect);
      return () => fileInput.removeEventListener('change', handleFileSelect);
    }
  }, []);

  // Voice chat message handler
  const handleVoiceMessage = (event: any) => {
    console.log('Voice event:', event);
    
    if (event.type === 'response.audio_transcript.delta') {
      // Update or create assistant message with transcript
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === 'voice-response') {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: lastMessage.content + event.delta
            }
          ];
        } else {
          return [
            ...prev,
            {
              id: 'voice-response',
              role: 'assistant' as const,
              content: event.delta,
              timestamp: new Date()
            }
          ];
        }
      });
    } else if (event.type === 'response.audio_transcript.done') {
      // Finalize the assistant message and auto-save
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.id === 'voice-response') {
          const updatedMessages = [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              id: `voice-msg-${Date.now()}`,
            }
          ];
          
          // Auto-save the conversation after AI response
          setTimeout(() => {
            saveSearchAutomatically(updatedMessages);
          }, 1000);
          
          return updatedMessages;
        }
        return prev;
      });
      setIsVoiceSpeaking(false);
    } else if (event.type === 'response.audio.delta') {
      setIsVoiceSpeaking(true);
    } else if (event.type === 'response.audio.done') {
      setIsVoiceSpeaking(false);
    } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
      // Add user message from voice transcription
      const userMessage: Message = {
        id: `voice-user-${Date.now()}`,
        role: 'user',
        content: event.transcript,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
    }
  };

  // Start voice chat
  const startVoiceChat = async () => {
    try {
      setIsVoiceConnecting(true);
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      voiceChatRef.current = new RealtimeChat(handleVoiceMessage);
      const displayName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'there') as string;
      const firstName = displayName.includes('@') ? displayName.split('@')[0] : displayName.split(' ')[0];
      await voiceChatRef.current.init('shimmer', `Hello ${firstName}, I am the AI for GP Practice Managers, How can I help?`);
      
      // Apply saved mute state after initialization
      if (voiceChatRef.current && isVoiceMuted) {
        voiceChatRef.current.setMuted(true);
        console.log('Applied saved mute state:', isVoiceMuted);
      }
      
      setIsVoiceConnected(true);
      setIsVoiceConnecting(false);
      
      // Send initial greeting
      setTimeout(() => {
        const displayName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'there') as string;
        const firstName = displayName.includes('@') ? displayName.split('@')[0] : displayName.split(' ')[0];
        voiceChatRef.current?.sendMessage(`Hello ${firstName}, I am the AI for GP Practice Managers, How can I help?`);
      }, 1000);
      
    } catch (error) {
      console.error('Voice chat error:', error);
      setIsVoiceConnecting(false);
    }
  };

  // Toggle voice mute
  const toggleVoiceMute = () => {
    if (voiceChatRef.current) {
      const newMutedState = !isVoiceMuted;
      voiceChatRef.current.setMuted(newMutedState);
      setIsVoiceMuted(newMutedState);
      localStorage.setItem('ai4pm-voice-muted', JSON.stringify(newMutedState));
    }
  };

  // End voice chat
  const endVoiceChat = () => {
    voiceChatRef.current?.disconnect();
    setIsVoiceConnected(false);
    setIsVoiceSpeaking(false);
    // Don't reset mute state - preserve user preference
    
    // Auto-save the conversation when ending voice chat if there are messages
    if (messages.length > 0) {
      saveSearchAutomatically(messages);
    }
  };

  const loadPracticeContext = async () => {
    if (!user) return;

    try {
      // Get user's practice assignment
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('practice_id, role')
        .eq('user_id', user.id)
        .single();

      if (roleError || !userRole?.practice_id) {
        console.log('No practice assignment found for user');
        return;
      }

      // Get practice details including all information
      const { data: practiceDetails } = await supabase
        .from('practice_details')
        .select('practice_name, pcn_code, user_id, logo_url, address, phone, email, website')
        .eq('id', userRole.practice_id)
        .single();

      if (practiceDetails) {
        setPracticeDetails(practiceDetails);
      }

      if (!practiceDetails) {
        console.log('Practice details not found');
        return;
      }

      // Get practice manager name from profiles
      const { data: practiceManagerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', practiceDetails.user_id)
        .single();

      // Get PCN information
      const { data: pcnData } = await supabase
        .from('primary_care_networks')
        .select('pcn_name')
        .eq('pcn_code', practiceDetails.pcn_code)
        .single();

      // Get other practices in the same PCN
      const { data: otherPractices } = await supabase
        .from('practice_details')
        .select('practice_name')
        .eq('pcn_code', practiceDetails.pcn_code)
        .neq('id', userRole.practice_id);

      // Get neighbourhood information (if exists)
      const { data: neighbourhoodData } = await supabase
        .from('neighbourhoods')
        .select('name')
        .limit(1);

      setPracticeContext({
        practiceName: practiceDetails.practice_name,
        practiceManagerName: practiceManagerProfile?.full_name,
        pcnName: pcnData?.pcn_name,
        neighbourhoodName: neighbourhoodData?.[0]?.name,
        otherPracticesInPCN: otherPractices?.map(p => p.practice_name) || [],
        logoUrl: practiceDetails.logo_url
      });

      console.log('Practice context loaded:', {
        practiceName: practiceDetails.practice_name,
        pcnName: pcnData?.pcn_name
      });

    } catch (error) {
      console.error('Error loading practice context:', error);
    }
  };

  const loadSearchHistoryList = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Remove duplicates based on exact content match
      const uniqueSearches = (data || []).reduce((acc: any[], current: any) => {
        const isDuplicate = acc.some(existing => 
          existing.title === current.title && 
          JSON.stringify(existing.messages) === JSON.stringify(current.messages)
        );
        if (!isDuplicate) {
          acc.push(current);
        }
        return acc;
      }, []);

      setSearchHistory(uniqueSearches.map(item => ({
        id: item.id,
        title: item.title,
        brief_overview: item.brief_overview || undefined,
        messages: (item.messages as any) || [],
        created_at: item.created_at,
        updated_at: item.updated_at
      })));
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  // Quick Actions for AI4PM
  const quickActions = [
    {
      label: "Policy Review",
      icon: Shield,
      prompt: "Help me review and update our practice policies. Please analyse our current policies for compliance with latest NHS guidelines and suggest improvements.",
      requiresFiles: true
    },
    {
      label: "Staff Training Plan",
      icon: Users,
      prompt: "Create a comprehensive staff training plan for our practice. Include mandatory training requirements, schedules, and tracking methods.",
      requiresFiles: false
    },
    {
      label: "Budget Analysis",
      icon: TrendingUp,
      prompt: "Analyse our practice budget and financial performance. Identify areas for cost savings and revenue optimization.",
      requiresFiles: true
    },
    {
      label: "CQC Preparation",
      icon: CheckSquare,
      prompt: "Help me prepare for our upcoming CQC inspection. Create a comprehensive checklist and action plan.",
      requiresFiles: false
    },
    {
      label: "Meeting Minutes",
      icon: FileText,
      prompt: "Review and summarize these meeting minutes, identifying key action points and follow-up tasks.",
      requiresFiles: true
    },
    {
      label: "Incident Report",
      icon: AlertTriangle,
      prompt: "Help me create a detailed incident report including root cause analysis and preventive measures.",
      requiresFiles: false
    },
    {
      label: "Contract Review",
      icon: FileText,
      prompt: "Review this contract and highlight key terms, obligations, and potential risks.",
      requiresFiles: true
    },
    {
      label: "Performance Dashboard",
      icon: BarChart3,
      prompt: "Create a performance dashboard report for our practice, including key metrics and trends.",
      requiresFiles: true
    }
  ];

  const buildSystemPrompt = () => {
    const date = new Date().toLocaleDateString();
    const contextInfo = practiceContext.practiceName ? 
      `\nPractice Context: ${practiceContext.practiceName}${practiceContext.pcnName ? ` (PCN: ${practiceContext.pcnName})` : ''}${practiceContext.practiceManagerName ? `, Practice Manager: ${practiceContext.practiceManagerName}` : ''}` 
      : '';

    return `You are an AI assistant specifically designed for GP Practice Managers in the UK. Today's date is ${date}.

Your expertise covers:
- NHS regulations and compliance
- CQC standards and inspection preparation
- Practice management best practices
- Staff management and HR
- Financial management and budgeting
- Health and safety protocols
- Patient complaints handling
- Clinical governance
- Data protection and GDPR
- Contract management
- Performance monitoring
- Quality improvement initiatives

${contextInfo}

Always provide practical, actionable advice tailored to UK primary care settings. When discussing regulations or requirements, cite specific NHS guidelines or CQC standards where relevant.

If asked to review documents, provide detailed analysis with recommendations for improvement. For policy or procedure questions, ensure compliance with current NHS and CQC requirements.

Format your responses clearly with headings and bullet points where appropriate to make them easy to scan and implement.`;
  };

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('ai-4-pm-chat', {
        body: {
          messages: [...messages, userMessage],
          model,
          systemPrompt: buildSystemPrompt(),
          files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
          enableWebSearch: includeLatestWeb
        }
      });

      if (response.error) {
        if (response.error.message?.includes('API key')) {
          setApiKeyMissing(prev => ({
            ...prev,
            [model === 'claude' ? 'claude' : 'gpt']: true
          }));
        }
        throw response.error;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.generatedText || 'I apologize, but I was unable to generate a response.',
        timestamp: new Date()
      };

      const newMessages = [...messages, userMessage, assistantMessage];
      setMessages(newMessages);

      // Auto-save the conversation after AI response
      setTimeout(() => {
        saveSearchAutomatically(newMessages);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Add loading state immediately
      const loadingFile: UploadedFile = {
        name: file.name,
        type: file.type,
        content: '',
        size: file.size,
        isLoading: true
      };
      
      setUploadedFiles(prev => [...prev, loadingFile]);

      try {
        if (file.type.startsWith('text/')) {
          const content = await file.text();
          setUploadedFiles(prev => 
            prev.map(f => 
              f.name === file.name && f.isLoading ? 
              { ...f, content, isLoading: false } : f
            )
          );
        } else if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          setUploadedFiles(prev => 
            prev.map(f => 
              f.name === file.name && f.isLoading ? 
              { ...f, content: base64Content, isLoading: false } : f
            )
          );
        } else if (file.type.startsWith('image/')) {
          const arrayBuffer = await file.arrayBuffer();
          const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          setUploadedFiles(prev => 
            prev.map(f => 
              f.name === file.name && f.isLoading ? 
              { ...f, content: base64Content, isLoading: false } : f
            )
          );
        } else {
          // For other file types, read as text if possible
          try {
            const content = await file.text();
            setUploadedFiles(prev => 
              prev.map(f => 
                f.name === file.name && f.isLoading ? 
                { ...f, content, isLoading: false } : f
              )
            );
          } catch {
            setUploadedFiles(prev => 
              prev.map(f => 
                f.name === file.name && f.isLoading ? 
                { ...f, content: 'Binary file content not supported for preview', isLoading: false } : f
              )
            );
          }
        }
      } catch (error) {
        console.error('Error reading file:', error);
        setUploadedFiles(prev => 
          prev.map(f => 
            f.name === file.name && f.isLoading ? 
            { ...f, content: 'Error reading file', isLoading: false } : f
          )
        );
      }
    }
    
    // Reset the input
    input.value = '';
  };

  const handleNewSearch = () => {
    setMessages([]);
    setCurrentSearchId(null);
    setActiveTab('ai-service');
    inputRef.current?.focus();
  };

  const generateWordDocument = async (content: string, title?: string) => {
    // Create paragraphs from the content
    const lines = content.split('\n').filter(line => line.trim());
    const children = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        // Main heading
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.replace('# ', ''), bold: true, size: 32 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
          })
        );
      } else if (line.startsWith('## ')) {
        // Sub heading
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.replace('## ', ''), bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200, before: 200 }
          })
        );
      } else if (line.startsWith('### ')) {
        // Sub-sub heading
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.replace('### ', ''), bold: true, size: 24 })],
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100, before: 100 }
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet point
        children.push(
          new Paragraph({
            children: [new TextRun(line.replace(/^[*-] /, ''))],
            bullet: { level: 0 },
            spacing: { after: 100 }
          })
        );
      } else if (line.startsWith('  - ') || line.startsWith('  * ')) {
        // Sub bullet point
        children.push(
          new Paragraph({
            children: [new TextRun(line.replace(/^  [*-] /, ''))],
            bullet: { level: 1 },
            spacing: { after: 100 }
          })
        );
      } else if (line.match(/^\d+\. /)) {
        // Numbered list
        children.push(
          new Paragraph({
            children: [new TextRun(line.replace(/^\d+\. /, ''))],
            numbering: { reference: "default-numbering", level: 0 },
            spacing: { after: 100 }
          })
        );
      } else if (line.includes('**') && line.includes('**')) {
        // Bold text handling
        const parts = line.split('**');
        const textRuns = [];
        for (let i = 0; i < parts.length; i++) {
          if (i % 2 === 0) {
            if (parts[i]) textRuns.push(new TextRun(parts[i]));
          } else {
            if (parts[i]) textRuns.push(new TextRun({ text: parts[i], bold: true }));
          }
        }
        children.push(
          new Paragraph({
            children: textRuns,
            spacing: { after: 100 }
          })
        );
      } else if (line.trim()) {
        // Regular paragraph
        children.push(
          new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 100 }
          })
        );
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${title || 'AI4PM-Document'}.docx`);
  };

  const generatePowerPoint = async (content: string, title?: string) => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(title || 'AI4PM Presentation', {
      x: 1,
      y: 2,
      w: 10,
      h: 1.5,
      fontSize: 36,
      bold: true,
      align: 'center'
    });

    // Split content into slides based on headings
    const sections = content.split(/(?=^##?\s)/m).filter(section => section.trim());

    sections.forEach(section => {
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length === 0) return;

      const slide = pptx.addSlide();
      let yPos = 0.5;

      const titleLine = lines[0];
      const slideTitle = titleLine.replace(/^#+\s*/, '');
      
      slide.addText(slideTitle, {
        x: 0.5,
        y: yPos,
        w: 12,
        h: 1,
        fontSize: 24,
        bold: true,
        color: '2C5F87'
      });
      yPos += 1.2;

      const bulletPoints = lines.slice(1)
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.replace(/^[*-]\s*/, ''))
        .slice(0, 6); // Limit to 6 points per slide

      if (bulletPoints.length > 0) {
        slide.addText(bulletPoints.map(point => ({ text: point, options: {} })), {
          x: 0.5,
          y: yPos,
          w: 11.5,
          h: 5,
          fontSize: 16,
          bullet: true
        });
      }
    });

    pptx.writeFile({ fileName: `${title || 'AI4PM-Presentation'}.pptx` });
  };

  const toggleHistoryCollapsed = () => {
    const newState = !isHistoryCollapsed;
    setIsHistoryCollapsed(newState);
    localStorage.setItem('ai4pm-history-collapsed', JSON.stringify(newState));
  };

  const saveSearchAutomatically = async (messagesData: Message[]) => {
    if (!user || messagesData.length === 0) return;

    try {
      // If we have a current search ID, update it instead of creating a new one
      if (currentSearchId) {
        const { error } = await supabase
          .from('ai_4_pm_searches')
          .update({
            messages: messagesData as any,
            brief_overview: generateBriefOverview(messagesData)
          })
          .eq('id', currentSearchId);
        
        if (error) {
          console.error('Error updating search:', error);
        }
        return;
      }

      // Create new search
      const title = generateContextualTitle(messagesData);
      const overview = generateBriefOverview(messagesData);

      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .insert({
          user_id: user.id,
          title,
          brief_overview: overview,
          messages: messagesData as any
        })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentSearchId(data.id);
      loadSearchHistoryList(); // Refresh the list
    } catch (error) {
      console.error('Error saving search:', error);
    }
  };

  const generateContextualTitle = (messagesData: Message[]) => {
    const userMessages = messagesData.filter(m => m.role === 'user');
    const aiMessages = messagesData.filter(m => m.role === 'assistant');
    
    if (userMessages.length === 0) return 'Untitled Search';
    
    // Combine key words from user messages
    const allUserText = userMessages.map(m => m.content).join(' ');
    const words = allUserText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 8);
    
    const title = words.join(' ');
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  };

  const generateBriefOverview = (messagesData: Message[]) => {
    const aiMessages = messagesData.filter(m => m.role === 'assistant');
    return aiMessages.length > 0 
      ? aiMessages[0].content.substring(0, 100) + (aiMessages[0].content.length > 100 ? '...' : '')
      : 'No AI response';
  };

  const loadPreviousSearch = async (searchId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .select('*')
        .eq('id', searchId)
        .single();

      if (error) throw error;
      
      // Ensure messages are properly formatted with required properties
      const messagesData = Array.isArray(data.messages) ? 
        (data.messages as any[]).map((msg: any, index: number) => ({
          id: msg.id || `loaded-${index}-${Date.now()}`,
          role: msg.role || 'user',
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          files: msg.files || undefined
        })) : [];
      
      setMessages(messagesData);
      setCurrentSearchId(searchId); // Track which search is currently loaded
      setActiveTab('ai-service');
    } catch (error) {
      console.error('Error loading search:', error);
    }
  };

  const deleteSearch = async (searchId: string) => {
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('id', searchId);

      if (error) throw error;
      
      // If we're deleting the currently loaded search, clear the current search
      if (currentSearchId === searchId) {
        setCurrentSearchId(null);
        setMessages([]);
      }
      
      loadSearchHistoryList(); // Refresh the list
    } catch (error) {
      console.error('Error deleting search:', error);
    }
  };

  const clearAllHistory = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Clear current search and messages
      setCurrentSearchId(null);
      setMessages([]);
      setSearchHistory([]);
      
    } catch (error) {
      console.error('Error clearing all history:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="max-w-[1536px] mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile Collapsible Menu */}
          {isMobile && (
            <div className="md:hidden mb-4">
              <div className="flex items-center justify-between p-3 bg-background border rounded-lg">
                <div className="flex items-center gap-2">
                  {activeTab === "ai-service" && <><Bot className="h-4 w-4 text-primary" /><span className="text-sm font-medium">AI Service</span></>}
                  {activeTab === "pm-genie" && <><Bot className="h-4 w-4 text-primary" /><span className="text-sm font-medium">PM Genie</span></>}
                  {activeTab === "history" && <><History className="h-4 w-4 text-primary" /><span className="text-sm font-medium">History</span></>}
                  {activeTab === "news" && <><Newspaper className="h-4 w-4 text-primary" /><span className="text-sm font-medium">News</span></>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTabMenuOpen(!isTabMenuOpen)}
                >
                  {isTabMenuOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
              
              <Collapsible open={isTabMenuOpen} onOpenChange={setIsTabMenuOpen}>
                <CollapsibleContent>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <TabsTrigger 
                      value="ai-service" 
                      className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all duration-200 text-xs font-medium data-[state=active]:bg-primary/90 data-[state=active]:text-primary-foreground"
                      onClick={() => setIsTabMenuOpen(false)}
                    >
                      <Bot className="h-4 w-4" />
                      <span>AI Service</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="pm-genie" 
                      className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all duration-200 text-xs font-medium data-[state=active]:bg-primary/90 data-[state=active]:text-primary-foreground"
                      onClick={() => setIsTabMenuOpen(false)}
                    >
                      <Bot className="h-4 w-4" />
                      <span>PM Genie</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="history" 
                      className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all duration-200 text-xs font-medium data-[state=active]:bg-primary/90 data-[state=active]:text-primary-foreground"
                      onClick={() => setIsTabMenuOpen(false)}
                    >
                      <History className="h-4 w-4" />
                      <span>History</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="news" 
                      className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all duration-200 text-xs font-medium data-[state=active]:bg-primary/90 data-[state=active]:text-primary-foreground"
                      onClick={() => setIsTabMenuOpen(false)}
                    >
                      <Newspaper className="h-4 w-4" />
                      <span>News</span>
                    </TabsTrigger>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Desktop Menu */}
          <TabsList className={`grid w-full mb-6 ${isMobile ? 'hidden' : 'grid-cols-4'}`}>
            <TabsTrigger 
              value="ai-service"
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span>AI Service</span>
              </div>
            </TabsTrigger>
            
            <TabsTrigger 
              value="pm-genie"
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span>PM Genie</span>
              </div>
            </TabsTrigger>
            
            <TabsTrigger 
              value="history"
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <span>History</span>
              </div>
            </TabsTrigger>
            
            <TabsTrigger 
              value="news"
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                <span>News</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-service" className="space-y-4">
            <div className={`grid grid-cols-1 gap-6 ${isHistoryCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-4'}`}>
              {/* Left Sidebar - Collapsible Search History */}
              {!isHistoryCollapsed && (
                <div className="lg:col-span-1">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                       <div className="flex items-center justify-between">
                         <CardTitle className="text-lg">Search History</CardTitle>
                         <div className="flex items-center gap-1">
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={toggleHistoryCollapsed}
                             className="h-8 w-8 p-0"
                             title="Collapse history"
                           >
                             <X className="h-4 w-4" />
                           </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-destructive"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Clear
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Clear All History</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete all conversation history? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={clearAllHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Clear All
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={handleNewSearch}
                             className="h-8"
                           >
                             <Sparkles className="h-3 w-3 mr-1" />
                             New
                           </Button>
                         </div>
                       </div>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[600px]">
                        <div className="space-y-2">
                          {searchHistory.map((search) => (
                            <div key={search.id} className="group relative">
                              <div
                                className="p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                                onClick={() => loadPreviousSearch(search.id)}
                              >
                                <div className="font-medium text-sm truncate">
                                  {search.title}
                                </div>
                                {search.brief_overview && (
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {search.brief_overview}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-2">
                                  {new Date(search.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSearch(search.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {searchHistory.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="text-sm">No search history yet</p>
                              <p className="text-xs">Your conversations will appear here</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Main Chat Area */}
              <div className={isHistoryCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'}>
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isHistoryCollapsed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleHistoryCollapsed}
                            className="h-8 w-8 p-0"
                            title="Show history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}
                        <CardTitle className="text-xl">AI4PM Assistant</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Voice Controls */}
                        {isVoiceConnected && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleVoiceMute}
                              className={`h-8 ${isVoiceMuted ? 'text-muted-foreground' : 'text-primary'}`}
                            >
                              {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            </Button>
                            {isVoiceSpeaking && (
                              <div className="flex items-center gap-1 text-sm text-primary">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                Speaking
                              </div>
                            )}
                          </div>
                        )}
                        
                        <Button
                          variant={isVoiceConnected ? "destructive" : "default"}
                          size="sm"
                          onClick={isVoiceConnected ? endVoiceChat : startVoiceChat}
                          disabled={isVoiceConnecting}
                          className="h-8"
                        >
                          {isVoiceConnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isVoiceConnected ? (
                            <PhoneOff className="h-4 w-4" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowQuickActions(!showQuickActions)}
                          className="h-8"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Quick Actions */}
                    {showQuickActions && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-4 bg-accent/50 rounded-lg">
                        {quickActions.map((action, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            className="h-auto p-3 flex flex-col items-center gap-2"
                            onClick={() => {
                              if (action.requiresFiles && uploadedFiles.length === 0) {
                                const fileInput = document.getElementById('file-input');
                                fileInput?.click();
                                setTimeout(() => {
                                  setInput(action.prompt);
                                }, 100);
                              } else {
                                setInput(action.prompt);
                                inputRef.current?.focus();
                              }
                              setShowQuickActions(false);
                            }}
                          >
                            <action.icon className="h-4 w-4" />
                            <span className="text-xs text-center">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Settings Panel */}
                    <div className="flex items-center gap-4 p-3 bg-accent/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="web-search"
                          checked={includeLatestWeb}
                          onCheckedChange={setIncludeLatestWeb}
                        />
                        <Label htmlFor="web-search" className="text-sm">Web Search</Label>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="h-[400px] overflow-y-auto space-y-4 p-4 border rounded-lg">
                      {messages.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-medium mb-2">Welcome to AI4PM</h3>
                          <p className="text-sm">Your AI assistant for practice management</p>
                          <p className="text-xs mt-2">Ask me about policies, procedures, compliance, or any practice management question</p>
                        </div>
                      )}
                      
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg p-3 ${
                            message.role === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            <div className="flex items-start gap-2">
                              {message.role === 'assistant' && <Bot className="h-4 w-4 mt-1 flex-shrink-0" />}
                              {message.role === 'user' && <User className="h-4 w-4 mt-1 flex-shrink-0" />}
                              <div className="space-y-2">
                                {/* Message files */}
                                {message.files && message.files.length > 0 && (
                                  <div className="space-y-1">
                                    {message.files.map((file, index) => {
                                      const FileIcon = getFileTypeIcon(file.name, file.type);
                                      return (
                                        <div key={index} className="flex items-center gap-2 text-xs bg-background/10 rounded p-2">
                                          <FileIcon className="h-3 w-3" />
                                          <span className="truncate">{file.name}</span>
                                          {file.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                
                                <MessageRenderer 
                                  message={message}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4" />
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm">Thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="space-y-2">
                      {/* Uploaded Files */}
                      {uploadedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {uploadedFiles.map((file, index) => {
                            const FileIcon = getFileTypeIcon(file.name, file.type);
                            return (
                              <div key={index} className="flex items-center gap-2 bg-accent rounded-lg p-2 text-sm">
                                <FileIcon className="h-4 w-4" />
                                <span className="truncate max-w-[200px]">{file.name}</span>
                                {file.isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0"
                                    onClick={() => setUploadedFiles(files => files.filter((_, i) => i !== index))}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me anything about practice management..."
                            className="min-h-[80px] resize-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            id="file-input"
                            multiple
                            accept=".txt,.pdf,.doc,.docx,.csv,.xlsx,.xls,.json,.md,.rtf,image/*"
                            style={{ display: 'none' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('file-input')?.click()}
                            className="h-10 w-10 p-0"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={handleSend}
                            disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
                            className="h-10 w-10 p-0"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pm-genie">
            <PMGenieVoiceAgent />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Conversation History</CardTitle>
                  {searchHistory.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear All
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear All History</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete all conversation history? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={clearAllHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Clear All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchHistory.map((search) => (
                    <Card key={search.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-medium truncate">
                            {search.title}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSearch(search.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {search.brief_overview && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-3">
                            {search.brief_overview}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(search.created_at).toLocaleDateString()}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadPreviousSearch(search.id)}
                            className="h-6 text-xs"
                          >
                            Load
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {searchHistory.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-8">
                      <History className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No History Yet</h3>
                      <p className="text-sm">Your conversations will appear here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="news">
            <NewsPanel cleanView />
          </TabsContent>
        </Tabs>
      </div>

      {/* Expanded Message Dialog */}
      <Dialog open={!!expandedMessage} onOpenChange={() => setExpandedMessage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>
          {expandedMessage && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {expandedMessage.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                <span className="capitalize">{expandedMessage.role}</span>
                <span>•</span>
                <span>{expandedMessage.timestamp.toLocaleString()}</span>
              </div>
              
              <MessageRenderer 
                message={expandedMessage}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* API Key Missing Alerts */}
      {apiKeyMissing.claude && (
        <div className="fixed bottom-4 right-4 max-w-sm">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Claude API key is missing. Please contact support to configure it.
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {apiKeyMissing.gpt && (
        <div className="fixed bottom-4 right-4 max-w-sm">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              OpenAI API key is missing. Please contact support to configure it.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default AI4PMService;