import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Armchair, PersonStanding, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { SitStandAverages } from '@/utils/bpCalculations';

interface BPSitStandSummaryCardProps {
  sitStandAverages: SitStandAverages;
}

export const BPSitStandSummaryCard = ({ sitStandAverages }: BPSitStandSummaryCardProps) => {
  const { sitting, standing, posturalDrop } = sitStandAverages;

  const getDropColor = (drop: number, threshold: number) => {
    const absVal = Math.abs(drop);
    if (absVal >= threshold) return 'text-red-600';
    if (absVal >= threshold * 0.75) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Armchair className="h-5 w-5 text-purple-500" />
          Sit/Stand BP Assessment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sitting Average */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Armchair className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Sitting</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {sitStandAverages.sittingCount} reading{sitStandAverages.sittingCount !== 1 ? 's' : ''}
              </span>
            </div>
            {sitting ? (
              <>
                <p className="text-2xl font-bold text-foreground">
                  {sitting.systolic}/{sitting.diastolic}
                  <span className="text-sm font-normal text-muted-foreground ml-1">mmHg</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Range: {sitting.systolicMin}-{sitting.systolicMax} / {sitting.diastolicMin}-{sitting.diastolicMax}
                </p>
                {sitting.pulse && (
                  <p className="text-xs text-muted-foreground">
                    Pulse: {sitting.pulse} bpm
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No sitting readings</p>
            )}
          </div>

          {/* Standing Average */}
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PersonStanding className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">Standing</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {sitStandAverages.standingCount} reading{sitStandAverages.standingCount !== 1 ? 's' : ''}
              </span>
            </div>
            {standing ? (
              <>
                <p className="text-2xl font-bold text-foreground">
                  {standing.systolic}/{standing.diastolic}
                  <span className="text-sm font-normal text-muted-foreground ml-1">mmHg</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Range: {standing.systolicMin}-{standing.systolicMax} / {standing.diastolicMin}-{standing.diastolicMax}
                </p>
                {standing.pulse && (
                  <p className="text-xs text-muted-foreground">
                    Pulse: {standing.pulse} bpm
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No standing readings</p>
            )}
          </div>

          {/* Postural Drop */}
          <div className={`rounded-lg p-4 ${
            posturalDrop?.isOrthostatic 
              ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800' 
              : 'bg-green-50 dark:bg-green-950/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className={`h-4 w-4 ${posturalDrop?.isOrthostatic ? 'text-red-600' : 'text-green-600'}`} />
              <span className={`text-sm font-medium ${posturalDrop?.isOrthostatic ? 'text-red-600' : 'text-green-600'}`}>
                Postural Drop
              </span>
            </div>
            {posturalDrop ? (
              <>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-bold ${getDropColor(posturalDrop.systolic, 20)}`}>
                    {posturalDrop.systolic > 0 ? '+' : ''}{posturalDrop.systolic}
                  </p>
                  <span className="text-muted-foreground">/</span>
                  <p className={`text-2xl font-bold ${getDropColor(posturalDrop.diastolic, 10)}`}>
                    {posturalDrop.diastolic > 0 ? '+' : ''}{posturalDrop.diastolic}
                  </p>
                  <span className="text-sm text-muted-foreground">mmHg</span>
                </div>
                <div className="mt-2">
                  {posturalDrop.isOrthostatic ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Orthostatic Hypotension
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      No Significant Drop
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {posturalDrop.message}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Need both sitting and standing readings
              </p>
            )}
          </div>
        </div>

        {/* Clinical interpretation */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong>Readings summary:</strong> {sitStandAverages.diaryEntryCount} diary entr{sitStandAverages.diaryEntryCount !== 1 ? 'ies' : 'y'} × 2 positions = {sitStandAverages.sittingCount + sitStandAverages.standingCount} total readings
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Orthostatic hypotension criteria:</strong> Systolic drop ≥20 mmHg OR diastolic drop ≥10 mmHg within 3 minutes of standing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
