import React, { useRef, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Sparkles } from 'lucide-react';
import MessageRenderer from '@/components/MessageRenderer';
import { Message } from '@/types/ai4gp';

interface MessagesListProps {
  messages: Message[];
  isLoading: boolean;
  expandedMessage: Message | null;
  setExpandedMessage: (message: Message | null) => void;
  onExportWord?: (content: string, title?: string) => void;
  onExportPowerPoint?: (content: string, title?: string) => void;
  showResponseMetrics?: boolean;
  onQuickResponse?: (response: string) => void;
}

export const MessagesList: React.FC<MessagesListProps> = ({
  messages,
  isLoading,
  expandedMessage,
  setExpandedMessage,
  onExportWord,
  onExportPowerPoint,
  showResponseMetrics = false,
  onQuickResponse
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadingText, setLoadingText] = useState("AI is thinking...");

  const scrollToBottom = () => {
    if (messagesEndRef.current && messages.length > 0) {
      const chatContainer = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]');
      if (chatContainer) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (isLoading) {
      setLoadingText("AI is thinking...");
      
      const timer1 = setTimeout(() => {
        setLoadingText("...receiving and processing the reply...");
      }, 5000);
      
      const timer2 = setTimeout(() => {
        setLoadingText("... I hope its worth the wait...");
      }, 10000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isLoading]);

  return (
    <ScrollArea className="flex-1 px-2 sm:p-2">
      <div className="space-y-4 py-2">
        {messages.map((message) => (
          <MessageRenderer
            key={message.id}
            message={message}
            onExpandMessage={setExpandedMessage}
              onExportWord={onExportWord}
              onExportPowerPoint={onExportPowerPoint}
              showResponseMetrics={showResponseMetrics}
              onQuickResponse={onQuickResponse}
            />
        ))}
        
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="relative w-8 h-8 mr-3">
              {/* Main rotating gear */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-primary rounded-full p-1.5 animate-spin" style={{ animationDuration: '3s' }}>
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              
              {/* Secondary rotating gear */}
              <div className="absolute top-0 right-0 flex items-center justify-center">
                <div className="bg-primary/70 rounded-full p-1 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}>
                  <Sparkles className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              </div>
            </div>
            <span className="text-muted-foreground">{loadingText}</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};