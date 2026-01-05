import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MessageSquare, ThumbsUp, ThumbsDown, Users, AlertTriangle } from 'lucide-react';
import { FeedbackSummary } from '@/hooks/useCandidateFeedback';
import { cn } from '@/lib/utils';

interface FeedbackSummaryCardProps {
  summary: FeedbackSummary;
  totalCandidates: number;
  roleType: 'ACP' | 'GP';
  isLoading?: boolean;
}

export function FeedbackSummaryCard({
  summary,
  totalCandidates,
  roleType,
  isLoading,
}: FeedbackSummaryCardProps) {
  const {
    totalFeedback,
    agreementCount,
    disagreementCount,
    agreementPercentage,
    candidatesWithFeedback,
    candidatesWithDisagreement,
  } = summary;

  const getAlignmentStatus = () => {
    if (totalFeedback === 0) return { label: 'No reviews yet', color: 'text-muted-foreground' };
    if (agreementPercentage >= 80) return { label: 'Strong alignment', color: 'text-green-600' };
    if (agreementPercentage >= 60) return { label: 'Good alignment', color: 'text-green-500' };
    if (agreementPercentage >= 40) return { label: 'Mixed views', color: 'text-amber-600' };
    return { label: 'Needs discussion', color: 'text-red-600' };
  };

  const alignmentStatus = getAlignmentStatus();

  if (isLoading) {
    return (
      <Card className="bg-muted/30 animate-pulse">
        <CardContent className="p-4">
          <div className="h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-muted/30 to-muted/10 border-muted">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h4 className="font-semibold">Team Feedback Summary</h4>
            <Badge variant="outline" className="text-xs">
              {roleType}
            </Badge>
          </div>
          <span className={cn('text-sm font-medium', alignmentStatus.color)}>
            {alignmentStatus.label}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalFeedback}</div>
            <div className="text-xs text-muted-foreground">Total Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{agreementPercentage}%</div>
            <div className="text-xs text-muted-foreground">Agreement</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{candidatesWithFeedback}/{totalCandidates}</div>
            <div className="text-xs text-muted-foreground">Reviewed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{candidatesWithDisagreement.length}</div>
            <div className="text-xs text-muted-foreground">Need Discussion</div>
          </div>
        </div>

        {totalFeedback > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ThumbsUp className="w-4 h-4 text-green-600" />
              <span className="text-muted-foreground">Agree: {agreementCount}</span>
              <div className="flex-1">
                <Progress value={agreementPercentage} className="h-2" />
              </div>
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <span className="text-muted-foreground">Disagree: {disagreementCount}</span>
            </div>
          </div>
        )}

        {candidatesWithDisagreement.length > 0 && (
          <div className="mt-3 pt-3 border-t border-muted">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium">Candidates with disagreements:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {candidatesWithDisagreement.map((id) => (
                <Badge key={id} variant="outline" className="text-xs bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  {id}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
