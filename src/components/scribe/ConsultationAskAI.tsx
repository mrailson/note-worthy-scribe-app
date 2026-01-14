import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, MessageCircle, Download, Save, Trash2, X, Mail, FileText, Stethoscope, AlertTriangle, ClipboardList, FileCheck, Search, Sparkles, Building, ChevronDown, ChevronUp, NotebookTabs, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAutoEmail } from '@/hooks/useAutoEmail';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useReferralDestinations } from '@/hooks/useReferralDestinations';
import { useAIChatHistory, AIChatMessage } from '@/hooks/useAIChatHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedBrowserMic, EnhancedBrowserMicRef } from '@/components/ai4gp/EnhancedBrowserMic';
import { generateWordDocument } from '@/utils/documentGenerators';
import { generateNHSLetterDocument, shouldUseNHSLetterExport } from '@/utils/nhsLetterExport';
import { format } from 'date-fns';
import { ScribeSession, SOAPNote } from '@/types/scribe';
import { ReferralDestination } from '@/types/referral';
import { EditableAIResponse } from './EditableAIResponse';
import { AIChatHistoryPanel } from './AIChatHistoryPanel';
import { LetterPreviewModal } from './LetterPreviewModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  editedContent?: string;
  id?: string;
}

interface ConsultationAskAIProps {
  session: ScribeSession;
  soapNote?: SOAPNote;
}

const QUICK_PROMPTS = [
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

// Collapsible user request component - shows first 2 lines by default
const CollapsibleUserRequest = ({ content }: { content: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const lines = content.split('\n');
  const previewLines = lines.slice(0, 2).join('\n');
  const hasMore = lines.length > 2 || content.length > 150;
  
  if (!hasMore) {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-1">
        {!isOpen && (
          <p className="text-sm whitespace-pre-wrap">
            {previewLines.length > 150 ? previewLines.slice(0, 150) + '...' : previewLines}
            {lines.length > 2 && '...'}
          </p>
        )}
        <CollapsibleContent>
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </CollapsibleContent>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 py-0 text-xs text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            {isOpen ? (
              <>Show less <ChevronUp className="h-3 w-3 ml-1" /></>
            ) : (
              <>Show more <ChevronDown className="h-3 w-3 ml-1" /></>
            )}
          </Button>
        </CollapsibleTrigger>
      </div>
    </Collapsible>
  );
};

export const ConsultationAskAI = ({ session, soapNote }: ConsultationAskAIProps) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<EnhancedBrowserMicRef>(null);
  const { sendEmailAutomatically, isSending: isEmailSending } = useAutoEmail();
  const { practiceContext } = usePracticeContext();
  const { destinations } = useReferralDestinations();
  
  // Chat history hook
  const {
    sessions: chatSessions,
    currentSession,
    isSaving,
    isLoading: isLoadingHistory,
    createSession,
    saveMessages,
    updateMessageContent,
    loadSession,
    deleteSession,
    startNewChat
  } = useAIChatHistory(session.id || null);

  // Get practice name and doctor name from practice context
  const practiceName = practiceContext.practiceName || null;
  const doctorName = practiceContext.userFullName || null;
  const letterSignature = practiceContext.letterSignature || null;

  // Load messages from current session
  useEffect(() => {
    if (currentSession) {
      setMessages(currentSession.messages.map(m => ({
        role: m.role,
        content: m.content,
        editedContent: m.editedContent,
        id: m.id
      })));
    }
  }, [currentSession]);


  const handleCreateReferral = (destination?: ReferralDestination) => {
    let destinationInfo = '';
    
    if (destination) {
      const destParts = [
        `\n\n**Referral Destination Details:**`,
        `- **Department:** ${destination.department}`,
        `- **Hospital:** ${destination.hospital_name}`,
      ];
      
      if (destination.address) {
        destParts.push(`- **Address:** ${destination.address}`);
      }
      if (destination.contact_name) {
        destParts.push(`- **Contact Name:** ${destination.contact_name}`);
      }
      if (destination.email) {
        destParts.push(`- **Email:** ${destination.email}`);
      }
      if (destination.phone) {
        destParts.push(`- **Phone:** ${destination.phone}`);
      }
      if (destination.fax) {
        destParts.push(`- **Fax:** ${destination.fax}`);
      }
      
      destParts.push(`\nUse these EXACT details for the recipient section of the letter. Do NOT use placeholder text like [Hospital Name] or [Hospital Address].`);
      destinationInfo = destParts.join('\n');
    }
    
    const signatureInfo = letterSignature 
      ? `\n\nPlease end the letter with this signature:\n${letterSignature}`
      : doctorName 
        ? `\n\nSign the letter as: ${doctorName}${practiceName ? `, ${practiceName}` : ''}`
        : '';

    const prompt = `Based on this consultation, draft a professional NHS referral letter.${destinationInfo}

Include:
- Patient details and reason for referral
- Relevant clinical history and examination findings
- Current medications and allergies
- Specific questions or investigations requested${signatureInfo}`;

    handleSend(prompt);
  };

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
      } : undefined,
      // Include practice and clinician context for professional signatures
      clinicianName: doctorName,
      letterSignature: letterSignature,
      practiceName: practiceName,
      practiceAddress: practiceContext.practiceAddress,
      practicePhone: practiceContext.practicePhone,
      practiceEmail: practiceContext.practiceEmail
    };
  };

  const handleSend = async (promptText?: string) => {
    const question = promptText || input.trim();
    if (!question || isLoading) return;

    const messageId = crypto.randomUUID();
    const userMessage: Message = { role: 'user', content: question, id: messageId };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
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
          content: 'I apologise, there was an error processing your request. Please try again.',
          id: crypto.randomUUID()
        }]);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error}`,
          id: crypto.randomUUID()
        }]);
        return;
      }

      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data?.answer || 'No response received.',
        id: assistantId
      };
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Save to history
      const aiMessages: AIChatMessage[] = finalMessages.map(m => ({
        role: m.role,
        content: m.content,
        editedContent: m.editedContent,
        timestamp: new Date().toISOString(),
        id: m.id || crypto.randomUUID()
      }));

      if (currentSession) {
        await saveMessages(aiMessages);
      } else {
        await createSession(aiMessages);
      }
    } catch (err) {
      console.error('Error in handleSend:', err);
      toast.error('Failed to get AI response');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologise, there was an error processing your request. Please try again.',
        id: crypto.randomUUID()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle content edit from EditableAIResponse
  const handleContentEdit = useCallback(async (messageId: string, editedContent: string) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, editedContent } : m
    ));

    // Save to database
    await updateMessageContent(messageId, editedContent);
  }, [updateMessageContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
      micRef.current?.clearTranscript();
    }
    if (e.key === 'Escape' && input.trim()) {
      e.preventDefault();
      handleClearInput();
    }
  };

  const handleClearInput = () => {
    setInput('');
    micRef.current?.clearTranscript();
    textareaRef.current?.focus();
  };

  const handleTranscriptUpdate = (text: string) => {
    setInput(text);
  };

  const handleExportToWord = async () => {
    if (messages.length === 0) return;

    const content = messages.map(m => 
      `**${m.role === 'user' ? 'Question' : 'Answer'}:**\n\n${m.content}`
    ).join('\n\n---\n\n');
    
    const headerParts = [
      '# Consultation Q&A Chat',
      '',
      practiceName ? `**Practice:** ${practiceName}` : null,
      doctorName ? `**Clinician:** ${doctorName}` : null,
      `**Consultation Type:** ${session.consultationType || 'Unknown'}`,
      `**Date:** ${format(new Date(session.createdAt), 'dd/MM/yyyy HH:mm')}`,
      '',
      '---',
      ''
    ].filter(Boolean).join('\n');
    
    await generateWordDocument(headerParts + content, `Consultation QA - ${format(new Date(), 'dd-MM-yyyy HH:mm')}`);
    toast.success('Chat exported to Word');
  };

  const handleEmailChat = async () => {
    if (messages.length === 0) return;
    
    const content = messages.map(m => 
      `**${m.role === 'user' ? 'Question' : 'Answer'}:**\n\n${m.content}`
    ).join('\n\n---\n\n');
    
    const headerParts = [
      '# Consultation Q&A Chat',
      '',
      practiceName ? `**Practice:** ${practiceName}` : null,
      doctorName ? `**Clinician:** ${doctorName}` : null,
      `**Consultation Type:** ${session.consultationType || 'Unknown'}`,
      `**Date:** ${format(new Date(session.createdAt), 'dd/MM/yyyy HH:mm')}`,
      '',
      '---',
      ''
    ].filter(Boolean).join('\n');
    
    await sendEmailAutomatically(headerParts + content, `Consultation Q&A - ${format(new Date(session.createdAt), 'dd/MM/yyyy')}`);
  };

  // Handle download single message with NHS letter format detection
  const handleDownloadMessage = useCallback(async (content: string) => {
    const isLetter = shouldUseNHSLetterExport(content);
    
    if (isLetter) {
      await generateNHSLetterDocument({
        content,
        filename: `Letter - ${format(new Date(), 'dd-MM-yyyy HH-mm')}`,
        practiceName: practiceContext.practiceName,
        practiceAddress: practiceContext.practiceAddress,
        practicePhone: practiceContext.practicePhone,
        practiceEmail: practiceContext.practiceEmail,
        practiceLogoUrl: practiceContext.logoUrl,
        clinicianName: doctorName || undefined,
      });
    } else {
      await generateWordDocument(content, `AI Response - ${format(new Date(), 'dd-MM-yyyy HH-mm')}`);
    }
    toast.success('Downloaded to Word');
  }, [practiceContext, doctorName]);

  // Handle email single message
  const handleEmailMessage = useCallback(async (content: string) => {
    await sendEmailAutomatically(content, `AI Response - ${format(new Date(), 'dd/MM/yyyy')}`);
  }, [sendEmailAutomatically]);

  // Handle expand single message (show in letter preview modal)
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  
  const handleExpandMessage = useCallback((content: string) => {
    setExpandedContent(content);
  }, []);

  const handleClearChat = async () => {
    // If there's a current session, delete it from the database
    if (currentSession?.id) {
      await deleteSession(currentSession.id);
    }
    setMessages([]);
    setInput('');
    micRef.current?.clearTranscript();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Ask AI About This Consultation
              </CardTitle>
              <CardDescription>
                Chat with AI about the consultation transcript and notes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <AIChatHistoryPanel
                sessions={chatSessions}
                currentSessionId={currentSession?.id}
                isLoading={isLoadingHistory}
                onSelectSession={loadSession}
                onDeleteSession={deleteSession}
                onNewChat={() => {
                  startNewChat();
                  setMessages([]);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  startNewChat();
                  setMessages([]);
                }}
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/settings')}
                title="Manage referral destinations"
              >
                <NotebookTabs className="h-4 w-4" />
              </Button>
              {messages.length > 0 && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleEmailChat}
                    disabled={isEmailSending}
                    title="Email to me"
                  >
                    {isEmailSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleExportToWord}
                    title="Export to Word"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title={currentSession ? "Delete chat" : "Clear chat"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {currentSession ? "Delete this chat?" : "Clear chat?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {currentSession 
                            ? "This will permanently delete this conversation from your history and cannot be undone."
                            : "This will clear all messages from the current chat."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearChat}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {currentSession ? "Delete" : "Clear"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Chat Messages */}
            <ScrollArea className="h-[400px] border rounded-lg p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Ask questions about this consultation
                  </p>
                  <div className="w-full max-w-lg space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Quick actions:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Create Referral with destination selection */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-auto py-2 px-3 justify-start text-left"
                            disabled={isLoading}
                          >
                            <FileText className="h-4 w-4 mr-2 shrink-0 text-primary" />
                            <span className="text-xs">Create referral</span>
                            <ChevronDown className="h-3 w-3 ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                          <DropdownMenuItem onClick={() => handleCreateReferral()}>
                            <FileText className="h-4 w-4 mr-2" />
                            General referral (AI suggests specialty)
                          </DropdownMenuItem>
                          {destinations.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Saved destinations
                              </DropdownMenuLabel>
                              {destinations.slice(0, 5).map((dest) => (
                                <DropdownMenuItem key={dest.id} onClick={() => handleCreateReferral(dest)}>
                                  <Building className="h-4 w-4 mr-2" />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{dest.department}</span>
                                    <span className="text-xs text-muted-foreground">{dest.hospital_name}</span>
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="h-auto py-2 px-3 justify-start text-left"
                          onClick={() => handleSend(prompt.prompt)}
                          disabled={isLoading}
                        >
                          <prompt.icon className="h-4 w-4 mr-2 shrink-0 text-primary" />
                          <span className="text-xs">{prompt.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                      )}
                      <div
                        className={`
                          max-w-[85%] rounded-lg
                          ${msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground px-4 py-2' 
                            : 'bg-muted'}
                        `}
                      >
                        {msg.role === 'user' ? (
                          <CollapsibleUserRequest content={msg.content} />
                        ) : (
                          <EditableAIResponse
                            content={msg.content}
                            editedContent={msg.editedContent}
                            messageId={msg.id || `msg-${idx}`}
                            onContentChange={(content) => handleContentEdit(msg.id || `msg-${idx}`, content)}
                            onDownload={handleDownloadMessage}
                            onEmail={handleEmailMessage}
                            onExpand={handleExpandMessage}
                            isSaving={isSaving}
                          />
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-accent" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask a question about this consultation..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="min-h-[80px] max-h-40 resize-none pr-10"
                  rows={3}
                />
                {/* Clear button */}
                {input.trim().length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 bottom-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                    onClick={handleClearInput}
                    title="Clear input (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <EnhancedBrowserMic
                  ref={micRef}
                  onTranscriptUpdate={handleTranscriptUpdate}
                  onRecordingStart={() => textareaRef.current?.focus()}
                  disabled={isLoading}
                  compact
                />
                <Button 
                  onClick={() => {
                    handleSend();
                    micRef.current?.clearTranscript();
                  }} 
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="h-10 w-10"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center pt-1">
              <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded mr-1">Ctrl+Enter</kbd>
              to send • <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded mr-1">Esc</kbd>
              to clear • <span className="text-blue-600 font-medium">🎙️ Voice control with pause</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Letter Preview Modal */}
      <LetterPreviewModal
        open={!!expandedContent}
        onOpenChange={() => setExpandedContent(null)}
        content={expandedContent || ''}
        onDownload={handleDownloadMessage}
        onEmail={handleEmailMessage}
        practiceContext={{
          practiceName: practiceContext.practiceName,
          practiceAddress: practiceContext.practiceAddress,
          practicePhone: practiceContext.practicePhone,
          practiceEmail: practiceContext.practiceEmail,
          logoUrl: practiceContext.logoUrl,
          userFullName: practiceContext.userFullName,
        }}
      />
    </div>
  );
};
