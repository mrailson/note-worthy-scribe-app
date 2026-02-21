import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  FileAudio, 
  FileText, 
  Upload, 
  Loader2, 
  X, 
  Sparkles,
  Mic,
  ClipboardPaste,
  Check,
  CheckCircle2,
  History,
  Plus,
  Download
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { chunkWavFile, blobToBase64 } from '@/utils/wavChunker';
import { isLikelyHallucination } from '@/utils/whisperHallucinationPatterns';
import { cleanWhisperTranscript } from '@/lib/cleanWhisperTranscript';
import { detectMeetingBoundaries, type BoundaryReport } from '@/utils/detectMeetingBoundaries';

interface CreateMeetingTabProps {
  onComplete?: () => void;
  onClose?: () => void;
}

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  type: 'audio' | 'text' | 'document';
  status: 'pending' | 'transcribing' | 'done' | 'error';
  statusMessage?: string;
  transcript?: string;
  error?: string;
}

const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 
  'audio/ogg', 'audio/m4a', 'audio/mp4', 'audio/x-m4a'
];

const SUPPORTED_TEXT_TYPES = [
  'text/plain', 'text/csv', 'text/markdown',
  'application/json'
];

const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword' // .doc
];

export const CreateMeetingTab: React.FC<CreateMeetingTabProps> = ({
  onComplete,
  onClose
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [meetingTitle, setMeetingTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedMeetingId, setImportedMeetingId] = useState<string | null>(null);
  const [boundaryReport, setBoundaryReport] = useState<BoundaryReport | null>(null);

  const getFileType = (file: File): 'audio' | 'text' | 'document' | null => {
    if (SUPPORTED_AUDIO_TYPES.includes(file.type) || 
        file.name.match(/\.(mp3|wav|webm|ogg|m4a|mp4)$/i)) {
      return 'audio';
    }
    if (SUPPORTED_TEXT_TYPES.includes(file.type) || 
        file.name.match(/\.(txt|md|csv|json)$/i)) {
      return 'text';
    }
    if (SUPPORTED_DOCUMENT_TYPES.includes(file.type) || 
        file.name.match(/\.(pdf|docx|doc)$/i)) {
      return 'document';
    }
    return null;
  };

  const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit

  const updateFileStatus = useCallback((fileName: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev =>
      prev.map(f => f.name === fileName ? { ...f, ...updates } : f)
    );
  }, []);

  const transcribeAudioFile = async (file: File, onProgress: (msg: string) => void): Promise<string> => {
    // For large files, chunk client-side and transcribe each chunk individually
    if (file.size > MAX_WHISPER_SIZE) {
      onProgress('Preparing audio chunks…');
      console.log(`[CreateMeetingTab] File ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB - chunking client-side`);
      
      const chunks = await chunkWavFile(file, 4);
      const transcripts: string[] = [];
      let hallucinationCount = 0;
      
      for (const chunk of chunks) {
        onProgress(`Transcribing audio (chunk ${chunk.index + 1} of ${chunk.total})…`);
        console.log(`[CreateMeetingTab] Transcribing chunk ${chunk.index + 1}/${chunk.total}…`);
        const base64Chunk = await blobToBase64(chunk.blob);
        
        const { data, error } = await supabase.functions.invoke('speech-to-text', {
          body: {
            audio: base64Chunk,
            mimeType: 'audio/wav',
            fileName: `${file.name}_chunk${chunk.index}.wav`,
          }
        });
        
        if (error) throw new Error(`Chunk ${chunk.index + 1} failed: ${error.message}`);
        const chunkText = data?.text?.trim();
        if (chunkText) {
          const halCheck = isLikelyHallucination(chunkText, data?.confidence);
          if (halCheck.isHallucination) {
            console.warn(`⚠️ Chunk ${chunk.index + 1} rejected as hallucination: ${halCheck.reason}`);
            hallucinationCount++;
          } else {
            transcripts.push(chunkText);
          }
        }
      }
      
      onProgress('Cleaning transcript…');
      if (hallucinationCount > 0) console.log(`🧹 Filtered ${hallucinationCount}/${chunks.length} hallucinated chunks`);
      if (transcripts.length === 0) throw new Error('No usable transcript (all chunks were hallucinations)');
      const stitched = transcripts.join('\n');
      const cleanResult = cleanWhisperTranscript(stitched);
      return cleanResult.text || stitched;
    }
    
    // For smaller files, use base64 approach with Whisper
    onProgress('Transcribing audio…');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];
          
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: { audio: base64Audio }
          });
          
          if (error) throw error;
          if (!data?.text) throw new Error('No transcript returned');
          
          resolve(data.text);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const readTextFile = async (file: File): Promise<string> => {
    return file.text();
  };

  const extractDocumentText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          
          // Determine file type for the edge function
          let fileType: 'pdf' | 'word' = 'word';
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            fileType = 'pdf';
          }
          
          const { data, error } = await supabase.functions.invoke('extract-document-text', {
            body: { 
              dataUrl,
              fileName: file.name,
              fileType
            }
          });
          
          if (error) throw error;
          if (!data?.extractedText) throw new Error('No text extracted');
          
          resolve(data.extractedText);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (uploadedFile: UploadedFile, onProgress: (msg: string) => void): Promise<string> => {
    if (uploadedFile.type === 'audio') {
      onProgress('Uploading audio…');
      return transcribeAudioFile(uploadedFile.file, onProgress);
    } else if (uploadedFile.type === 'document') {
      onProgress('Extracting text from document…');
      return extractDocumentText(uploadedFile.file);
    } else {
      onProgress('Reading file…');
      return readTextFile(uploadedFile.file);
    }
  };

  const handleFilesAdded = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: UploadedFile[] = [];
    
    for (const file of fileArray) {
      const fileType = getFileType(file);
      if (fileType) {
        validFiles.push({
          file,
          name: file.name,
          size: file.size,
          type: fileType,
          status: 'pending'
        });
      } else {
        showToast.warning(`Unsupported file type: ${file.name}`, { section: 'meeting_manager' });
      }
    }
    
    if (validFiles.length === 0) return;

    // Sort by filename ascending for chronological order (filenames encode date/time)
    validFiles.sort((a, b) => a.name.localeCompare(b.name));
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
    setIsProcessing(true);
    
    // Process files sequentially in chronological order
    for (const uploadedFile of validFiles) {
      try {
        updateFileStatus(uploadedFile.name, { status: 'transcribing', statusMessage: 'Queued…' });
        
        const onProgress = (msg: string) => {
          updateFileStatus(uploadedFile.name, { statusMessage: msg });
        };
        
        const transcript = await processFile(uploadedFile, onProgress);
        const wordCount = transcript.split(/\s+/).filter(Boolean).length;
        
        updateFileStatus(uploadedFile.name, {
          status: 'done',
          transcript,
          statusMessage: `Done (${wordCount.toLocaleString()} words)`
        });
      } catch (error: any) {
        console.error('File processing error:', error);
        updateFileStatus(uploadedFile.name, {
          status: 'error',
          error: error.message,
          statusMessage: `Error: ${error.message}`
        });
      }
    }
    
    // After all files processed, run boundary detection
    const doneFiles = [...validFiles]
      .filter(f => f.status !== 'error')
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // We need to read back the latest state for transcripts
    setUploadedFiles(prev => {
      const completedTranscripts = prev
        .filter(f => f.status === 'done' && f.transcript)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      if (completedTranscripts.length >= 2) {
        const report = detectMeetingBoundaries(
          completedTranscripts.map(f => f.transcript!),
          completedTranscripts.map(f => f.name)
        );
        setBoundaryReport(report);
        if (report.hasBoundaries) {
          console.warn('🚧 Meeting boundary detected:', report.warning);
        }
      } else {
        setBoundaryReport(null);
      }
      
      return prev;
    });
    
    setIsProcessing(false);
  }, [updateFileStatus]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesAdded(files);
    }
    e.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFilesAdded(files);
    }
  }, [handleFilesAdded]);

  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const getCombinedTranscript = (): string => {
    const parts: string[] = [];
    
    // Add pasted text first
    if (pastedText.trim()) {
      parts.push(pastedText.trim());
    }
    
    // Add file transcripts sorted by filename for chronological order
    const sortedFiles = [...uploadedFiles]
      .filter(f => f.status === 'done' && f.transcript)
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const file of sortedFiles) {
      parts.push(file.transcript!);
    }
    
    return parts.join('\n\n');
  };

  const hasContent = pastedText.trim() || uploadedFiles.some(f => f.status === 'done');
  const hasPendingFiles = uploadedFiles.some(f => f.status === 'pending' || f.status === 'transcribing');

  const handleCreateMeeting = async () => {
    if (!user) {
      showToast.error('You must be logged in', { section: 'meeting_manager' });
      return;
    }
    
    const transcript = getCombinedTranscript();
    if (!transcript) {
      showToast.error('No content to create meeting from', { section: 'meeting_manager' });
      return;
    }
    
    setIsCreating(true);
    
    try {
      const title = meetingTitle.trim() || `Imported Meeting - ${new Date().toLocaleDateString('en-GB')}`;
      const wordCount = transcript.split(/\s+/).length;
      const estimatedMinutes = Math.max(1, Math.round(wordCount / 150)); // ~150 words per minute
      
      // Create meeting with transcript in both live and batch fields
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title,
          description: 'Meeting created from imported content',
          meeting_type: 'general',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + estimatedMinutes * 60000).toISOString(),
          duration_minutes: estimatedMinutes,
          status: 'completed',
          user_id: user.id,
          live_transcript_text: transcript,
          whisper_transcript_text: transcript
        })
        .select()
        .single();
      
      if (meetingError) throw meetingError;
      
      // Also save to meeting_transcripts table for compatibility
      await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meeting.id,
          content: transcript,
          confidence_score: 0.9,
          timestamp_seconds: 0
        });
      
      // Trigger notes generation in background
      supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { meetingId: meeting.id }
      }).catch(err => console.error('Note generation error:', err));
      
      // Show success panel instead of closing immediately
      setImportedMeetingId(meeting.id);
      setImportSuccess(true);
      
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      showToast.error(error.message || 'Failed to create meeting', { section: 'meeting_manager' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewInHistory = () => {
    onComplete?.();
    onClose?.();
    navigate('/?tab=history', { 
      state: { 
        scrollToMeetingId: importedMeetingId,
        viewNotes: importedMeetingId,
        openModal: true 
      } 
    });
  };

  const handleImportAnother = () => {
    setImportSuccess(false);
    setImportedMeetingId(null);
    setMeetingTitle('');
    setPastedText('');
    setUploadedFiles([]);
    setBoundaryReport(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Show success panel after successful import
  if (importSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            Meeting Created Successfully!
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your meeting has been imported and notes are being generated. 
            View it in Meeting History.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Button 
            className="flex-1"
            onClick={handleViewInHistory}
          >
            <History className="h-4 w-4 mr-2" />
            View in Meeting History
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleImportAnother}
          >
            <Plus className="h-4 w-4 mr-2" />
            Import Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 space-y-4 overflow-y-auto pb-2 min-h-0">

        {/* Drop Zone */}
        <Card
          className={cn(
            "border-2 border-dashed transition-colors cursor-pointer",
            isDragOver 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onPaste={async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            const files: File[] = [];
            for (const item of items) {
              if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
              }
            }
            
            if (files.length > 0) {
              e.preventDefault();
              handleFilesAdded(files);
            }
          }}
          tabIndex={0}
        >
          <CardContent className="py-6 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileAudio className="h-5 w-5" />
              <FileText className="h-5 w-5" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">Drop audio, text or document files here</p>
              <p className="text-xs text-muted-foreground">
                MP3, WAV, M4A, PDF, DOCX, TXT — or paste/click to browse
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-1">
              <Upload className="h-4 w-4 mr-2" />
              Choose Files
            </Button>
          </CardContent>
        </Card>
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".mp3,.wav,.webm,.ogg,.m4a,.txt,.md,.csv,.pdf,.docx,.doc"
          multiple
          onChange={handleFileSelect}
        />
        
        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <Label>Uploaded Files</Label>
            <div className="max-h-24 overflow-y-auto space-y-2">
              {uploadedFiles.map((file) => (
                <div 
                  key={file.name}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {file.type === 'audio' ? (
                      <Mic className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : file.type === 'document' ? (
                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'pending' && (
                      <Badge variant="secondary" className="text-xs">Queued</Badge>
                    )}
                    {file.status === 'transcribing' && (
                      <Badge variant="secondary" className="text-xs max-w-[200px]">
                        <Loader2 className="h-3 w-3 animate-spin mr-1 shrink-0" />
                        <span className="truncate">{file.statusMessage || 'Processing…'}</span>
                      </Badge>
                    )}
                    {file.status === 'done' && (
                      <Badge variant="default" className="text-xs bg-green-600 max-w-[200px]">
                        <Check className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{file.statusMessage || 'Done'}</span>
                      </Badge>
                    )}
                    {file.status === 'error' && (
                      <Badge variant="destructive" className="text-xs max-w-[200px]">
                        <span className="truncate">{file.statusMessage || 'Error'}</span>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.name);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Meeting Boundary Warning */}
        {boundaryReport?.hasBoundaries && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-md">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 text-sm mt-0.5">⚠️</span>
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Mixed meetings detected
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Some uploaded files appear to be from different meetings. Merging them into one transcript may produce unreliable results.
                </p>
                {boundaryReport.boundaries.map((b, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-500">
                    • Topic shift between file {b.fileIndex} and {b.fileIndex + 1} ({(b.similarity * 100).toFixed(0)}% overlap)
                    {b.keywordsBefore.length > 0 && (
                      <span> — before: <em>{b.keywordsBefore.slice(0, 3).join(', ')}</em></span>
                    )}
                    {b.keywordsAfter.length > 0 && (
                      <span> → after: <em>{b.keywordsAfter.slice(0, 3).join(', ')}</em></span>
                    )}
                  </p>
                ))}
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-1">
                  Consider removing unrelated files and importing them as a separate meeting.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-amber-600 hover:text-amber-800 shrink-0"
                onClick={() => setBoundaryReport(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Paste Transcript */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
            <Label>Or paste transcript text</Label>
          </div>
          <Textarea
            placeholder="Paste your meeting transcript or notes here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          {pastedText && (
            <p className="text-xs text-muted-foreground">
              {pastedText.split(/\s+/).filter(Boolean).length} words
            </p>
          )}
        </div>
        
        {/* Preview Combined Content */}
        {hasContent && (
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Content Preview</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={async () => {
                  const transcript = getCombinedTranscript();
                  if (!transcript) return;
                  const paragraphs = transcript
                    .split(/\n\n+/)
                    .map(p => p.trim())
                    .filter(p => p.length > 0)
                    .flatMap(p => {
                      if (p.length > 500) {
                        const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
                        const chunks: string[] = [];
                        let current = '';
                        sentences.forEach((s, i) => {
                          current += s;
                          if ((i + 1) % 4 === 0) { chunks.push(current.trim()); current = ''; }
                        });
                        if (current.trim()) chunks.push(current.trim());
                        return chunks;
                      }
                      return [p];
                    });
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
                  const sourceFiles = uploadedFiles.filter(f => f.status === 'done');
                  const fileNames = sourceFiles.map(f => f.name).join(', ') || 'Pasted text';
                  const totalSizeMB = sourceFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
                  const sourceCount = (pastedText.trim() ? 1 : 0) + sourceFiles.length;

                  const metaRows: { label: string; value: string }[] = [
                    { label: 'Date', value: dateStr },
                    { label: 'Time', value: timeStr },
                    { label: 'Title', value: meetingTitle || 'Untitled Meeting' },
                    { label: 'Source file(s)', value: fileNames },
                    ...(totalSizeMB > 0 ? [{ label: 'Total file size', value: `${totalSizeMB.toFixed(1)} MB` }] : []),
                    { label: 'Sources', value: `${sourceCount}` },
                    { label: 'Word count', value: `${wordCount.toLocaleString()}` },
                    { label: 'Character count', value: `${transcript.length.toLocaleString()}` },
                  ];

                  const doc = new Document({
                    sections: [{
                      properties: {},
                      children: [
                        new Paragraph({ children: [new TextRun({ text: meetingTitle || 'Meeting Transcript', bold: true, size: 32 })], heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }),
                        new Paragraph({ children: [new TextRun({ text: '', size: 12 })], spacing: { after: 80 } }),
                        // Metadata section
                        ...metaRows.map(row => new Paragraph({
                          children: [
                            new TextRun({ text: `${row.label}: `, bold: true, size: 20, color: '444444' }),
                            new TextRun({ text: row.value, size: 20, color: '666666' }),
                          ],
                          spacing: { after: 60 },
                        })),
                        // Divider
                        new Paragraph({ children: [new TextRun({ text: '─'.repeat(60), size: 16, color: 'CCCCCC' })], spacing: { before: 200, after: 200 } }),
                        // Transcript heading
                        new Paragraph({ children: [new TextRun({ text: 'Transcript', bold: true, size: 26 })], heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }),
                        // Transcript paragraphs
                        ...paragraphs.map(p => new Paragraph({ children: [new TextRun({ text: p, size: 22 })], spacing: { after: 200, line: 320 } })),
                      ],
                    }],
                  });
                  const blob = await Packer.toBlob(doc);
                  const safeTitle = (meetingTitle || 'transcript').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 50);
                  saveAs(blob, `${safeTitle}-${now.toISOString().slice(0, 10)}.docx`);
                  showToast.success('Transcript downloaded');
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Word
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {getCombinedTranscript().split(/\s+/).filter(Boolean).length} total words from{' '}
              {(pastedText.trim() ? 1 : 0) + uploadedFiles.filter(f => f.status === 'done').length} source(s)
            </p>
            <ScrollArea className="max-h-[400px] rounded border border-border/30 bg-background p-3">
              <div className="text-sm text-foreground/90 leading-relaxed space-y-3">
                {(() => {
                  const text = getCombinedTranscript();
                  const paragraphs = text
                    .split(/\n\n+/)
                    .map(p => p.trim())
                    .filter(p => p.length > 0)
                    .flatMap(p => {
                      if (p.length > 500) {
                        const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
                        const chunks: string[] = [];
                        let current = '';
                        sentences.forEach((s, i) => {
                          current += s;
                          if ((i + 1) % 4 === 0) { chunks.push(current.trim()); current = ''; }
                        });
                        if (current.trim()) chunks.push(current.trim());
                        return chunks;
                      }
                      return [p];
                    });
                  return paragraphs.map((p, i) => <p key={i}>{p}</p>);
                })()}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      
      {/* Sticky Footer with Create Button */}
      <div className="pt-2 pb-1 border-t border-border/50 bg-background shrink-0">
        <Button
          onClick={handleCreateMeeting}
          disabled={!hasContent || hasPendingFiles || isCreating}
          className="w-full"
          size="lg"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating Meeting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Create Meeting & Generate Notes
            </>
          )}
        </Button>
        
        {hasPendingFiles && (
          <p className="text-xs text-center text-amber-600 mt-2">
            Please wait for all files to finish processing
          </p>
        )}
      </div>
    </div>
  );
};
