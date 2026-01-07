import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileAudio, Loader2, Play, X } from 'lucide-react';
import { AudioFileList, AudioFileItem } from './AudioFileList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MultiAudioImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Invalid file format'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
      URL.revokeObjectURL(objectUrl);
    });
    audio.addEventListener('error', () => {
      resolve(0);
      URL.revokeObjectURL(objectUrl);
    });
  });
};

export const MultiAudioImport: React.FC<MultiAudioImportProps> = ({
  open,
  onOpenChange
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<AudioFileItem[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const isProcessing = isTranscribing || isCreatingMeeting;
  const hasCompletedTranscription = files.length > 0 && files.every(f => f.status === 'completed');
  const hasPendingFiles = files.some(f => f.status === 'pending');

  const handleFilesSelected = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', ''];
    const maxSize = 20 * 1024 * 1024; // 20MB

    const newFiles: AudioFileItem[] = [];
    
    for (const file of Array.from(selectedFiles)) {
      const hasValidType = allowedTypes.includes(file.type);
      const hasValidExtension = /\.(mp3|wav|m4a)$/i.test(file.name);
      
      if (!hasValidType && !hasValidExtension) {
        showToast.error(`${file.name}: Unsupported format. Use MP3, WAV, or M4A.`, { section: 'meeting_manager' });
        continue;
      }
      
      if (file.size > maxSize) {
        showToast.error(`${file.name}: File too large. Maximum 20MB.`, { section: 'meeting_manager' });
        continue;
      }

      const duration = await getAudioDuration(file);
      
      newFiles.push({
        id: generateId(),
        file,
        duration,
        status: 'pending'
      });
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      setCombinedTranscript('');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setCombinedTranscript('');
  }, []);

  const handleReorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      const [removed] = newFiles.splice(fromIndex, 1);
      newFiles.splice(toIndex, 0, removed);
      return newFiles;
    });
    setCombinedTranscript('');
  }, []);

  const handleTranscribeAll = async () => {
    if (files.length === 0) return;

    setIsTranscribing(true);
    setProgress(0);
    setCurrentFileIndex(0);
    setCombinedTranscript('');

    const transcripts: string[] = [];
    const updatedFiles = [...files];

    for (let i = 0; i < files.length; i++) {
      const fileItem = updatedFiles[i];
      setCurrentFileIndex(i);
      
      // Update status to transcribing
      updatedFiles[i] = { ...fileItem, status: 'transcribing' };
      setFiles([...updatedFiles]);

      try {
        const base64Audio = await convertToBase64(fileItem.file);
        
        const { data, error } = await supabase.functions.invoke('mp3-transcription', {
          body: {
            audio: base64Audio,
            filename: fileItem.file.name
          }
        });

        if (error) throw new Error(error.message);
        if (!data?.text) throw new Error('No transcription received');

        const transcript = data.text;
        transcripts.push(transcript);
        
        updatedFiles[i] = { 
          ...fileItem, 
          status: 'completed', 
          transcript 
        };
        setFiles([...updatedFiles]);

      } catch (err: any) {
        console.error(`Transcription error for ${fileItem.file.name}:`, err);
        updatedFiles[i] = { 
          ...fileItem, 
          status: 'error', 
          error: err.message || 'Transcription failed' 
        };
        setFiles([...updatedFiles]);
      }

      setProgress(((i + 1) / files.length) * 100);
    }

    // Combine transcripts with file markers if multiple files
    if (transcripts.length > 0) {
      if (transcripts.length === 1) {
        setCombinedTranscript(transcripts[0]);
      } else {
        const combined = transcripts.map((t, i) => {
          const fileName = updatedFiles[i].file.name.replace(/\.[^/.]+$/, '');
          return `[Part ${i + 1}: ${fileName}]\n\n${t}`;
        }).join('\n\n---\n\n');
        setCombinedTranscript(combined);
      }
    }

    setIsTranscribing(false);
    
    const successCount = updatedFiles.filter(f => f.status === 'completed').length;
    if (successCount === files.length) {
      showToast.success(`All ${successCount} file(s) transcribed successfully!`, { section: 'meeting_manager' });
    } else if (successCount > 0) {
      showToast.warning(`${successCount} of ${files.length} files transcribed`, { section: 'meeting_manager' });
    } else {
      showToast.error('All transcriptions failed', { section: 'meeting_manager' });
    }
  };

  const handleCreateMeeting = async () => {
    if (!combinedTranscript || !user) {
      showToast.error('Missing transcript or user', { section: 'meeting_manager' });
      return;
    }

    setIsCreatingMeeting(true);

    try {
      // Calculate total duration from all files
      const totalDuration = files.reduce((sum, f) => sum + (f.duration || 0), 0);
      const title = meetingTitle.trim() || `Imported Recording - ${new Date().toLocaleDateString('en-GB')}`;

      // Create meeting record
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title,
          description: meetingAgenda || `Meeting created from ${files.length} imported audio file(s)`,
          meeting_type: 'general',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + totalDuration * 1000).toISOString(),
          duration_minutes: Math.round(totalDuration / 60) || 1,
          status: 'completed',
          user_id: user.id
        })
        .select()
        .single();

      if (meetingError) throw new Error(`Failed to create meeting: ${meetingError.message}`);

      // Store transcript
      const { error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meeting.id,
          content: combinedTranscript,
          confidence_score: 0.85,
          timestamp_seconds: 0
        });

      if (transcriptError) {
        console.error('Error saving transcript:', transcriptError);
      }

      // Trigger note generation in background
      supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: combinedTranscript,
          meetingTitle: title,
          meetingDate: new Date().toISOString().split('T')[0],
          meetingTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          detailLevel: 'standard'
        }
      }).catch(err => console.error('Note generation error:', err));

      showToast.success('Meeting created successfully!', { section: 'meeting_manager' });
      
      // Reset and close
      setFiles([]);
      setCombinedTranscript('');
      setMeetingTitle('');
      setMeetingAgenda('');
      onOpenChange(false);
      
      // Navigate to meeting history
      navigate('/meetings');

    } catch (error: any) {
      console.error('Error creating meeting:', error);
      showToast.error(error.message || 'Failed to create meeting', { section: 'meeting_manager' });
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setCombinedTranscript('');
    setMeetingTitle('');
    setMeetingAgenda('');
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Import Audio Recording(s)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-6">
            <div className="py-4 space-y-6">
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragOver && "border-primary bg-primary/5",
                  !isDragOver && "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">
                  Drag & drop audio files here
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  MP3, WAV, M4A • Max 20MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/*"
                  multiple
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                  disabled={isProcessing}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
              </div>

              {/* File List */}
              <AudioFileList
                files={files}
                onRemove={handleRemoveFile}
                onReorder={handleReorderFiles}
                disabled={isProcessing}
              />

              {/* Progress */}
              {isTranscribing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Transcribing file {currentFileIndex + 1} of {files.length}...
                    </span>
                    <span className="text-muted-foreground">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Transcribe Button */}
              {hasPendingFiles && !isTranscribing && (
                <Button
                  onClick={handleTranscribeAll}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Transcribe {files.filter(f => f.status === 'pending').length} File(s)
                </Button>
              )}

              {/* Combined Transcript Preview */}
              {combinedTranscript && (
                <div className="space-y-4 border-t pt-4">
                  <div className="text-sm font-medium">Combined Transcript Preview</div>
                  <div className="bg-muted p-4 rounded-lg max-h-48 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
                    {combinedTranscript.substring(0, 1000)}
                    {combinedTranscript.length > 1000 && '...'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {combinedTranscript.split(' ').filter(w => w).length} words total
                  </div>
                </div>
              )}

              {/* Meeting Details */}
              {hasCompletedTranscription && (
                <div className="space-y-4 border-t pt-4">
                  <div className="text-sm font-medium">Meeting Details</div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="meeting-title">Meeting Title</Label>
                    <Input
                      id="meeting-title"
                      placeholder="e.g., Team Standup, Client Call..."
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meeting-agenda">Agenda / Notes (optional)</Label>
                    <Textarea
                      id="meeting-agenda"
                      placeholder="Brief description or agenda items..."
                      value={meetingAgenda}
                      onChange={(e) => setMeetingAgenda(e.target.value)}
                      disabled={isProcessing}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handleClearAll}
              disabled={isProcessing || files.length === 0}
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              
              {hasCompletedTranscription && (
                <Button
                  onClick={handleCreateMeeting}
                  disabled={isProcessing || !combinedTranscript}
                >
                  {isCreatingMeeting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FileAudio className="h-4 w-4 mr-2" />
                      Create Meeting
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
