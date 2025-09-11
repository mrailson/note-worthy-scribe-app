import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Image } from 'lucide-react';
import { toast } from 'sonner';

interface BackgroundImageUploaderProps {
  onImageUpload: (imageData: string) => void;
  onImageRemove: () => void;
  currentImage?: string;
}

export function BackgroundImageUploader({ 
  onImageUpload, 
  onImageRemove, 
  currentImage 
}: BackgroundImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file must be smaller than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        onImageUpload(result);
        toast.success('Background image uploaded successfully');
      };
      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to process image');
    } finally {
      setIsUploading(false);
    }
  }, [onImageUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Custom Background Image</h3>
        {currentImage && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onImageRemove}
            className="text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {currentImage ? (
        <Card className="relative">
          <CardContent className="p-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <img 
                src={currentImage} 
                alt="Background preview" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="text-white text-center">
                  <h4 className="text-xl font-bold mb-2">Sample Slide Title</h4>
                  <p className="text-sm opacity-90">Your content will appear over this background</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Background image preview with sample content overlay
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={`
                cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center space-y-2">
                {isUploading ? (
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    {isDragActive ? (
                      <Upload className="h-6 w-6 text-primary" />
                    ) : (
                      <Image className="h-6 w-6 text-primary" />
                    )}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {isUploading 
                      ? 'Processing image...'
                      : isDragActive 
                        ? 'Drop image here' 
                        : 'Upload background image'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {!isUploading && 'PNG, JPG, SVG up to 5MB. Recommended: 1920x1080 (16:9)'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>• For best results, use images with 16:9 aspect ratio (1920x1080)</p>
        <p>• Ensure sufficient contrast for text readability</p>
        <p>• Images will be optimized automatically for PowerPoint compatibility</p>
      </div>
    </div>
  );
}