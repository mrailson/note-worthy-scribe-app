import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  Shield, 
  BarChart3,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslationVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  translation: {
    originalText: string;
    translatedText: string;
    originalLanguageDetected: string;
    targetLanguage: string;
    id: string;
  } | null;
}

interface VerificationResult {
  provider: string;
  status: 'success' | 'error';
  accuracy?: number;
  confidence?: number;
  issues?: string[];
  strengths?: string[];
  recommendation?: string;
  reasoning?: string;
  assessment?: string;
  backTranslation?: string;
  method?: string;
  error?: string;
}

interface VerificationResponse {
  success: boolean;
  verificationResults: VerificationResult[];
  summary: {
    averageAccuracy: number;
    averageConfidence: number;
    overallRating: string;
    providersChecked: number;
    totalProviders: number;
  };
  timestamp: string;
  error?: string;
}

export const TranslationVerificationModal: React.FC<TranslationVerificationModalProps> = ({
  isOpen,
  onClose,
  translation
}) => {
  const [verificationResults, setVerificationResults] = useState<VerificationResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<number>>(new Set([0])); // First provider expanded by default

  const toggleProvider = (index: number) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const startVerification = async () => {
    if (!translation) return;

    setIsVerifying(true);
    setVerificationResults(null);

    try {
      console.log('Starting translation verification for:', translation.id);
      
      const { data, error } = await supabase.functions.invoke('translation-verification-service', {
        body: {
          originalText: translation.originalText,
          translatedText: translation.translatedText,
          sourceLanguage: translation.originalLanguageDetected,
          targetLanguage: translation.targetLanguage
        }
      });

      if (error) {
        console.error('Verification service error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      console.log('Verification completed:', data.summary);
      setVerificationResults(data);
      toast.success('Translation verification completed');

    } catch (error) {
      console.error('Translation verification failed:', error);
      toast.error('Failed to verify translation. Please try again.');
      
      // Set error state
      setVerificationResults({
        success: false,
        error: error.message,
        verificationResults: [],
        summary: {
          averageAccuracy: 0,
          averageConfidence: 0,
          overallRating: 'unverified',
          providersChecked: 0,
          totalProviders: 3
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-start verification when modal opens
  useEffect(() => {
    if (isOpen && translation && !verificationResults && !isVerifying) {
      startVerification();
    }
  }, [isOpen, translation]);

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'acceptable': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'needs_review': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'good': return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'acceptable': return <Info className="h-5 w-5 text-yellow-600" />;
      case 'needs_review': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'poor': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Shield className="h-5 w-5 text-gray-600" />;
    }
  };

  const getProviderIcon = (provider: string) => {
    if (provider.includes('GPT-5')) return '🔬';
    if (provider.includes('GPT-4o')) return '🔍';
    if (provider.includes('Back-Translation')) return '↩️';
    return '🤖';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Translation Verification Service
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-4">
            {/* Translation Being Verified */}
            {translation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Translation Under Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Original ({translation.originalLanguageDetected})
                    </div>
                    <div className="text-sm p-2 bg-muted rounded">{translation.originalText}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Translation ({translation.targetLanguage})
                    </div>
                    <div className="text-sm p-2 bg-blue-50 rounded font-medium">{translation.translatedText}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verification Status */}
            {isVerifying && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <div className="text-lg font-medium">Verifying Translation...</div>
                    <div className="text-sm text-muted-foreground">
                      Testing against multiple AI providers and back-translation
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verification Results */}
            {verificationResults && verificationResults.success && (
              <>
                {/* Summary */}
                <Card className={`border-2 ${getRatingColor(verificationResults.summary.overallRating)}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getRatingIcon(verificationResults.summary.overallRating)}
                      Overall Verification: {verificationResults.summary.overallRating.replace('_', ' ').toUpperCase()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{verificationResults.summary.averageAccuracy}%</div>
                        <div className="text-sm text-muted-foreground">Accuracy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{verificationResults.summary.averageConfidence}%</div>
                        <div className="text-sm text-muted-foreground">Confidence</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {verificationResults.summary.providersChecked}/{verificationResults.summary.totalProviders}
                        </div>
                        <div className="text-sm text-muted-foreground">Providers</div>
                      </div>
                      <div className="text-center">
                        <BarChart3 className="h-8 w-8 mx-auto text-primary" />
                        <div className="text-sm text-muted-foreground">Multi-verified</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Individual Provider Results */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Provider Analysis</h3>
                  {verificationResults.verificationResults.map((result, index) => (
                    <Collapsible 
                      key={index} 
                      open={expandedProviders.has(index)}
                      onOpenChange={() => toggleProvider(index)}
                    >
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <CardTitle className="flex items-center justify-between text-base">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{getProviderIcon(result.provider)}</span>
                                {result.provider}
                                {result.status === 'success' ? (
                                  <Badge className="bg-green-100 text-green-800">Success</Badge>
                                ) : (
                                  <Badge variant="destructive">Error</Badge>
                                )}
                              </div>
                              {expandedProviders.has(index) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            {result.status === 'success' ? (
                              <div className="space-y-3">
                                <div className="flex gap-4">
                                  <div className="text-center">
                                    <div className="text-xl font-bold">{result.accuracy}%</div>
                                    <div className="text-xs text-muted-foreground">Accuracy</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-xl font-bold">{result.confidence}%</div>
                                    <div className="text-xs text-muted-foreground">Confidence</div>
                                  </div>
                                </div>

                                {result.reasoning && (
                                  <div>
                                    <div className="text-sm font-medium mb-1">Analysis</div>
                                    <div className="text-sm text-muted-foreground">{result.reasoning}</div>
                                  </div>
                                )}

                                {result.assessment && (
                                  <div>
                                    <div className="text-sm font-medium mb-1">Assessment</div>
                                    <div className="text-sm text-muted-foreground">{result.assessment}</div>
                                  </div>
                                )}

                                {result.backTranslation && (
                                  <div>
                                    <div className="text-sm font-medium mb-1">Back-Translation</div>
                                    <div className="text-sm p-2 bg-muted rounded">{result.backTranslation}</div>
                                  </div>
                                )}

                                {result.issues && result.issues.length > 0 && (
                                  <div>
                                    <div className="text-sm font-medium mb-1 text-orange-600">Issues Found</div>
                                    <ul className="text-sm space-y-1">
                                      {result.issues.map((issue, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <AlertTriangle className="h-3 w-3 mt-0.5 text-orange-500" />
                                          {issue}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {result.strengths && result.strengths.length > 0 && (
                                  <div>
                                    <div className="text-sm font-medium mb-1 text-green-600">Strengths</div>
                                    <ul className="text-sm space-y-1">
                                      {result.strengths.map((strength, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <CheckCircle className="h-3 w-3 mt-0.5 text-green-500" />
                                          {strength}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-red-600">
                                {result.error || 'Verification failed'}
                              </div>
                            )}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </>
            )}

            {/* Error State */}
            {verificationResults && !verificationResults.success && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="text-center py-8">
                  <XCircle className="h-8 w-8 text-red-600 mx-auto mb-3" />
                  <div className="text-lg font-medium text-red-800">Verification Failed</div>
                  <div className="text-sm text-red-600 mt-2">
                    {verificationResults.error || 'Unable to complete verification'}
                  </div>
                  <Button 
                    onClick={startVerification} 
                    variant="outline" 
                    className="mt-4"
                    disabled={isVerifying}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Verification
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4 flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            Multi-provider verification ensures translation accuracy and reliability
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};