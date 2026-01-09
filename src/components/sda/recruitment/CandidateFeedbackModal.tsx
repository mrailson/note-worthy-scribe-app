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
import { ThumbsUp, ThumbsDown, User, Calendar, Trash2, Loader2, MessageCircle, Sparkles } from 'lucide-react';
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
  canSubmitFeedback?: boolean;
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
  canSubmitFeedback = true,
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
    if (lower.includes('strongly recommend')) return 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/25';
    if (lower.includes('recommend') || lower.includes('interview')) return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20';
    if (lower.includes('consider')) return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20';
    return 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/20';
  };

  const agreementCount = feedback.filter(f => f.agrees_with_assessment).length;
  const disagreementCount = feedback.filter(f => !f.agrees_with_assessment).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-[#005EB8] to-[#0077CC] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-semibold">Feedback for {candidateId}</span>
                {candidateName && (
                  <p className="text-white/70 font-normal text-sm mt-0.5">{candidateName}</p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Current Assessment Card */}
          <div className="px-6 py-5 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-b">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="font-medium">Current AI Assessment</span>
            </div>
            <Badge className={cn('text-sm px-4 py-1.5', getRecommendationStyle(currentRecommendation))}>
              {currentRecommendation}
            </Badge>
            
            {/* Agreement Stats */}
            {feedback.length > 0 && (
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-dashed">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="font-semibold text-green-700 dark:text-green-400">{agreementCount}</span>
                  <span className="text-sm text-muted-foreground">agree</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <ThumbsDown className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="font-semibold text-red-700 dark:text-red-400">{disagreementCount}</span>
                  <span className="text-sm text-muted-foreground">disagree</span>
                </div>
              </div>
            )}
          </div>

          {/* User's Feedback Form - Hidden for ICB members */}
          {canSubmitFeedback ? (
            <div className="px-6 py-5 space-y-4 border-b bg-white dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Do you agree with this assessment?
              </p>
              <div className="flex gap-3">
                <Button
                  variant={agrees === true ? 'default' : 'outline'}
                  size="lg"
                  className={cn(
                    'flex-1 gap-2 h-12 text-base transition-all duration-200',
                    agrees === true 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/25 border-0' 
                      : 'hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-950/30'
                  )}
                  onClick={() => setAgrees(true)}
                >
                  <ThumbsUp className="w-5 h-5" />
                  I Agree
                </Button>
                <Button
                  variant={agrees === false ? 'default' : 'outline'}
                  size="lg"
                  className={cn(
                    'flex-1 gap-2 h-12 text-base transition-all duration-200',
                    agrees === false 
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-lg shadow-red-500/25 border-0' 
                      : 'hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30'
                  )}
                  onClick={() => setAgrees(false)}
                >
                  <ThumbsDown className="w-5 h-5" />
                  I Disagree
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Add a comment (optional):
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your thoughts on this candidate..."
                  rows={3}
                  className="resize-none border-slate-200 dark:border-slate-800 focus:border-[#005EB8] focus:ring-[#005EB8]/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={agrees === null || isSubmitting}
                  size="lg"
                  className="flex-1 h-12 bg-gradient-to-r from-[#005EB8] to-[#0077CC] hover:from-[#004C99] hover:to-[#0066B3] shadow-lg shadow-blue-500/25 text-base font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
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
                    size="lg"
                    onClick={handleDelete}
                    className="h-12 px-4 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 border-b bg-slate-50 dark:bg-slate-900">
              <p className="text-sm text-muted-foreground text-center">
                ICB members can view feedback but cannot submit their own assessments.
              </p>
            </div>
          )}

          {/* Team Feedback Section */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-[200px] bg-slate-50 dark:bg-slate-900/50">
            <div className="px-6 py-3 border-b bg-white dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold">
                  Team Feedback
                </p>
                <Badge variant="secondary" className="ml-1">
                  {feedback.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-[150px] px-6 py-3">
              <div className="space-y-3">
                {feedback.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No feedback yet. Be the first to share your thoughts.
                    </p>
                  </div>
                ) : (
                  feedback.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-xl p-4 border bg-white dark:bg-slate-950 transition-all',
                        item.user_id === user?.id 
                          ? 'border-[#005EB8]/30 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm' 
                          : 'border-slate-200 dark:border-slate-800'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm">{item.user_name}</span>
                            {item.user_id === user?.id && (
                              <Badge variant="secondary" className="ml-2 text-xs bg-[#005EB8]/10 text-[#005EB8]">
                                You
                              </Badge>
                            )}
                          </div>
                          {item.user_role && (
                            <Badge variant="outline" className="text-xs">
                              {item.user_role}
                            </Badge>
                          )}
                        </div>
                        {item.agrees_with_assessment ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-0 shadow-sm">
                            <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                            Agrees
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0 shadow-sm">
                            <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                            Disagrees
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 ml-10">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(item.created_at), 'd MMM yyyy, HH:mm')}
                      </div>
                      {item.comment && (
                        <div className="ml-10 mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                          <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                            "{item.comment}"
                          </p>
                        </div>
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
