import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Brain,
  FileText,
  Code2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LGPatient } from '@/hooks/useLGCapture';

interface LGVerifyServiceModalProps {
  patient: LGPatient;
  onVerificationComplete?: (result: VerificationResult) => void;
}

interface LLMAssessment {
  model: string;
  front_sheet_score: number;
  snomed_score: number;
  completeness_score: number;
  safety_score: number;
  overall_score: number;
  issues: string[];
  assessment: string;
}

interface SnomedCodeVerification {
  term: string;
  code: string;
  rag_rating: 'green' | 'amber' | 'red';
  confidence: number;
  issues: string[];
  verified_by_models: string[];
}

interface VerificationResult {
  overall_rag_rating: 'green' | 'amber' | 'red';
  overall_score: number;
  front_sheet_assessment: {
    rag_rating: 'green' | 'amber' | 'red';
    score: number;
    issues: string[];
    llm_consensus: LLMAssessment[];
  };
  snomed_assessment: {
    rag_rating: 'green' | 'amber' | 'red';
    score: number;
    issues_per_code: SnomedCodeVerification[];
    llm_consensus: LLMAssessment[];
  };
  recommendations: string[];
  verified_at: string;
  models_used: string[];
}

function RAGBadge({ rating, size = 'md' }: { rating: 'green' | 'amber' | 'red'; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-lg px-4 py-2 font-bold',
  };

  const colors = {
    green: 'bg-green-100 text-green-800 border-green-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  };

  const icons = {
    green: <ShieldCheck className="h-4 w-4 mr-1" />,
    amber: <ShieldAlert className="h-4 w-4 mr-1" />,
    red: <ShieldX className="h-4 w-4 mr-1" />,
  };

  return (
    <Badge variant="outline" className={`${colors[rating]} ${sizeClasses[size]} flex items-center`}>
      {icons[rating]}
      {rating.toUpperCase()}
    </Badge>
  );
}

export function LGVerifyServiceModal({ patient, onVerificationComplete }: LGVerifyServiceModalProps) {
  const [open, setOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [frontSheetOpen, setFrontSheetOpen] = useState(false);
  const [snomedOpen, setSnomedOpen] = useState(false);
  const [consensusOpen, setConsensusOpen] = useState(false);

  // Check for existing verification results
  const existingResult = (patient as any).verification_results as VerificationResult | null;
  const existingRag = (patient as any).verification_rag as 'green' | 'amber' | 'red' | null;

  const runVerification = async () => {
    setVerifying(true);
    setProgress(10);

    try {
      // Simulate progress while waiting
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 2000);

      const { data, error } = await supabase.functions.invoke('lg-verify-service', {
        body: {
          patient_id: patient.id,
          practice_ods: patient.practice_ods,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setResult(data);
      onVerificationComplete?.(data);
      toast.success(`Verification complete: ${data.overall_rag_rating.toUpperCase()} (${data.overall_score}%)`);
    } catch (err) {
      console.error('Verification error:', err);
      toast.error('Failed to run verification');
    } finally {
      setVerifying(false);
    }
  };

  const displayResult = result || existingResult;

  const getModelDisplayName = (model: string) => {
    const names: Record<string, string> = {
      'gpt-5': 'GPT-5',
      'claude-sonnet-4': 'Claude Sonnet 4',
      'gemini-2.5-flash': 'Gemini Flash',
      'gemini-2.5-pro': 'Gemini Pro',
    };
    return names[model] || model;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          Verify
          {existingRag && <RAGBadge rating={existingRag} size="sm" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Multi-LLM Verification Service
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          {!displayResult && !verifying && (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-muted rounded-full">
                    <Brain className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Verify Extraction Quality</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    This service sends the extracted clinical summary and SNOMED codes to multiple 
                    independent AI models for verification against the original OCR text.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <FileText className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <p className="font-medium">Front Sheet</p>
                    <p className="text-xs text-muted-foreground">Clinical summary accuracy</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <Code2 className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <p className="font-medium">SNOMED Codes</p>
                    <p className="text-xs text-muted-foreground">Code accuracy & evidence</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <ShieldCheck className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <p className="font-medium">Safety Check</p>
                    <p className="text-xs text-muted-foreground">Hallucination detection</p>
                  </div>
                </div>
                <Button onClick={runVerification} className="w-full" size="lg">
                  <Shield className="mr-2 h-5 w-5" />
                  Run Multi-LLM Verification
                </Button>
              </div>
            </div>
          )}

          {verifying && (
            <div className="space-y-4 py-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h3 className="font-semibold">Verifying with multiple AI models...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  GPT-5, Claude, Gemini Flash, and Gemini Pro are analysing the extraction
                </p>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground">This may take 30-60 seconds</p>
            </div>
          )}

          {displayResult && !verifying && (
            <div className="space-y-4 py-4">
              {/* Hero Section - Verified Badge */}
              <div className="text-center p-6 bg-gradient-to-b from-green-50 to-muted/30 rounded-lg border border-green-200">
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  </div>
                </div>
                <p className="text-sm font-medium text-green-700 uppercase tracking-wide mb-1">Verified</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-green-700">{displayResult.overall_score}%</span>
                  <RAGBadge rating={displayResult.overall_rag_rating} size="md" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Verified by {displayResult.models_used.length} AI models
                </p>
              </div>

              {/* Models Used with Green Ticks */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-sm mb-3 text-center">Models Used</h4>
                <div className="grid grid-cols-2 gap-2">
                  {displayResult.models_used.map((model) => {
                    const assessment = displayResult.front_sheet_assessment.llm_consensus.find(
                      a => a.model === model
                    );
                    return (
                      <div key={model} className="flex items-center justify-between p-2 bg-background rounded border">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">{getModelDisplayName(model)}</span>
                        </div>
                        {assessment && (
                          <span className="text-sm font-semibold text-green-700">{assessment.overall_score}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Collapsible Front Sheet Assessment */}
              <Collapsible open={frontSheetOpen} onOpenChange={setFrontSheetOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {frontSheetOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">Front Sheet Quality</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RAGBadge rating={displayResult.front_sheet_assessment.rag_rating} size="sm" />
                      <span className="font-semibold">{displayResult.front_sheet_assessment.score}%</span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 pl-6 pr-2">
                    {displayResult.front_sheet_assessment.issues.length > 0 ? (
                      <div className="space-y-1">
                        {displayResult.front_sheet_assessment.issues.map((issue, i) => (
                          <div key={i} className="text-sm flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            {issue}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground p-2">No issues found</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Collapsible SNOMED Assessment */}
              <Collapsible open={snomedOpen} onOpenChange={setSnomedOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {snomedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Code2 className="h-4 w-4" />
                      <span className="font-medium">SNOMED Code Accuracy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RAGBadge rating={displayResult.snomed_assessment.rag_rating} size="sm" />
                      <span className="font-semibold">{displayResult.snomed_assessment.score}%</span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 pl-6 pr-2">
                    {displayResult.snomed_assessment.issues_per_code.length > 0 ? (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {displayResult.snomed_assessment.issues_per_code.slice(0, 10).map((code, i) => (
                          <div key={i} className="text-sm flex items-center justify-between p-2 bg-background rounded border">
                            <div className="flex items-center gap-2">
                              <RAGBadge rating={code.rag_rating} size="sm" />
                              <span>{code.term}</span>
                            </div>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{code.code}</code>
                          </div>
                        ))}
                        {displayResult.snomed_assessment.issues_per_code.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center">
                            + {displayResult.snomed_assessment.issues_per_code.length - 10} more codes
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground p-2">No SNOMED code issues</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Recommendations */}
              {displayResult.recommendations.length > 0 && (
                <div className="p-3 bg-primary/5 rounded-lg">
                  <h4 className="font-medium mb-2 text-sm">Recommendations</h4>
                  <div className="space-y-1">
                    {displayResult.recommendations.map((rec, i) => (
                      <div key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible LLM Consensus */}
              <Collapsible open={consensusOpen} onOpenChange={setConsensusOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {consensusOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Brain className="h-4 w-4" />
                      <span className="font-medium">LLM Consensus Details</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Click to expand</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2">
                    {displayResult.front_sheet_assessment.llm_consensus.map((assessment, i) => (
                      <div key={i} className="text-sm p-3 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <Badge variant="secondary">{getModelDisplayName(assessment.model)}</Badge>
                          </div>
                          <span className="font-semibold">{assessment.overall_score}%</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Front Sheet:</span>
                            <span className="ml-1 font-medium">{assessment.front_sheet_score}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">SNOMED:</span>
                            <span className="ml-1 font-medium">{assessment.snomed_score}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Complete:</span>
                            <span className="ml-1 font-medium">{assessment.completeness_score}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Safety:</span>
                            <span className="ml-1 font-medium">{assessment.safety_score}%</span>
                          </div>
                        </div>
                        {assessment.assessment && (
                          <p className="text-xs text-muted-foreground mt-2">{assessment.assessment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Verified timestamp */}
              <p className="text-xs text-muted-foreground text-center">
                Verified at: {new Date(displayResult.verified_at).toLocaleString('en-GB')}
              </p>

              {/* Re-run button */}
              <Button onClick={runVerification} variant="outline" className="w-full">
                <Shield className="mr-2 h-4 w-4" />
                Re-run Verification
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}