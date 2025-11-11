import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Check } from 'lucide-react';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import { useFileUpload } from '@/hooks/useFileUpload';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';

interface RecordingContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  onContextSaved?: () => void;
  existingContext?: MeetingContext;
}

export interface MeetingContext {
  attendees?: string;
  agenda?: string;
  additional_notes?: string;
  uploaded_files?: Array<{ name: string; content: string }>;
  added_during_recording?: boolean;
  context_timestamp?: string;
}

export const RecordingContextDialog: React.FC<RecordingContextDialogProps> = ({
  open,
  onOpenChange,
  meetingId,
  onContextSaved,
  existingContext
}) => {
  const [attendees, setAttendees] = useState(existingContext?.attendees || '');
  const [agenda, setAgenda] = useState(existingContext?.agenda || '');
  const [additionalNotes, setAdditionalNotes] = useState(existingContext?.additional_notes || '');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string }>>(
    existingContext?.uploaded_files || []
  );
  const [isSaving, setIsSaving] = useState(false);

  const { processFiles, isProcessing } = useFileUpload();

  const handleFileUpload = async (files: File[]) => {
    try {
      const fileList = {
        length: files.length,
        item: (index: number) => files[index] || null,
        [Symbol.iterator]: function* () {
          for (let i = 0; i < files.length; i++) {
            yield files[i];
          }
        }
      } as FileList;
      
      const processedFiles = await processFiles(fileList);
      const newFiles = processedFiles.map(f => ({
        name: f.name,
        content: f.content
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('Error processing files:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const contextData: MeetingContext = {
        attendees: attendees.trim(),
        agenda: agenda.trim(),
        additional_notes: additionalNotes.trim(),
        uploaded_files: uploadedFiles,
        added_during_recording: true,
        context_timestamp: new Date().toISOString()
      };

      // Update meeting with context
      const { error } = await supabase
        .from('meetings')
        .update({ meeting_context: contextData as any })
        .eq('id', meetingId);

      if (error) throw error;

      showToast.success('Context saved successfully', { section: 'meeting_manager' });
      onContextSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving context:', error);
      showToast.error('Failed to save context');
    } finally {
      setIsSaving(false);
    }
  };

  const hasContent = attendees.trim() || agenda.trim() || additionalNotes.trim() || uploadedFiles.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Add Meeting Context (Optional)
          </DialogTitle>
          <DialogDescription>
            This information will be included in the transcript to help improve note generation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="attendees">Attendees</Label>
            <Textarea
              id="attendees"
              placeholder="e.g. Dr Smith, Practice Manager Jones, Nurse Wilson"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda">Agenda</Label>
            <Textarea
              id="agenda"
              placeholder="e.g. Budget review, staffing updates, patient feedback"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any other relevant information or context"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Upload Documents (Optional)</Label>
            <SimpleFileUpload
              onFileUpload={handleFileUpload}
              accept=".txt,.pdf,.docx,.doc,.png,.jpg,.jpeg"
              maxSize={20}
              multiple={true}
            />
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-600" />
                    {file.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isProcessing || !hasContent}>
            {isSaving ? 'Saving...' : 'Save Context'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
