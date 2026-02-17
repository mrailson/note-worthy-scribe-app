import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Play, Clock } from 'lucide-react';

interface BackupRecoveryPromptProps {
  onProcessNow: () => void;
  onKeepForLater: () => void;
}

export const BackupRecoveryPrompt: React.FC<BackupRecoveryPromptProps> = ({
  onProcessNow,
  onKeepForLater,
}) => {
  return (
    <Card className="p-6 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
        <div className="space-y-3 flex-1">
          <div>
            <h3 className="font-semibold text-foreground">No transcript recorded</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your meeting had no live transcript, but a local backup was saved on your device.
              You can process it now or keep it for later.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onProcessNow} size="sm">
              <Play className="h-4 w-4 mr-1.5" />
              Process Backup Now
            </Button>
            <Button onClick={onKeepForLater} variant="outline" size="sm">
              <Clock className="h-4 w-4 mr-1.5" />
              Keep for Later
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
