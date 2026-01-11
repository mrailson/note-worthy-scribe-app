/**
 * Hook for formatting meeting minutes using a Web Worker
 * Prevents main thread blocking for long meetings
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { stripTranscriptMarkers } from '@/utils/minutesTransformCore';
import DOMPurify from 'dompurify';

interface UseMinutesFormatterOptions {
  meetingId?: string;
  content: string;
  baseFontSize: number;
  enabled: boolean; // Only format when enabled (e.g., user clicks "Switch to formatted view")
  previewEnabled?: boolean; // Compute plain-text preview (can be expensive for huge notes)
  previewMaxChars?: number; // Optional cap for preview processing
}

interface UseMinutesFormatterResult {
  formattedHtml: string;
  isFormatting: boolean;
  plainTextPreview: string;
  error: string | null;
  formatNow: () => void; // Manual trigger for formatting
}

// Cache key generator
const getCacheKey = (meetingId: string, content: string, fontSize: number): string => {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h) ^ content.charCodeAt(i);
  }
  // Bump version to invalidate old cached worker HTML when formatter changes
  return `minutes-worker-v2-${meetingId}-${(h >>> 0).toString(16)}-fs${fontSize}`;
};

export function useMinutesFormatter({
  meetingId,
  content,
  baseFontSize,
  enabled,
  previewEnabled = true,
  previewMaxChars
}: UseMinutesFormatterOptions): UseMinutesFormatterResult {
  const [formattedHtml, setFormattedHtml] = useState<string>('');
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [plainTextPreview, setPlainTextPreview] = useState<string>('');
  
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build plain text preview asynchronously to avoid blocking modal open / scrolling
  useEffect(() => {
    if (!previewEnabled) {
      setPlainTextPreview('');
      return;
    }

    if (!content) {
      setPlainTextPreview('');
      return;
    }

    const input = typeof previewMaxChars === 'number' && previewMaxChars > 0
      ? content.slice(0, previewMaxChars)
      : content;

    // Hard guard: do not attempt expensive preview processing for huge notes
    if (input.length > 20000) {
      setPlainTextPreview('');
      return;
    }

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      try {
        const res = stripTranscriptMarkers(input);
        if (!cancelled) setPlainTextPreview(res);
      } catch (e) {
        console.warn('[useMinutesFormatter] Failed to build plain text preview:', e);
        if (!cancelled) setPlainTextPreview('');
      }
    };

    const ric = (globalThis as any).requestIdleCallback as undefined | ((cb: () => void, opts?: any) => number);
    const cic = (globalThis as any).cancelIdleCallback as undefined | ((id: number) => void);

    if (typeof ric === 'function') {
      const id = ric(run, { timeout: 250 });
      return () => {
        cancelled = true;
        if (typeof cic === 'function') cic(id);
      };
    }

    const t = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [content, previewEnabled, previewMaxChars]);
  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Reset state when content changes significantly
  useEffect(() => {
    setFormattedHtml('');
    setError(null);
  }, [meetingId, content]);

  const formatNow = useCallback(() => {
    if (!content || !meetingId) return;

    // Check cache first
    const cacheKey = getCacheKey(meetingId, content, baseFontSize);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log('[useMinutesFormatter] Using cached HTML');
      setFormattedHtml(cached);
      setIsFormatting(false);
      return;
    }

    // Terminate existing worker if any
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    setIsFormatting(true);
    setError(null);

    // Create new worker
    try {
      workerRef.current = new Worker(
        new URL('../workers/minutesFormatter.worker.ts', import.meta.url),
        { type: 'module' }
      );

      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      requestIdRef.current = requestId;

      // Set timeout (10 seconds)
      timeoutRef.current = setTimeout(() => {
        console.warn('[useMinutesFormatter] Worker timed out after 10 seconds');
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        setIsFormatting(false);
        setError('Formatting timed out. Try using plain text view.');
        // Fallback to plain text
        setFormattedHtml('');
      }, 10000);

      workerRef.current.onmessage = (event) => {
        const { type, html, requestId: respId, success, error: workerError } = event.data;

        if (type === 'formatted' && respId === requestIdRef.current) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          if (success && html) {
            // Sanitize on main thread (DOMPurify requires DOM access)
            const sanitizedHtml = DOMPurify.sanitize(html, {
              ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'style', 'svg', 'path'],
              ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'style', 'value', 'fill', 'viewBox', 'fill-rule', 'clip-rule', 'd'],
              SAFE_FOR_TEMPLATES: true,
              RETURN_DOM_FRAGMENT: false,
              FORCE_BODY: true
            });
            
            setFormattedHtml(sanitizedHtml);
            // Cache the result
            try {
              localStorage.setItem(cacheKey, sanitizedHtml);
            } catch (e) {
              console.warn('[useMinutesFormatter] Failed to cache HTML:', e);
            }
          } else {
            setError(workerError || 'Formatting failed');
            setFormattedHtml('');
          }
          setIsFormatting(false);
        }
      };

      workerRef.current.onerror = (err) => {
        console.error('[useMinutesFormatter] Worker error:', err);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setError('Formatting worker error');
        setIsFormatting(false);
      };

      // Send format request
      workerRef.current.postMessage({
        type: 'format',
        content,
        baseFontSize,
        requestId
      });

    } catch (err) {
      console.error('[useMinutesFormatter] Failed to create worker:', err);
      setError('Failed to start formatter');
      setIsFormatting(false);
    }
  }, [content, meetingId, baseFontSize]);

  // Auto-format when enabled and content is available
  useEffect(() => {
    if (enabled && content && meetingId && !formattedHtml && !isFormatting) {
      formatNow();
    }
  }, [enabled, content, meetingId, formattedHtml, isFormatting, formatNow]);

  return {
    formattedHtml,
    isFormatting,
    plainTextPreview,
    error,
    formatNow
  };
}
