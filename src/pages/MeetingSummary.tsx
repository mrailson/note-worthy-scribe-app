import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MeetingHeader } from "@/components/MeetingHeader";
import { MeetingStats } from "@/components/MeetingStats";
import { ClaudeNotesPanel } from "@/components/ClaudeNotesPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { useMeetingData } from "@/hooks/useMeetingData";
import { useMeetingAudio } from "@/hooks/useMeetingAudio";
import { useMeetingExport } from "@/hooks/useMeetingExport";
import { useClaudeAI } from "@/hooks/useClaudeAI";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState } from "react";

interface MeetingDataFromState {
  id?: string;
  title?: string;
  duration?: string;
  wordCount?: number;
  transcript?: string;
  speakerCount?: number;
  startTime?: string;
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
  extractedSettings?: any;
}

export default function MeetingSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // UI state
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);

  // Custom hooks
  const {
    meetingData,
    setMeetingData,
    isSaving,
    isSaved,
    setIsSaved,
    meetingSettings,
    setMeetingSettings,
    summaryContent,
    setSummaryContent,
    practiceData,
    saveMeetingToDatabase,
    loadExistingSummary,
    fetchPracticeData
  } = useMeetingData();

  const {
    audioSegments,
    isAudioSegmentsOpen,
    audioBackupInfo,
    transcriptTruncated,
    backupRecord,
    isReprocessing,
    reprocessStatus,
    reprocessWithBackup
  } = useMeetingAudio(meetingData);

  const {
    isExporting,
    generateWordDocument,
    generatePDF,
    copyToClipboard,
    downloadTranscript,
    getMeetingDate
  } = useMeetingExport(meetingData, meetingSettings);

  const {
    claudeDetailLevel,
    setClaudeDetailLevel,
    claudeNotes,
    setClaudeNotes,
    isClaudeEditing,
    setIsClaudeEditing,
    isClaudeGenerating,
    isClaudeMinutesOpen,
    setIsClaudeMinutesOpen,
    isClaudeFullScreen,
    setIsClaudeFullScreen,
    customInstruction,
    setCustomInstruction,
    showCustomInstruction,
    setShowCustomInstruction,
    generateClaudeMeetingNotes,
    saveSummaryToDatabase,
    handleCustomInstructionSubmit
  } = useClaudeAI(meetingData);

  // Handle location state data on mount
  useEffect(() => {
    const data = location.state as MeetingDataFromState;
    if (data && !isSaved && !isSaving && !meetingData?.id) {
      console.log('MeetingSummary useEffect triggered with data:', data.title, data.startTime);
      
      // Safely set meeting data with proper defaults to avoid undefined errors
      setMeetingData({
        id: data.id,
        title: data.title || 'Meeting',
        duration: data.duration || '00:00',
        wordCount: data.wordCount || 0,
        transcript: data.transcript || '',
        speakerCount: data.speakerCount || 0,
        startTime: data.startTime || '',
        practiceName: data.practiceName || '',
        practiceId: data.practiceId || '',
        meetingFormat: data.meetingFormat || '',
        generatedNotes: data.generatedNotes || '',
        mixedAudioBlob: data.mixedAudioBlob,
        leftAudioBlob: data.leftAudioBlob,
        rightAudioBlob: data.rightAudioBlob,
        startedBy: data.startedBy || '',
        needsAudioBackup: data.needsAudioBackup || false,
        audioBackupBlob: data.audioBackupBlob || null
      });
      
      // If we have generated notes, set them as Claude notes
      if (data.generatedNotes) {
        setClaudeNotes(data.generatedNotes);
        toast.success('AI-generated meeting notes are ready!');
      }
      
      // Map startTime (ISO) from navigation state to Meeting Settings date/time for display
      const dt = data.startTime ? new Date(data.startTime) : null;
      const pad = (n: number) => n.toString().padStart(2, '0');
      setMeetingSettings({
        title: data.title || 'Meeting',
        description: data.extractedSettings?.description || "",
        meetingType: data.extractedSettings?.meetingType || "general",
        meetingStyle: "standard",
        attendees: data.extractedSettings?.attendees || "",
        agenda: data.extractedSettings?.agenda || "",
        date: dt ? `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` : "",
        startTime: dt ? `${pad(dt.getHours())}:${pad(dt.getMinutes())}` : "",
        format: "",
        location: "",
        practiceId: "",
        meetingFormat: "teams",
        transcriberService: "whisper",
        transcriberThresholds: {
          whisper: 0.30,
          deepgram: 0.80
        }
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
        const sanitizedMeetingData = {
          id: data.id,
          title: data.title || 'Meeting',
          duration: data.duration || '00:00',
          wordCount: data.wordCount || 0,
          transcript: data.transcript || '',
          speakerCount: data.speakerCount || 0,
          startTime: data.startTime || '',
          practiceName: data.practiceName || '',
          practiceId: data.practiceId || '',
          meetingFormat: data.meetingFormat || '',
          generatedNotes: data.generatedNotes || '',
          mixedAudioBlob: data.mixedAudioBlob,
          leftAudioBlob: data.leftAudioBlob,
          rightAudioBlob: data.rightAudioBlob,
          startedBy: data.startedBy || '',
          needsAudioBackup: data.needsAudioBackup || false,
          audioBackupBlob: data.audioBackupBlob || null
        };
        
        const timer = setTimeout(() => {
          saveMeetingToDatabase(sanitizedMeetingData);
        }, 100);
        
        return () => clearTimeout(timer);
      } else {
        // For existing meetings, just mark as saved and load summary
        setIsSaved(true);
        loadExistingSummary(data.id);
      }
      } else {
        // Handle direct URL access or query params
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
            startTime: '',
            practiceName: '',
            practiceId: '',
            meetingFormat: '',
            generatedNotes: '',
            startedBy: ''
          });
          loadExistingSummary(paramId);
        } else {
          toast.error('No meeting selected');
          navigate('/meeting-history');
        }
      }
  }, [location.state, navigate, isSaved, isSaving, meetingData?.id]);

  // Fetch practice data on user load
  useEffect(() => {
    if (user) {
      fetchPracticeData();
    }
  }, [user]);

  const handleDownloadText = (content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `meeting-notes-${getMeetingDate()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Plain text downloaded successfully!");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => navigate('/meeting-recorder')} />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        <MeetingHeader meetingData={meetingData} practiceData={practiceData} />
        
        <MeetingStats meetingData={meetingData} />
        
        <ClaudeNotesPanel
          meetingData={meetingData}
          claudeDetailLevel={claudeDetailLevel}
          setClaudeDetailLevel={setClaudeDetailLevel}
          claudeNotes={claudeNotes}
          setClaudeNotes={setClaudeNotes}
          isClaudeEditing={isClaudeEditing}
          setIsClaudeEditing={setIsClaudeEditing}
          isClaudeGenerating={isClaudeGenerating}
          isClaudeMinutesOpen={isClaudeMinutesOpen}
          setIsClaudeMinutesOpen={setIsClaudeMinutesOpen}
          isClaudeFullScreen={isClaudeFullScreen}
          setIsClaudeFullScreen={setIsClaudeFullScreen}
          customInstruction={customInstruction}
          setCustomInstruction={setCustomInstruction}
          showCustomInstruction={showCustomInstruction}
          setShowCustomInstruction={setShowCustomInstruction}
          showFindReplace={showFindReplace}
          setShowFindReplace={setShowFindReplace}
          generateClaudeMeetingNotes={generateClaudeMeetingNotes}
        saveSummaryToDatabase={(content) => saveSummaryToDatabase(meetingData?.id || '', content)}
          handleCustomInstructionSubmit={handleCustomInstructionSubmit}
          onCopy={copyToClipboard}
          onDownloadWord={generateWordDocument}
          onDownloadPDF={generatePDF}
          onDownloadText={handleDownloadText}
        />

        <TranscriptPanel
          meetingData={meetingData}
          isTranscriptOpen={isTranscriptOpen}
          setIsTranscriptOpen={setIsTranscriptOpen}
          onCopy={copyToClipboard}
          onDownloadTranscript={downloadTranscript}
          onDownloadWord={generateWordDocument}
          onDownloadPDF={generatePDF}
          onDownloadText={handleDownloadText}
        />
      </div>
    </div>
  );
}