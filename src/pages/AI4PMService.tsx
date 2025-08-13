import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUpload } from "@/components/FileUpload";
import PMGenieVoiceAgent from "@/components/PMGenieVoiceAgent";
import MessageRenderer from "@/components/MessageRenderer";
import NewsPanel from "@/components/NewsPanel";
import { Bot, User, Send, Download, FileText, Presentation, Mic, MicOff, Volume2, VolumeX, Trash2, AlertTriangle, X } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import PptxGenJS from 'pptxgenjs';
import { saveAs } from 'file-saver';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  content?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
}

interface SearchHistoryEntry {
  id: string;
  title: string;
  query: string;
  response: string;
  timestamp: Date;
  model: string;
}

interface VoiceSessionInfo {
  sessionId: string;
  isConnected: boolean;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
}

let activeVoiceInstances = 0;

const AI4PMService = () => {
  const { user } = useAuth();
  
  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3.5-sonnet');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  
  // Voice states
  const [voiceSession, setVoiceSession] = useState<VoiceSessionInfo>({
    sessionId: '',
    isConnected: false,
    isMuted: true,
    isUserSpeaking: false,
    isAssistantSpeaking: false
  });
  
  // API key states
  const [apiKeyMissing, setApiKeyMissing] = useState({
    claude: false,
    gpt: false
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load search history
  useEffect(() => {
    const saved = localStorage.getItem('ai4pm-search-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSearchHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    }
  }, []);

  // Save search history
  useEffect(() => {
    localStorage.setItem('ai4pm-search-history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Voice session management
  const startVoiceSession = useCallback(async () => {
    if (activeVoiceInstances > 0) {
      toast.error("Another voice session is already running. Please stop it first.");
      return;
    }

    try {
      activeVoiceInstances++;
      const sessionId = uuidv4();
      
      setVoiceSession({
        sessionId,
        isConnected: true,
        isMuted: true,
        isUserSpeaking: false,
        isAssistantSpeaking: false
      });

      toast.success("Voice session started. You can now speak with the AI assistant.");
    } catch (error) {
      activeVoiceInstances--;
      console.error('Error starting voice session:', error);
      toast.error("Failed to start voice session.");
    }
  }, []);

  const stopVoiceSession = useCallback(() => {
    if (voiceSession.isConnected) {
      activeVoiceInstances = Math.max(0, activeVoiceInstances - 1);
      setVoiceSession({
        sessionId: '',
        isConnected: false,
        isMuted: true,
        isUserSpeaking: false,
        isAssistantSpeaking: false
      });

      toast.success("Voice session has been disconnected.");
    }
  }, [voiceSession.isConnected]);

  const toggleMute = useCallback(() => {
    setVoiceSession(prev => ({
      ...prev,
      isMuted: !prev.isMuted
    }));
  }, []);

  const handleSend = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    const currentInput = input;
    const currentFiles = [...uploadedFiles];
    setInput('');
    setUploadedFiles([]);
    setIsLoading(true);

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
      files: currentFiles.length > 0 ? currentFiles : undefined,
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const formData = new FormData();
      formData.append('message', currentInput);
      formData.append('model', selectedModel);
      formData.append('history', JSON.stringify(messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }))));

      // File uploads would need to be converted to proper File objects for FormData
      // This is simplified for now

      const response = await fetch('/api/ai-4-pm-chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const searchEntry: SearchHistoryEntry = {
        id: uuidv4(),
        title: currentInput.slice(0, 50) + (currentInput.length > 50 ? '...' : ''),
        query: currentInput,
        response: data.response,
        timestamp: new Date(),
        model: selectedModel,
      };

      setSearchHistory(prev => [searchEntry, ...prev.slice(0, 19)]);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSearch = (id: string) => {
    setSearchHistory(prev => prev.filter(item => item.id !== id));
  };

  const loadSearch = (search: SearchHistoryEntry) => {
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: search.query,
      timestamp: search.timestamp,
    };

    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: search.response,
      timestamp: search.timestamp,
    };

    setMessages([userMessage, assistantMessage]);
  };

  const generateWordDocument = async (content: string, title?: string) => {
    const lines = content.split('\n');
    const children = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.replace('# ', ''), bold: true, size: 32 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
          })
        );
      } else if (line.startsWith('## ')) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.replace('## ', ''), bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 150 }
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(
          new Paragraph({
            children: [new TextRun(line.replace(/^[*-] /, ''))],
            bullet: { level: 0 },
            spacing: { after: 100 }
          })
        );
      } else if (line.startsWith('  - ') || line.startsWith('  * ')) {
        children.push(
          new Paragraph({
            children: [new TextRun(line.replace(/^  [*-] /, ''))],
            bullet: { level: 1 },
            spacing: { after: 100 }
          })
        );
      } else if (line.match(/^\d+\. /)) {
        children.push(
          new Paragraph({
            children: [new TextRun(line.replace(/^\d+\. /, ''))],
            numbering: { reference: "default-numbering", level: 0 },
            spacing: { after: 100 }
          })
        );
      } else if (line.includes('**') && line.includes('**')) {
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

    const titleSlide = pptx.addSlide();
    titleSlide.addText(title || 'AI4PM Presentation', {
      x: 1,
      y: 2,
      w: 8,
      h: 2,
      fontSize: 36,
      bold: true,
      align: 'center'
    });

    const sections = content.split('\n\n');
    for (const section of sections) {
      if (section.trim()) {
        const slide = pptx.addSlide();
        const lines = section.split('\n');
        
        if (lines[0].startsWith('#')) {
          slide.addText(lines[0].replace(/^#+\s*/, ''), {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 1,
            fontSize: 28,
            bold: true
          });
          
          if (lines.length > 1) {
            const bulletPoints = lines.slice(1).filter(line => line.trim()).join('\n');
            slide.addText(bulletPoints, {
              x: 0.5,
              y: 1.8,
              w: 9,
              h: 4,
              fontSize: 18,
              bullet: true
            });
          }
        } else {
          slide.addText(section, {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 5,
            fontSize: 18
          });
        }
      }
    }

    await pptx.writeFile({ fileName: `${title || 'AI4PM-Presentation'}.pptx` });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">AI4PM Service</h1>
          <p className="text-muted-foreground">
            AI-powered practice management assistant for healthcare professionals
          </p>
        </div>

        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="chat">AI Chat</TabsTrigger>
            <TabsTrigger value="pm-genie">PM Genie</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <Card className="h-[600px] flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        AI Assistant
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {voiceSession.isConnected ? (
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={toggleMute}
                              variant={voiceSession.isMuted ? "outline" : "default"}
                              size="sm"
                            >
                              {voiceSession.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </Button>
                            <Button onClick={stopVoiceSession} variant="destructive" size="sm">
                              Stop Voice
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={startVoiceSession} variant="outline" size="sm">
                            <Mic className="h-4 w-4 mr-2" />
                            Start Voice
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col">
                    <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                      {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Start a conversation with the AI assistant</p>
                          </div>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground ml-auto'
                                  : 'bg-muted'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {message.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                <span className="text-xs opacity-70">
                                  {message.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              
                              <div className="whitespace-pre-wrap">{message.content}</div>
                              
                              {message.role === 'assistant' && (
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    onClick={() => generateWordDocument(message.content, 'AI4PM Response')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    Word
                                  </Button>
                                  <Button
                                    onClick={() => generatePowerPoint(message.content, 'AI4PM Response')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Presentation className="h-3 w-3 mr-1" />
                                    PowerPoint
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="space-y-3">
                      <FileUpload
                        onFilesChange={setUploadedFiles}
                      />
                      
                      {uploadedFiles.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {uploadedFiles.map((file, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {file.name}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 ml-1"
                                onClick={() => {
                                  setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Ask about practice management, policies, or get assistance..."
                          className="min-h-[80px] resize-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                        />
                        <div className="flex flex-col gap-2">
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
          </TabsContent>

          <TabsContent value="pm-genie">
            <PMGenieVoiceAgent />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Conversation History</CardTitle>
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {search.model}
                          </Badge>
                          <span>{search.timestamp.toLocaleDateString()}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {search.query}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => loadSearch(search)}
                        >
                          Load Conversation
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {searchHistory.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      <h3 className="text-lg font-medium mb-2">No History Yet</h3>
                      <p className="text-sm">Your conversations will appear here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="news">
            <NewsPanel />
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
              
              <div className="whitespace-pre-wrap">{expandedMessage.content}</div>
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