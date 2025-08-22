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
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Clinical Verification Report
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6">
            {/* Confidence Score */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getConfidenceColor(verificationData.confidenceScore)}`}>
                  {getConfidenceIcon(verificationData.confidenceScore)}
                  <span className="font-semibold">
                    {verificationData.confidenceScore}% Confidence
                  </span>
                </div>
                <Badge variant={getRiskBadgeVariant(verificationData.riskLevel)}>
                  {verificationData.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {new Date(verificationData.verificationTimestamp).toLocaleString()}
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

            {/* Sources Used */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Sources Verified ({verificationData.verificationSources.length})
              </h3>
              <div className="space-y-3">
                {verificationData.verificationSources.map((source, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{source.name}</h4>
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline break-all"
                        >
                          {source.url}
                        </a>
                      </div>
                      <Badge 
                        variant={source.trustLevel === 'high' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {source.trustLevel} trust
                      </Badge>
                    </div>
                    {source.lastUpdated && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Last updated: {source.lastUpdated}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {source.relevantContent.substring(0, 200)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* LLM Consensus */}
            <div>
              <h3 className="font-semibold mb-3">AI Model Consensus ({verificationData.llmConsensus.length})</h3>
              <div className="space-y-3">
                {verificationData.llmConsensus.map((llm, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{llm.service || 'OpenAI'}</Badge>
                        <span className="text-xs text-muted-foreground">{llm.model}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          llm.agreementLevel >= 80 ? 'bg-green-100 text-green-800' :
                          llm.agreementLevel >= 60 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {llm.agreementLevel}% agreement
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {llm.assessment}
                    </p>
                    {llm.concerns && llm.concerns.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-amber-700 mb-1">Concerns:</p>
                        <ul className="text-xs text-amber-600 list-disc list-inside">
                          {llm.concerns.map((concern, i) => (
                            <li key={i}>{concern}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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