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
  Check
} from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

  const transcribeAudioFile = async (file: File): Promise<string> => {
    // For large files, upload to storage first then use URL-based transcription
    if (file.size > MAX_WHISPER_SIZE) {
      console.log(`[CreateMeetingTab] File ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB - uploading to storage for AssemblyAI`);
      
      // Generate unique path for temporary upload
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileExt = file.name.split('.').pop() || 'mp3';
      const storagePath = `temp/${timestamp}-${randomId}.${fileExt}`;
      
      // Upload file directly to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('audio-imports')
        .upload(storagePath, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: false
        });
      
      if (uploadError) {
        console.error('[CreateMeetingTab] Storage upload failed:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }
      
      console.log('[CreateMeetingTab] File uploaded to storage, calling AssemblyAI...');
      
      // Call the URL-based transcription function
      const { data, error } = await supabase.functions.invoke('assemblyai-transcription-url', {
        body: { 
          storagePath,
          fileName: file.name
        }
      });
      
      if (error) throw error;
      if (!data?.text) throw new Error('No transcript returned from AssemblyAI');
      
      return data.text;
    }
    
    // For smaller files, use base64 approach with Whisper
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

  const processFile = async (uploadedFile: UploadedFile): Promise<string> => {
    if (uploadedFile.type === 'audio') {
      return transcribeAudioFile(uploadedFile.file);
    } else if (uploadedFile.type === 'document') {
      return extractDocumentText(uploadedFile.file);
    } else {
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
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
    setIsProcessing(true);
    
    // Process files sequentially
    for (const uploadedFile of validFiles) {
      try {
        setUploadedFiles(prev => 
          prev.map(f => f.name === uploadedFile.name ? { ...f, status: 'transcribing' } : f)
        );
        
        const transcript = await processFile(uploadedFile);
        
        setUploadedFiles(prev => 
          prev.map(f => f.name === uploadedFile.name 
            ? { ...f, status: 'done', transcript } 
            : f
          )
        );
      } catch (error: any) {
        console.error('File processing error:', error);
        setUploadedFiles(prev => 
          prev.map(f => f.name === uploadedFile.name 
            ? { ...f, status: 'error', error: error.message } 
            : f
          )
        );
      }
    }
    
    setIsProcessing(false);
  }, []);

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
    
    // Add file transcripts
    for (const file of uploadedFiles) {
      if (file.status === 'done' && file.transcript) {
        parts.push(file.transcript);
      }
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
      
      showToast.success('Meeting created! Generating notes...', { section: 'meeting_manager' });
      
      // Trigger notes generation in background
      supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { meetingId: meeting.id }
      }).catch(err => console.error('Note generation error:', err));
      
      // Close modal and navigate to home with Meeting History tab
      onComplete?.();
      onClose?.();
      navigate('/?tab=history');
      
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      showToast.error(error.message || 'Failed to create meeting', { section: 'meeting_manager' });
    } finally {
      setIsCreating(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    )}
                    {file.status === 'transcribing' && (
                      <Badge variant="secondary" className="text-xs">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Processing
                      </Badge>
                    )}
                    {file.status === 'done' && (
                      <Badge variant="default" className="text-xs bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Done
                      </Badge>
                    )}
                    {file.status === 'error' && (
                      <Badge variant="destructive" className="text-xs">Error</Badge>
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
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Content Preview</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {getCombinedTranscript().split(/\s+/).filter(Boolean).length} total words from{' '}
              {(pastedText.trim() ? 1 : 0) + uploadedFiles.filter(f => f.status === 'done').length} source(s)
            </p>
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
