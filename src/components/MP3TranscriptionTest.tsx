import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileAudio, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            MP3 Transcription Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Upload Audio File (MP3, WAV, etc.)
            </label>
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
              <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
                {result.text || 'No text transcribed'}
              </div>
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