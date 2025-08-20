import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileAudio, Loader2, FileText, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  language: string;
  segments: any[];
  raw_response: any;
}

interface ProcessingMetrics {
  processingTime: number;
  fileSize: number;
}

interface MP3TranscriptionTestProps {
  onTranscriptReceived?: (transcript: string) => void;
}

export const MP3TranscriptionTest = ({ onTranscriptReceived }: MP3TranscriptionTestProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ProcessingMetrics | null>(null);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check if it's an audio file
      if (selectedFile.type.startsWith('audio/') || selectedFile.name.endsWith('.mp3')) {
        setFile(selectedFile);
        setError(null);
        setResult(null);
      } else {
        setError('Please select an MP3 or other audio file');
      }
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setMetrics(null);

    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const { data, error: supabaseError } = await supabase.functions.invoke('test-mp3-transcription', {
        body: formData,
      });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      setResult(data);
      setMetrics({
        processingTime: processingTime / 1000, // Convert to seconds
        fileSize: file.size
      });

      // Pass transcript to parent component
      if (onTranscriptReceived && data.text) {
        onTranscriptReceived(data.text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process audio file');
    } finally {
      setIsProcessing(false);
    }
  };

  const createMeetingWithNotes = async () => {
    if (!result?.text || !user || !file) {
      toast.error('Missing required data to create meeting');
      return;
    }

    setIsCreatingMeeting(true);

    try {
      // Create meeting record
      const meetingTitle = file.name.replace(/\.[^/.]+$/, "") || 'Imported Audio Meeting';
      const meetingStart = new Date().toISOString();
      
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: meetingTitle,
          description: `Meeting created from imported audio file: ${file.name}`,
          meeting_type: 'general',
          start_time: meetingStart,
          end_time: new Date(Date.now() + (result.duration || 0) * 1000).toISOString(),
          duration_minutes: Math.round((result.duration || 0) / 60),
          status: 'completed',
          user_id: user.id
        })
        .select()
        .single();

      if (meetingError) {
        throw new Error(`Failed to create meeting: ${meetingError.message}`);
      }

      // Store the transcript in meeting_transcripts table (primary location)
      const { error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meeting.id,
          content: result.text,
          confidence_score: result.confidence || 0.8,
          timestamp_seconds: 0
        });

      if (transcriptError) {
        console.error('Error saving transcript:', transcriptError);
        // Don't throw error here, meeting creation was successful
      }

      // Generate meeting minutes using the existing edge function
      try {
        const { data: notesData, error: notesError } = await supabase.functions.invoke('generate-meeting-notes-claude', {
          body: {
            transcript: result.text,
            meetingTitle: meetingTitle,
            meetingDate: new Date().toISOString().split('T')[0],
            meetingTime: new Date().toLocaleTimeString(),
            detailLevel: 'standard'
          }
        });

        if (notesError) {
          console.error('Error generating notes:', notesError);
          toast.error('Meeting created but failed to generate notes. You can generate notes later from the meeting page.');
        } else {
          toast.success('Meeting created successfully with AI-generated notes!');
        }
      } catch (notesError) {
        console.error('Error calling notes generation:', notesError);
        toast.success('Meeting created successfully! You can generate notes from the meeting page.');
      }

      // Navigate to meeting history
      navigate('/meeting-history');
      
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Upload Audio File (MP3, WAV, etc.)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
              />
              {file && (
                <Button 
                  onClick={processFile} 
                  disabled={isProcessing}
                  className="min-w-[120px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Transcribe
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {file && (
            <Alert>
              <AlertDescription>
                Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics && (
              <Alert>
                <AlertDescription>
                  <strong>Whisper Processing Time:</strong> {metrics.processingTime.toFixed(2)}s 
                  <span className="text-muted-foreground ml-2">
                    ({(metrics.fileSize / (1024 * 1024)).toFixed(2)} MB file)
                  </span>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Confidence:</strong> {(result.confidence * 100).toFixed(1)}%
              </div>
              <div>
                <strong>Audio Duration:</strong> {result.duration?.toFixed(1)}s
              </div>
              <div>
                <strong>Language:</strong> {result.language}
              </div>
              <div>
                <strong>Segments:</strong> {result.segments?.length || 0}
              </div>
            </div>

            <div className="space-y-2">
              <strong>Transcribed Text:</strong>
              <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
                {result.text || 'No text transcribed'}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={createMeetingWithNotes}
                disabled={isCreatingMeeting || !user}
                className="flex-1"
              >
                {isCreatingMeeting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Meeting...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Create Meeting Notes
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => navigate('/meeting-history')}
                disabled={isCreatingMeeting}
              >
                <Calendar className="mr-2 h-4 w-4" />
                View History
              </Button>
            </div>

            {result.segments && result.segments.length > 0 && (
              <details className="space-y-2">
                <summary className="cursor-pointer font-medium">
                  Detailed Segments ({result.segments.length})
                </summary>
                <div className="space-y-2 pl-4">
                  {result.segments.map((segment, index) => (
                    <div key={index} className="p-2 bg-muted/50 rounded text-sm">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{segment.start?.toFixed(2)}s - {segment.end?.toFixed(2)}s</span>
                        <span>Confidence: {((1 + (segment.avg_logprob || -1)) * 100).toFixed(1)}%</span>
                      </div>
                      <div>{segment.text}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <details className="space-y-2">
              <summary className="cursor-pointer font-medium">
                Raw Whisper Response
              </summary>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-60">
                {JSON.stringify(result.raw_response, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
};