import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, MicOff, Wifi, WifiOff, Brain, Copy, Download, Mail, Save, Play, Pause, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { RealtimeTranscriber, TranscriptData } from "@/utils/RealtimeTranscriber";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from 'jspdf';

const Index = () => {
  const { user, loading } = useAuth();
  const { toast: deprecatedToast } = useToast();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [wordCount, setWordCount] = useState(0);
  
  // Output configuration
  const [outputStyle, setOutputStyle] = useState<string>("gp-code-line");
  const [showSnomedCodes, setShowSnomedCodes] = useState(false);
  const [formatForEmis, setFormatForEmis] = useState(false);
  const [formatForSystmOne, setFormatForSystmOne] = useState(false);
  
  // Generated outputs
  const [isGenerating, setIsGenerating] = useState(false);
  const [gpSummary, setGpSummary] = useState("");
  const [fullNote, setFullNote] = useState("");
  const [patientCopy, setPatientCopy] = useState("");
  const [traineeFeedback, setTraineeFeedback] = useState("");
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transciberRef = useRef<RealtimeTranscriber | null>(null);

  const outputStyles = [
    { value: "gp-code-line", label: "GP Code Line", description: "One-line summary using GP shorthand" },
    { value: "systmone-style", label: "SystmOne Style", description: "SOAP format using standard NHS short codes" },
    { value: "emis-style", label: "EMIS Style", description: "Expanded format with headings and full sentences" },
    { value: "full-clinical", label: "Full Clinical Summary", description: "Long-form summary including history, meds, red flags" },
    { value: "trainee-review", label: "Trainee Review Format", description: "Includes annotations on safety netting and omissions" }
  ];

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscript = (transcriptData: TranscriptData) => {
    if (isPaused) return;
    
    setRealtimeTranscripts(prev => {
      const filtered = prev.filter(t => 
        !(t.speaker === transcriptData.speaker && !t.isFinal)
      );
      const newTranscripts = [...filtered, transcriptData];
      
      if (transcriptData.isFinal) {
        const finalTranscripts = newTranscripts.filter(t => t.isFinal);
        const fullTranscript = finalTranscripts
          .map(t => `${t.speaker}: ${t.text}`)
          .join('\n');
        
        setTranscript(fullTranscript);
        
        const words = fullTranscript.split(' ').filter(word => word.length > 0);
        setWordCount(words.length);
      }
      
      return newTranscripts;
    });
  };

  const handleTranscriptionError = (error: string) => {
    toast.error(`Transcription Error: ${error}`);
    setConnectionStatus("Error");
  };

  const handleStatusChange = (status: string) => {
    queueMicrotask(() => setConnectionStatus(status));
  };

  const startRecording = async () => {
    try {
      transciberRef.current = new RealtimeTranscriber(
        handleTranscript,
        handleTranscriptionError,
        handleStatusChange
      );
      
      await transciberRef.current.startTranscription();
      
      setIsRecording(true);
      setIsPaused(false);
      setRealtimeTranscripts([]);
      
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      toast.error("Failed to start recording");
    }
  };

  const pauseRecording = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      toast.success("Recording paused");
    } else {
      toast.success("Recording resumed");
    }
  };

  const stopRecording = () => {
    if (transciberRef.current) {
      transciberRef.current.stopTranscription();
      transciberRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRecording(false);
    setIsPaused(false);
    toast.success("Recording stopped");
  };

  const generateSummary = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript available to generate summary");
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: {
          transcript,
          outputStyle,
          showSnomedCodes,
          formatForEmis,
          formatForSystmOne
        }
      });

      if (error) throw error;

      setGpSummary(data.gpSummary || "");
      setFullNote(data.fullNote || "");
      setPatientCopy(data.patientCopy || "");
      setTraineeFeedback(data.traineeFeedback || "");
      
      // Save to history
      await saveToHistory(data);
      
      toast.success("Clinical summary generated successfully");
    } catch (error: any) {
      toast.error(`Error generating summary: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToHistory = async (summaryData: any) => {
    if (!user) return;

    try {
      // Create meeting record
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: `GP Consultation - ${new Date().toLocaleDateString()}`,
          description: "GP Scribe consultation notes",
          meeting_type: "gp_consultation",
          duration_minutes: Math.ceil(duration / 60),
          status: "completed"
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Save transcript
      if (transcript) {
        await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: transcript,
            speaker_name: "Consultation",
            timestamp_seconds: 0
          });
      }

      // Save summary
      await supabase
        .from('meeting_summaries')
        .insert({
          meeting_id: meeting.id,
          summary: summaryData.gpSummary,
          key_points: summaryData.fullNote ? [summaryData.fullNote] : [],
          action_items: summaryData.patientCopy ? [summaryData.patientCopy] : [],
          next_steps: summaryData.traineeFeedback ? [summaryData.traineeFeedback] : []
        });

    } catch (error: any) {
      console.error('Error saving to history:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const downloadAsPDF = (content: string, filename: string) => {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(content, 180);
    doc.text(splitText, 10, 10);
    doc.save(`${filename}.pdf`);
    toast.success("PDF downloaded");
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Connecting...':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'Error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return 'default';
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please sign in to use GP Scribe</h2>
            <p className="text-muted-foreground">Authentication is required to access consultation note features.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-6xl">
        
        {/* Recording Controls */}
        <Card className="shadow-medium border-accent/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-lg sm:text-xl">GP Scribe - Consultation Notes</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getConnectionStatusColor() as any} className="flex items-center gap-1 text-xs">
                  {getConnectionStatusIcon()}
                  <span className="hidden sm:inline">{connectionStatus}</span>
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div className="bg-accent/20 rounded-lg p-4">
                <div className="text-2xl sm:text-3xl font-bold text-primary">{formatDuration(duration)}</div>
                <div className="text-sm text-muted-foreground">Duration</div>
              </div>
              <div className="bg-accent/20 rounded-lg p-4">
                <div className="text-2xl sm:text-3xl font-bold text-primary">{wordCount}</div>
                <div className="text-sm text-muted-foreground">Words</div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              {!isRecording ? (
                <Button 
                  onClick={startRecording}
                  className="bg-gradient-primary hover:bg-primary-hover shadow-subtle px-8 py-4 text-lg font-medium min-h-[56px]"
                >
                  <Mic className="h-5 w-5 mr-3" />
                  Start Recording
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={pauseRecording}
                    variant="secondary"
                    className="shadow-subtle px-8 py-4 text-lg font-medium min-h-[56px]"
                  >
                    {isPaused ? <Play className="h-5 w-5 mr-3" /> : <Pause className="h-5 w-5 mr-3" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button 
                    onClick={stopRecording}
                    variant="destructive"
                    className="shadow-subtle px-8 py-4 text-lg font-medium min-h-[56px]"
                  >
                    <MicOff className="h-5 w-5 mr-3" />
                    Stop Recording
                  </Button>
                </>
              )}
            </div>

            {isRecording && (
              <div className="flex items-center justify-center gap-3 text-primary animate-pulse bg-accent/20 rounded-lg p-4">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <span className="text-base font-medium">
                  {isPaused ? "Recording paused..." : "Recording consultation..."}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Transcript */}
        <Card className="shadow-medium border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Live Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-secondary/50 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
              {transcript ? (
                <pre className="whitespace-pre-wrap text-sm">{transcript}</pre>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Start recording to see live transcription...
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Output Configuration */}
        <Card className="shadow-medium border-accent/20">
          <CardHeader>
            <CardTitle>Output Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Output Style</label>
              <Select value={outputStyle} onValueChange={setOutputStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select output style" />
                </SelectTrigger>
                <SelectContent>
                  {outputStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      <div>
                        <div className="font-medium">{style.label}</div>
                        <div className="text-xs text-muted-foreground">{style.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Additional Options</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="snomed" 
                    checked={showSnomedCodes}
                    onCheckedChange={(checked) => setShowSnomedCodes(checked === true)}
                  />
                  <label htmlFor="snomed" className="text-sm">Show SNOMED CT codes inline</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="emis" 
                    checked={formatForEmis}
                    onCheckedChange={(checked) => setFormatForEmis(checked === true)}
                  />
                  <label htmlFor="emis" className="text-sm">Format output for EMIS (spacing, expanded acronyms)</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="systmone" 
                    checked={formatForSystmOne}
                    onCheckedChange={(checked) => setFormatForSystmOne(checked === true)}
                  />
                  <label htmlFor="systmone" className="text-sm">Format output for SystmOne (abbreviated, pastable format)</label>
                </div>
              </div>
            </div>

            <Button
              onClick={generateSummary}
              disabled={!transcript.trim() || isGenerating}
              className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle text-lg font-medium py-4"
            >
              <Brain className="h-5 w-5 mr-3" />
              {isGenerating ? "Generating Clinical Summary..." : "🧠 Generate Clinical Summary"}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Output */}
        {(gpSummary || fullNote || patientCopy || traineeFeedback) && (
          <Card className="shadow-medium border-accent/20">
            <CardHeader>
              <CardTitle>Generated Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">🟦 GP Summary</TabsTrigger>
                  <TabsTrigger value="full">🟨 Full Note</TabsTrigger>
                  <TabsTrigger value="patient">🟩 Patient Copy</TabsTrigger>
                  <TabsTrigger value="trainee">🟣 Trainee Feedback</TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="space-y-4">
                  <Textarea 
                    value={gpSummary} 
                    readOnly 
                    className="min-h-[200px] bg-blue-50 dark:bg-blue-950/20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(gpSummary)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(gpSummary, 'gp-summary')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="full" className="space-y-4">
                  <Textarea 
                    value={fullNote} 
                    readOnly 
                    className="min-h-[200px] bg-yellow-50 dark:bg-yellow-950/20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(fullNote)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(fullNote, 'full-note')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="patient" className="space-y-4">
                  <Textarea 
                    value={patientCopy} 
                    readOnly 
                    className="min-h-[200px] bg-green-50 dark:bg-green-950/20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(patientCopy)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(patientCopy, 'patient-copy')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="trainee" className="space-y-4">
                  <Textarea 
                    value={traineeFeedback} 
                    readOnly 
                    className="min-h-[200px] bg-purple-50 dark:bg-purple-950/20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(traineeFeedback)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(traineeFeedback, 'trainee-feedback')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;