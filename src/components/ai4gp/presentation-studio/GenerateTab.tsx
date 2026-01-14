import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Download, 
  Loader2, 
  AlertCircle, 
  ExternalLink,
  Clock,
  FileText,
  Volume2,
  RefreshCw,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type {
  PresentationStudioSettings,
  GenerationPhase,
  GeneratedPresentation,
  PresentationHistoryItem,
} from '@/types/presentationStudio';

interface GenerateTabProps {
  settings: PresentationStudioSettings;
  isGenerating: boolean;
  phase: GenerationPhase;
  progress: number;
  currentResult: GeneratedPresentation | null;
  history: PresentationHistoryItem[];
  error: string | null;
  onGenerate: () => void;
  onDownload: (withVoiceover?: boolean) => void;
  onCancel: () => void;
  onLoadHistory: (item: PresentationHistoryItem) => void;
}

const PHASE_LABELS: Record<GenerationPhase, string> = {
  'idle': 'Ready',
  'preparing': 'Preparing...',
  'analyzing-documents': 'Analysing documents...',
  'generating-content': 'Generating slide content...',
  'creating-slides': 'Creating slides...',
  'generating-images': 'Generating images...',
  'generating-audio': 'Generating voiceover...',
  'packaging': 'Packaging presentation...',
  'complete': 'Complete!',
  'error': 'Error',
};

export const GenerateTab: React.FC<GenerateTabProps> = ({
  settings,
  isGenerating,
  phase,
  progress,
  currentResult,
  history,
  error,
  onGenerate,
  onDownload,
  onCancel,
  onLoadHistory,
}) => {
  const enabledSlideTypes = settings.slideTypes.filter(st => st.enabled).length;
  const selectedDocs = settings.supportingDocuments.filter(d => d.selected).length;

  const canGenerate = (settings.topic.trim() || selectedDocs > 0) && !isGenerating;

  return (
    <div className="space-y-6">
      {/* Summary Panel */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium text-sm">Generation Summary</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{settings.slideCount} slides</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{settings.presentationType}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{enabledSlideTypes} slide types</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{selectedDocs} documents</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1 pt-1">
            {settings.includeSpeakerNotes && (
              <Badge variant="secondary" className="text-xs">Speaker Notes</Badge>
            )}
            {settings.generateImages && (
              <Badge variant="secondary" className="text-xs">AI Images</Badge>
            )}
            {settings.includeVoiceover && (
              <Badge variant="secondary" className="text-xs">
                <Volume2 className="h-3 w-3 mr-1" />
                Voiceover
              </Badge>
            )}
            {settings.includeBranding && (
              <Badge variant="secondary" className="text-xs">Branding</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Button / Progress */}
      {isGenerating ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="font-medium">{PHASE_LABELS[phase]}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              This may take a minute...
            </p>
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="w-full h-14 text-lg"
          size="lg"
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Generate Presentation
        </Button>
      )}

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
      {currentResult && !isGenerating && (
        <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{currentResult.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {currentResult.slideCount} slides • Generated {format(currentResult.generatedAt, 'HH:mm')}
                </p>
              </div>
              {currentResult.hasVoiceover && (
                <Badge variant="secondary">
                  <Volume2 className="h-3 w-3 mr-1" />
                  With Audio
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onDownload(false)} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download PPTX
              </Button>
              
              {currentResult.hasVoiceover && (
                <Button onClick={() => onDownload(true)} variant="outline" className="flex-1">
                  <Volume2 className="h-4 w-4 mr-2" />
                  With Voiceover
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="h-4 w-4" />
            <span>Recent Generations</span>
          </div>
          <ScrollArea className="h-[150px]">
            <div className="space-y-2 pr-4">
              {history.map((item) => (
                <Card 
                  key={item.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onLoadHistory(item)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{item.result.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(item.timestamp, 'dd MMM, HH:mm')}
                        <span>•</span>
                        <span>{item.result.slideCount} slides</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Load
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Help Text */}
      {!currentResult && !isGenerating && !error && (
        <p className="text-center text-sm text-muted-foreground">
          Configure your presentation settings, then click Generate to create your slides.
        </p>
      )}
    </div>
  );
};
