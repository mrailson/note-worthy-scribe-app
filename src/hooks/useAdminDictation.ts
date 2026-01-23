import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AssemblyRealtimeClient } from '@/lib/assembly-realtime';
import { showToast } from '@/utils/toastWrapper';
import { createTranscriber, isBatchService, UnifiedTranscriber } from '@/utils/TranscriptionServiceFactory';
export type AdminDictationStatus = 'idle' | 'connecting' | 'recording' | 'paused' | 'processing' | 'error';
export type AdminTemplateType = 'free' | 'complaint-response' | 'hr-record' | 'briefing-note';

export interface AdminDictationTemplate {
  id: AdminTemplateType;
  name: string;
  description: string;
  prefix: string;
}

export const ADMIN_DICTATION_TEMPLATES: AdminDictationTemplate[] = [
  { id: 'free', name: 'Free Dictation', description: 'Blank canvas for any content', prefix: '' },
  { id: 'complaint-response', name: 'Complaint Response', description: 'Professional complaint handling', prefix: 'RE: Complaint Reference\n\nDear ,\n\nThank you for your correspondence dated...\n\n' },
  { id: 'hr-record', name: 'HR Documentation', description: 'Absence, appraisal, disciplinary', prefix: 'Staff Member:\nDate:\nType:\n\nDetails:\n\nOutcome:\n' },
  { id: 'briefing-note', name: 'Briefing Note', description: 'Quick updates for staff', prefix: 'Briefing Note\n\nSubject:\nDate:\n\nKey Points:\n\nAction Required:\n' },
];

interface AdminDictationSession {
  id: string;
  content: string;
  cleaned_content: string | null;
  template_type: string;
  title: string | null;
  word_count: number;
  duration_seconds: number;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export function useAdminDictation() {
  const { user } = useAuth();
  
  // State
  const [status, setStatus] = useState<AdminDictationStatus>('idle');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<AdminTemplateType>('free');
  const [duration, setDuration] = useState(0);
  const [history, setHistory] = useState<AdminDictationSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
  
  
  // View toggle state - original vs cleaned
  const [originalContent, setOriginalContent] = useState('');
  const [cleanedContent, setCleanedContent] = useState('');
  const [showCleaned, setShowCleaned] = useState(true);
  const [autoCleanEnabled, setAutoCleanEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-dictation-auto-clean');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  
  // Persist auto-clean preference
  useEffect(() => {
    localStorage.setItem('admin-dictation-auto-clean', JSON.stringify(autoCleanEnabled));
  }, [autoCleanEnabled]);
  
  // Refs
  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const transcriberRef = useRef<UnifiedTranscriber | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const startTimeRef = useRef<number>(0);
  
  // Deduplication refs
  const baseContentRef = useRef<string>('');
  const recordingTranscriptRef = useRef<string>('');
  const currentPartialRef = useRef<string>('');
  const lastFinalSegmentRef = useRef<string>('');
  const lastFinalAtRef = useRef<number>(0);
  const recentFinalsRef = useRef<Array<{text: string; normText: string; timestamp: number}>>([]);
  const RECENT_WINDOW_MS = 15000;
  const MAX_RECENT_FINALS = 10;

  // Normalise text for comparison
  const normalise = useCallback((t: string) => {
    return t.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);
  
  const getWords = useCallback((text: string): string[] => {
    return normalise(text).split(' ').filter(w => w.length > 0);
  }, [normalise]);
  
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
  
  const shouldReplaceLastFinal = useCallback((newText: string) => {
    const last = lastFinalSegmentRef.current;
    if (!last) return false;

    const withinWindow = Date.now() - lastFinalAtRef.current < 10000;
    if (!withinWindow) return false;

    const a = normalise(last);
    const b = normalise(newText);
    if (!a || !b) return false;

    return a === b || a.startsWith(b) || b.startsWith(a);
  }, [normalise]);
  
  const hasSubstantialOverlap = useCallback((newText: string, existingText: string, threshold = 0.65): boolean => {
    const newWords = getWords(newText);
    const existingWords = getWords(existingText);
    
    if (newWords.length < 5 || existingWords.length < 5) return false;
    
    const checkWindow = Math.min(12, existingWords.length);
    const tailOfExisting = existingWords.slice(-checkWindow);
    const newWordStr = newWords.join(' ');
    const tailStr = tailOfExisting.join(' ');
    
    if (newWordStr.includes(tailStr)) return true;
    
    const newSet = new Set(newWords);
    let matchCount = 0;
    const checkCount = Math.min(25, existingWords.length);
    for (const word of existingWords.slice(-checkCount)) {
      if (newSet.has(word)) matchCount++;
    }
    
    return matchCount / checkCount >= threshold;
  }, [getWords]);
  
  const isAlreadyInTranscript = useCallback((newText: string): boolean => {
    const existing = recordingTranscriptRef.current;
    if (!existing || !newText) return false;
    
    const normNew = normalise(newText);
    const normExisting = normalise(existing);
    
    if (!normNew || normNew.length < 15) return false;
    
    if (normExisting.includes(normNew)) return true;
    
    const now = Date.now();
    const recentFinals = recentFinalsRef.current.filter(f => now - f.timestamp < RECENT_WINDOW_MS);
    const recentNormConcat = recentFinals.map(f => f.normText).join(' ');
    
    if (recentNormConcat && recentNormConcat.length > 20) {
      if (hasSubstantialOverlap(normNew, recentNormConcat, 0.6)) return true;
      if (recentNormConcat.includes(normNew)) return true;
    }
    
    const tail500 = normExisting.slice(-500);
    if (tail500.length > 50 && hasSubstantialOverlap(normNew, tail500, 0.65)) return true;
    
    return false;
  }, [normalise, hasSubstantialOverlap]);
  
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const formatDuration = useCallback((secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Fetch history from admin_dictations table
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('admin_dictations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setHistory((data || []) as AdminDictationSession[]);
    } catch (err) {
      console.error('Failed to fetch admin dictation history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Auto-save draft to admin_dictations
  const saveDraft = useCallback(async () => {
    if (!user || !contentRef.current.trim()) return;
    
    try {
      if (currentSessionId) {
        await supabase
          .from('admin_dictations')
          .update({
            content: contentRef.current,
            word_count: contentRef.current.trim().split(/\s+/).length,
            duration_seconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSessionId);
      } else {
        const { data, error } = await supabase
          .from('admin_dictations')
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

    const template = ADMIN_DICTATION_TEMPLATES.find(t => t.id === selectedTemplate);
    if (template?.prefix && !content) {
      setContent(template.prefix);
      baseContentRef.current = template.prefix;
    } else {
      baseContentRef.current = content;
    }
    
    recordingTranscriptRef.current = '';
    currentPartialRef.current = '';
    lastFinalSegmentRef.current = '';
    lastFinalAtRef.current = 0;
    recentFinalsRef.current = [];

    console.log('🎙️ Starting dictation with AssemblyAI');

    try {
      // Handle system audio capture for AssemblyAI
      let externalStream: MediaStream | undefined;
      if (systemAudioEnabled) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          });
          
          const systemAudioTrack = displayStream.getAudioTracks()[0];
          displayStream.getVideoTracks().forEach(track => track.stop());
          
          if (systemAudioTrack) {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            
            const audioContext = new AudioContext();
            const destination = audioContext.createMediaStreamDestination();
            
            const micSource = audioContext.createMediaStreamSource(micStream);
            const systemSource = audioContext.createMediaStreamSource(new MediaStream([systemAudioTrack]));
            
            micSource.connect(destination);
            systemSource.connect(destination);
            
            externalStream = destination.stream;
          }
        } catch (err) {
          console.warn('Failed to capture system audio:', err);
          showToast.error('Could not capture system audio. Using microphone only.');
        }
      }

      // Handle transcription result callbacks (shared across all services)
      const handleTranscription = (data: { text: string; is_final: boolean; confidence: number }) => {
        if (data.is_final) {
          currentPartialRef.current = '';
          
          const now = Date.now();
          const text = data.text;
          const normText = normalise(text);
          
          recentFinalsRef.current = recentFinalsRef.current
            .filter(f => now - f.timestamp < RECENT_WINDOW_MS)
            .slice(-MAX_RECENT_FINALS);
          
          if (shouldReplaceLastFinal(text)) {
            const prevSeg = lastFinalSegmentRef.current;
            recordingTranscriptRef.current = replaceTrailingSegment(recordingTranscriptRef.current, prevSeg, text);
            
            if (recentFinalsRef.current.length > 0) {
              recentFinalsRef.current[recentFinalsRef.current.length - 1] = { text, normText, timestamp: now };
            }
          } else if (isAlreadyInTranscript(text)) {
            // Skip duplicate
          } else {
            recordingTranscriptRef.current = (recordingTranscriptRef.current + ' ' + text).trim();
            recentFinalsRef.current.push({ text, normText, timestamp: now });
          }
          
          lastFinalSegmentRef.current = text;
          lastFinalAtRef.current = now;
          
          const newContent = (baseContentRef.current + ' ' + recordingTranscriptRef.current).trim();
          setContent(newContent);
        } else {
          // Partial/interim result
          currentPartialRef.current = data.text;
          const newContent = (baseContentRef.current + ' ' + recordingTranscriptRef.current + ' ' + data.text).trim();
          setContent(newContent);
        }
      };

      const handleError = (errorMsg: string) => {
        console.error('Admin Dictation error:', errorMsg);
        setError(errorMsg);
        setStatus('error');
        
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
      };

      const handleStatusChange = (newStatus: string) => {
        console.log(`📊 Transcription status: ${newStatus}`);
        if (newStatus === 'recording' || newStatus === 'Recording') {
          setStatus('recording');
          
          durationIntervalRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }, 1000);
          
          autoSaveIntervalRef.current = setInterval(() => {
            saveDraft();
          }, 30000);
        } else if (newStatus === 'connected') {
          // Connecting phase complete, waiting for recording
        } else if (newStatus === 'Stopped' || newStatus === 'Disconnected') {
          setStatus('idle');
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
        } else if (newStatus.includes('Reconnecting')) {
          setStatus('connecting');
        }
      };

      // Use AssemblyAI client
      const client = new AssemblyRealtimeClient({
        onOpen: () => {
          console.log('🎙️ Admin Dictation: AssemblyAI session started');
          setStatus('recording');
          
          durationIntervalRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }, 1000);
          
          autoSaveIntervalRef.current = setInterval(() => {
            saveDraft();
          }, 30000);
        },
        onPartial: (text) => {
          currentPartialRef.current = text;
          const newContent = (baseContentRef.current + ' ' + recordingTranscriptRef.current + ' ' + text).trim();
          setContent(newContent);
        },
        onFinal: (text) => handleTranscription({ text, is_final: true, confidence: 0.9 }),
        onError: (err) => handleError(err.message),
        onClose: () => {
          setStatus('idle');
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
        },
        onReconnecting: () => setStatus('connecting'),
        onReconnected: () => setStatus('recording'),
      });

      clientRef.current = client;
      await client.start(externalStream);
    } catch (err) {
      console.error('Failed to start admin dictation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start dictation');
      setStatus('error');
    }
  }, [user, selectedTemplate, content, saveDraft, systemAudioEnabled, normalise, shouldReplaceLastFinal, replaceTrailingSegment, isAlreadyInTranscript]);

  // Stop dictation and auto-format with template-aware prompts
  const stopDictation = useCallback(async () => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    
    if (transcriberRef.current) {
      transcriberRef.current.stopTranscription();
      transcriberRef.current = null;
    }

    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);

    await saveDraft();
    setStatus('idle');
    fetchHistory();

    const currentContent = contentRef.current;
    setOriginalContent(currentContent);
    setCleanedContent('');
    
    if (autoCleanEnabled && currentContent && currentContent.trim().length > 10) {
      setIsFormatting(true);
      try {
        const { data, error } = await supabase.functions.invoke('format-admin-dictation', {
          body: { 
            content: currentContent.trim(), 
            templateType: selectedTemplate 
          }
        });
        
        if (error) throw error;
        
        if (data?.formattedContent) {
          setCleanedContent(data.formattedContent);
          if (showCleaned) {
            setContent(data.formattedContent);
          }
          showToast.success('Notes formatted and cleaned');
        }
      } catch (err) {
        console.error('Auto-format failed:', err);
      } finally {
        setIsFormatting(false);
      }
    }
  }, [saveDraft, fetchHistory, selectedTemplate, autoCleanEnabled, showCleaned]);

  const newDictation = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);

    setContent('');
    setOriginalContent('');
    setCleanedContent('');
    setDuration(0);
    setCurrentSessionId(null);
    setStatus('idle');
    setError(null);
  }, []);
  
  const toggleShowCleaned = useCallback(() => {
    setShowCleaned(prev => {
      const next = !prev;
      if (next && cleanedContent) {
        setContent(cleanedContent);
      } else if (!next && originalContent) {
        setContent(originalContent);
      }
      return next;
    });
  }, [originalContent, cleanedContent]);
  
  const triggerManualClean = useCallback(async () => {
    const textToClean = originalContent || content;
    if (!textToClean.trim() || textToClean.trim().length < 10) {
      showToast.error('Not enough content to clean');
      return;
    }
    
    setIsFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-admin-dictation', {
        body: { 
          content: textToClean.trim(), 
          templateType: selectedTemplate 
        }
      });
      
      if (error) throw error;
      
      if (data?.formattedContent) {
        setCleanedContent(data.formattedContent);
        setShowCleaned(true);
        setContent(data.formattedContent);
        showToast.success('Notes formatted and cleaned');
      }
    } catch (err) {
      console.error('Manual format failed:', err);
      showToast.error(err instanceof Error ? err.message : 'Failed to format text');
    } finally {
      setIsFormatting(false);
    }
  }, [originalContent, content, selectedTemplate]);

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

  const loadSession = useCallback((session: AdminDictationSession) => {
    setContent(session.content);
    setOriginalContent(session.content);
    setCleanedContent(session.cleaned_content || '');
    setCurrentSessionId(session.id);
    setSelectedTemplate(session.template_type as AdminTemplateType);
    setDuration(session.duration_seconds);
    setStatus('idle');
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await supabase
        .from('admin_dictations')
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

  const finalizeDictation = useCallback(async (title?: string) => {
    if (!currentSessionId) return;
    
    try {
      await supabase
        .from('admin_dictations')
        .update({
          is_draft: false,
          title: title || `Admin Dictation ${new Date().toLocaleDateString('en-GB')}`,
          content: contentRef.current,
          cleaned_content: cleanedContent || null,
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
  }, [currentSessionId, cleanedContent, fetchHistory]);

  const formatAndClean = useCallback(async () => {
    if (!content.trim() || status === 'recording' || isFormatting) return;
    
    setIsFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-admin-dictation', {
        body: { 
          content: content.trim(), 
          templateType: selectedTemplate 
        }
      });
      
      if (error) throw error;
      
      if (data?.formattedContent) {
        setContent(data.formattedContent);
        showToast.success('Text formatted and cleaned');
      }
    } catch (err) {
      console.error('Format and clean failed:', err);
      showToast.error(err instanceof Error ? err.message : 'Failed to format text');
    } finally {
      setIsFormatting(false);
    }
  }, [content, selectedTemplate, status, isFormatting]);

  // Save edits when user clicks out of the text area
  const saveOnBlur = useCallback(async () => {
    if (!currentSessionId || status === 'recording') return;
    
    try {
      await supabase
        .from('admin_dictations')
        .update({
          content: contentRef.current,
          cleaned_content: showCleaned ? contentRef.current : cleanedContent || null,
          word_count: contentRef.current.trim().split(/\s+/).filter(w => w).length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSessionId);
      
      // Update the appropriate state based on which view is being edited
      if (showCleaned) {
        setCleanedContent(contentRef.current);
      } else {
        setOriginalContent(contentRef.current);
      }
    } catch (err) {
      console.error('Auto-save on blur failed:', err);
    }
  }, [currentSessionId, status, showCleaned, cleanedContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) clientRef.current.stop();
      if (transcriberRef.current) transcriberRef.current.stopTranscription();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, []);

  return {
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
    systemAudioEnabled,
    setSystemAudioEnabled,
    originalContent,
    cleanedContent,
    showCleaned,
    autoCleanEnabled,
    setAutoCleanEnabled,
    formatDuration,
    templates: ADMIN_DICTATION_TEMPLATES,
    isRecording: status === 'recording',
    isConnecting: status === 'connecting',
    startDictation,
    stopDictation,
    newDictation,
    copyToClipboard,
    loadSession,
    deleteSession,
    finalizeDictation,
    fetchHistory,
    formatAndClean,
    toggleShowCleaned,
    triggerManualClean,
    saveOnBlur,
  };
}
