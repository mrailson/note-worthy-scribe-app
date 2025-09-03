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
    getNoteByType,
    getCompletionPercentage,
    refetch: fetchNotes
  };
}