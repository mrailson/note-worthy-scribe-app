import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CandidateFeedbackStats } from '@/hooks/useCandidateFeedback';
import { cn } from '@/lib/utils';

interface CandidateFeedbackButtonProps {
  stats: CandidateFeedbackStats;
  onClick: (e?: React.MouseEvent) => void;
  hasUserFeedback: boolean;
  userAgreed?: boolean;
}

export function CandidateFeedbackButton({
  stats,
  onClick,
  hasUserFeedback,
  userAgreed,
}: CandidateFeedbackButtonProps) {
  const { totalFeedback, agreementPercentage } = stats;

  const getStatusColor = () => {
    if (totalFeedback === 0) return 'bg-muted text-muted-foreground';
    if (agreementPercentage >= 75) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (agreementPercentage >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        'gap-2 h-8',
        hasUserFeedback && 'border-primary'
      )}
    >
      <MessageSquare className="w-3.5 h-3.5" />
      {totalFeedback > 0 ? (
        <>
          <Badge variant="secondary" className={cn('text-xs px-1.5 py-0', getStatusColor())}>
            {totalFeedback} review{totalFeedback !== 1 ? 's' : ''}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {agreementPercentage}% agree
          </span>
        </>
      ) : (
        <span className="text-xs">Add feedback</span>
      )}
      {hasUserFeedback && (
        userAgreed ? (
          <ThumbsUp className="w-3 h-3 text-green-600" />
        ) : (
          <ThumbsDown className="w-3 h-3 text-red-600" />
        )
      )}
    </Button>
  );
}
