import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Play, Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { cleanLargeTranscript } from '@/utils/CleanTranscriptOrchestrator';

const ChunkedTranscriptionTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [cleanedTranscript, setCleanedTranscript] = useState<string>('');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [isProcessingClean, setIsProcessingClean] = useState(false);
  const [cleanProgress, setCleanProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const { toast } = useToast();

  const processAudioChunk = async (audioBlob: Blob, chunkNumber: number) => {
    try {
      console.log(`🎵 Processing chunk ${chunkNumber}, size: ${audioBlob.size} bytes`);
      
      // Create FormData for the edge function
      const formData = new FormData();
      const audioFile = new File([audioBlob], `chunk-${chunkNumber}.webm`, { type: 'audio/webm;codecs=opus' });
      formData.append('audio', audioFile);

      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/triple-check-transcription', {
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
    setCleanProgress({ done: 0, total: 0 });
    try {
      console.log('🧹 Cleaning transcript in chunks as needed...');
      const cleaned = await cleanLargeTranscript(rawTranscript, 'Chunked Test Recording', (done, total) => {
        setCleanProgress({ done, total });
      });
      setCleanedTranscript(cleaned);
      console.log('✅ Transcript cleaned successfully');
      toast({
        title: "Transcript Cleaned",
        description: "Transcript has been processed and tidied up"
      });
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
      // ChatGPT recommended audio settings to match Meeting Recorder
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,        // 48kHz - Chrome native, avoid resampling
          channelCount: 1,
          echoCancellation: false,  // Disabled - can create artifacts
          noiseSuppression: false,  // Disabled - can create artifacts
          autoGainControl: false    // Disabled - can create artifacts
        }
      });

      streamRef.current = stream;
      setIsRecording(true);
      isRecordingRef.current = true;
      setTranscriptSegments([]);
      setCurrentChunk(0);

      let chunkCount = 0;
      let startTime = Date.now();
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }

      console.log('🎙️ Started rapid feedback chunked recording (5s intervals for first 20s, then 30s)');
      toast({
        title: "Rapid Feedback Recording Started", 
        description: "5s chunks for first 20s, then 30s chunks"
      });

      // Longer chunks for better context and fewer API calls
      const getChunkDuration = (chunkNumber: number) => {
        // Quick feedback: shorter chunks initially
        if (chunkNumber <= 1) return 8000;  // 8s for immediate feedback
        if (chunkNumber <= 2) return 20000; // 20s chunks
        // Then switch to longer 45-second chunks for better context
        return 45000; 
      };

      // Minimal overlap to prevent duplicates - now just 0.2s for all chunks
      const getOverlapDuration = (chunkNumber: number) => {
        return 200; // 0.2 second overlap for all chunks
      };

      // Function to create and start a new recorder
      const createRecorder = (chunkNumber: number, actualStartTime?: number) => {
        if (!streamRef.current) return null;

        const recorder = new MediaRecorder(streamRef.current, {
          mimeType,
          audioBitsPerSecond: 128000
        });

        let audioChunks: Blob[] = [];
        const recordingStartTime = actualStartTime || Date.now();

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        recorder.onstop = () => {
          if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            const actualChunkNumber = chunkCount + 1;
            chunkCount++;
            setCurrentChunk(chunkCount);
            console.log(`📦 Chunk ${actualChunkNumber} completed after ${Date.now() - recordingStartTime}ms`);
            processAudioChunk(audioBlob, actualChunkNumber);
            audioChunks = [];
          }
          
          // Start next chunk if still recording
          const nextChunkNumber = chunkCount + 1;
          const overlapDelay = getOverlapDuration(nextChunkNumber);
          
          setTimeout(() => {
            if (streamRef.current && isRecordingRef.current) {
              // Calculate when the next recording should actually start (accounting for overlap)
              const nextRecordingStart = Date.now() - overlapDelay;
              const nextRecorder = createRecorder(nextChunkNumber, nextRecordingStart);
              if (nextRecorder) {
                mediaRecorderRef.current = nextRecorder;
                nextRecorder.start();
                
                const chunkDuration = getChunkDuration(nextChunkNumber);
                console.log(`⏰ Chunk ${nextChunkNumber} started, will run for ${chunkDuration}ms with ${overlapDelay}ms overlap`);
                
                // Schedule this recorder to stop
                chunkTimerRef.current = setTimeout(() => {
                  if (nextRecorder.state === 'recording') {
                    nextRecorder.stop();
                  }
                }, chunkDuration);
              }
            }
          }, 100 - overlapDelay); // Start slightly earlier to account for overlap
        };

        return recorder;
      };

      // Start the first recorder
      const firstRecorder = createRecorder(1, startTime);
      if (firstRecorder) {
        mediaRecorderRef.current = firstRecorder;
        firstRecorder.start();
        
        // Schedule first chunk to stop in 5 seconds
        chunkTimerRef.current = setTimeout(() => {
          if (firstRecorder.state === 'recording') {
            firstRecorder.stop();
          }
        }, 5000);
      }

    } catch (error) {
      console.error('Error starting chunked recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording",
        variant: "destructive"
      });
    }
  };

  const stopChunkedRecording = async () => {
    console.log('🛑 Stopping recording and forcing final chunk...');
    
    // Clear the scheduled timeout first
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    // Force capture the current chunk if recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('📦 Forcing final chunk capture...');
      mediaRecorderRef.current.stop();
      
      // Wait a moment for the final chunk to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    setIsRecording(false);
    isRecordingRef.current = false;
    
    console.log('🛑 Recording stopped with final chunk captured');
    toast({
      title: "Recording Stopped",
      description: `Processed ${currentChunk} chunks (including final chunk)`
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

      {/* Cleaning Progress */}
      {isProcessingClean && (
        <div className="space-y-2">
          <div className="text-sm">Cleaning {cleanProgress.done}/{cleanProgress.total || '...'}</div>
          <Progress value={cleanProgress.total ? (cleanProgress.done / cleanProgress.total) * 100 : 12} />
        </div>
      )}

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