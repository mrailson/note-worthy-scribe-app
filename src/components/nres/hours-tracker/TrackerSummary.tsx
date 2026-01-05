import { Card, CardContent } from '@/components/ui/card';
import { Clock, Receipt, PoundSterling, TrendingUp } from 'lucide-react';

interface TrackerSummaryProps {
  totalHours: number;
  totalExpenses: number;
  hourlyRate: number | null;
}

export function TrackerSummary({ totalHours, totalExpenses, hourlyRate }: TrackerSummaryProps) {
  const timeClaimAmount = hourlyRate ? totalHours * hourlyRate : 0;
  const grandTotal = timeClaimAmount + totalExpenses;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Total Hours</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <PoundSterling className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Time Claim</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {hourlyRate ? `£${timeClaimAmount.toFixed(2)}` : 'Set rate'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <Receipt className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Expenses</span>
          </div>
          <p className="text-2xl font-bold text-foreground">£{totalExpenses.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Grand Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {hourlyRate ? `£${grandTotal.toFixed(2)}` : '-'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
