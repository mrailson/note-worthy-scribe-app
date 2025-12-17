import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Camera, Image, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { BPCameraModal } from './BPCameraModal';

type InputMethod = 'paste' | 'upload' | 'camera';

interface BPInputOptionsProps {
  textValue: string;
  onTextChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export const BPInputOptions = ({ 
  textValue, 
  onTextChange, 
  files, 
  onFilesChange,
  disabled 
}: BPInputOptionsProps) => {
  const [selectedMethod, setSelectedMethod] = useState<InputMethod | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      onFilesChange([...files, ...Array.from(selectedFiles)]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [files, onFilesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFilesChange([...files, ...acceptedFiles]);
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: true,
    disabled
  });

  const handleMethodSelect = (method: InputMethod) => {
    if (method === 'camera') {
      setCameraOpen(true);
    } else {
      setSelectedMethod(method);
    }
  };

  const handleCameraCapture = useCallback((capturedFiles: File[]) => {
    console.log('[BPInputOptions] handleCameraCapture called with', capturedFiles.length, 'files');
    if (capturedFiles.length > 0) {
      onFilesChange([...files, ...capturedFiles]);
    }
    setCameraOpen(false);
    setSelectedMethod(null);
  }, [files, onFilesChange]);

  const handleClear = () => {
    onTextChange('');
    onFilesChange([]);
    setSelectedMethod(null);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  // If files are set (from camera or upload), show preview
  if (files.length > 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {files.length} File{files.length !== 1 ? 's' : ''} Ready
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={index}
                className="border border-border rounded-lg p-3 bg-muted/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-primary/10 rounded">
                    {file.type.includes('pdf') ? (
                      <Upload className="h-4 w-4 text-primary" />
                    ) : (
                      <Image className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  className="h-8 w-8"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCameraOpen(true)}
              disabled={disabled}
            >
              <Camera className="h-4 w-4 mr-1" />
              Add Photos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <Upload className="h-4 w-4 mr-1" />
              Add Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            AI vision will extract BP readings from {files.length > 1 ? 'all images' : 'this image'}
          </p>
        </CardContent>
        <BPCameraModal
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={handleCameraCapture}
        />
      </Card>
    );
  }

  // If text is entered, show text input
  if (textValue.trim() || selectedMethod === 'paste') {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Paste Email or Text</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
            >
              Change method
            </Button>
          </div>
          <CardDescription>
            Paste the entire email content or any text containing BP readings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={`Example formats accepted:
• 140/90
• BP: 140/90/72 (with pulse)
• Sys 140 Dia 90
• Mon: 142/88, Tue: 138/85
• Blood pressure reading: 140 over 90

Paste the full email content here...`}
            style={{ minHeight: '350px' }}
            className="font-mono text-sm resize-y"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-2">
            The system will automatically identify and extract BP readings from the text
          </p>
        </CardContent>
      </Card>
    );
  }

  // If upload method selected, show dropzone
  if (selectedMethod === 'upload') {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Upload File</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMethod(null)}
              disabled={disabled}
            >
              Change method
            </Button>
          </div>
          <CardDescription>
            Upload a scanned letter, PDF, or photo of handwritten BP readings
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="p-3 bg-muted rounded-full mx-auto w-fit">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop or click to select'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports images, PDF, TXT, Word, and Excel files
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: show three input method options
  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">How would you like to input BP readings?</CardTitle>
          <CardDescription>
            Choose the method that works best for your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Paste Text Option */}
            <button
              onClick={() => handleMethodSelect('paste')}
              disabled={disabled}
              className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Paste Text</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Paste email or typed BP readings
                </p>
              </div>
            </button>

            {/* Upload File Option */}
            <button
              onClick={() => handleMethodSelect('upload')}
              disabled={disabled}
              className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <Upload className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Upload File</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload image or PDF file
                </p>
              </div>
            </button>

            {/* Take Photo Option */}
            <button
              onClick={() => handleMethodSelect('camera')}
              disabled={disabled}
              className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <Camera className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Take Photo</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Capture with your camera
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <BPCameraModal
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleCameraCapture}
      />
    </>
  );
};
