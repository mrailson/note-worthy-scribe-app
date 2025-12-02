import { Shield, Lock } from 'lucide-react';

export function LGPrivacyBanner() {
  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
      <div className="flex-shrink-0">
        <Shield className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Patient Confidential
        </p>
        <p className="text-xs text-muted-foreground">
          <Lock className="h-3 w-3 inline mr-1" />
          No images stored on device. All data encrypted in transit and at rest.
        </p>
      </div>
    </div>
  );
}
