import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface MultiTypeNote {
  id: string;
  note_type: 'brief' | 'detailed' | 'very_detailed' | 'executive' | 'limerick';
  content: string;
  model_used: string;
  token_count: number;
  processing_time_ms: number;
  generated_at: string;
}

export interface NoteGenerationStatus {
  brief: 'pending' | 'completed' | 'failed' | null;
  detailed: 'pending' | 'completed' | 'failed' | null;
  very_detailed: 'pending' | 'completed' | 'failed' | null;
  executive: 'pending' | 'completed' | 'failed' | null;
  limerick: 'pending' | 'completed' | 'failed' | null;
}

export function useMultiTypeNotes(meetingId: string) {
  const [notes, setNotes] = useState<MultiTypeNote[]>([]);
  const [status, setStatus] = useState<NoteGenerationStatus>({
    brief: null,
    detailed: null,
    very_detailed: null,
    executive: null,
    limerick: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing notes
  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('meeting_notes_multi')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('generated_at', { ascending: false });

      if (error) throw error;

      // Cast the data to our interface type
      const typedNotes = (data || []).map(note => ({
        ...note,
        note_type: note.note_type as MultiTypeNote['note_type']
      })) as MultiTypeNote[];

      setNotes(typedNotes);

      // Update status based on existing notes
      const newStatus: NoteGenerationStatus = {
        brief: null,
        detailed: null,
        very_detailed: null,
        executive: null,
        limerick: null
      };

      typedNotes.forEach(note => {
        newStatus[note.note_type] = 'completed';
      });

      setStatus(newStatus);
    } catch (err) {
      console.error('Error fetching multi-type notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
    } finally {
      setIsLoading(false);
    }
  };

  // Check queue status for pending generations
  const checkQueueStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_notes_queue')
        .select('note_type, status')
        .eq('meeting_id', meetingId);

      if (error) throw error;

      if (data && data.length > 0) {
        const newStatus = { ...status };
        data.forEach(item => {
          if (item.note_type in newStatus) {
            newStatus[item.note_type as keyof NoteGenerationStatus] = item.status as any;
          }
        });
        setStatus(newStatus);
      }
    } catch (err) {
      console.error('Error checking queue status:', err);
    }
  };

  // Trigger generation of all 5 types
  const generateAllTypes = async () => {
    try {
      setError(null);
      
      // Update status to pending
      setStatus({
        brief: 'pending',
        detailed: 'pending',
        very_detailed: 'pending',
        executive: 'pending',
        limerick: 'pending'
      });

      // This will trigger the queue system via database trigger
      const { error } = await supabase
        .from('meetings')
        .update({ 
          notes_generation_status: 'queued',
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (error) throw error;

      // Start polling for updates
      const pollInterval = setInterval(async () => {
        await checkQueueStatus();
        await fetchNotes();
        
        // Stop polling when all are complete or failed
        const allDone = Object.values(status).every(s => s === 'completed' || s === 'failed');
        if (allDone) {
          clearInterval(pollInterval);
        }
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);

    } catch (err) {
      console.error('Error triggering multi-type generation:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate notes');
    }
  };

  // Sequential regeneration in specific order: Brief → Detailed → Limerick → Very Detailed → Executive
  const regenerateAllSequential = async () => {
    try {
      setError(null);
      
      const sequence = ['brief', 'detailed', 'limerick', 'very_detailed', 'executive'] as const;
      
      // Reset all statuses
      setStatus({
        brief: 'pending',
        detailed: null,
        very_detailed: null,
        executive: null,
        limerick: null
      });

      for (let i = 0; i < sequence.length; i++) {
        const noteType = sequence[i];
        
        // Update status to show current generation
        setStatus(prev => ({
          ...prev,
          [noteType]: 'pending'
        }));

        // Generate this type
        const { error } = await supabase.functions.invoke('generate-multi-type-notes', {
          body: {
            meetingId,
            noteType,
            forceRegenerate: true
          }
        });

        if (error) {
          console.error(`Error generating ${noteType}:`, error);
          setStatus(prev => ({
            ...prev,
            [noteType]: 'failed'
          }));
          throw error;
        }

        // Update status to completed
        setStatus(prev => ({
          ...prev,
          [noteType]: 'completed'
        }));

        // Set next item to pending if there is one
        if (i < sequence.length - 1) {
          const nextType = sequence[i + 1];
          setStatus(prev => ({
            ...prev,
            [nextType]: 'pending'
          }));
        }

        // Refresh notes after each generation
        await fetchNotes();
      }

    } catch (err) {
      console.error('Error in sequential regeneration:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate notes sequentially');
    }
  };

  // Get current generation progress for sequential mode
  const getSequentialProgress = () => {
    const sequence = ['brief', 'detailed', 'limerick', 'very_detailed', 'executive'] as const;
    const completedCount = sequence.filter(type => status[type] === 'completed').length;
    const currentIndex = sequence.findIndex(type => status[type] === 'pending');
    
    return {
      completed: completedCount,
      total: sequence.length,
      current: currentIndex >= 0 ? currentIndex + 1 : completedCount + 1,
      currentType: currentIndex >= 0 ? sequence[currentIndex] : null,
      percentage: (completedCount / sequence.length) * 100
    };
  };

  // Get note by type
  const getNoteByType = (type: keyof NoteGenerationStatus): MultiTypeNote | null => {
    return notes.find(note => note.note_type === type) || null;
  };

  // Get completion percentage
  const getCompletionPercentage = (): number => {
    const completedCount = Object.values(status).filter(s => s === 'completed').length;
    return (completedCount / 5) * 100;
  };

  // Check if generation is in progress
  const isGenerating = Object.values(status).some(s => s === 'pending');

  useEffect(() => {
    if (meetingId) {
      fetchNotes();
      checkQueueStatus();
    }
  }, [meetingId]);

  return {
    notes,
    status,
    isLoading,
    error,
    isGenerating,
    generateAllTypes,
    regenerateAllSequential,
    getSequentialProgress,
    getNoteByType,
    getCompletionPercentage,
    refetch: fetchNotes
  };
}