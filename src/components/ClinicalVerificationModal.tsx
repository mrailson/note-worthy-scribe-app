import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Clock, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { ClinicalVerificationData } from '@/types/ai4gp';

interface ClinicalVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationData: ClinicalVerificationData;
}

export const ClinicalVerificationModal: React.FC<ClinicalVerificationModalProps> = ({
  isOpen,
  onClose,
  verificationData
}) => {
  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 85) return <CheckCircle className="w-4 h-4" />;
    if (score >= 60) return <Shield className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] w-[90vw] h-[85vh] resize overflow-hidden" style={{ resize: 'both', minWidth: '800px', minHeight: '600px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Clinical Verification Report
            <span className="text-xs text-muted-foreground ml-auto">
              Drag corners to resize
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-full flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Confidence Score */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getConfidenceColor(verificationData.confidenceScore)}`}>
                  {getConfidenceIcon(verificationData.confidenceScore)}
                  <span className="font-semibold">
                    {Math.floor(verificationData.confidenceScore)}% Confidence
                  </span>
                </div>
                <Badge variant={getRiskBadgeVariant(verificationData.riskLevel)}>
                  {verificationData.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {new Date().toLocaleString()}
              </div>
            </div>

            {/* Evidence Summary */}
            {verificationData.evidenceSummary && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <h3 className="font-semibold mb-2">Evidence Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {verificationData.evidenceSummary}
                </p>
              </div>
            )}

            <Separator />

            {/* LLM Consensus */}
            <div>
              <h3 className="font-semibold mb-3">AI Model Consensus ({verificationData.llmConsensus?.length || 0})</h3>
              <div className="space-y-3">
                {verificationData.llmConsensus?.map((llm, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-gradient-to-r from-background to-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs font-medium">
                          {llm.model}
                        </Badge>
                        {llm.service && (
                          <Badge variant="secondary" className="text-xs">
                            {llm.service}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          {getConfidenceIcon(llm.agreementLevel)}
                          <span className={`text-xs font-bold ${getConfidenceColor(llm.agreementLevel)}`}>
                            {llm.agreementLevel}% Agreement
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm font-medium text-foreground mb-2">Clinical Assessment:</p>
                      <p className="text-sm text-muted-foreground">
                        {llm.assessment}
                      </p>
                    </div>
                    
                    {llm.concerns && llm.concerns.length > 0 && (
                      <div className="mt-3 p-3 rounded-md bg-muted/50 border-l-4 border-l-orange-500">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <p className="text-sm font-semibold text-orange-700">
                            Key Clinical Considerations for Review:
                          </p>
                        </div>
                        <div className="space-y-2">
                          {llm.concerns.map((concern, idx) => {
                            const isWarning = concern.includes('⚠️');
                            const isPositive = concern.includes('✓');
                            return (
                              <div key={idx} className={`flex items-start gap-2 text-sm p-2 rounded ${
                                isWarning ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                                isPositive ? 'bg-green-50 text-green-800 border border-green-200' :
                                'bg-yellow-50 text-yellow-800 border border-yellow-200'
                              }`}>
                                <span className={`mt-0.5 ${
                                  isWarning ? 'text-orange-600' :
                                  isPositive ? 'text-green-600' :
                                  'text-yellow-600'
                                }`}>
                                  {isWarning ? '⚠️' : isPositive ? '✓' : '•'}
                                </span>
                                <span className="flex-1 font-medium">
                                  {concern.replace(/^[⚠️✓•]\s*/, '')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Sources Used */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Sources Verified ({verificationData.sourcesVerified?.length || 0})
              </h3>
              <div className="space-y-3">
                {verificationData.sourcesVerified?.map((source, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{source.source}</h4>
                        {source.url && (
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline break-all"
                          >
                            {source.url}
                          </a>
                        )}
                      </div>
                      <Badge 
                        variant={source.trustLevel === 'high' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {source.trustLevel} trust
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className={`w-3 h-3 ${source.verified ? 'text-green-600' : 'text-gray-400'}`} />
                      {source.verified ? 'Verified' : 'Not verified'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Status */}
            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">Verification Status:</span>
                <Badge variant={
                  verificationData.verificationStatus === 'verified' ? 'default' :
                  verificationData.verificationStatus === 'flagged' ? 'destructive' :
                  'secondary'
                }>
                  {verificationData.verificationStatus.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {verificationData.verificationStatus === 'verified' && 
                  'This response has been verified against authoritative sources with high confidence.'}
                {verificationData.verificationStatus === 'flagged' && 
                  'This response requires additional verification due to low confidence or potential concerns.'}
                {verificationData.verificationStatus === 'pending' && 
                  'Verification is still in progress or could not be completed.'}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};