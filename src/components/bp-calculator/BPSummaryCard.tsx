import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, TrendingUp, TrendingDown, Activity, Sun, Moon } from 'lucide-react';

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

interface TimeOfDayAverages {
  am: {
    systolic: number | null;
    diastolic: number | null;
    pulse?: number;
    count: number;
  };
  pm: {
    systolic: number | null;
    diastolic: number | null;
    pulse?: number;
    count: number;
  };
}

interface BPSummaryCardProps {
  averages: BPAverages;
  category: NHSCategory | null;
  readingsCount: number;
  timeOfDayAverages?: TimeOfDayAverages;
}

export const BPSummaryCard = ({ averages, category, readingsCount, timeOfDayAverages }: BPSummaryCardProps) => {
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

  const hasAmPmData = timeOfDayAverages && (timeOfDayAverages.am.count > 0 || timeOfDayAverages.pm.count > 0);

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

        {/* AM/PM Averages */}
        {hasAmPmData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-red-200 dark:border-red-800">
            {/* AM Average */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">AM Average</span>
              </div>
              {timeOfDayAverages.am.count > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-foreground">
                    {timeOfDayAverages.am.systolic}/{timeOfDayAverages.am.diastolic}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({timeOfDayAverages.am.count} readings)
                  </span>
                  {timeOfDayAverages.am.pulse && (
                    <span className="text-sm text-purple-600 dark:text-purple-400">
                      {timeOfDayAverages.am.pulse} bpm
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">No AM readings</span>
              )}
            </div>

            {/* PM Average */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">PM Average</span>
              </div>
              {timeOfDayAverages.pm.count > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-foreground">
                    {timeOfDayAverages.pm.systolic}/{timeOfDayAverages.pm.diastolic}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({timeOfDayAverages.pm.count} readings)
                  </span>
                  {timeOfDayAverages.pm.pulse && (
                    <span className="text-sm text-purple-600 dark:text-purple-400">
                      {timeOfDayAverages.pm.pulse} bpm
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">No PM readings</span>
              )}
            </div>
          </div>
        )}

        {/* NHS Category and Readings Count */}
        <div className="flex flex-wrap items-center justify-between mt-6 pt-4 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            {category && (
              <Badge className={`text-sm px-3 py-1 ${getCategoryBadgeClass(category.color)}`}>
                {category.label}
              </Badge>
            )}
            {category && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {category.description}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Based on <span className="font-medium text-foreground">{readingsCount}</span> readings
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
