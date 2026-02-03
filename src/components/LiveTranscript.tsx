import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TranscriptCleaner } from "@/utils/TranscriptCleaner";
import { getActiveMinConfidence, meetsConfidenceThreshold, withDefaultThresholds } from "@/utils/confidenceGating";
import { mergeLive, type LiveChunk } from "@/utils/liveMerge";
import { segmentsToPlainText, type Segment } from "@/lib/segmentMerge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { medicalTermCorrector } from "@/utils/MedicalTermCorrector";
import { MedicalTermCorrectionDialog } from "@/components/MedicalTermCorrectionDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  MessageSquare, 
  ChevronDown, 
  Clock,
  Users,
  Edit3,
  Plus,
  X,
  FileText,
  Sparkles,
  RefreshCw,
  Check,
  ChevronsUpDown,
  Building2,
  Video,
  Settings,
  Copy,
  FileDown,
  Eye
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { LiveTranscriptModal } from "@/components/LiveTranscriptModal";

interface Speaker {
  id: string;
  name: string;
  color: string;
}

interface LiveTranscriptProps {
  transcript: string;
  confidence?: number; // Add confidence prop
  isFinal?: boolean; // Add isFinal prop from client recorder
  showTimestamps: boolean;
  onTimestampsToggle: (show: boolean) => void;
  attendees?: string; // Comma-separated attendee names from meeting settings
  meetingSettings?: {
    practiceId: string;
    meetingFormat: string;
    transcriberService?: 'whisper' | 'deepgram';
    transcriberThresholds?: {
      whisper: number;
      deepgram: number;
    };
  };
  onMeetingSettingsChange?: (settings: { 
    practiceId: string; 
    meetingFormat: string; 
    transcriberService?: 'whisper' | 'deepgram';
    transcriberThresholds?: {
      whisper: number;
      deepgram: number;
    };
  }) => void;
  defaultOpen?: boolean;
  onChunkRejected?: (chunkText: string, reason: string, chunkNumber?: number) => void; // New callback for rejection tracking
}

interface LiveTranscriptHandle {
  getCurrentTranscript: () => string;
}

export const LiveTranscript = forwardRef<LiveTranscriptHandle, LiveTranscriptProps>(({ 
  transcript, 
  confidence,
  isFinal,
  showTimestamps, 
  onTimestampsToggle,
  attendees,
  meetingSettings,
  onMeetingSettingsChange,
  defaultOpen,
  onChunkRejected
}, ref) => {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(defaultOpen ?? false);
  const [isLiveUpdateOpen, setIsLiveUpdateOpen] = useState(false); // New state for live updates
  const [isMeetingSettingsOpen, setIsMeetingSettingsOpen] = useState(false); // New state for meeting settings
  const [isSpeakersOpen, setIsSpeakersOpen] = useState(false);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("");
  const [transcriptSegments, setTranscriptSegments] = useState<Array<{
    text: string;
    speaker: string;
    timestamp: string;
  }>>([]);
  
  // State for live transcript display
  const [liveTranscriptText, setLiveTranscriptText] = useState<string>("");
  const [cleanedTranscript, setCleanedTranscript] = useState<string>("");
  const [isAutoCleaningEnabled, setIsAutoCleaningEnabled] = useState<boolean>(true);
  const [isRawExpanded, setIsRawExpanded] = useState(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [isMedicalCorrectionsLoaded, setIsMedicalCorrectionsLoaded] = useState<boolean>(false);
  const [isLiveTranscriptModalOpen, setIsLiveTranscriptModalOpen] = useState(false);
  const [textAlignment, setTextAlignment] = useState<'left' | 'center'>('left');
  
  // Rejection tracking state
  const [rejectedChunks, setRejectedChunks] = useState<Array<{
    text: string;
    reason: string;
    timestamp: Date;
  }>>([]);
  const [totalChunksProcessed, setTotalChunksProcessed] = useState(0);
  const [rejectionRate, setRejectionRate] = useState(0);
  
  // Live meeting notes state
  const [liveNotesData, setLiveNotesData] = useState<{
    id: string;
    notes_content: string;
    current_version: number;
    last_updated_at: string;
    processing_status: string;
  } | null>(null);
  
  // Recording and editing state management
  const [isRecording, setIsRecording] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  
  // Meeting settings state
  const { user } = useAuth();
  const { toast } = useToast();
  const [practices, setPractices] = useState<Array<{id: string, name: string}>>([]);
  const [practiceSearchOpen, setPracticeSearchOpen] = useState(false);

  // Create transcript cleaner instance
  const transcriptCleaner = useMemo(() => new TranscriptCleaner(), []);

  // Editing state for cleaned transcript
  const [isEditingCleaned, setIsEditingCleaned] = useState(false);
  const [editedCleanedText, setEditedCleanedText] = useState("");
  
  // Wake lock management for recording sessions
  const wakeLockRef = useRef<any>(null);
  
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 LiveTranscript wake lock activated');
      }
    } catch (error) {
      console.warn('⚠️ Wake lock failed:', error);
    }
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('🔓 LiveTranscript wake lock released');
      }
    } catch (error) {
      console.warn('⚠️ Error releasing wake lock:', error);
    }
  };
  
  // Load user's practices (with refetch when selector opens)
  const fetchUserPractices = async () => {
    if (!user?.id) return;
    try {
      const { data: userPracticeIds } = await supabase.rpc('get_user_practice_ids', {
        p_user_id: user.id
      });

      if (userPracticeIds && userPracticeIds.length > 0) {
        const { data: practicesData, error } = await supabase
          .from('gp_practices')
          .select('id, name')
          .in('id', userPracticeIds);

        if (error) throw error;
        setPractices(practicesData || []);
      } else {
        setPractices([]);
      }
    } catch (error) {
      console.error('Error loading practices:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchUserPractices();
  }, [user?.id]);

  // Refresh when opening meeting settings or practice search popover
  useEffect(() => {
    if (practiceSearchOpen || isMeetingSettingsOpen) {
      fetchUserPractices();
    }
  }, [practiceSearchOpen, isMeetingSettingsOpen]);
  

  // Generate speaker colors
  const speakerColors = [
    "bg-blue-100 text-blue-800",
    "bg-green-100 text-green-800", 
    "bg-purple-100 text-purple-800",
    "bg-orange-100 text-orange-800",
    "bg-pink-100 text-pink-800",
    "bg-indigo-100 text-indigo-800"
  ];

  // Initialize speakers from attendees when component loads
  useEffect(() => {
    if (attendees && attendees.trim()) {
      const attendeeNames = attendees.split(',').map(name => name.trim()).filter(name => name);
      const initialSpeakers: Speaker[] = attendeeNames.map((name, index) => ({
        id: `speaker-${index}`,
        name: name,
        color: speakerColors[index % speakerColors.length]
      }));
      setSpeakers(initialSpeakers);
    }
  }, [attendees]);

  // Load medical term corrections on component mount
  useEffect(() => {
    const loadMedicalCorrections = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          await medicalTermCorrector.loadCorrections(user.user.id);
        } else {
          await medicalTermCorrector.loadCorrections();
        }
        setIsMedicalCorrectionsLoaded(true);
      } catch (error) {
        console.error('Error loading medical corrections:', error);
      }
    };

    loadMedicalCorrections();
  }, []);

  // Handle recording state management
  useEffect(() => {
    // Detect if we're actively recording by checking session storage
    const currentMeetingId = sessionStorage.getItem('currentMeetingId'); // Use meeting ID as primary identifier
    const recordingStatus = currentMeetingId ? true : false;
    setIsRecording(recordingStatus);
    
    if (recordingStatus) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, []);

  // Auto-save transcript drafts every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const draft = cleanedTranscript || liveTranscriptText;
        if (draft?.length > 20) {
          localStorage.setItem('liveTranscriptDraft', draft);
          localStorage.setItem('liveTranscriptDraftTimestamp', Date.now().toString());
        }
      } catch (error) {
        console.warn('Draft auto-save failed:', error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [cleanedTranscript, liveTranscriptText]);

  // Smart beforeunload handler - only warn on manual edits, not during recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // ONLY warn if user has unsaved manual edits and is NOT recording
      if (hasUnsavedEdits && !isRecording) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes to your transcript. Are you sure you want to leave?';
        return 'You have unsaved changes to your transcript. Are you sure you want to leave?';
      }
      // Otherwise, allow navigation without prompt
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEdits, isRecording]);

  // Clean unload handler for recording sessions
  useEffect(() => {
    const handleUnload = () => {
      try {
        // Send final transcript data if available
        const currentSessionId = sessionStorage.getItem('currentSessionId');
        const finalText = cleanedTranscript || liveTranscriptText;
        if (finalText && currentSessionId) {
          navigator.sendBeacon(
            '/api/transcripts/flush',
            new Blob([JSON.stringify({ 
              sessionId: currentSessionId, 
              transcript: finalText,
              timestamp: new Date().toISOString()
            })], { type: 'application/json' })
          );
        }
        releaseWakeLock();
      } catch (error) {
        console.warn('Unload cleanup failed:', error);
      }
    };

    window.addEventListener('unload', handleUnload);
    return () => window.removeEventListener('unload', handleUnload);
  }, [cleanedTranscript, liveTranscriptText]);

  // Handle visibility changes to maintain wake lock during recording
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRecording) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording]);

  // Guard against double subscription (StrictMode)
  const subscribedRef = useRef(false);
  const processedSeqRef = useRef(new Set<number>());

  // Debounce logic for inferring finality when is_final is missing (improved responsiveness)
  const stableTimer = useRef<number | null>(null);
  const pendingRef = useRef<string>("");
  const FLUSH_MS = 500; // Reduced from 1500ms to 500ms for better UX

  const queueFlushChunk = (text: string) => {
    console.log("⏰ Queuing chunk for debounce flush in", FLUSH_MS, "ms");
    pendingRef.current = text;
    if (stableTimer.current) window.clearTimeout(stableTimer.current);
    stableTimer.current = window.setTimeout(() => {
      console.log("🔄 Debounce timer fired - processing queued chunk");
      const cleanedChunk = lightCleanChunk(pendingRef.current);
      if (cleanedChunk) {
        console.log("📝 Debounce processed chunk into cleaned transcript");
        setCleanedTranscript(prev => {
          const appended = (prev ? prev + ' ' : '') + cleanedChunk;
          return appended;
        });
      } else {
        console.log("🔄 Debounce chunk was empty after cleaning");
      }
      pendingRef.current = "";
    }, FLUSH_MS);
  };

  // Light cleaning function for real-time processing
  const lightCleanChunk = (text: string): string => {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // normalize whitespace
      .replace(/\b(ARRS?|ARS)\b/gi, 'ARRS')
      .replace(/\b(PCN DES|PCMDS|PCMDA|PCMDRS)\b/gi, 'PCN DES')
      .replace(/\b(Systm One|System 1|system one)\b/gi, 'SystmOne')
      .replace(/\b(DocMan|document workflow)\b/gi, 'Docman')
      .replace(/\bCQC\b/gi, 'CQC')
      .replace(/\bQOF\b/gi, 'QOF')
      .replace(/\bsame day\b/gi, 'same-day')
      .replace(/\brepeat procedures\b/gi, 'repeat prescribing')
      .replace(/\bduty doctor house\b/gi, 'duty doctor hours');
  };

  // Remove duplicate consecutive sentences
  const removeDuplicateSentences = (newText: string, existingText: string): string => {
    if (!newText || !existingText) return newText;
    
    const newSentences = newText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    const existingSentences = existingText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    
    if (existingSentences.length === 0) return newText;
    
    const lastExisting = existingSentences[existingSentences.length - 1]?.trim().toLowerCase();
    
    // Filter out sentences that are too similar to the last existing sentence
    const filteredSentences = newSentences.filter(sentence => {
      const normalized = sentence.trim().toLowerCase();
      if (!normalized || normalized.length < 10) return false; // Skip very short fragments
      
      // Check if this sentence is very similar to the last existing sentence
      if (lastExisting && normalized.includes(lastExisting.substring(0, Math.min(20, lastExisting.length)))) {
        return false;
      }
      
      return true;
    });
    
    return filteredSentences.join(' ');
  };

  // Subscribe to transcription chunks for AI enhancement updates
  useEffect(() => {
    if (!user?.id) return;
    if (subscribedRef.current) return;

    const currentMeetingId = sessionStorage.getItem('currentMeetingId'); // Use meeting ID consistently
    if (!currentMeetingId) return;

    subscribedRef.current = true;
    console.log('🔄 Setting up transcription chunks subscription for meeting:', currentMeetingId, 'subscription-id:', Math.random().toString(36).substr(2, 9));

    const channel = supabase
      .channel('transcription-chunks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_transcription_chunks',
          filter: `meeting_id=eq.${currentMeetingId}` // Use meeting_id field for consistency
        },
        (payload) => {
          const r = payload.new;
          console.log("🔄 [ENHANCED CHUNK PROCESSING]", {
            seq: r.seq,
            is_final: r.is_final,
            len: r?.transcription_text?.length,
            head: r?.transcription_text?.slice(0,40),
            session_id: r.session_id,
            chunk_number: r.chunk_number
          });

          if (!r?.transcription_text) {
            console.warn("⚠️ Empty transcription text received, skipping chunk");
            return;
          }

          // replay/duplicate guard (StrictMode + reconnect safe)
          if (typeof r.seq === 'number') {
            if (processedSeqRef.current.has(r.seq)) {
              console.log("🔄 Duplicate chunk detected, skipping seq:", r.seq);
              return;
            }
            processedSeqRef.current.add(r.seq);
          }

          // Parse segment JSON if available, otherwise use plain text
          let textForDisplay = r.transcription_text;
          
          try {
            // Try to parse as JSON segments
            const parsed = JSON.parse(r.transcription_text);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
              // It's segment JSON - convert to plain text
              textForDisplay = segmentsToPlainText(parsed);
              console.log("📦 Parsed segment JSON:", parsed.length, "segments ->", textForDisplay.length, "chars");
            }
          } catch {
            // Not JSON, use as-is (legacy plain text chunks)
            console.log("📝 Using plain text chunk");
          }
          
          // Always show latest raw text (interim or final) in the live box - accumulate chunks
          console.log("🔗 Accumulating transcript chunk:", textForDisplay?.substring(0, 50) + "...", 'previous_length:', liveTranscriptText.length);
          setLiveTranscriptText(prev => {
            const appended = (prev ? prev + ' ' : '') + textForDisplay;
            console.log("📈 Raw transcript updated:", prev.length, "->", appended.length, "chars");
            return appended;
          });
          
          setTotalChunksProcessed(prev => prev + 1);

          const cleanedChunk = lightCleanChunk(textForDisplay);
          const dedupedChunk = cleanedChunk; // no real-time deduplication

          // Enhanced final chunk handling with better deduplication (Phase 1 fix)
          if (typeof r.is_final === "boolean") {
            console.log("✅ Chunk has is_final field:", r.is_final);
          if (r.is_final && dedupedChunk) {
              console.log("🔥 Processing FINAL chunk immediately into cleaned transcript");
              setCleanedTranscript(prev => {
                const appended = (prev ? prev + ' ' : '') + dedupedChunk;
                console.log("📝 Cleaned transcript updated, length:", appended.length);
                return appended;
              });
            } else if (dedupedChunk) {
              console.log("⚡ Queuing non-final chunk for debounce processing");
              queueFlushChunk(dedupedChunk);
            }
          } else if (dedupedChunk) {
            console.warn("⚠️ No is_final field found - using fallback debounce logic");
            queueFlushChunk(dedupedChunk);
          }
        }
      )
      .subscribe();

    return () => {
      subscribedRef.current = false;
      processedSeqRef.current.clear();
      supabase.removeChannel(channel);
    };
  // IMPORTANT: Do NOT add cleanedTranscript to dependencies - it causes subscription loop
  // The effect updates cleanedTranscript, so including it would cause infinite re-subscriptions
  }, [user?.id, isMedicalCorrectionsLoaded, meetingSettings]);

  // Subscribe to live meeting notes updates
  useEffect(() => {
    if (!user?.id) return;

    const currentMeetingId = sessionStorage.getItem('currentMeetingId');
    if (!currentMeetingId) return;

    // Fetch existing live notes
    const fetchLiveNotes = async () => {
      try {
        const { data, error } = await supabase
          .from('live_meeting_notes')
          .select('*')
          .eq('meeting_id', currentMeetingId)
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 errors

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching live notes:', error);
          return;
        }

        if (data) {
          setLiveNotesData(data);
          console.log('📝 Loaded existing live meeting notes');
        }
      } catch (error) {
        console.log('No existing live meeting notes found');
      }
    };

    fetchLiveNotes();

    // Subscribe to live notes updates
    const liveNotesChannel = supabase
      .channel('live-meeting-notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_meeting_notes',
          filter: `meeting_id=eq.${currentMeetingId}`
        },
        (payload) => {
          console.log('📝 Live meeting notes updated:', payload);
          if (payload.new && (payload.new as any).user_id === user.id) {
            setLiveNotesData(payload.new as any);
            toast({
              title: "Automatic Notes Updated",
              description: `Version ${(payload.new as any).current_version} generated automatically.`
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(liveNotesChannel);
    };
  }, [user?.id, toast]);

  // Filter out system messages (silence detection, etc.)
  const filterSystemMessages = (text: string): string => {
    if (!text) return text;
    
    // Remove silence detection and system messages
    let filtered = text
      .replace(/\[silence detected\]/gi, '')
      .replace(/\[no audio detected\]/gi, '')
      .replace(/\[quiet period detected\]/gi, '')
      .replace(/\[pause detected\]/gi, '')
      .replace(/\[audio stopped\]/gi, '')
      .replace(/\[listening\.\.\.\]/gi, '')
      .replace(/\[waiting for audio\]/gi, '')
      .replace(/\[no speech detected\]/gi, '')
      .replace(/\[audio pause\]/gi, '')
      .replace(/\[silence\]/gi, '')
      .replace(/\[quiet\]/gi, '')
      .replace(/\[no sound\]/gi, '')
      .replace(/\[audio gap\]/gi, '')
      .replace(/\[recording paused\]/gi, '')
      .replace(/\[system message\]/gi, '')
      .replace(/if silence or background noise,?\s*return nothing\.?/gi, '')
      .replace(/if silence or background noise,?\s*return nothing/gi, '')
      // Clean up extra spaces and line breaks
      .replace(/\s+/g, ' ')
      .trim();
    
    return filtered;
  };

  // Update live transcript text when transcript prop changes (for live box only)
  useEffect(() => {
    if (transcript && transcript.trim()) {
      const processedTranscript = filterSystemMessages(transcript);
    console.log("🔗 Accumulating transcript from props:", processedTranscript?.substring(0, 50) + "...", 'current_meeting:', sessionStorage.getItem('currentMeetingId'));
    setLiveTranscriptText(prev => {
      const appended = (prev ? prev + ' ' : '') + processedTranscript;
      console.log("📈 Props transcript updated:", prev.length, "->", appended.length, "chars");
      return appended;
    });
    }
  }, [transcript]);

  // Handle client prop integration for isFinal
  useEffect(() => {
    if (!transcript) return;
    
    // Always show interim in live box - accumulate instead of replace
    const processedTranscript = filterSystemMessages(transcript);
    console.log("🔗 Accumulating client prop transcript:", processedTranscript?.substring(0, 50) + "...", 'is_final:', isFinal);
    setLiveTranscriptText(prev => {
      const appended = (prev ? prev + ' ' : '') + processedTranscript;
      console.log("📈 Client props transcript updated:", prev.length, "->", appended.length, "chars");
      return appended;
    });

    // Handle finality from client props
    if (typeof isFinal === "boolean") {
      if (isFinal) {
        setCleanedTranscript(prev => {
          const appended = (prev ? prev + ' ' : '') + processedTranscript;
          return appended;
        });
      } else {
        queueFlushChunk(processedTranscript);
      }
    }
  }, [transcript, isFinal]);

  // Calculate rejection rate
  useEffect(() => {
    if (totalChunksProcessed > 0) {
      const rate = (rejectedChunks.length / totalChunksProcessed) * 100;
      setRejectionRate(rate);
      
      // Show warning if >20% of chunks are being rejected
      if (rate > 20 && rejectedChunks.length > 5) {
        console.warn(`⚠️ HIGH REJECTION RATE: ${rate.toFixed(1)}% of chunks rejected!`);
        toast({
          title: "High Chunk Rejection Rate",
          description: `${rate.toFixed(0)}% of transcript chunks are being filtered. You can manually merge them if needed.`,
          variant: "destructive",
        });
      }
    }
  }, [rejectedChunks.length, totalChunksProcessed]);

  // Manual merge function to force-merge rejected chunks
  const handleManualMergeRejectedChunks = () => {
    if (rejectedChunks.length === 0) {
      toast({
        title: "No Rejected Chunks",
        description: "There are no rejected chunks to merge.",
      });
      return;
    }

    console.log(`🔧 Manually merging ${rejectedChunks.length} rejected chunks...`);
    
    setCleanedTranscript(prev => {
      let result = prev;
      rejectedChunks.forEach(rejected => {
        // Force append with separator (bypass deduplication)
        const separator = /[.!?…]$/.test(result) ? ' ' : '. ';
        result = result + separator + rejected.text;
      });
      return result;
    });

    toast({
      title: "Chunks Merged",
      description: `Successfully merged ${rejectedChunks.length} rejected chunks into transcript.`,
    });

    // Clear rejected chunks after merge
    setRejectedChunks([]);
  };

  // Handle text selection for corrections
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  const addSpeaker = () => {
    if (newSpeakerName.trim()) {
      const newSpeaker: Speaker = {
        id: `speaker-${Date.now()}`,
        name: newSpeakerName.trim(),
        color: speakerColors[speakers.length % speakerColors.length]
      };
      setSpeakers([...speakers, newSpeaker]);
      setNewSpeakerName("");
    }
  };

  const removeSpeaker = (speakerId: string) => {
    setSpeakers(speakers.filter(s => s.id !== speakerId));
    if (currentSpeaker === speakerId) {
      setCurrentSpeaker("");
    }
  };

  const addTranscriptSegment = () => {
    if (transcript && currentSpeaker) {
      const speakerName = speakers.find(s => s.id === currentSpeaker)?.name || "Unknown";
      const timestamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      setTranscriptSegments([...transcriptSegments, {
        text: transcript,
        speaker: speakerName,
        timestamp
      }]);
    }
  };

  const formatTranscriptWithSpeakers = () => {
    if (transcriptSegments.length === 0) return transcript;
    
    return transcriptSegments.map((segment, index) => {
      const timeDisplay = showTimestamps ? `[${segment.timestamp}] ` : '';
      return `${timeDisplay}${segment.speaker}: ${segment.text}`;
    }).join('\n\n');
  };

  const formatTranscriptWithTimestamps = (text: string) => {
    if (!text) return "";
    
    if (transcriptSegments.length > 0) {
      return formatTranscriptWithSpeakers();
    }
    
    // Clean transcript using our cleaning service
    const cleanedText = isAutoCleaningEnabled ? 
      transcriptCleaner.cleanFinal(text) : text;
    
    if (showTimestamps) {
      const sentences = cleanedText.split(/[.!?]+/).filter(s => s.trim());
      return sentences.map((sentence, index) => {
        const timestamp = `${Math.floor(index * 0.5).toString().padStart(2, '0')}:${((index * 30) % 60).toString().padStart(2, '0')}`;
        return `[${timestamp}] ${sentence.trim()}.`;
      }).join('\n\n');
    }
    
    // Format as paragraphs for better readability
    return cleanedText.split(/[.!?]+/).filter(s => s.trim()).map(s => s.trim() + '.').join('\n\n');
  };

  // Build formatted cleaned text (paragraphs separated by blank lines)
  const getFormattedCleanedText = () => {
    // Only use cleanedTranscript - no fallback to avoid contamination
    const base = cleanedTranscript || "";
    return formatTranscriptWithTimestamps(base);
  };

  // Build simple HTML preserving paragraph spacing
  const buildCleanedHtml = () => {
    const text = getFormattedCleanedText();
    const paras = text
      .split("\n\n")
      .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)  
      .join("");
    return `<article><h2>Cleaned Transcript</h2>${paras}</article>`;
  };

  const handleCopyCleaned = async () => {
    try {
      const plain = getFormattedCleanedText();
      // Prefer rich HTML copy when available
      if ((navigator as any).clipboard && (window as any).ClipboardItem) {
        const html = buildCleanedHtml();
        const item = new (window as any).ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        await (navigator as any).clipboard.write([item]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plain);
      }
      toast({ title: "Copied", description: "Cleaned transcript copied with formatting." });
    } catch (err) {
      try {
        await navigator.clipboard.writeText(getFormattedCleanedText());
        toast({ title: "Copied", description: "Cleaned transcript copied." });
      } catch (e) {
        toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" as any });
      }
    }
  };

  const handleDownloadWord = async () => {
    try {
      const content = cleanedTranscript;

      const createParagraphsFromText = (text: string) => {
        const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
        return blocks.map((block) => {
          const lines = block.split("\n");
          return new Paragraph({
            children: lines.map((line, idx) => new TextRun({ text: line, break: idx > 0 ? 1 : undefined })),
            spacing: { after: 120 },
          });
        });
      };

      const paragraphs = createParagraphsFromText(content);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({ text: "Final Transcript", heading: HeadingLevel.HEADING_1 }),
              ...paragraphs,
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `Final-Transcript-${new Date().toISOString().slice(0, 10)}.docx`;
      saveAs(blob, fileName);
      toast({ title: "Downloaded", description: "Word document generated." });
    } catch (e) {
      toast({ title: "Export failed", description: "Could not generate Word document.", variant: "destructive" as any });
    }
  };

  // Expose getCurrentTranscript method via ref for Meeting Coach
  useImperativeHandle(ref, () => ({
    getCurrentTranscript: () => {
      // Return cleaned transcript if available, fallback to live transcript
      return cleanedTranscript || liveTranscriptText || '';
    }
  }));

  return null;
});