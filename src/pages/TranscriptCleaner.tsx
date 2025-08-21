import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileAudio, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Deduplication class (same as before but optimized for testing)
class TranscriptDeduplicator {
  buffer: string[];
  processedText: string;
  similarityThreshold: number;
  maxBufferSize: number;
  minChunkLength: number;
  overlapThreshold: number;
  stats: {
    totalChunks: number;
    duplicatesRemoved: number;
    processedChunks: number;
  };

  constructor(options: any = {}) {
    this.buffer = [];
    this.processedText = "";
    this.similarityThreshold = options.similarityThreshold || 0.8;
    this.maxBufferSize = options.maxBufferSize || 10;
    this.minChunkLength = options.minChunkLength || 20;
    this.overlapThreshold = options.overlapThreshold || 0.6;
    this.stats = {
      totalChunks: 0,
      duplicatesRemoved: 0,
      processedChunks: 0
    };
  }

  processChunk(newChunk: string) {
    this.stats.totalChunks++;
    
    if (!newChunk || newChunk.trim().length < this.minChunkLength) {
      return null;
    }

    const cleanChunk = this.cleanText(newChunk);
    
    if (this.isDuplicate(cleanChunk)) {
      this.stats.duplicatesRemoved++;
      return null;
    }

    const deduplicatedChunk = this.removeOverlap(cleanChunk);
    
    if (deduplicatedChunk && deduplicatedChunk.trim().length > 0) {
      this.addToBuffer(deduplicatedChunk);
      this.processedText += (this.processedText ? " " : "") + deduplicatedChunk;
      this.stats.processedChunks++;
      return deduplicatedChunk;
    }

    return null;
  }

  cleanText(text: string) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim();
  }

  isDuplicate(chunk: string) {
    for (const bufferedChunk of this.buffer) {
      const similarity = this.calculateSimilarity(chunk.toLowerCase(), bufferedChunk.toLowerCase());
      if (similarity > this.similarityThreshold) {
        return true;
      }
    }
    
    return false;
  }

  calculateSimilarity(text1: string, text2: string) {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  removeOverlap(newChunk: string) {
    if (this.processedText.length === 0) {
      return newChunk;
    }

    const lastWords = this.getLastWords(this.processedText, 50);
    const newWords = newChunk.split(' ');
    
    let overlapIndex = 0;
    for (let i = 0; i < newWords.length; i++) {
      const testPhrase = newWords.slice(0, i + 1).join(' ');
      if (lastWords.toLowerCase().includes(testPhrase.toLowerCase())) {
        overlapIndex = i + 1;
      }
    }

    return newWords.slice(overlapIndex).join(' ');
  }

  getLastWords(text: string, n: number) {
    const words = text.split(' ');
    return words.slice(-n).join(' ');
  }

  addToBuffer(chunk: string) {
    this.buffer.push(chunk);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  getCleanTranscript() {
    return this.processedText.trim();
  }

  getStats() {
    return this.stats;
  }

  reset() {
    this.buffer = [];
    this.processedText = "";
    this.stats = {
      totalChunks: 0,
      duplicatesRemoved: 0,
      processedChunks: 0
    };
  }
}

export default function TranscriptCleaner() {
  const [rawTranscript, setRawTranscript] = useState('');
  const [cleanedTranscript, setCleanedTranscript] = useState('');
  const [processingLog, setProcessingLog] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState({
    similarityThreshold: 0.8,
    maxBufferSize: 10,
    minChunkLength: 20,
    overlapThreshold: 0.6
  });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Audio import states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Default messy transcript for testing
  const defaultTranscript = `We'll try to keep this to about half an hour if we can, though there are quite a few things to get through today. ...though there are quite a few things to get through today. First, just to check, does anyone have any urgent items to add to the agenda before we start? First, just to check, does anyone have any urgent items to add to the agenda before we start? No? Okay, great. Let's begin. No? Okay, great. Let's begin. So the first thing is patient list numbers. We've seen a small increase again this month. Around 120 new registrations. Mostly younger families... We've seen a small increase again this month, around 120 new registrations, mostly younger families and a few moving in from nearby practices.`;

  useEffect(() => {
    setRawTranscript(defaultTranscript);
  }, []);

  const processTranscript = () => {
    setIsProcessing(true);
    setProcessingLog([]);
    setCleanedTranscript('');
    
    const deduplicator = new TranscriptDeduplicator(settings);
    const log: any[] = [];
    
    // Split transcript into sentences to simulate chunks
    const sentences = rawTranscript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    sentences.forEach((sentence, index) => {
      const chunk = sentence.trim() + '.';
      const result = deduplicator.processChunk(chunk);
      
      log.push({
        index: index + 1,
        original: chunk,
        processed: result,
        action: result ? 'ADDED' : 'DUPLICATE/FILTERED'
      });
    });
    
    setTimeout(() => {
      setProcessingLog(log);
      setCleanedTranscript(deduplicator.getCleanTranscript());
      setStats(deduplicator.getStats());
      setIsProcessing(false);
    }, 500);
  };

  const loadSampleTranscript = () => {
    setRawTranscript(defaultTranscript);
  };

  const clearAll = () => {
    setRawTranscript('');
    setCleanedTranscript('');
    setProcessingLog([]);
    setStats(null);
    setAudioFile(null);
  };

  const handleAudioFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check file size (20MB limit)
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error('File size must be under 20MB');
        return;
      }
      
      // Check if it's an audio file
      if (selectedFile.type.startsWith('audio/') || 
          selectedFile.name.match(/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i)) {
        setAudioFile(selectedFile);
        toast.success(`Selected: ${selectedFile.name}`);
      } else {
        toast.error('Please select an audio file (MP3, WAV, M4A, etc.)');
      }
    }
  };

  const transcribeAudio = async () => {
    if (!audioFile) return;

    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const { data, error: supabaseError } = await supabase.functions.invoke('test-mp3-transcription', {
        body: formData,
      });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.text) {
        setRawTranscript(data.text);
        toast.success('Audio transcribed successfully! Text loaded into the editor.');
      } else {
        toast.error('No text was transcribed from the audio');
      }

    } catch (err) {
      console.error('Transcription error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to transcribe audio file');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-background min-h-screen">
      <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Transcript Deduplication Tester
        </h1>
        <p className="text-muted-foreground mb-4">
          Test the deduplication algorithm on messy transcripts to find optimal settings.
        </p>
      </div>

      {/* Settings Panel */}
      <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Algorithm Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Similarity Threshold
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={settings.similarityThreshold}
              onChange={(e) => setSettings({...settings, similarityThreshold: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Buffer Size
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.maxBufferSize}
              onChange={(e) => setSettings({...settings, maxBufferSize: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Min Chunk Length
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={settings.minChunkLength}
              onChange={(e) => setSettings({...settings, minChunkLength: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Overlap Threshold
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={settings.overlapThreshold}
              onChange={(e) => setSettings({...settings, overlapThreshold: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Audio Import Section */}
      <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border">
        <h2 className="text-xl font-semibold text-foreground mb-4">Import Audio File</h2>
        <p className="text-muted-foreground mb-4">
          Upload an audio file (up to 20MB) to transcribe it automatically and load the text for deduplication testing.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
                onChange={handleAudioFileSelect}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-border file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
              />
            </div>
            {audioFile && (
              <Button 
                onClick={transcribeAudio} 
                disabled={isTranscribing}
                className="min-w-[140px]"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <FileAudio className="mr-2 h-4 w-4" />
                    Transcribe Audio
                  </>
                )}
              </Button>
            )}
          </div>
          
          {audioFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <FileAudio className="h-4 w-4" />
              <span>
                Selected: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-foreground">Raw Transcript Input</h2>
          <div className="space-x-2">
            <Button
              onClick={loadSampleTranscript}
              variant="secondary"
              size="sm"
            >
              Load Sample
            </Button>
            <Button
              onClick={clearAll}
              variant="destructive"
              size="sm"
            >
              Clear All
            </Button>
          </div>
        </div>
        <textarea
          value={rawTranscript}
          onChange={(e) => setRawTranscript(e.target.value)}
          placeholder="Paste your messy transcript here or use the audio import above..."
          className="w-full h-40 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
        <Button
          onClick={processTranscript}
          disabled={!rawTranscript.trim() || isProcessing}
          className="mt-4"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Clean Transcript'
          )}
        </Button>
      </div>

      {/* Results Section */}
      {stats && (
        <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Processing Statistics</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted p-4 rounded-lg border">
              <div className="text-2xl font-bold text-primary">{stats.totalChunks}</div>
              <div className="text-sm text-muted-foreground">Total Chunks</div>
            </div>
            <div className="bg-muted p-4 rounded-lg border">
              <div className="text-2xl font-bold text-emerald-600">{stats.processedChunks}</div>
              <div className="text-sm text-muted-foreground">Processed Chunks</div>
            </div>
            <div className="bg-muted p-4 rounded-lg border">
              <div className="text-2xl font-bold text-red-600">{stats.duplicatesRemoved}</div>
              <div className="text-sm text-muted-foreground">Duplicates Removed</div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-muted rounded-lg border">
            <div className="text-sm text-muted-foreground">
              Efficiency: {stats.totalChunks > 0 ? Math.round((stats.duplicatesRemoved / stats.totalChunks) * 100) : 0}% duplicates removed
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cleaned Transcript */}
        <div className="bg-card rounded-lg shadow-lg p-6 border">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Cleaned Transcript</h2>
          <div className="bg-muted p-4 rounded-lg h-80 overflow-y-auto border">
            <pre className="whitespace-pre-wrap text-sm text-foreground">
              {cleanedTranscript || 'No cleaned transcript yet...'}
            </pre>
          </div>
        </div>

        {/* Processing Log */}
        <div className="bg-card rounded-lg shadow-lg p-6 border">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Processing Log</h2>
          <div className="h-80 overflow-y-auto space-y-2">
            {processingLog.map((entry, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                entry.action === 'ADDED' 
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                  : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              }`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm text-foreground">Chunk {entry.index}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    entry.action === 'ADDED' 
                      ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200' 
                      : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                  }`}>
                    {entry.action}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mb-1">
                  <strong>Original:</strong> {entry.original}
                </div>
                {entry.processed && (
                  <div className="text-sm text-foreground">
                    <strong>Processed:</strong> {entry.processed}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}