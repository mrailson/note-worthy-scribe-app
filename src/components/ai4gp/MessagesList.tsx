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
  showRenderTimes?: boolean;
  showAIService?: boolean;
  onQuickResponse?: (response: string) => void;
  onSetDrugName?: (drugName: string) => void;
  autoCollapseUserPrompts?: boolean;
}

export const MessagesList: React.FC<MessagesListProps> = ({
  messages,
  isLoading,
  expandedMessage,
  setExpandedMessage,
  onExportWord,
  onExportPowerPoint,
  showResponseMetrics = false,
  showRenderTimes = false,
  showAIService = false,
  onQuickResponse,
  onSetDrugName,
  autoCollapseUserPrompts = false
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
              showResponseMetrics={showResponseMetrics}
              showRenderTimes={showRenderTimes}
              showAIService={showAIService}
              onQuickResponse={onQuickResponse}
              onSetDrugName={onSetDrugName}
              autoCollapseUserPrompts={autoCollapseUserPrompts}
            />
        ))}
        
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm">Working on it...</span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite]"></span>
                <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></span>
                <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.2s]"></span>
                <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.3s]"></span>
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};