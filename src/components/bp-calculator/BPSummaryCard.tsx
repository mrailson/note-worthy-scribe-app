import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, TrendingUp, TrendingDown, Activity, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BPAverages {
  systolic: number;
  diastolic: number;
  pulse?: number;
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  pulseMin?: number;
  pulseMax?: number;
}

interface NHSCategory {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  description: string;
}

interface BPSummaryCardProps {
  averages: BPAverages;
  category: NHSCategory | null;
  readingsCount: number;
  diaryEntryCount?: number; // For sit/stand mode - shows diary entries vs readings
}

export const BPSummaryCard = ({ averages, category, readingsCount, diaryEntryCount }: BPSummaryCardProps) => {
  const getCategoryBadgeClass = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700';
      case 'orange':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700';
      case 'red':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Average BP */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Heart className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-muted-foreground">Average BP</span>
            </div>
            <div className="text-4xl font-bold text-foreground">
              {averages.systolic}/{averages.diastolic}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              mmHg
            </div>
          </div>

          {/* Systolic Range */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-muted-foreground">Systolic Range</span>
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {averages.systolicMin} – {averages.systolicMax}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Min – Max
            </div>
          </div>

          {/* Diastolic Range */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-muted-foreground">Diastolic Range</span>
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {averages.diastolicMin} – {averages.diastolicMax}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Min – Max
            </div>
          </div>

          {/* Pulse (if available) */}
          {averages.pulse && (
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-muted-foreground">Avg Pulse</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {averages.pulse}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {averages.pulseMin && averages.pulseMax ? `${averages.pulseMin} – ${averages.pulseMax} bpm` : 'bpm'}
              </div>
            </div>
          )}
        </div>

        {/* Readings Count */}
        <div className="flex items-center justify-end mt-6 pt-4 border-t border-red-200 dark:border-red-800">
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            Based on <span className="font-medium text-foreground">{readingsCount}</span> readings
            {diaryEntryCount && diaryEntryCount !== readingsCount && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 cursor-help">
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      <strong>{diaryEntryCount} diary entr{diaryEntryCount !== 1 ? 'ies' : 'y'}</strong> × 2 positions (sitting + standing) = <strong>{readingsCount} total readings</strong>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
