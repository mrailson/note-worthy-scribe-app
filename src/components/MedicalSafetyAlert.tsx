import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Shield, XCircle } from 'lucide-react';
import { MedicalSafetyCheck } from '@/utils/medicalSafety';

interface MedicalSafetyAlertProps {
  safetyCheck: MedicalSafetyCheck;
  context: string;
}

export const MedicalSafetyAlert = ({ safetyCheck, context }: MedicalSafetyAlertProps) => {
  if (safetyCheck.isSafe && !safetyCheck.hasRestrictedTerms) {
    return null;
  }

  const getIcon = () => {
    switch (safetyCheck.riskLevel) {
      case 'high':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      default:
        return <Shield className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getVariant = () => {
    return safetyCheck.riskLevel === 'high' ? 'destructive' : 'default';
  };

  return (
    <Alert variant={getVariant()} className="mb-4">
      {getIcon()}
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-semibold">
            Medical Safety Alert - {context}
          </p>
          <p className="text-sm">{safetyCheck.recommendation}</p>
          {safetyCheck.flaggedTerms.length > 0 && (
            <div>
              <p className="text-sm font-medium">Flagged terms:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {safetyCheck.flaggedTerms.slice(0, 10).map((term, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 text-xs bg-muted rounded"
                  >
                    {term}
                  </span>
                ))}
                {safetyCheck.flaggedTerms.length > 10 && (
                  <span className="px-2 py-1 text-xs bg-muted rounded">
                    +{safetyCheck.flaggedTerms.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="p-3 bg-muted rounded text-xs">
            <p className="font-medium">Medical Safety Reminder:</p>
            <p>AI must never fabricate medical information. Only administrative responses should be generated. Any clinical content requires manual review by qualified healthcare professionals.</p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};