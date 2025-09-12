import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditMeetingModalProps {
  meeting: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeetingUpdated: () => void;
}

const MEETING_TYPES = [
  'Practice Management',
  'Partners Meeting',
  'LMC Meeting',
  'PCN Meeting',
  'HR Meeting',
  'Clinical Governance',
  'Quality Improvement',
  'Staff Meeting',
  'Training Session',
  'Board Meeting',
  'Other'
];

export const EditMeetingModal: React.FC<EditMeetingModalProps> = ({
  meeting,
  open,
  onOpenChange,
  onMeetingUpdated,
}) => {
  const [formData, setFormData] = useState({
    title: meeting?.title || '',
    meeting_type: meeting?.meeting_type || 'Practice Management',
    agenda: meeting?.agenda || '',
    participants: meeting?.participants?.join('\n') || '',
    description: meeting?.description || '',
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    name: string;
    size: number;
    type: string;
    path: string;
  }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setUploading(true);
    const newFiles = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${user.id}/meetings/${meeting.id}/${fileName}`;

        // Upload file to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meeting-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save document reference in database
        const { error: docError } = await supabase
          .from('meeting_documents')
          .insert({
            meeting_id: meeting.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
            description: 'Meeting agenda/presentation'
          });

        if (docError) throw docError;

        newFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          path: filePath,
        });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast({
        title: 'Files uploaded successfully',
        description: `${newFiles.length} file(s) uploaded to meeting.`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload files. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const updateData = {
        title: formData.title,
        meeting_type: formData.meeting_type,
        agenda: formData.agenda,
        description: formData.description,
        participants: formData.participants ? formData.participants.split('\n').filter(p => p.trim()) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meeting.id);

      if (error) throw error;

      toast({
        title: 'Meeting updated',
        description: 'Meeting details have been successfully updated.',
      });

      onMeetingUpdated();
      onOpenChange(false);

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: 'Failed to update meeting. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Meeting Details</DialogTitle>
          <DialogDescription>
            Update meeting information and upload supporting documents.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Meeting Details</TabsTrigger>
            <TabsTrigger value="documents">Documents & Files</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="details" className="space-y-4 overflow-hidden">
              <ScrollArea className="max-h-[400px] pr-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="title">Meeting Name</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Enter meeting name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="meeting_type">Meeting Type</Label>
                    <Select 
                      value={formData.meeting_type} 
                      onValueChange={(value) => handleInputChange('meeting_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {MEETING_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief meeting description"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="participants">Attendees (one per line)</Label>
                  <Textarea
                    id="participants"
                    value={formData.participants}
                    onChange={(e) => handleInputChange('participants', e.target.value)}
                    placeholder="John Smith&#10;Jane Doe&#10;Dr. Brown"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="agenda">Agenda/Notes</Label>
                  <Textarea
                    id="agenda"
                    value={formData.agenda}
                    onChange={(e) => handleInputChange('agenda', e.target.value)}
                    placeholder="Meeting agenda or additional context"
                    rows={6}
                  />
                </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 overflow-hidden">
              <ScrollArea className="max-h-[400px] pr-4">
                <div className="space-y-4">
              <div>
                <Label>Upload Documents</Label>
                <div className="mt-2">
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Click to upload agendas, presentations, or other documents
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, Word, PowerPoint, Excel, images supported
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    className="hidden"
                  />
                </div>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading files...
                </div>
              )}

              {uploadedFiles.length > 0 && (
                <div>
                  <Label>Uploaded Files</Label>
                  <div className="mt-2 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border rounded-md"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                <div>
                  <Label>Paste Content</Label>
                  <Textarea
                    placeholder="Paste agenda, attendee list, or other meeting context here..."
                    rows={8}
                    value={formData.agenda}
                    onChange={(e) => handleInputChange('agenda', e.target.value)}
                  />
                </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};