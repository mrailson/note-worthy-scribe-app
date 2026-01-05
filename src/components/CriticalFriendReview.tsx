import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ChevronDown, Info, RefreshCw, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';

interface CriticalFriendReviewProps {
  complaintId: string;
  disabled?: boolean;
}

export function CriticalFriendReview({ complaintId, disabled = false }: CriticalFriendReviewProps) {
  const [review, setReview] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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
        
        // Save to database
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

  return (
    <Card className="border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20">
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
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-300 hover:underline">
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              {isOpen ? 'Hide Review' : 'Show Review'}
              {generatedAt && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Generated {new Date(generatedAt).toLocaleDateString()} at {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="p-4 bg-background border rounded-lg">
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
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
