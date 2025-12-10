import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Target, Clock } from 'lucide-react';
import { NICEHomeBPAverage, NHSCategory, getTargetBP } from '@/utils/bpCalculations';

interface BPNICESummaryCardProps {
  niceAverage: NICEHomeBPAverage;
  category: NHSCategory | null;
}

export const BPNICESummaryCard = ({ niceAverage, category }: BPNICESummaryCardProps) => {
  const targets = getTargetBP();

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
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          NICE Home BP Average (NG136)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* NICE Average Display */}
        <div className="flex items-start gap-4">
          {niceAverage.isValid ? (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <div className="text-3xl font-bold text-foreground">
                    {niceAverage.systolic}/{niceAverage.diastolic}
                  </div>
                  <div className="text-sm text-muted-foreground">mmHg (Home BP)</div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                {niceAverage.message}
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{niceAverage.message}</p>

        {/* Target BP Section */}
        <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-medium text-foreground">Target Blood Pressure</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Clinic target:</p>
              <p className="font-medium text-foreground">{targets.clinic.general}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Home target:</p>
              <p className="font-medium text-foreground">{targets.home.general}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
