import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { getPracticeName } from '@/data/nresPractices';
import { format, differenceInCalendarDays, subMonths, startOfMonth } from 'date-fns';
import type { BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';

interface Props {
  claims: BuyBackClaim[];
  practiceKeys: string[];
}

interface PracticeMonthStatus {
  practiceKey: string;
  practiceName: string;
  claimMonth: string;
  claimMonthLabel: string;
  daysSinceDeadline: number;
  status: 'claimed' | 'approaching' | 'expired';
}

export function UnclaimedFundsIndicator({ claims, practiceKeys }: Props) {
  const statuses = useMemo(() => {
    const today = new Date();
    const results: PracticeMonthStatus[] = [];

    for (let i = 1; i <= 3; i++) {
      const targetMonth = startOfMonth(subMonths(today, i));
      const targetMonthStr = format(targetMonth, 'yyyy-MM-dd');
      const targetMonthLabel = format(targetMonth, 'MMM yyyy');

      const endOfTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
      const daysSinceEnd = differenceInCalendarDays(today, endOfTargetMonth);

      practiceKeys.forEach(pk => {
        const hasClaim = claims.some(c =>
          c.practice_key === pk &&
          c.claim_month === targetMonthStr &&
          c.status !== 'rejected'
        );

        if (!hasClaim) {
          if (daysSinceEnd > 30) {
            results.push({
              practiceKey: pk,
              practiceName: getPracticeName(pk),
              claimMonth: targetMonthStr,
              claimMonthLabel: targetMonthLabel,
              daysSinceDeadline: daysSinceEnd - 30,
              status: 'expired',
            });
          } else if (daysSinceEnd >= 16) {
            results.push({
              practiceKey: pk,
              practiceName: getPracticeName(pk),
              claimMonth: targetMonthStr,
              claimMonthLabel: targetMonthLabel,
              daysSinceDeadline: 30 - daysSinceEnd,
              status: 'approaching',
            });
          }
        }
      });
    }

    return results;
  }, [claims, practiceKeys]);

  const expired = statuses.filter(s => s.status === 'expired');
  const approaching = statuses.filter(s => s.status === 'approaching');

  if (expired.length === 0 && approaching.length === 0) return null;

  return (
    <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Unclaimed Funds Alert</p>
          <p className="text-xs text-muted-foreground">
            {expired.length} expired, {approaching.length} approaching deadline
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {expired.map((s, i) => (
          <div key={`exp-${i}`} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-950/30">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
              <span className="font-medium">{s.practiceName}</span>
              <span className="text-muted-foreground">— {s.claimMonthLabel}</span>
            </div>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {s.daysSinceDeadline}d overdue
            </Badge>
          </div>
        ))}
        {approaching.map((s, i) => (
          <div key={`app-${i}`} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-orange-50 dark:bg-orange-950/30">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-orange-600 dark:text-orange-400 shrink-0" />
              <span className="font-medium">{s.practiceName}</span>
              <span className="text-muted-foreground">— {s.claimMonthLabel}</span>
            </div>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-transparent text-[10px] px-1.5 py-0">
              {s.daysSinceDeadline}d remaining
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
