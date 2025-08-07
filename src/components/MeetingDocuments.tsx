import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FileText, Download, Trash2, Upload, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MeetingDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_at: string;
  uploaded_by: string;
}

interface MeetingDocumentsProps {
  meetingId: string;
  meetingTitle: string;
}

export const MeetingDocuments: React.FC<MeetingDocumentsProps> = ({
  meetingId,
  meetingTitle,
}) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<MeetingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadDescription, setUploadDescription] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [meetingId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_documents')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error.message);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (files: File[]) => {
    setSelectedFiles(files);
  };

  const uploadDocuments = async () => {
    if (!selectedFiles.length || !user) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        // Upload file to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${meetingId}/${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meeting-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save document metadata to database
        const { error: insertError } = await supabase
          .from('meeting_documents')
          .insert({
            meeting_id: meetingId,
            file_name: file.name,
            file_path: uploadData.path,
            file_type: file.type,
            file_size: file.size,
            description: uploadDescription.trim() || null,
            uploaded_by: user.id,
          });

        if (insertError) throw insertError;
      }

      toast.success(`${selectedFiles.length} document(s) uploaded successfully`);
      setSelectedFiles([]);
      setUploadDescription('');
      setUploadDialogOpen(false);
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading documents:', error.message);
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (doc: MeetingDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('meeting-documents')
        .download(doc.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error.message);
      toast.error('Failed to download document');
    }
  };

  const deleteDocument = async (docId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('meeting-documents')
        .remove([filePath]);

      if (storageError) {
        console.warn('Storage deletion warning:', storageError.message);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('meeting_documents')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      toast.success('Document deleted successfully');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error.message);
      toast.error('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Supporting Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading documents...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Supporting Documents
        </CardTitle>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Documents</DialogTitle>
              <DialogDescription>
                Add supporting documents for "{meetingTitle}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the documents..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label>Select Files</Label>
                <SimpleFileUpload
                  onFileUpload={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xlsx,.csv,.txt,.jpg,.jpeg,.png"
                  maxSize={25}
                  multiple={true}
                />
              </div>
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files:</Label>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      {file.name} ({formatFileSize(file.size)})
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setUploadDialogOpen(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={uploadDocuments}
                  disabled={selectedFiles.length === 0 || uploading}
                  className="flex items-center gap-2"
                >
                  {uploading ? (
                    <Upload className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No documents uploaded yet
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{doc.file_name}</div>
                    {doc.description && (
                      <div className="text-sm text-muted-foreground truncate">
                        {doc.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {formatDate(doc.uploaded_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadDocument(doc)}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{doc.file_name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDocument(doc.id, doc.file_path)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};