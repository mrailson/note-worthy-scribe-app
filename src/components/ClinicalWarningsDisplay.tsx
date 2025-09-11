import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';

interface ValidationIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  originalValue: string;
  suggestedCorrection?: string;
  normalRange?: string;
  position?: { start: number; end: number };
  source?: string;
}

interface MedicalValue {
  value: number;
  unit: string;
  type: string;
  position: { start: number; end: number };
  raw: string;
}

interface ClinicalVerificationResult {
  hasIssues: boolean;
  issues: ValidationIssue[];
  detectedValues: MedicalValue[];
  overallSafety: 'safe' | 'warning' | 'unsafe';
  confidence: number;
}

interface ClinicalWarningsDisplayProps {
  verificationResult: ClinicalVerificationResult | null;
  originalText: string;
  translatedText: string;
}

export const ClinicalWarningsDisplay: React.FC<ClinicalWarningsDisplayProps> = ({
  verificationResult,
  originalText,
  translatedText
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!verificationResult) {
    return null;
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Info className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'high':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getSafetyBadgeColor = (safety: string) => {
    switch (safety) {
      case 'safe':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'unsafe':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const highlightTextWithIssues = (text: string, issues: ValidationIssue[]) => {
    if (!issues.length) return text;

    let highlightedText = text;
    const sortedIssues = issues
      .filter(issue => issue.position)
      .sort((a, b) => b.position!.start - a.position!.start);

    for (const issue of sortedIssues) {
      if (!issue.position) continue;
      
      const { start, end } = issue.position;
      const beforeText = highlightedText.substring(0, start);
      const highlightedSection = highlightedText.substring(start, end);
      const afterText = highlightedText.substring(end);
      
      const severityClass = issue.severity === 'critical' ? 'bg-red-200 text-red-900' :
                           issue.severity === 'high' ? 'bg-orange-200 text-orange-900' :
                           'bg-yellow-200 text-yellow-900';
      
      highlightedText = `${beforeText}<span class="${severityClass} px-1 rounded font-medium" title="${issue.message}">${highlightedSection}</span>${afterText}`;
    }

    return highlightedText;
  };

  if (!verificationResult.hasIssues) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <AlertDescription className="text-green-900">
          <div className="flex items-center justify-between">
            <span>Clinical verification passed - no issues detected</span>
            <Badge className="bg-green-100 text-green-800 border-green-300">
              Confidence: {Math.round(verificationResult.confidence * 100)}%
            </Badge>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const criticalIssues = verificationResult.issues.filter(issue => issue.severity === 'critical');
  const highIssues = verificationResult.issues.filter(issue => issue.severity === 'high');
  const mediumIssues = verificationResult.issues.filter(issue => issue.severity === 'medium');

  return (
    <div className="space-y-4">
      {/* Summary Alert */}
      <Alert className={`border-2 ${getSeverityColor(verificationResult.overallSafety === 'unsafe' ? 'critical' : verificationResult.overallSafety === 'warning' ? 'high' : 'low')}`}>
        {getSeverityIcon(verificationResult.overallSafety === 'unsafe' ? 'critical' : verificationResult.overallSafety === 'warning' ? 'high' : 'low')}
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">Clinical Verification Results</span>
              <div className="text-sm mt-1">
                {criticalIssues.length > 0 && (
                  <span className="text-red-600 font-medium">
                    {criticalIssues.length} critical issue{criticalIssues.length !== 1 ? 's' : ''}
                  </span>
                )}
                {highIssues.length > 0 && (
                  <span className={`text-orange-600 font-medium ${criticalIssues.length > 0 ? ' • ' : ''}`}>
                    {highIssues.length} high priority issue{highIssues.length !== 1 ? 's' : ''}
                  </span>
                )}
                {mediumIssues.length > 0 && (
                  <span className={`text-yellow-600 ${(criticalIssues.length > 0 || highIssues.length > 0) ? ' • ' : ''}`}>
                    {mediumIssues.length} medium issue{mediumIssues.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getSafetyBadgeColor(verificationResult.overallSafety)}>
                {verificationResult.overallSafety.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {Math.round(verificationResult.confidence * 100)}% confidence
              </Badge>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Toggle Details Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2"
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showDetails ? 'Hide Details' : 'Show Details'}
        </Button>
      </div>

      {/* Detailed Issues */}
      {showDetails && (
        <div className="space-y-3">
          {verificationResult.issues.map((issue, index) => (
            <Alert key={index} className={`border ${getSeverityColor(issue.severity)}`}>
              {getSeverityIcon(issue.severity)}
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{issue.message}</p>
                      <div className="text-sm mt-1 space-y-1">
                        <p><strong>Found:</strong> "{issue.originalValue}"</p>
                        {issue.suggestedCorrection && (
                          <p><strong>Suggested:</strong> <span className="text-green-700 font-medium">"{issue.suggestedCorrection}"</span></p>
                        )}
                        {issue.normalRange && (
                          <p><strong>Normal range:</strong> {issue.normalRange}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {issue.severity}
                    </Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}

          {/* Detected Medical Values */}
          {verificationResult.detectedValues.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <div className="space-y-2">
                  <p className="font-medium">Detected Medical Values:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {verificationResult.detectedValues.map((value, index) => (
                      <div key={index} className="bg-white px-2 py-1 rounded border">
                        <span className="font-medium">{value.type.replace('_', ' ')}:</span> {value.value} {value.unit}
                      </div>
                    ))}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};