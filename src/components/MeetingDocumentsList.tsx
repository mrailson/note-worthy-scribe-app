import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
  Upload,
  Plus,
  Video,
  Music,
  Presentation,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

// Constants
const MAX_FILE_SIZE_MB = 30;
const MAX_FILES_PER_MEETING = 20;

// Document type options
const DOCUMENT_TYPES = [
  { value: 'agenda', label: 'Meeting Agenda', icon: FileText },
  { value: 'presentation', label: 'Presentation/Slides', icon: Presentation },
  { value: 'action_log', label: 'Action Log', icon: FileType },
  { value: 'reference', label: 'Reference Document', icon: File },
  { value: 'recording', label: 'Audio/Video Recording', icon: Video },
  { value: 'transcript', label: 'Transcript (MS Teams, Zoom, etc.)', icon: FileText },
  { value: 'general', label: 'General Document', icon: File }
] as const;

interface MeetingDocument {
  id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path?: string;
  uploaded_at: string;
  uploaded_by?: string;
  description?: string;
  document_type?: string;
}

interface MeetingDocumentsListProps {
  meetingId: string;
  documents?: MeetingDocument[];
  onDocumentRemoved?: () => void;
  className?: string;
}

const getDocumentTypeLabel = (type: string | undefined) => {
  const typeMap: Record<string, string> = {
    agenda: 'Agenda',
    presentation: 'Presentation',
    action_log: 'Action Log',
    reference: 'Reference',
    recording: 'Recording',
    transcript: 'Transcript',
    general: 'Document'
  };
  return typeMap[type || 'general'] || 'Document';
};

const getDocumentTypeBadgeVariant = (type: string | undefined): "default" | "secondary" | "outline" => {
  switch (type) {
    case 'agenda':
    case 'presentation':
      return 'default';
    case 'recording':
    case 'transcript':
      return 'secondary';
    default:
      return 'outline';
  }
};

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
  const [selectedDocType, setSelectedDocType] = useState<string>('general');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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

  // Validate file upload limits
  const validateFileUpload = useCallback((newFiles: File[]) => {
    const totalAfterUpload = documents.length + newFiles.length;
    if (totalAfterUpload > MAX_FILES_PER_MEETING) {
      toast.error(`Maximum ${MAX_FILES_PER_MEETING} documents per meeting. You currently have ${documents.length}.`);
      return false;
    }
    
    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit`);
        return false;
      }
    }
    return true;
  }, [documents.length]);

  // Handle paste events for Ctrl+V
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    
    if (files.length > 0) {
      event.preventDefault();
      if (validateFileUpload(files)) {
        setSelectedFiles(prev => [...prev, ...files]);
        setUploadDialogOpen(true);
        toast.success(`Pasted ${files.length} file(s) from clipboard`);
      }
    }
  }, [validateFileUpload]);

  // Area drop zone for drag & drop directly onto the documents area
  const { getRootProps: getAreaDropProps, isDragActive: isAreaDragActive } = useDropzone({
    onDrop: (files) => {
      if (validateFileUpload(files)) {
        setSelectedFiles(files);
        setUploadDialogOpen(true);
      }
    },
    onDragEnter: () => setIsDraggingOver(true),
    onDragLeave: () => setIsDraggingOver(false),
    noClick: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.aac'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv']
    },
    maxSize: MAX_FILE_SIZE_MB * 1024 * 1024
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <Image className="h-4 w-4" />;
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4" />;
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet className="h-4 w-4" />;
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return <Presentation className="h-4 w-4" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileType className="h-4 w-4" />;
    if (fileType.includes('audio')) return <Music className="h-4 w-4" />;
    if (fileType.includes('video')) return <Video className="h-4 w-4" />;
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
        window.open(url, '_blank');
        toast.success('File opened successfully');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
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
      if (document.file_path) {
        const { error: storageError } = await supabase.storage
          .from('meeting-documents')
          .remove([document.file_path]);

        if (storageError) {
          console.warn('Storage deletion error:', storageError);
        }
      }

      const { error: dbError } = await supabase
        .from('meeting_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

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
    if (validateFileUpload(files)) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetUploadDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFiles([]);
    setUploadDescription('');
    setSelectedDocType('general');
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

        const { error: uploadError } = await supabase.storage
          .from('meeting-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data, error: dbError } = await supabase
          .from('meeting_documents')
          .insert({
            meeting_id: meetingId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_path: filePath,
            uploaded_by: user.id,
            description: uploadDescription || null,
            document_type: selectedDocType
          })
          .select()
          .single();

        if (dbError) throw dbError;
        return data;
      });

      const uploadedDocs = await Promise.all(uploadPromises);
      
      setDocuments(prev => [...uploadedDocs, ...prev]);
      
      toast.success(`${selectedFiles.length} document(s) uploaded successfully`);
      resetUploadDialog();
      onDocumentRemoved?.();
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  // Shared upload dialog content
  const UploadDialogContent = () => (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Upload Meeting Documents</DialogTitle>
        <DialogDescription>
          Add supporting documents such as agendas, presentations, action logs, or recordings.
          <br />
          <span className="text-xs">Maximum {MAX_FILE_SIZE_MB}MB per file, {MAX_FILES_PER_MEETING} files per meeting.</span>
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-6" onPaste={handlePaste} tabIndex={0}>
        {/* Document Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Document Type (optional)</Label>
          <RadioGroup
            value={selectedDocType}
            onValueChange={setSelectedDocType}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            {DOCUMENT_TYPES.map((type) => {
              const IconComponent = type.icon;
              return (
                <div key={type.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label 
                    htmlFor={type.value} 
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    {type.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {/* File Upload Area */}
        <div>
          <SimpleFileUpload
            onFileUpload={handleFileUpload}
            maxSize={MAX_FILE_SIZE_MB}
            multiple={true}
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Tip: You can also paste files directly with Ctrl+V
          </p>
        </div>
        
        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Selected Files ({selectedFiles.length})
              {documents.length > 0 && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({documents.length} of {MAX_FILES_PER_MEETING} already uploaded)
                </span>
              )}
            </Label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                  {getFileIcon(file.type)}
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => removeSelectedFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
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

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={resetUploadDialog}
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
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  // Empty state with drop zone
  if (!documents || documents.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div
            {...getAreaDropProps()}
            onPaste={handlePaste}
            tabIndex={0}
            className={`relative flex flex-col items-center justify-center py-8 px-4 text-center space-y-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
              isAreaDragActive ? 'bg-primary/10 border-2 border-dashed border-primary' : ''
            }`}
          >
            {isAreaDragActive && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10 flex items-center justify-center">
                <p className="text-primary font-medium">Drop files here to upload</p>
              </div>
            )}
            <div className="rounded-full bg-muted p-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">No Documents Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Upload supporting documents for this meeting such as agendas, presentations, reports, or reference materials.
              </p>
              <p className="text-xs text-muted-foreground">
                Drag & drop files here, paste with Ctrl+V, or click below
              </p>
            </div>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <UploadDialogContent />
            </Dialog>
            <p className="text-xs text-muted-foreground">
              PDF, Word, Excel, PowerPoint, Images, Audio, Video (max {MAX_FILE_SIZE_MB}MB)
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Documents list with drop zone
  return (
    <Card className={className}>
      <div
        {...getAreaDropProps()}
        onPaste={handlePaste}
        tabIndex={0}
        className={`relative focus:outline-none ${
          isAreaDragActive ? 'ring-2 ring-primary ring-inset' : ''
        }`}
      >
        {isAreaDragActive && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10 flex items-center justify-center">
            <p className="text-primary font-medium">Drop files here to upload</p>
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Meeting Documents ({documents.length}/{MAX_FILES_PER_MEETING})
            </CardTitle>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  disabled={documents.length >= MAX_FILES_PER_MEETING}
                >
                  <Plus className="h-4 w-4" />
                  Add Document
                </Button>
              </DialogTrigger>
              <UploadDialogContent />
            </Dialog>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Drag & drop files here or paste with Ctrl+V
          </p>
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
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDownload(document)}
                        className="font-medium text-sm truncate text-left hover:text-primary underline-offset-4 hover:underline cursor-pointer"
                        title="Click to open"
                        disabled={!document.file_path}
                      >
                        {document.file_name}
                      </button>
                      <Badge 
                        variant={getDocumentTypeBadgeVariant(document.document_type)} 
                        className="text-xs shrink-0"
                      >
                        {getDocumentTypeLabel(document.document_type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(document.file_size)}</span>
                      <span>•</span>
                      <span>
                        {new Date(document.uploaded_at).toLocaleDateString('en-GB')}
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
      </div>
    </Card>
  );
};
