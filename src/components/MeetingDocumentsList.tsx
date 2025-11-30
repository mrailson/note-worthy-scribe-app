import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Trash2, 
  File, 
  Image, 
  FileSpreadsheet, 
  FileType,
  AlertCircle,
  Upload,
  Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MeetingDocument {
  id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path?: string;
  uploaded_at: string;
  uploaded_by?: string;
  description?: string;
}

interface MeetingDocumentsListProps {
  meetingId: string;
  documents?: MeetingDocument[];
  onDocumentRemoved?: () => void;
  className?: string;
}

export const MeetingDocumentsList: React.FC<MeetingDocumentsListProps> = ({
  meetingId,
  documents: initialDocuments,
  onDocumentRemoved,
  className = ""
}) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<MeetingDocument[]>(initialDocuments || []);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<MeetingDocument | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  // Fetch documents if not provided
  useEffect(() => {
    if (!initialDocuments) {
      fetchDocuments();
    }
  }, [meetingId, initialDocuments]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meeting_documents')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <Image className="h-4 w-4" />;
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4" />;
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet className="h-4 w-4" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileType className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (document: MeetingDocument) => {
    if (!document.file_path) {
      toast.error('File path not available for download');
      return;
    }
    
    try {
      const { data, error } = await supabase.storage
        .from('meeting-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      
      // Check if file should open in browser vs download
      const canOpenInBrowser = document.file_type && (
        document.file_type.startsWith('image/') ||
        document.file_type === 'application/pdf' ||
        document.file_type.startsWith('text/') ||
        document.file_type === 'application/json' ||
        document.file_type.includes('word') ||
        document.file_type.includes('document') ||
        document.file_type.includes('presentation') ||
        document.file_type.includes('powerpoint')
      );

      if (canOpenInBrowser) {
        // Open in new tab/window
        window.open(url, '_blank');
        toast.success('File opened successfully');
        // Clean up after a delay to ensure the file opens
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        // Force download for other file types
        const a = window.document.createElement('a');
        a.href = url;
        a.download = document.file_name;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('File downloaded successfully');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      toast.error('Failed to open file');
    }
  };

  const forceDownloadDocument = async (document: MeetingDocument) => {
    if (!document.file_path) {
      toast.error('File path not available for download');
      return;
    }
    
    try {
      const { data, error } = await supabase.storage
        .from('meeting-documents')
        .download(document.file_path);

      if (error) throw error;

      // Always force download
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleRemove = async (document: MeetingDocument) => {
    if (!document.id) {
      toast.error('Cannot remove document: ID not available');
      return;
    }

    setRemoving(document.id);
    try {
      // Delete from storage first (if file_path is available)
      if (document.file_path) {
        const { error: storageError } = await supabase.storage
          .from('meeting-documents')
          .remove([document.file_path]);

        if (storageError) {
          console.warn('Storage deletion error:', storageError);
          // Continue even if storage deletion fails
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('meeting_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== document.id));
      
      toast.success('Document removed successfully');
      setDocumentToDelete(null);
      onDocumentRemoved?.();
    } catch (error) {
      console.error('Error removing document:', error);
      toast.error('Failed to remove document');
    } finally {
      setRemoving(null);
    }
  };

  const handleFileUpload = (files: File[]) => {
    setSelectedFiles(files);
  };

  const uploadDocuments = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to upload documents');
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${meetingId}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('meeting-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save metadata to database
        const { data, error: dbError } = await supabase
          .from('meeting_documents')
          .insert({
            meeting_id: meetingId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_path: filePath,
            uploaded_by: user.id,
            description: uploadDescription || null
          })
          .select()
          .single();

        if (dbError) throw dbError;
        return data;
      });

      const uploadedDocs = await Promise.all(uploadPromises);
      
      // Update local state
      setDocuments(prev => [...uploadedDocs, ...prev]);
      
      toast.success(`${selectedFiles.length} document(s) uploaded successfully`);
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setUploadDescription('');
      onDocumentRemoved?.(); // Refresh parent count
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
            <div className="rounded-full bg-muted p-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">No Documents Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Upload supporting documents for this meeting such as agendas, presentations, reports, or reference materials.
              </p>
            </div>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Upload Meeting Document</DialogTitle>
                  <DialogDescription>
                    Add supporting documents to this meeting
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <SimpleFileUpload
                    onFileUpload={handleFileUpload}
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.ppt,.pptx"
                    maxSize={20}
                    multiple={true}
                  />
                  
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Selected Files</Label>
                      <div className="space-y-1">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Description (optional)
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Add a brief description of the document(s)..."
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadDialogOpen(false);
                        setSelectedFiles([]);
                        setUploadDescription('');
                      }}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={uploadDocuments}
                      disabled={selectedFiles.length === 0 || uploading}
                      className="gap-2"
                    >
                      {uploading && <div className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />}
                      {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground">
              Supported: PDF, Word, Excel, PowerPoint, Images, Text files
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Meeting Documents ({documents.length})
          </CardTitle>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Meeting Document</DialogTitle>
                <DialogDescription>
                  Add supporting documents to this meeting
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <SimpleFileUpload
                  onFileUpload={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.ppt,.pptx"
                  maxSize={20}
                  multiple={true}
                />
                
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Selected Files</Label>
                    <div className="space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{file.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description (optional)
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Add a brief description of the document(s)..."
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadDialogOpen(false);
                      setSelectedFiles([]);
                      setUploadDescription('');
                    }}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={uploadDocuments}
                    disabled={selectedFiles.length === 0 || uploading}
                    className="gap-2"
                  >
                    {uploading && <div className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />}
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {documents.map((document, index) => (
            <div
              key={document.id || `${document.file_name}-${index}`}
              className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-muted-foreground">
                  {getFileIcon(document.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <button 
                    onClick={() => handleDownload(document)}
                    className="font-medium text-sm truncate text-left hover:text-primary underline-offset-4 hover:underline cursor-pointer w-full"
                    title="Click to open (including Word/PowerPoint docs)"
                    disabled={!document.file_path}
                  >
                    {document.file_name}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(document.file_size)}</span>
                    <span>•</span>
                    <span>
                      {new Date(document.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                  {document.description && (
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {document.description}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => forceDownloadDocument(document)}
                  disabled={!document.file_path}
                  className="h-8 w-8 p-0"
                  title={document.file_path ? "Download file" : "Download not available"}
                >
                  <Download className="h-3 w-3" />
                </Button>
                {document.id && (
                  <AlertDialog open={documentToDelete?.id === document.id} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDocumentToDelete(document)}
                        disabled={removing === document.id}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Remove file"
                      >
                        {removing === document.id ? (
                          <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{document.file_name}"? 
                          This action cannot be undone and will permanently remove this document from the meeting.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemove(document)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};