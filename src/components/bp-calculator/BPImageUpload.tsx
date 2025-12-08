import { useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image, Upload, X, Camera } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface BPImageUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export const BPImageUpload = ({ file, onFileChange, disabled }: BPImageUploadProps) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileChange(acceptedFiles[0]);
    }
  }, [onFileChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Upload Letter or Image</CardTitle>
        </div>
        <CardDescription>
          Upload a scanned letter, PDF, or photo of handwritten BP readings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {file ? (
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {file.type.includes('pdf') ? (
                    <Upload className="h-6 w-6 text-primary" />
                  ) : (
                    <Image className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onFileChange(null)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors min-h-[200px] flex flex-col items-center justify-center ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="flex justify-center gap-4">
                <div className="p-3 bg-muted rounded-full">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="p-3 bg-muted rounded-full">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports images (PNG, JPG) and PDF files
                </p>
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          For handwritten readings, AI vision is used for improved accuracy
        </p>
      </CardContent>
    </Card>
  );
};
