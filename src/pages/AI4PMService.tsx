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
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LoginForm } from '@/components/LoginForm';
import { SpeechToText } from '@/components/SpeechToText';
import MessageRenderer from '@/components/MessageRenderer';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';

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

const AI4PMService = () => {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<'claude' | 'gpt'>('claude');
  const [sessionMemory, setSessionMemory] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [apiKeyMissing, setApiKeyMissing] = useState<{claude: boolean, gpt: boolean}>({claude: false, gpt: false});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewMeeting = () => {
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
    }
  ];

  const systemPrompt = `You are "AI 4 PM Service", an AI Assistant built specifically to help GP Practice Managers in the UK NHS.

You understand and can explain:
- NHS policies (Digital Service Manual, GP contract, CQC KLOEs)
- Common admin, HR, finance and compliance workflows
- EMIS, SystmOne, SNOMED, QOF indicators
- Local policies uploaded by the user
- You summarise, draft documents, create checklists, answer SOP queries
- Always stay professional, accurate, and NHS-compliant

Knowledge domains you should reference:
1. NHS Digital & Admin Resources (NHS England GP Contract 2024/25, PCN DES, NHS Long Term Plan)
2. CQC and Compliance (KLOEs for GP practices, CQC Evidence Categories, compliance documents)
3. Practice Operations (Reception SOPs, HR policies, patient access strategies)
4. Finance & Contracts (GP Practice finance, PCN funding, ARRS roles, IIF indicators)
5. Information Governance & GDPR (DSPT compliance, NHSmail policies, SARs)
6. Clinical System Knowledge (SNOMED basics, EMIS/SystmOne templates, QOF indicators)

Always provide practical, actionable advice that follows NHS guidelines and best practices.`;

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
          systemPrompt,
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
    } catch (error: any) {
      console.error('Error:', error);
      if (error.message?.includes('API key not configured')) {
        if (model === 'claude') {
          setApiKeyMissing(prev => ({...prev, claude: true}));
          toast.error('Anthropic API key not configured. Please check your settings.');
        } else {
          setApiKeyMissing(prev => ({...prev, gpt: true}));
          toast.error('OpenAI API key not configured. Please check your settings.');
        }
      } else {
        toast.error('Failed to get response. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    if (action.requiresFile && uploadedFiles.length === 0) {
      toast.error('This action requires a file to be uploaded first.');
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
        toast.success(`File uploaded: ${file.name}`);
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
    toast.success('Conversation cleared');
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
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5" />
                  AI Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={model === 'claude' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setModel('claude')}
                      className="flex-1"
                    >
                      Claude
                    </Button>
                    <Button
                      variant={model === 'gpt' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setModel('gpt')}
                      className="flex-1"
                    >
                      GPT-4
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Session Memory</Label>
                  <Switch
                    checked={sessionMemory}
                    onCheckedChange={setSessionMemory}
                  />
                </div>
                
                <Separator />
                
                <Button
                  onClick={clearConversation}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action)}
                    className="w-full justify-start text-left h-auto py-3"
                  >
                    <action.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleFileUpload
                  onFileUpload={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                  maxSize={10}
                  className="h-24"
                />
                
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm font-medium">Uploaded Files:</Label>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                        <span className="truncate flex-1">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[calc(100vh-200px)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI 4 PM Service
                  <Badge variant="secondary" className="ml-auto">
                    {model === 'claude' ? 'Claude' : 'GPT-4'}
                  </Badge>
                </CardTitle>
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
                        <MessageRenderer key={message.id} message={message} />
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
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me about NHS policies, compliance, or upload a document for analysis..."
                        className="min-h-[80px] pr-20 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AI4PMService;