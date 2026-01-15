import React, { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  onExportPowerPointWithVoiceover?: (content: string, title?: string) => void;
  showResponseMetrics?: boolean;
  showRenderTimes?: boolean;
  showAIService?: boolean;
  onQuickResponse?: (response: string) => void;
  onSetDrugName?: (drugName: string) => void;
  autoCollapseUserPrompts?: boolean;
  imageGenerationModel?: 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
}

export const MessagesList: React.FC<MessagesListProps> = ({
  messages,
  isLoading,
  expandedMessage,
  setExpandedMessage,
  onExportWord,
  onExportPowerPoint,
  onExportPowerPointWithVoiceover,
  showResponseMetrics = false,
  showRenderTimes = false,
  showAIService = false,
  onQuickResponse,
  onSetDrugName,
  autoCollapseUserPrompts = false,
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview'
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const messagesRef = useRef(messages);
  const deviceInfo = useDeviceInfo();
  
  // Keep messages ref up to date
  messagesRef.current = messages;

  // Stable count for virtualiser
  const itemCount = messages.length + (isLoading ? 1 : 0);

  // Keep virtualiser option callbacks stable (prevents internal option-reset loops)
  const getScrollElement = useCallback(() => parentRef.current, []);
  const estimateSize = useCallback(() => 200, []); // fixed estimate; measureElement handles actual sizing
  const getItemKey = useCallback((index: number) => {
    if (index >= messagesRef.current.length) return 'loading-indicator';
    return messagesRef.current[index]?.id || `msg-${index}`;
  }, []);

  // Virtual list configuration
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement,
    estimateSize,
    overscan: 3,
    getItemKey,
  });

  // Scroll to bottom when new message is added
  useEffect(() => {
    const currentMessageCount = messages.length;
    
    if (currentMessageCount > previousMessageCountRef.current && currentMessageCount > 0) {
      const timeoutId = setTimeout(() => {
        virtualizer.scrollToIndex(currentMessageCount - 1, { align: 'end', behavior: 'smooth' });
      }, 50);
      previousMessageCountRef.current = currentMessageCount;
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep scroll at bottom during streaming
  const lastMessage = messages[messages.length - 1];
  const isStreaming = lastMessage?.isStreaming;
  
  useEffect(() => {
    if (isStreaming && messages.length > 0) {
      const scrollTimeout = setTimeout(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      }, 150);
      return () => clearTimeout(scrollTimeout);
    }
  }, [isStreaming, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={cn(
        "h-full min-h-0 overflow-auto",
        deviceInfo.isIPhone ? "px-4 py-3" : "px-2 sm:p-2"
      )}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const index = virtualRow.index;
          const isLoadingIndicator = index >= messages.length;
          
          if (isLoadingIndicator) {
            return (
              <div
                key="loading-indicator"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
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
              </div>
            );
          }

          const message = messages[index];
          if (!message) return null;

          return (
            <div
              key={message.id}
              data-index={index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="py-2"
            >
              <MessageRenderer
                message={message}
                onExpandMessage={setExpandedMessage}
                onExportWord={onExportWord}
                onExportPowerPoint={onExportPowerPoint}
                onExportPowerPointWithVoiceover={onExportPowerPointWithVoiceover}
                showResponseMetrics={showResponseMetrics}
                showRenderTimes={showRenderTimes}
                showAIService={showAIService}
                onQuickResponse={onQuickResponse}
                onSetDrugName={onSetDrugName}
                autoCollapseUserPrompts={autoCollapseUserPrompts}
                imageGenerationModel={imageGenerationModel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
