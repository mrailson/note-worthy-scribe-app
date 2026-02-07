import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Loader2, Play, Square, TestTube, Zap, CheckCircle, AlertTriangle, XCircle, Volume2, Upload, FileAudio, FileText, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
// mammoth loaded dynamically when needed

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

// New hallucination mitigation test configurations
const hallucinationMitigationProfiles: TestProfile[] = [
  {
    id: 'hm-baseline',
    name: '🔬 HM1: Baseline Control',
    model: 'base',
    audioFormat: 'Mono, 16kHz, VAD enabled',
    language: 'en',
    temperature: 0,
    prompt: '',
    purpose: 'Control: Mono, 16 kHz, temperature=0, VAD enabled baseline for comparison.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'hm-short-chunks',
    name: '🔄 HM2: Short Chunks Strategy',
    model: 'base',
    audioFormat: '15s chunks, 2s overlap',
    language: 'en',
    temperature: 0,
    prompt: '',
    purpose: 'Short chunks: 15s chunks, 2s overlap, condition_on_previous_text=false.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'hm-noise-suppressed',
    name: '🔇 HM3: Noise Suppression',
    model: 'base',
    audioFormat: 'Mono, 16kHz + noise suppression',
    language: 'en',
    temperature: 0,
    prompt: '',
    purpose: 'Enhanced audio: Baseline + noise suppression & echo cancellation enabled.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'hm-high-sample-rate',
    name: '📈 HM4: High Sample Rate',
    model: 'base',
    audioFormat: '44.1kHz mono, short chunks',
    language: 'en',
    temperature: 0,
    prompt: '',
    purpose: 'High fidelity: 44.1 kHz mono, short chunks, low temperature for maximum clarity.',
    category: 'safe',
    icon: CheckCircle
  },
  {
    id: 'hm-minimal-prompt',
    name: '🚫 HM5: Minimal Prompt',
    model: 'base',
    audioFormat: 'Short chunks, no prompts',
    language: 'en',
    temperature: 0,
    prompt: '',
    purpose: 'Minimal bias: No initial_prompt, short chunks, low temperature to avoid prompt-induced hallucinations.',
    category: 'safe',
    icon: CheckCircle
  }
];

export const WhisperHallucinationTestSuite: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>(['baseline', 'forced-large', 'prompt-context']);
  const [selectedHMProfiles, setSelectedHMProfiles] = useState<string[]>(['hm-baseline', 'hm-short-chunks', 'hm-noise-suppressed', 'hm-high-sample-rate', 'hm-minimal-prompt']);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [hmTestResults, setHMTestResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [testAudio, setTestAudio] = useState<string>('record'); // 'record' or 'upload'
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeTestSuite, setActiveTestSuite] = useState<'standard' | 'hallucination-mitigation'>('standard');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [masterTranscript, setMasterTranscript] = useState<string>('');
  const [masterTranscriptFileName, setMasterTranscriptFileName] = useState<string>('');

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    // Check file size (limit to 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be less than 25MB');
      return;
    }

    setAudioBlob(file);
    setUploadedFileName(file.name);
    
    // Create URL for audio playback
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    
    toast.success(`Audio file "${file.name}" uploaded successfully`);
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setUploadedFileName('');
    setTestAudio('record');
    
    // Clear any ongoing recording
    if (isRecording) {
      stopRecording();
    }
    
    toast.success('Audio cleared');
  };

  const handleMasterTranscriptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a DOCX file
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Please select a DOCX file');
      return;
    }

    try {
      const mammoth = (await import('mammoth')).default;
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (result.value) {
        setMasterTranscript(result.value.trim());
        setMasterTranscriptFileName(file.name);
        toast.success(`Master transcript "${file.name}" loaded successfully`);
      } else {
        toast.error('Could not extract text from DOCX file');
      }
    } catch (error) {
      console.error('Error reading DOCX file:', error);
      toast.error('Failed to read DOCX file');
    }
  };

  const clearMasterTranscript = () => {
    setMasterTranscript('');
    setMasterTranscriptFileName('');
    toast.success('Master transcript cleared');
  };

  // Accuracy comparison functions
  const calculateWordErrorRate = (reference: string, hypothesis: string): number => {
    const refWords = reference.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    const hypWords = hypothesis.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    
    // Simple Levenshtein distance for word arrays
    const matrix: number[][] = [];
    
    for (let i = 0; i <= refWords.length; i++) {
      matrix[i] = [];
      matrix[i][0] = i;
    }
    
    for (let j = 0; j <= hypWords.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= refWords.length; i++) {
      for (let j = 1; j <= hypWords.length; j++) {
        if (refWords[i - 1] === hypWords[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // deletion
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }
    
    const editDistance = matrix[refWords.length][hypWords.length];
    return refWords.length > 0 ? (editDistance / refWords.length) * 100 : 0;
  };

  const calculateSimilarityScore = (reference: string, hypothesis: string): number => {
    const wer = calculateWordErrorRate(reference, hypothesis);
    return Math.max(0, 100 - wer);
  };

  const findHallucinations = (reference: string, hypothesis: string): string[] => {
    const refWords = new Set(reference.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0));
    const hypWords = hypothesis.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    
    const hallucinations: string[] = [];
    const hypWordCounts: { [key: string]: number } = {};
    
    // Count words in hypothesis
    hypWords.forEach(word => {
      hypWordCounts[word] = (hypWordCounts[word] || 0) + 1;
    });
    
    // Find words that appear significantly more often in hypothesis than reasonable
    Object.entries(hypWordCounts).forEach(([word, count]) => {
      if (!refWords.has(word) && count > 2) {
        hallucinations.push(`"${word}" (repeated ${count} times)`);
      }
    });
    
    return hallucinations;
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

  const runHallucinationMitigationTests = async () => {
    if (!audioBlob) {
      toast.error('Please record audio first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setHMTestResults([]);

    const profilesToTest = hallucinationMitigationProfiles.filter(profile => selectedHMProfiles.includes(profile.id));
    const totalTests = profilesToTest.length;

    for (let i = 0; i < profilesToTest.length; i++) {
      const profile = profilesToTest[i];
      
      try {
        console.log(`Running hallucination mitigation test for profile: ${profile.name}`);
        
        // Prepare audio data with specific hallucination mitigation parameters
        const formData = new FormData();
        formData.append('audio', audioBlob, 'test-audio.webm');
        formData.append('model', profile.model);
        formData.append('language', profile.language);
        formData.append('temperature', profile.temperature.toString());
        
        // Add specific hallucination mitigation parameters
        if (profile.id === 'hm-short-chunks') {
          formData.append('chunk_size', '15');
          formData.append('overlap', '2');
          formData.append('condition_on_previous_text', 'false');
        } else if (profile.id === 'hm-noise-suppressed') {
          formData.append('noise_suppression', 'true');
          formData.append('echo_cancellation', 'true');
        } else if (profile.id === 'hm-high-sample-rate') {
          formData.append('sample_rate', '44100');
          formData.append('chunk_size', '15');
        } else if (profile.id === 'hm-minimal-prompt') {
          formData.append('no_initial_prompt', 'true');
          formData.append('chunk_size', '15');
        }

        const startTime = Date.now();
        
        // Call specialized hallucination test function or regular test
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

        setHMTestResults(prev => [...prev, result]);
        
      } catch (error: any) {
        console.error(`Hallucination mitigation test failed for profile ${profile.name}:`, error);
        
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

        setHMTestResults(prev => [...prev, result]);
      }

      setProgress(((i + 1) / totalTests) * 100);
    }

    setIsProcessing(false);
    toast.success(`Completed ${totalTests} hallucination mitigation tests`);
  };

  const handleProfileToggle = (profileId: string) => {
    if (activeTestSuite === 'standard') {
      setSelectedProfiles(prev => 
        prev.includes(profileId) 
          ? prev.filter(id => id !== profileId)
          : [...prev, profileId]
      );
    } else {
      setSelectedHMProfiles(prev => 
        prev.includes(profileId) 
          ? prev.filter(id => id !== profileId)
          : [...prev, profileId]
      );
    }
  };

  const selectAllProfiles = () => {
    if (activeTestSuite === 'standard') {
      setSelectedProfiles(testProfiles.map(p => p.id));
    } else {
      setSelectedHMProfiles(hallucinationMitigationProfiles.map(p => p.id));
    }
  };

  const clearAllProfiles = () => {
    if (activeTestSuite === 'standard') {
      setSelectedProfiles([]);
    } else {
      setSelectedHMProfiles([]);
    }
  };

  const getResultForProfile = (profileId: string) => {
    if (activeTestSuite === 'standard') {
      return testResults.find(result => result.profileId === profileId);
    } else {
      return hmTestResults.find(result => result.profileId === profileId);
    }
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
          {/* Audio Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileAudio className="h-5 w-5" />
                Audio Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audio Source Selection */}
              <div className="flex gap-2">
                <Button
                  variant={testAudio === 'record' ? 'default' : 'outline'}
                  onClick={() => setTestAudio('record')}
                  className="flex items-center gap-2"
                >
                  <Mic className="h-4 w-4" />
                  Record Audio
                </Button>
                <Button
                  variant={testAudio === 'upload' ? 'default' : 'outline'}
                  onClick={() => setTestAudio('upload')}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import Audio File
                </Button>
              </div>

              {/* Recording Section */}
              {testAudio === 'record' && (
                <div className="space-y-4">
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
                  </div>
                  
                  {isRecording && (
                    <div className="flex items-center gap-2 text-red-600">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Recording in progress...</span>
                    </div>
                  )}
                </div>
              )}

              {/* File Upload Section */}
              {testAudio === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <div className="space-y-2">
                        <label htmlFor="audio-upload" className="cursor-pointer">
                          <span className="text-sm font-medium text-primary hover:text-primary/80">
                            Click to upload audio file
                          </span>
                          <input
                            id="audio-upload"
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Supports MP3, WAV, M4A, FLAC and other audio formats (max 25MB)
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {uploadedFileName && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Uploaded: {uploadedFileName}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Audio Ready State */}
              {audioBlob && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">
                          Audio ready for testing
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {testAudio === 'upload' ? uploadedFileName : 'Recorded audio'} • {(audioBlob.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
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
                            Play
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
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearAudio}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Master Transcript Import */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Master Transcript (Reference)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a DOCX file containing the correct transcript to compare accuracy and detect hallucinations.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <div className="space-y-2">
                    <label htmlFor="transcript-upload" className="cursor-pointer">
                      <span className="text-sm font-medium text-primary hover:text-primary/80">
                        Click to upload DOCX transcript
                      </span>
                      <input
                        id="transcript-upload"
                        type="file"
                        accept=".docx"
                        className="hidden"
                        onChange={handleMasterTranscriptUpload}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Upload a .docx file containing the reference transcript for accuracy comparison
                    </p>
                  </div>
                </div>
              </div>
              
              {masterTranscript && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Master transcript loaded: {masterTranscriptFileName}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearMasterTranscript}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Clear
                    </Button>
                  </div>
                  
                  <div className="bg-white border rounded p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-muted-foreground mb-1">Reference transcript preview:</p>
                    <p className="text-sm">
                      {masterTranscript.length > 200 
                        ? `${masterTranscript.substring(0, 200)}...` 
                        : masterTranscript}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-green-700">
                    <span>Words: {masterTranscript.split(/\s+/).filter(w => w.length > 0).length}</span>
                    <span>Characters: {masterTranscript.length}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Suite Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Test Suite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={activeTestSuite === 'standard' ? 'default' : 'outline'}
                  onClick={() => setActiveTestSuite('standard')}
                  className="flex items-center gap-2"
                >
                  <TestTube className="h-4 w-4" />
                  Standard Tests
                </Button>
                <Button
                  variant={activeTestSuite === 'hallucination-mitigation' ? 'default' : 'outline'}
                  onClick={() => setActiveTestSuite('hallucination-mitigation')}
                  className="flex items-center gap-2"
                >
                  🧠 Hallucination Mitigation
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Profile Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {activeTestSuite === 'standard' ? 'Standard Test Profiles' : 'Hallucination Mitigation Test Configurations'}
              </CardTitle>
              {activeTestSuite === 'hallucination-mitigation' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-sm text-blue-900 mb-2">🧠 Hallucination Mitigation Testing Strategy</h4>
                  <p className="text-xs text-blue-800 mb-2">
                    Run the same meeting snippet through all 5 configurations to compare hallucination rates:
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li><strong>HM1 Baseline:</strong> Mono, 16 kHz, temperature=0, VAD enabled</li>
                    <li><strong>HM2 Short Chunks:</strong> 15s chunks, 2s overlap, condition_on_previous_text=false</li>
                    <li><strong>HM3 Noise-Suppressed:</strong> As baseline but with noise suppression & echo cancellation</li>
                    <li><strong>HM4 High Sample Rate:</strong> 44.1 kHz mono, short chunks, low temperature</li>
                    <li><strong>HM5 Minimal Prompt:</strong> No initial_prompt, short chunks, low temperature</li>
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={selectAllProfiles} size="sm" variant="outline">
                  Select All
                </Button>
                <Button onClick={clearAllProfiles} size="sm" variant="outline">
                  Clear All
                </Button>
                <Badge variant="secondary">
                  {activeTestSuite === 'standard' ? selectedProfiles.length : selectedHMProfiles.length} selected
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(activeTestSuite === 'standard' ? testProfiles : hallucinationMitigationProfiles).map((profile) => {
                  const isSelected = activeTestSuite === 'standard' 
                    ? selectedProfiles.includes(profile.id)
                    : selectedHMProfiles.includes(profile.id);
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
                  onClick={activeTestSuite === 'standard' ? runTests : runHallucinationMitigationTests}
                  disabled={!audioBlob || (activeTestSuite === 'standard' ? selectedProfiles.length === 0 : selectedHMProfiles.length === 0) || isProcessing}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isProcessing ? 'Running Tests...' : `Run ${activeTestSuite === 'standard' ? 'Standard' : 'Hallucination Mitigation'} Tests`}
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
          {((activeTestSuite === 'standard' && testResults.length > 0) || 
            (activeTestSuite === 'hallucination-mitigation' && hmTestResults.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {activeTestSuite === 'standard' ? 'Transcription Results Comparison' : 'Hallucination Mitigation Results Comparison'}
                </CardTitle>
                {activeTestSuite === 'hallucination-mitigation' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <h5 className="font-semibold text-sm text-amber-900 mb-1">📊 Analysis Tips:</h5>
                    <ul className="text-xs text-amber-800 space-y-1">
                      <li>• Compare word counts - significant differences may indicate hallucinations</li>
                      <li>• Look for repeated phrases or nonsensical additions in longer transcripts</li>
                      <li>• Check confidence scores - lower confidence may correlate with hallucinations</li>
                      <li>• Note processing times - some mitigation strategies may be slower but more accurate</li>
                    </ul>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(activeTestSuite === 'standard' ? testProfiles : hallucinationMitigationProfiles)
                    .filter(profile => activeTestSuite === 'standard' 
                      ? selectedProfiles.includes(profile.id) 
                      : selectedHMProfiles.includes(profile.id))
                    .map((profile) => {
                      const result = getResultForProfile(profile.id);
                      if (!result) return null;

                      return (
                        <Card key={profile.id} className={`border-l-4 ${
                          result.status === 'success' ? 'border-l-green-500' : 'border-l-red-500'
                        }`}>
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

                                {/* Accuracy Metrics when master transcript is available */}
                                {masterTranscript && (
                                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h6 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                      <BarChart3 className="h-4 w-4" />
                                      Accuracy Analysis vs Master Transcript
                                    </h6>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-blue-700">Accuracy Score:</span>
                                        <span className="ml-2 font-medium text-blue-900">
                                          {calculateSimilarityScore(masterTranscript, result.transcript).toFixed(1)}%
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-blue-700">Word Error Rate:</span>
                                        <span className="ml-2 font-medium text-blue-900">
                                          {calculateWordErrorRate(masterTranscript, result.transcript).toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Show potential hallucinations */}
                                    {(() => {
                                      const hallucinations = findHallucinations(masterTranscript, result.transcript);
                                      return hallucinations.length > 0 && (
                                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                          <p className="text-xs font-medium text-red-800 mb-1">Potential Hallucinations:</p>
                                          <p className="text-xs text-red-700">{hallucinations.join(', ')}</p>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                <div className="bg-muted/50 rounded-lg p-3">
                                  <h5 className="text-sm font-medium mb-2">Transcript:</h5>
                                  <p className="text-sm leading-relaxed">
                                    {result.transcript || 'No transcript generated'}
                                  </p>
                                </div>

                                {activeTestSuite === 'hallucination-mitigation' && (
                                  <div className="mt-3 p-2 bg-blue-50 rounded border">
                                    <p className="text-xs text-blue-700">
                                      <strong>Configuration:</strong> {profile.purpose}
                                    </p>
                                  </div>
                                )}
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

                {/* Hallucination Detection Summary */}
                {activeTestSuite === 'hallucination-mitigation' && hmTestResults.length > 0 && (
                  <Card className="mt-6 border-2 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        🔍 Hallucination Detection Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h5 className="font-semibold mb-2">Word Count Analysis</h5>
                          <div className="space-y-1">
                            {hmTestResults
                              .filter(r => r.status === 'success')
                              .sort((a, b) => a.wordCount - b.wordCount)
                              .map(result => {
                                const profile = hallucinationMitigationProfiles.find(p => p.id === result.profileId);
                                return (
                                  <div key={result.profileId} className="flex justify-between text-sm">
                                    <span>{profile?.name.replace('🔬 ', '').replace('🔄 ', '').replace('🔇 ', '').replace('📈 ', '').replace('🚫 ', '')}</span>
                                    <span className="font-medium">{result.wordCount} words</span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                        <div>
                          <h5 className="font-semibold mb-2">Confidence Analysis</h5>
                          <div className="space-y-1">
                            {hmTestResults
                              .filter(r => r.status === 'success')
                              .sort((a, b) => b.confidence - a.confidence)
                              .map(result => {
                                const profile = hallucinationMitigationProfiles.find(p => p.id === result.profileId);
                                return (
                                  <div key={result.profileId} className="flex justify-between text-sm">
                                    <span>{profile?.name.replace('🔬 ', '').replace('🔄 ', '').replace('🔇 ', '').replace('📈 ', '').replace('🚫 ', '')}</span>
                                    <span className="font-medium">{(result.confidence * 100).toFixed(1)}%</span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};