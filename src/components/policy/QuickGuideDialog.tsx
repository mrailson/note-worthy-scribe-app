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
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, Loader2, BookOpen, Users, Stethoscope, UserCog, Heart, Download, ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateCleanAIResponseDocument } from '@/utils/cleanWordExport';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type QuickGuideAudience = 'all-staff' | 'non-clinical' | 'clinical' | 'patient';
export type QuickGuideOrientation = 'landscape' | 'portrait';

export interface SavedQuickGuide {
  id: string;
  type: 'word' | 'infographic';
  audience: QuickGuideAudience;
  fileName: string;
  storagePath: string;
  generatedAt: string;
}

export interface QuickGuideOutput {
  type: 'word' | 'infographic';
  audience: QuickGuideAudience;
  generatedAt: string;
  fileName: string;
  storagePath?: string;
}

interface QuickGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyContent: string;
  policyTitle: string;
  policyId?: string;
  logoUrl?: string | null;
  onGenerated?: (output: QuickGuideOutput) => void;
}

type ResultState =
  | { type: 'word'; text: string; fileName: string; output: QuickGuideOutput }
  | { type: 'infographic'; blobUrl: string; blob: Blob; fileName: string; output: QuickGuideOutput };

export const QuickGuideDialog: React.FC<QuickGuideDialogProps> = ({
  open,
  onOpenChange,
  policyContent,
  policyTitle,
  policyId,
  logoUrl,
  onGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<'word' | 'infographic' | null>(null);
  const [audience, setAudience] = useState<QuickGuideAudience>('all-staff');
  const [orientation, setOrientation] = useState<QuickGuideOrientation>('landscape');
  const [result, setResult] = useState<ResultState | null>(null);

  const audienceLabels: Record<QuickGuideAudience, string> = {
    'all-staff': 'All Staff',
    'non-clinical': 'Non-Clinical Staff',
    'clinical': 'Clinical Staff',
    'patient': 'Patient',
  };

  const fetchPracticeStaffNames = async (): Promise<{ names: string[]; practiceName: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { names: [], practiceName: '' };
      const { data: pd } = await supabase
        .from('practice_details')
        .select('lead_gp_name, practice_manager_name, caldicott_guardian, complaints_lead, dpo_name, fire_safety_officer, health_safety_lead, infection_control_lead, safeguarding_lead_adults, safeguarding_lead_children, senior_gp_partner, siro, practice_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!pd) return { names: [], practiceName: '' };
      const practiceName = (pd as any).practice_name || '';
      const names = Object.entries(pd)
        .filter(([key]) => key !== 'practice_name')
        .map(([, v]) => v)
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      return { names, practiceName };
    } catch {
      return { names: [], practiceName: '' };
    }
  };

  const uploadToStorage = async (content: string | Blob, fileName: string, type: 'word' | 'infographic'): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const userId = session.user.id;
      const timestamp = Date.now();
      const ext = type === 'word' ? 'md' : 'png';
      const storagePath = `${userId}/${policyId || 'unknown'}/${timestamp}_${type}.${ext}`;

      const fileContent = type === 'word'
        ? new Blob([content as string], { type: 'text/markdown' })
        : content as Blob;

      const { error } = await supabase.storage
        .from('quick-guides')
        .upload(storagePath, fileContent, { upsert: true });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }
      return storagePath;
    } catch (err) {
      console.error('Failed to upload quick guide to storage:', err);
      return null;
    }
  };

  const generateQuickGuideText = async (): Promise<string | null> => {
    const { names: staffNames, practiceName } = await fetchPracticeStaffNames();
    const { data, error } = await supabase.functions.invoke('analyse-policy-gaps', {
      body: { action: 'quick-guide', extracted_text: policyContent, audience, practice_staff_names: staffNames, practice_name: practiceName },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to generate quick guide');
    if (data.needs_manual_review) {
      toast.warning('Quick guide may need manual review — some staff name substitutions were detected and cleaned automatically.');
    }
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
      
      // Upload to storage
      const storagePath = await uploadToStorage(guideText, fileName, 'word');

      const output: QuickGuideOutput = {
        type: 'word',
        audience,
        generatedAt: new Date().toISOString(),
        fileName,
        storagePath: storagePath || undefined,
      };

      setResult({ type: 'word', text: guideText, fileName, output });
      onGenerated?.(output);
    } catch (err: any) {
      console.error('Quick guide Word error:', err);
      toast.error(err.message || 'Failed to generate quick guide');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  const handleDownloadWord = async () => {
    if (result?.type !== 'word') return;

    let reviewDateNote = '';
    if (policyId) {
      try {
        const { data: coverData } = await supabase
          .from('policy_completions')
          .select('metadata')
          .eq('id', policyId)
          .maybeSingle();
        const meta = coverData?.metadata as any;
        const reviewDate = meta?.review_date || meta?.next_review_date;
        if (reviewDate) {
          const formatted = new Date(reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          reviewDateNote = ` | Next review: ${formatted}`;
        }
      } catch { /* silently continue */ }
    }

    const persistedLogoPosition = (localStorage.getItem('policy_docx_logo_position') as 'left' | 'center' | 'right') || 'left';
    await generateCleanAIResponseDocument(
      result.text,
      `Quick Guide - ${safeTitle} (${audienceLabels[audience]})`,
      {
        footerNote: `For more details, see the Practice Policy on "${policyTitle}".${reviewDateNote}`,
        logoUrl: logoUrl || undefined,
        logoPosition: persistedLogoPosition,
      }
    );
    toast.success('Quick guide Word document downloaded');
  };

  const handleInfographic = async () => {
    setIsGenerating(true);
    setGeneratingType('infographic');
    try {
      const guideText = await generateQuickGuideText();
      if (!guideText) return;

      const isLandscape = orientation === 'landscape';
      const orientationLabel = isLandscape ? 'landscape (16:9)' : 'portrait (3:4)';
      const isPatient = audience === 'patient';
      const infographicType = isPatient ? 'patient information leaflet' : 'staff quick guide';
      const infographicDesignFor = isPatient ? 'waiting rooms, practice websites, and patient information displays' : 'staff notice boards, team meetings, and quick reference';
      const infographicTitle = isPatient ? `${policyTitle} – Information for Patients` : `Quick Guide: ${policyTitle}`;
      const infographicSubtitle = isPatient ? 'Patient Information' : `For ${audienceLabels[audience]}`;

      const infographicPrompt = `Create a HIGH-QUALITY ${infographicType} infographic for an NHS GP practice policy.
This is a ONE-PAGE ${orientationLabel} visual ${isPatient ? 'patient information leaflet' : 'quick reference guide'} designed for ${infographicDesignFor}.

TARGET AUDIENCE: ${audienceLabels[audience]}

POLICY TITLE: ${policyTitle}

The infographic must present the following content in a clear, visually structured layout:

${guideText}

DESIGN REQUIREMENTS:
- ${orientationLabel.charAt(0).toUpperCase() + orientationLabel.slice(1)} orientation
- NHS-aligned colour palette (blues, teals, greens)
- Clean, professional layout with clear visual hierarchy
- Each section should be visually distinct (use cards, boxes, or colour-coded areas)
- Use icons/symbols for each section
- British English throughout
- Readable at A3 poster size and on screen
- Title prominently displayed: "${infographicTitle}"
- Subtitle: "${infographicSubtitle}"
- Footer: "Powered by NoteWell AI"
- Maximum visual clarity — this must be readable in under 2 minutes
- Avoid walls of text — use bullet points, icons, and whitespace
${isPatient ? '- Use warm, reassuring visual tone appropriate for patients\n- Avoid clinical jargon in any visible text' : ''}
- Professional, NHS-appropriate tone`;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 180 seconds. Please try again.')), 180000);
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

      // Upload to storage
      const storagePath = await uploadToStorage(blob, fileName, 'infographic');

      const output: QuickGuideOutput = {
        type: 'infographic',
        audience,
        generatedAt: new Date().toISOString(),
        fileName,
        storagePath: storagePath || undefined,
      };

      setResult({ type: 'infographic', blobUrl, blob, fileName, output });
      onGenerated?.(output);
    } catch (err: any) {
      console.error('Quick guide infographic error:', err);
      toast.error(err.message || 'Failed to generate infographic');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  const handleDownloadInfographic = () => {
    if (result?.type !== 'infographic') return;
    const link = document.createElement('a');
    link.href = result.blobUrl;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Quick guide infographic downloaded');
  };

  const handleOpenFullSize = async () => {
    if (result?.type !== 'infographic') return;
    try {
      const resp = await fetch(result.blobUrl);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head><title>${result.fileName}</title>
              <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head>
              <body><img src="${dataUrl}" alt="Quick Guide Infographic" /></body>
            </html>
          `);
          newWindow.document.close();
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      window.open(result.blobUrl, '_blank');
    }
  };

  const handleBack = () => {
    if (result?.type === 'infographic') {
      URL.revokeObjectURL(result.blobUrl);
    }
    setResult(null);
  };

  const handleClose = (openState: boolean) => {
    if (!openState) {
      if (result?.type === 'infographic') {
        URL.revokeObjectURL(result.blobUrl);
      }
      setResult(null);
    }
    onOpenChange(openState);
  };

  // Result preview view
  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={result.type === 'infographic' ? 'sm:max-w-4xl max-h-[90vh]' : 'sm:max-w-3xl max-h-[90vh]'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result.type === 'word' ? (
                <FileText className="h-5 w-5 text-primary" />
              ) : (
                <Image className="h-5 w-5 text-primary" />
              )}
              Quick Guide — {result.type === 'word' ? 'Document Preview' : 'Infographic'}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{audienceLabels[audience]}</Badge>
              <span className="text-muted-foreground">•</span>
              <span>{policyTitle}</span>
            </DialogDescription>
          </DialogHeader>

          {result.type === 'word' ? (
            /* A4-style document preview */
            <ScrollArea className="max-h-[60vh]">
              <div className="flex justify-center px-2 py-4 bg-muted/30">
                <div className="w-full max-w-[680px] bg-white dark:bg-slate-50 shadow-[0_2px_20px_rgba(0,0,0,0.08)] rounded-sm border border-border/40">
                  {/* Document header bar */}
                  <div className="px-10 pt-8 pb-4 border-b border-blue-100">
                    <h1 className="text-[18px] font-bold text-[#005EB8] leading-tight mb-1">
                      Quick Guide: {policyTitle}
                    </h1>
                    <p className="text-[12px] text-[#6B7280]">
                      For {audienceLabels[audience]}
                    </p>
                  </div>
                  {/* Document body */}
                  <div className="px-10 py-6">
                    <div className="
                      prose prose-sm max-w-none
                      text-[#374151]
                      [&_h1]:text-[16px] [&_h1]:font-bold [&_h1]:text-[#2563EB] [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:uppercase [&_h1]:tracking-wide
                      [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:text-[#2563EB] [&_h2]:mt-4 [&_h2]:mb-2
                      [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-[#2563EB] [&_h3]:mt-3 [&_h3]:mb-1
                      [&_p]:text-[12px] [&_p]:leading-relaxed [&_p]:mb-2 [&_p]:text-[#374151]
                      [&_ul]:text-[12px] [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:space-y-0.5
                      [&_ol]:text-[12px] [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:space-y-0.5
                      [&_li]:text-[#374151] [&_li]:leading-relaxed
                      [&_strong]:text-[#1e3a5f]
                      [&_table]:text-[11px] [&_table]:w-full [&_table]:border-collapse
                      [&_th]:bg-[#2563EB] [&_th]:text-white [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold
                      [&_td]:border [&_td]:border-[#e5e7eb] [&_td]:px-2 [&_td]:py-1
                      [&_tr:nth-child(even)_td]:bg-[#f9fafb]
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.text}</ReactMarkdown>
                    </div>
                  </div>
                  {/* Document footer */}
                  <div className="px-10 py-3 border-t border-[#e5e7eb] bg-[#f8fafc]">
                    <p className="text-[10px] text-[#94a3b8] italic">
                      For more details, see the Practice Policy on "{policyTitle}". Generated by NoteWell AI.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex justify-center bg-muted/30 rounded-md overflow-hidden max-h-[60vh] p-4">
              <img
                src={result.blobUrl}
                alt="Quick Guide Infographic"
                className="max-h-[55vh] object-contain cursor-pointer rounded shadow-md"
                onClick={handleOpenFullSize}
                title="Click to open full size"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex-1" />
            {result.type === 'infographic' && (
              <Button variant="outline" size="sm" onClick={handleOpenFullSize}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Full Size
              </Button>
            )}
            <Button
              size="sm"
              onClick={result.type === 'word' ? handleDownloadWord : handleDownloadInfographic}
            >
              <Download className="h-4 w-4 mr-1" />
              Download {result.type === 'word' ? '.docx' : '.png'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={isGenerating ? undefined : handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Quick Guide
          </DialogTitle>
          <DialogDescription>
            Generate a one-page quick guide for <strong>{policyTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Audience Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Target Audience</Label>
          <RadioGroup
            value={audience}
            onValueChange={(v) => setAudience(v as QuickGuideAudience)}
            className="grid grid-cols-4 gap-2"
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

            <Label
              htmlFor="aud-patient"
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 cursor-pointer transition-colors text-center ${
                audience === 'patient' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="patient" id="aud-patient" className="sr-only" />
              <Heart className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">Patient</span>
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 px-1">
              <span className={`text-xs font-medium transition-colors ${orientation === 'landscape' ? 'text-foreground' : 'text-muted-foreground'}`}>Landscape</span>
              <Switch
                checked={orientation === 'portrait'}
                onCheckedChange={(checked) => setOrientation(checked ? 'portrait' : 'landscape')}
                className="scale-90"
              />
              <span className={`text-xs font-medium transition-colors ${orientation === 'portrait' ? 'text-foreground' : 'text-muted-foreground'}`}>Portrait</span>
            </div>
            <Button
              variant="outline"
              className="h-auto flex flex-col items-center gap-3 p-5 hover:border-primary hover:bg-primary/5 flex-1"
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
