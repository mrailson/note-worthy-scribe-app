import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SafeMessageRenderer } from './SafeMessageRenderer';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  Minus,
  Image,
  Type,
  X,
  Loader2,
  Activity,
  FileHeart,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Volume2, VolumeX } from 'lucide-react';
import { SpeechToText } from '@/components/SpeechToText';
import MessageRenderer from '@/components/MessageRenderer';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { toast } from 'sonner';

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

const SUPPORTED_VOICES = ["alloy","ash","ballad","coral","echo","sage","shimmer","verse"] as const;

type SupportedVoice = typeof SUPPORTED_VOICES[number];

const AI4GPService = () => {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<'claude' | 'gpt' | 'chatgpt5'>('chatgpt5');
  const [sessionMemory, setSessionMemory] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [apiKeyMissing, setApiKeyMissing] = useState<{claude: boolean, gpt: boolean}>({claude: false, gpt: false});
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [practiceContext, setPracticeContext] = useState<PracticeContext>({});
  const [chatBoxSize, setChatBoxSize] = useState('default');
  const [includePracticeBranding, setIncludePracticeBranding] = useState(true);
  const [practiceDetails, setPracticeDetails] = useState<any>(null);
  const [showVoiceAgent, setShowVoiceAgent] = useState(false);
  const [includeLatestUpdates, setIncludeLatestUpdates] = useState(true);
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<SupportedVoice>('ballad');
  const voiceChatRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    // Only scroll if the chat container is visible and has content
    if (messagesEndRef.current && messages.length > 0) {
      const chatContainer = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]');
      if (chatContainer) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  useEffect(() => {
    // Only auto-scroll if there are actual messages and component is visible
    if (messages.length > 0) {
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

  // Set up file input event listener
  useEffect(() => {
    const fileInput = fileInputRef.current;
    if (fileInput) {
      fileInput.addEventListener('change', handleFileSelect);
      
      return () => {
        fileInput.removeEventListener('change', handleFileSelect);
      };
    }
  }, []);

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
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSearchHistory((data || []).map(item => ({
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

  const nhsSafetyPreamble = "You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology.";

  const quickActions = [
    { 
      label: 'NICE Guidance Finder', 
      icon: BookOpen, 
      prompt: `${nhsSafetyPreamble} Summarise NICE guidance [insert NG/CG number or condition] for GP use. Include: key diagnostic criteria, first-line and step-up treatments, relevant referral triggers, and monitoring recommendations. Cite the latest NICE update date.`,
      requiresFile: false 
    },
    { 
      label: 'BNF Drug Lookup', 
      icon: Shield, 
      prompt: `${nhsSafetyPreamble} Provide a concise BNF summary for [insert drug name] including: adult dosing range, titration guidance, renal/hepatic adjustments, major interactions, contraindications, and common adverse effects.`,
      requiresFile: false 
    },
    { 
      label: 'Red Flag Symptom Checker', 
      icon: AlertTriangle, 
      prompt: `${nhsSafetyPreamble} List red flag symptoms for [insert symptom/condition] that require urgent or 2WW referral according to NICE/NHS pathways. Include pathway names and recommended referral timeframes.`,
      requiresFile: false 
    },
    { 
      label: 'Referral Criteria & Forms', 
      icon: FileText, 
      prompt: `${nhsSafetyPreamble} Provide referral criteria and process for [insert specialty/condition] in [insert local area or ICB], including NHS eRS form links, local service inclusion/exclusion criteria, and relevant NICE guidance.`,
      requiresFile: false 
    },
    { 
      label: 'QOF Indicator Quick Check', 
      icon: CheckSquare, 
      prompt: `${nhsSafetyPreamble} Summarise the QOF indicators for [insert condition] for 2025/26. Include indicator codes, thresholds, recall rules, and exception reporting criteria. Focus on what a GP practice team needs to know.`,
      requiresFile: false 
    },
    { 
      label: 'Patient Leaflet Finder', 
      icon: HelpCircle, 
      prompt: `${nhsSafetyPreamble} Find and summarise an NHS-approved patient information leaflet for [insert condition/treatment]. Include plain-English summary, NHS.uk link, and a printable PDF link if available.`,
      requiresFile: false 
    },
    { 
      label: 'Immunisation Schedule Lookup', 
      icon: Activity, 
      prompt: `${nhsSafetyPreamble} Provide the current UK vaccination schedule for [insert age/risk group] according to Green Book/NHS guidance. Include vaccine names, doses, intervals, and special considerations.`,
      requiresFile: false 
    },
    { 
      label: 'Primary Care Prescribing Alerts', 
      icon: TrendingUp, 
      prompt: `${nhsSafetyPreamble} List the most recent MHRA/NHS prescribing safety alerts relevant to primary care in [insert month/year]. Include drug name, nature of alert, key GP actions, and link to official notice.`,
      requiresFile: false 
    },
    { 
      label: 'Fit Note Wording Helper', 
      icon: FileHeart, 
      prompt: `${nhsSafetyPreamble} Suggest concise, clinically appropriate fit note wording for a patient with [insert condition/procedure]. Include expected duration, recommended work adjustments, and review advice.`,
      requiresFile: false 
    },
    { 
      label: 'Practice Policy & Protocol Finder', 
      icon: Settings, 
      prompt: `${nhsSafetyPreamble} Search for the local or PCN protocol on [insert topic] and summarise the key steps. Include source document link and any NHS/national guidance references.`,
      requiresFile: false 
    },
    { 
      label: 'Complaint Response Helper', 
      icon: MessageSquare, 
      prompt: `${nhsSafetyPreamble} 

ROLE: UK NHS GP practice complaints response assistant.

OBJECTIVE: Gather facts, confirm understanding, then generate three outputs: (A) patient reply, (B) staff communication (if practice-based complaint), (C) lessons learnt & improvement plan.

IF ATTACHMENTS/EVIDENCE PROVIDED: First, extract a concise evidence summary and a dated chronology. Identify key issues raised, any policy references, and any clinical/admin touchpoints.

INTERVIEW (ask one set at a time, wait for answers):
1) Who is making the complaint (patient, representative, staff)?
2) Short summary of the main issue in their words.
3) Date(s)/time(s) of incident(s); location/service.
4) People involved (roles only; avoid attributing blame).
5) What actions have been taken so far?
6) What outcome is the complainant seeking?
7) Any related policies/guidance or records to reference?
8) Any learning/change already identified?

CONFIRMATION: Restate facts and obtain confirmation before drafting.

OUTPUTS (use headings):
A) Patient Reply (empathetic, addresses each point, explains findings, apologises where appropriate, states actions taken/planned, timelines, and signposts escalation e.g., PALS/Ombudsman).
B) Staff Communication (constructive, fact-focused, supportive tone; include next steps, supervision/learning actions; avoid blame).
C) Lessons Learnt & Improvement Plan (bullet points suitable for CQC evidence: root cause themes, process/policy/training/IT changes, owners, target dates, how to audit effectiveness).

STYLE: Plain English, culturally sensitive, trauma-informed, non-defensive. Use GP-practice context. Provide a short version and an expanded version for each output.`,
      requiresFile: true 
    },
  ];

  const buildSystemPrompt = () => {
    let prompt = `You are "AI 4 GP Service", an AI Assistant built specifically to help General Practitioners (GPs) in the UK NHS.

You understand and can explain:
- Clinical guidelines (NICE, SIGN, local protocols)
- Primary care workflows and consultation management
- Clinical coding, Read codes, SNOMED CT
- QOF indicators and clinical quality measures
- Prescribing guidance and drug interactions
- Referral pathways and secondary care liaison
- Clinical audit and quality improvement
- Patient safety and risk management
- Always stay professional, evidence-based, and clinically appropriate

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
      
      prompt += `\n\nWhen relevant to queries, you can reference this practice information to provide more personalized and contextual responses.`;
    }

    prompt += `\n\nKnowledge domains you should reference:
1. Clinical Guidelines (NICE, SIGN, specialty-specific protocols)
2. Primary Care Operations (consultation management, clinical workflows)
3. Clinical Coding & Documentation (Read codes, SNOMED CT, clinical templates)
4. Quality & Safety (QOF, clinical audit, patient safety incidents)
5. Prescribing & Therapeutics (BNF, drug interactions, safety alerts)
6. Referral Management (secondary care pathways, urgent referrals)

SPECIAL CAPABILITIES:
- Clinical Document Generation: When asked to create clinical documents, format your response with clear headings, sections, and structured content appropriate for healthcare settings.
- File Analysis: When files are uploaded by the user, you have access to their full content and can analyze, summarize, and answer questions about them directly.
${includeLatestUpdates ? '- Web Search: You have access to current web search capabilities for the latest NHS guidance, policy updates, and clinical developments. Use this when users ask about recent changes, current guidance, or up-to-date information.' : ''}

Always provide evidence-based, clinically appropriate advice that follows current NHS guidelines and best practices.`;

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

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt();
      
      // Prepare messages for API
      const messagesForAPI = newMessages.map(msg => {
        let content = msg.content;
        
        // Add file contents to the message if present
        if (msg.files && msg.files.length > 0) {
          const fileContents = msg.files.map(file => 
            `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
          ).join('');
          content += fileContents;
        }
        
        return {
          role: msg.role,
          content: content
        };
      });

      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: {
          messages: messagesForAPI,
          model: model,
          systemPrompt: systemPrompt,
          files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
          enableWebSearch: includeLatestUpdates
        }
      });

      if (error) {
        if (error.message?.includes('API key')) {
          setApiKeyMissing(prev => ({ ...prev, [model]: true }));
          throw new Error(`${model.toUpperCase()} API key is missing. Please contact your administrator.`);
        }
        throw error;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || data.response || 'No response received',
        timestamp: new Date(),
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      
      // Auto-save the search
      await saveSearchAutomatically(finalMessages);

    } catch (error: any) {
      console.error('Error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSearchAutomatically = async (messagesData: Message[]) => {
    if (!user || messagesData.length === 0) return;

    try {
      // Generate title from first user message
      const firstUserMessage = messagesData.find(m => m.role === 'user');
      const title = firstUserMessage?.content.substring(0, 50) + (firstUserMessage?.content.length > 50 ? '...' : '') || 'Untitled Search';
      
      // Generate brief overview from AI responses
      const aiMessages = messagesData.filter(m => m.role === 'assistant');
      const overview = aiMessages.length > 0 
        ? aiMessages[0].content.substring(0, 100) + (aiMessages[0].content.length > 100 ? '...' : '')
        : 'No AI response';

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

  const handleFileSelect = useCallback(async (event: Event) => {
    // Prevent any default behavior that might cause navigation
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    
    try {
      const filePromises = Array.from(files).map(async (file) => {
        // Add file type validation
        const validTypes = ['.pdf', '.doc', '.docx', '.rtf', '.txt', '.eml', '.msg', '.jpg', '.jpeg', '.png', '.wav', '.mp3', '.m4a'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!validTypes.includes(fileExtension)) {
          throw new Error(`Unsupported file type: ${file.name}`);
        }
        
        // Add file size validation (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File too large: ${file.name} (max 10MB)`);
        }
        
        const reader = new FileReader();
        
        return new Promise<UploadedFile>((resolve, reject) => {
          reader.onload = () => {
            try {
              const content = reader.result as string;
              resolve({
                name: file.name,
                type: file.type,
                content: content,
                size: file.size,
                isLoading: false
              });
            } catch (error) {
              reject(new Error(`Failed to process ${file.name}: ${error.message}`));
            }
          };
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          
          // Use readAsText for text files, readAsDataURL for binary files
          if (['.jpg', '.jpeg', '.png', '.wav', '.mp3', '.m4a'].includes(fileExtension)) {
            reader.readAsDataURL(file);
          } else {
            reader.readAsText(file);
          }
        });
      });

      const processedFiles = await Promise.all(filePromises);
      setUploadedFiles(prev => [...prev, ...processedFiles]);
      toast.success(`${processedFiles.length} file(s) uploaded successfully`);
      
      // Clear the input
      target.value = '';
    } catch (error) {
      console.error('Error processing files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process files';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNewSearch = () => {
    setMessages([]);
    setUploadedFiles([]);
    setInput('');
  };

  // Export: Word document
  const generateWordDocument = async (content: string, title: string = 'AI Generated Document') => {
    try {
      // Function to clean markdown formatting from text
      const cleanMarkdown = (text: string): string => {
        return text
          .replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // Remove triple asterisks (bold+italic)
          .replace(/\*\*([^*]+)\*\*/g, '$1')     // Remove double asterisks (bold)
          .replace(/\*([^*]+)\*/g, '$1')         // Remove single asterisks (italic)
          .replace(/`([^`]+)`/g, '$1')           // Remove backticks (code)
          .replace(/#{1,6}\s+/g, '')             // Remove heading markers
          .trim();
      };

      // Function to process text with inline formatting (bold, italic, code, links)
      const processFormattedText = (text: string) => {
        const children: any[] = [];
        
        // Clean the text first to remove any stray markdown
        const cleanedText = cleanMarkdown(text);
        
        // Enhanced pattern to handle bold, italic, code, and URLs
        const formatPattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|https?:\/\/[^\s]+)/g;
        let lastIndex = 0;
        let match;
        
        while ((match = formatPattern.exec(text)) !== null) {
          // Add any plain text before this match
          if (match.index > lastIndex) {
            const plainText = text.substring(lastIndex, match.index);
            if (plainText) {
              children.push(new TextRun({
                text: cleanMarkdown(plainText),
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
          // Handle URLs
          else if (matchedText.match(/^https?:\/\//)) {
            children.push(new ExternalHyperlink({
              children: [new TextRun({
                text: matchedText,
                size: 24,
                color: "0563C1", // Blue color for links
                underline: {}
              })],
              link: matchedText
            }));
          }
          
          lastIndex = formatPattern.lastIndex;
        }
        
        // Add any remaining plain text after the last match
        if (lastIndex < text.length) {
          const remainingText = text.substring(lastIndex);
          if (remainingText) {
            children.push(new TextRun({
              text: cleanMarkdown(remainingText),
              size: 24
            }));
          }
        }
        
        return children.length > 0 ? children : [new TextRun({ text: cleanedText, size: 24 })];
      };

      // Function to detect and parse markdown tables
      const parseTable = (lines: string[], startIndex: number): { table: Table; endIndex: number } | null => {
        const tableLines: string[] = [];
        let currentIndex = startIndex;
        
        // Collect all table lines
        while (currentIndex < lines.length) {
          const line = lines[currentIndex].trim();
          if (line.includes('|')) {
            tableLines.push(line);
            currentIndex++;
          } else {
            break;
          }
        }
        
        if (tableLines.length < 2) return null;
        
        // Remove separator line (usually second line with dashes)
        const separatorIndex = tableLines.findIndex(line => /^[\|\s\-:]+$/.test(line));
        if (separatorIndex !== -1) {
          tableLines.splice(separatorIndex, 1);
        }
        
        // Parse table data
        const tableData = tableLines.map(line => {
          return line.split('|')
            .map(cell => cleanMarkdown(cell.trim()))
            .filter(cell => cell !== ''); // Remove empty cells from start/end
        });
        
        if (tableData.length === 0) return null;
        
        // Create table rows
        const tableRows = tableData.map((rowData, rowIndex) => {
          const isHeader = rowIndex === 0;
          
          return new TableRow({
            children: rowData.map(cellText => 
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({
                    text: cellText,
                    bold: isHeader,
                    size: isHeader ? 26 : 24
                  })]
                })],
                width: { size: 100 / rowData.length, type: WidthType.PERCENTAGE },
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                shading: isHeader ? { fill: "E5E7EB" } : undefined
              })
            )
          });
        });
        
        const table = new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          }
        });
        
        return { table, endIndex: currentIndex };
      };

      const paragraphs = [
        new Paragraph({ 
          children: [new TextRun({ text: title, bold: true, size: 28 })],
          spacing: { after: 300 }
        })
      ];
      
      // Parse content into formatted paragraphs and tables
      const lines = content.split('\n');
      let i = 0;
      
      while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
          i++;
          continue;
        }
        
        // Check if this is the start of a table
        if (trimmedLine.includes('|') && i < lines.length - 1) {
          const tableResult = parseTable(lines, i);
          if (tableResult) {
            paragraphs.push(tableResult.table as any);
            // Add spacing after table
            paragraphs.push(new Paragraph({ 
              children: [new TextRun({ text: "", size: 12 })],
              spacing: { after: 200 }
            }));
            i = tableResult.endIndex;
            continue;
          }
        }
        
        // Check if line is a heading
        const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const headingLevel = headingMatch[1].length;
          const headingText = cleanMarkdown(headingMatch[2]);
          
          // Map markdown heading levels to Word heading levels
          const headingLevelMap = {
            1: HeadingLevel.HEADING_1,
            2: HeadingLevel.HEADING_2,
            3: HeadingLevel.HEADING_3,
            4: HeadingLevel.HEADING_4,
            5: HeadingLevel.HEADING_5,
            6: HeadingLevel.HEADING_6
          };
          
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: headingText, bold: true, size: 28 - (headingLevel * 2) })],
              heading: headingLevelMap[headingLevel as keyof typeof headingLevelMap] || HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 200 }
            })
          );
        } else {
          // Regular paragraph with formatting
          paragraphs.push(
            new Paragraph({
              children: processFormattedText(trimmedLine),
              spacing: { after: 200 }
            })
          );
        }
        
        i++;
      }

      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title}.docx`);
      toast.success('Word document exported successfully');
    } catch (e) {
      console.error('Word export failed', e);
      toast.error('Failed to export Word document');
    }
  };

  // Export: PowerPoint
  const generatePowerPoint = async (content: string, title: string = 'AI Generated Presentation') => {
    try {
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      slide.addText(title, { x: 0.5, y: 0.5, fontSize: 24, bold: true });
      slide.addText(content, { x: 0.5, y: 1.1, w: 9, h: 5, fontSize: 14, valign: 'top' });
      await pptx.writeFile({ fileName: `${title}.pptx` });
    } catch (e) {
      console.error('PPT export failed', e);
    }
  };

  // Voice: Realtime ChatGPT voice integration
  const voiceSessionRef = useRef<string | null>(null);
  
  const handleVoiceMessage = (event: any) => {
    console.log('Voice event:', event.type, event);
    
    // Track assistant speaking audio
    if (event.type === 'response.audio.delta') {
      setIsVoiceSpeaking(true);
      return;
    }
    if (event.type === 'response.audio.done') {
      setIsVoiceSpeaking(false);
      return;
    }

    // When a new response starts, create a new session ID
    if (event.type === 'response.created') {
      voiceSessionRef.current = `voice-session-${Date.now()}`;
      console.log('New voice session created:', voiceSessionRef.current);
      return;
    }

    // Streamed assistant transcript
    if (event.type === 'response.audio_transcript.delta') {
      console.log('Voice transcript delta:', event.delta);
      
      // Ensure we have a session ID
      if (!voiceSessionRef.current) {
        voiceSessionRef.current = `voice-session-${Date.now()}`;
      }
      
      setMessages(prev => {
        const last = prev[prev.length - 1];
        // Check if last message is from the same voice session
        if (last && last.role === 'assistant' && last.id === voiceSessionRef.current) {
          console.log('Appending to existing voice message');
          return [...prev.slice(0, -1), { ...last, content: last.content + event.delta }];
        }
        
        console.log('Creating new voice message with session ID:', voiceSessionRef.current);
        // Create new voice response with consistent session ID
        return [
          ...prev,
          { 
            id: voiceSessionRef.current, 
            role: 'assistant', 
            content: event.delta, 
            timestamp: new Date() 
          }
        ];
      });
      return;
    }

    // Assistant transcript completed
    if (event.type === 'response.audio_transcript.done') {
      console.log('Voice transcript completed');
      // Don't change anything - let grouping logic handle it
      return;
    }

    // Response fully done - reset session for next response
    if (event.type === 'response.done') {
      console.log('Voice response fully done, clearing session');
      voiceSessionRef.current = null;
      return;
    }

    // User voice recognized
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = event.transcript || '';
      if (transcript.trim()) {
        setMessages(prev => [
          ...prev,
          { id: `voice-user-${Date.now()}`, role: 'user', content: transcript, timestamp: new Date() }
        ]);
      }
      return;
    }
  };
  const startVoiceChat = async () => {
    try {
      setIsVoiceConnecting(true);
      await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChatRef.current = new RealtimeChat(handleVoiceMessage);
      await voiceChatRef.current.init(selectedVoice, 'Hello, how can I help?');
      if (isVoiceMuted) {
        voiceChatRef.current.setMuted(true);
      }
      setIsVoiceConnected(true);
    } catch (error) {
      console.error('Voice chat error:', error);
    } finally {
      setIsVoiceConnecting(false);
    }
  };

  const endVoiceChat = () => {
    voiceChatRef.current?.disconnect();
    setIsVoiceConnected(false);
    setIsVoiceSpeaking(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
        
        {/* Search History Sidebar */}
        {searchHistory.length > 0 && showSearchHistory && (
          <div className="lg:w-64 flex-shrink-0">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Previous Searches
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSearchHistory(false)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  <div className="space-y-2 p-3">
                    {searchHistory.map((search) => (
                      <div
                        key={search.id}
                        className="p-3 text-xs border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setMessages(search.messages);
                          toast.success('Previous search loaded');
                        }}
                      >
                        <div className="font-medium mb-1 line-clamp-2">{search.title}</div>
                        {search.brief_overview && (
                          <div className="text-muted-foreground line-clamp-2 mb-1">
                            {search.brief_overview}
                          </div>
                        )}
                        <div className="text-muted-foreground">
                          {new Date(search.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Chat Interface */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Bot className="h-6 w-6 text-primary mr-2" />
                  AI4GP - Clinical Assistant
                </CardTitle>
                <div className="flex items-center gap-2">
                  {searchHistory.length > 0 && !showSearchHistory && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSearchHistory(true)}
                      className="text-xs"
                    >
                      <History className="h-3 w-3 mr-1" />
                      History
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                     {/* Hidden: Include latest web updates option
                     <div className="flex items-center gap-2">
                       <Switch
                         id="include-latest"
                         checked={includeLatestUpdates}
                         onCheckedChange={setIncludeLatestUpdates}
                       />
                       <Label htmlFor="include-latest" className="text-xs text-muted-foreground">
                         Include latest web updates
                       </Label>
                     </div>
                     */}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={isVoiceConnected ? endVoiceChat : startVoiceChat}
                      className="text-xs"
                      title={isVoiceConnected ? 'End live talk session' : 'Start live talk session'}
                    >
                      <Mic className="h-3 w-3 mr-1" />
                      {isVoiceConnected ? 'End Live Talk' : (isVoiceConnecting ? 'Connecting…' : 'Live Talk')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = !isVoiceMuted;
                        setIsVoiceMuted(next);
                        voiceChatRef.current?.setMuted(next);
                      }}
                      className="text-xs"
                      title={isVoiceMuted ? 'Unmute AI voice output' : 'Mute AI voice output'}
                      disabled={!isVoiceConnected && !isVoiceConnecting}
                    >
                      {isVoiceMuted ? <VolumeX className="h-3 w-3 mr-1" /> : <Volume2 className="h-3 w-3 mr-1" />}
                      {isVoiceMuted ? 'Muted' : 'Mute'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleNewSearch}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New Search
                    </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                 <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-4">
                        <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <h3 className="font-semibold text-lg mb-1">Welcome to AI4GP</h3>
                        <p className="text-muted-foreground max-w-md mx-auto mb-6">
                          Your AI assistant for clinical guidance, protocol development, and evidence-based practice support.
                        </p>
                        
                        {/* Quick Actions within welcome message */}
                        <div className="max-w-4xl mx-auto">
                          <h4 className="text-sm font-medium mb-4 text-muted-foreground">Get started with these common queries:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {quickActions.slice(0, showAllQuickActions ? quickActions.length : 6).map((action, index) => {
                              const Icon = action.icon;
                              return (
                                <Button
                                  key={index}
                                  variant="outline"
                                  className="h-20 p-3 text-left justify-start hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 overflow-hidden"
                                  onClick={() => setInput(action.prompt)}
                                >
                                  <div className="flex items-start gap-3 w-full overflow-hidden">
                                    <Icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <div className="font-medium text-xs text-left truncate mb-1">{action.label}</div>
                                      <div className="text-xs text-muted-foreground text-left line-clamp-2 leading-tight">
                                        {action.prompt.length > 60 
                                          ? `${action.prompt.substring(0, 60)}...` 
                                          : action.prompt
                                        }
                                      </div>
                                    </div>
                                  </div>
                                </Button>
                              );
                            })}
                          </div>
                          
                          {quickActions.length > 6 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowAllQuickActions(!showAllQuickActions)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              {showAllQuickActions ? (
                                <>
                                  <Minus className="h-4 w-4 mr-2" />
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Show More ({quickActions.length - 6} more)
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                  {messages.length > 0 && (
                    messages
                      .reduce((acc, message, index) => {
                        const prev = messages[index - 1];
                        const shouldGroup =
                          prev && prev.role === message.role &&
                          message.role === 'assistant' &&
                          Math.abs(message.timestamp.getTime() - prev.timestamp.getTime()) < 30000;
                        if (shouldGroup) {
                          acc[acc.length - 1].messages.push(message);
                        } else {
                          acc.push({ key: message.id, role: message.role, messages: [message] });
                        }
                        return acc;
                      }, [] as Array<{ key: string; role: 'user' | 'assistant'; messages: Message[] }>)
                      .map((group) => {
                        const combinedContent = group.messages.map(m => m.content).join('\n\n');
                        const combinedFiles = group.messages.flatMap(m => m.files || []);
                        const lastTimestamp = group.messages[group.messages.length - 1].timestamp;
                        const combinedMessage: Message = {
                          ...group.messages[0],
                          content: combinedContent,
                          files: combinedFiles.length ? combinedFiles : undefined,
                          timestamp: lastTimestamp,
                        };
                        return (
                          <div key={group.key} className={`flex gap-3 ${group.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex gap-3 max-w-[85%] ${group.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${group.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {group.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                              </div>
                               <div className={`rounded-lg p-4 relative group ${group.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                 {group.role === 'assistant' ? (
                                   <MessageRenderer
                                     message={combinedMessage}
                                     onExpandMessage={setExpandedMessage}
                                     onExportWord={generateWordDocument}
                                     onExportPowerPoint={generatePowerPoint}
                                   />
                                 ) : (
                                   <div className="relative">
                                     <SafeMessageRenderer
                                       content={combinedContent.replace(/\n/g, '<br/>')}
                                       className="whitespace-pre-wrap ai-response-content"
                                     />
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={async () => {
                                         try {
                                           await navigator.clipboard.writeText(combinedContent);
                                           setInput(combinedContent); // Put content in input for easy editing
                                           toast.success('Message copied to clipboard and input for editing');
                                         } catch (error) {
                                           console.error('Failed to copy message:', error);
                                           toast.error('Failed to copy message');
                                         }
                                       }}
                                       className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-foreground/20"
                                       title="Copy message to input for editing"
                                     >
                                       <Copy className="h-3 w-3" />
                                     </Button>
                                   </div>
                                 )}
                                {combinedFiles && combinedFiles.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {combinedFiles.map((file, index) => {
                                      const Icon = getFileTypeIcon(file.name, file.type);
                                      return (
                                        <div key={index} className="flex items-center gap-2 text-xs opacity-75">
                                          <Icon className="h-3 w-3" />
                                          <span>{file.name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="text-xs opacity-50 mt-2">{new Date(lastTimestamp).toLocaleTimeString()}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}

                  
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">AI4GP is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
               </ScrollArea>
               
               {expandedMessage && (
                  <Dialog open={!!expandedMessage} onOpenChange={(open) => { if (!open) setExpandedMessage(null); }}>
                    <DialogContent className="max-w-[98vw] max-h-[95vh] w-full flex flex-col">
                      <DialogHeader className="flex-shrink-0">
                        <DialogTitle>Expanded Response</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
                        <div className="space-y-4 pr-4 pb-4">
                          <MessageRenderer message={expandedMessage} disableTruncation={true} />
                        </div>
                      </ScrollArea>
                      <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => expandedMessage && navigator.clipboard.writeText(expandedMessage.content)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => expandedMessage && generateWordDocument(expandedMessage.content, 'AI Generated Document')}
                          className="hidden sm:inline-flex"
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Export as Word
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => expandedMessage && generatePowerPoint(expandedMessage.content, 'AI Generated Presentation')}
                          className="hidden sm:inline-flex"
                        >
                          <Presentation className="h-4 w-4 mr-2" />
                          Export as PowerPoint
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
               
               {/* Input Area */}
              <div className="border-t p-4 space-y-3">
                {/* Uploaded Files Display */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => {
                      const Icon = getFileTypeIcon(file.name, file.type);
                      return (
                        <div key={index} className="flex items-center gap-2 bg-muted rounded-md px-3 py-1 text-sm">
                          <Icon className="h-4 w-4" />
                          <span className="truncate max-w-32">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 hover:bg-transparent"
                            onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                 <div className="flex gap-2">
                   <Textarea
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     placeholder="Ask AI4GP about clinical protocols, patient care, prescribing guidance..."
                     className="min-h-[60px] resize-none"
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey) {
                         e.preventDefault();
                         handleSend();
                       }
                     }}
                   />
                   <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        accept=".pdf,.doc,.docx,.rtf,.txt,.eml,.msg,.jpg,.jpeg,.png,.wav,.mp3,.m4a"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        title="Upload files (PDF, DOC, DOCX, RTF, TXT, EML, MSG, JPG, PNG, audio files)"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                     <SpeechToText onTranscription={(transcript) => setInput(prev => prev + ' ' + transcript)} />
                     <Button 
                       onClick={handleSend} 
                       disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                       size="sm"
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
       </div>
     );
   };
   
   export default AI4GPService;