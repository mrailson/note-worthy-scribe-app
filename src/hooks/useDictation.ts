import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AssemblyRealtimeClient } from '@/lib/assembly-realtime';
import { showToast } from '@/utils/toastWrapper';

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
  
  // Refs
  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const startTimeRef = useRef<number>(0);
  const lastFinalTextRef = useRef<string>(''); // Track last final to avoid duplicates
  const baseContentRef = useRef<string>(''); // Content before this recording session started
  
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
    lastFinalTextRef.current = '';

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
          // Show partial as a preview (optional - could add live preview state)
        },
        onFinal: (text) => {
          // AssemblyAI v3 sends cumulative transcripts, so we need to deduplicate
          // Only add the new portion that wasn't in the last final
          const lastFinal = lastFinalTextRef.current;
          
          let newText = text;
          if (lastFinal && text.startsWith(lastFinal)) {
            // Text is cumulative, extract only the new part
            newText = text.slice(lastFinal.length).trim();
          } else if (lastFinal && text.includes(lastFinal)) {
            // Partial overlap - find where new content starts
            const idx = text.lastIndexOf(lastFinal);
            newText = text.slice(idx + lastFinal.length).trim();
          }
          
          // Update last final reference
          lastFinalTextRef.current = text;
          
          if (newText) {
            setContent(prev => {
              const separator = prev.trim() ? ' ' : '';
              return prev + separator + newText;
            });
          }
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
  };
}
