import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Send, 
  X, 
  FileText, 
  Mail, 
  Loader2,
  ClipboardList,
  AlertTriangle,
  FileCheck,
  HelpCircle,
  Search,
  Mic,
  MicOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { generateWordDocument } from '@/utils/documentGenerators';
import { useAutoEmail } from '@/hooks/useAutoEmail';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { format } from 'date-fns';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface InspectionItemAskAIProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemDescription: string;
  categoryName: string;
}

// Generate quick prompts based on the item context
const getQuickPrompts = (itemName: string, categoryName: string) => [
  {
    label: 'What evidence is needed?',
    icon: ClipboardList,
    prompt: `What evidence and documentation does a GP practice need to demonstrate compliance for "${itemName}" during a CQC inspection? Include specific examples of acceptable evidence.`
  },
  {
    label: 'Common issues found',
    icon: AlertTriangle,
    prompt: `What are the most common issues and non-compliances that CQC inspectors find related to "${itemName}" in GP practices? How can these be prevented?`
  },
  {
    label: 'Best practice guidance',
    icon: FileCheck,
    prompt: `What is the best practice guidance for "${itemName}" in a GP practice setting? Reference relevant NHS, HSE, or regulatory guidance where applicable.`
  },
  {
    label: 'Quick compliance check',
    icon: Search,
    prompt: `Provide a quick 5-point checklist a Practice Manager can use to verify compliance for "${itemName}" before a CQC inspection.`
  },
  {
    label: 'What if non-compliant?',
    icon: HelpCircle,
    prompt: `If a GP practice is found to be non-compliant with "${itemName}" requirements, what are the potential consequences and what immediate steps should be taken to address it?`
  }
];

export const InspectionItemAskAI = ({
  open,
  onOpenChange,
  itemName,
  itemDescription,
  categoryName
}: InspectionItemAskAIProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const { sendEmailAutomatically, isSending } = useAutoEmail();

  // Speech recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-GB';
        
        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (event.results[event.results.length - 1].isFinal) {
            setInput(prev => prev + (prev ? ' ' : '') + transcript.trim());
          }
        };
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast.error('Speech recognition not supported in this browser');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const quickPrompts = getQuickPrompts(itemName, categoryName);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Reset when modal opens with new item
  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput('');
    }
  }, [open, itemName]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const systemContext = `You are a CQC inspection expert helping GP Practice Managers prepare for inspections. 
You are providing guidance about: "${itemName}" in the "${categoryName}" category.
Item description: ${itemDescription}

Provide practical, actionable advice specific to UK primary care/GP practices.
Reference relevant regulations (CQC, HSE, NHS England) where appropriate.
Be concise but thorough. Use bullet points for clarity when listing items.`;

      // Format conversation history for the API
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: {
          message: userMessage,
          conversationHistory: conversationHistory,
          systemPrompt: systemContext,
          model: 'gemini-2.5-flash'
        }
      });

      if (error) throw error;

      const assistantContent = data?.response || 
                               data?.content || 
                               data?.answer ||
                               'I apologise, but I was unable to generate a response.';

      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      showToast.error(error.message || 'Failed to get response');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setInput('');
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleExportToWord = async () => {
    if (messages.length === 0) {
      showToast.error('No conversation to export');
      return;
    }

    // Format content for Word without markdown italics - clean, structured format
    const sections = messages.map(m => {
      const prefix = m.role === 'user' ? 'Question' : 'Answer';
      // Clean up markdown formatting for Word - remove ** bold markers and format plainly
      const cleanContent = m.content
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markers
        .replace(/\*(.*?)\*/g, '$1')       // Remove italic markers
        .replace(/^- /gm, '• ')            // Use bullet points
        .replace(/^(\d+)\. /gm, '$1. ');   // Keep numbered lists
      return `${prefix}:\n\n${cleanContent}`;
    }).join('\n\n' + '─'.repeat(50) + '\n\n');
    
    const header = `CQC Inspection Guidance: ${itemName}\n\nCategory: ${categoryName}\nGenerated: ${format(new Date(), 'dd MMMM yyyy HH:mm')}\n\n${'─'.repeat(50)}\n\n`;
    
    await generateWordDocument(header + sections, `CQC Guidance - ${itemName} - ${format(new Date(), 'dd-MM-yyyy')}`);
    showToast.success('Exported to Word');
  };

  const handleEmailChat = async () => {
    if (messages.length === 0) {
      showToast.error('No conversation to email');
      return;
    }
    
    const content = messages.map(m => 
      `**${m.role === 'user' ? 'Question' : 'Answer'}:**\n\n${m.content}`
    ).join('\n\n---\n\n');
    
    const header = `# CQC Inspection Guidance: ${itemName}\n\n**Category:** ${categoryName}\n**Generated:** ${format(new Date(), 'dd MMMM yyyy HH:mm')}\n\n---\n\n`;
    
    await sendEmailAutomatically(header + content, `CQC Guidance - ${itemName}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-semibold">Ask AI about {itemName}</DialogTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportToWord}
                disabled={messages.length === 0 || isLoading}
                className="h-8 px-2"
                title="Export to Word"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEmailChat}
                disabled={messages.length === 0 || isLoading || isSending}
                className="h-8 px-2"
                title="Email conversation"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 px-2"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-xs mt-1">
            {categoryName}
          </Badge>
        </DialogHeader>

        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
          <div className="py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Ask questions about <span className="font-medium text-foreground">{itemName}</span>
                </p>
                <p className="text-xs text-muted-foreground mb-6 max-w-md">
                  {itemDescription}
                </p>
                
                <div className="w-full space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Common questions:</p>
                  <div className="grid gap-2">
                    {quickPrompts.map((prompt, idx) => {
                      const Icon = prompt.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleQuickPrompt(prompt.prompt)}
                          className="flex items-center gap-3 p-3 text-left text-sm rounded-lg border bg-card hover:bg-accent transition-colors"
                        >
                          <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{prompt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-xl",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground px-4 py-3 max-w-[75%]"
                        : "bg-white border border-gray-200 shadow-sm px-6 py-5 max-w-[95%]"
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div 
                        className="text-sm leading-relaxed text-gray-700"
                        dangerouslySetInnerHTML={{ 
                          __html: renderNHSMarkdown(message.content, { 
                            enableNHSStyling: true,
                            baseFontSize: 14 
                          }) 
                        }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex-shrink-0 bg-muted/30">
          <div className="flex gap-2 items-end">
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={toggleListening}
              disabled={isLoading}
              className="h-10 w-10 flex-shrink-0"
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder={isListening ? "Listening..." : `Ask about ${itemName}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="min-h-[80px] max-h-40 resize-none pr-10 bg-background"
                rows={3}
              />
              {input.trim().length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 bottom-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                  onClick={() => setInput('')}
                  title="Clear input (Esc)"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-10 w-10"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Ctrl+Enter to send • Esc to clear • Click mic for voice input
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
