import { useState, useCallback, useRef, useEffect } from "react";
import { showToast } from '@/utils/toastWrapper';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MeetingMetadata {
  title: string;
  format: "teams" | "f2f" | "hybrid";
  attendees: any[];
  agenda: string;
  agendaFiles: any[];
}

interface TranscriptChunk {
  id: string;
  text: string;
  confidence: number;
  timestamp: Date;
  speaker?: string;
  isProcessed: boolean;
}

export const useMeetingDashboard = () => {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [meetingMetadata, setMeetingMetadata] = useState<MeetingMetadata>({
    title: "",
    format: "teams",
    attendees: [],
    agenda: "",
    agendaFiles: []
  });
  
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [processedTranscript, setProcessedTranscript] = useState("");
  const [liveStats, setLiveStats] = useState({
    averageConfidence: 0,
    wordsPerMinute: 0,
    totalWords: 0,
    speakerChanges: 0
  });

  const chunksRef = useRef<TranscriptChunk[]>([]);

  // Initialize dashboard
  const initialize = useCallback(() => {
    if (!user?.id) return false;
    
    console.log("🚀 Initializing Meeting Dashboard");
    setIsInitialized(true);
    return true;
  }, [user?.id]);

  // Add new transcript chunk
  const addTranscriptChunk = useCallback((text: string, confidence: number, speaker?: string) => {
    const chunk: TranscriptChunk = {
      id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      confidence,
      timestamp: new Date(),
      speaker,
      isProcessed: false
    };

    setTranscriptChunks(prev => {
      const updated = [...prev, chunk];
      chunksRef.current = updated;
      return updated;
    });

    // Update live stats
    updateLiveStats();
  }, []);

  // Process chunks in batches
  const processChunks = useCallback(async () => {
    const unprocessedChunks = chunksRef.current.filter(chunk => !chunk.isProcessed);
    if (unprocessedChunks.length === 0) return;

    try {
      const batchText = unprocessedChunks.map(chunk => chunk.text).join(" ");
      
      // Call processing edge function
      const { data, error } = await supabase.functions.invoke('clean-transcript-chunk', {
        body: { 
          text: batchText,
          context: {
            meetingTitle: meetingMetadata.title,
            attendees: meetingMetadata.attendees.map(a => a.name),
            agenda: meetingMetadata.agenda
          }
        }
      });

      if (error) throw error;

      if (data?.cleanedText) {
        setProcessedTranscript(prev => prev + " " + data.cleanedText);
        
        // Mark chunks as processed
        setTranscriptChunks(prev => 
          prev.map(chunk => 
            unprocessedChunks.find(uc => uc.id === chunk.id) 
              ? { ...chunk, isProcessed: true }
              : chunk
          )
        );
      }
    } catch (error) {
      console.error("Failed to process chunks:", error);
      showToast.error("Failed to process transcript chunks", { section: 'meeting_manager' });
    }
  }, [meetingMetadata]);

  // Update live statistics
  const updateLiveStats = useCallback(() => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) return;

    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.text.split(' ').length, 0);
    const averageConfidence = chunks.reduce((sum, chunk) => sum + chunk.confidence, 0) / chunks.length;
    
    // Calculate words per minute based on first and last chunk timestamps
    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];
    const timeDiffMinutes = (lastChunk.timestamp.getTime() - firstChunk.timestamp.getTime()) / (1000 * 60);
    const wordsPerMinute = timeDiffMinutes > 0 ? totalWords / timeDiffMinutes : 0;

    // Count speaker changes
    let speakerChanges = 0;
    for (let i = 1; i < chunks.length; i++) {
      if (chunks[i].speaker !== chunks[i - 1].speaker) {
        speakerChanges++;
      }
    }

    setLiveStats({
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      wordsPerMinute: Math.round(wordsPerMinute),
      totalWords,
      speakerChanges
    });
  }, []);

  // Update meeting metadata
  const updateMetadata = useCallback((updates: Partial<MeetingMetadata>) => {
    setMeetingMetadata(prev => ({ ...prev, ...updates }));
  }, []);

  // Generate smart meeting title
  const generateSmartTitle = useCallback(() => {
    const { attendees, agenda, format } = meetingMetadata;
    
    let title = "";
    
    if (agenda && agenda.length > 10) {
      // Extract key topics from agenda
      const keywords = agenda
        .toLowerCase()
        .split(/[.,\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 3 && s.length < 30)
        .slice(0, 3)
        .join(", ");
      
      title = keywords.charAt(0).toUpperCase() + keywords.slice(1);
    } else if (attendees.length > 0) {
      const organizations = [...new Set(attendees.map(a => a.organization).filter(Boolean))];
      if (organizations.length > 0) {
        title = `${organizations[0]} ${format === "f2f" ? "Meeting" : "Virtual Meeting"}`;
      } else {
        title = `${attendees.length} Person ${format === "f2f" ? "Meeting" : "Virtual Meeting"}`;
      }
    } else {
      title = `${format === "f2f" ? "Face-to-Face" : format === "teams" ? "Teams" : "Hybrid"} Meeting`;
    }

    // Ensure title is under 100 characters
    if (title.length > 97) {
      title = title.substring(0, 97) + "...";
    }

    updateMetadata({ title });
  }, [meetingMetadata, updateMetadata]);

  // Process chunks every 10 seconds during recording
  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(processChunks, 10000);
    return () => clearInterval(interval);
  }, [isInitialized, processChunks]);

  return {
    isInitialized,
    initialize,
    meetingMetadata,
    updateMetadata,
    transcriptChunks,
    processedTranscript,
    liveStats,
    addTranscriptChunk,
    processChunks,
    generateSmartTitle
  };
};