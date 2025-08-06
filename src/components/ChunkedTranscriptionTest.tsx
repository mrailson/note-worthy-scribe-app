import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Play, Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ChunkedTranscriptionTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [cleanedTranscript, setCleanedTranscript] = useState<string>('');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [isProcessingClean, setIsProcessingClean] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const processAudioChunk = async (audioBlob: Blob, chunkNumber: number) => {
    try {
      console.log(`🎵 Processing chunk ${chunkNumber}, size: ${audioBlob.size} bytes`);
      
      // Create FormData for the edge function
      const formData = new FormData();
      const audioFile = new File([audioBlob], `chunk-${chunkNumber}.webm`, { type: 'audio/webm;codecs=opus' });
      formData.append('audio', audioFile);

      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/test-mp3-transcription', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const text = result.text || '';
        if (text.trim()) {
          console.log(`✅ Chunk ${chunkNumber} transcribed:`, text);
          const segmentText = `[${chunkNumber}] ${text}`;
          setTranscriptSegments(prev => {
            const updated = [...prev, segmentText];
            // Update raw transcript (just join all the text without chunk numbers)
            const allText = updated.map(seg => seg.replace(/^\[\d+\]\s*/, '')).join(' ');
            setRawTranscript(allText);
            return updated;
          });
        } else {
          console.log(`⏭️ Chunk ${chunkNumber} was silent`);
        }
      } else {
        const error = await response.text();
        console.error(`❌ Chunk ${chunkNumber} failed:`, error);
        toast({
          title: "Transcription Error",
          description: `Chunk ${chunkNumber} failed to transcribe`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error(`💥 Error processing chunk ${chunkNumber}:`, error);
    }
  };

  const cleanTranscript = async () => {
    if (!rawTranscript || rawTranscript.trim().length < 10) {
      toast({
        title: "No Content",
        description: "Need more transcript content to clean",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingClean(true);
    try {
      console.log('🧹 Sending transcript for cleaning:', rawTranscript.substring(0, 100) + '...');
      
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/clean-transcript', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rawTranscript: rawTranscript,
          meetingTitle: 'Chunked Test Recording'
        })
      });

      if (response.ok) {
        const result = await response.json();
        setCleanedTranscript(result.cleanedTranscript || result.transcript || '');
        console.log('✅ Transcript cleaned successfully');
        toast({
          title: "Transcript Cleaned",
          description: "Transcript has been processed and tidied up"
        });
      } else {
        const error = await response.text();
        console.error('❌ Transcript cleaning failed:', error);
        toast({
          title: "Cleaning Failed",
          description: "Failed to clean transcript",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('💥 Error cleaning transcript:', error);
      toast({
        title: "Cleaning Error",
        description: "Error occurred while cleaning transcript",
        variant: "destructive"
      });
    } finally {
      setIsProcessingClean(false);
    }
  };

  const startChunkedRecording = async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Set up MediaRecorder with optimal format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;
      let audioChunks: Blob[] = [];
      let chunkCount = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: mimeType });
          chunkCount++;
          setCurrentChunk(chunkCount);
          processAudioChunk(audioBlob, chunkCount);
          audioChunks = [];
        }
      };

      // Start recording and set up 5-second chunking
      mediaRecorder.start();
      setIsRecording(true);
      setTranscriptSegments([]);
      setCurrentChunk(0);

      console.log('🎙️ Started continuous chunked recording with 5-second intervals');
      toast({
        title: "Continuous Recording Started",
        description: "Recording will continue until manually stopped"
      });

      // Set up 5-second chunk timer
      const startChunkTimer = () => {
        chunkTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            // Restart immediately for next chunk (continuous recording)
            setTimeout(() => {
              if (streamRef.current && isRecording) {
                mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
                  mimeType,
                  audioBitsPerSecond: 128000
                });
                mediaRecorderRef.current.ondataavailable = (event) => {
                  if (event.data.size > 0) {
                    audioChunks.push(event.data);
                  }
                };
                mediaRecorderRef.current.onstop = () => {
                  if (audioChunks.length > 0) {
                    const audioBlob = new Blob(audioChunks, { type: mimeType });
                    chunkCount++;
                    setCurrentChunk(chunkCount);
                    processAudioChunk(audioBlob, chunkCount);
                    audioChunks = [];
                  }
                };
                mediaRecorderRef.current.start();
                startChunkTimer(); // Continue the cycle
              }
            }, 100);
          }
        }, 5000);
      };

      startChunkTimer();

    } catch (error) {
      console.error('Error starting chunked recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording",
        variant: "destructive"
      });
    }
  };

  const stopChunkedRecording = () => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    setIsRecording(false);
    
    console.log('🛑 Stopped chunked recording');
    toast({
      title: "Recording Stopped",
      description: `Processed ${currentChunk} chunks`
    });
  };

  const clearTranscript = () => {
    setTranscriptSegments([]);
    setRawTranscript('');
    setCleanedTranscript('');
    setCurrentChunk(0);
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Continuous 5-Second Chunked Test</h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={isRecording ? stopChunkedRecording : startChunkedRecording}
            variant={isRecording ? "destructive" : "default"}
            size="sm"
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop (Chunk {currentChunk})
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Continuous Test
              </>
            )}
          </Button>
          <Button onClick={clearTranscript} variant="outline" size="sm">
            Clear All
          </Button>
          <Button 
            onClick={cleanTranscript} 
            variant="secondary" 
            size="sm"
            disabled={!rawTranscript || isProcessingClean}
          >
            {isProcessingClean ? "Cleaning..." : "Clean Transcript"}
          </Button>
        </div>
      </div>

      {/* Real-time Chunked Segments Display */}
      <div className="space-y-2">
        <h4 className="font-medium">Live Chunked Segments:</h4>
        <div className="bg-muted/50 border rounded p-2 h-32 overflow-y-auto">
          <div className="font-mono text-sm space-y-1">
            {transcriptSegments.length > 0 ? (
              transcriptSegments.map((segment, index) => (
                <div
                  key={index}
                  className={`ticker-item ${index === transcriptSegments.length - 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}
                >
                  {segment}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-center mt-12">
                Start recording to see chunked transcripts appear here...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Raw Combined Transcript */}
      <div className="space-y-2">
        <h4 className="font-medium">Raw Combined Transcript:</h4>
        <div className="bg-secondary/20 border rounded p-3 h-24 overflow-y-auto">
          <div className="text-sm">
            {rawTranscript || (
              <div className="text-muted-foreground text-center mt-6">
                Raw transcript will appear here as chunks are combined...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cleaned Transcript */}
      {cleanedTranscript && (
        <div className="space-y-2">
          <h4 className="font-medium">Cleaned & Tidied Transcript:</h4>
          <div className="bg-primary/5 border border-primary/20 rounded p-3 h-24 overflow-y-auto">
            <div className="text-sm text-primary">
              {cleanedTranscript}
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <div>Status: {isRecording ? `Recording chunk ${currentChunk + 1}...` : 'Stopped'}</div>
        <div>Segments: {transcriptSegments.length} | Raw Length: {rawTranscript.length} chars | Clean Length: {cleanedTranscript.length} chars</div>
        <div className="text-green-600">Continuous recording mode - processes indefinitely until stopped</div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .animate-scroll {
            animation: scroll-up 1s ease-out;
          }
          
          .ticker-item {
            margin-bottom: 2px;
            padding: 1px 4px;
            border-radius: 2px;
          }
          
          @keyframes scroll-up {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `
      }} />
    </div>
  );
};

export default ChunkedTranscriptionTest;