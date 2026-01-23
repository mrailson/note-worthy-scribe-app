import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import MessageRenderer from '@/components/MessageRenderer';
import { Message } from '@/types/ai4gp';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';

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
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  autoScroll?: boolean;
  onAutoScrollChange?: (value: boolean) => void;
}

const AUTO_SCROLL_STORAGE_KEY = 'ai4gp-chat-auto-scroll';

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
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview',
  autoScroll: autoScrollProp,
  onAutoScrollChange
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const messagesRef = useRef(messages);
  const deviceInfo = useDeviceInfo();
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-scroll state - use prop if provided, otherwise manage internally with localStorage
  const [internalAutoScroll, setInternalAutoScroll] = useState(() => {
    const saved = localStorage.getItem(AUTO_SCROLL_STORAGE_KEY);
    return saved !== null ? saved === 'true' : true;
  });
  
  const autoScroll = autoScrollProp !== undefined ? autoScrollProp : internalAutoScroll;
  const setAutoScroll = onAutoScrollChange || setInternalAutoScroll;
  
  // Track if user is manually scrolling
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  
  // Show floating button when not at bottom
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Keep messages ref up to date
  messagesRef.current = messages;

  // Persist auto-scroll preference
  useEffect(() => {
    if (autoScrollProp === undefined) {
      localStorage.setItem(AUTO_SCROLL_STORAGE_KEY, String(internalAutoScroll));
    }
  }, [internalAutoScroll, autoScrollProp]);

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

  // Check if scrolled near bottom
  const isNearBottom = useCallback(() => {
    const container = parentRef.current;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
      setShowScrollButton(false);
      setIsUserScrolling(false);
    }
  }, [messages.length, virtualizer]);

  // Handle user scroll detection
  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    setShowScrollButton(!nearBottom);
    
    if (!autoScroll) return;
    
    // If user scrolled away from bottom, mark as user scrolling
    if (!nearBottom) {
      setIsUserScrolling(true);
      
      // Clear any existing timeout
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      
      // Resume auto-scroll after 5 seconds of no manual scrolling
      userScrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 5000);
    } else {
      setIsUserScrolling(false);
    }
  }, [autoScroll, isNearBottom]);

  // Attach scroll listener
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Scroll to bottom when new message is added
  useEffect(() => {
    const currentMessageCount = messages.length;
    
    if (currentMessageCount > previousMessageCountRef.current && currentMessageCount > 0) {
      if (autoScroll && !isUserScrolling) {
        const timeoutId = setTimeout(() => {
          virtualizer.scrollToIndex(currentMessageCount - 1, { align: 'end', behavior: 'smooth' });
        }, 50);
        previousMessageCountRef.current = currentMessageCount;
        return () => clearTimeout(timeoutId);
      }
      previousMessageCountRef.current = currentMessageCount;
    }
  }, [messages.length, autoScroll, isUserScrolling, virtualizer]);

  // Keep scroll at bottom during streaming - watch content length
  const lastMessage = messages[messages.length - 1];
  const isStreaming = lastMessage?.isStreaming;
  const lastMessageContentLength = lastMessage?.content?.length || 0;
  
  useEffect(() => {
    if (isStreaming && autoScroll && !isUserScrolling && messages.length > 0) {
      const scrollTimeout = setTimeout(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      }, 100);
      return () => clearTimeout(scrollTimeout);
    }
  }, [isStreaming, lastMessageContentLength, autoScroll, isUserScrolling, messages.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div className="relative h-full min-h-0">
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
      
      {/* Floating scroll to bottom button */}
      {showScrollButton && messages.length > 0 && (
        <Button
          onClick={scrollToBottom}
          size="sm"
          variant="secondary"
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 z-10",
            "shadow-lg border border-border/50",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
            "flex items-center gap-1.5"
          )}
        >
          <ArrowDown className="h-4 w-4" />
          <span className="text-xs">New messages</span>
        </Button>
      )}
    </div>
  );
};