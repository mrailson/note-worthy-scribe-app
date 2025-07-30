import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  Stethoscope,
  Activity,
  FileHeart,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SpeechToText } from '@/components/SpeechToText';
import MessageRenderer from '@/components/MessageRenderer';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';

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

const AI4GPService = () => {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<'claude' | 'gpt'>('gpt');
  const [sessionMemory, setSessionMemory] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [apiKeyMissing, setApiKeyMissing] = useState<{claude: boolean, gpt: boolean}>({claude: false, gpt: false});
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [practiceContext, setPracticeContext] = useState<PracticeContext>({});
  const [chatBoxSize, setChatBoxSize] = useState('default');
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

  const quickActions = [
    { 
      label: 'Clinical Protocol', 
      icon: Stethoscope, 
      prompt: 'Help me create or review a clinical protocol based on the latest NICE guidelines.',
      requiresFile: false 
    },
    { 
      label: 'Patient Consultation Summary', 
      icon: Activity, 
      prompt: 'Summarise this patient consultation and highlight key clinical findings and actions.',
      requiresFile: true 
    },
    { 
      label: 'Referral Letter', 
      icon: FileHeart, 
      prompt: 'Help me draft a comprehensive referral letter for this patient case.',
      requiresFile: false 
    },
    { 
      label: 'Clinical Audit', 
      icon: BarChart3, 
      prompt: 'Design a clinical audit framework or analyze audit results for quality improvement.',
      requiresFile: false 
    },
    { 
      label: 'Prescribing Guidance', 
      icon: Shield, 
      prompt: 'Provide prescribing guidance and safety recommendations for specific medications or conditions.',
      requiresFile: false 
    },
    { 
      label: 'Patient Information', 
      icon: BookOpen, 
      prompt: 'Create patient-friendly information leaflets or educational materials.',
      requiresFile: false 
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
          messages: [
            { role: 'system', content: systemPrompt },
            ...messagesForAPI
          ],
          model: model,
          sessionMemory: sessionMemory
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

  const handleNewSearch = () => {
    setMessages([]);
    setUploadedFiles([]);
    setInput('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
        
        {/* Chat Interface */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-6 w-6 text-primary" />
                  AI4GP - Clinical Intelligence Assistant
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Stethoscope className="h-3 w-3 mr-1" />
                    Clinical AI
                  </Badge>
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
                    <div className="text-center py-12">
                      <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-lg mb-2">Welcome to AI4GP</h3>
                      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        Your AI assistant for clinical guidance, protocol development, and evidence-based practice support.
                      </p>
                      
                      {/* Quick Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
                        {quickActions.map((action, index) => {
                          const Icon = action.icon;
                          return (
                            <Button
                              key={index}
                              variant="outline"
                              className="h-auto p-4 text-left justify-start"
                              onClick={() => setInput(action.prompt)}
                            >
                              <div className="flex items-start gap-3">
                                <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="font-medium text-sm">{action.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {action.prompt.substring(0, 60)}...
                                  </div>
                                </div>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          {message.role === 'user' ? <User className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                        </div>
                        
                        <div className={`rounded-lg p-4 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <div dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br>') }} />
                          
                          {message.files && message.files.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {message.files.map((file, index) => {
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
                          
                          <div className="text-xs opacity-50 mt-2">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Stethoscope className="h-4 w-4" />
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