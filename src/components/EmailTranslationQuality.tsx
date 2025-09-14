import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Shield,
  Stethoscope,
  Globe
} from 'lucide-react';

interface EmailTranslation {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

interface EmailReply {
  englishText: string;
  translatedText: string;
  targetLanguage: string;
}

interface QualityAssessment {
  forwardAccuracy: number;
  reverseAccuracy: number;
  medicalTermsPreserved: boolean;
  culturalAppropriateness: number;
  overallSafety: 'safe' | 'warning' | 'unsafe';
  issues: string[];
  recommendation: string;
  reverseTranslation?: string;
}

interface EmailTranslationQualityProps {
  emailReply: EmailReply;
  originalEmail: EmailTranslation;
  qualityAssessment: QualityAssessment | null;
  onAssessmentComplete: (assessment: QualityAssessment) => void;
  onStartAssessment: () => void;
  isAssessing: boolean;
  onProceedToSend: () => void;
}

export const EmailTranslationQuality = ({
  emailReply,
  originalEmail,
  qualityAssessment,
  onStartAssessment,
  isAssessing,
  onProceedToSend
}: EmailTranslationQualityProps) => {

  const getLanguageName = (code: string) => {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase();
    const base = lower.split('-')[0];
    const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
    return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityProgress = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSafetyBadge = (safety: string) => {
    switch (safety) {
      case 'safe':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Safe to Send</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Review Recommended</Badge>;
      case 'unsafe':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Manual Review Required</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Translation Quality Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Translation Chain Visualization */}
          <Alert>
            <ArrowRight className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">ORIGINAL ({getLanguageName(originalEmail.detectedLanguage)}):</span>
                </div>
                <p className="text-sm bg-muted p-2 rounded">{originalEmail.originalText}</p>
                
                <div className="flex items-center gap-2 mt-2">
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-xs font-medium">ENGLISH REPLY:</span>
                </div>
                <p className="text-sm bg-muted p-2 rounded">{emailReply.englishText}</p>
                
                <div className="flex items-center gap-2 mt-2">
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-xs font-medium">TRANSLATED REPLY ({getLanguageName(emailReply.targetLanguage)}):</span>
                </div>
                <p className="text-sm bg-muted p-2 rounded">{emailReply.translatedText}</p>
                
                {qualityAssessment?.reverseTranslation && (
                  <>
                    <div className="flex items-center gap-2 mt-2">
                      <ArrowLeft className="w-4 h-4" />
                      <span className="text-xs font-medium">REVERSE CHECK (BACK TO ENGLISH):</span>
                    </div>
                    <p className="text-sm bg-muted p-2 rounded border-l-4 border-blue-500">
                      {qualityAssessment.reverseTranslation}
                    </p>
                  </>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Quality Assessment Button */}
          {!qualityAssessment && (
            <Button onClick={onStartAssessment} disabled={isAssessing} className="w-full">
              {isAssessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Run Quality Assessment
            </Button>
          )}

          {/* Assessment Results */}
          {qualityAssessment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Quality Metrics</h4>
                {getSafetyBadge(qualityAssessment.overallSafety)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    <span className="text-sm font-medium">Forward Accuracy</span>
                  </div>
                  <Progress value={qualityAssessment.forwardAccuracy} className="h-2" />
                  <p className={`text-sm ${getQualityColor(qualityAssessment.forwardAccuracy)}`}>
                    {qualityAssessment.forwardAccuracy}%
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Reverse Accuracy</span>
                  </div>
                  <Progress value={qualityAssessment.reverseAccuracy} className="h-2" />
                  <p className={`text-sm ${getQualityColor(qualityAssessment.reverseAccuracy)}`}>
                    {qualityAssessment.reverseAccuracy}%
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-medium">Cultural Fit</span>
                  </div>
                  <Progress value={qualityAssessment.culturalAppropriateness} className="h-2" />
                  <p className={`text-sm ${getQualityColor(qualityAssessment.culturalAppropriateness)}`}>
                    {qualityAssessment.culturalAppropriateness}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted rounded">
                <Stethoscope className="w-4 h-4" />
                <span className="text-sm font-medium">Medical Terms Preserved:</span>
                <Badge variant={qualityAssessment.medicalTermsPreserved ? 'default' : 'destructive'}>
                  {qualityAssessment.medicalTermsPreserved ? 'Yes' : 'No'}
                </Badge>
              </div>

              {qualityAssessment.issues.length > 0 && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <div>
                      <p className="font-medium mb-2">Issues Detected:</p>
                      <ul className="text-sm space-y-1">
                        {qualityAssessment.issues.map((issue, index) => (
                          <li key={index} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  <p className="font-medium">Recommendation:</p>
                  <p className="text-sm mt-1">{qualityAssessment.recommendation}</p>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={onStartAssessment} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-assess Quality
                </Button>
                <Button 
                  onClick={onProceedToSend}
                  disabled={qualityAssessment?.overallSafety === 'unsafe'}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Proceed to Send
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};