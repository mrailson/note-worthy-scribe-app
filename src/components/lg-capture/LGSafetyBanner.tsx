import { AlertTriangle } from 'lucide-react';

interface LGSafetyBannerProps {
  missingFields: string[];
}

export function LGSafetyBanner({ missingFields }: LGSafetyBannerProps) {
  if (missingFields.length === 0) return null;

  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
      <div className="flex-shrink-0">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">
          Required Information Missing
        </p>
        <p className="text-xs text-destructive/80">
          Processing blocked until the following are provided: {missingFields.join(', ')}
        </p>
      </div>
    </div>
  );
}
