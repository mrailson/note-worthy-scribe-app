import { useState } from 'react';
import { PowerPointGenerator } from '@/components/PowerPointGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Presentation, FileText, Sparkles, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { UploadedFile } from '@/types/ai4gp';

interface SlideDeckPanelProps {
  uploadedFiles: UploadedFile[];
}

const BRITISH_VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Male, Professional)' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum (Male, Warm)' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Female, Clear)' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice (Female, Friendly)' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda (Female, Articulate)' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will (Male, Confident)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Male, Authoritative)' },
];

const SLIDE_COUNT_OPTIONS = [
  { value: '6', label: '6 slides (Quick overview)' },
  { value: '10', label: '10 slides (Standard)' },
  { value: '15', label: '15 slides (Comprehensive)' },
];

export const SlideDeckPanel = ({ uploadedFiles }: SlideDeckPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [slideCount, setSlideCount] = useState('10');
  const [selectedVoice, setSelectedVoice] = useState(BRITISH_VOICES[0].id);

  const handleQuickGenerate = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload documents first');
      return;
    }

    setIsGenerating(true);
    try {
      // Extract topic from first document
      const firstDoc = uploadedFiles[0];
      const autoTopic = firstDoc.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

      // Generate presentation
      const { data, error } = await supabase.functions.invoke('generate-powerpoint', {
        body: {
          topic: autoTopic,
          presentationType: 'Executive Overview',
          slideCount: parseInt(slideCount),
          complexityLevel: 'intermediate',
          supportingFiles: uploadedFiles.map(file => ({
            name: file.name,
            content: file.content,
            type: file.type
          }))
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Executive overview generated successfully!');
        // Open the full generator to show preview
        setIsOpen(true);
      } else {
        throw new Error(data?.error || 'Failed to generate presentation');
      }
    } catch (error: any) {
      console.error('Error generating executive overview:', error);
      toast.error(error.message || 'Failed to generate executive overview');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            Create Executive Overview
          </CardTitle>
          <CardDescription>
            Generate professional PowerPoint presentations with AI-generated images from your documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {uploadedFiles.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No documents uploaded</p>
              <p className="text-sm text-muted-foreground">
                Please upload documents first to generate an executive overview
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Quick Executive Overview</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically generates slides with key insights, metrics, and AI-generated images from your {uploadedFiles.length} document{uploadedFiles.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="slideCount" className="text-xs">Slide Count</Label>
                      <Select value={slideCount} onValueChange={setSlideCount}>
                        <SelectTrigger id="slideCount" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SLIDE_COUNT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="voice" className="text-xs">Narration Voice</Label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger id="voice" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BRITISH_VOICES.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleQuickGenerate}
                    disabled={isGenerating}
                    size="lg"
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Generating Executive Overview...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate Executive Overview
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={() => setIsOpen(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Presentation className="h-5 w-5 mr-2" />
                  Advanced PowerPoint Generator
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PowerPointGenerator
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </div>
  );
};
