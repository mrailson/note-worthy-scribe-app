import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileAudio, Upload, Trash2, Loader2, Clipboard } from "lucide-react";
import { showToast } from "@/utils/toastWrapper";
import { supabase } from "@/integrations/supabase/client";

interface AudioImportProps {
  onTranscriptReady: (transcript: string) => void;
  disabled?: boolean;
}

export const AudioImport = ({ onTranscriptReady, disabled = false }: AudioImportProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true; // Reset on mount
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a)$/i)) {
      showToast.error("Please upload an audio file (MP3, WAV, or M4A)", { section: 'ai4gp' });
      return;
    }

    // Check file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      showToast.error("File too large. Maximum size is 20MB.", { section: 'ai4gp' });
      return;
    }

    setSelectedFile(file);
    setTranscriptionResult("");
    showToast.success(`Selected: ${file.name}`, { section: 'ai4gp' });

    // Reset input
    event.target.value = "";
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        
        reader.onload = () => {
          try {
            if (!isMountedRef.current) {
              reject(new Error('Component unmounted'));
              return;
            }
            
            const result = reader.result as string;
            if (!result) {
              reject(new Error('Failed to read file'));
              return;
            }
            
            // Remove the data URL prefix (e.g., "data:audio/mpeg;base64,")
            const base64 = result.split(',')[1];
            if (!base64) {
              reject(new Error('Invalid file format'));
              return;
            }
            
            resolve(base64);
          } catch (err) {
            reject(new Error(`File processing error: ${err.message}`));
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        
        reader.onabort = () => {
          reject(new Error('File reading was aborted'));
        };
        
        reader.readAsDataURL(file);
      } catch (err) {
        reject(new Error(`File reader setup failed: ${err.message}`));
      }
    });
  };

  const handleTranscribe = async () => {
    console.log('🎵 Transcribe button clicked!', { selectedFile: selectedFile?.name, isTranscribing });
    
    if (!selectedFile) {
      console.error('❌ No file selected');
      showToast.error("No file selected", { section: 'ai4gp' });
      return;
    }

    console.log('✅ Starting transcription process...');
    setIsTranscribing(true);
    setProgress(0);
    setProgressLabel("Preparing...");

    try {
      if (!isMountedRef.current) return;
      
      setProgressLabel("Converting audio file...");
      setProgress(10);
      showToast.info("Converting audio file...", { section: 'ai4gp' });

      // Convert file to base64 with better error handling
      const base64Audio = await convertToBase64(selectedFile);
      
      if (!isMountedRef.current) return;
      
      setProgress(30);
      setProgressLabel("Uploading...");

      // Simulate upload progress
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!isMountedRef.current) return;
      setProgress(60);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!isMountedRef.current) return;
      setProgress(90);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!isMountedRef.current) return;
      setProgress(100);
      setProgressLabel("Uploaded");
      showToast.success("File uploaded successfully", { section: 'ai4gp' });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isMountedRef.current) return;
      
      setProgressLabel("Transcribing...");
      showToast.info("Transcribing audio...", { section: 'ai4gp' });

      // Send to transcription edge function
      const { data, error } = await supabase.functions.invoke('mp3-transcription', {
        body: {
          audio: base64Audio,
          filename: selectedFile.name
        }
      });

      if (!isMountedRef.current) return;

      if (error) {
        console.error('Transcription error:', error);
        throw new Error(error.message || 'Transcription service error');
      }

      if (!data) {
        throw new Error('No response received from transcription service');
      }

      if (!data.text) {
        throw new Error('No transcription text received from service');
      }

      if (!isMountedRef.current) return;

      setProgressLabel("Complete");
      
      const transcript = data.text;
      setTranscriptionResult(transcript);
      
      // Pass transcript to parent component
      onTranscriptReady(transcript);
      
      showToast.success(`Transcription completed! (${Math.round(data.duration || 0)}s audio)`, { section: 'ai4gp' });
      
    } catch (error) {
      console.error('Transcription failed:', error);
      if (!isMountedRef.current) return;
      
      const errorMessage = error?.message || 'Unknown transcription error';
      showToast.error(`Transcription failed: ${errorMessage}`, { section: 'ai4gp' });
      setProgress(0);
      setProgressLabel("");
    } finally {
      if (isMountedRef.current) {
        setIsTranscribing(false);
      }
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setTranscriptionResult("");
    setProgress(0);
    setProgressLabel("");
    showToast.info("Audio file cleared", { section: 'ai4gp' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileAudio className="h-5 w-5" />
          Import Audio for Transcription
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Upload an audio file (MP3, WAV, M4A) to transcribe into text and generate consultation notes.
        </div>

        {/* File Upload */}
        <div className="space-y-3">
          <Label>Select Audio File (Max 20MB)</Label>
          
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <input
                type="file"
                accept=".mp3,.wav,.m4a,audio/*"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={disabled || isTranscribing}
              />
              <Button 
                variant="outline" 
                disabled={disabled || isTranscribing}
              >
                <Upload className="h-4 w-4 mr-1" />
                Choose Audio File
              </Button>
            </div>

            {selectedFile && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClear}
                disabled={disabled || isTranscribing}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* File Info */}
          {selectedFile && (
            <div className="bg-muted p-3 rounded-lg space-y-1">
              <div className="text-sm font-medium">{selectedFile.name}</div>
              <div className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        {isTranscribing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{progressLabel}</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Transcribe Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={handleTranscribe}
            disabled={disabled || !selectedFile || isTranscribing}
            className="px-6"
            size="lg"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <FileAudio className="h-4 w-4 mr-2" />
                Transcribe Audio
              </>
            )}
          </Button>
          {!selectedFile && !isTranscribing && (
            <div className="text-xs text-muted-foreground">
              Select an audio file to enable transcription.
            </div>
          )}
        </div>

        {/* Transcription Result Preview */}
        {transcriptionResult && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-medium">Transcription Result:</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(transcriptionResult);
                    showToast.success("Transcript copied to clipboard!", { section: 'ai4gp' });
                  }}
                >
                  <Clipboard className="h-3 w-3 mr-1" />
                  Copy Full Transcript
                </Button>
              </div>
            </div>
            <div className="text-base bg-muted p-6 rounded-lg overflow-y-auto leading-relaxed whitespace-pre-wrap" style={{ maxHeight: '60vh' }}>
              {transcriptionResult.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="text-sm text-muted-foreground mt-3">
              {transcriptionResult.split(' ').length} words • {transcriptionResult.length} characters
            </div>
          </div>
        )}

        {/* Sample Files Note */}
        <div className="border-t pt-4">
          <div className="text-xs text-muted-foreground">
            <strong>Supported formats:</strong> MP3, WAV, M4A<br/>
            <strong>Max file size:</strong> 20MB<br/>
            <strong>Note:</strong> Transcription may take 1-2 minutes depending on audio length.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};