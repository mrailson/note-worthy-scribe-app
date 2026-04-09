import { useMemo, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [dismissAll, setDismissAll] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'all' } | { type: 'single'; key: string; label: string } | null>(null);

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

  if (dismissAll || (expired.length === 0 && approaching.length === 0)) return null;

  const visibleExpired = expired.filter(s => !dismissedKeys.has(`${s.practiceKey}-${s.claimMonth}`));
  const visibleApproaching = approaching.filter(s => !dismissedKeys.has(`${s.practiceKey}-${s.claimMonth}`));

  if (visibleExpired.length === 0 && visibleApproaching.length === 0) return null;

  const handleConfirm = () => {
    if (!confirmTarget) return;
    if (confirmTarget.type === 'all') {
      setDismissAll(true);
    } else {
      setDismissedKeys(prev => new Set(prev).add(confirmTarget.key));
    }
    setConfirmTarget(null);
  };

  return (
    <>
      <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Unclaimed Funds Alert</p>
              <p className="text-xs text-muted-foreground">
                {visibleExpired.length} expired, {visibleApproaching.length} approaching deadline
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmTarget({ type: 'all' })}
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        </div>

        <div className="space-y-1">
          {visibleExpired.map((s, i) => {
            const key = `${s.practiceKey}-${s.claimMonth}`;
            return (
              <div key={`exp-${i}`} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-950/30 group">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                  <span className="font-medium">{s.practiceName}</span>
                  <span className="text-muted-foreground">— {s.claimMonthLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {s.daysSinceDeadline}d overdue
                  </Badge>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900"
                    onClick={() => setConfirmTarget({ type: 'single', key, label: `${s.practiceName} — ${s.claimMonthLabel}` })}
                    title="Dismiss this alert"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
          {visibleApproaching.map((s, i) => {
            const key = `${s.practiceKey}-${s.claimMonth}`;
            return (
              <div key={`app-${i}`} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-orange-50 dark:bg-orange-950/30 group">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-orange-600 dark:text-orange-400 shrink-0" />
                  <span className="font-medium">{s.practiceName}</span>
                  <span className="text-muted-foreground">— {s.claimMonthLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-transparent text-[10px] px-1.5 py-0">
                    {s.daysSinceDeadline}d remaining
                  </Badge>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900"
                    onClick={() => setConfirmTarget({ type: 'single', key, label: `${s.practiceName} — ${s.claimMonthLabel}` })}
                    title="Dismiss this alert"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!confirmTarget} onOpenChange={open => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Alert{confirmTarget?.type === 'all' ? 's' : ''}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            {confirmTarget?.type === 'all'
              ? 'Are you sure you want to clear all unclaimed funds alerts? They will reappear when you next visit this page.'
              : `Dismiss the alert for ${confirmTarget?.type === 'single' ? confirmTarget.label : ''}? It will reappear when you next visit this page.`
            }
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
