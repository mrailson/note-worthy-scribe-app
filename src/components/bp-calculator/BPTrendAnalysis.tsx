import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, Activity, BarChart3 } from 'lucide-react';
import { BPTrends, DataQuality, DateRange, QOFRelevance } from '@/utils/bpCalculations';

interface BPTrendAnalysisProps {
  trends: BPTrends;
  dataQuality: DataQuality;
  dateRange: DateRange;
  qofRelevance: QOFRelevance;
  totalReadings: number;
  includedCount: number;
  excludedCount: number;
  diaryEntryCount?: number; // For sit/stand mode
}

export const BPTrendAnalysis = ({
  trends,
  dataQuality,
  dateRange,
  qofRelevance,
  totalReadings,
  includedCount,
  excludedCount,
  diaryEntryCount
}: BPTrendAnalysisProps) => {
  const getQualityColor = (rating: string) => {
    switch (rating) {
      case 'Excellent':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Good':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Fair':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Poor':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Trends Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Systolic trend:</p>
            <p className="text-sm text-foreground font-mono bg-muted/50 px-2 py-1 rounded overflow-x-auto">
              {trends.systolicTrend}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Diastolic trend:</p>
            <p className="text-sm text-foreground font-mono bg-muted/50 px-2 py-1 rounded overflow-x-auto">
              {trends.diastolicTrend}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Pulse trend:</p>
            <p className="text-sm text-foreground font-mono bg-muted/50 px-2 py-1 rounded overflow-x-auto">
              {trends.pulseTrend}
            </p>
          </div>

          {/* Pattern Flags */}
          {trends.patternFlags.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Pattern flags:
              </p>
              <ul className="space-y-1">
                {trends.patternFlags.map((flag, index) => (
                  <li key={index} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Quality & Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Data Quality & Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Quality Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Data Quality Score:</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">{dataQuality.score}/5</span>
              <Badge className={getQualityColor(dataQuality.rating)}>
                {dataQuality.rating}
              </Badge>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {dataQuality.reasons.map((reason, index) => (
              <p key={index} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-1.5" />
                {reason}
              </p>
            ))}
          </div>

          {/* Reading Summary */}
          <div className="pt-3 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total readings:</span>
              <span className="font-medium text-foreground">
                {totalReadings}
                {diaryEntryCount && diaryEntryCount !== totalReadings && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({diaryEntryCount} diary entries × 2)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Included:</span>
              <span className="font-medium text-green-600 dark:text-green-400">{includedCount}</span>
            </div>
            {excludedCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Excluded:</span>
                <span className="font-medium text-red-600 dark:text-red-400">{excludedCount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date range:</span>
              <span className="font-medium text-foreground">
                {dateRange.start && dateRange.end 
                  ? `${dateRange.start} → ${dateRange.end}`
                  : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-medium text-foreground">Home BP diary</span>
            </div>
          </div>

          {/* QOF Relevance */}
          <div className="pt-3 border-t space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Activity className="h-4 w-4" />
              QOF Relevance
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meets BP monitoring:</span>
                <span className={qofRelevance.meetsBPMonitoring ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                  {qofRelevance.meetsBPMonitoring ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suitable for annual review:</span>
                <span className={qofRelevance.suitableForAnnualReview ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                  {qofRelevance.suitableForAnnualReview ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monitor validation:</span>
                <span className="text-muted-foreground">{qofRelevance.monitorValidation}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
