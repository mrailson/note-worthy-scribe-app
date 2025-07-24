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
  Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoginForm } from '@/components/LoginForm';
import { SpeechToText } from '@/components/SpeechToText';
import MessageRenderer from '@/components/MessageRenderer';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';

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
  const [model, setModel] = useState<'claude' | 'gpt'>('gpt');
  const [sessionMemory, setSessionMemory] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [apiKeyMissing, setApiKeyMissing] = useState<{claude: boolean, gpt: boolean}>({claude: false, gpt: false});
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [activeTab, setActiveTab] = useState('ai-service');
  const [practiceContext, setPracticeContext] = useState<PracticeContext>({});
  const [chatBoxSize, setChatBoxSize] = useState('default'); // 'small', 'default', 'large', 'extra-large'
  const [includePracticeBranding, setIncludePracticeBranding] = useState(true);
  const [practiceDetails, setPracticeDetails] = useState<any>(null);
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

  const handleNewMeeting = () => {
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
- Always stay professional, accurate, and NHS-compliant`;

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

Always provide practical, actionable advice that follows NHS guidelines and best practices.`;

    return prompt;
  };

  const handleSend = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
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

      // Check if the response suggests document or image generation
      const responseText = data.response.toLowerCase();
      if (responseText.includes('word document') || responseText.includes('generate document')) {
        // Add document generation option
        setTimeout(() => {
          const docMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: "Would you like me to generate a Word document from this content? I can create a professionally formatted document for you.",
            timestamp: new Date()
          };
          setMessages(prev => [...prev, docMessage]);
        }, 1000);
      }
      
      if (responseText.includes('generate image') || responseText.includes('create image') || responseText.includes('diagram')) {
        // Note: Image generation functionality has been removed
      }
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
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const uploadedFile: UploadedFile = {
          name: file.name,
          type: file.type,
          content,
          size: file.size
        };
        setUploadedFiles(prev => [...prev, uploadedFile]);
        console.log(`File uploaded: ${file.name}`);
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearConversation = () => {
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
        
        // Check for headings (markdown or formatted)
        if (trimmedLine.startsWith('#')) {
          const headingText = trimmedLine.replace(/^#+\s*/, '');
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
        // Check if it's a section heading (all caps or ends with colon)
        else if ((trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 5 && trimmedLine.length < 80) || 
                 (trimmedLine.endsWith(':') && trimmedLine.length < 80 && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('☑') && !trimmedLine.startsWith('☐'))) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedLine,
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
        // Handle numbered lists
        else if (trimmedLine.match(/^\d+\./)) {
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
            let currentIndex = 0;
            
            // First, handle bold formatting **text**
            const boldRegex = /\*\*([^*]+?)\*\*/g;
            let match;
            
            while ((match = boldRegex.exec(text)) !== null) {
              // Add text before the bold formatting
              if (match.index > currentIndex) {
                const beforeText = text.substring(currentIndex, match.index);
                if (beforeText) {
                  children.push(new TextRun({
                    text: beforeText,
                    size: 24
                  }));
                }
              }
              
              // Add the bold text
              children.push(new TextRun({
                text: match[1],
                size: 24,
                bold: true
              }));
              
              currentIndex = match.index + match[0].length;
            }
            
            // Add remaining text after processing
            if (currentIndex < text.length) {
              const remainingText = text.substring(currentIndex);
              if (remainingText) {
                children.push(new TextRun({
                  text: remainingText,
                  size: 24
                }));
              }
            }
            
            // If no bold formatting was found, add the entire text as plain
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
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai-service" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              AI Service
            </TabsTrigger>
            <TabsTrigger value="previous-searches" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Previous Searches
            </TabsTrigger>
            <TabsTrigger value="ai-settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              AI Settings
            </TabsTrigger>
            <TabsTrigger value="what-can-ai-do" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              What Can AI Do?
            </TabsTrigger>
          </TabsList>

          {/* AI Service Tab */}
          <TabsContent value="ai-service" className="mt-6">
            <Card className={getChatBoxHeight()}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI 4 PM Service
                    <Badge variant="secondary">
                      {model === 'claude' ? 'Claude' : 'GPT-4'}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
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
                        <div className="w-5 h-5 bg-current rounded-sm"></div>
                      </Button>
                      <Button
                        variant={chatBoxSize === 'tall' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setChatBoxSize('tall')}
                        className="h-8 w-8 p-0"
                        title="Tall vertical window"
                      >
                        <div className="w-5 h-9 bg-current rounded-sm"></div>
                      </Button>
                      <Button
                        variant={chatBoxSize === 'full-screen' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setChatBoxSize('full-screen')}
                        className="h-8 w-8 p-0"
                        title="Full screen window"
                      >
                        <div className="w-5 h-14 bg-current rounded-sm"></div>
                      </Button>
                    </div>
                    
                    {/* Clear chat button */}
                    <Button
                      onClick={clearConversation}
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      title="Clear conversation and start new chat"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New Chat
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex flex-col h-full p-0">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Welcome to AI 4 PM Service</p>
                      <p className="text-sm">Your NHS Practice Management AI Assistant</p>
                      <p className="text-xs mt-2">Ask me about NHS policies, compliance, workflows, or upload documents for analysis.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {messages.map((message) => (
                        <div key={message.id}>
                          <MessageRenderer message={message} />
                          {/* Add action buttons for AI responses */}
                          {message.role === 'assistant' && message.content.length > 100 && (
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
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => generateWordDocument(message.content, 'AI Generated Document')}
                                  className="h-8 text-xs"
                                >
                                  <FileDown className="h-3 w-3 mr-1" />
                                  Export as Word
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => generatePowerPoint(message.content, 'AI Generated Presentation')}
                                  className="h-8 text-xs"
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
                  {/* Uploaded Files Display */}
                  {uploadedFiles.length > 0 && (
                    <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />
                          Attached Files ({uploadedFiles.length})
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadedFiles([])}
                          className="h-6 text-xs px-2"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-background rounded text-xs border">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                              <span className="truncate">{file.name}</span>
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {(file.size / 1024).toFixed(1)}KB
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-6 w-6 p-0 flex-shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me about NHS policies, compliance, or attach documents for analysis..."
                        className="min-h-[80px] pr-32 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
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
                            accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
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
                            className="h-8 w-8 p-0 hover:bg-muted"
                            title="Attach files"
                          >
                            <Paperclip className="h-4 w-4" />
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
          <TabsContent value="previous-searches" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Previous Searches
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={saveCurrentSearch}
                    variant="outline"
                    size="sm"
                    disabled={messages.length === 0}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Save Current Search
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
                      <div key={search.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
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
                              onClick={() => loadPreviousSearch(search.id)}
                              variant="outline"
                              size="sm"
                              className="h-8 px-3"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              onClick={() => deleteSearch(search.id)}
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

          {/* AI Settings Tab */}
          <TabsContent value="ai-settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5" />
                  AI Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>AI Model Selection</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={model === 'claude' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setModel('claude')}
                        className="flex-1"
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        Claude (Anthropic)
                      </Button>
                      <Button
                        variant={model === 'gpt' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setModel('gpt')}
                        className="flex-1"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        GPT-4 (OpenAI)
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleNewMeeting}
                        className="px-3"
                        title="Start a new conversation"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        New Chat
                      </Button>
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

          {/* What Can AI Do Tab */}
          <TabsContent value="what-can-ai-do" className="mt-6">
            <div className="space-y-6">
              {/* Overview Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    What Can AI Do for Practice Managers?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed">
                    The AI 4 PM Service is designed specifically for NHS GP Practice Managers. It combines deep knowledge of NHS policies, 
                    CQC requirements, and practice operations with powerful AI capabilities to assist with daily management tasks.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Bot className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-sm mb-1">AI-Powered Analysis</h4>
                      <p className="text-xs text-muted-foreground">Smart document analysis and insights</p>
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
    </div>
  );
};

export default AI4PMService;