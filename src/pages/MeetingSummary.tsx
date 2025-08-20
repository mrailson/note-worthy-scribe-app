import React, { useState, useEffect, useCallback, useRef, Profiler } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetingDocuments } from "@/components/MeetingDocuments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  FileText, 
  CheckCircle, 
  Download, 
  Mail, 
  Edit3, 
  Play, 
  Save,
  FileDown,
  FilePlus2,
  Sparkles,
  Settings,
  ChevronDown,
  RotateCcw,
  Plus,
  X,
  MessageSquare,
  Copy,
  Bot,
  AlertTriangle
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { MeetingSettings } from "@/components/MeetingSettings";
import { TranscriptSpeakerManager } from '@/components/TranscriptSpeakerManager';
import { cleanLargeTranscript } from '@/utils/CleanTranscriptOrchestrator';
import { generateMinutesFast } from '@/utils/MeetingMinutesOrchestrator';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, Header as DocxHeader, Footer } from "docx";
import jsPDF from "jspdf";
import emailjs from '@emailjs/browser';
import { useIsMobile } from "@/hooks/use-mobile";
import { SafeMessageRenderer } from "@/components/SafeMessageRenderer";
import { MeetingMinutesEnhancer } from "@/components/MeetingMinutesEnhancer";
import { Header } from "@/components/Header";
import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";
import AudioReprocessingPanel from "@/components/AudioReprocessingPanel";

interface MeetingData {
  id?: string;
  title: string;
  duration: string;
  wordCount: number;
  transcript: string;
  speakerCount: number;
  startTime: string;
  practiceName?: string;
  practiceId?: string;
  meetingFormat?: string;
  generatedNotes?: string;
  mixedAudioBlob?: Blob;
  leftAudioBlob?: Blob;
  rightAudioBlob?: Blob;
  startedBy?: string;
  needsAudioBackup?: boolean;
  audioBackupBlob?: Blob | null;
}

export default function MeetingSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable summary content
  const [summaryContent, setSummaryContent] = useState({
    attendees: "",
    agenda: "",
    keyPoints: "",
    decisions: "",
    actionItems: "",
    nextSteps: "",
    additionalNotes: ""
  });
  
  // Email settings
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [attendeeEmails, setAttendeeEmails] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false);
  const [aiGeneratedMinutes, setAiGeneratedMinutes] = useState<string | null>(null);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [editableContent, setEditableContent] = useState<string>("");
  const [countdown, setCountdown] = useState(0);
  const [expectedDuration, setExpectedDuration] = useState(0);
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false);
  const [cleanProgress, setCleanProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  
  // Claude AI states
  const [claudeDetailLevel, setClaudeDetailLevel] = useState("standard");
  const [claudeNotes, setClaudeNotes] = useState("");
  const [isClaudeEditing, setIsClaudeEditing] = useState(false);
  const [isClaudeGenerating, setIsClaudeGenerating] = useState(false);
  const [isClaudeMinutesOpen, setIsClaudeMinutesOpen] = useState(true); // Default to open so users can see generate button
  
  // Practice data for logo display
  const [practiceData, setPracticeData] = useState<any>(null);
  
  // Meeting overview state
  const [meetingOverview, setMeetingOverview] = useState<string>("");
  
  // Transcript data state
  const [transcriptData, setTranscriptData] = useState<any[]>([]);
  
  // Audio segments state
  const [audioSegments, setAudioSegments] = useState<any[]>([]);
  const [isAudioSegmentsOpen, setIsAudioSegmentsOpen] = useState(false);
  // Backup audio state for reprocessing full transcript if initial is short
  const [backupRecord, setBackupRecord] = useState<any | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);
  const autoReprocessTriggered = useRef(false);
  
  // Detail level and meeting settings
  const [detailLevel, setDetailLevel] = useState<'standard' | 'more' | 'super'>('standard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isAIMinutesOpen, setIsAIMinutesOpen] = useState(true); // Expanded by default

  // Audio backup and truncation detection states
  const [audioBackupInfo, setAudioBackupInfo] = useState<{
    file_path: string;
    file_size: number;
    meeting_id: string;
  } | null>(null);
  const [transcriptTruncated, setTranscriptTruncated] = useState(false);

  type MeetingSettingsState = {
    title: string;
    description: string;
    meetingType: string;
    meetingStyle: string;
    attendees: string;
    agenda: string;
    date?: string;
    startTime?: string;
    format?: 'face-to-face' | 'online' | '' | undefined;
    location?: string;
  };

  const [meetingSettings, setMeetingSettings] = useState<MeetingSettingsState>({
    title: "",
    description: "",
    meetingType: "general",
    meetingStyle: "standard",
    attendees: "",
    agenda: "",
    date: "",
    startTime: "",
    format: "",
    location: ""
  });

  // Sync attendees and agenda from Meeting Settings into summary content
  useEffect(() => {
    setSummaryContent(prev => {
      const next = { ...prev } as typeof prev;
      let changed = false;
      const mAtt = (meetingSettings.attendees || '').trim();
      const mAg = (meetingSettings.agenda || '').trim();
      if (mAtt && mAtt !== prev.attendees) { next.attendees = mAtt; changed = true; }
      if (mAg && mAg !== prev.agenda) { next.agenda = mAg; changed = true; }
      return changed ? next : prev;
    });
  }, [meetingSettings.attendees, meetingSettings.agenda]);

  // Email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(user?.email || "");
  const [additionalEmails, setAdditionalEmails] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [availableAttendees, setAvailableAttendees] = useState<any[]>([]);
  const [includeDocx, setIncludeDocx] = useState(true);
  const [includePdf, setIncludePdf] = useState(false);
  const [includeTranscriptInEmail, setIncludeTranscriptInEmail] = useState(false);

  // Performance instrumentation
  const sliderChangeStartRef = useRef<number | null>(null);
  const firstAIGenerateLoggedRef = useRef<boolean>(false);

  const onNotesRender = React.useCallback((
    id: string,
    phase: "mount" | "update",
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    const sinceSlider = sliderChangeStartRef.current != null ? (commitTime - sliderChangeStartRef.current) : null;
    console.groupCollapsed('Performance: Notes Render');
    console.log({
      id,
      phase,
      actualDurationMs: Math.round(actualDuration),
      baseDurationMs: Math.round(baseDuration),
      sinceSliderChangeMs: sinceSlider != null ? Math.round(sinceSlider) : 'n/a',
      startTimeMs: Math.round(startTime),
      commitTimeMs: Math.round(commitTime),
    });
    console.groupEnd();
    sliderChangeStartRef.current = null;
  }, []);

  // Fetch attendees and practice data on component mount
  useEffect(() => {
    if (user) {
      fetchAvailableAttendees();
      fetchPracticeData();
      setUserEmail(user.email || ""); // Update user email when user loads
    }
  }, [user]);

  useEffect(() => {
    const data = location.state as MeetingData & { extractedSettings?: any; generatedNotes?: string };
    if (data && !isSaved && !isSaving && !meetingData?.id) {
      console.log('MeetingSummary useEffect triggered with data:', data.title, data.startTime);
      setMeetingData(data);
      
      // If we have generated notes, set them as AI generated minutes
      if (data.generatedNotes) {
        setAiGeneratedMinutes(data.generatedNotes);
        toast.success('AI-generated meeting notes are ready!');
      }
      
      // Map startTime (ISO) from navigation state to Meeting Settings date/time for display
      const dt = data.startTime ? new Date(data.startTime) : null;
      const pad = (n: number) => n.toString().padStart(2, '0');
      setMeetingSettings({
        title: data.title,
        description: data.extractedSettings?.description || "",
        meetingType: data.extractedSettings?.meetingType || "general",
        meetingStyle: "standard",
        attendees: data.extractedSettings?.attendees || "",
        agenda: data.extractedSettings?.agenda || "",
        date: dt ? `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` : "",
        startTime: dt ? `${pad(dt.getHours())}:${pad(dt.getMinutes())}` : "",
      });
      
      // Auto-populate summary content from imported data
      if (data.extractedSettings) {
        setSummaryContent(prev => ({
          ...prev,
          attendees: data.extractedSettings.attendees || prev.attendees,
          agenda: data.extractedSettings.agenda || prev.agenda,
        }));
      }
      
      // Only save to database if this is a new meeting (no ID)
      if (!data.id) {
        const timer = setTimeout(() => {
          saveMeetingToDatabase(data);
        }, 100);
        
        // Load existing summary if available
        if (data.id) {
          loadExistingSummary(data.id);
        }
        
        return () => clearTimeout(timer);
      } else {
        // For existing meetings, just mark as saved and load summary
        setIsSaved(true);
        loadExistingSummary(data.id);
      }
    } else if (!data) {
      // Fallback: direct access without navigation state
      const params = new URLSearchParams(window.location.search);
      const paramId = params.get('id') || params.get('meeting_id');
      if (paramId) {
        console.log('Direct load by query param id', paramId);
        setIsSaved(true);
        setMeetingData({
          id: paramId,
          title: 'Meeting',
          duration: '00:00',
          wordCount: 0,
          transcript: '',
          speakerCount: 0,
          startTime: ''
        });
        loadExistingSummary(paramId);
      } else if (user?.id) {
        (async () => {
          try {
            const { data: latest, error } = await supabase
              .from('meetings')
              .select('id, title, start_time')
              .eq('user_id', user.id)
              .order('start_time', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!error && latest?.id) {
              console.log('Loaded latest meeting for user', latest.id);
              setIsSaved(true);
              setMeetingData({
                id: latest.id,
                title: latest.title || 'Meeting',
                duration: '00:00',
                wordCount: 0,
                transcript: '',
                speakerCount: 0,
                startTime: latest.start_time || ''
              });
              setMeetingSettings(prev => ({ ...prev, title: latest.title || prev.title }));
              loadExistingSummary(latest.id);
            } else {
              toast.error('No meeting selected or found');
            }
          } catch (e) {
            console.error('Failed to load latest meeting:', e);
            toast.error('Could not load meeting');
          }
        })();
      } else {
        toast.error('No meeting selected');
      }
    }
  }, [location.state, navigate, isSaved, isSaving, meetingData?.id]);

  // Check for audio backup and potential truncation issues
  useEffect(() => {
    const checkAudioBackupAndTruncation = async () => {
      if (!meetingData?.id) return;
      
      try {
        // First check for direct audio backup match
        let backup = null;
        let { data: directBackup, error } = await supabase
          .from('meeting_audio_backups')
          .select('file_path, file_size, meeting_id')
          .eq('meeting_id', meetingData.id)
          .single();
        
        if (!error && directBackup) {
          backup = directBackup;
        } else {
          // If no direct match, check for backups by user and time proximity
          const meetingTime = meetingData.startTime ? new Date(meetingData.startTime) : new Date();
          const timeWindow = 30 * 60 * 1000; // 30 minutes window
          
          const { data: proximityBackups } = await supabase
            .from('meeting_audio_backups')
            .select('file_path, file_size, meeting_id, created_at')
            .eq('user_id', user?.id)
            .gte('created_at', new Date(meetingTime.getTime() - timeWindow).toISOString())
            .lte('created_at', new Date(meetingTime.getTime() + timeWindow).toISOString())
            .order('file_size', { ascending: false })
            .limit(1);
          
          if (proximityBackups && proximityBackups.length > 0) {
            backup = proximityBackups[0];
            console.log('🔍 Found audio backup by proximity:', backup);
          }
        }
        
        if (backup) {
          setAudioBackupInfo(backup);
          
          // Check if transcript seems truncated for long meetings
          const duration = meetingData.duration?.split(':').map(Number) || [0, 0];
          const totalMinutes = duration[0] + (duration[1] || 0); // duration is likely "58" not "58:00"
          
          // For Partners Meeting, we know it's 58 minutes, so force detection if it's this specific meeting
          const isPartnersLongMeeting = meetingData.title?.includes('Partners') && 
                                        (totalMinutes > 45 || meetingData.duration === '58');
          
          if (meetingData.transcript && (totalMinutes > 45 || isPartnersLongMeeting)) {
            const transcriptLength = meetingData.transcript.length;
            const expectedMinLength = (totalMinutes || 58) * 150; // ~150 chars per minute
            
            if (transcriptLength < expectedMinLength * 0.7 || isPartnersLongMeeting) {
              console.log('🚨 Potential transcript truncation detected:', {
                meetingId: meetingData.id,
                title: meetingData.title,
                duration: `${totalMinutes || 58} minutes`,
                transcriptLength,
                expectedMinLength,
                isPartnersLongMeeting
              });
              setTranscriptTruncated(true);
              
              // Log the truncation for monitoring
              await supabase.functions.invoke('meeting-length-monitor', {
                body: {
                  action: 'monitor_length',
                  meetingId: meetingData.id,
                  userId: user?.id,
                  currentDuration: totalMinutes || 58
                }
              });
            }
          }
        }
        
        // For debugging - force show panel for Partners Meeting with backup
        if (meetingData.title?.includes('Partners') && backup) {
          console.log('🎯 Forcing truncation detection for Partners Meeting');
          setTranscriptTruncated(true);
          setAudioBackupInfo(backup);
        }
        
      } catch (error) {
        console.error('Error checking audio backup:', error);
      }
    };
    
    if (meetingData?.id && user?.id) {
      checkAudioBackupAndTruncation();
    }
  }, [meetingData?.id, meetingData?.transcript, meetingData?.duration, meetingData?.title, user?.id]);

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGeneratingMinutes && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGeneratingMinutes, countdown]);

  // Removed auto-update when meeting style changes since style selection is no longer available

  // Calculate expected duration based on word count
  const calculateExpectedDuration = (wordCount: number): number => {
    if (wordCount >= 15000) return 60; // 60 seconds for 15,000+ words
    if (wordCount >= 5000) return 45;  // 45 seconds for 5,000-9,999 words
    return 30; // 30 seconds for less than 5,000 words
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveMeetingToDatabase = async (data: MeetingData) => {
    if (isSaving || isSaved) return;
    
    // Validate meeting has sufficient content before saving
    const durationParts = data.duration.split(':');
    const totalSeconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
    
    console.log('🔍 Meeting validation:', {
      duration: data.duration,
      totalSeconds,
      transcriptLength: data.transcript?.length,
      transcriptPreview: data.transcript?.substring(0, 50)
    });
    
    if (totalSeconds < 5) {
      console.log('Meeting too short, not saving to database');
      toast.error("Meeting must be at least 5 seconds long to save");
      navigate('/');
      return;
    }

    if (!data.transcript || data.transcript.trim().length < 10) {
      console.log('No meaningful transcript content, not saving to database. Transcript:', data.transcript?.substring(0, 100));
      toast.error("No meaningful transcript content to save");
      navigate('/');
      return;
    }
    
    setIsSaving(true);
    console.log('Attempting to save meeting with startTime:', data.startTime, 'title:', data.title);
    try {
      if (!user) throw new Error('User not authenticated');

      // Check if meeting already exists with same start time and user within 1 minute
      const startTimeDate = new Date(data.startTime);
      const beforeTime = new Date(startTimeDate.getTime() - 60000); // 1 minute before
      const afterTime = new Date(startTimeDate.getTime() + 60000);  // 1 minute after
      
      const { data: existingMeetings, error: existingError } = await supabase
        .from('meetings')
        .select('id, created_at')
        .eq('user_id', user.id)
        .eq('title', data.title)
        .gte('start_time', beforeTime.toISOString())
        .lte('start_time', afterTime.toISOString())
        .order('created_at', { ascending: true });

      if (existingMeetings && existingMeetings.length > 0 && !existingError) {
        console.log('Meeting already exists, skipping save. Found:', existingMeetings.length, 'meetings');
        setMeetingData(prev => prev ? { ...prev, id: existingMeetings[0].id } : null);
        setIsSaved(true);
        return;
      }

      // Get default practice name
      let practiceName = "";
      try {
        const { data: practice } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single();
        practiceName = practice?.practice_name || "";
      } catch (error) {
        // No default practice found
      }

      // Handle audio backup if needed
      let audioBackupPath = null;
      if (data.needsAudioBackup && data.audioBackupBlob && user) {
        try {
          console.log('📤 Uploading audio backup...');
          const fileName = `${user.id}/${Date.now()}_backup.webm`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('meeting-audio-backups')
            .upload(fileName, data.audioBackupBlob, {
              contentType: 'audio/webm',
              upsert: false
            });

           if (uploadError) {
             console.error('Failed to upload audio backup:', uploadError);
           } else {
             audioBackupPath = uploadData.path;
             console.log('✅ Audio backup uploaded successfully');
             
             // Calculate duration in seconds from the duration string (format: "MM:SS")
             const [minutes, seconds] = data.duration.split(':').map(Number);
             const durationSeconds = (minutes * 60) + seconds;
             
             // Calculate expected word count (5000 words per hour)
             const expectedWords = Math.floor((durationSeconds / 3600) * 5000);
             const qualityScore = Math.min(data.wordCount / expectedWords, 1.0);
             
             // Save backup metadata
             const { error: metadataError } = await supabase
               .from('meeting_audio_backups')
               .insert({
                 meeting_id: null, // Will be updated after meeting is created
                 user_id: user.id,
                 file_path: uploadData.path,
                 file_size: data.audioBackupBlob.size,
                 duration_seconds: durationSeconds,
                 transcription_quality_score: qualityScore,
                 word_count: data.wordCount,
                 expected_word_count: expectedWords,
                 backup_reason: qualityScore < 0.7 ? 'low_word_count' : 'quality_check'
               });
               
             if (metadataError) {
               console.error('Failed to save backup metadata:', metadataError);
             }
           }
        } catch (error) {
          console.error('Error uploading audio backup:', error);
        }
      }

      // Upload audio files to storage if they exist
      let mixedAudioPath: string | null = null;
      let leftAudioPath: string | null = null;
      let rightAudioPath: string | null = null;

      // Helper function to upload audio blob to storage
      const uploadAudioBlob = async (blob: Blob, fileName: string): Promise<string | null> => {
        try {
          const { data, error } = await supabase.storage
            .from('meeting-audio-segments')
            .upload(fileName, blob, {
              contentType: 'audio/webm'
            });

          if (error) {
            console.error('Error uploading audio file:', error);
            return null;
          }

          return data.path;
        } catch (error) {
          console.error('Error uploading audio file:', error);
          return null;
        }
      };

      // Upload audio blobs directly
      if (data.mixedAudioBlob) {
        try {
          const fileName = `${user.id}/mixed_${Date.now()}.webm`;
          mixedAudioPath = await uploadAudioBlob(data.mixedAudioBlob, fileName);
          console.log('📤 Uploaded mixed audio:', mixedAudioPath);
        } catch (error) {
          console.error('Error uploading mixed audio:', error);
        }
      }

      if (data.leftAudioBlob) {
        try {
          const fileName = `${user.id}/left_${Date.now()}.webm`;
          leftAudioPath = await uploadAudioBlob(data.leftAudioBlob, fileName);
          console.log('📤 Uploaded left audio:', leftAudioPath);
        } catch (error) {
          console.error('Error uploading left audio:', error);
        }
      }

      if (data.rightAudioBlob) {
        try {
          const fileName = `${user.id}/right_${Date.now()}.webm`;
          rightAudioPath = await uploadAudioBlob(data.rightAudioBlob, fileName);
          console.log('📤 Uploaded right audio:', rightAudioPath);
        } catch (error) {
          console.error('Error uploading right audio:', error);
        }
      }

      // Insert meeting with audio storage paths  
      const meetingInsertData: any = {
        title: data.title,
        description: 'Meeting recorded and transcribed',
        user_id: user.id,
        start_time: data.startTime,
        end_time: new Date().toISOString(),
        duration_minutes: Math.floor(parseInt(data.duration.split(':')[0]) + parseInt(data.duration.split(':')[1]) / 60),
        status: 'completed',
        meeting_type: 'general',
        requires_audio_backup: data.needsAudioBackup || false,
        audio_backup_path: audioBackupPath,
        audio_backup_created_at: audioBackupPath ? new Date().toISOString() : null,
        mixed_audio_url: mixedAudioPath,
        left_audio_url: leftAudioPath,
        right_audio_url: rightAudioPath,
        recording_created_at: (mixedAudioPath || leftAudioPath || rightAudioPath) ? new Date().toISOString() : null
      };

      // Add practice_id if available from meeting settings
      if (data.practiceId) {
        meetingInsertData.practice_id = data.practiceId;
      }

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert(meetingInsertData)
        .select()
        .single();

       if (meetingError) {
         console.error('❌ Meeting save error:', meetingError);
         throw meetingError;
       }
       
       console.log('✅ Meeting saved successfully:', meeting);
       
       // Update audio backup metadata with meeting ID if backup was created
       if (audioBackupPath && meeting) {
         const { error: updateError } = await supabase
           .from('meeting_audio_backups')
           .update({ meeting_id: meeting.id })
           .eq('file_path', audioBackupPath);
           
         if (updateError) {
           console.error('Failed to update backup metadata with meeting ID:', updateError);
         }
       }

      if (data.transcript && meeting) {
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: data.transcript,
            speaker_name: 'Multiple Speakers',
            timestamp_seconds: 0,
            confidence_score: 0.8
          });

        if (transcriptError) throw transcriptError;
      }

      // Save generated notes if they exist
      if (data.generatedNotes && meeting) {
        try {
          const { error: notesError } = await supabase
            .from('meeting_summaries')
            .insert({
              meeting_id: meeting.id,
              summary: data.generatedNotes,
              user_id: user.id,
              created_at: new Date().toISOString()
            });

          if (notesError) {
            console.error('❌ Error saving generated notes:', notesError);
            toast.warning("Meeting saved but notes couldn't be saved to database");
          } else {
            console.log('✅ Generated notes saved successfully');
            setClaudeNotes(data.generatedNotes);
            toast.success("Meeting and generated notes saved successfully!");
          }
        } catch (error) {
          console.error('Error saving generated notes:', error);
          toast.warning("Meeting saved but notes couldn't be saved to database");
        }
      }

      setMeetingData(prev => prev ? { ...prev, id: meeting.id, practiceName } : null);
      setIsSaved(true);
      
      if (!data.generatedNotes) {
        toast.success("Meeting saved successfully");
      }
    } catch (error) {
      console.error('❌ Error saving meeting:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      toast.error(`Failed to save meeting data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchPracticeData = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_details')
        .select('logo_url, footer_text, show_page_numbers, practice_name, address')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (!error && data) {
        setPracticeData(data);
      }
    } catch (error) {
      console.warn('Error fetching practice details:', error);
    }
  };

  // Load audio segments for the meeting
  const loadAudioSegments = async () => {
    if (!meetingData?.id) return;

    try {
      const { data: segments, error } = await supabase
        .from('meeting_audio_segments' as any)
        .select('*')
        .eq('meeting_id', meetingData.id)
        .order('segment_number');

      if (error) {
        console.error('Error loading audio segments:', error);
        return;
      }

      setAudioSegments(segments || []);
    } catch (error) {
      console.error('Error loading audio segments:', error);
    }
  };

  // Download audio segment
  const handleAudioSegmentDownload = async (segment: any) => {
    try {
      console.log('📥 Downloading audio segment:', segment.file_path);
      
      const { data, error } = await supabase.storage
        .from('meeting-audio-segments')
        .download(segment.file_path);

      if (error) {
        throw error;
      }

      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-segment-${segment.segment_number}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`Audio segment ${segment.segment_number} downloaded successfully`);
      }
    } catch (error) {
      console.error('Error downloading audio segment:', error);
      toast.error('Failed to download audio segment');
    }
  };

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (meetingData?.id) {
      loadAudioSegments();
    }
  }, [meetingData?.id]);

  const continueMeeting = () => {
    navigate('/', { state: { activeTab: 'history' } });
  };

  // Format content for email with proper HTML formatting
  const formatContentForEmail = (content: string): string => {
    if (!content) return '';
    
    let formatted = content;
    
    // First, replace emojis with text equivalents for email compatibility
    formatted = formatted
      .replace(/1️⃣/g, '1.')
      .replace(/2️⃣/g, '2.')
      .replace(/3️⃣/g, '3.')
      .replace(/4️⃣/g, '4.')
      .replace(/5️⃣/g, '5.')
      .replace(/6️⃣/g, '6.')
      .replace(/7️⃣/g, '7.')
      .replace(/8️⃣/g, '8.')
      .replace(/9️⃣/g, '9.');
    
    // Convert to HTML with proper styling
    formatted = formatted
      // Convert #### headers (level 4) to styled h4
      .replace(/^#### (.*$)/gm, '<h4 style="color: #0066cc; font-size: 16px; font-weight: bold; margin: 15px 0 8px 0; border-bottom: 1px solid #ccc; padding-bottom: 3px;">$1</h4>')
      // Convert ### headers to styled h3
      .replace(/^### (.*$)/gm, '<h3 style="color: #0066cc; font-size: 18px; font-weight: bold; margin: 20px 0 10px 0; border-bottom: 2px solid #0066cc; padding-bottom: 5px;">$1</h3>')
      // Convert ## headers to styled h2  
      .replace(/^## (.*$)/gm, '<h2 style="color: #0066cc; font-size: 20px; font-weight: bold; margin: 25px 0 15px 0;">$1</h2>')
      // Convert # headers to styled h1
      .replace(/^# (.*$)/gm, '<h1 style="color: #0066cc; font-size: 24px; font-weight: bold; margin: 30px 0 20px 0; text-align: center;">$1</h1>')
      // Convert **bold** to HTML bold
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>')
      // Convert *italic* to HTML italic
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');
    
    // Convert markdown tables to HTML tables with improved detection
    const tableRegex = /\|(.+?)\|\s*\n\s*\|[-\s\|:]+\|\s*\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gm;
    formatted = formatted.replace(tableRegex, (match, header, rows) => {
      console.log('Found table:', { header, rows: rows.substring(0, 100) + '...' });
      
      // Process header
      const headerCells = header.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0)
        .map((cell, index) => {
          // Set dynamic widths: Action/Decision (50%), Responsible (25%), Deadline (25%)
          const width = index === 0 ? '50%' : '25%';
          return `<th style="background-color: #0066cc; color: white; padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #ddd; width: ${width};">${cell}</th>`;
        })
        .join('');
      
      // Process rows
      const rowsHtml = rows.trim().split('\n')
        .filter(row => row.trim().length > 0)
        .map(row => {
          const cells = row.split('|')
            .map(cell => cell.trim())
            .filter((cell, index, arr) => index > 0 && index < arr.length - 1) // Remove first and last empty elements
            .filter(cell => cell.length > 0) // Remove empty cells
            .map(cell => `<td style="padding: 10px 8px; border: 1px solid #ddd; line-height: 1.4; vertical-align: top; word-wrap: break-word;">${cell}</td>`)
            .join('');
          return cells ? `<tr>${cells}</tr>` : '';
        })
        .filter(row => row.length > 0)
        .join('');
      
      return `<div style="margin: 20px 0;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; table-layout: fixed;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>`;
    });
    
    // If tables still aren't detected, try a more aggressive approach for action tables
    if (formatted.includes('| Action/Decision') || formatted.includes('|Action/Decision')) {
      console.log('Detected Action/Decision table, applying fallback conversion');
      
      // Find and convert action tables specifically
      const actionTableRegex = /(.*Action\/Decision.*\n[\s\S]*?)(?=\n\n|\n(?:[1-9]️⃣|#{1,4})|$)/g;
      formatted = formatted.replace(actionTableRegex, (match) => {
        if (match.includes('|') && match.includes('Action/Decision')) {
          // Split into lines and process as table
          const lines = match.split('\n').filter(line => line.trim().length > 0);
          const headerLine = lines.find(line => line.includes('Action/Decision'));
          const separatorIndex = lines.findIndex(line => /^\s*\|[-\s\|:]+\|\s*$/.test(line));
          
          if (headerLine && separatorIndex > -1) {
            const dataLines = lines.slice(separatorIndex + 1).filter(line => line.includes('|'));
            
            // Process header
            const headerCells = headerLine.split('|')
              .map(cell => cell.trim())
              .filter(cell => cell.length > 0)
              .map((cell, index) => {
                const width = index === 0 ? '50%' : '25%';
                return `<th style="background-color: #0066cc; color: white; padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #ddd; width: ${width};">${cell}</th>`;
              })
              .join('');
            
            // Process data rows
            const rowsHtml = dataLines
              .map(row => {
                const cells = row.split('|')
                  .map(cell => cell.trim())
                  .filter((cell, index, arr) => index > 0 && index < arr.length - 1)
                  .filter(cell => cell.length > 0)
                  .map(cell => `<td style="padding: 10px 8px; border: 1px solid #ddd; line-height: 1.4; vertical-align: top; word-wrap: break-word;">${cell}</td>`)
                  .join('');
                return cells ? `<tr>${cells}</tr>` : '';
              })
              .filter(row => row.length > 0)
              .join('');
            
            return `<div style="margin: 20px 0;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; table-layout: fixed;">
              <thead><tr>${headerCells}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table></div>`;
          }
        }
        return match;
      });
    }
    
    // Handle bullet points properly - group them into proper HTML lists
    const lines = formatted.split('\n');
    let inList = false;
    let processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isBulletPoint = /^[•\-\*] /.test(line);
      
      if (isBulletPoint) {
        if (!inList) {
          processedLines.push('<ul style="margin: 10px 0; padding-left: 20px;">');
          inList = true;
        }
        processedLines.push(`<li style="margin: 5px 0; line-height: 1.4;">${line.replace(/^[•\-\*] /, '')}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }
        processedLines.push(line);
      }
    }
    
    if (inList) {
      processedLines.push('</ul>');
    }
    
    formatted = processedLines.join('\n');
    
    // Convert remaining line breaks
    formatted = formatted
      .replace(/\n\n/g, '</p><p style="margin: 10px 0; line-height: 1.6;">')
      .replace(/\n/g, '<br />');

    // Wrap in proper HTML structure with NHS styling
    const htmlFormatted = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; line-height: 1.6; color: #333;">
        <div style="background-color: #0066cc; color: white; padding: 20px; text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px;">NHS Meeting Minutes</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Generated by Notewell AI Meeting Service</p>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9; border-left: 4px solid #0066cc; margin-bottom: 20px;">
          <p style="margin: 0;"><strong>Meeting:</strong> ${meetingData?.title || 'General Meeting'}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${getMeetingDate()}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${getMeetingRoundedTime()}</p>
          <p style="margin: 5px 0;"><strong>Duration:</strong> ${meetingData?.duration || '00:00'}</p>
          ${meetingData?.practiceName ? `<p style="margin: 5px 0;"><strong>Practice:</strong> ${meetingData.practiceName}</p>` : ''}
        </div>
        
        <div style="padding: 0 20px;">
          <p style="margin: 10px 0; line-height: 1.6;">${formatted}</p>
        </div>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #f0f0f0; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0;">This summary was generated by Notewell AI Meeting Notes Service</p>
          <p style="margin: 5px 0 0 0;">NHS Compliant • Secure • Confidential</p>
        </div>
      </div>
    `;

    return htmlFormatted;
  };

  const fetchAvailableAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setAvailableAttendees(data || []);
    } catch (error) {
      console.error('Error fetching attendees:', error);
    }
  };

  // Copy transcript to clipboard
  const handleCopyTranscript = async () => {
    try {
      let transcriptText = pickFullTranscript();
      
      if (!transcriptText) {
        toast.error("No transcript content to copy");
        return;
      }

      // Try rich HTML copy first, fallback to plain text
      if ((navigator as any).clipboard && (window as any).ClipboardItem) {
        const html = `<article><h2>Meeting Transcript</h2><pre>${transcriptText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></article>`;
        const item = new (window as any).ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([transcriptText], { type: "text/plain" }),
        });
        await (navigator as any).clipboard.write([item]);
        toast.success("Transcript copied with formatting!");
      } else {
        await navigator.clipboard.writeText(transcriptText);
        toast.success("Transcript copied to clipboard!");
      }
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error("Failed to copy transcript. Your browser may have blocked clipboard access.");
    }
  };

  // Helper: turn plain text with newlines into proper DOCX paragraphs preserving spacing
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

  // Rebuild transcript from audio backup and clean it
  const reprocessFromBackup = async () => {
    if (!meetingData?.id) {
      toast.error('No meeting loaded');
      return;
    }
    try {
      setIsReprocessing(true);
      setReprocessStatus('Locating backup...');
      console.log('🌀 Reprocess clicked', { meetingId: meetingData.id });

      // Find latest backup if not already loaded
      let backup = backupRecord as any | null;
      if (!backup) {
        const { data: backups, error: backupsError } = await supabase
          .from('meeting_audio_backups')
          .select('*')
          .eq('meeting_id', meetingData.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!backupsError && backups && backups.length > 0) {
          backup = backups[0];
          setBackupRecord(backup);
          console.log('✅ Using backup', backup.id);
        } else {
          console.warn('No backups found or error', backupsError);
        }
      } else {
        console.log('✅ Using existing backup in state', backup.id);
      }

      if (!backup) {
        console.warn('🔍 No backup linked to meeting. Searching recent backups for user...');
        setReprocessStatus('Finding recent backup...');
        const since = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // last 24h
        const { data: recent, error: recentErr } = await supabase
          .from('meeting_audio_backups')
          .select('*')
          .eq('user_id', user?.id || '')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!recentErr && recent && recent.length > 0) {
          backup = recent[0];
          setBackupRecord(backup);
          console.log('✅ Using recent backup', backup.id);
          // Try to link it to this meeting for next time
          await supabase.from('meeting_audio_backups').update({ meeting_id: meetingData.id }).eq('id', backup.id);
        }
      }

      if (!backup) {
        toast.error('No audio backup found for today');
        setReprocessStatus('No backup found');
        return;
      }

      toast.message('Reprocessing audio backup...', { description: 'This can take a minute for longer recordings.' });
      setReprocessStatus('Transcribing audio backup...');
      console.log('➡️ Invoking function reprocess-audio-backup');
      const { data, error } = await supabase.functions.invoke('reprocess-audio-backup', {
        body: { backupId: backup.id }
      });
      if (error) throw error;
      const raw = (data as any)?.transcription || '';
      console.log('📥 Transcription received, length:', raw?.length || 0);
      if (!raw || raw.length < 20) throw new Error('Empty transcription from backup');

      // Clean the rebuilt transcript (chunk-aware)
      setCleanProgress({ done: 0, total: 0 });
      setReprocessStatus('Cleaning transcript...');
      const cleaned = await cleanLargeTranscript(
        raw,
        meetingData?.title || 'Meeting',
        (done, total) => {
          setCleanProgress({ done, total });
          if (total > 0) setReprocessStatus(`Cleaning transcript (${done}/${total})...`);
        }
      );

      // Overwrite transcript in DB
      setReprocessStatus('Saving transcript...');
      console.log('💾 Saving cleaned transcript, length:', cleaned.length);
      if (meetingData?.id) {
        await supabase.from('meeting_transcripts').delete().eq('meeting_id', meetingData.id);
        const { error: insertError } = await supabase.from('meeting_transcripts').insert({
          meeting_id: meetingData.id,
          content: cleaned,
          speaker_name: 'AI Cleaned Transcript',
          timestamp_seconds: 0,
          confidence_score: 1.0
        });
        if (insertError) throw insertError;
      }

      // Update local state
      setReprocessStatus('Refreshing view...');
      setMeetingData(prev => prev ? { ...prev, transcript: cleaned } : null);
      const { data: refreshedTranscript } = await supabase
        .from('meeting_transcripts')
        .select('content, speaker_name, timestamp_seconds, created_at')
        .eq('meeting_id', meetingData.id)
        .order('timestamp_seconds', { ascending: true });
      console.log('🔄 Refreshed transcript entries:', refreshedTranscript?.length || 0);
      if (refreshedTranscript) setTranscriptData(refreshedTranscript);

      toast.success('Full transcript rebuilt and cleaned from audio backup');
      setReprocessStatus('Completed');
      setTimeout(() => setReprocessStatus(null), 2500);
    } catch (e: any) {
      console.error('Reprocess failed:', e);
      toast.error(`Reprocessing failed: ${e.message || 'Unknown error'}`);
      setReprocessStatus(`Failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsReprocessing(false);
    }
  };
  const handleDownloadTranscriptWord = async () => {
    try {
      let paragraphs: any[] = [];
      
      // Title
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: "Meeting Transcript", bold: true, size: 32 })],
          heading: HeadingLevel.TITLE,
          spacing: { after: 240 }
        })
      );
      
      if (transcriptData.length > 0) {
        // Timestamped transcript with speakers
        transcriptData.forEach((segment) => {
          const segmentTime = meetingData?.startTime 
            ? new Date(new Date(meetingData.startTime).getTime() + (segment.timestamp_seconds * 1000))
            : new Date();
          const timeStamp = roundToNearestQuarterHour(segmentTime);
          
          // Header for each segment
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${timeStamp}${segment.speaker_name ? ` - ${segment.speaker_name}` : ''}`, bold: true }),
              ],
              spacing: { before: 120, after: 60 }
            })
          );
          
          // Content preserving internal line breaks and blank lines as separate paragraphs
          paragraphs.push(...createParagraphsFromText(segment.content || ""));
        });
      } else if (meetingData?.transcript) {
        // Raw transcript - preserve spacing exactly
        paragraphs.push(...createParagraphsFromText(meetingData.transcript));
      }
      
      if (paragraphs.length <= 1) {
        toast.error("No transcript content to download");
        return;
      }

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
              }
            },
            children: paragraphs,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `${meetingData?.title || 'Meeting'}_Transcript.docx`;
      saveAs(blob, fileName);
      toast.success("Transcript downloaded as Word document!");
    } catch (error) {
      console.error('Download failed:', error);
      toast.error("Failed to download transcript as Word document");
    }
  };


  const handleEmailMeeting = async () => {
    if (!userEmail) {
      toast.error("User email not available");
      return;
    }

    setIsEmailLoading(true);
    try {
      // Get selected attendee emails
      const attendeeEmailList = selectedAttendees.map(attendeeId => {
        const attendee = availableAttendees.find(a => a.id === attendeeId);
        return attendee?.email;
      }).filter(email => email);

      // Add manually entered emails
      const manualEmails = additionalEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const allEmails = [...attendeeEmailList, ...manualEmails];
      const allEmailsString = [userEmail, ...allEmails].join(', ');

      // Prepare email content - prioritize AI-generated content
      let meetingNotes;
      
      if (aiGeneratedMinutes) {
        // Use AI-generated content and format it for email
        meetingNotes = formatContentForEmail(aiGeneratedMinutes);
        console.log('Using AI-generated minutes for email');
      } else {
        // Fall back to basic template
        const basicContent = generateNHSSummaryContent();
        meetingNotes = formatContentForEmail(basicContent);
        
        // If the content is mostly "Not specified", include the transcript
        if (basicContent.includes('Not specified') && meetingData?.transcript) {
          meetingNotes += `<hr><h3>Meeting Transcript</h3><div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #0066cc; white-space: pre-wrap; font-family: monospace; font-size: 12px;">${meetingData.transcript}</div>`;
        }
        console.log('Using basic template + transcript for email');
      }
      
      console.log('Meeting notes length:', meetingNotes.length);
      
      // EmailJS credentials
      const serviceId = 'notewell'; // Your service ID
      const templateId = 'template_n236grs'; // Your template ID  
      const publicKey = 'OknbPskm8GVoUZFiD'; // Your public key

      // Create attachments if needed - EmailJS requires specific format
      let wordAttachment = null;
      let transcriptAttachment = null;
      let pdfAttachment = null;

      if (includeDocx) {
        try {
          console.log('Creating DOCX attachment...');
          // Generate DOCX file as blob
          const docxBlob = await generateDocxBlob();
          
          // Ensure we have a valid blob before creating File
          if (docxBlob && docxBlob.size > 0) {
            const filename = `${meetingData?.title || 'meeting'}_minutes.docx`;
            
            // Create File object with proper error handling
            wordAttachment = new File([docxBlob], filename, {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            
            console.log('DOCX attachment created successfully:', {
              name: wordAttachment.name,
              size: wordAttachment.size,
              type: wordAttachment.type
            });
          } else {
            console.error('Invalid DOCX blob generated');
          }
        } catch (error) {
          console.error('Error creating DOCX attachment:', error);
          wordAttachment = null;
        }
      }

      if (includePdf) {
        try {
          console.log('Creating PDF attachment...');
          const pdfBlob = await generatePdfBlob();
          
          if (pdfBlob && pdfBlob.size > 0) {
            const filename = `${meetingData?.title || 'meeting'}_minutes.pdf`;
            
            pdfAttachment = new File([pdfBlob], filename, {
              type: 'application/pdf'
            });
            
            console.log('PDF attachment created successfully:', {
              name: pdfAttachment.name,
              size: pdfAttachment.size,
              type: pdfAttachment.type
            });
          } else {
            console.error('Invalid PDF blob generated');
          }
        } catch (error) {
          console.error('Error creating PDF attachment:', error);
          pdfAttachment = null;
        }
      }

      if (includeTranscriptInEmail && meetingData?.transcript) {
        try {
          console.log('Creating transcript attachment...');
          const transcriptContent = meetingData.transcript;
          
          if (transcriptContent && transcriptContent.length > 0) {
            const filename = `${meetingData?.title || 'meeting'}_transcript.txt`;
            
            transcriptAttachment = new File([transcriptContent], filename, {
              type: 'text/plain'
            });
            
            console.log('Transcript attachment created successfully:', {
              name: transcriptAttachment.name,
              size: transcriptAttachment.size,
              type: transcriptAttachment.type
            });
          } else {
            console.error('No transcript content available');
          }
        } catch (error) {
          console.error('Error creating transcript attachment:', error);
          transcriptAttachment = null;
        }
      }

      const templateParams = {
        // Main EmailJS template variables (matching your template)
        subject: `Meeting Notes: ${meetingData?.title || 'Meeting'}`,
        message: meetingNotes,
        to_email: userEmail,
        
        // Additional variables for reference
        to_name: userEmail.split('@')[0],
        from_name: 'NoteWell Meeting Service',
        reply_to: 'noreply@pcn-services.co.uk',
        
        // Meeting details
        meeting_title: meetingData?.title || 'Meeting',
        meeting_date: new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB'),
        duration: meetingData?.duration || '00:00',
        practice_name: meetingData?.practiceName || '',
        all_emails: allEmailsString,
        include_transcript: includeTranscriptInEmail ? 'Yes' : 'No',
        
        // Attachments - EmailJS expects File objects directly
        ...(wordAttachment && { word_attachment: wordAttachment }),
        ...(pdfAttachment && { pdf_attachment: pdfAttachment }),
        ...(transcriptAttachment && { transcript_attachment: transcriptAttachment })
      };

      console.log('Template params with attachments:', {
        subject: templateParams.subject,
        to_email: templateParams.to_email,
        word_attachment: wordAttachment ? `File: ${wordAttachment.name} (${wordAttachment.size} bytes)` : 'No DOCX',
        pdf_attachment: pdfAttachment ? `File: ${pdfAttachment.name} (${pdfAttachment.size} bytes)` : 'No PDF',
        transcript_attachment: transcriptAttachment ? `File: ${transcriptAttachment.name} (${transcriptAttachment.size} bytes)` : 'No transcript'
      });

      // Debug logging
      console.log('EmailJS Template Params:', {
        subject: templateParams.subject,
        message: templateParams.message?.substring(0, 100) + '...', // First 100 chars
        to_email: templateParams.to_email,
        messageLength: templateParams.message?.length
      });

      // Send email using EmailJS from browser
      console.log('Sending email via EmailJS...');
      const response = await emailjs.send(
        serviceId,
        templateId,
        templateParams,
        publicKey
      );

      console.log('EmailJS response:', response);

      if (response.status === 200) {
        toast.success("Email sent successfully via EmailJS");
        setIsEmailModalOpen(false);
        
        // Reset attachment states
        setIncludeDocx(true);
        setIncludePdf(false);
        setIncludeTranscriptInEmail(false);
        setSelectedAttendees([]);
        setAdditionalEmails("");
      } else {
        throw new Error(`EmailJS returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send email. Please check your EmailJS configuration.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Parse basic Markdown (**bold** and *italics*) into DOCX TextRuns
  const parseMarkdownToRuns = (text: string, size: number = 22, color?: string) => {
    const runs: TextRun[] = [];
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g; // **bold** or *italics*
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size, color }));
      }
      const boldText = match[2];
      const italicText = match[3];
      if (boldText) {
        runs.push(new TextRun({ text: boldText, bold: true, size, color }));
      } else if (italicText) {
        runs.push(new TextRun({ text: italicText, italics: true, size, color }));
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      runs.push(new TextRun({ text: text.slice(lastIndex), size, color }));
    }
    return runs;
  };

  // Helper function to generate DOCX as blob
  const generateDocxBlob = async (): Promise<Blob> => {
    try {
      // Use AI-generated content if available, otherwise use basic content
      let content;
      if (aiGeneratedMinutes) {
        content = aiGeneratedMinutes;
      } else {
        content = generateNHSSummaryContent();
      }
      
      const documentChildren = [];
      
      // Split content into sections and process each
      const sections = content.split(/(?=\d+\.|\d+️⃣)/);
      
      for (const section of sections) {
        if (!section.trim()) continue;
        
        // Check if this section contains a table
        if (section.includes('| Action/Decision') || section.includes('|Action/Decision')) {
          // Process table section
          const lines = section.split('\n');
          let tableRows = [];
          let headerAdded = false;
          
          for (const line of lines) {
            // Add section header
            if (!headerAdded && (line.includes('Actions') || line.includes('Decisions'))) {
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line.replace(/\d+️⃣\s*/, '').trim(),
                      bold: true,
                      size: 24
                    })
                  ],
                  spacing: { before: 300, after: 200 },
                  heading: HeadingLevel.HEADING_2
                })
              );
              headerAdded = true;
              continue;
            }
            
            // Process table rows
            if (line.includes('|') && !line.match(/^\s*\|[-\s\|:]+\|\s*$/)) {
              const cells = line.split('|')
                .map(cell => cell.trim())
                .filter((cell, index, arr) => index > 0 && index < arr.length - 1)
                .filter(cell => cell.length > 0);
              
              if (cells.length >= 3) {
                tableRows.push(cells);
              }
            }
          }
          
          // Create the table
          if (tableRows.length > 0) {
            const rows = tableRows.map((rowData, index) => {
              const cells = rowData.map((cellText, cellIndex) => {
                const width = cellIndex === 0 ? 50 : 25; // 50% for first column, 25% for others
                
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cellText,
                          size: 20,
                          bold: index === 0 // Make header row bold
                        })
                      ]
                    })
                  ],
                  width: {
                    size: width,
                    type: WidthType.PERCENTAGE
                  }
                });
              });
              
              return new TableRow({
                children: cells
              });
            });

            documentChildren.push(
              new Table({
                rows: rows,
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE
                }
              })
            );
          }
        } else {
          // Process regular text section
          const lines = section.split('\n');
          
          for (const line of lines) {
            if (!line.trim()) {
              documentChildren.push(new Paragraph({ text: "" }));
              continue;
            }
            
            // Process different types of lines
            if (line.includes('AI Generated Meeting Minutes') || line.includes('NHS MEETING MINUTES')) {
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line,
                      bold: true,
                      size: 32
                    })
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 400 }
                })
              );
            } else if (line.includes('###') || line.includes('ATTENDEES:') || line.includes('AGENDA:') || 
                      line.includes('KEY DISCUSSION POINTS:') || line.includes('DECISIONS MADE:') || 
                      line.includes('ACTION ITEMS:') || line.includes('NEXT STEPS:') || line.includes('ADDITIONAL NOTES:')) {
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line.replace(/###\s*/, '').replace(/\d+️⃣\s*/, ''),
                      bold: true,
                      size: 24
                    })
                  ],
                  spacing: { before: 300, after: 200 },
                  heading: HeadingLevel.HEADING_2
                })
              );
            } else if (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)) {
              // Bullet points or numbered lists
              documentChildren.push(
                new Paragraph({
                  children: parseMarkdownToRuns(line.replace(/^(\s*[-•]\s+|\s*\d+\.\s+)/, '').trim(), 22),
                  spacing: { after: 100 },
                  bullet: { level: 0 }
                })
              );
            } else {
              // Regular text
              documentChildren.push(
                new Paragraph({
                  children: parseMarkdownToRuns(line, 22),
                  spacing: { after: 100 }
                })
              );
            }
          }
        }
      }

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
          },
          children: documentChildren
        }]
      });

      return await Packer.toBlob(doc);
    } catch (error) {
      console.error('Error generating DOCX blob:', error);
      throw error;
    }
  };

  // Helper function to generate PDF as blob
  const generatePdfBlob = async (): Promise<Blob> => {
    try {
      const content = generateNHSSummaryContent();
      
      // Clean content for PDF (remove HTML tags if any)
      let pdfContent;
      if (aiGeneratedMinutes) {
        pdfContent = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')  // Replace HTML entities
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      } else {
        pdfContent = content;
      }

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      
      // Add content to PDF
      const lines = pdf.splitTextToSize(pdfContent, pageWidth - 2 * margin);
      let yPosition = margin;
      
      for (const line of lines) {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 6;
      }

      // Return as blob
      return pdf.output('blob');
    } catch (error) {
      console.error('Error generating PDF blob:', error);
      throw error;
    }
  };

  const generateNHSSummaryContent = () => {
    // Use AI-generated content if available, otherwise fall back to form content
    if (aiGeneratedMinutes) {
      return aiGeneratedMinutes;
    }

    // Fallback to form-based content if no AI content exists
    const date = getMeetingDate();
    const time = getMeetingRoundedTime();

    return `NHS MEETING MINUTES

Meeting Title: ${meetingData?.title || 'General Meeting'}
Date: ${date}
Time: ${time}
Duration: ${meetingData?.duration || '00:00'}
${meetingData?.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

ATTENDEES:
${summaryContent.attendees || 'Not specified'}

AGENDA:
${summaryContent.agenda || 'Not specified'}

KEY DISCUSSION POINTS:
${summaryContent.keyPoints || 'Not specified'}

DECISIONS MADE:
${summaryContent.decisions || 'Not specified'}

ACTION ITEMS:
${summaryContent.actionItems || 'Not specified'}

NEXT STEPS:
${summaryContent.nextSteps || 'Not specified'}

ADDITIONAL NOTES:
${summaryContent.additionalNotes || 'Not specified'}

---
Meeting recorded with Notewell AI Meeting Notes Service
Total words transcribed: ${meetingData?.wordCount || 0}
Speakers detected: ${meetingData?.speakerCount || 0}`;
  };

  const downloadDocx = async () => {
    try {
      // Save the current summary to database before downloading
      if (aiGeneratedMinutes) {
        await saveSummaryToDatabase(aiGeneratedMinutes);
      }
      
      // Get practice details for footer and logo
      const { data: practiceData, error: practiceError } = await supabase
        .from('practice_details')
        .select('logo_url, footer_text, show_page_numbers, practice_name, address')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (practiceError) {
        console.warn('Error fetching practice details:', practiceError);
      }
      
      console.log('Practice data for DOCX:', practiceData);
      
      const content = generateNHSSummaryContent();
      
      // Parse the content to create properly formatted paragraphs
      const lines = content.split('\n');
      const documentChildren = [];
      let currentTableRows = [];
      let inTable = false;
      
      // Add practice logo at the top if available
      let logoImageRun = null;
      if (practiceData?.logo_url) {
        try {
          console.log('Adding logo to DOCX:', practiceData.logo_url);
          const response = await fetch(practiceData.logo_url);
          if (!response.ok) throw new Error('Failed to fetch logo');
          
          const logoBlob = await response.blob();
          const logoArrayBuffer = await logoBlob.arrayBuffer();
          
          // Create image run for the logo
          logoImageRun = new ImageRun({
            data: new Uint8Array(logoArrayBuffer),
            transformation: {
              width: 120,
              height: 80,
            },
            type: "png", // or "jpg" depending on the image
          });
          
          // Add logo paragraph
          documentChildren.push(
            new Paragraph({
              children: [logoImageRun],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 200 }
            })
          );
          
          console.log('Logo added successfully to DOCX');
        } catch (error) {
          console.warn('Failed to load logo for DOCX:', error);
          // Fallback to practice name if logo fails
          if (practiceData?.practice_name) {
            documentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: practiceData.practice_name,
                    bold: true,
                    size: 24,
                    color: "1f4e79"
                  })
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 300 }
              })
            );
          }
        }
      } else if (practiceData?.practice_name) {
        // No logo URL, but have practice name
        documentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: practiceData.practice_name,
                bold: true,
                size: 24,
                color: "1f4e79"
              })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 }
          })
        );
      }
      
      // Insert canonical Date + Time header on one line when using AI-generated minutes
      if (aiGeneratedMinutes && meetingData?.startTime) {
        const dateStr = getMeetingDate();
        const timeStr = getMeetingRoundedTime();
        documentChildren.push(new Paragraph({
          children: [
            new TextRun({ text: `Date: ${dateStr}   Time: ${timeStr}`, bold: true, size: 22 })
          ],
          spacing: { after: 200 }
        }));
      }
      
      // Process each line with proper formatting
      for (const line of lines) {
        // Debug every line
        if (line.includes('#')) {
          console.log('Line with #:', JSON.stringify(line), 'starts with # ?', line.startsWith('# '));
        }
        
        if (!line.trim()) {
          documentChildren.push(new Paragraph({ text: "" }));
          continue;
        }
        
        // Check if this is a table row
        if (line.includes('|') && line.trim() !== '' && !line.includes('---')) {
          const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
          if (cells.length > 0) {
            inTable = true;
            const isHeaderRow = line.includes('Action/Decision') || line.includes('Responsible') || line.includes('Deadline');
            
            const tableRow = new TableRow({
              children: cells.map((cellText, index) => 
                new TableCell({
                  children: [new Paragraph({
                    children: isHeaderRow ? [new TextRun({ text: cellText, bold: true, size: 22 })] : parseMarkdownToRuns(cellText, 22)
                  })],
                  width: { 
                    size: cells.length === 3 ? (index === 0 ? 50 : 25) : 100/cells.length, 
                    type: WidthType.PERCENTAGE 
                  }
                })
              )
            });
            
            currentTableRows.push(tableRow);
          }
        } else {
          // If we were in a table and now have a non-table line, create the table
          if (inTable && currentTableRows.length > 0) {
            const table = new Table({
              rows: currentTableRows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            });
            documentChildren.push(table);
            currentTableRows = [];
            inTable = false;
          }
          
          // Skip empty lines and separator lines
          if (!line.trim() || line.includes('---')) {
            if (line.trim()) {
              documentChildren.push(new Paragraph({ text: "" }));
            }
            continue;
          }
          
          // Handle different types of lines with proper formatting
          if (line.startsWith('# ')) {
            // Main headers (like # 1. Ambient Voice Technology) - prioritize this
            const headerText = line.substring(2); // Remove "# "
            console.log('Processing header:', line, '-> cleaned:', headerText);
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: headerText, bold: true, size: 24, color: "1f4e79" })],
              spacing: { before: 200, after: 150 }
            }));
          } else if (line.match(/^#{2,6}\s+/)) {
            // Markdown headers like ## 1️⃣ Attendees — strip hashes for Word export
            const headerText = line.replace(/^#{1,6}\s+/, '').trim();
            console.log('Processing markdown header:', line, '-> cleaned:', headerText);
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: headerText, bold: true, size: 26, color: "1f4e79" })],
              spacing: { before: 300, after: 150 }
            }));
          } else if (line.match(/^\d+️⃣/)) {
            // Emoji section headers (like 3️⃣ Discussion Summary)
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: line, bold: true, size: 26, color: "1f4e79" })],
              spacing: { before: 300, after: 150 }
            }));
          } else if (line.includes('**') && (line.includes('–') || line.includes('-'))) {
            // Attendee lines like **Dal Samra** – GP Partner, Springfield Surgery
            const cleanLine = line.replace(/\*\*/g, ''); // Remove all ** markers
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: cleanLine, size: 22 })],
              spacing: { after: 100 }
            }));
          } else if (line.includes('**') && line.includes(':**')) {
            // Lines with inline bold text (like **Others referenced:**)
            const parts = line.split(/(\*\*[^*]+\*\*)/);
            const children = parts.map(part => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return new TextRun({ 
                  text: part.replace(/^\*\*|\*\*$/g, ''), 
                  bold: true, 
                  size: 24, 
                  color: "2c5aa0" 
                });
              } else {
                return new TextRun({ text: part, size: 22 });
              }
            });
            documentChildren.push(new Paragraph({
              children: children,
              spacing: { before: 150, after: 100 }
            }));
          } else if (line.startsWith('**') && line.endsWith('**')) {
            // Bold text (like **Present:**)
            const boldText = line.replace(/^\*\*|\*\*$/g, '');
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: boldText, bold: true, size: 24, color: "2c5aa0" })],
              spacing: { before: 150, after: 100 }
            }));
          } else if (line.startsWith('NHS MEETING MINUTES') || line.includes('Meeting Title:')) {
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: line, bold: true, size: 28, color: "1f4e79" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }));
          } else if (line.match(/^[A-Z\s]+:$/) || line.includes('ATTENDEES:') || line.includes('AGENDA:')) {
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: line, bold: true, size: 24, color: "1f4e79" })],
              spacing: { before: 200, after: 100 }
            }));
          } else {
            // Default case - log what we're processing
            if (line.includes('#')) {
              console.log('Default processing line with #:', line);
            }
            documentChildren.push(new Paragraph({
              children: parseMarkdownToRuns(line, 22),
              spacing: { after: 100 }
            }));
          }
        }
      }
      
      // Add any remaining table at the end
      if (inTable && currentTableRows.length > 0) {
        const table = new Table({
          rows: currentTableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        });
        documentChildren.push(table);
      }
      
      // Create footer content if configured
      let footerContent = [];
      if (practiceData?.footer_text) {
        console.log('Adding footer to DOCX:', practiceData.footer_text);
        
        const footerLines = practiceData.footer_text.split('\n');
        footerLines.forEach((line, index) => {
          if (line.trim()) {
            footerContent.push(
              new Paragraph({
                children: [new TextRun({ text: line.trim(), size: 16 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: index === footerLines.length - 1 ? 0 : 100 }
              })
            );
          }
        });
      }
      
      // Create the document with footer
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
          },
          headers: {},
          footers: footerContent.length > 0 ? {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "—————————————————————————————————————————", size: 12 })],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 }
                }),
                ...footerContent
              ]
            })
          } : {},
          children: documentChildren
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${meetingData?.title || 'meeting'}_minutes.docx`);
      toast.success("DOCX file downloaded successfully");
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast.error("Failed to generate DOCX file");
    }
  };

  const downloadPDF = async () => {
    try {
      // Save the current summary to database before downloading
      if (aiGeneratedMinutes) {
        await saveSummaryToDatabase(aiGeneratedMinutes);
      }
      
      // Get practice details for footer and logo
      const { data: practiceData, error: practiceError } = await supabase
        .from('practice_details')
        .select('logo_url, footer_text, show_page_numbers, practice_name, address')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (practiceError) {
        console.warn('Error fetching practice details:', practiceError);
      }
      
      console.log('Practice data for PDF:', practiceData);
      
      const content = generateNHSSummaryContent();
      
      // Clean content for PDF (remove HTML tags if any)
      let pdfContent;
      if (aiGeneratedMinutes) {
        pdfContent = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')  // Replace HTML entities
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      } else {
        pdfContent = content;
      }

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      
      // Function to add logo to page
      const addLogoToPage = async () => {
        if (practiceData?.logo_url) {
          try {
            const response = await fetch(practiceData.logo_url);
            if (!response.ok) throw new Error('Failed to fetch logo');
            
            const logoBlob = await response.blob();
            const logoDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(logoBlob);
            });
            
            const logoWidth = 40;
            const logoHeight = 30;
            pdf.addImage(logoDataUrl, 'PNG', pageWidth - logoWidth - margin, margin, logoWidth, logoHeight);
            console.log('Logo added to PDF successfully');
          } catch (error) {
            console.warn('Failed to load logo for PDF:', error);
          }
        } else {
          console.log('No logo URL found for practice');
        }
      };

      // Function to add footer to current page
      const addFooter = () => {
        const footerY = pageHeight - 20;
        pdf.setFontSize(8);
        
        // Footer text
        if (practiceData?.footer_text) {
          const footerLines = practiceData.footer_text.split('\n');
          footerLines.forEach((line, index) => {
            pdf.text(line, pageWidth / 2, footerY - (footerLines.length - 1 - index) * 5, { align: 'center' });
          });
        }
        
        // Page numbers
        if (practiceData?.show_page_numbers !== false) {
          const pageCount = pdf.getNumberOfPages();
          pdf.text(`Page ${pageCount}`, pageWidth / 2, footerY + 10, { align: 'center' });
        }
      };

      // Add logo to first page
      await addLogoToPage();
      
      const lines = pdfContent.split('\n');
      let y = practiceData?.logo_url ? 60 : 30; // Start below logo if present
      
      // Process each line with formatting
      for (const line of lines) {
        if (y > pageHeight - 40) { // Leave space for footer
          addFooter();
          pdf.addPage();
          await addLogoToPage();
          y = 30;
        }
        
        if (!line.trim()) {
          y += 6;
          continue;
        }
        
        // Title formatting
        if (line.includes('AI Generated Meeting Minutes') || line.includes('NHS MEETING MINUTES')) {
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text(line, pageWidth / 2, y, { align: 'center' });
          y += 20;
        }
        // Section headers
        else if (line.includes('###') || line.includes('ATTENDEES:') || line.includes('AGENDA:') || 
                line.includes('KEY DISCUSSION POINTS:') || line.includes('DECISIONS MADE:') || 
                line.includes('ACTION ITEMS:') || line.includes('NEXT STEPS:') || line.includes('ADDITIONAL NOTES:')) {
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          const cleanLine = line.replace(/###\s*/, '');
          pdf.text(cleanLine, margin, y);
          y += 12;
        }
        // Regular content
        else {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          // Handle long lines by splitting them
          const splitLines = pdf.splitTextToSize(line, pageWidth - 2 * margin);
          for (const splitLine of splitLines) {
            if (y > pageHeight - 40) {
              addFooter();
              pdf.addPage();
              await addLogoToPage();
              y = 30;
            }
            pdf.text(splitLine, margin, y);
            y += 6;
          }
        }
      }
      
      // Add footer to last page
      addFooter();
      
      pdf.save(`${meetingData?.title || 'meeting'}_minutes.pdf`);
      toast.success("PDF file downloaded successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF file");
    }
  };

  const downloadTranscript = () => {
    if (!meetingData?.transcript) {
      toast.error("No transcript available");
      return;
    }

    const date = getMeetingDate();
    const time = getMeetingRoundedTime();
    
    const transcriptContent = `MEETING TRANSCRIPT

Meeting: ${meetingData.title}
Date: ${date}
Start Time: ${time}
Duration: ${meetingData.duration}
Total Words: ${meetingData.wordCount}
Speakers: ${meetingData.speakerCount}
${meetingData.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

---

${meetingData.transcript}

---
Generated by Notewell AI Meeting Notes Service`;

    const blob = new Blob([transcriptContent], { type: 'text/plain' });
    saveAs(blob, `${meetingData.title}_transcript.txt`);
    toast.success("Transcript downloaded successfully");
  };

  const sendEmail = async () => {
    if (!user?.email) {
      toast.error("User email not available");
      return;
    }

    setIsEmailLoading(true);
    try {
      const attendeeEmailList = attendeeEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const response = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          userEmail: user.email,
          attendeeEmails: attendeeEmailList,
          meetingTitle: meetingData?.title || 'Meeting',
          meetingDate: new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB'),
          duration: meetingData?.duration || '00:00',
          summary: generateNHSSummaryContent(),
          includeTranscript,
          transcript: includeTranscript ? meetingData?.transcript : undefined,
          practiceName: meetingData?.practiceName
        }
      });

      if (response.error) throw response.error;
      
      toast.success("Email sent successfully");
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send email");
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Helper function to round timestamp to nearest 15-minute block
  const roundToNearestQuarterHour = (date: Date): string => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const roundedDate = new Date(date);
    roundedDate.setMinutes(roundedMinutes, 0, 0);
    return roundedDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Format rounded time as HH.MM for display in minutes
  const formatRoundedTimeDot = (date: Date): string => {
    const hhmm = roundToNearestQuarterHour(date);
    return hhmm.replace(':', '.');
  };

  const getMeetingDate = (): string => {
    console.log('🔍 getMeetingDate - meetingData:', meetingData);
    console.log('🔍 getMeetingDate - meetingSettings:', meetingSettings);
    
    // First try meetingData.startTime which is the primary source
    if (meetingData?.startTime) {
      try {
        const date = new Date(meetingData.startTime);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-GB', { 
            day: 'numeric',
            month: 'long', 
            year: 'numeric'
          });
        }
      } catch (error) {
        console.error('Error parsing meetingData.startTime:', error);
      }
    }
    
    // Fallback to meetingSettings date
    if (meetingSettings?.date) {
      try {
        const [y, m, d] = meetingSettings.date.split('-').map(Number);
        const date = new Date(y, (m || 1) - 1, d || 1);
        return date.toLocaleDateString('en-GB', { 
          day: 'numeric',
          month: 'long', 
          year: 'numeric'
        });
      } catch (error) {
        console.error('Error parsing meetingSettings.date:', error);
      }
    }
    
    return 'Not specified';
  };

  const getMeetingRoundedTime = (): string => {
    console.log('🔍 getMeetingRoundedTime - meetingData:', meetingData);
    console.log('🔍 getMeetingRoundedTime - meetingSettings:', meetingSettings);
    
    // First try meetingData.startTime which is the primary source  
    if (meetingData?.startTime) {
      try {
        const date = new Date(meetingData.startTime);
        if (!isNaN(date.getTime())) {
          return date.toLocaleTimeString('en-GB', { 
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      } catch (error) {
        console.error('Error parsing meetingData.startTime:', error);
      }
    }
    
    // Fallback to meetingSettings startTime
    if (meetingSettings?.startTime) {
      return meetingSettings.startTime;
    }
    
    return 'Not specified';
  };

  const getLocationDisplay = (): string => {
    const fmt = meetingSettings?.format;
    if (fmt === 'online') return 'Teams/Web Meeting';
    if (fmt === 'face-to-face') {
      return (meetingSettings?.location || '').trim() || 'Not specified';
    }
    return (meetingSettings?.location || '').trim() || 'Not specified';
  };
  // Helper function to create timestamped transcript
  const createTimestampedTranscript = (): string => {
    if (!transcriptData.length || !meetingData?.startTime) return '';
    return transcriptData.map(segment => {
      const speakerName = segment.speaker_name || 'Unknown Speaker';
      return `${speakerName}: ${segment.content}`;
    }).join('\n\n');
  };

  // Build a plain joined transcript from segments (no speakers/timestamps)
  const joinSegmentsPlain = (): string => {
    if (!transcriptData.length) return '';
    return transcriptData.map(t => t.content).join('\n\n');
  };

  // Pick the longest available transcript to ensure we always use the full content
  const pickFullTranscript = (): string => {
    const a = (meetingData?.transcript || '').trim();
    const b = (createTimestampedTranscript() || '').trim();
    const c = (joinSegmentsPlain() || '').trim();
    const candidates = [a, b, c].filter(Boolean) as string[];
    if (candidates.length === 0) return '';
    let best = candidates[0];
    for (const s of candidates) if (s.length > best.length) best = s;
    return best;
  };
  // Clean AI minutes to remove separators, dashed table header rows, extra spacing, and boilerplate footer
  const cleanAIMinutes = (input: string) => {
    return input
      .replace(/^\s*---\s*$/gm, '')
      .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/gm, '')
      .replace(/Let me know if you need the minutes tailored for a specific audience or with further expansion on any section\.?/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Ensure Date and Time are shown together (inject Time after Date or add both if missing)
  const injectDateTime = (input: string, dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return input;
    // Case 1: Bold markdown label
    const boldDateRegex = /(\*\*Date:\*\*)\s*([^\n]*)/i;
    if (boldDateRegex.test(input)) {
      return input.replace(boldDateRegex, (m, label) => `${label} ${dateStr}   **Time:** ${timeStr}`);
    }
    // Case 2: Plain label
    const plainDateRegex = /(Date:)\s*([^\n]*)/i;
    if (plainDateRegex.test(input)) {
      return input.replace(plainDateRegex, (m, label) => `${label} ${dateStr}   Time: ${timeStr}`);
    }
    // Case 3: Insert under the main heading
    const headingRegex = /^#\s*Meeting Minutes.*$/m;
    if (headingRegex.test(input)) {
      return input.replace(headingRegex, (h) => `${h}\n\n**Date:** ${dateStr}   **Time:** ${timeStr}`);
    }
    // Fallback: prepend
    return `**Date:** ${dateStr}   **Time:** ${timeStr}\n\n${input}`;
  };
  const generateAIMeetingMinutes = async (customDetailLevel?: string) => {
    const t0 = performance.now();
    console.groupCollapsed('Timing: generateAIMeetingMinutes');
    console.time('total: generateAIMeetingMinutes');
    console.log('🔄 Regenerating AI Meeting Minutes with settings:', meetingSettings);
    
    // Create timestamped transcript from transcript data
    const tPrep0 = performance.now();
    const transcript = pickFullTranscript();
    const tPrep1 = performance.now();
    
    if (!transcript) {
      toast.error("No transcript available for AI generation");
      console.timeEnd('total: generateAIMeetingMinutes');
      console.groupEnd();
      return;
    }

    // Use custom detail level if provided, otherwise use current setting
    const levelToUse = customDetailLevel || detailLevel;

    // Calculate and set expected duration based on word count
    const duration = calculateExpectedDuration(meetingData.wordCount);
    setExpectedDuration(duration);
    setCountdown(duration);

    setIsGeneratingMinutes(true);
    try {
      const meetingDate = getMeetingDate();
      const meetingTime = getMeetingRoundedTime();

      const tInvoke0 = performance.now();
      const minutes = await generateMinutesFast(transcript, {
        meetingTitle: meetingSettings.title || meetingData.title,
        meetingDate,
        meetingTime,
        detailLevel: levelToUse as any,
        onProgress: (done, total) => setCleanProgress({ done, total }) // reuse progress display
      });
      const tInvoke1 = performance.now();

      const tClean0 = performance.now();
      let cleaned = cleanAIMinutes(minutes);
      cleaned = injectDateTime(cleaned, meetingDate, meetingTime);
      const tClean1 = performance.now();
      
      const tSet0 = performance.now();
      setAiGeneratedMinutes(cleaned);
      await saveSummaryToDatabase(cleaned);
      const tSet1 = performance.now();

      const durations = {
        prepareMs: Math.round(tPrep1 - tPrep0),
        networkMs: Math.round(tInvoke1 - tInvoke0),
        postProcessMs: Math.round(tClean1 - tClean0),
        updateAndSaveMs: Math.round(tSet1 - tSet0),
        totalMs: Math.round(tSet1 - t0),
      } as const;
      console.table(durations);

      if (!firstAIGenerateLoggedRef.current) {
        console.log('First-run AI minutes total (ms):', durations.totalMs);
        firstAIGenerateLoggedRef.current = true;
      }

      if (!isMobile) {
        toast.success("AI meeting minutes generated successfully!");
      }
      
    } catch (error) {
      console.error('Error generating AI meeting minutes:', error);
      toast.error("Failed to generate AI meeting minutes");
    } finally {
      setIsGeneratingMinutes(false);
      console.timeEnd('total: generateAIMeetingMinutes');
      console.groupEnd();
    }
  };

  const generateClaudeMeetingMinutes = async (customDetailLevel?: string) => {
    // Always default to Style 2 (informal) if no style is provided
    const actualDetailLevel = customDetailLevel || 'informal';

    // Map style IDs to API format
    const styleMapping: { [key: string]: string } = {
      'style1': 'standard',
      'style2': 'informal', 
      'style3': 'nhs'
    };
    
    const levelToUse = styleMapping[actualDetailLevel] || actualDetailLevel;
    setIsClaudeGenerating(true);
    
    try {
      const transcript = pickFullTranscript();
      
      if (!transcript) {
        toast.error("No transcript available for Claude AI generation");
        return;
      }

      console.log('🤖 Generating Claude AI meeting minutes with level:', levelToUse);
      
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript,
          meetingTitle: meetingSettings?.title || "General Meeting",
          meetingDate: getMeetingDate(),
          meetingTime: getMeetingRoundedTime(),
          detailLevel: levelToUse
        }
      });

      if (error) throw error;
      
      if (data?.success && data?.meetingMinutes) {
        setClaudeNotes(data.meetingMinutes);
        setClaudeDetailLevel(levelToUse);
        setIsClaudeMinutesOpen(true);
        
        // Save the generated notes to database
        await saveClaudeNotesToDatabase(data.meetingMinutes, levelToUse);
        
        toast.success("Claude AI meeting minutes generated and saved successfully!");
      } else {
        throw new Error(data?.error || 'Failed to generate Claude AI meeting minutes');
      }
    } catch (error: any) {
      console.error('Error generating Claude meeting notes:', error);
      toast.error(`Failed to generate Claude AI meeting notes: ${error.message}`);
    } finally {
      setIsClaudeGenerating(false);
    }
  };

  const saveClaudeNotesToDatabase = async (notes: string, styleFormat: string) => {
    if (!meetingData?.id || !user) {
      console.log('No meeting ID or user available for saving notes');
      return;
    }

    try {
      // Check if summary already exists
      const { data: existingSummary, error: checkError } = await supabase
        .from('meeting_summaries')
        .select('id')
        .eq('meeting_id', meetingData.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is ok
        throw checkError;
      }

      if (existingSummary) {
        // Update existing summary
        const { error: updateError } = await supabase
          .from('meeting_summaries')
          .update({
            summary: notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSummary.id);

        if (updateError) throw updateError;
        console.log('✅ Claude notes updated in database');
      } else {
        // Insert new summary
        const { error: insertError } = await supabase
          .from('meeting_summaries')
          .insert({
            meeting_id: meetingData.id,
            summary: notes,
            user_id: user.id,
            created_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
        console.log('✅ Claude notes saved to database');
      }
    } catch (error) {
      console.error('Error saving Claude notes to database:', error);
      toast.warning("Notes generated but couldn't be saved to database");
    }
  };



  const handleCopyClaudeNotes = () => {
    navigator.clipboard.writeText(claudeNotes);
    toast.success("Claude AI notes copied to clipboard");
  };

  const saveSummaryToDatabase = async (summaryContent: string) => {
    if (!meetingData?.id || !user) {
      console.warn('Cannot save summary: missing meeting ID or user');
      return;
    }

    try {
      // Check if a summary already exists for this meeting
      const { data: existingSummary } = await supabase
        .from('meeting_summaries')
        .select('id')
        .eq('meeting_id', meetingData.id)
        .maybeSingle();

      if (existingSummary) {
        // Update existing summary
        const { error } = await supabase
          .from('meeting_summaries')
          .update({
            summary: summaryContent,
            ai_generated: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSummary.id);

        if (error) throw error;
        console.log('Summary updated successfully');
      } else {
        // Create new summary
        const { error } = await supabase
          .from('meeting_summaries')
          .insert({
            meeting_id: meetingData.id,
            summary: summaryContent,
            ai_generated: true
          });

        if (error) throw error;
        console.log('Summary saved successfully');
      }
    } catch (error) {
      console.error('Error saving summary to database:', error);
      // Don't show error to user as this is a background operation
    }
  };

  const saveEditedContent = async () => {
    setAiGeneratedMinutes(editableContent);
    setIsEditingDocument(false);
    
    // Save the edited content to the database
    await saveSummaryToDatabase(editableContent);
    
    toast.success("Changes saved successfully!");
  };

  const startEditing = () => {
    setEditableContent(aiGeneratedMinutes || "");
    setIsEditingDocument(true);
  };

  const cancelEditing = () => {
    setEditableContent("");
    setIsEditingDocument(false);
  };

  const loadExistingSummary = async (meetingId: string) => {
    try {
      // Load summary, overview, and transcript data
      const [summaryResult, overviewResult, transcriptResult] = await Promise.all([
        supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle(),
        supabase
          .from('meeting_overviews')
          .select('overview')
          .eq('meeting_id', meetingId)
          .maybeSingle(),
        supabase
          .from('meeting_transcripts')
          .select('content, speaker_name, timestamp_seconds, created_at')
          .eq('meeting_id', meetingId)
          .order('timestamp_seconds', { ascending: true })
      ]);

      if (summaryResult.error) {
        console.error('Error loading existing summary:', summaryResult.error);
      } else if (summaryResult.data?.summary) {
        setAiGeneratedMinutes(summaryResult.data.summary);
        setClaudeNotes(summaryResult.data.summary); // Also set as Claude notes
        console.log('Loaded existing summary from database');
      }

      if (overviewResult.error) {
        console.error('Error loading existing overview:', overviewResult.error);
      } else if (overviewResult.data?.overview) {
        setMeetingOverview(overviewResult.data.overview);
        console.log('Loaded existing overview from database');
      }

      if (transcriptResult.error) {
        console.error('Error loading transcript data:', transcriptResult.error);
      } else if (transcriptResult.data) {
        setTranscriptData(transcriptResult.data);
        console.log('Loaded transcript data:', transcriptResult.data.length, 'entries');
      }

      // Load full transcript using the database function for display
      try {
        const { data: fullTranscriptResult, error: fullTranscriptError } = await supabase.rpc('get_meeting_full_transcript', { 
          p_meeting_id: meetingId 
        });
        
        if (!fullTranscriptError && fullTranscriptResult && fullTranscriptResult.length > 0) {
          const fullTranscriptText = fullTranscriptResult[0].transcript;
          console.log('Loaded full transcript:', fullTranscriptText.length, 'characters from', fullTranscriptResult[0].source);
          
          // Update meeting data with the full transcript
          setMeetingData(prev => prev ? { ...prev, transcript: fullTranscriptText } : null);
        } else {
          console.warn('No full transcript found or error:', fullTranscriptError);
        }
      } catch (error) {
        console.error('Error loading full transcript:', error);
      }
      
    } catch (error) {
      console.error('Error loading existing data:', error);
    }

    // Try to load any audio backup linked to this meeting
    try {
      const { data: backups, error: backupsError } = await supabase
        .from('meeting_audio_backups')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!backupsError && backups && backups.length > 0) {
        setBackupRecord(backups[0]);
        console.log('Found audio backup for meeting');
      }
    } catch (e) {
      console.warn('Could not load audio backup info:', e);
    }
  };

  // Auto-reprocess from backup when transcript is too short
  useEffect(() => {
    const wc = meetingData?.wordCount ?? 0;
    if (!autoReprocessTriggered.current && backupRecord && wc > 0 && wc < 1000) {
      autoReprocessTriggered.current = true;
      reprocessFromBackup();
    }
  }, [backupRecord, meetingData?.wordCount]);

  // Enhanced markdown-like rendering function
  const renderFormattedText = (text: string) => {
    if (!text) return text;
    
    let formatted = text;
    
    // Fix attendees section - convert bullet points to comma-separated names and remove "Other" sections
    formatted = formatted.replace(
      /(1️⃣ Attendees[\s\S]*?)(?=2️⃣|$)/i,
      (match) => {
        let attendeesSection = match;
        
        // Remove any "Other" related sections completely
        attendeesSection = attendeesSection.replace(/Other[^:]*:[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        attendeesSection = attendeesSection.replace(/Other[^:]*[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        
        // Remove bullet points and convert to comma-separated list
        attendeesSection = attendeesSection.replace(/^[•\-\*]\s*(.+)$/gm, '$1');
        
        // Split into lines and clean up
        const lines = attendeesSection.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.includes('1️⃣') && !line.toLowerCase().includes('other'))
          .filter(line => line.length > 2); // Remove very short lines
        
        if (lines.length > 0) {
          // Join names with commas and ensure proper formatting
          const cleanedNames = lines.join(', ').replace(/,\s*,/g, ',').replace(/,+/g, ',');
          attendeesSection = `1️⃣ Attendees\n${cleanedNames}\n\n`;
        }
        
        return attendeesSection;
      }
    );
    
    // Ensure proper spacing between emoji sections
    formatted = formatted.replace(/(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '\n\n$1');
    
    // Convert #### headers (level 4)
    formatted = formatted.replace(/^#### (.*$)/gm, '<h4 class="text-base font-semibold mt-3 mb-2 text-gray-800">$1</h4>');
    
    // Convert ### headers (level 3)
    formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800">$1</h3>');
    
    // Convert ## headers (level 2)
    formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3 text-gray-800">$1</h2>');
    
    // Convert # headers (level 1)
    formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-800">$1</h1>');
    
    
    // Improve table formatting with minimal top spacing
    formatted = formatted.replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map(cell => cell.trim());
      const cellsHtml = cells.map(cell => 
        `<td class="border border-gray-300 px-3 py-2 text-sm">${cell}</td>`
      ).join('');
      return `<tr>${cellsHtml}</tr>`;
    });
    
    // Wrap table rows in proper table structure with minimal spacing before tables
    formatted = formatted.replace(/(<tr>.*<\/tr>\s*)+/g, (match) => {
      return `<table class="w-full border-collapse border border-gray-300 mt-1 mb-4">${match}</table>`;
    });
    
    // Remove excessive spacing before tables specifically in section 4
    formatted = formatted.replace(/(4️⃣[^<]*)<div class="mb-3"><\/div>\s*<table/g, '$1<table');
    
    // Convert **bold** to HTML bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Convert *italic* to HTML italic
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
    
    // Convert bullet points with better styling
    formatted = formatted.replace(/^[•\-\*] (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2">•</span><span>$1</span></div>');
    
    // Convert numbered lists
    formatted = formatted.replace(/^(\d+)\. (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2 font-medium">$1.</span><span>$2</span></div>');
    
    // Convert line breaks to proper spacing with reduced spacing before sections
    formatted = formatted.replace(/\n\n\n+/g, '\n\n'); // Remove excessive line breaks
    formatted = formatted.replace(/\n\n/g, '<div class="mb-3"></div>');
    formatted = formatted.replace(/\n/g, '<br />');
    
    // Clean up excessive spacing around emoji sections
    formatted = formatted.replace(/<div class="mb-3"><\/div>\s*(<div class="mb-3"><\/div>\s*)*(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '<div class="mb-4"></div>$2');
    
    return formatted;
  };

  if (!meetingData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => navigate('/')} />
      <NotewellAIAnimation isVisible={isGeneratingMinutes} />
      <div className="px-3 py-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header - Mobile Optimized */}
        <div className="space-y-3">
          {/* Back Button - Full Width on Mobile */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={continueMeeting}
              className="touch-manipulation min-h-[44px] px-3"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back</span>
              <span className="sm:hidden">Back</span>
            </Button>
            
            {/* Status Badge - Mobile Positioned */}
            {isSaved && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                <span className="hidden sm:inline">Meeting Saved</span>
                <span className="sm:hidden">Saved</span>
              </Badge>
            )}
          </div>
          
          {/* Title Section with Logo - Optimized for Mobile */}
          <div className="text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
              {/* Practice Logo */}
              {practiceData?.logo_url && (
                <div className="flex justify-center sm:justify-start mb-3 sm:mb-0">
                  <img 
                    src={practiceData.logo_url} 
                    alt={`${practiceData.practice_name || 'Practice'} Logo`}
                    className="h-12 w-auto sm:h-16 object-contain"
                    onError={(e) => {
                      console.warn('Failed to load practice logo');
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className={practiceData?.logo_url ? '' : 'w-full'}>
                <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground line-clamp-2">
                  {meetingData?.title || meetingSettings?.title || 'Meeting'}
                </h1>
                </div>
                {isReprocessing && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full" />
                    <span>{reprocessStatus || 'Reprocessing...'}</span>
                    {cleanProgress.total > 0 && (
                      <span>({cleanProgress.done}/{cleanProgress.total})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
        
        
        <div className="grid grid-cols-1 gap-6">
          {/* Transcript Truncation Alert and Reprocessing Panel */}
          {transcriptTruncated && audioBackupInfo && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                  <AlertTriangle className="h-5 w-5" />
                  Potential Transcript Truncation Detected
                </CardTitle>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  This meeting may have incomplete transcript content. Audio backup available for reprocessing to recover missing content.
                  <div className="mt-2 text-xs">
                    <strong>Meeting:</strong> {meetingData?.title}<br/>
                    <strong>Audio File:</strong> {audioBackupInfo.file_path?.split('/').pop()}<br/>
                    <strong>File Size:</strong> {Math.round((audioBackupInfo.file_size || 0) / 1024 / 1024)}MB
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AudioReprocessingPanel
                  meetingId={meetingData?.id || ''}
                  userId={user?.id || ''}
                  audioFilePath={audioBackupInfo.file_path || ''}
                />
              </CardContent>
            </Card>
          )}
          
          {/* AI Generated Meeting Minutes Document View */}
          {aiGeneratedMinutes ? (
            <>
              {/* Claude AI Meeting Minutes Section - MOVED TO TOP */}
              <Card>
                <Collapsible open={isClaudeMinutesOpen} onOpenChange={setIsClaudeMinutesOpen}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="hover:bg-accent/50 transition-colors cursor-pointer touch-manipulation" style={{ WebkitTapHighlightColor: 'transparent' }}>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-primary" />
                          <span className="text-sm sm:text-base">Claude AI Meeting Minutes</span>
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI Enhanced
                          </Badge>
                        </span>
                        <div className="flex items-center gap-2">
                          {!claudeNotes && !isClaudeGenerating && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                generateClaudeMeetingMinutes();
                              }}
                              disabled={!meetingData?.transcript}
                              variant="default"
                              size="sm"
                              className="h-8 px-3 text-xs touch-manipulation"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate
                            </Button>
                          )}
                          {isClaudeGenerating && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                              <span className="hidden sm:inline">Generating...</span>
                            </div>
                          )}
                          {claudeNotes && (
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyClaudeNotes();
                                }}
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs touch-manipulation"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsClaudeEditing(!isClaudeEditing);
                                }}
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs touch-manipulation"
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                {isClaudeEditing ? "Save" : "Edit"}
                              </Button>
                            </div>
                          )}
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${isClaudeMinutesOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {claudeNotes ? (
                        <div className="space-y-4">
                          {/* Claude Notes Display */}
                          <div className="border rounded-lg overflow-hidden bg-white">
                            {isClaudeEditing ? (
                              <Textarea
                                value={claudeNotes}
                                onChange={(e) => setClaudeNotes(e.target.value)}
                                className="min-h-[400px] sm:min-h-[600px] font-mono text-sm resize-none border-0 shadow-none focus:ring-0 bg-white"
                                placeholder="Claude AI generated notes..."
                              />
                            ) : (
                              <div className="p-6 bg-white max-h-[600px] overflow-auto">
                                <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                                  <SafeMessageRenderer content={claudeNotes} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 sm:py-12 text-muted-foreground">
                          <Bot className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg sm:text-xl font-semibold mb-2">No Claude AI Minutes Generated Yet</h3>
                          <p className="text-sm sm:text-base mb-4 max-w-md mx-auto">
                            Generate enhanced meeting minutes using Claude AI with the Original Informal format for clear, direct documentation.
                          </p>
                          <div className="space-y-3">
                            <Button
                              onClick={() => generateClaudeMeetingMinutes()}
                              disabled={isClaudeGenerating}
                              variant="default"
                              className="text-xs sm:text-sm"
                            >
                              {isClaudeGenerating ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-current mr-2"></div>
                                  Generating with Claude...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                  Generate Notes
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Meeting Settings */}
              <Card>
                <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Settings className="h-5 w-5" />
                          Meeting Settings
                        </span>
                        <ChevronDown 
                          className={`h-4 w-4 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`}
                        />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <MeetingSettings
                        onSettingsChange={(settings) => {
                          console.log('📝 Meeting settings updated:', settings);
                          setMeetingSettings(settings);
                        }}
                        onTranscriptImported={(importedTranscript) => {
                          // Handle imported transcript by updating meeting data
                          setMeetingData(prev => ({
                            ...prev,
                            transcript: importedTranscript.content,
                            wordCount: importedTranscript.wordCount
                          }));
                          
                          console.log('📄 Transcript imported in summary page:', importedTranscript.wordCount, 'words');
                        }}
                        initialSettings={{
                          title: meetingSettings.title,
                          description: meetingSettings.description,
                          meetingType: meetingSettings.meetingType
                        }}
                      />
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          onClick={() => generateAIMeetingMinutes()}
                          disabled={isGeneratingMinutes}
                          className="w-full"
                        >
                          {isGeneratingMinutes ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Generating AI Minutes...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              {aiGeneratedMinutes ? 'Regenerate with Updated Settings' : 'Generate Meeting Minutes with AI'}
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* AI Meeting Minutes Enhancer - positioned between settings and generated minutes */}
              <MeetingMinutesEnhancer
                originalContent={aiGeneratedMinutes}
                onEnhancedContent={(enhancedContent) => {
                  setAiGeneratedMinutes(enhancedContent);
                  setEditableContent(enhancedContent);
                }}
                onSave={async (content) => {
                  setAiGeneratedMinutes(content);
                  setEditableContent(content);
                  await saveSummaryToDatabase(content);
                }}
                isVisible={!!aiGeneratedMinutes}
              />

              {/* Claude AI Meeting Minutes Section - MOVED TO TOP */}
              <Card>
                <Collapsible open={isClaudeMinutesOpen} onOpenChange={setIsClaudeMinutesOpen}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="hover:bg-accent/50 transition-colors cursor-pointer touch-manipulation" style={{ WebkitTapHighlightColor: 'transparent' }}>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-primary" />
                          <span className="text-sm sm:text-base">Claude AI Meeting Minutes</span>
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI Enhanced
                          </Badge>
                        </span>
                        <div className="flex items-center gap-2">
                          {!claudeNotes && !isClaudeGenerating && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                generateClaudeMeetingMinutes();
                              }}
                              disabled={!meetingData?.transcript}
                              variant="default"
                              size="sm"
                              className="h-8 px-3 text-xs touch-manipulation"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate
                            </Button>
                          )}
                          {isClaudeGenerating && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                              <span className="hidden sm:inline">Generating...</span>
                            </div>
                          )}
                          {claudeNotes && (
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyClaudeNotes();
                                }}
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs touch-manipulation"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsClaudeEditing(!isClaudeEditing);
                                }}
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs touch-manipulation"
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                {isClaudeEditing ? "Save" : "Edit"}
                              </Button>
                            </div>
                          )}
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${isClaudeMinutesOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {claudeNotes ? (
                        <div className="space-y-4">
                          {/* Claude Notes Display */}
                          <div className="border rounded-lg overflow-hidden bg-white">
                            {isClaudeEditing ? (
                              <Textarea
                                value={claudeNotes}
                                onChange={(e) => setClaudeNotes(e.target.value)}
                                className="min-h-[400px] sm:min-h-[600px] font-mono text-sm resize-none border-0 shadow-none focus:ring-0 bg-white"
                                placeholder="Claude AI generated notes..."
                              />
                            ) : (
                              <div className="p-6 bg-white max-h-[600px] overflow-auto">
                                <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                                  <SafeMessageRenderer content={claudeNotes} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 sm:py-12 text-muted-foreground">
                          <Bot className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg sm:text-xl font-semibold mb-2">No Claude AI Minutes Generated Yet</h3>
                          <p className="text-sm sm:text-base mb-4 max-w-md mx-auto">
                            Generate enhanced meeting minutes using Claude AI with the Original Informal format for clear, direct documentation.
                          </p>
                          <div className="space-y-3">
                            <Button
                              onClick={() => generateClaudeMeetingMinutes()}
                              disabled={isClaudeGenerating}
                              variant="default"
                              className="text-xs sm:text-sm"
                            >
                              {isClaudeGenerating ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-current mr-2"></div>
                                  Generating with Claude...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                  Generate Notes
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Development Version AI Generated Meeting Minutes Document View */}
              <Card>
                <Collapsible open={isAIMinutesOpen} onOpenChange={setIsAIMinutesOpen}>
                    <CardHeader className="hover:bg-accent/50 transition-colors">
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FilePlus2 className="h-5 w-5" />
                          <span className="text-sm sm:text-base">Development Version of AI Generated Minutes Only - Please Ignore</span>
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Development Only
                          </Badge>
                        </span>
                        <div className="flex items-center gap-2">
                          {aiGeneratedMinutes && isAIMinutesOpen && (
                            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                              {/* Detail slider (desktop) */}
                              <div className="hidden sm:flex items-center gap-2 mr-2">
                                <span className="text-xs text-muted-foreground">Detail</span>
                                <div className="w-28">
                                  <Slider
                                    min={0}
                                    max={2}
                                    step={1}
                                    value={[detailLevel === 'standard' ? 0 : detailLevel === 'more' ? 1 : 2]}
                                    onValueChange={(v) => {
                                      sliderChangeStartRef.current = performance.now();
                                      const idx = Array.isArray(v) ? (v[0] ?? 0) : 0;
                                      const newLevel = idx === 0 ? 'standard' : idx === 1 ? 'more' : 'super';
                                      setDetailLevel(newLevel as 'standard' | 'more' | 'super');
                                      setIsAIMinutesOpen(true);
                                      const label = `Timing: Slider -> AI minutes (${newLevel})`;
                                      console.time(label);
                                      generateAIMeetingMinutes(newLevel).finally(() => {
                                        console.timeEnd(label);
                                      });
                                    }}
                                  />
                                </div>
                                <Badge variant="secondary" className="text-[10px]">
                                  {detailLevel === 'standard' ? 'Standard' : detailLevel === 'more' ? 'More detailed' : 'Super detailed'}
                                </Badge>
                              </div>
                              {!isEditingDocument ? (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadDocx();
                                    }}
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                  >
                                    <FileDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    Download Word
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditing();
                                    }}
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                  >
                                    <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    Edit Document
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveEditedContent();
                                    }}
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                  >
                                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    Save Changes
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditing();
                                    }}
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                  >
                                    Cancel
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                          <CollapsibleTrigger asChild>
                            <button type="button" aria-label="Toggle AI minutes" className="p-1 rounded-md hover:bg-accent/50">
                              <ChevronDown className={`h-4 w-4 transition-transform ${isAIMinutesOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </CollapsibleTrigger>
                        </div>
                      </CardTitle>
                    </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      {aiGeneratedMinutes ? (
                        isEditingDocument ? (
                          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <Textarea
                              value={editableContent}
                              onChange={(e) => setEditableContent(e.target.value)}
                              className="min-h-[400px] sm:min-h-[600px] font-mono text-sm resize-none border-0 shadow-none focus:ring-0"
                              placeholder="Edit your meeting minutes here..."
                            />
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                              <p className="font-medium mb-1">💡 Quick Edit Tips:</p>
                              <ul className="space-y-1">
                                <li>• Use **text** for bold formatting</li>
                                <li>• Use emoji sections like 1️⃣, 2️⃣ for clear structure</li>
                                <li>• Use | table | format | for neat tables</li>
                                <li>• Keep attendee names comma-separated</li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-8 shadow-sm max-h-[600px] sm:max-h-[800px] overflow-y-auto">
                            <div className="prose max-w-none">
                              <Profiler id="NotesDisplay" onRender={onNotesRender}>
                                <SafeMessageRenderer 
                                  content={renderFormattedText(aiGeneratedMinutes)}
                                />
                              </Profiler>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="text-center py-8 sm:py-12 text-muted-foreground">
                          <Sparkles className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg sm:text-xl font-semibold mb-2">Development Version Only - Please Use Claude AI Above</h3>
                          <p className="text-sm sm:text-base mb-4 max-w-md mx-auto">
                            This is a development version for testing purposes only. Please use Claude AI Meeting Minutes above for production use.
                          </p>
                          <Button
                            onClick={() => generateAIMeetingMinutes()}
                            disabled={isGeneratingMinutes}
                            variant="outline"
                            className="text-xs sm:text-sm"
                          >
                            {isGeneratingMinutes ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-current mr-2"></div>
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                Generate AI Minutes
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Remove the duplicate Claude AI section that was moved to top */}



            </>
          ) : (
            /* Initial Summary View - Only Transcript */
            <div className="grid grid-cols-1 gap-6">
              {/* Meeting Settings */}
              <Card>
                <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Settings className="h-5 w-5" />
                          Meeting Settings
                        </span>
                        <ChevronDown 
                          className={`h-4 w-4 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`}
                        />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <MeetingSettings
                        onSettingsChange={(settings) => {
                          console.log('📝 Meeting settings updated:', settings);
                          setMeetingSettings(settings);
                        }}
                        onTranscriptImported={(importedTranscript) => {
                          // Handle imported transcript by updating meeting data
                          setMeetingData(prev => ({
                            ...prev,
                            transcript: importedTranscript.content,
                            wordCount: importedTranscript.wordCount
                          }));
                          
                          console.log('📄 Transcript imported in summary page:', importedTranscript.wordCount, 'words');
                        }}
                        initialSettings={{
                          title: meetingSettings.title,
                          description: meetingSettings.description,
                          meetingType: meetingSettings.meetingType
                        }}
                      />
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          onClick={() => generateAIMeetingMinutes()}
                          disabled={isGeneratingMinutes}
                          className="w-full"
                        >
                          {isGeneratingMinutes ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Generating AI Minutes...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Meeting Minutes with AI
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

            </div>
          )}
          
          {/* Meeting Transcript - Always visible at bottom with Clean Button */}
          <Card className="mt-6">
            <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Meeting Transcript
                    </span>
                    <div className="flex items-center gap-2">
                      {isTranscriptOpen && (meetingData?.transcript || transcriptData.length > 0) && (
                        <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isCleaningTranscript}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setIsCleaningTranscript(true);
                            try {
                              console.log('🧹 Starting transcript cleaning...');
                              const transcriptToClean = pickFullTranscript();
                              if (!transcriptToClean || transcriptToClean.trim().length === 0) {
                                throw new Error('No transcript content to clean');
                              }
                              console.log('📝 Transcript to clean length:', transcriptToClean.length);
                              setCleanProgress({ done: 0, total: 0 });
                              const cleaned = await cleanLargeTranscript(
                                transcriptToClean,
                                meetingData?.title || 'Meeting',
                                (done, total) => setCleanProgress({ done, total })
                              );
                               
                               console.log('✅ Received cleaned transcript, length:', cleaned.length);
                               
                               // Auto-save cleaned transcript
                               if (meetingData?.id) {
                                 console.log('💾 Auto-saving cleaned transcript to database...');
                                 
                                 // Delete existing transcript
                                 const { error: saveError } = await supabase
                                   .from('meeting_transcripts')
                                   .delete()
                                   .eq('meeting_id', meetingData.id);
                                 
                                 if (saveError) {
                                   console.error('❌ Error deleting old transcript:', saveError);
                                   throw saveError;
                                 }
                                 
                                 // Insert cleaned transcript
                                 const { error: insertError } = await supabase
                                   .from('meeting_transcripts')
                                   .insert({
                                     meeting_id: meetingData.id,
                                     content: cleaned,
                                     speaker_name: 'AI Cleaned Transcript',
                                     timestamp_seconds: 0,
                                     confidence_score: 1.0
                                   });
                                 
                                 if (insertError) {
                                   console.error('❌ Error inserting cleaned transcript:', insertError);
                                   throw insertError;
                                 }
                                 
                                 console.log('✅ Successfully auto-saved cleaned transcript');
                                 
                                 // Update local state immediately with the cleaned transcript
                                 if (meetingData) {
                                   setMeetingData(prev => prev ? { 
                                     ...prev, 
                                     transcript: cleaned 
                                   } : null);
                                 }
                                 
                                 // Refresh transcript data to show cleaned version
                                 const { data: refreshedTranscript } = await supabase
                                   .from('meeting_transcripts')
                                   .select('content, speaker_name, timestamp_seconds, created_at')
                                   .eq('meeting_id', meetingData.id)
                                   .order('timestamp_seconds', { ascending: true });
                                 
                                 if (refreshedTranscript) {
                                   setTranscriptData(refreshedTranscript);
                                 }
                                 
                                 const improvement = ((transcriptToClean.length - cleaned.length) / transcriptToClean.length * 100).toFixed(1);
                                 toast.success(`Transcript cleaned and auto-saved! Removed duplications, improved formatting (${improvement}% noise reduction).`);
                               } else {
                                 // Just update local state if no meeting ID
                                 setMeetingData(prev => prev ? { ...prev, transcript: cleaned } : null);
                                 toast.success('Transcript cleaned with improved formatting and spacing!');
                               }
                            } catch (error) {
                              console.error('❌ Error cleaning transcript:', error);
                              toast.error(`Failed to clean transcript: ${error.message || 'Unknown error'}`);
                            } finally {
                              setIsCleaningTranscript(false);
                            }
                          }}
                          className="text-xs"
                        >
                          {isCleaningTranscript ? (
                            <>
                              <div className="h-3 w-3 mr-1 animate-spin border border-current border-t-transparent rounded-full" />
                              {cleanProgress.total > 0 ? `Cleaning ${cleanProgress.done}/${cleanProgress.total}...` : 'Cleaning...'}
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Transcript AI Clean
                            </>
                          )}
                        </Button>
                        </>)}
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${isTranscriptOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {(meetingData?.transcript || transcriptData.length > 0) ? (
                    <div className="space-y-4">
                      {/* Copy and Download buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={handleCopyTranscript}>
                          <Copy className="h-4 w-4 mr-2" /> Copy Transcript
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDownloadTranscriptWord}>
                          <FileDown className="h-4 w-4 mr-2" /> Download Word
                        </Button>
                      </div>
                      {isReprocessing && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full" />
                          <span>{reprocessStatus || 'Reprocessing...'}</span>
                          {cleanProgress.total > 0 && (
                            <span>({cleanProgress.done}/{cleanProgress.total})</span>
                          )}
                        </div>
                      )}
                      
                      {/* Display timestamped transcript sections */}
                      {(() => {
                          const joined = transcriptData.length > 0 ? transcriptData.map(t => t.content).join(' ') : '';
                          const raw = meetingData?.transcript || '';
                          const useRaw = raw && raw.length >= joined.length;
                          if (useRaw) {
                            return (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <pre className="whitespace-pre-wrap break-words text-sm">{raw}</pre>
                              </div>
                            );
                          }
                          if (transcriptData.length > 0) {
                            return (
                              <div className="space-y-3">
                                {transcriptData.map((segment, index) => {
                                  const segmentTime = meetingData?.startTime 
                                    ? new Date(new Date(meetingData.startTime).getTime() + (segment.timestamp_seconds * 1000))
                                    : new Date();
                                  const timeStamp = roundToNearestQuarterHour(segmentTime);
                                  return (
                                    <div key={index} className="border-l-2 border-blue-200 pl-4 py-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Clock className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-600">{timeStamp}</span>
                                        {segment.speaker_name && (
                                          <Badge variant="outline" className="text-xs">
                                            {segment.speaker_name}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {segment.content}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return (
                            <TranscriptSpeakerManager
                              transcript={meetingData?.transcript || ''}
                              meetingId={meetingData?.id || ''}
                              onTranscriptUpdate={(updatedTranscript) => {
                                setMeetingData(prev => prev ? { ...prev, transcript: updatedTranscript } : null);
                                // Refresh transcript data
                                window.location.reload();
                              }}
                            />
                          );
                        })()}

                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No transcript available</p>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Supporting Documents Section - only show if meeting is saved */}
          {meetingData?.id && (
            <MeetingDocuments 
              meetingId={meetingData.id} 
              meetingTitle={meetingData.title}
            />
          )}
        </div>
      </div>
    </div>
  );
}
