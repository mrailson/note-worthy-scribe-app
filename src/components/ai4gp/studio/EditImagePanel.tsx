import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload, 
  Sparkles, 
  X, 
  Download, 
  RefreshCw, 
  Save,
  ExternalLink,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratedImage } from '@/types/ai4gp';
import { Progress } from '@/components/ui/progress';

interface EditImagePanelProps {
  onQuickEdit: (imageContent: string, instructions: string) => Promise<GeneratedImage | null>;
  onSaveToGallery: (result: GeneratedImage) => Promise<string | null>;
  onGallerySaved?: () => void;
  isGenerating: boolean;
  progress: number;
}

export const EditImagePanel: React.FC<EditImagePanelProps> = ({
  onQuickEdit,
  onSaveToGallery,
  onGallerySaved,
  isGenerating,
  progress,
}) => {
  const [uploadedImage, setUploadedImage] = useState<{ content: string; name: string } | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  const [editResult, setEditResult] = useState<GeneratedImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedImageId, setSavedImageId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage({
          content: reader.result as string,
          name: file.name,
        });
        setEditResult(null);
        setSavedImageId(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    disabled: isGenerating,
  });

  const handleApplyChanges = async () => {
    if (!uploadedImage || !editInstructions.trim()) return;
    
    const result = await onQuickEdit(uploadedImage.content, editInstructions);
    if (result) {
      setEditResult(result);
      setSavedImageId(null);
    }
  };

  const handleEditAgain = () => {
    if (editResult) {
      setUploadedImage({
        content: editResult.url,
        name: 'Edited Image',
      });
      setEditResult(null);
      setEditInstructions('');
      setSavedImageId(null);
    }
  };

  const handleDownload = () => {
    if (!editResult?.url) return;
    const link = document.createElement('a');
    link.href = editResult.url;
    link.download = `edited-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenFullSize = () => {
    if (editResult?.url) {
      window.open(editResult.url, '_blank');
    }
  };

  const handleSave = async () => {
    if (!editResult) return;
    setIsSaving(true);
    const imageId = await onSaveToGallery(editResult);
    setIsSaving(false);
    if (imageId) {
      setSavedImageId(imageId);
      onGallerySaved?.();
    }
  };

  const handleClear = () => {
    setUploadedImage(null);
    setEditInstructions('');
    setEditResult(null);
    setSavedImageId(null);
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      {!uploadedImage && !editResult && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium">
                {isDragActive ? 'Drop your image here' : 'Upload an image to edit'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag & drop or click to browse • PNG, JPG, WebP
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Image Preview */}
      {uploadedImage && !editResult && (
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {uploadedImage.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                disabled={isGenerating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center max-h-[300px]">
              <img
                src={uploadedImage.content}
                alt="Uploaded image"
                className="max-w-full max-h-[300px] object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Instructions */}
      {uploadedImage && !editResult && (
        <div className="space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            What changes would you like?
          </label>
          <Textarea
            value={editInstructions}
            onChange={(e) => setEditInstructions(e.target.value)}
            placeholder="e.g., Add our practice phone number in the bottom right, change the background to blue, make it landscape format..."
            className="min-h-[100px] resize-none"
            disabled={isGenerating}
          />
        </div>
      )}

      {/* Generate Button / Progress */}
      {uploadedImage && !editResult && (
        <div className="space-y-3">
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Applying changes... {progress}%
              </p>
            </div>
          )}
          
          <Button
            onClick={handleApplyChanges}
            disabled={!editInstructions.trim() || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying Changes...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Apply Changes
              </>
            )}
          </Button>
        </div>
      )}

      {/* Result Display */}
      {editResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Edited Result
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
            >
              <Upload className="h-4 w-4 mr-2" />
              New Image
            </Button>
          </div>
          
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
                <img
                  src={editResult.url}
                  alt={editResult.alt || 'Edited image'}
                  className="max-w-full max-h-[400px] object-contain"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex-1 min-w-[120px]"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving || !!savedImageId}
              className="flex-1 min-w-[120px]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : savedImageId ? (
                <>✓ Saved</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save to Gallery
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleOpenFullSize}
              className="flex-1 min-w-[120px]"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Size
            </Button>
            
            <Button
              onClick={handleEditAgain}
              className="flex-1 min-w-[120px]"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Edit Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
