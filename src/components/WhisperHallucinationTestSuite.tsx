import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Loader2, Play, Square, TestTube, Zap, CheckCircle, AlertTriangle, XCircle, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TestProfile {
  id: string;
  name: string;
  model: string;
  audioFormat: string;
  language: string;
  temperature: number;
  prompt: string;
  purpose: string;
  category: 'safe' | 'caution' | 'danger';
  icon: React.ComponentType<any>;
}

interface TestResult {
  profileId: string;
  transcript: string;
  confidence: number;
  duration: number;
  timestamp: Date;
  wordCount: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

const testProfiles: TestProfile[] = [
  {
    id: 'baseline',
    name: 'Baseline Safe Defaults',
    model: 'base',
    audioFormat: 'WAV (16-bit, mono, 16kHz)',
    language: 'Auto-detect',
    temperature: 0,
    prompt: '',
    purpose: 'Cleanest, most neutral setting — acts as the control profile.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'forced-large',
    name: 'Forced Language, Larger Model', 
    model: 'large',
    audioFormat: 'WAV (16-bit, mono, 16kHz)',
    language: 'en',
    temperature: 0.1,
    prompt: '',
    purpose: 'Enforce English to reduce hallucinations + highest accuracy model.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'prompt-context',
    name: 'Prompt-Injected Context',
    model: 'medium', 
    audioFormat: 'WAV (16-bit, mono, 16kHz)',
    language: 'en',
    temperature: 0.2,
    prompt: 'This is a healthcare-related conversation between a GP and a patient.',
    purpose: 'Reduces hallucinations by giving context and avoiding guessing.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'poor-quality',
    name: 'Poor Quality Input Simulation',
    model: 'base',
    audioFormat: 'MP3 (128kbps, mono)',
    language: 'en',
    temperature: 0.3,
    prompt: '',
    purpose: 'Mimics real-world low-quality uploads. Observe hallucination rates.',
    category: 'caution',
    icon: AlertTriangle
  },
  {
    id: 'small-lowtemp',
    name: 'Small Model, Low Temp',
    model: 'small',
    audioFormat: 'WAV (16-bit, mono, 16kHz)',
    language: 'en',
    temperature: 0.1,
    prompt: '',
    purpose: 'See if a slightly smaller model still gives usable results when temperature is kept low.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'tiny-stress',
    name: 'Tiny Model, High Temp Stress Test',
    model: 'tiny',
    audioFormat: 'WAV (16kHz, mono)',
    language: 'Auto',
    temperature: 0.5,
    prompt: '',
    purpose: 'Worst-case to measure hallucinations. Should be significantly worse than others.',
    category: 'danger',
    icon: XCircle
  },
  {
    id: 'optimal-combo',
    name: 'Prompt + Forced Language + Large Model',
    model: 'large',
    audioFormat: 'WAV (16kHz, mono)',
    language: 'en',
    temperature: 0.1,
    prompt: 'Medical consultation transcription. Speak clearly. Prioritise accuracy.',
    purpose: 'Combine all best-practice settings to maximise accuracy and reduce hallucinations.',
    category: 'safe',
    icon: CheckCircle
  }
];

export const WhisperHallucinationTestSuite: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>(['baseline', 'forced-large', 'prompt-context']);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [testAudio, setTestAudio] = useState<string>('record'); // 'record' or 'upload'
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'safe': return 'bg-green-100 text-green-800 border-green-200';
      case 'caution': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'danger': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Create URL for audio playback
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Recording stopped');
    }
  };

  const runTests = async () => {
    if (!audioBlob) {
      toast.error('Please record audio first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setTestResults([]);

    const profilesToTest = testProfiles.filter(profile => selectedProfiles.includes(profile.id));
    const totalTests = profilesToTest.length;

    for (let i = 0; i < profilesToTest.length; i++) {
      const profile = profilesToTest[i];
      
      try {
        console.log(`Running test for profile: ${profile.name}`);
        
        // Prepare audio data
        const formData = new FormData();
        formData.append('audio', audioBlob, 'test-audio.webm');
        formData.append('model', profile.model);
        formData.append('language', profile.language === 'Auto-detect' ? '' : profile.language);
        formData.append('temperature', profile.temperature.toString());
        if (profile.prompt) {
          formData.append('prompt', profile.prompt);
        }

        const startTime = Date.now();
        
        // Call the test MP3 transcription function (it works with WebM too)
        const { data, error } = await supabase.functions.invoke('test-mp3-transcription', {
          body: formData
        });

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        if (error) {
          throw new Error(error.message || 'Transcription failed');
        }

        const result: TestResult = {
          profileId: profile.id,
          transcript: data.text || '',
          confidence: data.confidence || 0,
          duration,
          timestamp: new Date(),
          wordCount: (data.text || '').split(' ').filter(word => word.length > 0).length,
          status: 'success'
        };

        setTestResults(prev => [...prev, result]);
        
      } catch (error: any) {
        console.error(`Test failed for profile ${profile.name}:`, error);
        
        const result: TestResult = {
          profileId: profile.id,
          transcript: '',
          confidence: 0,
          duration: 0,
          timestamp: new Date(),
          wordCount: 0,
          status: 'error',
          errorMessage: error.message
        };

        setTestResults(prev => [...prev, result]);
      }

      setProgress(((i + 1) / totalTests) * 100);
    }

    setIsProcessing(false);
    toast.success(`Completed ${totalTests} transcription tests`);
  };

  const handleProfileToggle = (profileId: string) => {
    setSelectedProfiles(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const selectAllProfiles = () => {
    setSelectedProfiles(testProfiles.map(p => p.id));
  };

  const clearAllProfiles = () => {
    setSelectedProfiles([]);
  };

  const getResultForProfile = (profileId: string) => {
    return testResults.find(result => result.profileId === profileId);
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TestTube className="h-6 w-6 text-primary" />
            </div>
            🔬 Whisper AI Hallucination Testing Suite
          </CardTitle>
          <p className="text-muted-foreground">
            Compare transcription quality across 7 different Whisper configurations to identify hallucinations and optimal settings for your use case.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Audio Recording Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Audio Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {!isRecording ? (
                  <Button onClick={startRecording} className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Start Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive" className="flex items-center gap-2">
                    <Square className="h-4 w-4" />
                    Stop Recording
                  </Button>
                )}
                
                {audioBlob && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">
                        Audio ready ({(audioBlob.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    
                    {audioUrl && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (audioRef.current) {
                              if (audioRef.current.paused) {
                                audioRef.current.play();
                              } else {
                                audioRef.current.pause();
                              }
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <Volume2 className="h-3 w-3" />
                          Play Recording
                        </Button>
                        <audio
                          ref={audioRef}
                          src={audioUrl}
                          controls
                          className="h-8"
                          preload="metadata"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {isRecording && (
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Recording in progress...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Test Profile Selection
              </CardTitle>
              <div className="flex gap-2">
                <Button onClick={selectAllProfiles} size="sm" variant="outline">
                  Select All
                </Button>
                <Button onClick={clearAllProfiles} size="sm" variant="outline">
                  Clear All
                </Button>
                <Badge variant="secondary">{selectedProfiles.length} selected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {testProfiles.map((profile) => {
                  const isSelected = selectedProfiles.includes(profile.id);
                  const result = getResultForProfile(profile.id);
                  const IconComponent = profile.icon;
                  
                  return (
                    <Card 
                      key={profile.id}
                      className={`cursor-pointer transition-all ${
                        isSelected 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleProfileToggle(profile.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            <IconComponent className={`h-5 w-5 ${
                              profile.category === 'safe' ? 'text-green-600' :
                              profile.category === 'caution' ? 'text-yellow-600' :
                              'text-red-600'
                            }`} />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm">{profile.name}</h4>
                              <Badge className={`text-xs ${getCategoryColor(profile.category)}`}>
                                {profile.category}
                              </Badge>
                            </div>
                            
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div><strong>Model:</strong> {profile.model}</div>
                              <div><strong>Language:</strong> {profile.language}</div>
                              <div><strong>Temperature:</strong> {profile.temperature}</div>
                              {profile.prompt && (
                                <div><strong>Prompt:</strong> "{profile.prompt}"</div>
                              )}
                            </div>
                            
                            <p className="text-xs text-muted-foreground">
                              {profile.purpose}
                            </p>

                            {result && (
                              <div className="mt-2 pt-2 border-t">
                                {result.status === 'success' ? (
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span>Words:</span>
                                      <span className="font-medium">{result.wordCount}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>Confidence:</span>
                                      <span className="font-medium">{(result.confidence * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>Duration:</span>
                                      <span className="font-medium">{result.duration.toFixed(1)}s</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-red-600">
                                    Error: {result.errorMessage}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Run Tests */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={runTests}
                  disabled={!audioBlob || selectedProfiles.length === 0 || isProcessing}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isProcessing ? 'Running Tests...' : 'Run Selected Tests'}
                </Button>
                
                {isProcessing && (
                  <div className="flex-1">
                    <Progress value={progress} className="w-full" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(progress)}% complete
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Comparison */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transcription Results Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testProfiles
                    .filter(profile => selectedProfiles.includes(profile.id))
                    .map((profile) => {
                      const result = getResultForProfile(profile.id);
                      if (!result) return null;

                      return (
                        <Card key={profile.id} className="border-l-4 border-l-primary">
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <h4 className="font-medium">{profile.name}</h4>
                              <Badge className={`text-xs ${getCategoryColor(profile.category)}`}>
                                {profile.category}
                              </Badge>
                              {result.status === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            
                            {result.status === 'success' ? (
                              <>
                                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Words:</span>
                                    <span className="ml-2 font-medium">{result.wordCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Confidence:</span>
                                    <span className="ml-2 font-medium">{(result.confidence * 100).toFixed(1)}%</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Time:</span>
                                    <span className="ml-2 font-medium">{result.duration.toFixed(1)}s</span>
                                  </div>
                                </div>
                                
                                <div className="bg-muted/50 rounded-lg p-3">
                                  <h5 className="text-sm font-medium mb-2">Transcript:</h5>
                                  <p className="text-sm leading-relaxed">
                                    {result.transcript || 'No transcript generated'}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-red-600 text-sm">
                                  <strong>Error:</strong> {result.errorMessage}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};