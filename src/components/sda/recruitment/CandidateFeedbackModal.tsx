import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ThumbsUp, ThumbsDown, User, Calendar, Trash2, Loader2 } from 'lucide-react';
import { CandidateFeedback } from '@/hooks/useCandidateFeedback';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CandidateFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName?: string;
  currentRecommendation: string;
  roleType: 'ACP' | 'GP';
  feedback: CandidateFeedback[];
  userFeedback: CandidateFeedback | null;
  isSubmitting: boolean;
  onSubmit: (agrees: boolean, comment?: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

export function CandidateFeedbackModal({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  currentRecommendation,
  roleType,
  feedback,
  userFeedback,
  isSubmitting,
  onSubmit,
  onDelete,
}: CandidateFeedbackModalProps) {
  const { user } = useAuth();
  const [agrees, setAgrees] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (userFeedback) {
      setAgrees(userFeedback.agrees_with_assessment);
      setComment(userFeedback.comment || '');
    } else {
      setAgrees(null);
      setComment('');
    }
  }, [userFeedback, open]);

  const handleSubmit = async () => {
    if (agrees === null) return;
    const success = await onSubmit(agrees, comment);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    const success = await onDelete();
    if (success) {
      setAgrees(null);
      setComment('');
    }
  };

  const getRecommendationStyle = (rec: string) => {
    const lower = rec.toLowerCase();
    if (lower.includes('strongly recommend')) return 'bg-green-600 text-white';
    if (lower.includes('recommend') || lower.includes('interview')) return 'bg-green-500 text-white';
    if (lower.includes('consider')) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  const agreementCount = feedback.filter(f => f.agrees_with_assessment).length;
  const disagreementCount = feedback.filter(f => !f.agrees_with_assessment).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Feedback for {candidateId}
            {candidateName && <span className="text-muted-foreground font-normal">({candidateName})</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Current Assessment */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground mb-2">Current AI Assessment:</p>
            <Badge className={getRecommendationStyle(currentRecommendation)}>
              {currentRecommendation}
            </Badge>
          </div>

          {/* Agreement Stats */}
          {feedback.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4 text-green-600" />
                <span>{agreementCount} agree</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ThumbsDown className="w-4 h-4 text-red-600" />
                <span>{disagreementCount} disagree</span>
              </div>
            </div>
          )}

          <Separator />

          {/* User's Feedback Form */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Do you agree with this assessment?</p>
            <div className="flex gap-2">
              <Button
                variant={agrees === true ? 'default' : 'outline'}
                className={cn(
                  'flex-1 gap-2',
                  agrees === true && 'bg-green-600 hover:bg-green-700'
                )}
                onClick={() => setAgrees(true)}
              >
                <ThumbsUp className="w-4 h-4" />
                I Agree
              </Button>
              <Button
                variant={agrees === false ? 'default' : 'outline'}
                className={cn(
                  'flex-1 gap-2',
                  agrees === false && 'bg-red-600 hover:bg-red-700'
                )}
                onClick={() => setAgrees(false)}
              >
                <ThumbsDown className="w-4 h-4" />
                I Disagree
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Add a comment (optional):
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts on this candidate..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={agrees === null || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : userFeedback ? (
                  'Update Feedback'
                ) : (
                  'Submit Feedback'
                )}
              </Button>
              {userFeedback && (
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Previous Feedback */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <p className="text-sm font-medium mb-2">
              Team Feedback ({feedback.length})
            </p>
            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-4">
                {feedback.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No feedback yet. Be the first to share your thoughts.
                  </p>
                ) : (
                  feedback.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-lg p-3 border',
                        item.user_id === user?.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{item.user_name}</span>
                          {item.user_role && (
                            <Badge variant="outline" className="text-xs">
                              {item.user_role}
                            </Badge>
                          )}
                          {item.user_id === user?.id && (
                            <Badge variant="secondary" className="text-xs">You</Badge>
                          )}
                        </div>
                        {item.agrees_with_assessment ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <ThumbsUp className="w-3 h-3 mr-1" />
                            Agrees
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <ThumbsDown className="w-3 h-3 mr-1" />
                            Disagrees
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(item.created_at), 'd MMM yyyy, HH:mm')}
                      </div>
                      {item.comment && (
                        <p className="text-sm text-muted-foreground">"{item.comment}"</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
