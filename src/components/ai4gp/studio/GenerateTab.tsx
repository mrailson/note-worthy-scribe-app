import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Pencil, RefreshCw, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import type { GeneratedImage } from '@/types/ai4gp';
import type { GenerationHistoryItem } from '@/types/imageStudio';
import { cn } from '@/lib/utils';

interface GenerateTabProps {
  isGenerating: boolean;
  progress: number;
  currentResult: GeneratedImage | null;
  history: GenerationHistoryItem[];
  error: string | null;
  onGenerate: () => void;
  onCancel: () => void;
  onEditResult: () => void;
  descriptionProvided: boolean;
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
  descriptionProvided,
}) => {
  const handleDownload = () => {
    if (!currentResult?.url) return;
    
    const link = document.createElement('a');
    link.href = currentResult.url;
    link.download = `image-studio-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              className="w-full max-h-[400px] object-contain bg-muted"
            />
            <div className="p-4 flex flex-wrap gap-2">
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
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

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Recent Generations</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {history.slice(0, 8).map((item) => (
              <Card key={item.id} className="overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all">
                <img 
                  src={item.result.url} 
                  alt={item.result.alt}
                  className="w-full h-20 object-cover"
                />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
