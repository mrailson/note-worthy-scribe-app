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
  Plus,
  Image,
  Type,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Expand,
  Minimize,
  Volume2,
  VolumeX,
  PhoneOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoginForm } from '@/components/LoginForm';
import { SpeechToText } from '@/components/SpeechToText';
import MessageRenderer from '@/components/MessageRenderer';

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';
import PMGenieVoiceAgent from '@/components/PMGenieVoiceAgent';
import { RealtimeChat } from '@/utils/RealtimeAudio';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<'claude' | 'gpt' | 'chatgpt5'>('chatgpt5');
  const [sessionMemory, setSessionMemory] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [apiKeyMissing, setApiKeyMissing] = useState<{claude: boolean, gpt: boolean}>({claude: false, gpt: false});
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [activeTab, setActiveTab] = useState('ai-service');
  const [practiceContext, setPracticeContext] = useState<PracticeContext>({});
  const [chatBoxSize, setChatBoxSize] = useState('default'); // 'small', 'default', 'large', 'extra-large'
  const [includePracticeBranding, setIncludePracticeBranding] = useState(true);
  const [practiceDetails, setPracticeDetails] = useState<any>(null);
  const [isModelSelectorCollapsed, setIsModelSelectorCollapsed] = useState(true); // Collapsed by default
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
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load search history and practice context on component mount
  useEffect(() => {
    if (user) {
      loadSearchHistoryList();
      loadPracticeContext();
    }
  }, [user]);

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
      await voiceChatRef.current.init('shimmer');
      
      setIsVoiceConnected(true);
      setIsVoiceConnecting(false);
      
      // Send initial greeting
      setTimeout(() => {
        voiceChatRef.current?.sendMessage("Hi, how can I help you?");
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

  const saveCurrentSearch = async () => {
    if (!user || messages.length === 0) return;

    try {
      // Generate title from first user message
      const firstUserMessage = messages.find(m => m.role === 'user');
      const title = firstUserMessage?.content.substring(0, 50) + (firstUserMessage?.content.length > 50 ? '...' : '') || 'Untitled Search';
      
      // Generate brief overview from AI responses
      const aiMessages = messages.filter(m => m.role === 'assistant');
      const overview = aiMessages.length > 0 
        ? aiMessages[0].content.substring(0, 100) + (aiMessages[0].content.length > 100 ? '...' : '')
        : 'No AI response';

      const { error } = await supabase
        .from('ai_4_pm_searches')
        .insert({
          user_id: user.id,
          title,
          brief_overview: overview,
          messages: messages as any
        });

      if (error) throw error;
      
      loadSearchHistoryList(); // Refresh the list
    } catch (error) {
      console.error('Error saving search:', error);
    }
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
      setActiveTab('ai-service');
    } catch (error) {
      console.error('Error loading search:', error);
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

  const saveSearchAutomatically = async (messagesData: Message[]) => {
    if (!user || messagesData.length === 0) return;

    try {
      // Check if similar search already exists to prevent duplicates
      const { data: existingSearches } = await supabase
        .from('ai_4_pm_searches')
        .select('id, messages')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Check for exact duplicate
      const isDuplicate = existingSearches?.some(search => 
        JSON.stringify(search.messages) === JSON.stringify(messagesData)
      );

      if (isDuplicate) {
        console.log('Duplicate search detected, skipping save');
        return;
      }

      // Generate contextual title
      const title = generateContextualTitle(messagesData);
      
      // Generate brief overview from AI responses (max 50 words)
      const aiMessages = messagesData.filter(m => m.role === 'assistant');
      let overview = 'No AI response';
      if (aiMessages.length > 0) {
        const content = aiMessages[0].content;
        const words = content.split(' ').slice(0, 50);
        overview = words.join(' ') + (content.split(' ').length > 50 ? '...' : '');
      }

      const { error } = await supabase
        .from('ai_4_pm_searches')
        .insert({
          user_id: user.id,
          title,
          brief_overview: overview,
          messages: messagesData as any
        });

      if (!error) {
        loadSearchHistoryList(); // Refresh the list silently
      }
    } catch (error) {
      // Silent failure for auto-save
      console.error('Error auto-saving search:', error);
    }
  };

  const deleteSearch = async (searchId: string) => {
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('id', searchId);

      if (error) throw error;
      
      loadSearchHistoryList(); // Refresh the list
    } catch (error) {
      console.error('Error deleting search:', error);
    }
  };

  const clearAllSearches = async () => {
    try {
      const { error } = await supabase
        .from('ai_4_pm_searches')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;
      
      loadSearchHistoryList(); // Refresh the list
    } catch (error) {
      console.error('Error clearing all searches:', error);
    }
  };

  const handleNewMeeting = () => {
    // End voice chat if active
    if (isVoiceConnected) {
      endVoiceChat();
    }
    
    // Save current search before clearing if it has messages
    if (messages.length > 0) {
      saveCurrentSearch();
    }
    // Clear current conversation
    setMessages([]);
    setUploadedFiles([]);
    setInput('');
  };

  const quickActions = [
    { 
      label: 'Summarise Document', 
      icon: FileText, 
      prompt: 'Please summarise the uploaded document and highlight any key deadlines, actions, or compliance requirements.',
      requiresFile: true 
    },
    { 
      label: 'Draft NHS Email', 
      icon: Mail, 
      prompt: 'Help me draft a professional NHS-compliant email response for this correspondence.',
      requiresFile: false 
    },
    { 
      label: 'Create SOP/Checklist', 
      icon: CheckSquare, 
      prompt: 'Create a standard operating procedure or checklist based on the requirements discussed.',
      requiresFile: false 
    },
    { 
      label: 'CQC Tasks', 
      icon: Settings, 
      prompt: 'Identify any CQC-related tasks, compliance requirements, or KLOEs that need attention.',
      requiresFile: false 
    },
    { 
      label: 'Meeting Agenda', 
      icon: Calendar, 
      prompt: 'Help me create a meeting agenda or meeting minutes template.',
      requiresFile: false 
    },
    { 
      label: 'Create Word Document', 
      icon: FileDown, 
      prompt: 'Generate a Word document based on our conversation. Please specify what type of document you need (policy, procedure, letter, etc.).',
      requiresFile: false 
    },
  ];

  const insertPracticeDetails = () => {
    if (!practiceDetails) return;
    
    let practiceText = `\n\n**Practice Details:**\n`;
    practiceText += `**Practice Name:** ${practiceDetails.practice_name}\n`;
    
    if (practiceDetails.address) {
      practiceText += `**Address:** ${practiceDetails.address}\n`;
    }
    
    if (practiceDetails.phone) {
      practiceText += `**Phone:** ${practiceDetails.phone}\n`;
    }
    
    if (practiceDetails.email) {
      practiceText += `**Email:** ${practiceDetails.email}\n`;
    }
    
    if (practiceDetails.website) {
      practiceText += `**Website:** ${practiceDetails.website}\n`;
    }
    
    if (practiceContext.pcnName) {
      practiceText += `**Primary Care Network:** ${practiceContext.pcnName}\n`;
    }
    
    practiceText += `\n`;
    
    setInput(prev => prev + practiceText);
  };

  const buildSystemPrompt = () => {
    let prompt = `You are "AI 4 PM Service", an AI Assistant built specifically to help GP Practice Managers in the UK NHS.

You understand and can explain:
- NHS policies (Digital Service Manual, GP contract, CQC KLOEs)
- Common admin, HR, finance and compliance workflows
- EMIS, SystmOne, SNOMED, QOF indicators
- Local policies uploaded by the user
- You summarise, draft documents, create checklists, answer SOP queries
- Always stay professional, accurate, and NHS-compliant

${uploadedFiles.length > 0 ? `\nIMPORTANT: The user has uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. These files contain content that you can directly analyze and reference. You have full access to the file contents, so you can answer questions about them, summarize them, or analyze them without asking the user to upload again.` : ''}`;

    // Add practice context if available
    if (practiceContext.practiceName) {
      prompt += `\n\nCONTEXT ABOUT THE USER'S PRACTICE:
- Practice Name: ${practiceContext.practiceName}`;
      
      if (practiceContext.practiceManagerName) {
        prompt += `\n- Practice Manager: ${practiceContext.practiceManagerName}`;
      }
      
      if (practiceContext.pcnName) {
        prompt += `\n- Primary Care Network (PCN): ${practiceContext.pcnName}`;
      }
      
      if (practiceContext.neighbourhoodName) {
        prompt += `\n- Neighbourhood: ${practiceContext.neighbourhoodName}`;
      }
      
      if (practiceContext.otherPracticesInPCN?.length > 0) {
        prompt += `\n- Other practices in the same PCN: ${practiceContext.otherPracticesInPCN.join(', ')}`;
      }
      
      prompt += `\n\nWhen relevant to queries, you can reference this practice information to provide more personalized and contextual responses. For example, you can mention collaboration opportunities with other practices in the PCN, or tailor advice specific to the practice's context.`;
    }

    prompt += `\n\nKnowledge domains you should reference:
1. NHS Digital & Admin Resources (NHS England GP Contract 2024/25, PCN DES, NHS Long Term Plan)
2. CQC and Compliance (KLOEs for GP practices, CQC Evidence Categories, compliance documents)
3. Practice Operations (Reception SOPs, HR policies, patient access strategies)
4. Finance & Contracts (GP Practice finance, PCN funding, ARRS roles, IIF indicators)
5. Information Governance & GDPR (DSPT compliance, NHSmail policies, SARs)
6. Clinical System Knowledge (SNOMED basics, EMIS/SystmOne templates, QOF indicators)

SPECIAL CAPABILITIES:
- Document Generation: When asked to create a Word document, format your response with clear headings, sections, and structured content that can be easily converted to a professional document.
- File Analysis: When files are uploaded by the user, you have access to their full content and can analyze, summarize, and answer questions about them directly.

Always provide practical, actionable advice that follows NHS guidelines and best practices.`;

    return prompt;
  };

  const handleSend = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    // Enhance the message content when files are attached
    let messageContent = input;
    if (uploadedFiles.length > 0 && input.trim()) {
      messageContent = `${input}\n\n[Note: I have uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. Please analyze these files in relation to my question above.]`;
    } else if (uploadedFiles.length > 0 && !input.trim()) {
      messageContent = `Please analyze the uploaded file(s): ${uploadedFiles.map(f => f.name).join(', ')}`;
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: {
          messages: sessionMemory ? [...messages, userMessage] : [userMessage],
          model,
          systemPrompt: buildSystemPrompt(),
          files: uploadedFiles
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setUploadedFiles([]); // Clear files after sending

      // Auto-save search after AI responds (only if this is a new conversation)
      const isNewConversation = messages.length === 0;
      if (isNewConversation) {
        setTimeout(() => {
          const updatedMessages = [...messages, userMessage, assistantMessage];
          saveSearchAutomatically(updatedMessages);
        }, 1000);
      }

      // Removed automatic follow-up message generation to prevent bubble splitting
    } catch (error: any) {
      console.error('Error:', error);
      if (error.message?.includes('API key not configured')) {
        if (model === 'claude') {
          setApiKeyMissing(prev => ({...prev, claude: true}));
          console.error('Anthropic API key not configured. Please check your settings.');
        } else {
          setApiKeyMissing(prev => ({...prev, gpt: true}));
          console.error('OpenAI API key not configured. Please check your settings.');
        }
      } else {
        console.error('Failed to get response. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    if (action.requiresFile && uploadedFiles.length === 0) {
      console.error('This action requires a file to be uploaded first.');
      return;
    }
    
    setInput(action.prompt);
  };

  const handleSpeechTranscription = (text: string) => {
    setInput(prev => prev + (prev ? ' ' : '') + text);
  };

  const handleFileUpload = (files: File[]) => {
    files.forEach(file => {
      // Add file with loading state immediately
      const loadingFile: UploadedFile = {
        name: file.name,
        type: file.type,
        content: '',
        size: file.size,
        isLoading: true
      };
      
      setUploadedFiles(prev => [...prev, loadingFile]);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const uploadedFile: UploadedFile = {
          name: file.name,
          type: file.type,
          content,
          size: file.size,
          isLoading: false
        };
        
        // Replace the loading file with the completed one
        setUploadedFiles(prev => 
          prev.map(f => 
            f.name === file.name && f.isLoading 
              ? uploadedFile 
              : f
          )
        );
        console.log(`File uploaded: ${file.name}`);
      };
      
      reader.onerror = () => {
        // Remove the loading file on error
        setUploadedFiles(prev => 
          prev.filter(f => !(f.name === file.name && f.isLoading))
        );
        console.error(`Failed to upload file: ${file.name}`);
      };
      
      // Handle different file types
      if (file.type.startsWith('text/') || 
          file.name.endsWith('.txt') || 
          file.name.endsWith('.csv') ||
          file.name.endsWith('.msg') ||
          file.name.endsWith('.eml')) {
        reader.readAsText(file);
      } else {
        // For binary files, read as data URL
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearConversation = () => {
    // End voice chat if active
    if (isVoiceConnected) {
      endVoiceChat();
    }
    
    setMessages([]);
    setUploadedFiles([]);
    setInput('');
    console.log('Conversation cleared');
  };

  const getChatBoxHeight = () => {
    switch (chatBoxSize) {
      case 'small': return 'h-[400px]';
      case 'default': return 'h-[calc(100vh-280px)]';
      case 'large': return 'h-[calc(100vh-200px)]';
      case 'extra-large': return 'h-[calc(100vh-120px)]';
      default: return 'h-[calc(100vh-280px)]';
    }
  };

  const generateWordDocument = async (content: string, title: string = 'AI Generated Document') => {
    try {
      const paragraphs: any[] = [];
      
      // Add practice branding if enabled and available
      if (includePracticeBranding && practiceContext.practiceName) {
        // Add practice name as header
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: practiceContext.practiceName,
                bold: true,
                size: 28,
                color: "003087" // NHS Blue
              })
            ],
            spacing: { after: 200 }
          })
        );
        
        // Add separator line
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "____________________________________________",
                color: "005EB8" // NHS Light Blue
              })
            ],
            spacing: { after: 400 }
          })
        );
      }
      
      // Add title
      paragraphs.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
        })
      );

      // Enhanced content parsing - preserve all formatting including checkboxes
      const parseContent = (content: string) => {
        // Convert checkboxes first, then split lines
        const processedContent = content
          .replace(/☑/g, '✓ ') // Convert checkmark to simple tick
          .replace(/☐/g, '□ ') // Convert empty checkbox to simple box
          .replace(/\[\s*x\s*\]/gi, '✓ ') // Convert [x] to tick
          .replace(/\[\s*\]/g, '□ '); // Convert [ ] to box
        
        return processedContent.split('\n').filter(line => line.trim());
      };

      const contentLines = parseContent(content);
      
      contentLines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) return;
        
        // Skip separator lines
        if (trimmedLine === '---' || trimmedLine === '___') return;
        
        console.log("DEBUG Word Export - Processing line:", trimmedLine);
        
        // Check for headings (markdown or formatted)
        if (trimmedLine.startsWith('#')) {
          const headingText = trimmedLine.replace(/^#+\s*/, '').replace(/\*\*/g, ''); // Remove # and ** formatting
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: true,
                  size: 32, // 16pt
                  color: "003087" // NHS Blue
                })
              ],
              spacing: { before: 400, after: 200 }
            })
          );
        }
        // Check if it's a section heading (including numbered headings with markdown)
        else if ((trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 5 && trimmedLine.length < 80) || 
                 (trimmedLine.endsWith(':') && trimmedLine.length < 80 && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('☑') && !trimmedLine.startsWith('☐')) ||
                 (trimmedLine.match(/^\d+\.\s*\*\*[^*]+?\*\*$/)) ||  // Handle numbered headings like "1. **Background**"
                 (trimmedLine.match(/^[A-Z]\.\s*\*\*[^*]+?\*\*$/))) { // Handle lettered headings like "A. **NHS England**"
          
          // Extract heading text and remove markdown formatting for Word display
          let headingText = trimmedLine;
          if (headingText.match(/^\d+\.\s*\*\*[^*]+?\*\*$/) || headingText.match(/^[A-Z]\.\s*\*\*[^*]+?\*\*$/)) {
            // Extract from numbered/lettered bold heading format
            headingText = headingText.replace(/^[A-Z0-9]\.\s*\*\*([^*]+?)\*\*$/, '$1');
          } else {
            // Remove any residual markdown
            headingText = headingText.replace(/\*\*/g, '').replace(/:/g, '');
          }
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingText,
                  bold: true,
                  size: 28, // 14pt
                  color: "005EB8" // NHS Light Blue
                })
              ],
              spacing: { before: 300, after: 150 }
            })
          );
        }
        // Handle checkboxes and special characters - preserve exactly as shown
        else if (trimmedLine.startsWith('☑') || trimmedLine.startsWith('☐') || trimmedLine.startsWith('✓') || trimmedLine.startsWith('✗')) {
          const checkboxSymbol = trimmedLine.substring(0, 1);
          const checkboxText = trimmedLine.substring(1).trim();
          const isChecked = trimmedLine.startsWith('☑') || trimmedLine.startsWith('✓');
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: checkboxSymbol + ' ',
                  size: 24,
                  color: isChecked ? "008000" : "666666", // Green for checked, gray for unchecked
                  font: "Segoe UI Symbol" // Ensure checkbox symbols display properly
                }),
                new TextRun({
                  text: checkboxText,
                  size: 24
                })
              ],
              spacing: { after: 100 },
              indent: { left: 100 }
            })
          );
        }
        // Handle bullet points
        else if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
          const bulletText = trimmedLine.replace(/^[•-]\s*/, '');
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: bulletText,
                  size: 24
                })
              ],
              bullet: {
                level: 0,
              },
              spacing: { after: 100 }
            })
          );
        }
        // Handle numbered lists (but not if they contain markdown formatting like **text**)
        else if (trimmedLine.match(/^\d+\./) && !trimmedLine.includes('**')) {
          const numberedText = trimmedLine.replace(/^\d+\.\s*/, '');
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: numberedText,
                  size: 24
                })
              ],
              numbering: {
                reference: "default-numbering",
                level: 0,
              },
              spacing: { after: 100 }
            })
          );
        }
        // Handle regular text with inline formatting
        else {
          const processFormattedText = (text: string) => {
            const children: any[] = [];
            
            // Handle the special case where the entire line is bold
            if (text.match(/^\*\*[^*]+\*\*$/)) {
              const boldText = text.slice(2, -2);
              children.push(new TextRun({
                text: boldText,
                size: 24,
                bold: true
              }));
              return children;
            }
            
            // More comprehensive pattern to handle bold, italic, and mixed formatting
            const formatPattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
            let lastIndex = 0;
            let match;
            
            while ((match = formatPattern.exec(text)) !== null) {
              // Add any plain text before this match
              if (match.index > lastIndex) {
                const plainText = text.substring(lastIndex, match.index);
                if (plainText) {
                  children.push(new TextRun({
                    text: plainText,
                    size: 24
                  }));
                }
              }
              
              const matchedText = match[0];
              
              // Handle bold and italic (***text***)
              if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
                const content = matchedText.slice(3, -3);
                children.push(new TextRun({
                  text: content,
                  size: 24,
                  bold: true,
                  italics: true
                }));
              }
              // Handle bold (**text**)
              else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
                const content = matchedText.slice(2, -2);
                children.push(new TextRun({
                  text: content,
                  size: 24,
                  bold: true
                }));
              }
              // Handle italic (*text*)
              else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
                const content = matchedText.slice(1, -1);
                children.push(new TextRun({
                  text: content,
                  size: 24,
                  italics: true
                }));
              }
              // Handle code (`text`)
              else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
                const content = matchedText.slice(1, -1);
                children.push(new TextRun({
                  text: content,
                  size: 22,
                  font: "Courier New",
                  shading: {
                    type: "clear",
                    color: "f6f8fa",
                    fill: "f6f8fa"
                  }
                }));
              }
              
              lastIndex = formatPattern.lastIndex;
            }
            
            // Add any remaining plain text after the last match
            if (lastIndex < text.length) {
              const remainingText = text.substring(lastIndex);
              if (remainingText) {
                children.push(new TextRun({
                  text: remainingText,
                  size: 24
                }));
              }
            }
            
            // If no formatting patterns were found, add the entire text as plain
            if (children.length === 0) {
              children.push(new TextRun({
                text: text,
                size: 24
              }));
            }
            
            return children;
          };
          
          paragraphs.push(
            new Paragraph({
              children: processFormattedText(trimmedLine),
              spacing: { after: 200 }
            })
          );
        }
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
        numbering: {
          config: [{
            reference: "default-numbering",
            levels: [{
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: "start",
            }]
          }]
        }
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`);
      console.log('Word document generated successfully');
    } catch (error) {
      console.error('Error generating Word document:', error);
    }
  };

  const generatePowerPoint = async (content: string, title: string = 'AI Generated Presentation') => {
    try {
      const pptx = new PptxGenJS();
      
      // Set presentation properties with NHS branding
      pptx.author = 'AI 4 PM Service';
      pptx.company = includePracticeBranding && practiceContext.practiceName ? practiceContext.practiceName : 'NHS GP Practice';
      pptx.title = title;

      // Define NHS slide master with professional styling
      pptx.defineSlideMaster({
        title: 'NHS_MASTER',
        background: { fill: '#F8FAFC' },
        objects: [
          // NHS Blue header bar
          {
            rect: {
              x: 0, y: 0, w: '100%', h: 0.8,
              fill: { color: '003087' }
            }
          },
          // NHS logo area
          {
            rect: {
              x: 0, y: 0, w: 2, h: 0.8,
              fill: { color: '005EB8' }
            }
          },
           // NHS text in header
           {
             text: {
               text: 'NHS',
               options: {
                 x: 0.2, y: 0.15, w: 1.6, h: 0.5,
                 fontSize: 24,
                 bold: true,
                 color: 'FFFFFF',
                 fontFace: 'Arial'
               }
             }
           },
           // Practice name in header (if branding enabled)
           ...(includePracticeBranding && practiceContext.practiceName ? [{
             text: {
               text: practiceContext.practiceName,
               options: {
                 x: 2.2, y: 0.15, w: 6, h: 0.5,
                 fontSize: 16,
                 bold: true,
                 color: 'FFFFFF',
                 fontFace: 'Arial'
               }
             }
           }] : []),
          // Accent line
          {
            line: {
              x: 0, y: 0.9, w: '100%', h: 0,
              line: { color: '005EB8', width: 2 }
            }
          },
          // Footer area
          {
            rect: {
              x: 0, y: 6.8, w: '100%', h: 0.7,
              fill: { color: 'E8F4FD' }
            }
          }
        ]
      });

      // Clean the content from markdown
      const cleanContent = content
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
        .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
        .replace(/`(.*?)`/g, '$1') // Remove code markdown
        .replace(/#{1,6}\s*/g, '') // Remove heading markdown
        .replace(/^\s*[-•*]\s*/gm, '• '); // Normalize bullet points

      // Create NHS-branded title slide
      const titleSlide = pptx.addSlide({ masterName: 'NHS_MASTER' });
      
      // Main title
      titleSlide.addText('AI 4 PM Service', {
        x: 1, y: 2, w: 8, h: 1,
        fontSize: 44,
        bold: true,
        color: '003087',
        align: 'center',
        fontFace: 'Arial'
      });
      
      // Subtitle
      titleSlide.addText('Clinical Analysis & Practice Management', {
        x: 1, y: 3.2, w: 8, h: 0.8,
        fontSize: 24,
        color: '005EB8',
        align: 'center',
        fontFace: 'Arial'
      });
      
      // Document title
      titleSlide.addText(title, {
        x: 1, y: 4.5, w: 8, h: 1,
        fontSize: 28,
        bold: true,
        color: '333333',
        align: 'center',
        fontFace: 'Arial'
      });
      
      // Date and branding
      titleSlide.addText(`Generated: ${new Date().toLocaleDateString('en-GB')}`, {
        x: 1, y: 5.8, w: 8, h: 0.5,
        fontSize: 16,
        color: '666666',
        align: 'center',
        fontFace: 'Arial'
      });

      // NHS tagline
      titleSlide.addText('Supporting Excellence in Primary Care', {
        x: 1, y: 6.3, w: 8, h: 0.4,
        fontSize: 14,
        color: '666666',
        align: 'center',
        fontFace: 'Arial',
        italic: true
      });

      // Parse content into logical sections
      const lines = cleanContent.split('\n').filter(line => line.trim());
      let currentSlideContent: string[] = [];
      let currentTitle = '';
      let slideCount = 0;

      const createSlide = (slideTitle: string, bulletPoints: string[]) => {
        if (bulletPoints.length === 0) return;
        
        const slide = pptx.addSlide({ masterName: 'NHS_MASTER' });
        slideCount++;
        
        // Add slide number
        slide.addText(`${slideCount}`, {
          x: 9, y: 6.8, w: 0.8, h: 0.4,
          fontSize: 12,
          color: '666666',
          align: 'center',
          fontFace: 'Arial'
        });

        // Add title with NHS styling
        slide.addText(slideTitle || `Key Points ${slideCount}`, {
          x: 1, y: 1.2, w: 8, h: 0.8,
          fontSize: 28,
          bold: true,
          color: '003087',
          fontFace: 'Arial'
        });

        // Add decorative line under title
        slide.addShape(pptx.ShapeType.line, {
          x: 1, y: 2.1, w: 2, h: 0,
          line: { color: '005EB8', width: 3 }
        });

        // Process bullet points - limit to 6 per slide for readability
        const pointsToShow = bulletPoints.slice(0, 6);
        
        if (pointsToShow.length > 0) {
          // Create bullet point text with NHS styling
          const bulletText = pointsToShow.map(point => 
            point.replace(/^[•-]\s*/, '').trim()
          ).join('\n\n');

          slide.addText(bulletText, {
            x: 1, y: 2.5, w: 8, h: 4,
            fontSize: 18,
            color: '333333',
            bullet: { type: 'bullet', style: '•' },
            lineSpacing: 24,
            fontFace: 'Arial'
          });
        }

        // If there are more than 6 points, create additional slides
        if (bulletPoints.length > 6) {
          const remainingPoints = bulletPoints.slice(6);
          createSlide(`${slideTitle} (continued)`, remainingPoints);
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;

        // Check if this is a new section/heading
        const isHeading = line === line.toUpperCase() && line.length > 5 && line.length < 80 ||
                         line.endsWith(':') && line.length < 80 ||
                         /^\d+\.\s*[A-Z]/.test(line);

        if (isHeading) {
          // Save previous slide if it has content
          if (currentTitle && currentSlideContent.length > 0) {
            createSlide(currentTitle, currentSlideContent);
          }
          
          // Start new slide
          currentTitle = line.replace(/^\d+\.\s*/, '').replace(/:$/, '');
          currentSlideContent = [];
        } else if (line.startsWith('•') || line.startsWith('-') || /^\d+\./.test(line)) {
          // This is a bullet point
          currentSlideContent.push(line);
        } else if (line.length > 10) {
          // This is regular content, treat as bullet point
          currentSlideContent.push('• ' + line);
        }
      }

      // Add the last slide
      if (currentTitle && currentSlideContent.length > 0) {
        createSlide(currentTitle, currentSlideContent);
      } else if (currentSlideContent.length > 0) {
        createSlide('Summary', currentSlideContent);
      }

      // If no structured content was found, create a simple content slide
      if (slideCount === 0) {
        const slide = pptx.addSlide({ masterName: 'NHS_MASTER' });
        slide.addText('Content Overview', {
          x: 1, y: 1.2, w: 8, h: 0.8,
          fontSize: 28,
          bold: true,
          color: '003087',
          fontFace: 'Arial'
        });

        // Add decorative line under title
        slide.addShape(pptx.ShapeType.line, {
          x: 1, y: 2.1, w: 2, h: 0,
          line: { color: '005EB8', width: 3 }
        });

        const bulletText = lines.slice(0, 8).map(line => 
          line.replace(/^[•-]\s*/, '').trim()
        ).join('\n\n');

        slide.addText(bulletText, {
          x: 1, y: 2.5, w: 8, h: 4,
          fontSize: 18,
          color: '333333',
          bullet: { type: 'bullet', style: '•' },
          lineSpacing: 24,
          fontFace: 'Arial'
        });
      }

      // Save the presentation with NHS branding
      await pptx.writeFile({ fileName: `NHS-AI4PM-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pptx` });
      console.log('NHS-styled PowerPoint presentation generated successfully');
    } catch (error) {
      console.error('Error generating PowerPoint presentation:', error);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Debug logging for messages
  console.log("DEBUG: Current messages:", messages.map(m => ({ 
    role: m.role, 
    contentLength: m.content?.length || 0,
    hasContent: !!m.content 
  })));

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      
      {/* API Key Missing Alert */}
      {(apiKeyMissing.claude || apiKeyMissing.gpt) && (
        <div className="container mx-auto px-3 py-4 sm:px-4 max-w-6xl">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">API Configuration Required</h3>
            <p className="text-yellow-700 mb-4">
              To use the AI 4 PM Service, you need to configure API keys for the AI models.
            </p>
            <div className="flex gap-2 flex-wrap">
              {apiKeyMissing.claude && (
                <p className="text-sm text-yellow-600">
                  Anthropic (Claude) API key is missing. Please contact your system administrator to configure it.
                </p>
              )}
              {apiKeyMissing.gpt && (
                <p className="text-sm text-yellow-600">
                  OpenAI (GPT-4) API key is missing. Please contact your system administrator to configure it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-3 py-2 sm:px-4 sm:py-3 max-w-7xl">
        {/* Compact mobile menu */}
        <div className="sm:hidden mb-2">
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as 'ai-service' | 'pm-genie' | 'previous-searches' | 'what-can-ai-do')}
              className="w-full h-9 rounded-md border border-border bg-card text-foreground text-sm pl-3 pr-8"
            >
              <option value="ai-service">AI</option>
              <option value="pm-genie">Genie</option>
              <option value="previous-searches">History</option>
              
              <option value="what-can-ai-do">Help</option>
            </select>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop/tablet tabs */}
          <div className="hidden sm:block">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1 h-auto p-1">
              <TabsTrigger value="ai-service" className="flex items-center gap-1 min-h-[40px] text-sm touch-manipulation">
                <MessageSquare className="h-4 w-4" />
                <span>AI Service</span>
              </TabsTrigger>
              <TabsTrigger value="pm-genie" className="flex items-center gap-1 min-h-[40px] text-sm touch-manipulation">
                <Bot className="h-4 w-4" />
                <span>PM Genie</span>
              </TabsTrigger>
              <TabsTrigger value="previous-searches" className="flex items-center gap-1 min-h-[40px] text-sm touch-manipulation">
                <History className="h-4 w-4" />
                <span>Previous Searches</span>
              </TabsTrigger>
              <TabsTrigger value="what-can-ai-do" className="flex items-center gap-1 min-h-[40px] text-sm touch-manipulation">
                <HelpCircle className="h-4 w-4" />
                <span>What can AI do?</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* AI Service Tab */}
          <TabsContent value="ai-service" className="mt-1">
            <Card className={getChatBoxHeight()}>
              <CardHeader className={`${isModelSelectorCollapsed ? 'pb-1' : 'pb-3'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                    <CardTitle className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        <span className="text-lg sm:text-xl">AI 4 PM Service</span>
                        {/* New Chat button moved here - visible on mobile */}
                        <Button
                          onClick={clearConversation}
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] px-3 touch-manipulation ml-2"
                          title="Clear conversation and start new chat"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">New Chat</span>
                          <span className="sm:hidden">New</span>
                        </Button>
                        
                        {/* Voice Chat Button in collapsed view */}
                        {!isVoiceConnected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={startVoiceChat}
                            disabled={isVoiceConnecting}
                            className="px-3 min-h-[44px] touch-manipulation ml-2"
                            title="Start voice conversation with ChatGPT"
                          >
                            {isVoiceConnecting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Mic className="h-4 w-4 mr-1" />
                            )}
                            <span className="hidden sm:inline">{isVoiceConnecting ? 'Connecting...' : 'Voice Chat'}</span>
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 flex-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={toggleVoiceMute}
                              className="px-3 min-h-[44px] touch-manipulation"
                              title={isVoiceMuted ? "Unmute audio responses" : "Mute audio responses"}
                            >
                              {isVoiceMuted ? (
                                <VolumeX className="h-4 w-4 mr-1" />
                              ) : (
                                <Volume2 className="h-4 w-4 mr-1" />
                              )}
                              <span className="hidden sm:inline">{isVoiceMuted ? 'Unmute' : 'Mute'}</span>
                            </Button>
                            <Button
                              variant={isVoiceSpeaking ? "default" : "destructive"}
                              size="sm"
                              onClick={endVoiceChat}
                              className="px-3 min-h-[44px] touch-manipulation"
                              title={isVoiceSpeaking ? "ChatGPT is speaking" : "End voice conversation"}
                            >
                              {isVoiceSpeaking ? (
                                <Volume2 className="h-4 w-4 mr-1 animate-pulse" />
                              ) : (
                                <PhoneOff className="h-4 w-4 mr-1" />
                              )}
                              <span className="hidden sm:inline">{isVoiceSpeaking ? 'Speaking...' : 'End Voice'}</span>
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {/* Collapsible Model Selector */}
                      <Collapsible 
                        open={!isModelSelectorCollapsed} 
                        onOpenChange={(open) => setIsModelSelectorCollapsed(!open)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-fit p-2 h-auto flex items-center gap-2 text-muted-foreground hover:text-foreground"
                          >
                             <span className="text-xs">
                               AI Model: {model === 'chatgpt5' ? 'Chat GPT 5.0' : model === 'gpt' ? 'GPT-4' : 'Claude'}
                             </span>
                            {isModelSelectorCollapsed ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronUp className="h-3 w-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="flex flex-col gap-4">
                            {/* Welcome message */}
                            <div className="text-center text-muted-foreground py-4">
                              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="text-lg font-medium mb-2">Welcome to AI 4 PM Service</p>
                              <p className="text-sm">Your NHS Practice Management AI Assistant</p>
                              <p className="text-xs mt-2">Ask me about NHS policies, compliance, workflows, or upload documents for analysis.</p>
                            </div>
                            
                            {/* Controls */}
                             <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                               <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1 w-fit">
                                 <select 
                                   value={model}
                                   onChange={(e) => setModel(e.target.value as 'claude' | 'gpt' | 'chatgpt5')}
                                   className="text-xs sm:text-sm font-medium bg-transparent border-none outline-none"
                                 >
                                   <option value="chatgpt5">Chat GPT 5.0</option>
                                   <option value="gpt">GPT-4</option>
                                   <option value="claude">Claude</option>
                                 </select>
                               </div>
                               
                               {/* Voice Assistant Button */}
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => setShowVoiceAgent(!showVoiceAgent)}
                                 className="text-xs flex items-center gap-2"
                               >
                                 <Mic className="h-3 w-3" />
                                 Voice Assistant
                               </Button>
                              
                              {/* Chat size controls */}
                              <div className="flex items-center gap-1 border rounded-lg p-1">
                                <Button
                                  variant={chatBoxSize === 'large' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  onClick={() => setChatBoxSize('large')}
                                  className="h-8 w-8 p-0"
                                  title="Large window"
                                >
                                  <div className="w-4 h-4 bg-current rounded-sm"></div>
                                </Button>
                                <Button
                                  variant={chatBoxSize === 'extra-large' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  onClick={() => setChatBoxSize('extra-large')}
                                  className="h-8 w-8 p-0"
                                  title="Extra large window"
                                >
                                  <div className="w-5 h-7 bg-current rounded-sm"></div>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className={`flex flex-col h-full ${messages.length === 0 && isModelSelectorCollapsed ? 'p-0' : 'p-0'}`}>
                {/* Messages */}
                <ScrollArea className={`${messages.length === 0 && isModelSelectorCollapsed ? 'h-0 p-0' : 'flex-1 p-4'}`}>
                {messages.length === 0 ? null : (
                  <div className="space-y-6">
                    {messages.reduce((acc, message, index) => {
                      const previousMessage = messages[index - 1];
                      const shouldGroup = previousMessage && 
                        previousMessage.role === message.role && 
                        message.role === 'assistant' &&
                        Math.abs(message.timestamp.getTime() - previousMessage.timestamp.getTime()) < 30000; // Group within 30 seconds
                      
                      if (shouldGroup) {
                        // Combine content with the previous message
                        const lastGroup = acc[acc.length - 1];
                        if (lastGroup) {
                          lastGroup.messages.push(message);
                        }
                      } else {
                        // Create new message group
                        acc.push({
                          key: message.id,
                          messages: [message],
                          role: message.role
                        });
                      }
                      return acc;
                    }, [] as Array<{key: string, messages: Message[], role: string}>).map((group) => (
                      <div key={group.key}>
                        {group.messages.length === 1 ? (
                          <MessageRenderer message={group.messages[0]} />
                        ) : (
                          // Render combined message for grouped assistant messages
                          <MessageRenderer 
                            message={{
                              ...group.messages[0],
                              content: group.messages.map(m => m.content).join('\n\n'),
                              files: group.messages.flatMap(m => m.files || [])
                            }} 
                          />
                        )}
                        {/* Add action buttons for AI responses */}
                        {group.role === 'assistant' && group.messages.some(m => m.content.length > 100) && (
                          <div className="space-y-3 mt-3 ml-11">
                            {/* Practice branding toggle */}
                            {practiceContext.practiceName && (
                              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                                <input
                                  type="checkbox"
                                  id="practice-branding"
                                  checked={includePracticeBranding}
                                  onChange={(e) => setIncludePracticeBranding(e.target.checked)}
                                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
                                />
                                <label htmlFor="practice-branding" className="text-sm text-muted-foreground cursor-pointer">
                                  Include practice branding ({practiceContext.practiceName}
                                  {practiceContext.logoUrl ? ' + logo' : ''})
                                </label>
                              </div>
                            )}
                            
                            {/* Export buttons */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedMessage(group.messages.length === 1 ? group.messages[0] : {
                                  ...group.messages[0],
                                  content: group.messages.map(m => m.content).join('\n\n'),
                                  files: group.messages.flatMap(m => m.files || [])
                                })}
                                className="min-h-[44px] text-xs touch-manipulation"
                              >
                                <Expand className="h-3 w-3 mr-1" />
                                Expand Full Screen
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateWordDocument(
                                  group.messages.length === 1 ? group.messages[0].content : group.messages.map(m => m.content).join('\n\n'), 
                                  'AI Generated Document'
                                )}
                                className="hidden sm:inline-flex min-h-[44px] text-xs touch-manipulation"
                              >
                                <FileDown className="h-3 w-3 mr-1" />
                                Export as Word
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generatePowerPoint(
                                  group.messages.length === 1 ? group.messages[0].content : group.messages.map(m => m.content).join('\n\n'), 
                                  'AI Generated Presentation'
                                )}
                                className="hidden sm:inline-flex min-h-[44px] text-xs touch-manipulation"
                              >
                                <Presentation className="h-3 w-3 mr-1" />
                                Create PowerPoint
                              </Button>
                            </div>
                          </div>
                        )}
                        </div>
                      ))}
                      
                      {isLoading && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="bg-muted rounded-lg p-4 border border-border">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                              <span className="text-sm text-muted-foreground">AI is thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t border-border p-4">
                   {/* Uploaded Files Display - Compact Claude-style */}
                   {uploadedFiles.length > 0 && (
                     <div className="mb-3">
                       <div className="flex flex-wrap gap-2">
                         {uploadedFiles.map((file, index) => {
                           const IconComponent = getFileTypeIcon(file.name, file.type);
                           return (
                              <div key={index} className={`flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border max-w-xs ${file.isLoading ? 'opacity-75' : ''}`}>
                                {file.isLoading ? (
                                  <Loader2 className="h-4 w-4 flex-shrink-0 text-muted-foreground animate-spin" />
                                ) : (
                                  <IconComponent className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{file.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {file.isLoading ? 'Uploading...' : `${(file.size / 1024).toFixed(1)}KB`}
                                  </div>
                                </div>
                                {!file.isLoading && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeFile(index)}
                                    className="h-6 w-6 p-0 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   )}
                  
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                          uploadedFiles.length > 0 
                            ? `📎 Files attached: ${uploadedFiles.map(f => f.name).join(', ')} - Ask me about NHS policies, compliance, or your documents...`
                            : "Ask me about NHS policies, compliance, or attach documents for analysis..."
                        }
                        className="min-h-[80px] pr-32 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        onPaste={(e) => {
                          const items = Array.from(e.clipboardData?.items || []);
                          
                          // Handle image paste
                          const imageItem = items.find(item => item.type.startsWith('image/'));
                          if (imageItem) {
                            e.preventDefault();
                            const file = imageItem.getAsFile();
                            if (file) {
                              handleFileUpload([file]);
                            }
                            return;
                          }
                          
                          // Handle large text paste
                          const textItem = items.find(item => item.type === 'text/plain');
                          if (textItem) {
                            textItem.getAsString((text) => {
                              if (text.length > 500) {
                                e.preventDefault();
                                // Create a text file from the pasted content
                                const blob = new Blob([text], { type: 'text/plain' });
                                const file = new File([blob], `Pasted text (${text.length} chars)`, { type: 'text/plain' });
                                handleFileUpload([file]);
                              }
                            });
                          }
                        }}
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        {/* Practice details insert button */}
                        {practiceDetails && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={insertPracticeDetails}
                            className="h-8 w-8 p-0 hover:bg-muted"
                            title="Insert practice details"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* File Upload Button */}
                        <div className="relative">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.xlsx,.csv,.txt,.msg,.eml"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length > 0) {
                                handleFileUpload(files);
                                e.target.value = ''; // Reset input
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 transition-all duration-300 ${
                              uploadedFiles.length > 0 
                                ? 'hover:bg-primary/10 bg-primary/5' 
                                : 'hover:bg-muted'
                            }`}
                            title="Attach files"
                          >
                            <Paperclip className={`h-4 w-4 transition-all duration-300 ${
                              uploadedFiles.length > 0 
                                ? 'text-primary scale-110' 
                                : 'text-muted-foreground'
                            }`} />
                          </Button>
                        </div>
                        
                        <SpeechToText
                          onTranscription={handleSpeechTranscription}
                          size="sm"
                          className="h-8 w-8 p-0"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                      className="h-20"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Previous Searches Tab */}
          <TabsContent value="previous-searches" className="mt-3">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Previous Searches
                </CardTitle>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={searchHistory.length === 0}
                        className="flex items-center gap-2 min-h-[44px] touch-manipulation"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Clear All Searches</span>
                        <span className="sm:hidden">Clear All</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear All Searches</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete all {searchHistory.length} saved searches? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearAllSearches} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Clear All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    onClick={saveCurrentSearch}
                    variant="outline"
                    size="sm"
                    disabled={messages.length === 0}
                    className="flex items-center gap-2 min-h-[44px] touch-manipulation"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Save Current Search</span>
                    <span className="sm:hidden">Save</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {searchHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No Previous Searches</p>
                    <p className="text-sm text-muted-foreground">
                      Start a conversation in the AI Service tab to create your first saved search.
                    </p>
                  </div>
                ) : (
                   <div className="space-y-4">
                     {searchHistory.map((search) => (
                       <div 
                         key={search.id} 
                         className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                         onClick={() => loadPreviousSearch(search.id)}
                       >
                         <div className="flex items-start justify-between">
                           <div className="flex-1 min-w-0">
                             <h3 className="font-medium text-sm mb-1 truncate">{search.title}</h3>
                             <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                               {search.brief_overview || 'No overview available'}
                             </p>
                             <div className="flex items-center gap-4 text-xs text-muted-foreground">
                               <span className="flex items-center gap-1">
                                 <Clock className="h-3 w-3" />
                                 {new Date(search.created_at).toLocaleDateString('en-GB', {
                                   day: '2-digit',
                                   month: 'short',
                                   year: 'numeric',
                                   hour: '2-digit',
                                   minute: '2-digit'
                                 })}
                               </span>
                               <span className="flex items-center gap-1">
                                 <MessageSquare className="h-3 w-3" />
                                 {search.messages.length} messages
                               </span>
                             </div>
                           </div>
                           <div className="flex gap-2 ml-4">
                             <Button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 deleteSearch(search.id);
                               }}
                               variant="outline"
                               size="sm"
                               className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                             >
                               <Trash2 className="h-3 w-3" />
                             </Button>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

                        <Button
                          variant={model === 'gpt' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setModel('gpt')}
                          className="flex-1 min-h-[44px] touch-manipulation"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          GPT-4 (OpenAI)
                        </Button>
                         <Button
                           variant="secondary"
                           size="sm"
                           onClick={handleNewMeeting}
                           className="px-3 min-h-[44px] touch-manipulation"
                           title="Start a new conversation"
                         >
                           <Plus className="h-4 w-4 mr-1" />
                           <span className="hidden sm:inline">New Chat</span>
                           <span className="sm:hidden">New</span>
                         </Button>
                         
                         {/* Voice Chat Button in collapsed view */}
                         {!isVoiceConnected ? (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={startVoiceChat}
                             disabled={isVoiceConnecting}
                             className="px-3 min-h-[44px] touch-manipulation"
                             title="Start voice conversation with ChatGPT"
                           >
                             {isVoiceConnecting ? (
                               <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                             ) : (
                               <Mic className="h-4 w-4 mr-1" />
                             )}
                              <span className="hidden sm:inline">{isVoiceConnecting ? 'Connecting...' : 'Voice Chat'}</span>
                           </Button>
                          ) : (
                            <div className="flex items-center gap-1 flex-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleVoiceMute}
                                className="px-3 min-h-[44px] touch-manipulation"
                                title={isVoiceMuted ? "Unmute audio responses" : "Mute audio responses"}
                              >
                                {isVoiceMuted ? (
                                  <VolumeX className="h-4 w-4 mr-1" />
                                ) : (
                                  <Volume2 className="h-4 w-4 mr-1" />
                                )}
                                <span className="hidden sm:inline">{isVoiceMuted ? 'Unmute' : 'Mute'}</span>
                              </Button>
                              <Button
                                variant={isVoiceSpeaking ? "default" : "destructive"}
                                size="sm"
                                onClick={endVoiceChat}
                                className="px-3 min-h-[44px] touch-manipulation"
                                title={isVoiceSpeaking ? "ChatGPT is speaking" : "End voice conversation"}
                              >
                                {isVoiceSpeaking ? (
                                  <Volume2 className="h-4 w-4 mr-1 animate-pulse" />
                                ) : (
                                  <PhoneOff className="h-4 w-4 mr-1" />
                                )}
                              <span className="hidden sm:inline">{isVoiceSpeaking ? 'Speaking...' : 'End Voice'}</span>
                              </Button>
                            </div>
                          )}
                        
                        {/* Voice Chat Button */}
                        {!isVoiceConnected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={startVoiceChat}
                            disabled={isVoiceConnecting}
                            className="px-3 min-h-[44px] touch-manipulation"
                            title="Start voice conversation with ChatGPT"
                          >
                            {isVoiceConnecting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Mic className="h-4 w-4 mr-1" />
                            )}
                            <span className="hidden sm:inline">{isVoiceConnecting ? 'Connecting...' : 'Voice Chat'}</span>
                            <span className="sm:hidden">{isVoiceConnecting ? '...' : 'Voice'}</span>
                          </Button>
                        ) : (
                          <Button
                            variant={isVoiceSpeaking ? "default" : "destructive"}
                            size="sm"
                            onClick={endVoiceChat}
                            className="px-3 min-h-[44px] touch-manipulation"
                            title={isVoiceSpeaking ? "ChatGPT is speaking" : "End voice conversation"}
                          >
                            {isVoiceSpeaking ? (
                              <Volume2 className="h-4 w-4 mr-1 animate-pulse" />
                            ) : (
                              <PhoneOff className="h-4 w-4 mr-1" />
                            )}
                            <span className="hidden sm:inline">{isVoiceSpeaking ? 'Speaking...' : 'End Voice'}</span>
                            <span className="sm:hidden">{isVoiceSpeaking ? '...' : 'End'}</span>
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Choose your preferred AI model. Claude excels at detailed analysis, while GPT-4 is great for creative content.
                      </p>
                    </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Session Memory</Label>
                      <p className="text-xs text-muted-foreground">
                        Keep conversation context across messages
                      </p>
                    </div>
                    <Switch
                      checked={sessionMemory}
                      onCheckedChange={setSessionMemory}
                    />
                  </div>
                  
                  <Separator />
                  
                  {practiceContext.practiceName && (
                    <>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Practice Context
                        </Label>
                        <div className="space-y-1 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                          <div><strong>Practice:</strong> {practiceContext.practiceName}</div>
                          {practiceContext.practiceManagerName && (
                            <div><strong>Manager:</strong> {practiceContext.practiceManagerName}</div>
                          )}
                          {practiceContext.pcnName && (
                            <div><strong>PCN:</strong> {practiceContext.pcnName}</div>
                          )}
                          {practiceContext.neighbourhoodName && (
                            <div><strong>Neighbourhood:</strong> {practiceContext.neighbourhoodName}</div>
                          )}
                          {practiceContext.otherPracticesInPCN && practiceContext.otherPracticesInPCN.length > 0 && (
                            <div><strong>Other PCN Practices:</strong> {practiceContext.otherPracticesInPCN.join(', ')}</div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          AI will use this context to provide personalized responses
                        </p>
                      </div>
                      
                      <Separator />
                    </>
                  )}
                  
                  
                  <div className="space-y-2">
                    <Label>Conversation Management</Label>
                    <Button
                      onClick={clearConversation}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Current Conversation
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This will remove all messages and uploaded files from the current session.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat with PM Genie Tab - ElevenLabs Voice Agent */}
          <TabsContent value="pm-genie" className="mt-3">
            <PMGenieVoiceAgent />
          </TabsContent>

          {/* What Can AI Do Tab */}
          <TabsContent value="what-can-ai-do" className="mt-3">
            <div className="space-y-6">
              {/* Overview Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    What can AI do for me?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed">
                    The AI 4 PM Service offers two powerful ways to get expert assistance: traditional text-based chat through the AI Service tab, 
                    and our new revolutionary voice conversation feature with PM Genie. Both are designed specifically for NHS GP Practice Managers, 
                    combining deep knowledge of NHS policies, CQC requirements, and practice operations with cutting-edge AI capabilities.
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Bot className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-sm mb-1">AI-Powered Analysis</h4>
                      <p className="text-xs text-muted-foreground">Smart document analysis and insights</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Mic className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-sm mb-1">Voice Conversations</h4>
                      <p className="text-xs text-muted-foreground">Natural speech with PM Genie voice assistant</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-sm mb-1">NHS Compliant</h4>
                      <p className="text-xs text-muted-foreground">Built-in knowledge of NHS policies and CQC</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-sm mb-1">Time Saving</h4>
                      <p className="text-xs text-muted-foreground">Automate routine tasks and analysis</p>
                    </div>
                  </div>
                </CardContent>
                </Card>

              {/* Chat with PM Genie Feature */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    Chat with PM Genie - Voice AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed">
                    Experience the future of practice management with PM Genie, our revolutionary voice AI assistant. 
                    Have natural conversations about NHS policies, CQC compliance, and daily operations - just like talking to an expert colleague.
                  </p>
                  
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-2 text-primary">🎯 Why Voice Conversations Are Game-Changing:</h4>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• <strong>Hands-free operation</strong> - Perfect for busy practice managers on the go</li>
                      <li>• <strong>Natural communication</strong> - Explain complex scenarios as if talking to a colleague</li>
                      <li>• <strong>Instant responses</strong> - No typing delays, get immediate voice feedback</li>
                      <li>• <strong>Multi-tasking friendly</strong> - Continue with other tasks while conversing</li>
                      <li>• <strong>Accessibility focused</strong> - Ideal for visual impairments or typing difficulties</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">How It Works:</h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                          <div>
                            <p className="text-xs font-medium">Grant microphone access</p>
                            <p className="text-xs text-muted-foreground">One-time setup for voice conversations</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                          <div>
                            <p className="text-xs font-medium">Start conversation</p>
                            <p className="text-xs text-muted-foreground">Click "Start Conversation" to connect</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                          <div>
                            <p className="text-xs font-medium">Speak naturally</p>
                            <p className="text-xs text-muted-foreground">Ask questions as you would to a colleague</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                          <div>
                            <p className="text-xs font-medium">Get instant voice replies</p>
                            <p className="text-xs text-muted-foreground">PM Genie responds with expert advice</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Perfect For:</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>Quick CQC compliance questions during inspections</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>Complex policy clarifications while multitasking</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>Urgent guidance during practice meetings</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>Learning NHS procedures through conversation</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>Brainstorming solutions to practice challenges</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-800">
                      <strong>💡 Pro Tip:</strong> Use voice conversations for initial exploration and complex discussions, 
                      then switch to the AI Service tab for document analysis and detailed written responses you can save or share.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Top 10 Use Cases */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Ways Practice Managers Use AI</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        icon: FileText,
                        title: "Document Analysis",
                        description: "Upload CQC reports, policies, or letters for instant analysis and action points",
                        example: "Upload a CQC inspection letter to identify required actions and timelines"
                      },
                      {
                        icon: Mail,
                        title: "Professional Email Drafting",
                        description: "Generate NHS-compliant responses to patient complaints or CCG communications",
                        example: "Draft a response to a patient complaint about appointment availability"
                      },
                      {
                        icon: CheckSquare,
                        title: "SOP Creation",
                        description: "Create standard operating procedures for common practice workflows",
                        example: "Generate an SOP for new patient registration process"
                      },
                      {
                        icon: Shield,
                        title: "CQC Compliance Checks",
                        description: "Identify CQC requirements and prepare for inspections",
                        example: "Check if practice policies meet current CQC Key Lines of Enquiry"
                      },
                      {
                        icon: TrendingUp,
                        title: "Financial Analysis",
                        description: "Analyze practice finances, PCN funding, and ARRS opportunities",
                        example: "Review practice budget and identify potential cost savings"
                      },
                      {
                        icon: Users,
                        title: "Staff Management",
                        description: "Create job descriptions, policies, and training materials",
                        example: "Generate a job description for a new practice nurse position"
                      },
                      {
                        icon: Calendar,
                        title: "Meeting Preparation",
                        description: "Create agendas, minutes templates, and action plans",
                        example: "Prepare agenda for monthly practice meeting with partners"
                      },
                      {
                        icon: AlertTriangle,
                        title: "Risk Assessment",
                        description: "Identify potential risks and compliance issues in documents",
                        example: "Review new practice policy for potential compliance risks"
                      },
                      {
                        icon: BookOpen,
                        title: "Policy Development",
                        description: "Draft practice policies aligned with NHS and CQC requirements",
                        example: "Create a new data protection policy for patient information"
                      },
                      {
                        icon: MessageSquare,
                        title: "Training Material Creation",
                        description: "Generate training content for staff on various topics",
                        example: "Create training materials on infection prevention and control"
                      }
                    ].map((useCase, index) => (
                      <div key={index} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <useCase.icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1">{useCase.title}</h4>
                            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                              {useCase.description}
                            </p>
                            <div className="bg-muted/50 p-2 rounded text-xs">
                              <strong>Example:</strong> {useCase.example}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* How It Works */}
              <Card>
                <CardHeader>
                  <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">1</div>
                      <h4 className="font-medium text-sm mb-1">Ask or Upload</h4>
                      <p className="text-xs text-muted-foreground">Type your question or upload documents for analysis</p>
                    </div>
                    <div className="text-center">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">2</div>
                      <h4 className="font-medium text-sm mb-1">AI Analysis</h4>
                      <p className="text-xs text-muted-foreground">AI processes your request using NHS knowledge base</p>
                    </div>
                    <div className="text-center">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">3</div>
                      <h4 className="font-medium text-sm mb-1">Smart Response</h4>
                      <p className="text-xs text-muted-foreground">Get detailed, NHS-compliant answers and recommendations</p>
                    </div>
                    <div className="text-center">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">4</div>
                      <h4 className="font-medium text-sm mb-1">Take Action</h4>
                      <p className="text-xs text-muted-foreground">Copy, save, or implement the AI-generated content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Full Screen Message Modal */}
      <Dialog open={!!expandedMessage} onOpenChange={(open) => !open && setExpandedMessage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Response - Full Screen View
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedMessage(null)}
              className="h-8 w-8 p-0"
            >
              <Minimize className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full max-h-[calc(95vh-120px)]">
              <div className="p-4">
                {expandedMessage && (
                  <MessageRenderer message={expandedMessage} disableTruncation={true} />
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Action buttons for expanded view */}
          {expandedMessage && (
            <div className="border-t pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(expandedMessage.content);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateWordDocument(expandedMessage.content, 'AI Generated Document')}
                  className="hidden sm:inline-flex"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export as Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generatePowerPoint(expandedMessage.content, 'AI Generated Presentation')}
                  className="hidden sm:inline-flex"
                >
                  <Presentation className="h-4 w-4 mr-2" />
                  Create PowerPoint
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Voice Agent Modal */}
      {showVoiceAgent && (
        <Dialog open={showVoiceAgent} onOpenChange={setShowVoiceAgent}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Voice Assistant</DialogTitle>
            </DialogHeader>
            <PMGenieVoiceAgent />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AI4PMService;