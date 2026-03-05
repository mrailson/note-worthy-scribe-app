import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FileText, Image, Loader2, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateCleanAIResponseDocument } from '@/utils/cleanWordExport';
import { toast } from 'sonner';

interface QuickGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyContent: string;
  policyTitle: string;
}

export const QuickGuideDialog: React.FC<QuickGuideDialogProps> = ({
  open,
  onOpenChange,
  policyContent,
  policyTitle,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<'word' | 'infographic' | null>(null);

  const generateQuickGuideText = async (): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke('analyse-policy-gaps', {
      body: { action: 'quick-guide', extracted_text: policyContent },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to generate quick guide');
    return data.quick_guide;
  };

  const handleWord = async () => {
    setIsGenerating(true);
    setGeneratingType('word');
    try {
      const guideText = await generateQuickGuideText();
      if (!guideText) return;

      const safeTitle = policyTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      await generateCleanAIResponseDocument(guideText, `Quick Guide - ${safeTitle}`);
      toast.success('Quick guide Word document downloaded');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Quick guide Word error:', err);
      toast.error(err.message || 'Failed to generate quick guide');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  const handleInfographic = async () => {
    setIsGenerating(true);
    setGeneratingType('infographic');
    try {
      const guideText = await generateQuickGuideText();
      if (!guideText) return;

      const infographicPrompt = `Create a HIGH-QUALITY staff quick guide infographic for an NHS GP practice policy.
This is a ONE-PAGE landscape (16:9) visual quick reference guide designed for staff notice boards, team meetings, and quick reference.

POLICY TITLE: ${policyTitle}

The infographic must present the following quick guide content in a clear, visually structured layout:

${guideText}

DESIGN REQUIREMENTS:
- Landscape 16:9 orientation
- NHS-aligned colour palette (blues, teals, greens)
- Clean, professional layout with clear visual hierarchy
- Each section should be visually distinct (use cards, boxes, or colour-coded areas)
- Use icons/symbols for each section (clipboard for Purpose, people for Responsibilities, numbered steps for Process, etc.)
- British English throughout
- Readable at A3 poster size and on screen
- Title prominently displayed: "Quick Guide: ${policyTitle}"
- Footer: "Powered by NoteWell AI"
- Maximum visual clarity — this must be readable in under 2 minutes
- Avoid walls of text — use bullet points, icons, and whitespace
- Professional, NHS-appropriate tone`;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 120 seconds. Please try again.')), 120000);
      });

      const invokePromise = supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: infographicPrompt,
          conversationContext: '',
          documentContent: guideText,
          requestType: 'infographic',
          imageModel: 'google/gemini-3-pro-image-preview',
          practiceContext: { brandingLevel: 'none' },
        },
      });

      const { data: response, error: fnError } = await Promise.race([invokePromise, timeoutPromise]);

      if (fnError) throw new Error(fnError.message || 'Failed to generate infographic');

      const imageUrl = response?.image?.url;
      if (!imageUrl) throw new Error(response?.error || response?.textResponse || 'No image generated');

      // Convert to blob and download
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([byteArray], { type: 'image/png' });
      } else {
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) throw new Error('Failed to download infographic image');
        blob = await imgResponse.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      const safeTitle = policyTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Quick_Guide_${safeTitle}_Infographic.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      toast.success('Quick guide infographic downloaded');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Quick guide infographic error:', err);
      toast.error(err.message || 'Failed to generate infographic');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isGenerating ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Quick Guide
          </DialogTitle>
          <DialogDescription>
            Generate a one-page staff quick guide for <strong>{policyTitle}</strong>. Choose your preferred format:
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-3 p-6 hover:border-primary hover:bg-primary/5"
            onClick={handleWord}
            disabled={isGenerating}
          >
            {generatingType === 'word' ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
              <FileText className="h-10 w-10 text-blue-600" />
            )}
            <div className="text-center">
              <p className="font-semibold text-sm">Word Document</p>
              <p className="text-xs text-muted-foreground mt-1">Editable .docx format</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-3 p-6 hover:border-primary hover:bg-primary/5"
            onClick={handleInfographic}
            disabled={isGenerating}
          >
            {generatingType === 'infographic' ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
              <Image className="h-10 w-10 text-teal-600" />
            )}
            <div className="text-center">
              <p className="font-semibold text-sm">Infographic</p>
              <p className="text-xs text-muted-foreground mt-1">Landscape poster image</p>
            </div>
          </Button>
        </div>

        {isGenerating && (
          <p className="text-sm text-muted-foreground text-center">
            {generatingType === 'word' ? 'Generating quick guide and creating Word document…' : 'Generating quick guide and creating infographic — this may take up to 2 minutes…'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
