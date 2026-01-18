import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AssemblyRealtimeClient } from '@/lib/assembly-realtime';
import { showToast } from '@/utils/toastWrapper';
import { processMedicalText } from '@/utils/medicalTextProcessor';
export type DictationStatus = 'idle' | 'connecting' | 'recording' | 'paused' | 'processing' | 'error';
export type TemplateType = 'free' | 'consultation' | 'referral' | 'patient-letter' | 'clinical-note' | 'sick-note';

export interface DictationTemplate {
  id: TemplateType;
  name: string;
  description: string;
  prefix: string;
}

export const DICTATION_TEMPLATES: DictationTemplate[] = [
  { id: 'free', name: 'Free Dictation', description: 'Blank canvas for any content', prefix: '' },
  { id: 'consultation', name: 'Consultation Summary', description: 'Structured consultation notes', prefix: 'Consultation Summary\n\n' },
  { id: 'referral', name: 'Referral Letter', description: 'Letter to specialist or colleague', prefix: 'Dear Colleague,\n\nRe: [Patient Name]\n\n' },
  { id: 'patient-letter', name: 'Patient Letter', description: 'Direct letter to patient', prefix: 'Dear [Patient Name],\n\n' },
  { id: 'clinical-note', name: 'Clinical Note', description: 'Structured clinical documentation', prefix: 'HPC:\n\nO/E:\n\nImpression:\n\nPlan:\n' },
  { id: 'sick-note', name: 'Fit Note', description: 'Statement of fitness for work', prefix: 'This is to certify that [Patient Name] ' },
];

interface DictationSession {
  id: string;
  content: string;
  template_type: string;
  title: string | null;
  word_count: number;
  duration_seconds: number;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export function useDictation() {
  const { user } = useAuth();
  
  // State
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('free');
  const [duration, setDuration] = useState(0);
  const [history, setHistory] = useState<DictationSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  
  // Refs
  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const startTimeRef = useRef<number>(0);
  
  // Deduplication refs (like useAssemblyRealtimePreview)
  const baseContentRef = useRef<string>(''); // Content when recording started
  const recordingTranscriptRef = useRef<string>(''); // Transcript accumulated during this recording session
  const lastFinalSegmentRef = useRef<string>(''); // Last final segment for dedup
  const lastFinalAtRef = useRef<number>(0);
  
  // Convert spoken number words to digits for comparison
  const wordsToNumbers = useCallback((text: string): string => {
    const ones: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
    };
    const tens: Record<string, number> = {
      twenty: 20, thirty: 30, forty: 40, fifty: 50,
      sixty: 60, seventy: 70, eighty: 80, ninety: 90
    };

    // Parse a compound number phrase like "one hundred and thirty six"
    const parseNumberPhrase = (phrase: string): number | null => {
      const words = phrase.toLowerCase().replace(/\band\b/g, '').trim().split(/\s+/);
      let total = 0;
      let current = 0;

      for (const word of words) {
        if (ones[word] !== undefined) {
          current += ones[word];
        } else if (tens[word] !== undefined) {
          current += tens[word];
        } else if (word === 'hundred') {
          current = current === 0 ? 100 : current * 100;
        } else {
          return null; // Unknown word
        }
      }
      total += current;
      return total > 0 ? total : null;
    };

    // Match patterns like "one hundred and thirty six" or "seventy four"
    const numberWordPattern = /\b((?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s+hundred(?:\s+and)?)?(?:\s*(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?(?:[\s-]*(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))?)\b/gi;

    return text.replace(numberWordPattern, (match) => {
      const trimmed = match.trim();
      if (!trimmed || trimmed.split(/\s+/).length < 1) return match;
      
      // Skip single common words that aren't numbers in context
      const lowerMatch = trimmed.toLowerCase();
      if (['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].includes(lowerMatch)) {
        // Only convert if it looks like a BP reading context
        return match;
      }
      
      const num = parseNumberPhrase(trimmed);
      return num !== null ? String(num) : match;
    });
  }, []);

  // Normalise text for comparison (strip punctuation, lowercase, convert word numbers to digits)
  const normalise = useCallback((t: string) => {
    const withDigits = wordsToNumbers(t);
    return withDigits.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, [wordsToNumbers]);
  
  // Replace trailing segment (for when AssemblyAI sends formatted after raw)
  const replaceTrailingSegment = useCallback((full: string, oldSeg: string, newSeg: string) => {
    const t = full.trim();
    const oldT = oldSeg.trim();
    const newT = newSeg.trim();

    if (!oldT) return (t + ' ' + newT).trim();
    if (t === oldT) return newT;

    if (t.endsWith(' ' + oldT)) {
      return (t.slice(0, -(oldT.length + 1)) + ' ' + newT).trim();
    }

    if (t.endsWith(oldT)) {
      return (t.slice(0, -oldT.length) + newT).trim();
    }

    return (t + ' ' + newT).trim();
  }, []);
  
  // Check if new final should replace the last one (duplicate detection)
  const shouldReplaceLastFinal = useCallback((newText: string) => {
    const last = lastFinalSegmentRef.current;
    if (!last) return false;

    const withinWindow = Date.now() - lastFinalAtRef.current < 2000;
    if (!withinWindow) return false;

    const a = normalise(last);
    const b = normalise(newText);
    if (!a || !b) return false;

    return a === b || a.startsWith(b) || b.startsWith(a);
  }, [normalise]);
  
  // Keep contentRef in sync
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // Format duration as mm:ss
  const formatDuration = useCallback((secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('dictations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch dictation history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Auto-save draft
  const saveDraft = useCallback(async () => {
    if (!user || !contentRef.current.trim()) return;
    
    try {
      if (currentSessionId) {
        await supabase
          .from('dictations')
          .update({
            content: contentRef.current,
            word_count: contentRef.current.trim().split(/\s+/).length,
            duration_seconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSessionId);
      } else {
        const { data, error } = await supabase
          .from('dictations')
          .insert({
            user_id: user.id,
            content: contentRef.current,
            template_type: selectedTemplate,
            word_count: contentRef.current.trim().split(/\s+/).length,
            duration_seconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
            is_draft: true,
          })
          .select()
          .single();
        
        if (!error && data) {
          setCurrentSessionId(data.id);
        }
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [user, currentSessionId, selectedTemplate]);

  // Start dictation
  const startDictation = useCallback(async () => {
    if (!user) {
      showToast.error('Please sign in to use dictation');
      return;
    }

    setStatus('connecting');
    setError(null);
    startTimeRef.current = Date.now();

    // Apply template prefix if starting fresh
    const template = DICTATION_TEMPLATES.find(t => t.id === selectedTemplate);
    if (template?.prefix && !content) {
      setContent(template.prefix);
      baseContentRef.current = template.prefix;
    } else {
      baseContentRef.current = content;
    }
    
    // Reset tracking refs for new session
    recordingTranscriptRef.current = '';
    lastFinalSegmentRef.current = '';
    lastFinalAtRef.current = 0;

    try {
      const client = new AssemblyRealtimeClient({
        onOpen: () => {
          console.log('🎙️ Dictation: AssemblyAI session started');
          setStatus('recording');
          
          // Start duration timer
          durationIntervalRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }, 1000);
          
          // Start auto-save every 30 seconds
          autoSaveIntervalRef.current = setInterval(() => {
            saveDraft();
          }, 30000);
        },
        onPartial: (text) => {
          // Could show live partial preview here if needed
          console.log('🎤 Dictation partial:', text.substring(0, 30) + '...');
        },
        onFinal: (text) => {
          console.log('🎤 Dictation FINAL (raw):', text.substring(0, 50) + '...');
          
          // Apply medical text processing to correct common transcription errors
          const processedText = processMedicalText(text);
          console.log('🏥 Dictation FINAL (processed):', processedText.substring(0, 50) + '...');
          
          const now = Date.now();
          
          if (shouldReplaceLastFinal(processedText)) {
            // Replace the last final segment (AssemblyAI often sends formatted after raw)
            const prevSeg = lastFinalSegmentRef.current;
            recordingTranscriptRef.current = replaceTrailingSegment(recordingTranscriptRef.current, prevSeg, processedText);
            console.log('🔁 Replaced duplicate final segment');
          } else {
            // Append brand new final segment
            recordingTranscriptRef.current = (recordingTranscriptRef.current + ' ' + processedText).trim();
          }
          
          lastFinalSegmentRef.current = processedText;
          lastFinalAtRef.current = now;
          
          // Update content: base + recording transcript
          const newContent = (baseContentRef.current + ' ' + recordingTranscriptRef.current).trim();
          setContent(newContent);
        },
        onError: (err) => {
          console.error('Dictation error:', err);
          setError(err.message);
          setStatus('error');
        },
        onClose: (code, reason) => {
          console.log('Dictation closed:', code, reason);
          if (status === 'recording') {
            setStatus('idle');
          }
        },
        onReconnecting: () => {
          console.log('Dictation reconnecting...');
        },
        onReconnected: () => {
          console.log('Dictation reconnected');
        },
      });

      clientRef.current = client;
      await client.start();
    } catch (err) {
      console.error('Failed to start dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start dictation');
      setStatus('error');
    }
  }, [user, selectedTemplate, content, saveDraft, status]);

  // Stop dictation
  const stopDictation = useCallback(async () => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }

    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }

    // Final save
    await saveDraft();
    
    setStatus('idle');
    fetchHistory();
  }, [saveDraft, fetchHistory]);

  // Clear and start new
  const newDictation = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }

    setContent('');
    setDuration(0);
    setCurrentSessionId(null);
    setStatus('idle');
    setError(null);
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text?: string) => {
    const textToCopy = text || content;
    if (!textToCopy.trim()) {
      showToast.error('Nothing to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast.success('Copied to clipboard');
    } catch {
      showToast.error('Failed to copy');
    }
  }, [content]);

  // Copy last paragraph
  const copyLastParagraph = useCallback(async () => {
    const paragraphs = content.trim().split(/\n\n+/);
    const lastPara = paragraphs[paragraphs.length - 1];
    if (lastPara) {
      await copyToClipboard(lastPara);
    }
  }, [content, copyToClipboard]);

  // Load session from history
  const loadSession = useCallback((session: DictationSession) => {
    setContent(session.content);
    setCurrentSessionId(session.id);
    setSelectedTemplate(session.template_type as TemplateType);
    setDuration(session.duration_seconds);
    setStatus('idle');
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await supabase
        .from('dictations')
        .delete()
        .eq('id', sessionId);
      
      setHistory(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        newDictation();
      }
      
      showToast.success('Dictation deleted');
    } catch (err) {
      console.error('Failed to delete session:', err);
      showToast.error('Failed to delete');
    }
  }, [currentSessionId, newDictation]);

  // Finalize session (mark as not draft)
  const finalizeDictation = useCallback(async (title?: string) => {
    if (!currentSessionId) return;
    
    try {
      await supabase
        .from('dictations')
        .update({
          is_draft: false,
          title: title || `Dictation ${new Date().toLocaleDateString('en-GB')}`,
          content: contentRef.current,
          word_count: contentRef.current.trim().split(/\s+/).length,
          duration_seconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSessionId);
      
      showToast.success('Dictation saved');
      fetchHistory();
    } catch (err) {
      console.error('Failed to finalize:', err);
      showToast.error('Failed to save');
    }
  }, [currentSessionId, fetchHistory]);

  // Format and clean content using AI
  const formatAndClean = useCallback(async () => {
    if (!content.trim() || status === 'recording' || isFormatting) return;
    
    setIsFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-dictation', {
        body: { 
          content: content.trim(), 
          templateType: selectedTemplate 
        }
      });
      
      if (error) throw error;
      
      if (data?.formattedContent) {
        setContent(data.formattedContent);
        showToast.success('Text formatted and cleaned');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Format and clean failed:', err);
      showToast.error(err instanceof Error ? err.message : 'Failed to format text');
    } finally {
      setIsFormatting(false);
    }
  }, [content, selectedTemplate, status, isFormatting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stop();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    status,
    content,
    setContent,
    selectedTemplate,
    setSelectedTemplate,
    duration,
    wordCount,
    history,
    isLoadingHistory,
    currentSessionId,
    error,
    isFormatting,
    
    // Computed
    formatDuration,
    templates: DICTATION_TEMPLATES,
    isRecording: status === 'recording',
    isConnecting: status === 'connecting',
    
    // Actions
    startDictation,
    stopDictation,
    newDictation,
    copyToClipboard,
    copyLastParagraph,
    loadSession,
    deleteSession,
    finalizeDictation,
    fetchHistory,
    formatAndClean,
  };
}
