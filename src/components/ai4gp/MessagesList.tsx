import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import MessageRenderer from '@/components/MessageRenderer';
import { Message } from '@/types/ai4gp';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { ChatViewSettings } from '@/types/chatViewSettings';

interface MessagesListProps {
  messages: Message[];
  isLoading: boolean;
  expandedMessage: Message | null;
  setExpandedMessage: (message: Message | null) => void;
  onExportWord?: (content: string, title?: string) => void;
  onExportPowerPoint?: (content: string, title?: string, slideCount?: number) => void;
  onExportPowerPointWithVoiceover?: (content: string, title?: string, slideCount?: number) => void;
  showResponseMetrics?: boolean;
  showRenderTimes?: boolean;
  showAIService?: boolean;
  onQuickResponse?: (response: string) => void;
  onSetDrugName?: (drugName: string) => void;
  autoCollapseUserPrompts?: boolean;
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  autoScroll?: boolean;
  onAutoScrollChange?: (value: boolean) => void;
  chatFontSize?: ChatViewSettings['fontSize'];
  compactView?: boolean;
  bubbleStyle?: ChatViewSettings['bubbleStyle'];
  scrollDuringStreaming?: boolean;
  containerSize?: ChatViewSettings['containerSize'];
}

const SCROLL_THRESHOLD = 150;

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
  onAutoScrollChange,
  chatFontSize = 'default',
  compactView = false,
  bubbleStyle = 'standard',
  scrollDuringStreaming: scrollDuringStreamingProp = true,
  containerSize = 'normal',
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const messagesRef = useRef(messages);
  const deviceInfo = useDeviceInfo();

  // --- Auto-scroll lock ref (not state — avoids re-renders) ---
  const autoScrollLocked = useRef(true);
  const isLoadingRef = useRef(isLoading);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  // --- Debounce ref for virtualizer.measure() during streaming ---
  const lastMeasureTimeRef = useRef(0);
  const lastAutoScrollTimeRef = useRef(0);
  const showScrollButtonRef = useRef(false);

  // --- Direction-based scroll unlock ---
  const previousScrollTopRef = useRef(0);
  const pendingAutoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show floating button when not at bottom
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Keep messages ref up to date
  messagesRef.current = messages;

  // Stable count for virtualiser
  const itemCount = messages.length + (isLoading ? 1 : 0);

  // Keep virtualiser option callbacks stable
  const getScrollElement = useCallback(() => parentRef.current, []);
  const estimateSize = useCallback(() => 200, []);
  const getItemKey = useCallback((index: number) => {
    if (index >= messagesRef.current.length) return 'loading-indicator';
    return messagesRef.current[index]?.id || `msg-${index}`;
  }, []);

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement,
    estimateSize,
    overscan: 3,
    getItemKey,
  });

  // --- Near-bottom check ---
  const isNearBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  // --- Scroll to the start of the latest AI message ---
  const scrollToLatestAssistant = useCallback((smooth = true) => {
    // Find the last assistant message index
    let lastAssistantIndex = -1;
    for (let i = messagesRef.current.length - 1; i >= 0; i--) {
      if (messagesRef.current[i]?.role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }
    if (lastAssistantIndex >= 0) {
      virtualizer.scrollToIndex(lastAssistantIndex, {
        align: 'start',
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else {
      const el = parentRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }
  }, [virtualizer]);

  // --- Smooth scroll helper ---
  const smoothScrollToBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el || !autoScrollLocked.current) return;

    if (isLoadingRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      scrollToLatestAssistant(true);
    }
  }, [scrollToLatestAssistant]);

  // --- Public scroll-to-latest (button click) ---
  const scrollToBottom = useCallback(() => {
    autoScrollLocked.current = true;
    setShowScrollButton(false);
    scrollToLatestAssistant(true);
  }, [scrollToLatestAssistant]);

  // --- Scroll event handler ---
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;

    // Break auto-scroll lock immediately on any upward scroll during streaming
    if (isLoadingRef.current && !nearBottom) {
      autoScrollLocked.current = false;
    }

    // Re-engage when user scrolls back to bottom
    if (nearBottom) {
      autoScrollLocked.current = true;
    }

    // Update button state only when changed
    if (showScrollButtonRef.current !== !nearBottom) {
      showScrollButtonRef.current = !nearBottom;
      setShowScrollButton(!nearBottom);
    }
  }, []);

  // Attach scroll listener (passive for perf)
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // --- Scroll on new messages (non-streaming) ---
  useEffect(() => {
    const prevCount = previousMessageCountRef.current;
    const newCount = messages.length;
    previousMessageCountRef.current = newCount;

    if (newCount > prevCount && newCount > 0) {
      const lastMsg = messages[newCount - 1];

      if (lastMsg?.role === 'user') {
        // User just sent a message — always scroll to bottom and lock
        autoScrollLocked.current = true;
        requestAnimationFrame(() => {
          parentRef.current?.scrollTo({ top: parentRef.current!.scrollHeight, behavior: 'smooth' });
        });
      } else if (lastMsg?.role === 'assistant' && autoScrollLocked.current) {
        // Assistant reply arrived — use the existing lock (set when user sent their msg)
        // Use setTimeout to let the virtualizer render the new item first
        setTimeout(() => scrollToLatestAssistant(true), 200);
      }
    }
  }, [messages.length, scrollToLatestAssistant]);

  // --- Streaming content updates ---
  const lastMessage = messages[messages.length - 1];
  const lastMessageContentLength = lastMessage?.content?.length || 0;

  useEffect(() => {
    if (isLoading && autoScrollLocked.current && scrollDuringStreamingProp) {
      const now = Date.now();
      // Throttle BOTH measure and scroll to max once per 300ms
      if (now - lastMeasureTimeRef.current > 300) {
        lastMeasureTimeRef.current = now;
        virtualizer.measure();
      }
      if (now - lastAutoScrollTimeRef.current > 300) {
        lastAutoScrollTimeRef.current = now;
        const el = parentRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }
    }
    // Show floating button if new assistant content arrives while scrolled up
    if (isLoading && !autoScrollLocked.current && lastMessage?.role === 'assistant') {
      if (!showScrollButtonRef.current) {
        showScrollButtonRef.current = true;
        setShowScrollButton(true);
      }
    }
  }, [lastMessageContentLength, isLoading, scrollDuringStreamingProp, messages.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Font size for chat bubbles - map to CSS custom property scale
  const fontSizeScale: Record<ChatViewSettings['fontSize'], number> = {
    smaller: 0.875,
    default: 1,
    larger: 1.125,
    largest: 1.25,
  };
  const textScale = fontSizeScale[chatFontSize];
  
  return (
    <div className="relative h-full min-h-0">
      <div
        ref={parentRef}
        className={cn(
          "h-full min-h-0 overflow-auto",
          deviceInfo.isIPhone ? "px-4 py-3" : "px-2 sm:p-2"
        )}
        style={{ 
          contain: 'paint',
          overscrollBehavior: 'contain',
          // Override the CSS variable for text scaling within this container
          '--ai4gp-text-scale': textScale,
        } as React.CSSProperties}
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
                data-role={message.role}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={cn(
                  compactView ? "py-1" : "py-2"
                )}
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
                  compactView={compactView}
                  bubbleStyle={bubbleStyle}
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
            "shadow-lg border border-border/50 rounded-full",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
            "h-9 px-4 gap-1.5"
          )}
          title="Scroll to bottom"
        >
          <ChevronDown className="h-4 w-4" />
          {isLoading && !autoScrollLocked.current && (
            <span className="text-xs font-medium">New response</span>
          )}
        </Button>
      )}
    </div>
  );
};