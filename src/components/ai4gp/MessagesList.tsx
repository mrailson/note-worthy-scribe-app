import React, { useRef, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Sparkles } from 'lucide-react';
import MessageRenderer from '@/components/MessageRenderer';
import { Message } from '@/types/ai4gp';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
  const previousMessageCountRef = useRef(0);
  const deviceInfo = useDeviceInfo();

  const scrollToBottom = () => {
    if (messagesEndRef.current && messages.length > 0) {
      const chatContainer = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]');
      if (chatContainer) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Only scroll when a NEW message is added, not when existing messages update (streaming)
  useEffect(() => {
    const currentMessageCount = messages.length;
    
    if (currentMessageCount > previousMessageCountRef.current) {
      scrollToBottom();
      previousMessageCountRef.current = currentMessageCount;
    }
  }, [messages.length]);

  return (
    <ScrollArea className={cn(
      "flex-1",
      deviceInfo.isIPhone ? "px-4 py-3" : "px-2 sm:p-2"
    )}>
      <div className={cn(
        "space-y-4",
        deviceInfo.isIPhone ? "py-3" : "py-2"
      )}>
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