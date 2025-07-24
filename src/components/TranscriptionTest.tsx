import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TranscriptLine {
  id: string;
  text: string;
  timestamp: string;
  confidence?: number;
  source: string;
}

interface TranscriptionMethod {
  id: string;
  name: string;
  description: string;
  isRecording: boolean;
  transcripts: TranscriptLine[];
  status: string;
}

export const TranscriptionTest = () => {
  const [methods, setMethods] = useState<TranscriptionMethod[]>([
    {
      id: 'openai-whisper',
      name: 'OpenAI Whisper API',
      description: 'Real-time chunked transcription via OpenAI Whisper',
      isRecording: false,
      transcripts: [],
      status: 'Ready'
    },
    {
      id: 'browser-speech',
      name: 'Browser Speech Recognition',
      description: 'Native Web Speech API (Chrome/Edge)',
      isRecording: false,
      transcripts: [],
      status: 'Ready'
    },
    {
      id: 'assemblyai',
      name: 'AssemblyAI Real-time',
      description: 'AssemblyAI streaming transcription service',
      isRecording: false,
      transcripts: [],
      status: 'Ready'
    },
    {
      id: 'google-speech',
      name: 'Google Speech-to-Text',
      description: 'Google Cloud Speech API',
      isRecording: false,
      transcripts: [],
      status: 'Ready'
    },
    {
      id: 'openai-realtime',
      name: 'OpenAI Realtime API',
      description: 'OpenAI Realtime streaming transcription',
      isRecording: false,
      transcripts: [],
      status: 'Ready'
    },
    {
      id: 'azure-speech',
      name: 'Azure Speech Services',
      description: 'Microsoft Azure Cognitive Speech Services',
      isRecording: false,
      transcripts: [],
      status: 'Ready'
    },
    {
      id: 'deepgram',
      name: 'Deepgram API',
      description: 'Deepgram real-time speech recognition',
      isRecording: false,
      transcripts: [],
      status: 'Ready'
    }
  ]);

  const audioStreamsRef = useRef<Record<string, MediaStream>>({});
  const mediaRecordersRef = useRef<Record<string, MediaRecorder>>({});
  const speechRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const updateMethodStatus = (methodId: string, updates: Partial<TranscriptionMethod>) => {
    setMethods(prev => prev.map(method => 
      method.id === methodId ? { ...method, ...updates } : method
    ));
  };

  const addTranscript = (methodId: string, text: string, confidence?: number) => {
    const newTranscript: TranscriptLine = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleTimeString(),
      confidence,
      source: methodId
    };

    setMethods(prev => prev.map(method => 
      method.id === methodId 
        ? { ...method, transcripts: [...method.transcripts, newTranscript] }
        : method
    ));
  };

  const setupAudioCapture = async () => {
    try {
      // Get microphone audio
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Try to get system audio (without permission prompt)
      let systemStream: MediaStream | null = null;
      try {
        systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        // Check if audio track exists
        if (!systemStream.getAudioTracks().length) {
          systemStream.getTracks().forEach(track => track.stop());
          systemStream = null;
        }
      } catch (error) {
        console.log('System audio not available, using mic only');
      }

      // Create audio context to mix streams
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const destination = audioContextRef.current.createMediaStreamDestination();

      // Connect microphone
      const micSource = audioContextRef.current.createMediaStreamSource(micStream);
      micSource.connect(destination);

      // Connect system audio if available
      if (systemStream) {
        const systemSource = audioContextRef.current.createMediaStreamSource(systemStream);
        systemSource.connect(destination);
      }

      return destination.stream;
    } catch (error) {
      console.error('Error setting up audio capture:', error);
      toast.error('Failed to access audio. Please check permissions.');
      throw error;
    }
  };

  const startOpenAIWhisper = async (methodId: string) => {
    try {
      const stream = await setupAudioCapture();
      audioStreamsRef.current[methodId] = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            const { data, error } = await supabase.functions.invoke('speech-to-text', {
              body: { audio: base64 }
            });

            if (error) throw error;
            if (data?.text && data.text.trim()) {
              addTranscript(methodId, data.text.trim(), data.confidence);
            }
          } catch (error) {
            console.error('Whisper transcription error:', error);
            updateMethodStatus(methodId, { status: 'Error: ' + (error as Error).message });
          }
        }
      };

      mediaRecorder.start();
      setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          mediaRecorder.start();
        }
      }, 3000);

      mediaRecordersRef.current[methodId] = mediaRecorder;
      updateMethodStatus(methodId, { isRecording: true, status: 'Recording...' });

    } catch (error) {
      updateMethodStatus(methodId, { status: 'Failed to start' });
    }
  };

  const startBrowserSpeech = async (methodId: string) => {
    try {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        throw new Error('Browser speech recognition not supported');
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          addTranscript(methodId, lastResult[0].transcript, lastResult[0].confidence);
        }
      };

      recognition.onerror = (event: any) => {
        updateMethodStatus(methodId, { status: 'Error: ' + event.error });
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
      updateMethodStatus(methodId, { isRecording: true, status: 'Recording...' });

    } catch (error) {
      updateMethodStatus(methodId, { status: 'Not supported in this browser' });
    }
  };

  const startAssemblyAI = async (methodId: string) => {
    try {
      const stream = await setupAudioCapture();
      audioStreamsRef.current[methodId] = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            const { data, error } = await supabase.functions.invoke('assemblyai-transcription', {
              body: { audio: base64 }
            });

            if (error) throw error;
            if (data?.text && data.text.trim()) {
              addTranscript(methodId, data.text.trim(), data.confidence);
            }
          } catch (error) {
            console.error('AssemblyAI transcription error:', error);
            updateMethodStatus(methodId, { status: 'Error: ' + (error as Error).message });
          }
        }
      };

      mediaRecorder.start();
      setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          mediaRecorder.start();
        }
      }, 2000);

      mediaRecordersRef.current[methodId] = mediaRecorder;
      updateMethodStatus(methodId, { isRecording: true, status: 'Recording...' });

    } catch (error) {
      updateMethodStatus(methodId, { status: 'Failed to start' });
    }
  };

  const startGoogleSpeech = async (methodId: string) => {
    // Placeholder for Google Speech API implementation
    updateMethodStatus(methodId, { status: 'Google Speech API not implemented yet' });
  };

  const startOpenAIRealtime = async (methodId: string) => {
    // Placeholder for OpenAI Realtime API implementation
    updateMethodStatus(methodId, { status: 'OpenAI Realtime API not implemented yet' });
  };

  const startAzureSpeech = async (methodId: string) => {
    try {
      const stream = await setupAudioCapture();
      audioStreamsRef.current[methodId] = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            const { data, error } = await supabase.functions.invoke('azure-speech-transcription', {
              body: { audio: base64 }
            });

            if (error) throw error;
            if (data?.text && data.text.trim()) {
              addTranscript(methodId, data.text.trim(), data.confidence);
            }
          } catch (error) {
            console.error('Azure Speech transcription error:', error);
            updateMethodStatus(methodId, { status: 'Error: ' + (error as Error).message });
          }
        }
      };

      mediaRecorder.start();
      setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          mediaRecorder.start();
        }
      }, 2500);

      mediaRecordersRef.current[methodId] = mediaRecorder;
      updateMethodStatus(methodId, { isRecording: true, status: 'Recording...' });

    } catch (error) {
      updateMethodStatus(methodId, { status: 'Failed to start' });
    }
  };

  const startDeepgram = async (methodId: string) => {
    try {
      const stream = await setupAudioCapture();
      audioStreamsRef.current[methodId] = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            const { data, error } = await supabase.functions.invoke('deepgram-transcription', {
              body: { audio: base64 }
            });

            if (error) throw error;
            if (data?.text && data.text.trim()) {
              addTranscript(methodId, data.text.trim(), data.confidence);
            }
          } catch (error) {
            console.error('Deepgram transcription error:', error);
            updateMethodStatus(methodId, { status: 'Error: ' + (error as Error).message });
          }
        }
      };

      mediaRecorder.start();
      setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          mediaRecorder.start();
        }
      }, 1500);

      mediaRecordersRef.current[methodId] = mediaRecorder;
      updateMethodStatus(methodId, { isRecording: true, status: 'Recording...' });

    } catch (error) {
      updateMethodStatus(methodId, { status: 'Failed to start' });
    }
  };

  const startRecording = async (methodId: string) => {
    switch (methodId) {
      case 'openai-whisper':
        await startOpenAIWhisper(methodId);
        break;
      case 'browser-speech':
        await startBrowserSpeech(methodId);
        break;
      case 'assemblyai':
        await startAssemblyAI(methodId);
        break;
      case 'google-speech':
        await startGoogleSpeech(methodId);
        break;
      case 'openai-realtime':
        await startOpenAIRealtime(methodId);
        break;
      case 'azure-speech':
        await startAzureSpeech(methodId);
        break;
      case 'deepgram':
        await startDeepgram(methodId);
        break;
    }
  };

  const stopRecording = (methodId: string) => {
    // Stop media recorder
    if (mediaRecordersRef.current[methodId]) {
      mediaRecordersRef.current[methodId].stop();
      delete mediaRecordersRef.current[methodId];
    }

    // Stop audio stream
    if (audioStreamsRef.current[methodId]) {
      audioStreamsRef.current[methodId].getTracks().forEach(track => track.stop());
      delete audioStreamsRef.current[methodId];
    }

    // Stop speech recognition
    if (methodId === 'browser-speech' && speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    updateMethodStatus(methodId, { isRecording: false, status: 'Stopped' });
  };

  const clearTranscripts = (methodId: string) => {
    updateMethodStatus(methodId, { transcripts: [] });
  };

  const handleToggleRecording = (methodId: string) => {
    const method = methods.find(m => m.id === methodId);
    if (method?.isRecording) {
      stopRecording(methodId);
    } else {
      startRecording(methodId);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      Object.values(mediaRecordersRef.current).forEach(recorder => recorder.stop());
      Object.values(audioStreamsRef.current).forEach(stream => 
        stream.getTracks().forEach(track => track.stop())
      );
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {methods.map((method) => (
          <Card key={method.id} className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{method.name}</CardTitle>
                <Badge variant={method.isRecording ? "default" : "secondary"}>
                  {method.isRecording ? "Recording" : "Ready"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{method.description}</p>
              <div className="text-xs text-muted-foreground">Status: {method.status}</div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col">
              <div className="flex gap-2 mb-4">
                <Button
                  onClick={() => handleToggleRecording(method.id)}
                  variant={method.isRecording ? "destructive" : "default"}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {method.isRecording ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Start
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={() => clearTranscripts(method.id)}
                  variant="outline"
                  size="sm"
                  disabled={method.transcripts.length === 0}
                >
                  Clear
                </Button>
              </div>

              {/* Ticker Tape Transcription Display */}
              <div className="flex-1 bg-muted/30 rounded-lg p-3 min-h-[200px] max-h-[300px] overflow-y-auto">
                <div className="space-y-2">
                  {method.transcripts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Waves className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Transcription will appear here...</p>
                    </div>
                  ) : (
                    method.transcripts.map((transcript) => (
                      <div key={transcript.id} className="p-2 bg-background rounded border-l-2 border-primary/20">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{transcript.timestamp}</span>
                          {transcript.confidence && (
                            <span>Confidence: {Math.round(transcript.confidence * 100)}%</span>
                          )}
                        </div>
                        <p className="text-sm">{transcript.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              onClick={() => methods.forEach(method => {
                if (!method.isRecording) startRecording(method.id);
              })}
              className="flex items-center gap-2"
            >
              <Mic className="h-4 w-4" />
              Start All
            </Button>
            
            <Button
              onClick={() => methods.forEach(method => {
                if (method.isRecording) stopRecording(method.id);
              })}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <MicOff className="h-4 w-4" />
              Stop All
            </Button>
            
            <Button
              onClick={() => methods.forEach(method => clearTranscripts(method.id))}
              variant="outline"
              className="flex items-center gap-2"
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};