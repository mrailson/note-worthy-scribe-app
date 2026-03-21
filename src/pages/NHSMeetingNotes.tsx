import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RealtimeTranscriptCard } from '@/components/RealtimeTranscriptCard';
import { BrowserSpeechTranscriber, TranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { toast } from 'sonner';
import { Mic, MicOff, RotateCcw, Clock, MessageSquare, Settings, Upload, FileAudio } from 'lucide-react';
import MeetingNotesGenerator from '@/components/MeetingNotesGenerator';
import { MeetingSetupTab } from '@/components/meeting-dashboard/tabs/MeetingSetupTab';
import { DashboardProvider } from '@/components/meeting-dashboard/utils/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';

const NHSMeetingNotes = () => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptData[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [status, setStatus] = useState('Ready');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTranscript, setUploadedTranscript] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  // Refs
  const transcriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle transcription data
  const handleTranscription = (data: TranscriptData) => {
    if (data.is_final) {
      // Add to segments
      setTranscriptSegments(prev => [...prev, data]);
      
      // Update main transcript
      setTranscript(prev => prev ? `${prev} ${data.text}` : data.text);
      
      // Update word count
      const words = data.text.split(/\s+/).filter(word => word.length > 0);
      setWordCount(prev => prev + words.length);
    }
  };

  // Handle transcription errors
  const handleError = (error: string) => {
    console.error('Transcription error:', error);
    toast.error(`Transcription error: ${error}`);
    setStatus(`Error: ${error}`);
  };

  // Handle status changes
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
        transcriberRef.current = null;
      }
    };
  }, []);

  // Start recording
  const startRecording = async () => {
    try {
      setIsRecording(true);
      setStatus('Starting...');
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Initialize transcriber
      transcriberRef.current = new BrowserSpeechTranscriber(
        handleTranscription,
        handleError,
        handleStatusChange
      );

      await transcriberRef.current.startTranscription();
      setStatus('Recording');
      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
      setIsRecording(false);
      setStatus('Ready');
      
      // Clear timer if failed
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setStatus('Stopping...');

      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Stop transcriber
      if (transcriberRef.current) {
        await transcriberRef.current.stopTranscription();
        transcriberRef.current = null;
      }

      setStatus('Completed');
      toast.success('Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording');
    }
  };

  // Clear session
  const clearSession = () => {
    setTranscript('');
    setTranscriptSegments([]);
    setWordCount(0);
    setDuration(0);
    setStatus('Ready');
    toast.success('Session cleared');
  };

  // Handle audio file upload
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

  return (
    <>
      <Helmet>
        <title>NHS Meeting Notes | Live Recording & AI-Powered Notes</title>
        <meta name="description" content="NHS Meeting Notes with live transcription and AI-powered meeting notes generation. Real-time speech-to-text with automated summary creation." />
      </Helmet>
      
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">NHS Meeting Notes</h1>
        </div>

        <Tabs defaultValue="live-recording" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="live-recording">Live Recording</TabsTrigger>
            <TabsTrigger value="generate-notes">Generate Notes</TabsTrigger>
            <TabsTrigger value="quick-actions" className="flex items-center gap-2">
              <FileAudio className="h-4 w-4" />
              Quick Actions
            </TabsTrigger>
            <TabsTrigger value="meeting-settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live-recording" className="space-y-4">
            {/* Recording Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Meeting Recording Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Meeting Stats */}
                <div className="flex items-center justify-between p-4 bg-accent/20 rounded-lg">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Meeting Timer</span>
                        <span className="text-lg font-mono font-semibold text-foreground">{formatDuration(duration)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Word Count</span>
                        <span className="text-lg font-mono font-semibold text-foreground">{wordCount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isRecording && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full animate-pulse">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-sm font-medium">Live Recording</span>
                    </div>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    variant={isRecording ? "destructive" : "default"}
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="h-4 w-4" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        Start Recording
                      </>
                    )}
                  </Button>

                  {!isRecording && (
                    <Button
                      onClick={clearSession}
                      variant="outline"
                      size="lg"
                      disabled={!transcript && duration === 0}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Clear Session
                    </Button>
                  )}

                  <Badge variant="outline" className="text-sm">
                    Status: {status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Live Transcript Display */}
            <RealtimeTranscriptCard
              transcriptText={transcript}
              isRecording={isRecording}
              duration={formatDuration(duration)}
              wordCount={wordCount}
            />
          </TabsContent>

          <TabsContent value="generate-notes" className="space-y-4">
            <MeetingNotesGenerator />
          </TabsContent>

          <TabsContent value="quick-actions" className="space-y-4">
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

          <TabsContent value="meeting-settings" className="space-y-4">
            <DashboardProvider>
              <MeetingSetupTab />
            </DashboardProvider>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default NHSMeetingNotes;