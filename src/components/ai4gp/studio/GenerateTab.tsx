import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Pencil, RefreshCw, Loader2, Sparkles, AlertCircle, Star, Check } from 'lucide-react';
import type { GeneratedImage } from '@/types/ai4gp';
import type { GenerationHistoryItem } from '@/types/imageStudio';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GenerateTabProps {
  isGenerating: boolean;
  progress: number;
  currentResult: GeneratedImage | null;
  history: GenerationHistoryItem[];
  error: string | null;
  onGenerate: () => void;
  onCancel: () => void;
  onEditResult: () => void;
  onSelectHistoryItem: (item: GenerationHistoryItem) => void;
  descriptionProvided: boolean;
  onSaveToGallery?: (result: GeneratedImage) => Promise<string | null>;
  onGallerySaved?: () => void;
}

export const GenerateTab: React.FC<GenerateTabProps> = ({
  isGenerating,
  progress,
  currentResult,
  history,
  error,
  onGenerate,
  onCancel,
  onEditResult,
  onSelectHistoryItem,
  descriptionProvided,
  onSaveToGallery,
  onGallerySaved,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [savedImageId, setSavedImageId] = useState<string | null>(null);
  const handleDownload = () => {
    if (!currentResult?.url) return;
    
    const link = document.createElement('a');
    link.href = currentResult.url;
    link.download = `image-studio-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenFullSize = () => {
    if (!currentResult?.url) return;
    
    // Create a new window with the image - handles base64 URLs properly
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Image - Full Size</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a1a; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${currentResult.url}" alt="${currentResult.alt || 'Generated image'}" />
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  const handleSaveToGallery = async () => {
    if (!currentResult || !onSaveToGallery) return;
    
    setIsSaving(true);
    try {
      const imageId = await onSaveToGallery(currentResult);
      if (imageId) {
        setSavedImageId(imageId);
        toast.success('Image saved to gallery');
        // Trigger gallery refresh
        onGallerySaved?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Reset saved state when currentResult changes
  React.useEffect(() => {
    setSavedImageId(null);
  }, [currentResult?.url]);

  return (
    <div className="space-y-6">
      {/* Generate Button */}
      <div className="text-center space-y-4">
        {!isGenerating ? (
          <Button 
            size="lg" 
            onClick={onGenerate}
            disabled={!descriptionProvided}
            className="w-full sm:w-auto px-8"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Generate Image
          </Button>
        ) : (
          <div className="space-y-3">
            <Button variant="outline" size="lg" onClick={onCancel}>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Cancel Generation
            </Button>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground">Generating your image...</p>
          </div>
        )}
        
        {!descriptionProvided && (
          <p className="text-sm text-muted-foreground">
            Please provide a description in the Context tab first.
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Generation Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Result */}
      {currentResult && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <img 
              src={currentResult.url} 
              alt={currentResult.alt}
              className="w-full max-h-[60vh] object-contain bg-muted cursor-pointer"
              onClick={handleOpenFullSize}
              title="Click to open full size"
            />
            <div className="p-4 flex flex-wrap gap-2">
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              {onSaveToGallery && (
                <Button 
                  variant={savedImageId ? "default" : "outline"} 
                  onClick={handleSaveToGallery}
                  disabled={isSaving || !!savedImageId}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : savedImageId ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Star className="h-4 w-4 mr-2" />
                  )}
                  {savedImageId ? 'Saved to Gallery' : 'Save to Gallery'}
                </Button>
              )}
              <Button variant="outline" onClick={handleOpenFullSize}>
                <Sparkles className="h-4 w-4 mr-2" />
                Open Full Size
              </Button>
              <Button variant="outline" onClick={onEditResult}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Further
              </Button>
              <Button variant="outline" onClick={onGenerate}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History - Show up to 20 items */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Recent Generations ({history.length})</h3>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {history.slice(0, 20).map((item) => (
              <Card 
                key={item.id} 
                className={cn(
                  "overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all group relative",
                  currentResult?.url === item.result.url && "ring-2 ring-primary"
                )}
                onClick={() => onSelectHistoryItem(item)}
              >
                <img 
                  src={item.result.url} 
                  alt={item.result.alt}
                  className="w-full h-16 sm:h-20 object-contain bg-muted"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium">View</span>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Click any image to view, download, or edit it
          </p>
        </div>
      )}
    </div>
  );
};
