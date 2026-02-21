import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileAudio, Loader2, Play, X, FileText, Clipboard, CheckCircle2, Image } from 'lucide-react';
import { AudioFileList, AudioFileItem } from './AudioFileList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import mammoth from 'mammoth';
import { ImageProcessor } from '@/utils/fileProcessors/ImageProcessor';

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

// Parse Teams VTT transcript format
const parseTeamsTranscript = (content: string): string => {
  // Check if it's VTT format
  if (content.trim().startsWith('WEBVTT')) {
    const lines = content.split('\n');
    const textLines: string[] = [];
    let currentSpeaker = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip VTT header, timestamps, and empty lines
      if (line === 'WEBVTT' || line === '' || /^\d{2}:\d{2}/.test(line) || /^-->/.test(line)) {
        continue;
      }
      
      // Check for speaker format: "<v Speaker Name>text"
      const speakerMatch = line.match(/^<v\s+([^>]+)>(.*)$/);
      if (speakerMatch) {
        const speaker = speakerMatch[1];
        const text = speakerMatch[2].replace(/<\/v>$/, '').trim();
        
        if (speaker !== currentSpeaker) {
          currentSpeaker = speaker;
          if (text) {
            textLines.push(`\n${speaker}: ${text}`);
          }
        } else if (text) {
          textLines.push(text);
        }
      } else if (line && !line.match(/^\d+$/)) {
        // Regular text line (not a cue number)
        textLines.push(line);
      }
    }
    
    return textLines.join(' ').replace(/\s+/g, ' ').trim();
  }
  
  // Not VTT, return as-is
  return content;
};

// Read Word document
const readWordDocument = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

// Read text file
const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const MultiAudioImport: React.FC<MultiAudioImportProps> = ({
  open,
  onOpenChange
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  
  // Audio state
  const [files, setFiles] = useState<AudioFileItem[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Document state
  const [documentTranscript, setDocumentTranscript] = useState('');
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  
  // Paste state
  const [pastedTranscript, setPastedTranscript] = useState('');
  
  // Shared state
  const [activeTab, setActiveTab] = useState<string>('audio');
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);

  const isProcessing = isTranscribing || isCreatingMeeting || isProcessingDocument;
  const hasCompletedTranscription = combinedTranscript.length > 0;
  const hasPendingFiles = files.some(f => f.status === 'pending');

  // Audio file handling
  const handleFilesSelected = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', ''];

    const newFiles: AudioFileItem[] = [];
    
    for (const file of Array.from(selectedFiles)) {
      const hasValidType = allowedTypes.includes(file.type);
      const hasValidExtension = /\.(mp3|wav|m4a)$/i.test(file.name);
      
      if (!hasValidType && !hasValidExtension) {
        showToast.error(`${file.name}: Unsupported format. Use MP3, WAV, or M4A.`, { section: 'meeting_manager' });
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

  // Document and image file handling
  const handleDocumentSelected = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    setIsProcessingDocument(true);
    const allTranscripts: string[] = [];
    
    try {
      for (const file of Array.from(selectedFiles)) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        let content = '';
        
        // Text-based files
        if (extension === 'txt' || extension === 'vtt') {
          content = await readTextFile(file);
          if (extension === 'vtt') {
            content = parseTeamsTranscript(content);
          }
        } 
        // Word documents
        else if (extension === 'doc' || extension === 'docx') {
          content = await readWordDocument(file);
        }
        // Image files - use OCR
        else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(extension || '')) {
          showToast.info(`Extracting text from ${file.name}...`, { section: 'meeting_manager' });
          content = await ImageProcessor.processImage(file);
          
          // Check if OCR failed or found no text
          if (content.includes('OCR failed') || content.includes('No text found')) {
            showToast.warning(`${file.name}: ${content}`, { section: 'meeting_manager' });
            continue;
          }
        }
        else {
          showToast.error(`${file.name}: Unsupported format.`, { section: 'meeting_manager' });
          continue;
        }
        
        if (content.trim()) {
          allTranscripts.push(content.trim());
        }
      }
      
      if (allTranscripts.length > 0) {
        const combined = allTranscripts.join('\n\n---\n\n');
        setDocumentTranscript(combined);
        setCombinedTranscript(combined);
        showToast.success(`Loaded ${allTranscripts.length} file(s) successfully`, { section: 'meeting_manager' });
      }
    } catch (error: any) {
      console.error('Document processing error:', error);
      showToast.error(error.message || 'Failed to process file', { section: 'meeting_manager' });
    } finally {
      setIsProcessingDocument(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles.length) return;
    
    // Check first file to determine type
    const firstFile = droppedFiles[0];
    const extension = firstFile.name.split('.').pop()?.toLowerCase();
    
    if (['mp3', 'wav', 'm4a'].includes(extension || '')) {
      handleFilesSelected(droppedFiles);
      setActiveTab('audio');
    } else if (['txt', 'doc', 'docx', 'vtt', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(extension || '')) {
      handleDocumentSelected(droppedFiles);
      setActiveTab('document');
    } else {
      showToast.error('Unsupported file type', { section: 'meeting_manager' });
    }
  }, [handleFilesSelected, handleDocumentSelected]);

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
      
      updatedFiles[i] = { ...fileItem, status: 'transcribing' };
      setFiles([...updatedFiles]);

      try {
        const LARGE_FILE_THRESHOLD = 25 * 1024 * 1024; // 25MB
        let transcript: string;

        if (fileItem.file.size > LARGE_FILE_THRESHOLD) {
          // Large file: upload to Storage, then chunked transcription
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(7);
          const storagePath = `temp/${timestamp}-${randomId}.wav`;

          updatedFiles[i] = { ...fileItem, status: 'transcribing' };
          setFiles([...updatedFiles]);

          const { error: uploadError } = await supabase.storage
            .from('audio-imports')
            .upload(storagePath, fileItem.file, {
              contentType: fileItem.file.type || 'audio/wav',
              upsert: false
            });
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

          const { data, error } = await supabase.functions.invoke('speech-to-text', {
            body: {
              action: 'process-large-audio',
              storagePath,
              fileName: fileItem.file.name,
            }
          });
          if (error) throw new Error(error.message);
          if (!data?.text) throw new Error('No transcription received');
          transcript = data.text;
        } else {
          // Small file: base64 approach
          const base64Audio = await convertToBase64(fileItem.file);
          const { data, error } = await supabase.functions.invoke('mp3-transcription', {
            body: { audio: base64Audio, filename: fileItem.file.name }
          });
          if (error) throw new Error(error.message);
          if (!data?.text) throw new Error('No transcription received');
          transcript = data.text;
        }

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

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast.error('No text found in clipboard', { section: 'meeting_manager' });
        return;
      }
      
      // Check if it's VTT format and parse it
      const parsedText = parseTeamsTranscript(text);
      setPastedTranscript(parsedText);
      setCombinedTranscript(parsedText);
      showToast.success('Transcript pasted from clipboard', { section: 'meeting_manager' });
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      showToast.error('Failed to read clipboard. Please paste manually.', { section: 'meeting_manager' });
    }
  };

  const handlePastedTextChange = (text: string) => {
    setPastedTranscript(text);
    setCombinedTranscript(text);
  };

  const handleCreateMeeting = async () => {
    if (!combinedTranscript || !user) {
      showToast.error('Missing transcript or user', { section: 'meeting_manager' });
      return;
    }

    setIsCreatingMeeting(true);

    try {
      const totalDuration = files.reduce((sum, f) => sum + (f.duration || 0), 0);
      const title = meetingTitle.trim() || `Imported Content - ${new Date().toLocaleDateString('en-GB')}`;
      const source = activeTab === 'audio' ? 'audio import' : activeTab === 'document' ? 'document import' : 'pasted transcript';

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title,
          description: meetingAgenda || `Meeting created from ${source}`,
          meeting_type: 'general',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + Math.max(totalDuration * 1000, 60000)).toISOString(),
          duration_minutes: Math.round(totalDuration / 60) || 1,
          status: 'completed',
          user_id: user.id,
          live_transcript_text: combinedTranscript
        })
        .select()
        .single();

      if (meetingError) throw new Error(`Failed to create meeting: ${meetingError.message}`);

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
      handleClearAll();
      onOpenChange(false);
      
      navigate('/?tab=history');

    } catch (error: any) {
      console.error('Error creating meeting:', error);
      showToast.error(error.message || 'Failed to create meeting', { section: 'meeting_manager' });
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setDocumentTranscript('');
    setPastedTranscript('');
    setCombinedTranscript('');
    setMeetingTitle('');
    setMeetingAgenda('');
    setProgress(0);
  };

  const wordCount = combinedTranscript.split(/\s+/).filter(w => w.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Content
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-6">
            <div className="py-4 space-y-6">
              {/* Unified Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                  isDragOver && "border-primary bg-primary/5",
                  !isDragOver && "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-1">
                  Drag & drop files here
                </p>
                <p className="text-xs text-muted-foreground">
                  Audio (MP3, WAV, M4A) • Documents (TXT, DOC, DOCX, VTT) • Images (JPG, PNG)
                </p>
              </div>

              {/* Tab Interface */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="audio" className="flex items-center gap-2">
                    <FileAudio className="h-4 w-4" />
                    Audio
                  </TabsTrigger>
                  <TabsTrigger value="document" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="flex items-center gap-2">
                    <Clipboard className="h-4 w-4" />
                    Paste
                  </TabsTrigger>
                </TabsList>

                {/* Audio Tab */}
                <TabsContent value="audio" className="mt-4 space-y-4">
                  <div className="flex gap-2">
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
                      Choose Audio Files
                    </Button>
                    <span className="text-xs text-muted-foreground self-center">
                      MP3, WAV, M4A • Large files auto-chunked
                    </span>
                  </div>

                  <AudioFileList
                    files={files}
                    onRemove={handleRemoveFile}
                    onReorder={handleReorderFiles}
                    disabled={isProcessing}
                  />

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
                </TabsContent>

                {/* Document Tab */}
                <TabsContent value="document" className="mt-4 space-y-4">
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      handleDocumentSelected(e.dataTransfer.files);
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onPaste={async (e) => {
                      e.preventDefault();
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      
                      // Check for files (images)
                      const files: File[] = [];
                      for (const item of Array.from(items)) {
                        if (item.kind === 'file') {
                          const file = item.getAsFile();
                          if (file) files.push(file);
                        }
                      }
                      
                      if (files.length > 0) {
                        const dataTransfer = new DataTransfer();
                        files.forEach(f => dataTransfer.items.add(f));
                        handleDocumentSelected(dataTransfer.files);
                        return;
                      }
                      
                      // Check for text
                      const text = e.clipboardData?.getData('text');
                      if (text?.trim()) {
                        const parsedText = parseTeamsTranscript(text);
                        setDocumentTranscript(parsedText);
                        setCombinedTranscript(parsedText);
                        showToast.success('Text pasted successfully', { section: 'meeting_manager' });
                      }
                    }}
                    tabIndex={0}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      isDragOver && "border-primary bg-primary/5",
                      !isDragOver && "border-muted-foreground/25 hover:border-muted-foreground/50"
                    )}
                    onClick={() => docInputRef.current?.click()}
                  >
                    <input
                      ref={docInputRef}
                      type="file"
                      accept=".txt,.doc,.docx,.vtt,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                      multiple
                      onChange={(e) => handleDocumentSelected(e.target.files)}
                      className="hidden"
                      disabled={isProcessing}
                    />
                    <div className="flex justify-center gap-2 mb-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">
                      Drag & drop, click to browse, or paste (Ctrl+V)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      TXT, DOC, DOCX, VTT • Images with text (JPG, PNG) will be OCR processed
                    </p>
                  </div>

                  {isProcessingDocument && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </div>
                  )}

                  {documentTranscript && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Content loaded successfully
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Paste Tab */}
                <TabsContent value="paste" className="mt-4 space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handlePasteFromClipboard}
                      disabled={isProcessing}
                    >
                      <Clipboard className="h-4 w-4 mr-2" />
                      Paste from Clipboard
                    </Button>
                    <span className="text-xs text-muted-foreground self-center">
                      Supports Teams transcripts, VTT format, and plain text
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paste-transcript">Paste Transcript</Label>
                    <Textarea
                      id="paste-transcript"
                      placeholder="Paste your meeting transcript here... Supports Teams VTT format, speaker labels, and plain text."
                      value={pastedTranscript}
                      onChange={(e) => handlePastedTextChange(e.target.value)}
                      className="min-h-[200px] resize-vertical font-mono text-sm"
                      disabled={isProcessing}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Combined Transcript Preview */}
              {combinedTranscript && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Transcript Preview</div>
                    <div className="text-xs text-muted-foreground">
                      {wordCount.toLocaleString()} words • {combinedTranscript.length.toLocaleString()} characters
                    </div>
                  </div>
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      {combinedTranscript}
                    </div>
                  </ScrollArea>
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
              disabled={isProcessing || (!files.length && !documentTranscript && !pastedTranscript)}
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
                      <CheckCircle2 className="h-4 w-4 mr-2" />
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
