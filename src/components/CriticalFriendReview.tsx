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
      const { data, error } = await supabase.functions.invoke('ai-investigation-assistant', {
        body: {
          complaint_id: complaintId,
          request_type: 'critical_friend_review'
        }
      });

      if (error) throw error;

      if (data?.success && data?.content) {
        setReview(data.content);
        const now = new Date().toISOString();
        setGeneratedAt(now);
        
        const { error: updateError } = await supabase
          .from('complaint_investigation_findings')
          .update({
            critical_friend_review: data.content,
            critical_friend_review_generated_at: now
          })
          .eq('complaint_id', complaintId);

        if (updateError) {
          console.error('Error saving critical friend review:', updateError);
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

    const htmlContent = renderNHSMarkdown(review, { enableNHSStyling: true });
    const fullHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Critical Friend Review</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #333; padding: 20px; }
            h1 { font-size: 18pt; color: #0072CE; }
            h2 { font-size: 15pt; color: #0072CE; }
            h3 { font-size: 13pt; color: #333; }
            ul, ol { margin-left: 20px; }
            li { margin-bottom: 4px; }
            strong { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>AI Critical Friend Review</h1>
          ${generatedAt ? `<p style="color:#666; font-size:10pt;">Generated ${new Date(generatedAt).toLocaleDateString('en-GB')} at ${new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>` : ''}
          ${htmlContent}
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
              <div className="p-4 bg-background border rounded-lg" ref={reviewContentRef}>
                <div 
                  className="prose max-w-none dark:prose-invert"
                  style={{ fontSize: `${fontSize}px` }}
                  dangerouslySetInnerHTML={{ 
                    __html: renderNHSMarkdown(review, { enableNHSStyling: true })
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