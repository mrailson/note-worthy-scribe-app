import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  FileText, 
  Stethoscope, 
  AlertTriangle,
  ClipboardList,
  FileCheck,
  Search,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScribeSession, SOAPNote } from '@/types/scribe';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ConsultationAskAIProps {
  session: ScribeSession;
  soapNote?: SOAPNote;
}

const QUICK_PROMPTS = [
  {
    label: 'Create referral',
    icon: FileText,
    prompt: 'Based on this consultation, draft a professional NHS referral letter to the appropriate specialist. Include relevant clinical history, examination findings, and reason for referral.'
  },
  {
    label: 'Suggest investigations',
    icon: Stethoscope,
    prompt: 'What investigations or tests might be appropriate based on this consultation? Consider NICE guidelines and NHS resources.'
  },
  {
    label: 'Key findings',
    icon: ClipboardList,
    prompt: 'Summarise the key clinical findings from this consultation in a concise, structured format.'
  },
  {
    label: 'Safety netting',
    icon: AlertTriangle,
    prompt: 'Generate appropriate safety netting advice for this patient based on the consultation. Include red flag symptoms and when to seek further help.'
  },
  {
    label: 'What have I missed?',
    icon: Search,
    prompt: 'Review this consultation for any potential gaps in history taking, examination, or management plan. What additional questions or examinations might be considered?'
  },
  {
    label: 'Fit note text',
    icon: FileCheck,
    prompt: 'Generate appropriate supporting text for a fit note (Med3) based on this consultation, including functional effects and work capability.'
  }
];

export const ConsultationAskAI: React.FC<ConsultationAskAIProps> = ({ session, soapNote }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildConsultationContext = () => {
    return {
      consultationType: session.consultationType,
      transcript: session.transcript || '',
      soapNote: soapNote ? {
        subjective: soapNote.S,
        objective: soapNote.O,
        assessment: soapNote.A,
        plan: soapNote.P
      } : undefined
    };
  };

  const handleSend = async (promptText?: string) => {
    const question = promptText || input.trim();
    if (!question || isLoading) return;

    const userMessage: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('consultation-qa-chat', {
        body: {
          question,
          conversationHistory: messages,
          consultationContext: buildConsultationContext()
        }
      });

      if (error) {
        console.error('Error calling consultation-qa-chat:', error);
        toast.error('Failed to get AI response');
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'I apologise, there was an error processing your request. Please try again.' 
        }]);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error}` 
        }]);
        return;
      }

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data?.answer || 'No response received.' 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error in handleSend:', err);
      toast.error('Failed to get AI response');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologise, there was an error processing your request. Please try again.' 
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

  const handleClearChat = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask AI About This Consultation
          </CardTitle>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        {/* Quick Prompts */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Quick actions:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK_PROMPTS.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 justify-start text-left"
                  onClick={() => handleSend(prompt.prompt)}
                  disabled={isLoading}
                >
                  <prompt.icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="text-xs">{prompt.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {messages.length > 0 && (
          <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Input Area */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this consultation..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Press Ctrl+Enter to send • Esc to clear
        </p>
      </CardContent>
    </Card>
  );
};
