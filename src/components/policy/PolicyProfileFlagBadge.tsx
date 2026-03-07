import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ProfileChangeFlag, getFieldLabel } from '@/hooks/useProfileFlags';

interface PolicyProfileFlagBadgeProps {
  flags: ProfileChangeFlag[];
  onCreateVersion: (prefilledSummary: string) => void;
  onDismissAll: () => void;
}

export const PolicyProfileFlagBadge = ({
  flags,
  onCreateVersion,
  onDismissAll,
}: PolicyProfileFlagBadgeProps) => {
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  if (!flags || flags.length === 0) return null;

  const count = flags.length;
  const badgeText = count === 1
    ? `${flags[0].old_value} replaced — update needed`
    : `${count} profile changes — version review recommended`;

  // Build pre-filled summary for version modal
  const buildSummary = () => {
    if (count === 1) {
      const f = flags[0];
      return `${getFieldLabel(f.field_name)} updated: ${f.old_value} replaced by ${f.new_value}`;
    }
    const fieldNames = flags.map(f => getFieldLabel(f.field_name));
    return `Staff updates: ${fieldNames.join(' and ')} updated`;
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center cursor-pointer">
            <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200 gap-1 text-[10px] px-1.5 py-0 h-4 cursor-pointer">
              <AlertTriangle className="h-2.5 w-2.5" />
              {count === 1 ? 'Named lead updated — version review recommended' : badgeText}
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="start" side="bottom">
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold text-sm">
                {count === 1 ? 'Profile Change Detected' : `${count} Profile Changes Detected`}
              </span>
            </div>

            <div className="border-t" />

            {/* Changes list */}
            <div className="space-y-3">
              {flags.map((flag, idx) => (
                <div key={flag.id} className="text-sm space-y-1">
                  {count > 1 && (
                    <span className="text-xs font-semibold text-muted-foreground">{idx + 1}.</span>
                  )}
                  <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5 text-xs">
                    <span className="text-muted-foreground font-medium">Field:</span>
                    <span>{getFieldLabel(flag.field_name)}</span>
                    <span className="text-muted-foreground font-medium">Was:</span>
                    <span>{flag.old_value || '—'}</span>
                    <span className="text-muted-foreground font-medium">Now:</span>
                    <span>{flag.new_value || '—'}</span>
                    <span className="text-muted-foreground font-medium">Changed:</span>
                    <span>
                      {format(parseISO(flag.changed_at), 'dd/MM/yyyy')}
                      {flag.changed_by && ` by ${flag.changed_by}`}
                    </span>
                  </div>
                  {count === 1 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      This policy may still reference "{flag.old_value}"
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t" />

            {/* Actions */}
            <div className="flex justify-between gap-2">
              <Button
                size="sm"
                onClick={() => onCreateVersion(buildSummary())}
              >
                Create New Version
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDismissConfirm(true)}
              >
                {count > 1 ? 'Dismiss All' : 'Dismiss'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Dismiss Confirmation */}
      <AlertDialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss profile change flag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will mark the policy as reviewed with no changes needed.
              If the same field changes again later, the flag will re-appear.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onDismissAll();
              setShowDismissConfirm(false);
            }}>
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
