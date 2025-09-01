import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useCalculationValidator } from '@/hooks/useCalculationValidator';

interface CalculationVerificationPanelProps {
  messageContent: string;
  originalPrompt: string;
  onRequestVerification: () => void;
  isVerifying?: boolean;
  verificationResult?: {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  };
}

export const CalculationVerificationPanel: React.FC<CalculationVerificationPanelProps> = ({
  messageContent,
  originalPrompt,
  onRequestVerification,
  isVerifying = false,
  verificationResult
}) => {
  const { detectCalculations } = useCalculationValidator();
  const calculationData = detectCalculations(messageContent);

  if (!calculationData.hasCalculations) {
    return null;
  }

  return (
    <Card className="mt-4 border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4 text-orange-600" />
          Calculation Detection
          {calculationData.needsVerification && (
            <Badge variant="outline" className="text-xs">
              Verification Recommended
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {calculationData.calculations.length > 0 && (
          <div className="text-sm">
            <p className="font-medium text-orange-800 mb-2">Detected calculations:</p>
            <div className="space-y-1">
              {calculationData.calculations.slice(0, 3).map((calc, index) => (
                <div key={index} className="px-2 py-1 bg-white rounded border text-xs font-mono">
                  {calc.expression}
                </div>
              ))}
              {calculationData.calculations.length > 3 && (
                <div className="text-xs text-orange-600">
                  +{calculationData.calculations.length - 3} more calculations...
                </div>
              )}
            </div>
          </div>
        )}

        {verificationResult && (
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm ${
              verificationResult.isValid ? 'text-green-600' : 'text-red-600'
            }`}>
              {verificationResult.isValid ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {verificationResult.isValid ? 'Calculations appear valid' : 'Potential issues detected'}
            </div>

            {verificationResult.issues.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-red-800 mb-1">Issues found:</p>
                <ul className="list-disc list-inside space-y-1">
                  {verificationResult.issues.map((issue, index) => (
                    <li key={index} className="text-red-700 text-xs">{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {verificationResult.suggestions.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-orange-800 mb-1">Suggestions:</p>
                <ul className="list-disc list-inside space-y-1">
                  {verificationResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-orange-700 text-xs">{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRequestVerification}
            disabled={isVerifying}
            className="text-xs"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Calculator className="w-3 h-3 mr-1" />
                Double-Check Calculations
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-orange-600 mt-2 p-2 bg-orange-100 rounded">
          <strong>Tip:</strong> For complex calculations involving multiple files, consider breaking down your request into smaller, step-by-step questions for maximum accuracy.
        </div>
      </CardContent>
    </Card>
  );
};