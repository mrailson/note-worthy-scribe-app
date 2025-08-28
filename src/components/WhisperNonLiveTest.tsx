import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Mic, MicOff, Upload, Play, Pause, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ChunkResult {
  chunkNumber: number;
  text: string;
  duration: number;
  confidence?: number;
  duplications?: string[];
}

export const WhisperNonLiveTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [chunkResults, setChunkResults] = useState<ChunkResult[]>([]);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      console.log('🎙️ Starting Whisper recording...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      setStream(mediaStream);
      const audioChunks: Blob[] = [];

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        console.log('📁 Audio recorded, size:', blob.size);
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      toast.error('Failed to start recording: ' + (error as Error).message);
    }
  };

  const stopRecording = () => {
    console.log('🛑 Stopping Whisper recording...');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);
    setMediaRecorder(null);
    toast.success('Recording stopped');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      setRecordingTime(0);
      toast.success('Audio file uploaded');
    }
  };

  const processWithWhisper = async () => {
    if (!audioBlob) {
      toast.error('No audio to process');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setChunkResults([]);
    setFinalTranscript('');

    try {
      console.log('🔄 Processing audio with Whisper...');
      
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      setProcessingProgress(25);

      // Send to Whisper transcription service
      const { data, error } = await supabase.functions.invoke('mp3-transcription', {
        body: {
          audio: base64Audio,
          chunk_analysis: true, // Request chunk analysis
          detect_duplications: true // Detect overlapping content
        }
      });

      setProcessingProgress(75);

      if (error) throw error;

      console.log('📝 Whisper response:', data);

      if (data.chunks) {
        // Process chunks to identify duplications
        const processedChunks: ChunkResult[] = data.chunks.map((chunk: any, index: number) => {
          const duplications: string[] = [];
          
          // Check for duplications with previous chunks
          for (let i = 0; i < index; i++) {
            const prevChunk = data.chunks[i];
            const overlap = findTextOverlap(prevChunk.text, chunk.text);
            if (overlap && overlap.length > 20) {
              duplications.push(`Overlaps with chunk ${i + 1}: "${overlap}"`);
            }
          }

          return {
            chunkNumber: index + 1,
            text: chunk.text,
            duration: chunk.duration || 0,
            confidence: chunk.confidence,
            duplications
          };
        });

        setChunkResults(processedChunks);
      }

      setFinalTranscript(data.text || '');
      setProcessingProgress(100);
      
      toast.success('Whisper transcription completed');

    } catch (error) {
      console.error('❌ Whisper processing error:', error);
      toast.error('Failed to process audio: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessingProgress(0), 2000);
    }
  };

  const findTextOverlap = (text1: string, text2: string): string | null => {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    // Look for overlapping sequences of at least 3 words
    for (let i = 0; i < words1.length - 2; i++) {
      for (let j = 0; j < words2.length - 2; j++) {
        let matchLength = 0;
        while (
          i + matchLength < words1.length &&
          j + matchLength < words2.length &&
          words1[i + matchLength] === words2[j + matchLength]
        ) {
          matchLength++;
        }
        
        if (matchLength >= 3) {
          return words1.slice(i, i + matchLength).join(' ');
        }
      }
    }
    
    return null;
  };

  const clearResults = () => {
    setAudioBlob(null);
    setChunkResults([]);
    setFinalTranscript('');
    setRecordingTime(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.success('Results cleared');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Whisper Non-Live Transcription Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {isRecording ? (
              <Button onClick={stopRecording} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop ({formatTime(recordingTime)})
              </Button>
            ) : (
              <Button onClick={startRecording} variant="default" size="sm" disabled={isProcessing}>
                <Mic className="h-4 w-4 mr-2" />
                Record Audio
              </Button>
            )}
            
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" disabled={isProcessing}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
            
            <Button onClick={clearResults} variant="outline" size="sm">
              Clear
            </Button>
          </div>

          {audioBlob && (
            <Badge variant="secondary">
              Audio Ready ({(audioBlob.size / 1024 / 1024).toFixed(2)} MB)
            </Badge>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Process Button */}
        {audioBlob && (
          <div className="flex gap-2">
            <Button 
              onClick={processWithWhisper} 
              disabled={isProcessing}
              className="w-full sm:w-auto"
            >
              {isProcessing ? 'Processing...' : 'Process with Whisper'}
            </Button>
          </div>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={processingProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">Processing audio chunks...</p>
          </div>
        )}

        <Separator />

        {/* Results */}
        {finalTranscript && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Final Combined Transcript:</h4>
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm whitespace-pre-wrap">{finalTranscript}</p>
              </div>
            </div>

            {chunkResults.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Chunk Analysis:</h4>
                <div className="space-y-3">
                  {chunkResults.map((chunk) => (
                    <div key={chunk.chunkNumber} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">Chunk {chunk.chunkNumber}</Badge>
                        {chunk.confidence && (
                          <Badge variant="secondary">
                            {Math.round(chunk.confidence * 100)}% confidence
                          </Badge>
                        )}
                        {chunk.duplications && chunk.duplications.length > 0 && (
                          <Badge variant="destructive">Duplications Found</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm mb-2">{chunk.text}</p>
                      
                      {chunk.duplications && chunk.duplications.length > 0 && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          <strong>Duplications:</strong>
                          <ul className="mt-1 space-y-1">
                            {chunk.duplications.map((dup, i) => (
                              <li key={i}>• {dup}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>• Records/uploads audio, then processes with OpenAI Whisper</p>
          <p>• Analyzes chunks for accuracy and identifies duplications</p>
          <p>• Shows how chunks are combined into final transcript</p>
        </div>
      </CardContent>
    </Card>
  );
};