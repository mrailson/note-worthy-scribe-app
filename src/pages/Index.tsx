import { useState, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { LoginForm } from "@/components/LoginForm";
import { MeetingRecorder } from "@/components/MeetingRecorder";
import { MeetingSettings } from "@/components/MeetingSettings";
import { LiveTranscript } from "@/components/LiveTranscript";
import { MeetingSummary } from "@/components/MeetingSummary";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMeetingAutoClose } from "@/hooks/useMeetingAutoClose";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";
import { ImportedTranscript } from "@/utils/FileImporter";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { FileAudio, Upload, RotateCcw } from "lucide-react";

const Index = () => {
  const { user, loading, hasModuleAccess } = useAuth();
  
  // Enable meeting auto-close service (runs every 5 minutes)
  useMeetingAutoClose({ enabled: !!user, intervalMinutes: 5 });
  
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const editMeetingId = searchParams.get('edit');
  
  const [currentView, setCurrentView] = useState<"recording" | "summary">("recording");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [wordCount, setWordCount] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({
    title: "",
    description: "",
    meetingType: "general",
    attendees: "",
    practiceId: "",
    meetingFormat: "teams"
  });
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [importedTranscript, setImportedTranscript] = useState<ImportedTranscript | null>(null);

  // Upload state for Quick Actions
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTranscript, setUploadedTranscript] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  // Check for continue meeting state and active tab
  useEffect(() => {
    const state = location.state as any;
    if (state?.continueMeeting && state?.meetingData) {
      setMeetingSettings({
        title: state.meetingData.title || "Continued Meeting",
        description: "Meeting continued from previous session",
        meetingType: "general",
        attendees: "",
        practiceId: "",
        meetingFormat: "teams"
      });
      toast.success("Meeting session restored. You can continue recording.");
    }
  }, [location.state]);

  // Load meeting for editing if editMeetingId is provided
  useEffect(() => {
    if (editMeetingId && user) {
      loadMeetingForEditing(editMeetingId);
    }
  }, [editMeetingId, user]);

  // Conditional homepage redirect: AI4GP users → AI4GP, others → Meeting Manager
  useEffect(() => {
    if (user && !loading && !editMeetingId && hasModuleAccess('ai4gp_access')) {
      navigate('/ai4gp', { replace: true });
    }
  }, [user, loading, editMeetingId, hasModuleAccess, navigate]);

  const loadMeetingForEditing = async (meetingId: string) => {
    try {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('user_id', user?.id)
        .single();

      if (meetingError) throw meetingError;

      // Load transcripts
      const { data: transcripts, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp_seconds', { ascending: true });

      if (transcriptError) throw transcriptError;

      // Load summary
      const { data: summary, error: summaryError } = await supabase
        .from('meeting_summaries')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      // Set meeting data
      setMeetingSettings({
        title: meeting.title,
        description: meeting.description || "",
        meetingType: meeting.meeting_type,
        attendees: "",
        practiceId: meeting.practice_id || "",
        meetingFormat: "teams"
      });
      
      setCurrentMeetingId(meetingId);
      setDuration(meeting.duration_minutes ? `${Math.floor(meeting.duration_minutes / 60).toString().padStart(2, '0')}:${(meeting.duration_minutes % 60).toString().padStart(2, '0')}` : "00:00");
      
      // Reconstruct transcript
      const fullTranscript = transcripts?.map(t => t.content).join('\n') || "";
      setTranscript(fullTranscript);
      setWordCount(fullTranscript.split(' ').filter(word => word.length > 0).length);

      if (summary) {
        setCurrentView("summary");
      }

      toast.success(`Meeting loaded: ${meeting.title}`);
    } catch (error: any) {
      toast.error(`Error loading meeting: ${error.message}`);
    }
  };

  const handleAudioImported = (audioFile: File) => {
    // Handle the imported audio file
    // This could be extended to process the audio file for transcription
    toast.success(`Audio file imported: ${audioFile.name}`);
    console.log("Audio file imported:", audioFile);
  };

  const handleTranscriptImported = (importedTranscript: ImportedTranscript) => {
    // Set the imported transcript content
    setTranscript(importedTranscript.content);
    setWordCount(importedTranscript.wordCount);
    
    // Set duration if available
    if (importedTranscript.duration) {
      setDuration(importedTranscript.duration);
    }
    
    setImportedTranscript(importedTranscript);
    
    toast.success(`Transcript imported successfully! ${importedTranscript.wordCount} words loaded.`);
  };

  const parseDurationToMinutes = (duration: string): number => {
    const [hours, minutes] = duration.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const handleNewMeeting = () => {
    setCurrentView("recording");
    setTranscript("");
    setDuration("00:00");
    setWordCount(0);
    setCurrentMeetingId(null);
    setMeetingSettings({
      title: "",
      description: "",
      meetingType: "general",
      attendees: "",
      practiceId: "",
      meetingFormat: "teams"
    });
    // Clear URL parameters
    window.history.replaceState({}, '', '/');
  };


  const handleViewSummary = () => {
    // Navigate to the dedicated summary page with the meeting data
    const meetingData = {
      title: meetingSettings.title || "General Meeting",
      duration,
      wordCount,
      transcript,
      speakerCount: 1, // Default speaker count
      startTime: new Date().toISOString(),
      extractedSettings: importedTranscript?.extractedSettings
    };

    navigate('/meeting-summary', { 
      state: meetingData 
    });
  };

  // Handle audio file upload for Quick Actions
  const handleAudioUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().match(/\.(mp3|wav)$/)) {
      toast.error('Please upload an MP3 or WAV file');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Uploading and transcribing...');
    
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const { data, error } = await supabase.functions.invoke('audio-transcription', {
        body: formData
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.success) {
        setUploadedTranscript(data.transcript);
        setUploadStatus('Transcription completed successfully!');
        toast.success(`Transcription completed! Generated ${data.transcript.split(' ').length} words`);
      } else {
        throw new Error(data?.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`Error: ${error.message}`);
      toast.error(`Transcription failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Clear uploaded transcript
  const clearUploadedTranscript = () => {
    setUploadedTranscript('');
    setUploadStatus('');
    toast.success('Uploaded transcript cleared');
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <MaintenanceBanner />
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-4xl">
        <MaintenanceBanner />
        
        <Tabs defaultValue="meeting-recorder" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="meeting-recorder">Meeting Recorder</TabsTrigger>
            <TabsTrigger value="quick-actions" className="flex items-center gap-2">
              <FileAudio className="h-4 w-4" />
              Quick Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meeting-recorder" className="mt-6">
            <MeetingRecorder
              onTranscriptUpdate={setTranscript}
              onDurationUpdate={setDuration}
              onWordCountUpdate={setWordCount}
              initialSettings={meetingSettings}
            />
          </TabsContent>

          <TabsContent value="quick-actions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Audio File Transcription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Upload Audio File</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload an MP3 or WAV audio file to generate a transcript using AI transcription.
                    </p>
                    
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="audio-upload"
                        className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-accent/10 hover:bg-accent/20 border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileAudio className="w-8 h-8 mb-4 text-muted-foreground" />
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">MP3, WAV (MAX. 20MB)</p>
                        </div>
                        <input
                          id="audio-upload"
                          type="file"
                          className="hidden"
                          accept=".mp3,.wav,audio/mpeg,audio/wav"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAudioUpload(file);
                          }}
                          disabled={isUploading}
                        />
                      </label>
                    </div>

                    {uploadStatus && (
                      <div className="mt-4">
                        <Badge variant={uploadStatus.includes('Error') ? 'destructive' : 'secondary'}>
                          {uploadStatus}
                        </Badge>
                      </div>
                    )}

                    {isUploading && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        Processing audio file...
                      </div>
                    )}
                  </div>

                  {uploadedTranscript && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Generated Transcript</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {uploadedTranscript.split(' ').length} words
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearUploadedTranscript}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Clear
                          </Button>
                        </div>
                      </div>
                      
                      <div className="rounded-lg border bg-muted/50 p-4 max-h-96 overflow-y-auto">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {uploadedTranscript}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(uploadedTranscript);
                            toast.success('Transcript copied to clipboard');
                          }}
                        >
                          Copy to Clipboard
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const blob = new Blob([uploadedTranscript], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'transcript.txt';
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success('Transcript downloaded');
                          }}
                        >
                          Download as TXT
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
