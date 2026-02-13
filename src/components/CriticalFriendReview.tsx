import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ChevronDown, Info, RefreshCw, UserCheck, Plus, Minus, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CriticalFriendReviewProps {
  complaintId: string;
  disabled?: boolean;
}

export function CriticalFriendReview({ complaintId, disabled = false }: CriticalFriendReviewProps) {
  const [review, setReview] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [includeValueJudgements, setIncludeValueJudgements] = useState(true);
  const reviewContentRef = useRef<HTMLDivElement>(null);

  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 24;

  useEffect(() => {
    fetchExistingReview();
  }, [complaintId]);

  const fetchExistingReview = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_findings')
        .select('critical_friend_review, critical_friend_review_generated_at')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.critical_friend_review) {
        setReview(data.critical_friend_review);
        setGeneratedAt(data.critical_friend_review_generated_at);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error fetching critical friend review:', error);
    }
  };

  const generateReview = async () => {
    setIsGenerating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await supabase.functions.invoke('ai-investigation-assistant', {
        body: {
          complaint_id: complaintId,
          request_type: 'critical_friend_review',
          include_value_judgements: includeValueJudgements
        }
      });

      if (error) throw error;

      if (data?.success && data?.content) {
        setReview(data.content);
        const now = new Date().toISOString();
        setGeneratedAt(now);
        
        // Check if a findings row exists
        const { data: existing } = await supabase
          .from('complaint_investigation_findings')
          .select('id')
          .eq('complaint_id', complaintId)
          .limit(1)
          .maybeSingle();

        let saveError;
        if (existing) {
          const { error: updateError } = await supabase
            .from('complaint_investigation_findings')
            .update({
              critical_friend_review: data.content,
              critical_friend_review_generated_at: now
            })
            .eq('complaint_id', complaintId);
          saveError = updateError;
        } else {
          const { error: insertError } = await supabase
            .from('complaint_investigation_findings')
            .insert({
              complaint_id: complaintId,
              critical_friend_review: data.content,
              critical_friend_review_generated_at: now,
              investigated_by: userId || 'unknown',
              investigation_summary: 'Auto-created for Critical Friend review',
              findings_text: 'Pending investigation findings'
            });
          saveError = insertError;
        }

        if (saveError) {
          console.error('Error saving critical friend review:', saveError);
          toast.error('Review generated but failed to save');
        } else {
          toast.success('Critical Friend review generated successfully');
        }
        
        setIsOpen(true);
      } else {
        throw new Error(data?.error || 'Failed to generate review');
      }
    } catch (error) {
      console.error('Error generating critical friend review:', error);
      toast.error('Failed to generate Critical Friend review. Please ensure investigation findings have been saved first.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAsWord = () => {
    if (!review) return;

    // Convert markdown to clean paragraphs for Word — strip bullets, add spacing
    const cleanForWord = (markdown: string): string => {
      const lines = markdown.split('\n');
      const htmlParts: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          htmlParts.push('<p style="margin:0; line-height:1.6;">&nbsp;</p>');
          continue;
        }

        // Skip horizontal rules (*** or ---)
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
          continue;
        }

        // Headings
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2].replace(/\*{1,2}([^*]+)\*{1,2}/g, '<strong>$1</strong>');
          const sizes: Record<number, string> = { 1: '18pt', 2: '15pt', 3: '13pt', 4: '12pt', 5: '11pt', 6: '11pt' };
          htmlParts.push(`<p style="font-size:${sizes[level] || '12pt'}; font-weight:bold; color:#0072CE; margin-top:18pt; margin-bottom:6pt;">${text}</p>`);
          continue;
        }

        // Bullet points — convert to plain paragraphs with bold lead-in
        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
        if (bulletMatch) {
          const content = bulletMatch[1].replace(/\*{1,2}([^*]+)\*{1,2}/g, '<strong>$1</strong>');
          htmlParts.push(`<p style="margin-top:10pt; margin-bottom:10pt; line-height:1.8;">${content}</p>`);
          continue;
        }

        // Numbered list — convert to plain paragraphs
        const numberedMatch = trimmed.match(/^\d+\.\s+(.*)/);
        if (numberedMatch) {
          const content = numberedMatch[1].replace(/\*{1,2}([^*]+)\*{1,2}/g, '<strong>$1</strong>');
          htmlParts.push(`<p style="margin-top:10pt; margin-bottom:10pt; line-height:1.8;">${content}</p>`);
          continue;
        }

        // Regular paragraph
        const content = trimmed.replace(/\*{1,2}([^*]+)\*{1,2}/g, '<strong>$1</strong>');
        htmlParts.push(`<p style="margin-top:6pt; margin-bottom:6pt; line-height:1.8;">${content}</p>`);
      }

      return htmlParts.join('\n');
    };

    const bodyContent = cleanForWord(review);
    const fullHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Critical Friend Review</title>
          <style>
            @page { size: A4; margin: 2cm 2cm 2cm 2cm; }
            @page Section1 { mso-page-orientation: portrait; }
            div.Section1 { page: Section1; }
            body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.8; color: #333; width: 100%; }
            strong { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="Section1">
          <p style="font-size:18pt; font-weight:bold; color:#0072CE; margin-bottom:6pt;">AI Critical Friend Review</p>
          ${generatedAt ? `<p style="color:#666; font-size:10pt; margin-bottom:18pt;">Generated ${new Date(generatedAt).toLocaleDateString('en-GB')} at ${new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>` : ''}
          ${bodyContent}
          </div>
        </body>
      </html>`;

    const blob = new Blob([fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `critical-friend-review-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Review downloaded as Word document');
  };

  return (
    <Card className="border-sky-200 bg-white dark:border-sky-800 dark:bg-sky-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
            <UserCheck className="h-5 w-5" />
            AI Critical Friend Review
          </CardTitle>
          {!disabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={generateReview}
              disabled={isGenerating}
              className="border-sky-300 hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : review ? (
                <RefreshCw className="h-4 w-4 mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? 'Generating...' : review ? 'Regenerate Review' : 'Generate Review'}
            </Button>
          )}
        </div>
        {!disabled && (
          <div className="flex items-center gap-3 mt-2">
            <Switch
              id="value-judgements"
              checked={includeValueJudgements}
              onCheckedChange={setIncludeValueJudgements}
            />
            <Label htmlFor="value-judgements" className="text-sm cursor-pointer">
              <span className="font-medium">Include Value Judgements</span>
              <span className="block text-xs text-muted-foreground">
                {includeValueJudgements
                  ? 'Review includes opinions, tone analysis & supportive commentary'
                  : 'Factual only — no opinions, tone assessments or subjective views'}
              </span>
            </Label>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-sky-300 bg-sky-100/50 dark:border-sky-700 dark:bg-sky-900/30">
          <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <AlertDescription className="text-sky-700 dark:text-sky-300 text-sm">
            This AI-powered review acts as a supportive "Critical Friend" — helping you understand the types of questions 
            an independent reviewer or CQC inspector might ask. It is <strong>advisory only</strong>. The practice retains 
            full responsibility for all complaint decisions.
          </AlertDescription>
        </Alert>

        {review ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-300 hover:underline">
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                {isOpen ? 'Hide Review' : 'Show Review'}
                {generatedAt && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Generated {new Date(generatedAt).toLocaleDateString('en-GB')} at {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                )}
              </CollapsibleTrigger>

              {isOpen && (
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setFontSize(prev => Math.max(MIN_FONT_SIZE, prev - 2))}
                          disabled={fontSize <= MIN_FONT_SIZE}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Decrease text size</TooltipContent>
                    </Tooltip>

                    <span className="text-xs text-muted-foreground w-8 text-center tabular-nums">{fontSize}</span>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setFontSize(prev => Math.min(MAX_FONT_SIZE, prev + 2))}
                          disabled={fontSize >= MAX_FONT_SIZE}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Increase text size</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-border mx-1" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={downloadAsWord}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download as Word</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}
            </div>
            <CollapsibleContent className="mt-4">
              <div className="p-4 bg-white dark:bg-card border rounded-lg" ref={reviewContentRef}>
                <style>{`
                  .cfr-review-content, .cfr-review-content * { font-size: ${fontSize}px !important; line-height: 1.7 !important; }
                  .cfr-review-content [style] { font-size: ${fontSize}px !important; line-height: 1.7 !important; }
                  .cfr-review-content h1, .cfr-review-content h1 * { font-size: ${Math.round(fontSize * 1.4)}px !important; font-weight: bold !important; color: #0369a1 !important; }
                  .cfr-review-content h2, .cfr-review-content h2 * { font-size: ${Math.round(fontSize * 1.2)}px !important; font-weight: bold !important; color: #0369a1 !important; }
                  .cfr-review-content h3, .cfr-review-content h3 * { font-size: ${Math.round(fontSize * 1.1)}px !important; font-weight: bold !important; }
                `}</style>
                <div 
                  className="cfr-review-content max-w-none [&_p]:leading-relaxed [&_li]:leading-relaxed [&_ul]:space-y-1 [&_ol]:space-y-1 dark:text-foreground"
                  dangerouslySetInnerHTML={{ 
                    __html: renderNHSMarkdown(review, { enableNHSStyling: true })
                      .replace(/font-size:\s*[^;]+;?/gi, '')
                  }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              Click "Generate Review" to receive constructive feedback on your investigation from an AI advisor.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}