import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import MessageRenderer from '@/components/MessageRenderer';
import { Message } from '@/types/ai4gp';

interface MessagesListProps {
  messages: Message[];
  isLoading: boolean;
  expandedMessage: Message | null;
  setExpandedMessage: (message: Message | null) => void;
  onExportWord?: (content: string, title?: string) => void;
  onExportPowerPoint?: (content: string, title?: string) => void;
  cardHeight?: number;
}

export const MessagesList: React.FC<MessagesListProps> = ({
  messages,
  isLoading,
  expandedMessage,
  setExpandedMessage,
  onExportWord,
  onExportPowerPoint,
  cardHeight
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            cardHeight={cardHeight}
          />
        ))}
        
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-muted-foreground">AI is thinking...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};