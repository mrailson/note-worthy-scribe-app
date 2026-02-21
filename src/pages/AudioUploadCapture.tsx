import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileAudio, Upload, CheckCircle2, AlertCircle, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ACCEPTED_AUDIO = '.mp3,.m4a,.wav,.aac,.ogg,.webm,.mp4';

const AudioUploadCapture: React.FC = () => {
  const { token, shortCode } = useParams<{ token?: string; shortCode?: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    validateSession();
  }, []);

  const validateSession = async () => {
    try {
      const body: Record<string, string> = { action: 'audio-import' };
      if (shortCode) body.shortCode = shortCode;
      else if (token) body.token = token;
      else {
        setErrorMsg('No session token provided');
        setValidating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('validate-ai-chat-capture-token', { body });

      if (error || !data?.valid) {
        setErrorMsg(data?.error || 'Invalid or expired session');
        setValid(false);
      } else {
        setValid(true);
        setSessionId(data.session_id);
      }
    } catch {
      setErrorMsg('Failed to validate session');
    } finally {
      setValidating(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    e.target.value = '';
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'audio-import');
      if (shortCode) formData.append('shortCode', shortCode);
      else if (token) formData.append('token', token!);

      setUploadProgress(30);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/upload-ai-chat-capture`,
        {
          method: 'POST',
          body: formData,
        }
      );

      setUploadProgress(80);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadProgress(100);
      setUploadedFiles(prev => [...prev, { name: file.name, size: file.size }]);

      // Reset progress after a moment
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Validating session…</p>
        </div>
      </div>
    );
  }

  // Invalid session
  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Session Invalid</h1>
          <p className="text-sm text-muted-foreground">{errorMsg || 'This upload link has expired or is no longer valid.'}</p>
          <p className="text-xs text-muted-foreground">Please scan a new QR code from NoteWell on your computer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <FileAudio className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Upload Audio</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Select audio files from your phone to send to NoteWell
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Upload button */}
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 flex flex-col gap-2"
          variant="outline"
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Tap to Select Audio File</span>
              <span className="text-xs text-muted-foreground">MP3, M4A, WAV, AAC, OGG, WebM</span>
            </>
          )}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_AUDIO}
          onChange={handleFileSelect}
        />

        {/* Progress bar */}
        {uploadProgress > 0 && (
          <div className="space-y-1">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {uploadProgress < 100 ? 'Uploading…' : 'Complete!'}
            </p>
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {uploadError}
            </p>
          </div>
        )}

        {/* Uploaded files list */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Uploaded ({uploadedFiles.length})
            </p>
            {uploadedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Another
            </Button>
          </div>
        )}
      </div>

      {/* Footer branding */}
      <div className="p-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <strong>NoteWell</strong>
        </p>
      </div>
    </div>
  );
};

export default AudioUploadCapture;
