import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, MessageCircle, Download, Save, History, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SpeechToText } from '@/components/SpeechToText';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { generateWordDocument } from '@/utils/documentGenerators';
import { useMeetingQAHistory } from '@/hooks/useMeetingQAHistory';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MeetingQAPanelProps {
  meetingId: string;
  meetingTitle: string;
}

export const MeetingQAPanel = ({ meetingId, meetingTitle }: MeetingQAPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { sessions, loading: historyLoading, saveSession, deleteSession } = useMeetingQAHistory(meetingId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('meeting-qa-chat', {
        body: {
          meetingId,
          question: userMessage,
          conversationHistory: messages
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer || 'I apologise, but I was unable to generate a response.'
      }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error(error.message || 'Failed to get response');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExportToWord = async () => {
    if (messages.length === 0) return;

    const content = messages.map(m => 
      `**${m.role === 'user' ? 'Question' : 'Answer'}:**\n\n${m.content}`
    ).join('\n\n---\n\n');
    
    const header = `# Meeting Q&A Chat\n\n**Meeting:** ${meetingTitle}\n\n---\n\n`;
    
    await generateWordDocument(header + content, `Meeting QA - ${meetingTitle} - ${format(new Date(), 'dd-MM-yyyy HH:mm')}`);
    toast.success('Chat exported to Word');
  };

  const handleSaveChat = async () => {
    if (messages.length === 0) {
      toast.error('No messages to save');
      return;
    }

    const firstQuestion = messages.find(m => m.role === 'user')?.content || 'Untitled Chat';
    const title = firstQuestion.length > 50 
      ? firstQuestion.substring(0, 50) + '...' 
      : firstQuestion;
    
    await saveSession(title, messages);
  };

  const handleLoadSession = (sessionMessages: Message[]) => {
    setMessages(sessionMessages);
    setHistoryOpen(false);
    toast.success('Chat loaded');
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession(sessionId);
  };

  const examplePrompts = [
    "Summarise the key points from this meeting",
    "What were the main decisions made?",
    "What action items were identified?",
    "Who was responsible for what?"
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Ask AI About This Meeting
              </CardTitle>
              <CardDescription>
                Chat with AI about the meeting transcript and notes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {messages.length > 0 && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSaveChat}
                    title="Save chat"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleExportToWord}
                    title="Export to Word"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
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
                    Ask questions about this meeting
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium">Example questions:</p>
                    {examplePrompts.map((prompt, idx) => (
                      <div 
                        key={idx}
                        className="text-left hover:text-foreground cursor-pointer transition-colors"
                        onClick={() => setInput(prompt)}
                      >
                        • {prompt}
                      </div>
                    ))}
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
                          max-w-[80%] rounded-lg px-4 py-2
                          ${msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'}
                        `}
                      >
                        {msg.role === 'user' ? (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div 
                            className="text-sm prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ 
                              __html: renderNHSMarkdown(msg.content, { enableNHSStyling: true }) 
                            }}
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
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Ask a question about this meeting..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <SpeechToText 
                onTranscription={(text) => setInput(prev => prev ? `${prev} ${text}` : text)}
                size="sm"
              />
              <Button 
                onClick={handleSend} 
                disabled={isLoading || !input.trim()}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat History Section */}
      <Card>
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <CardTitle>Chat History</CardTitle>
                </div>
                {historyOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <CardDescription>
                {sessions.length} saved conversation{sessions.length !== 1 ? 's' : ''} for this meeting
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No saved chats yet</p>
                    <p className="text-sm mt-1">Save your conversations to access them later</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate mb-1">
                              {session.title}
                            </h4>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{format(new Date(session.created_at), 'dd MMM yyyy HH:mm')}</span>
                              <span>•</span>
                              <span>{session.messages.length} messages</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLoadSession(session.messages)}
                              title="Load chat"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSession(session.id)}
                              title="Delete chat"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};