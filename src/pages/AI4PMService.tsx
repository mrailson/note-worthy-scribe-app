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
  Image,
  FileDown,
  Presentation
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
    },
    { 
      label: 'Create Word Document', 
      icon: FileDown, 
      prompt: 'Generate a Word document based on our conversation. Please specify what type of document you need (policy, procedure, letter, etc.).',
      requiresFile: false 
    },
    { 
      label: 'Generate Image', 
      icon: Image, 
      prompt: 'Create an image or diagram. Please describe what you want me to generate (flowchart, poster, infographic, etc.).',
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

SPECIAL CAPABILITIES:
- Document Generation: When asked to create a Word document, format your response with clear headings, sections, and structured content that can be easily converted to a professional document.
- Image Generation: When asked to create images, diagrams, or visual content, provide a detailed description that can be used to generate the visual content.

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
        // Extract image prompt and generate automatically
        const imagePromptMatch = data.response.match(/(?:image|diagram|visual).*?(?:\.|$)/i);
        if (imagePromptMatch) {
          setTimeout(() => {
            generateImage(imagePromptMatch[0]);
          }, 1000);
        }
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
    console.log('Conversation cleared');
  };

  const generateWordDocument = async (content: string, title: string = 'AI Generated Document') => {
    try {
      // Parse the content and create document structure
      const paragraphs: any[] = [];
      
      // Add title
      paragraphs.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
        })
      );

      // Split content into paragraphs and format
      const contentLines = content.split('\n').filter(line => line.trim());
      
      contentLines.forEach(line => {
        const trimmedLine = line.trim();
        
        // Check if it's a heading (starts with # or is all caps)
        if (trimmedLine.startsWith('#') || (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 5)) {
          const headingText = trimmedLine.replace(/^#+\s*/, '');
          paragraphs.push(
            new Paragraph({
              text: headingText,
              heading: HeadingLevel.HEADING_1,
            })
          );
        } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
          // Bullet points
          paragraphs.push(
            new Paragraph({
              text: trimmedLine.replace(/^[-•]\s*/, ''),
              bullet: {
                level: 0,
              },
            })
          );
        } else if (trimmedLine) {
          // Regular paragraph
          paragraphs.push(
            new Paragraph({
              children: [new TextRun(trimmedLine)],
            })
          );
        }
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
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
      
      // Set presentation properties
      pptx.author = 'AI 4 PM Service';
      pptx.company = 'NHS GP Practice';
      pptx.title = title;

      // Create title slide
      const titleSlide = pptx.addSlide();
      titleSlide.addText(title, {
        x: 1,
        y: 2,
        w: 8,
        h: 1.5,
        fontSize: 36,
        bold: true,
        align: 'center',
        color: '363636'
      });
      
      titleSlide.addText('Generated by AI 4 PM Service', {
        x: 1,
        y: 4,
        w: 8,
        h: 0.5,
        fontSize: 16,
        align: 'center',
        color: '666666'
      });

      // Parse content and create slides
      const sections = content.split(/\n(?=#+\s|[A-Z][^a-z]*:|\d+\.\s)/);
      
      sections.forEach((section, index) => {
        if (section.trim()) {
          const slide = pptx.addSlide();
          const lines = section.trim().split('\n').filter(line => line.trim());
          
          if (lines.length > 0) {
            // First line as title
            const slideTitle = lines[0].replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '');
            slide.addText(slideTitle, {
              x: 0.5,
              y: 0.5,
              w: 9,
              h: 1,
              fontSize: 28,
              bold: true,
              color: '2F4F4F'
            });

            // Remaining lines as bullet points
            if (lines.length > 1) {
              const bulletPoints = lines.slice(1).map(line => ({
                text: line.replace(/^[-•]\s*/, ''),
                options: { bullet: true }
              }));

              slide.addText(bulletPoints, {
                x: 0.5,
                y: 1.8,
                w: 9,
                h: 5,
                fontSize: 18,
                lineSpacing: 28
              });
            }
          }
        }
      });

      // Save the presentation
      await pptx.writeFile({ fileName: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx` });
      console.log('PowerPoint presentation generated successfully');
    } catch (error) {
      console.error('Error generating PowerPoint presentation:', error);
    }
  };

  const generateImage = async (prompt: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt }
      });

      if (error) throw error;

      if (data.success) {
        // Add the generated image as a message
        const imageMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I've generated an image based on your request: "${data.revisedPrompt}"\n\n![Generated Image](${data.imageData})`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, imageMessage]);
        console.log('Image generated successfully');
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I couldn't generate the image. Error: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
        <Tabs defaultValue="ai-service" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai-service" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              AI Service
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
            <Card className="h-[calc(100vh-280px)]">
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
                        <div key={message.id}>
                          <MessageRenderer message={message} />
                          {/* Add action buttons for AI responses */}
                          {message.role === 'assistant' && message.content.length > 100 && (
                            <div className="flex gap-2 mt-2 ml-11">
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const prompt = `Create a professional diagram or infographic based on this content: ${message.content.substring(0, 200)}...`;
                                  generateImage(prompt);
                                }}
                                className="h-8 text-xs"
                              >
                                <Image className="h-3 w-3 mr-1" />
                                Generate Visual
                              </Button>
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