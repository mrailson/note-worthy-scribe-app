import { useState } from 'react';
import { Upload, FileText, X, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';
import type { UploadedFile } from '@/types/ai4gp';

interface DocumentUploadPanelProps {
  uploadedFiles: UploadedFile[];
  onFilesUploaded: (files: UploadedFile[]) => void;
  onRemoveFile: (fileName: string) => void;
}

export const DocumentUploadPanel = ({ 
  uploadedFiles, 
  onFilesUploaded, 
  onRemoveFile 
}: DocumentUploadPanelProps) => {
  const { processFiles, isProcessing } = useFileUpload();
  const [isDragging, setIsDragging] = useState(false);
  const [directText, setDirectText] = useState('');
  const [textCounter, setTextCounter] = useState(1);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const processed = await processFiles(files);
      onFilesUploaded(processed);
      toast.success(`${processed.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('File upload error:', error);
    }

    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    try {
      const processed = await processFiles(files);
      onFilesUploaded(processed);
      toast.success(`${processed.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleAddDirectText = () => {
    if (!directText.trim()) {
      toast.error('Please enter some text first');
      return;
    }

    const textFile: UploadedFile = {
      name: `Direct Text Input ${textCounter}`,
      content: directText,
      type: 'text/plain',
      size: new Blob([directText]).size,
    };

    onFilesUploaded([textFile]);
    toast.success('Text added to source material');
    setDirectText('');
    setTextCounter(prev => prev + 1);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              Upload PDFs, Word documents, Excel files, or images to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              `}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processing your files...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-6">
                    <Upload className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Drag and drop your files here
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse
                    </p>
                    <label htmlFor="file-upload">
                      <Button asChild variant="outline">
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          Choose Files
                        </span>
                      </Button>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports: PDF, Word, Excel, Images, Text (max 15MB per file)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Text Directly</CardTitle>
            <CardDescription>
              Paste or type text content to include in your source material
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste or type your text here..."
              value={directText}
              onChange={(e) => setDirectText(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
            <Button 
              onClick={handleAddDirectText}
              disabled={!directText.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Text to Source Material
            </Button>
          </CardContent>
        </Card>
      </div>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files ({uploadedFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.type} • {formatFileSize(file.size || 0)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(file.name)}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
