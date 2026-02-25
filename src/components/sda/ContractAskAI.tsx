import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bot,
  Send,
  X,
  FileText,
  Mail,
  Loader2,
  Clock,
  PoundSterling,
  Users,
  Shield,
  Scale,
  Target,
  ClipboardList,
  AlertTriangle,
  Mic,
  MicOff,
  ChevronsUp,
  Maximize2,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { generateWordDocument } from '@/utils/documentGenerators';
import { useAutoEmail } from '@/hooks/useAutoEmail';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { format } from 'date-fns';
import { projectRisks } from './risk-register/projectRisksData';
import { actionLogData, actionLogMetadata } from '@/data/nresBoardActionsData';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ContractAskAIProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const quickPrompts = [
  {
    label: 'What is the contract duration and renewal terms?',
    icon: Clock,
    prompt: 'What is the contract duration and what are the renewal or extension terms? Include any break clauses or notice periods.'
  },
  {
    label: 'What are the key performance indicators (KPIs)?',
    icon: Target,
    prompt: 'What are the key performance indicators (KPIs) and performance targets outlined in the contract? How will they be monitored and reported?'
  },
  {
    label: 'What are the payment terms and schedule?',
    icon: PoundSterling,
    prompt: 'What are the payment terms, funding arrangements, and payment schedule? Include details on how the contract value is calculated and distributed.'
  },
  {
    label: 'What are the responsibilities of each party?',
    icon: Users,
    prompt: 'What are the key responsibilities and obligations of each party — the Provider and the Commissioner (ICB)? Summarise the main duties for each.'
  },
  {
    label: 'What are the termination clauses?',
    icon: AlertTriangle,
    prompt: 'What are the termination clauses and procedures? Under what circumstances can the contract be terminated, and what notice periods apply?'
  },
  {
    label: 'What are the data protection requirements?',
    icon: Shield,
    prompt: 'What are the data protection, confidentiality, and information governance requirements specified in the contract? Include any GDPR or Caldicott considerations.'
  },
  {
    label: 'What is the dispute resolution process?',
    icon: Scale,
    prompt: 'What is the process for dispute resolution? How should disagreements between parties be escalated and resolved?'
  },
  {
    label: 'What service level agreements (SLAs) are specified?',
    icon: ClipboardList,
    prompt: 'What specific service level agreements (SLAs) are mentioned in the contract? Include access targets, capacity requirements, and quality standards.'
  },
];

export const ContractAskAI = ({ open, onOpenChange }: ContractAskAIProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);
  const { sendEmailAutomatically, isSending } = useAutoEmail();

  // Gather dashboard context from all sources
  const gatherDashboardContext = useCallback(async () => {
    const contextParts: string[] = [];

    // 1. Action Log (from Supabase + local data)
    try {
      const { data: dbActions } = await supabase
        .from('nres_board_actions')
        .select('action_title, description, responsible_person, meeting_date, due_date, status, priority, notes')
        .order('meeting_date', { ascending: false })
        .limit(50);

      if (dbActions && dbActions.length > 0) {
        contextParts.push('## Programme Board Action Log (Live Database)\n' +
          dbActions.map(a => `- [${a.status}] ${a.action_title} | Owner: ${a.responsible_person} | Priority: ${a.priority} | Due: ${a.due_date || 'TBC'} | Notes: ${a.notes || 'None'}`).join('\n'));
      }
    } catch (e) {
      console.log('Could not fetch board actions from DB');
    }

    // Local action log data
    contextParts.push('## Programme Board Action Log (Local Records)\nNext Meeting: ' + actionLogMetadata.nextMeeting + '\n' +
      actionLogData.map(a => `- [${a.status}] #${a.actionId}: ${a.description} | Owner: ${a.owner} | Due: ${a.dueDate} | Priority: ${a.priority} | Notes: ${a.notes}`).join('\n'));

    // 2. Risk Register
    contextParts.push('## Risk Register\n' +
      projectRisks.map(r => `- Risk #${r.id}: ${r.risk} | Category: ${r.category} | Type: ${r.riskType} | Original Score: ${r.originalScore} | Current Score: ${r.currentScore} | Owner: ${r.owner} | Last Reviewed: ${r.lastReviewed}\n  Concerns: ${r.concerns}\n  Mitigation: ${r.mitigation}${r.comments ? '\n  Comments: ' + r.comments : ''}`).join('\n\n'));

    // 3. Hours Tracker summary
    try {
      const { data: hoursData } = await supabase
        .from('nres_hours_entries')
        .select('claimant_name, claimant_type, work_date, duration_hours, activity_type, description, invoice_status')
        .order('work_date', { ascending: false })
        .limit(100);

      if (hoursData && hoursData.length > 0) {
        const totalHours = hoursData.reduce((sum, e) => sum + (e.duration_hours || 0), 0);
        contextParts.push(`## Hours Tracker Summary\nTotal entries: ${hoursData.length} | Total hours: ${totalHours.toFixed(1)}\n` +
          hoursData.slice(0, 30).map(e => `- ${e.work_date}: ${e.claimant_name} (${e.claimant_type}) - ${e.duration_hours}hrs - ${e.activity_type} - ${e.description || 'No description'}${e.invoice_status === 'invoiced' ? ' [INVOICED]' : ''}`).join('\n'));
      }
    } catch (e) {
      console.log('Could not fetch hours data');
    }

    // 4. Evidence Library metadata (static)
    contextParts.push(`## Evidence Library - Key Documents
- Programme Board Meeting (24 Feb 2026): Agenda, Draft Minutes (24 Feb 2026 - DRAFT ONLY), Draft Minutes (10 Feb 2026)
- Programme Board Meeting (23 Dec 2025): Agenda, Minutes (9 Dec 2025), Terms of Reference (Approved), SDA Innovator Project Plan
- Workgroup: Finance Workgroup Minutes (17 Feb 2026), IT Task & Finish Notes (22 Jan 2026), Workforce Meeting Notes (8 Jan 2026)
- VCSE Meetings: 22 Dec 2025 (Virtual), 19 Jan 2026 (Towcester)
- Communications: PPG Engagement Materials (29 Jan 2026) - PPG briefing document and presentation shared with SNVB`);

    return contextParts.join('\n\n');
  }, []);


  // Speech recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-GB';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (event.results[event.results.length - 1].isFinal) {
            setInput(prev => prev + (prev ? ' ' : '') + transcript.trim());
          }
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
    return () => { recognitionRef.current?.abort(); };
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

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput('');
    }
  }, [open]);

  const scrollToLastAssistantMessage = () => {
    if (lastAssistantMessageRef.current && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: lastAssistantMessageRef.current.offsetTop - 20, behavior: 'smooth' });
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Gather live dashboard context
      const dashboardContext = await gatherDashboardContext();

      const { data, error } = await supabase.functions.invoke('contract-ask-ai', {
        body: {
          message: userMessage,
          conversationHistory,
          dashboardContext,
        }
      });

      if (error) throw error;

      const assistantContent = data?.response || data?.content || data?.answer ||
        'I apologise, but I was unable to generate a response.';

      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (error: any) {
      console.error('Contract AI chat error:', error);
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
    if (e.key === 'Escape') setInput('');
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

    const sections = messages.map(m => {
      const prefix = m.role === 'user' ? 'Question' : 'Answer';
      const cleanContent = m.content
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^- /gm, '• ')
        .replace(/^(\d+)\. /gm, '$1. ');
      return `${prefix}:\n\n${cleanContent}`;
    }).join('\n\n' + '─'.repeat(50) + '\n\n');

    const header = `ICB New Models Contract — AI Q&A\n\nGenerated: ${format(new Date(), 'dd MMMM yyyy HH:mm')}\n\n${'─'.repeat(50)}\n\n`;

    await generateWordDocument(header + sections, `ICB Contract Q&A - ${format(new Date(), 'dd-MM-yyyy')}`);
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

    const header = `# ICB New Models Contract — AI Q&A\n\n**Generated:** ${format(new Date(), 'dd MMMM yyyy HH:mm')}\n\n---\n\n`;

    await sendEmailAutomatically(header + content, 'ICB Contract Q&A');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "flex flex-col p-0 gap-0 [&>button]:hidden transition-all duration-200",
        isFullScreen
          ? "max-w-[95vw] h-[95vh]"
          : "max-w-4xl h-[85vh]"
      )}>
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-semibold">Ask AI about the New Models Specification</DialogTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(p => !p)} className="h-8 px-2" title={isFullScreen ? "Exit full screen" : "Full screen"}>
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportToWord} disabled={messages.length === 0 || isLoading} className="h-8 px-2" title="Export to Word">
                <FileText className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleEmailChat} disabled={messages.length === 0 || isLoading || isSending} className="h-8 px-2" title="Email conversation">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 px-2" title="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="secondary" className="text-xs">Service Specification v5</Badge>
            <Badge variant="outline" className="text-xs">Action Log</Badge>
            <Badge variant="outline" className="text-xs">Risk Register</Badge>
            <Badge variant="outline" className="text-xs">Hours Tracker</Badge>
            <Badge variant="outline" className="text-xs">Evidence Library</Badge>
          </div>
        </DialogHeader>

        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
          <div className="py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Ask questions about the <span className="font-medium text-foreground">NRES SDA Programme</span>
                </p>
                <p className="text-xs text-muted-foreground mb-6 max-w-md">
                  Connected to the Service Specification, Action Log, Risk Register, Hours Tracker &amp; Evidence Library
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
              messages.map((message, idx) => {
                const isLastAssistant = message.role === 'assistant' &&
                  idx === messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();

                return (
                  <div
                    key={idx}
                    ref={isLastAssistant ? lastAssistantMessageRef : undefined}
                    className={cn("flex gap-3", message.role === 'user' ? "justify-end" : "justify-start")}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={cn(
                      "rounded-xl",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground px-4 py-3 max-w-[75%]"
                        : "bg-card border border-border shadow-sm px-6 py-5 max-w-[95%]"
                    )}>
                      {message.role === 'assistant' ? (
                        <div
                          className="text-sm leading-relaxed text-foreground/80"
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
                );
              })
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
          {messages.length > 0 && (
            <TooltipProvider>
              <div className="flex items-center justify-center gap-2 mb-3 pb-3 border-b border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={scrollToLastAssistantMessage} disabled={!messages.some(m => m.role === 'assistant')} className="h-8 px-3 gap-1.5">
                      <ChevronsUp className="h-4 w-4" />
                      <span className="text-xs hidden sm:inline">Jump to Answer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Scroll to top of latest answer</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setMessages([])} className="h-8 px-3 gap-1.5">
                      <ArrowLeft className="h-4 w-4" />
                      <span className="text-xs hidden sm:inline">Back to Questions</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Return to quick questions menu</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleExportToWord} disabled={messages.length === 0 || isLoading} className="h-8 px-3 gap-1.5">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs hidden sm:inline">Export Word</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Download as Word document</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setIsFullScreen(p => !p)} className="h-8 px-3 gap-1.5">
                      <Maximize2 className="h-4 w-4" />
                      <span className="text-xs hidden sm:inline">{isFullScreen ? 'Exit Full' : 'Full View'}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isFullScreen ? 'Exit full screen view' : 'Expand to full screen'}</p></TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder={isListening ? "Listening..." : "Ask about the programme, contract, actions, risks..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="min-h-[80px] max-h-40 resize-none pr-10 bg-white"
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
            <div className="flex flex-col gap-2">
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
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-10 w-10"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Ctrl+Enter to send • Esc to clear • Click mic for voice input
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
