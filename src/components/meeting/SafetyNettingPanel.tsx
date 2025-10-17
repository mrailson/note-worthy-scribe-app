import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface SafetyNettingPanelProps {
  redFlags?: string[];
  safetyAdvice?: string[];
}

export const SafetyNettingPanel: React.FC<SafetyNettingPanelProps> = ({
  redFlags,
  safetyAdvice
}) => {
  const hasContent = (redFlags?.length || 0) > 0 || (safetyAdvice?.length || 0) > 0;

  if (!hasContent) return null;

  return (
    <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Safety Netting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {redFlags && redFlags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
                Red Flags to Monitor
              </h4>
            </div>
            <ul className="space-y-1 ml-6">
              {redFlags.map((flag, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-red-600">•</span>
                  <span className="text-red-900 dark:text-red-100">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {safetyAdvice && safetyAdvice.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold ml-6">When to Return</h4>
            <ul className="space-y-1 ml-6">
              {safetyAdvice.map((advice, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{advice}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
