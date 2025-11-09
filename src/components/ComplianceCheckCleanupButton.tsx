import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cleanupDuplicateComplianceChecks } from '@/utils/cleanupComplianceChecks';
import { showShadcnToast } from '@/utils/toastWrapper';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface ComplianceCheckCleanupButtonProps {
  complaintId: string;
  onCleanupComplete?: () => void;
}

export function ComplianceCheckCleanupButton({ 
  complaintId, 
  onCleanupComplete 
}: ComplianceCheckCleanupButtonProps) {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    setResult(null);

    try {
      const cleanupResult = await cleanupDuplicateComplianceChecks(complaintId);
      setResult(cleanupResult);

      if (cleanupResult.success) {
        if (onCleanupComplete) {
          onCleanupComplete();
        }
      } else {
        showShadcnToast({
          title: 'Cleanup Failed',
          description: cleanupResult.message,
          variant: 'destructive',
          section: 'complaints',
        });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      showShadcnToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cleanup checks',
        variant: 'destructive',
        section: 'complaints',
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="space-y-3">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Duplicate Compliance Checks Detected</AlertTitle>
        <AlertDescription>
          This complaint has duplicate compliance check entries. Click below to remove duplicates and keep only the 15 standard checks.
        </AlertDescription>
      </Alert>

      <Button 
        onClick={handleCleanup} 
        disabled={isCleaningUp}
        variant="outline"
        className="w-full"
      >
        {isCleaningUp ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Cleaning up...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Fix Duplicate Checks
          </>
        )}
      </Button>

      {result && result.success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            {result.message}
            {result.deleted > 0 && (
              <div className="mt-2 text-sm">
                Deleted: {result.deleted} | Remaining: {result.remaining}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
