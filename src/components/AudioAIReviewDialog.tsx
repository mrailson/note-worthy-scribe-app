import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Volume2, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface AudioAIReviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  review: string;
  practiceId?: string | null;
}

/** Redact names from review text */
function redactNames(text: string): string {
  // Match patterns like "patient, Name" or "staff member, Name" or "Christopher Young" etc.
  // Replace proper names (capitalised words that aren't section headers or common terms)
  const commonWords = new Set([
    'the', 'call', 'summary', 'tone', 'assessment', 'patient', 'staff',
    'complaint', 'handling', 'behaviour', 'behavior', 'key', 'lessons',
    'recommendations', 'training', 'requirements', 'education', 'review',
    'caller', 'member', 'practice', 'receptionist', 'gp', 'doctor',
    'nurse', 'clinician', 'manager', 'nhs', 'cqc', 'bipolar', 'disorder',
    'mental', 'health', 'condition', 'reasonable', 'adjustment',
    'primarily', 'increasingly', 'professional', 'unprofessional',
    'however', 'regarding', 'concerning', 'overall', 'specific',
    'standard', 'formal', 'clinical', 'front-line', 'de-escalating',
    'january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  ]);

  // Replace names that appear after identifying phrases
  let redacted = text;

  // Pattern: "patient, Name" or "staff member, Name" or "a staff member named Name"
  redacted = redacted.replace(
    /(?:patient|caller|complainant|staff member|receptionist|nurse|doctor|gp|clinician)[,\s]+(?:named?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    (match, name) => {
      const words = name.split(/\s+/);
      const isName = words.some((w: string) => !commonWords.has(w.toLowerCase()) && /^[A-Z][a-z]{1,}$/.test(w));
      if (isName) {
        return match.replace(name, '[Name Redacted]');
      }
      return match;
    }
  );

  // Pattern: standalone proper names (two capitalised words together that aren't headers)
  redacted = redacted.replace(
    /(?<![#*\d.]\s*)(?:^|\s)([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})(?=[\s,.:;!?]|$)/gm,
    (match, name) => {
      const words = name.split(/\s+/);
      const allCommon = words.every((w: string) => commonWords.has(w.toLowerCase()));
      if (allCommon) return match;
      return match.replace(name, '[Name Redacted]');
    }
  );

  return redacted;
}

export function AudioAIReviewDialog({ isOpen, onOpenChange, fileName, review, practiceId }: AudioAIReviewDialogProps) {
  const [showNames, setShowNames] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [practiceName, setPracticeName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPracticeDetails = async () => {
      try {
        let query;
        if (practiceId) {
          query = supabase
            .from('practice_details')
            .select('logo_url, practice_logo_url, practice_name')
            .eq('id', practiceId)
            .maybeSingle();
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          query = supabase
            .from('practice_details')
            .select('logo_url, practice_logo_url, practice_name')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle();
        }

        const { data } = await query;
        if (data) {
          setLogoUrl(data.practice_logo_url || data.logo_url || null);
          setPracticeName(data.practice_name || null);
        }
      } catch (err) {
        console.error('Error fetching practice details for review dialog:', err);
      }
    };

    fetchPracticeDetails();
  }, [isOpen, practiceId]);

  const displayReview = useMemo(() => {
    if (showNames) return review;
    return redactNames(review);
  }, [review, showNames]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-card border shadow-lg rounded-xl">
        {/* Header with logo */}
        <DialogHeader className="pb-4 border-b border-border/40 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold">
                  AI Audio Evidence Review
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5 truncate">
                  {fileName}
                </DialogDescription>
              </div>
            </div>
            {logoUrl && (
              <img
                src={logoUrl}
                alt={practiceName || 'Practice logo'}
                className="h-12 w-auto object-contain shrink-0 rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* Name redaction toggle */}
          <div className="flex items-center gap-2 pt-1">
            <Switch
              id="show-names"
              checked={showNames}
              onCheckedChange={setShowNames}
              className="data-[state=checked]:bg-primary"
            />
            <Label htmlFor="show-names" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1.5">
              {showNames ? (
                <><Eye className="h-3.5 w-3.5" /> Names visible</>
              ) : (
                <><EyeOff className="h-3.5 w-3.5" /> Names redacted</>
              )}
            </Label>
          </div>
        </DialogHeader>

        {/* Review content - clean white background with generous spacing */}
        <div className="flex-1 overflow-y-auto py-6 px-1">
          <div className="bg-white dark:bg-background px-8 py-6 rounded-lg">
            <div className="prose prose-base md:prose-lg max-w-none dark:prose-invert
              prose-headings:text-primary prose-headings:font-semibold
              prose-h2:text-base prose-h2:md:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/30
              prose-h3:text-sm prose-h3:md:text-base prose-h3:mt-4 prose-h3:mb-2
              prose-p:text-foreground/85 prose-p:leading-[1.8] prose-p:mb-4
              prose-strong:text-foreground prose-strong:font-semibold
              prose-li:text-foreground/85 prose-li:leading-[1.8] prose-li:mb-1
              prose-ul:my-3 prose-ol:my-3
              [&_h2+p]:mt-3
              [&_strong+br]:hidden">
              <ReactMarkdown>{displayReview}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground italic">
            AI-generated analysis — always verify against original recording
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(displayReview);
                toast.success('Copied to clipboard');
              }}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
