import React from 'react';
import { ReferralDraft } from '@/types/referral';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  ShieldCheck, 
  Copy, 
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReferralConfirmationGateProps {
  draft: ReferralDraft;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onCopy: () => void;
  disabled?: boolean;
}

export function ReferralConfirmationGate({
  draft,
  onConfirm,
  onUnconfirm,
  onCopy,
  disabled
}: ReferralConfirmationGateProps) {
  const [appropriateChecked, setAppropriateChecked] = React.useState(false);
  const [factsChecked, setFactsChecked] = React.useState(false);

  const canConfirm = appropriateChecked && factsChecked;
  const isConfirmed = draft.clinicianConfirmed;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
    }
  };

  const handleUnconfirm = () => {
    setAppropriateChecked(false);
    setFactsChecked(false);
    onUnconfirm();
  };

  return (
    <Card className={cn(
      "border-2 transition-colors",
      isConfirmed 
        ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
        : "border-amber-300 dark:border-amber-700"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {isConfirmed ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Referral Confirmed
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              Clinician Confirmation Required
            </>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isConfirmed ? (
          <>
            {/* Confirmation checkboxes */}
            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="appropriate"
                  checked={appropriateChecked}
                  onCheckedChange={(checked) => setAppropriateChecked(!!checked)}
                  disabled={disabled}
                />
                <Label 
                  htmlFor="appropriate" 
                  className="text-sm leading-tight cursor-pointer"
                >
                  I confirm this referral is clinically appropriate
                </Label>
              </div>
              
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="facts"
                  checked={factsChecked}
                  onCheckedChange={(checked) => setFactsChecked(!!checked)}
                  disabled={disabled}
                />
                <Label 
                  htmlFor="facts" 
                  className="text-sm leading-tight cursor-pointer"
                >
                  I confirm the clinical facts are accurate
                </Label>
              </div>
            </div>

            {/* Confirm button */}
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || disabled}
              className="w-full"
              variant={canConfirm ? "default" : "secondary"}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Confirm Referral
            </Button>

            {/* Warning */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                You must confirm before copying or exporting this referral letter.
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Confirmed state */}
            <div className="text-sm text-green-700 dark:text-green-300">
              Confirmed at {new Date(draft.confirmedAt!).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                onClick={onCopy}
                className="flex-1"
                variant="default"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </Button>
            </div>

            {/* Undo confirmation */}
            <Button
              onClick={handleUnconfirm}
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
            >
              Undo confirmation (to edit)
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
