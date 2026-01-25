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
import { Progress } from '@/components/ui/progress';
import { ExternalLink, Clock, Shield, AlertTriangle, CheckCircle, XCircle, Loader2, BookOpen, Stethoscope, Pill, Activity } from 'lucide-react';
import { ClinicalVerificationData, LLMConsensusData, ModelScores } from '@/types/ai4gp';

interface ClinicalVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationData: ClinicalVerificationData;
}

const ScoreBar: React.FC<{ label: string; score: number; icon: React.ReactNode }> = ({ label, score, icon }) => {
  const getScoreColor = (s: number) => {
    if (s >= 85) return 'bg-green-500';
    if (s >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-semibold ${score >= 85 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
          {score}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${getScoreColor(score)}`} 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'timeout': return <Loader2 className="w-4 h-4 text-amber-600" />;
      default: return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'success': return 'Verified';
      case 'failed': return 'Failed';
      case 'timeout': return 'Timed Out';
      default: return 'Verified';
    }
  };

  const renderModelScores = (llm: LLMConsensusData) => {
    if (!llm.scores) return null;
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 p-3 bg-muted/30 rounded-lg">
        <ScoreBar 
          label="Clinical Accuracy" 
          score={llm.scores.clinicalAccuracy} 
          icon={<Stethoscope className="w-3 h-3" />} 
        />
        <ScoreBar 
          label="BNF Compliance" 
          score={llm.scores.bnfCompliance} 
          icon={<Pill className="w-3 h-3" />} 
        />
        <ScoreBar 
          label="NICE Alignment" 
          score={llm.scores.niceAlignment} 
          icon={<BookOpen className="w-3 h-3" />} 
        />
        <ScoreBar 
          label="Safety" 
          score={llm.scores.safety} 
          icon={<Shield className="w-3 h-3" />} 
        />
        <ScoreBar 
          label="Completeness" 
          score={llm.scores.completeness} 
          icon={<Activity className="w-3 h-3" />} 
        />
      </div>
    );
  };

  const hasConflicts = verificationData.conflicts && verificationData.conflicts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] sm:max-w-6xl max-h-[90vh] sm:max-h-[90vh] overflow-hidden"
        style={{ 
          minWidth: undefined,
          minHeight: undefined,
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        }}
      >
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            Multi-Model Clinical Verification Report
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-full flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Confidence Score & Model Stats */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getConfidenceColor(verificationData.confidenceScore)}`}>
                  {getConfidenceIcon(verificationData.confidenceScore)}
                  <span className="font-semibold">
                    {Math.floor(verificationData.confidenceScore)}% Confidence
                  </span>
                </div>
                <Badge variant={getRiskBadgeVariant(verificationData.riskLevel)}>
                  {verificationData.riskLevel.toUpperCase()} RISK
                </Badge>
                {verificationData.modelsUsed !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    {verificationData.modelsSucceeded}/{verificationData.modelsUsed} Models
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {new Date().toLocaleString('en-GB')}
              </div>
            </div>

            {/* Model Conflicts Warning */}
            {hasConflicts && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-orange-800">Model Conflicts Detected</h3>
                </div>
                <p className="text-sm text-orange-700 mb-3">
                  The AI models disagreed significantly on the following categories:
                </p>
                <div className="space-y-2">
                  {verificationData.conflicts?.map((conflict, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/50 p-2 rounded border border-orange-200">
                      <span className="text-sm font-medium text-orange-800">{conflict.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-orange-600">
                          ±{Math.round(conflict.deviation)} points
                        </span>
                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                          {conflict.models.join(', ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Sources Retrieved */}
            {verificationData.sourcesVerified && verificationData.sourcesVerified.length > 0 && (
              <>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Clinical Sources Retrieved ({verificationData.sourcesVerified.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {verificationData.sourcesVerified.map((source, index) => (
                      <div key={index} className="p-3 border rounded-lg bg-gradient-to-r from-background to-muted/20">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{source.source}</h4>
                            {source.url && (
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline break-all line-clamp-1"
                              >
                                {source.url}
                              </a>
                            )}
                          </div>
                          <Badge 
                            variant={source.trustLevel === 'high' ? 'default' : 'secondary'}
                            className="text-xs ml-2 shrink-0"
                          >
                            {source.trustLevel}
                          </Badge>
                        </div>
                        {source.contentSummary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                            {source.contentSummary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                          {source.verified ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              <span className="text-green-600">Retrieved</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-gray-400" />
                              <span>Not available</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* LLM Consensus */}
            <div>
              <h3 className="font-semibold mb-3">
                AI Model Verification ({verificationData.llmConsensus?.length || 0} Models)
              </h3>
              <div className="space-y-4">
                {verificationData.llmConsensus?.map((llm, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-gradient-to-r from-background to-muted/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusIcon(llm.status)}
                        <Badge variant="outline" className="text-xs font-medium">
                          {llm.model}
                        </Badge>
                        {llm.service && (
                          <Badge variant="secondary" className="text-xs">
                            {llm.service}
                          </Badge>
                        )}
                        <Badge 
                          variant={llm.status === 'success' ? 'outline' : 'destructive'}
                          className="text-xs"
                        >
                          {getStatusLabel(llm.status)}
                        </Badge>
                      </div>
                      {llm.status === 'success' && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md border ${getConfidenceColor(llm.agreementLevel)}`}>
                          {getConfidenceIcon(llm.agreementLevel)}
                          <span className="text-xs font-bold">
                            {llm.agreementLevel}%
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Score breakdown for successful verifications */}
                    {llm.status === 'success' && renderModelScores(llm)}
                    
                    <div className="mt-3">
                      <p className="text-sm font-medium text-foreground mb-1">Assessment:</p>
                      <p className="text-sm text-muted-foreground">
                        {llm.assessment}
                      </p>
                    </div>
                    
                    {llm.concerns && llm.concerns.length > 0 && llm.status === 'success' && (
                      <div className={`mt-3 p-3 rounded-md bg-muted/50 border-l-4 ${
                        llm.agreementLevel >= 85 && !llm.concerns.some(c => c.toLowerCase().includes('require') || c.toLowerCase().includes('need'))
                          ? 'border-l-green-500' 
                          : 'border-l-orange-500'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {llm.agreementLevel >= 85 ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                          )}
                          <p className={`text-sm font-semibold ${
                            llm.agreementLevel >= 85
                              ? 'text-green-700'
                              : 'text-orange-700'
                          }`}>
                            Clinical Considerations:
                          </p>
                        </div>
                        <div className="space-y-1">
                          {llm.concerns.map((concern, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{concern}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

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
                  'This response has been verified by multiple AI models against authoritative clinical sources with acceptable confidence.'}
                {verificationData.verificationStatus === 'flagged' && 
                  'This response has been flagged due to low confidence, model conflicts, or safety concerns. Additional clinical review is strongly recommended.'}
                {verificationData.verificationStatus === 'pending' && 
                  'Verification is still in progress or could not be completed. Please try again.'}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
