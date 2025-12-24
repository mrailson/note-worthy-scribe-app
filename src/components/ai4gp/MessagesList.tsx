import React, { useRef, useEffect, useCallback, useMemo } from 'react';
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
  const parentRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const deviceInfo = useDeviceInfo();

  // Estimate row height based on message content
  const estimateSize = useCallback((index: number) => {
    const message = messages[index];
    if (!message) return 150;
    
    const contentLength = message.content?.length || 0;
    const hasFiles = message.files && message.files.length > 0;
    
    // Base height + content-based estimate
    let estimatedHeight = 100; // Base padding and controls
    
    if (message.role === 'user') {
      // User messages are generally shorter
      estimatedHeight += Math.min(contentLength / 2, 200);
      if (hasFiles) estimatedHeight += 60;
    } else {
      // Assistant messages can be much longer
      estimatedHeight += Math.min(contentLength / 3, 800);
      if (message.isStreaming) estimatedHeight += 50;
    }
    
    return Math.max(estimatedHeight, 120);
  }, [messages]);

  // Virtual list configuration
  const virtualizer = useVirtualizer({
    count: messages.length + (isLoading ? 1 : 0), // +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 3, // Render 3 extra items above/below viewport
    getItemKey: (index) => {
      if (index >= messages.length) return 'loading-indicator';
      return messages[index]?.id || `msg-${index}`;
    },
  });

  // Scroll to bottom when new message is added
  useEffect(() => {
    const currentMessageCount = messages.length;
    
    if (currentMessageCount > previousMessageCountRef.current) {
      // New message added, scroll to bottom
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
      });
      previousMessageCountRef.current = currentMessageCount;
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep scroll at bottom during streaming
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.isStreaming) {
      // Debounced scroll during streaming - only scroll every 500ms max
      const scrollTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
        });
      }, 100);
      return () => clearTimeout(scrollTimeout);
    }
  }, [messages.length, messages[messages.length - 1]?.isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize the virtual items to prevent recalculation
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn(
        "flex-1 overflow-auto",
        deviceInfo.isIPhone ? "px-4 py-3" : "px-2 sm:p-2"
      )}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
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
                showResponseMetrics={showResponseMetrics}
                showRenderTimes={showRenderTimes}
                showAIService={showAIService}
                onQuickResponse={onQuickResponse}
                onSetDrugName={onSetDrugName}
                autoCollapseUserPrompts={autoCollapseUserPrompts}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
