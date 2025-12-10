import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Loader2, AlertCircle, Video } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMeetingImporter } from '@/hooks/useMeetingImporter';
import { parseTeamsTranscript, validateTranscript } from '@/utils/teamsTranscriptParser';
import { PostMeetingActionsModal } from '@/components/PostMeetingActionsModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TeamsTranscriptImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TeamsTranscriptImportModal: React.FC<TeamsTranscriptImportModalProps> = ({
  open,
  onOpenChange,
}) => {
  const isMobile = useIsMobile();
  const { importMeeting, isImporting, progress, currentStep } = useMeetingImporter();
  
  const [transcript, setTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Post-meeting modal state
  const [showPostMeeting, setShowPostMeeting] = useState(false);
  const [createdMeetingId, setCreatedMeetingId] = useState('');
  const [createdMeetingTitle, setCreatedMeetingTitle] = useState('');

  const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;

  const handleFileUpload = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTranscript(content);
      setError(null);
      
      // Auto-generate title from content
      const parsed = parseTeamsTranscript(content);
      if (!title) {
        setTitle(parsed.suggestedTitle);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept: {
      'text/vtt': ['.vtt'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleTranscriptChange = (value: string) => {
    setTranscript(value);
    setError(null);
    
    // Auto-generate title if not set and we have enough content
    if (!title && value.length > 100) {
      const parsed = parseTeamsTranscript(value);
      setTitle(parsed.suggestedTitle);
    }
  };

  const handleImport = async () => {
    // Validate
    const validation = validateTranscript(transcript);
    if (!validation.valid) {
      setError(validation.error || 'Invalid transcript');
      return;
    }

    try {
      const parsed = parseTeamsTranscript(transcript);
      const meetingTitle = title || parsed.suggestedTitle;
      
      const meetingId = await importMeeting({
        transcript: parsed.plainText,
        title: meetingTitle,
        attendees: parsed.speakers.map(name => ({ name })),
        source: 'text_import',
      });

      // Success - show post-meeting modal
      setCreatedMeetingId(meetingId);
      setCreatedMeetingTitle(meetingTitle);
      
      // Close import modal and show post-meeting actions
      onOpenChange(false);
      setShowPostMeeting(true);
      
      // Reset form
      setTranscript('');
      setTitle('');
      setError(null);
      
      toast.success('Teams transcript imported successfully');
    } catch (err) {
      console.error('Import failed:', err);
      setError('Failed to import transcript. Please try again.');
      toast.error('Import failed');
    }
  };

  const handleStartNewMeeting = () => {
    setShowPostMeeting(false);
  };

  const content = (
    <div className="space-y-4">
      {/* File Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop the transcript file here..."
            : "Drag & drop a Teams transcript (.vtt or .txt), or click to browse"}
        </p>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or paste transcript</span>
        </div>
      </div>

      {/* Transcript Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="transcript">Transcript Content</Label>
          {wordCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {wordCount.toLocaleString()} words
            </Badge>
          )}
        </div>
        <Textarea
          id="transcript"
          placeholder={`Paste your Teams transcript here...\n\nExample format:\nJohn Smith: Hello everyone, welcome to the meeting.\nJane Doe: Thanks for joining us today.`}
          value={transcript}
          onChange={(e) => handleTranscriptChange(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
        />
      </div>

      {/* Title Input */}
      <div className="space-y-2">
        <Label htmlFor="title">Meeting Title (optional)</Label>
        <Input
          id="title"
          placeholder="Auto-generated if left empty"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress */}
      {isImporting && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{currentStep}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Import Button */}
      <Button
        onClick={handleImport}
        disabled={isImporting || !transcript.trim()}
        className="w-full"
        size="lg"
      >
        {isImporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Import & Generate Notes
          </>
        )}
      </Button>
    </div>
  );

  // Use Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Load Teams Transcript
              </DrawerTitle>
              <DrawerDescription>
                Import a Microsoft Teams meeting transcript to generate Notewell notes
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-y-auto">
              {content}
            </div>
          </DrawerContent>
        </Drawer>
        
        <PostMeetingActionsModal
          isOpen={showPostMeeting}
          onOpenChange={setShowPostMeeting}
          meetingId={createdMeetingId}
          meetingTitle={createdMeetingTitle}
          meetingDuration="Imported"
          onStartNewMeeting={handleStartNewMeeting}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Load Teams Transcript
            </DialogTitle>
            <DialogDescription>
              Import a Microsoft Teams meeting transcript to generate Notewell notes
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
      
      <PostMeetingActionsModal
        isOpen={showPostMeeting}
        onOpenChange={setShowPostMeeting}
        meetingId={createdMeetingId}
        meetingTitle={createdMeetingTitle}
        meetingDuration="Imported"
        onStartNewMeeting={handleStartNewMeeting}
      />
    </>
  );
};
