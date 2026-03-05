import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { FileText, Image, Loader2, BookOpen, Users, Stethoscope, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateCleanAIResponseDocument } from '@/utils/cleanWordExport';
import { toast } from 'sonner';

export type QuickGuideAudience = 'all-staff' | 'non-clinical' | 'clinical';
export type QuickGuideOrientation = 'landscape' | 'portrait';

export interface QuickGuideOutput {
  type: 'word' | 'infographic';
  audience: QuickGuideAudience;
  generatedAt: string;
  fileName: string;
}

interface QuickGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyContent: string;
  policyTitle: string;
  policyId?: string;
  onGenerated?: (output: QuickGuideOutput) => void;
}

export const QuickGuideDialog: React.FC<QuickGuideDialogProps> = ({
  open,
  onOpenChange,
  policyContent,
  policyTitle,
  policyId,
  onGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<'word' | 'infographic' | null>(null);
  const [audience, setAudience] = useState<QuickGuideAudience>('all-staff');
  const [orientation, setOrientation] = useState<QuickGuideOrientation>('landscape');

  const audienceLabels: Record<QuickGuideAudience, string> = {
    'all-staff': 'All Staff',
    'non-clinical': 'Non-Clinical Staff',
    'clinical': 'Clinical Staff',
  };

  const generateQuickGuideText = async (): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke('analyse-policy-gaps', {
      body: { action: 'quick-guide', extracted_text: policyContent, audience },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to generate quick guide');
    return data.quick_guide;
  };

  const safeTitle = policyTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  const safeTitleUnderscore = safeTitle.replace(/\s+/g, '_');

  const handleWord = async () => {
    setIsGenerating(true);
    setGeneratingType('word');
    try {
      const guideText = await generateQuickGuideText();
      if (!guideText) return;

      const fileName = `Quick_Guide_${safeTitleUnderscore}_${audienceLabels[audience].replace(/\s+/g, '_')}.docx`;
      await generateCleanAIResponseDocument(
        guideText,
        `Quick Guide - ${safeTitle} (${audienceLabels[audience]})`,
        { footerNote: `For more details, see the Practice Policy on "${policyTitle}".` }
      );

      const output: QuickGuideOutput = {
        type: 'word',
        audience,
        generatedAt: new Date().toISOString(),
        fileName,
      };
      onGenerated?.(output);

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

      const isLandscape = orientation === 'landscape';
      const aspectRatio = isLandscape ? '16:9' : '3:4';
      const orientationLabel = isLandscape ? 'landscape (16:9)' : 'portrait (3:4)';

      const infographicPrompt = `Create a HIGH-QUALITY staff quick guide infographic for an NHS GP practice policy.
This is a ONE-PAGE ${orientationLabel} visual quick reference guide designed for staff notice boards, team meetings, and quick reference.

TARGET AUDIENCE: ${audienceLabels[audience]}

POLICY TITLE: ${policyTitle}

The infographic must present the following quick guide content in a clear, visually structured layout:

${guideText}

DESIGN REQUIREMENTS:
- ${orientationLabel.charAt(0).toUpperCase() + orientationLabel.slice(1)} orientation
- NHS-aligned colour palette (blues, teals, greens)
- Clean, professional layout with clear visual hierarchy
- Each section should be visually distinct (use cards, boxes, or colour-coded areas)
- Use icons/symbols for each section (clipboard for Purpose, people for Responsibilities, numbered steps for Process, etc.)
- British English throughout
- Readable at A3 poster size and on screen
- Title prominently displayed: "Quick Guide: ${policyTitle}"
- Subtitle: "For ${audienceLabels[audience]}"
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
      const fileName = `Quick_Guide_${safeTitleUnderscore}_${audienceLabels[audience].replace(/\s+/g, '_')}_${orientation}_Infographic.png`;
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      const output: QuickGuideOutput = {
        type: 'infographic',
        audience,
        generatedAt: new Date().toISOString(),
        fileName,
      };
      onGenerated?.(output);

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Quick Guide
          </DialogTitle>
          <DialogDescription>
            Generate a one-page staff quick guide for <strong>{policyTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Audience Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Target Audience</Label>
          <RadioGroup
            value={audience}
            onValueChange={(v) => setAudience(v as QuickGuideAudience)}
            className="grid grid-cols-3 gap-2"
          >
            <Label
              htmlFor="aud-non-clinical"
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 cursor-pointer transition-colors text-center ${
                audience === 'non-clinical' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="non-clinical" id="aud-non-clinical" className="sr-only" />
              <UserCog className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">Non-Clinical</span>
            </Label>

            <Label
              htmlFor="aud-all-staff"
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 cursor-pointer transition-colors text-center ${
                audience === 'all-staff' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="all-staff" id="aud-all-staff" className="sr-only" />
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">All Staff</span>
            </Label>

            <Label
              htmlFor="aud-clinical"
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 cursor-pointer transition-colors text-center ${
                audience === 'clinical' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="clinical" id="aud-clinical" className="sr-only" />
              <Stethoscope className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">Clinical</span>
            </Label>
          </RadioGroup>
        </div>

        {/* Orientation (for infographic) */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Infographic Orientation</Label>
          <RadioGroup
            value={orientation}
            onValueChange={(v) => setOrientation(v as QuickGuideOrientation)}
            className="flex gap-3"
          >
            <Label
              htmlFor="orient-landscape"
              className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 cursor-pointer transition-colors ${
                orientation === 'landscape' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="landscape" id="orient-landscape" className="sr-only" />
              <div className="w-6 h-4 border-2 border-current rounded-sm" />
              <span className="text-xs font-medium">Landscape</span>
            </Label>

            <Label
              htmlFor="orient-portrait"
              className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 cursor-pointer transition-colors ${
                orientation === 'portrait' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="portrait" id="orient-portrait" className="sr-only" />
              <div className="w-4 h-6 border-2 border-current rounded-sm" />
              <span className="text-xs font-medium">Portrait</span>
            </Label>
          </RadioGroup>
        </div>

        <Separator />

        {/* Format Selection */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-3 p-5 hover:border-primary hover:bg-primary/5"
            onClick={handleWord}
            disabled={isGenerating}
          >
            {generatingType === 'word' ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <FileText className="h-8 w-8 text-primary" />
            )}
            <div className="text-center">
              <p className="font-semibold text-sm">Word Document</p>
              <p className="text-xs text-muted-foreground mt-0.5">Editable .docx</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-3 p-5 hover:border-primary hover:bg-primary/5"
            onClick={handleInfographic}
            disabled={isGenerating}
          >
            {generatingType === 'infographic' ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <Image className="h-8 w-8 text-primary" />
            )}
            <div className="text-center">
              <p className="font-semibold text-sm">Infographic</p>
              <p className="text-xs text-muted-foreground mt-0.5">{orientation === 'landscape' ? 'Landscape' : 'Portrait'} poster</p>
            </div>
          </Button>
        </div>

        {isGenerating && (
          <p className="text-sm text-muted-foreground text-center">
            {generatingType === 'word'
              ? 'Generating quick guide and creating Word document…'
              : 'Generating quick guide and creating infographic — this may take up to 2 minutes…'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
