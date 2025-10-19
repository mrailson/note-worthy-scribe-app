import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SpeechToText } from '@/components/SpeechToText';
import { CheckCircle2, AlertCircle, Loader2, CheckCircle, ClipboardCheck, Sparkles } from 'lucide-react';

interface QuestionnaireData {
  investigation_complete: boolean;
  outcome_type?: 'upheld' | 'partially_upheld' | 'not_upheld';
  tone: 'professional' | 'empathetic' | 'apologetic' | 'factual' | 'strong' | 'firm';
  key_findings: string;
  actions_taken: string;
  improvements_made: string;
  additional_context: string;
  is_vexatious: boolean;
}

interface ComplianceCheck {
  id: string;
  compliance_item: string;
  is_compliant: boolean;
  evidence: string | null;
  notes: string | null;
  checked_at: string | null;
  checked_by: string | null;
}

interface ComplaintOutcomeQuestionnaireProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaintId: string;
  complaintData: {
    reference_number: string;
    complaint_description: string;
    category: string;
    created_at?: string;
    acknowledged_at?: string;
  };
  onSuccess: () => void;
}

export const ComplaintOutcomeQuestionnaire = ({
  open,
  onOpenChange,
  complaintId,
  complaintData,
  onSuccess,
}: ComplaintOutcomeQuestionnaireProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestedOutcome, setAiSuggestedOutcome] = useState<string>('');
  const [aiAnalysisText, setAiAnalysisText] = useState<string>('');
  const [confirmProfessionalJudgement, setConfirmProfessionalJudgement] = useState<boolean>(false);
  const [data, setData] = useState<QuestionnaireData>({
    investigation_complete: false,
    outcome_type: undefined,
    tone: 'professional',
    key_findings: '',
    actions_taken: '',
    improvements_made: '',
    additional_context: '',
    is_vexatious: false,
  });
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [activeValidationTab, setActiveValidationTab] = useState('investigation');
  const [demoResponse, setDemoResponse] = useState<{
    key_findings: string;
    actions_taken: string;
    improvements_made: string;
    additional_context: string;
  } | null>(null);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const complaintReference = complaintData.reference_number || '';

  // Fetch demo response from database for this complaint
  useEffect(() => {
    const fetchDemoResponse = async () => {
      if (!complaintReference) return;
      
      const { data: dbResponse, error } = await supabase
        .from('complaint_demo_responses')
        .select('key_findings, actions_taken, improvements_made, additional_context')
        .eq('complaint_reference', complaintReference)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching demo response:', error);
      }
      
      if (dbResponse) {
        console.log('Demo response loaded for complaint:', complaintReference, dbResponse);
        setDemoResponse(dbResponse);
      } else {
        console.log('No demo response found for complaint:', complaintReference);
      }
    };
    
    if (open) {
      fetchDemoResponse();
    }
  }, [open, complaintReference]);

  // Get demo replies from database (or return empty for non-demo complaints)
  const getDemoReplies = () => {
    // If we have a demo response from the database, use it
    if (demoResponse) {
      return demoResponse;
    }
    
    // No demo response available - return empty for non-demo complaints
    return {
      key_findings: "",
      actions_taken: "",
      improvements_made: "",
      additional_context: ""
    };
  };

  const loadDemoReply = (field: 'key_findings' | 'actions_taken' | 'improvements_made' | 'additional_context') => {
    const demoReplies = getDemoReplies();
    const content = demoReplies[field];
    
    if (!content || content.trim() === '') {
      toast({
        title: "No demo content available",
        description: "There is no pre-filled content available for this field.",
        variant: "default",
      });
      return;
    }
    
    setData(prevData => ({ ...prevData, [field]: content }));
    
    toast({
      title: "Demo reply loaded",
      description: "Pre-filled content has been added to the field.",
    });
  };

  useEffect(() => {
    if (open) {
      fetchComplianceChecks();
    }
  }, [open, complaintId]);

  const fetchComplianceChecks = async () => {
    try {
      // Initialize compliance checks if they don't exist
      const { error: initError } = await supabase
        .rpc('initialize_complaint_compliance', { complaint_id_param: complaintId });

      if (initError) {
        console.error('Error initializing compliance:', initError);
      }

      // Fetch compliance checks
      const { data: checks, error: checksError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (checksError) throw checksError;

      // Auto-confirm eligible items in the database
      const user = await supabase.auth.getUser();
      if (user.data.user && checks) {
        for (const check of checks) {
          let shouldAutoConfirm = false;
          
          // Auto-confirm: Complaint logged in practice register
          if (check.compliance_item.includes('logged in practice register') && !check.is_compliant) {
            shouldAutoConfirm = true;
          }
          
          // Auto-confirm: Acknowledgement sent within 3 working days
          if (check.compliance_item.includes('Acknowledgement sent within 3 working days') && 
              !check.is_compliant &&
              complaintData.acknowledged_at && complaintData.created_at) {
            const created = new Date(complaintData.created_at);
            const acknowledged = new Date(complaintData.acknowledged_at);
            const diffInDays = Math.floor((acknowledged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            if (diffInDays <= 3) {
              shouldAutoConfirm = true;
            }
          }
          
          // Update in database if should be auto-confirmed
          if (shouldAutoConfirm) {
            await supabase
              .from('complaint_compliance_checks')
              .update({ 
                is_compliant: true, 
                checked_at: new Date().toISOString(),
                checked_by: user.data.user.id,
                notes: 'Auto-confirmed based on complaint data'
              })
              .eq('id', check.id);
          }
        }
      }

      // Fetch updated checks
      const { data: updatedChecks, error: updatedError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (updatedError) throw updatedError;
      setComplianceChecks(updatedChecks || []);

      // Get compliance summary
      const { data: summary, error: summaryError } = await supabase
        .rpc('get_complaint_compliance_summary', { complaint_id_param: complaintId });

      if (summaryError) throw summaryError;
      if (summary && summary.length > 0) {
        setComplianceSummary(summary[0]);
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    }
  };

  const updateComplianceCheck = async (checkId: string, isCompliant: boolean) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('complaint_compliance_checks')
        .update({ 
          is_compliant: isCompliant, 
          checked_at: new Date().toISOString(),
          checked_by: user.data.user.id 
        })
        .eq('id', checkId);

      if (error) throw error;

      // Update local state
      setComplianceChecks(prev => 
        prev.map(check => 
          check.id === checkId 
            ? { ...check, is_compliant: isCompliant, checked_at: new Date().toISOString() }
            : check
        )
      );

      // Refresh compliance summary
      fetchComplianceChecks();
    } catch (error) {
      console.error('Error updating compliance check:', error);
    }
  };

  const markAllCompliant = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      const nonCompliantChecks = complianceChecks.filter(check => !check.is_compliant);

      if (nonCompliantChecks.length === 0) {
        return;
      }

      for (const check of nonCompliantChecks) {
        const { error } = await supabase
          .from('complaint_compliance_checks')
          .update({
            is_compliant: true,
            checked_at: new Date().toISOString(),
            checked_by: user.data.user.id
          })
          .eq('id', check.id);

        if (error) throw error;
      }

      setComplianceChecks(prev => 
        prev.map(check => ({
          ...check,
          is_compliant: true,
          checked_at: new Date().toISOString()
        }))
      );

      fetchComplianceChecks();
    } catch (error) {
      console.error('Error marking all items as compliant:', error);
    }
  };

  // AI Analysis function
  const analyzeComplaintOutcome = async () => {
    setIsAnalyzing(true);
    setAiSuggestedOutcome('');
    setAiAnalysisText('');

    try {
      const { data: analysisData, error } = await supabase.functions.invoke(
        'analyze-complaint-outcome',
        {
          body: { complaintId }
        }
      );

      if (error) throw error;

      if (analysisData?.analysis) {
        setAiAnalysisText(analysisData.analysis);
        
        // Extract suggested outcome from analysis
        const analysisLower = analysisData.analysis.toLowerCase();
        if (analysisLower.includes('rejected') || analysisLower.includes('not upheld') || analysisLower.includes('not_upheld')) {
          setAiSuggestedOutcome('not_upheld');
        } else if (analysisLower.includes('partially upheld') || analysisLower.includes('partially_upheld')) {
          setAiSuggestedOutcome('partially_upheld');
        } else if (analysisLower.includes('upheld')) {
          setAiSuggestedOutcome('upheld');
        }
      }
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast({
        title: 'AI Analysis Failed',
        description: 'Could not generate AI analysis. You can still select an outcome manually.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Trigger AI analysis when reaching Step 4
  useEffect(() => {
    if (step === 4 && open && !aiAnalysisText && !isAnalyzing) {
      analyzeComplaintOutcome();
    }
  }, [step, open]);

  const handleNext = () => {
    if (step === 1) {
      // Check required fields but show visual feedback
      if (!data.investigation_complete) {
        // Highlight the investigation validation tab if they're on compliance tab
        if (activeValidationTab === 'compliance') {
          setActiveValidationTab('investigation');
        }
        return;
      }
    }

    if (step === 2) {
      if (!data.key_findings || data.key_findings.length < 20) {
        return;
      }
    }

    if (step === 4) {
      // Ensure outcome is selected before proceeding
      if (!data.outcome_type) {
        toast({
          title: 'Outcome Required',
          description: 'Please select an outcome decision before proceeding.',
          variant: 'destructive',
        });
        return;
      }
      
      // Ensure professional judgement confirmation is checked
      if (!confirmProfessionalJudgement) {
        toast({
          title: 'Confirmation Required',
          description: 'Please confirm that you have reviewed all evidence and are making this decision based on your professional judgement.',
          variant: 'destructive',
        });
        return;
      }
    }

    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    console.log('=== Starting outcome letter generation ===');
    
    // Validate outcome type is selected
    if (!data.outcome_type) {
      toast({
        title: 'Outcome Required',
        description: 'Please select an outcome decision (upheld, partially upheld, or not upheld).',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Get current user
      console.log('Step 1: Getting current user...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      console.log('User authenticated:', user.id);

      // Auto-set vexatious flag based on tone
      const finalData = {
        ...data,
        is_vexatious: data.tone === 'strong' || data.tone === 'firm',
        ai_analysis: aiAnalysisText // Save AI analysis for future reference
      };
      console.log('Final data prepared:', finalData);

      // Save questionnaire to database using RPC function
      console.log('Step 2: Saving questionnaire to database via RPC...');
      console.log('Questionnaire data:', finalData);
      console.log('Complaint ID:', complaintId);
      
      const { data: questionnaireId, error: saveError } = await supabase
        .rpc('create_complaint_outcome_questionnaire', {
          p_complaint_id: complaintId,
          p_questionnaire_data: finalData as any,
        });

      if (saveError) {
        console.error('!!! RPC ERROR saving questionnaire !!!');
        console.error('Error details:', saveError);
        alert(`Failed to save questionnaire: ${saveError.message}`);
        throw saveError;
      }
      
      if (!questionnaireId) {
        console.error('!!! RPC returned no questionnaire ID !!!');
        alert('Failed to save questionnaire: No ID returned');
        throw new Error('No questionnaire ID returned from RPC');
      }
      
      console.log('✓ Questionnaire saved successfully (RPC returned id):', questionnaireId);

      // Generate outcome letter using edge function
      console.log('Step 3: Calling edge function to generate letter...');
      console.log('Edge function params:', {
        complaintId,
        outcomeType: finalData.outcome_type,
        outcomeSummaryLength: finalData.key_findings?.length,
      });
      
      const { data: letterData, error: letterError } = await supabase.functions.invoke(
        'generate-complaint-outcome-letter',
        {
          body: {
            complaintId,
            outcomeType: finalData.outcome_type,
            outcomeSummary: finalData.key_findings,
            questionnaireData: finalData,
          },
        }
      );

      if (letterError) {
        console.error('Edge function error:', letterError);
        throw letterError;
      }
      
      if (!letterData || !letterData.outcomeLetter) {
        console.error('No outcome letter returned from edge function:', letterData);
        throw new Error('No outcome letter generated');
      }
      
      console.log('Outcome letter generated successfully, length:', letterData.outcomeLetter?.length);

      // Ensure outcome type is valid before saving
      if (!finalData.outcome_type || !['upheld', 'partially_upheld', 'not_upheld'].includes(finalData.outcome_type)) {
        throw new Error('Invalid outcome type selected');
      }

      // Map UI value to DB-allowed values
      const dbOutcomeType = finalData.outcome_type === 'not_upheld' ? 'rejected' : finalData.outcome_type;

      // Save the generated outcome letter using RPC function
      console.log('Step 4: Saving outcome letter to database via RPC...');
      console.log('Outcome data to save:', {
        complaint_id: complaintId,
        outcome_type: dbOutcomeType,
        outcome_summary: finalData.key_findings,
        letter_length: letterData.outcomeLetter?.length,
      });
      
      const { data: outcomeId, error: outcomeError } = await supabase
        .rpc('create_complaint_outcome', {
          p_complaint_id: complaintId,
          p_outcome_type: dbOutcomeType,
          p_outcome_summary: finalData.key_findings,
          p_outcome_letter: letterData.outcomeLetter,
        });

      if (outcomeError) {
        console.error('!!! RPC ERROR SAVING OUTCOME LETTER !!!');
        console.error('Error code:', outcomeError.code);
        console.error('Error message:', outcomeError.message);
        console.error('Error details:', outcomeError.details);
        console.error('Error hint:', outcomeError.hint);
        alert(`Failed to save outcome letter via RPC: ${outcomeError.message}. Check console for details.`);
        throw outcomeError;
      }
      
      if (!outcomeId) {
        console.error('!!! RPC returned no outcome ID !!!');
        alert('Outcome letter may not have been saved properly - no ID returned');
      } else {
        console.log('✓ Outcome letter saved successfully via RPC, ID:', outcomeId);
      }

      // Update complaint status to closed
      console.log('Step 5: Updating complaint status to closed...');
      const { error: statusError } = await supabase
        .from('complaints')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', complaintId);

      if (statusError) {
        console.error('Failed to update complaint status:', statusError);
        // Don't fail the main process, outcome letter was still saved
      } else {
        console.log('Complaint status updated to closed');
      }

      console.log('=== Outcome letter generation completed successfully ===');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('!!! ERROR IN OUTCOME LETTER GENERATION !!!');
      console.error('Error details:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      alert(`Failed to generate outcome letter: ${error?.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setIsSubmitting(false);
      console.log('=== Outcome letter generation process ended ===');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Complaint Outcome Letter</DialogTitle>
          <DialogDescription>
            Reference: {complaintData.reference_number} | Step {step} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="mb-4" />

        {/* Step 1: Investigation Validation */}
        {step === 1 && (
          <div className="space-y-6">
            <Tabs value={activeValidationTab} onValueChange={setActiveValidationTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="investigation">Investigation Validation</TabsTrigger>
                <TabsTrigger value="compliance">
                  CQC Compliance Review{complianceSummary?.compliance_percentage === 100 ? ' (Completed)' : ''}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="investigation" className="space-y-4 mt-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3">Confirm Investigation Complete</h3>
                  
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="investigation_complete"
                      checked={data.investigation_complete}
                      onCheckedChange={(checked) =>
                        setData({ ...data, investigation_complete: checked as boolean })
                      }
                    />
                    <Label htmlFor="investigation_complete" className="text-sm font-normal cursor-pointer">
                      Investigation has been completed and all parties have been consulted *
                    </Label>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="text-blue-900">
                    <strong>Note:</strong> The outcome will be determined at the end after AI analysis of all investigation details.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="compliance" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5" />
                      <h3 className="text-lg font-medium">CQC Compliance Review (Optional)</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {complianceSummary && (
                        <Badge variant="outline" className="text-sm">
                          {complianceSummary.compliant_items} / {complianceSummary.total_items} Complete
                          ({complianceSummary.compliance_percentage}%)
                        </Badge>
                      )}
                      {complianceChecks.length > 0 && complianceSummary?.compliance_percentage !== 100 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={markAllCompliant}
                          className="text-sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark All Completed
                        </Button>
                      )}
                    </div>
                  </div>

                  {complianceSummary && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">Compliance Progress</span>
                        <span className="text-sm text-blue-800">{complianceSummary.compliance_percentage}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${complianceSummary.compliance_percentage}%` }}
                        ></div>
                      </div>
                      {complianceSummary.outstanding_items && complianceSummary.outstanding_items.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-blue-800 font-medium">Outstanding Items:</p>
                          <ul className="mt-1 text-sm text-blue-700">
                            {complianceSummary.outstanding_items.slice(0, 3).map((item: string, index: number) => (
                              <li key={index} className="truncate">• {item}</li>
                            ))}
                            {complianceSummary.outstanding_items.length > 3 && (
                              <li className="text-blue-600">...and {complianceSummary.outstanding_items.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {complianceChecks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No compliance checks available for this complaint
                      </div>
                    ) : (
                      complianceChecks.map((check) => (
                        <div 
                          key={check.id} 
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            check.is_compliant 
                              ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => updateComplianceCheck(check.id, !check.is_compliant)}
                        >
                          <Checkbox
                            id={check.id}
                            checked={check.is_compliant}
                            onCheckedChange={(checked) => updateComplianceCheck(check.id, checked as boolean)}
                            className="mt-1 pointer-events-none"
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={check.id}
                              className={`text-sm cursor-pointer ${
                                check.is_compliant 
                                  ? 'line-through text-muted-foreground' 
                                  : ''
                              }`}
                            >
                              {check.compliance_item}
                            </Label>
                            {check.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{check.notes}</p>
                            )}
                            {check.checked_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Checked: {new Date(check.checked_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          {check.is_compliant && (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                    <p className="text-amber-900">
                      <strong>Note:</strong> This compliance review is optional and provided as a helpful quality assurance tool. 
                      Items marked with auto-confirmation have been verified based on complaint data.
                    </p>
                  </div>
                  
                  {!data.investigation_complete && (
                    <div className="p-3 bg-blue-50 border border-blue-300 rounded text-sm">
                      <p className="text-blue-900">
                        <strong>Reminder:</strong> Before proceeding to the next step, please switch to the "Investigation Validation" tab 
                        and complete the required fields (investigation checkbox and outcome type).
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Step 2: Letter Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Letter Tone
              </Label>
              <Select value={data.tone} onValueChange={(value: any) => setData({ ...data, tone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional (Default)</SelectItem>
                  <SelectItem value="empathetic">Empathetic</SelectItem>
                  <SelectItem value="apologetic">Apologetic</SelectItem>
                  <SelectItem value="factual">Factual</SelectItem>
                  <SelectItem value="strong">Strong (Vexatious)</SelectItem>
                  <SelectItem value="firm">Firm (Vexatious)</SelectItem>
                </SelectContent>
              </Select>
              {(data.tone === 'strong' || data.tone === 'firm') && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  This tone will automatically mark the complaint as vexatious
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">
                  Brief Summary of Key Findings * (Max 150 chars)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {data.key_findings.length}/150
                </span>
              </div>
              <Textarea
                value={data.key_findings}
                onChange={(e) => setData({ ...data, key_findings: e.target.value.slice(0, 150) })}
                placeholder="Summarise the main findings in 2-3 sentences..."
                rows={3}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, key_findings: (prevData.key_findings + ' ' + text).slice(0, 150) }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('key_findings')}
                  className="h-8 w-8 shrink-0"
                  title="Load demo reply"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">
                  Actions Already Taken or Planned (Max 150 chars, optional)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {data.actions_taken.length}/150
                </span>
              </div>
              <Textarea
                value={data.actions_taken}
                onChange={(e) => setData({ ...data, actions_taken: e.target.value.slice(0, 150) })}
                placeholder="What actions have been or will be taken?"
                rows={2}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, actions_taken: (prevData.actions_taken + ' ' + text).slice(0, 150) }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('actions_taken')}
                  className="h-8 w-8 shrink-0"
                  title="Load demo reply"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">
                  Service Improvements Made (Max 150 chars, optional)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {data.improvements_made.length}/150
                </span>
              </div>
              <Textarea
                value={data.improvements_made}
                onChange={(e) => setData({ ...data, improvements_made: e.target.value.slice(0, 150) })}
                placeholder="What improvements have been made to prevent recurrence?"
                rows={2}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, improvements_made: (prevData.improvements_made + ' ' + text).slice(0, 150) }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('improvements_made')}
                  className="h-8 w-8 shrink-0"
                  title="Load demo reply"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Final Review */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Review Your Investigation Details</h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Investigation:</span> ✓ Complete
                </div>
                {complianceSummary && (
                  <div>
                    <span className="font-medium">CQC Compliance:</span> {complianceSummary.compliant_items}/{complianceSummary.total_items} items ({complianceSummary.compliance_percentage}%)
                  </div>
                )}
                <div>
                  <span className="font-medium">Tone:</span> {data.tone.charAt(0).toUpperCase() + data.tone.slice(1)}
                  {(data.tone === 'strong' || data.tone === 'firm') && ' (Vexatious)'}
                </div>
                <div>
                  <span className="font-medium">Key Findings:</span> {data.key_findings}
                </div>
                {data.actions_taken && (
                  <div>
                    <span className="font-medium">Actions:</span> {data.actions_taken}
                  </div>
                )}
                {data.improvements_made && (
                  <div>
                    <span className="font-medium">Improvements:</span> {data.improvements_made}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">
                  Any Additional Context (Max 200 chars, optional)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {data.additional_context.length}/200
                </span>
              </div>
              <Textarea
                value={data.additional_context}
                onChange={(e) => setData({ ...data, additional_context: e.target.value.slice(0, 200) })}
                placeholder="Any other context or special instructions for the letter..."
                rows={3}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, additional_context: (prevData.additional_context + ' ' + text).slice(0, 200) }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('additional_context')}
                  className="h-8 w-8 shrink-0"
                  title="Load demo reply"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-900">
              <p className="font-medium mb-1">Next step:</p>
              <p className="text-xs">AI will analyse all investigation details and suggest an outcome decision</p>
            </div>
          </div>
        )}

        {/* Step 4: AI Outcome Analysis */}
        {step === 4 && (
          <div className="space-y-6">
            {/* AI Disclaimer Banner */}
            <Alert className="bg-amber-50 border-amber-300">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertTitle className="text-amber-900 font-semibold">AI GUIDANCE ONLY</AlertTitle>
              <AlertDescription className="text-amber-800 text-sm leading-relaxed">
                The AI-generated recommendation below is provided as guidance to support your decision-making process. The final decision on whether to uphold, partially uphold, or not uphold this complaint must be made by appropriately qualified staff based on thorough review of all evidence. <strong>Human oversight and professional judgement are essential.</strong>
              </AlertDescription>
            </Alert>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">AI Outcome Analysis</h3>
              </div>

              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm text-blue-700">Analysing complaint details, staff responses, and investigation findings...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {aiSuggestedOutcome && (
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">AI Guidance: Suggested Outcome (For Reference Only)</span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">This is a suggestion only - you are not required to follow this recommendation</p>
                      <Badge 
                        variant={
                          aiSuggestedOutcome === 'upheld' ? 'destructive' : 
                          aiSuggestedOutcome === 'partially_upheld' ? 'default' : 
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {aiSuggestedOutcome === 'upheld' ? 'Upheld' : 
                         aiSuggestedOutcome === 'partially_upheld' ? 'Partially Upheld' : 
                         'Not Upheld'}
                      </Badge>
                    </div>
                  )}

                  {aiAnalysisText && (
                    <div className="bg-white p-4 rounded border border-blue-200 max-h-[300px] overflow-y-auto">
                      <div className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {aiAnalysisText.replace(/\*\*/g, '').replace(/##/g, '')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Your Final Decision *
              </Label>
              <p className="text-xs text-slate-600 mb-2">
                The practice is solely responsible for deciding the final outcome. You may accept, modify, or completely disregard the AI suggestion based on your professional judgement and complete review of all evidence.
              </p>
              <Select 
                value={data.outcome_type} 
                onValueChange={(value: any) => setData({ ...data, outcome_type: value })}
                disabled={isAnalyzing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upheld">Complaint Upheld</SelectItem>
                  <SelectItem value="partially_upheld">Complaint Partially Upheld</SelectItem>
                  <SelectItem value="not_upheld">Complaint Not Upheld</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Professional Judgement Confirmation */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="confirm-judgement"
                  checked={confirmProfessionalJudgement}
                  onCheckedChange={(checked) => setConfirmProfessionalJudgement(checked as boolean)}
                  className="mt-1"
                />
                <label 
                  htmlFor="confirm-judgement"
                  className="text-sm text-slate-700 leading-relaxed cursor-pointer"
                >
                  <strong>Required confirmation:</strong> I confirm that I have reviewed all evidence and am making this decision based on my professional judgement, not solely on AI recommendation.
                </label>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-900">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Your answers will be saved for audit purposes</li>
                <li>An outcome letter will be automatically generated</li>
                <li>You can review and edit the letter before sending</li>
                <li>The complaint status will be updated to closed</li>
                <li>The outcome decision is entirely your responsibility and cannot be delegated to AI systems</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            Back
          </Button>
          
          {step < totalSteps ? (
            <Button onClick={handleNext} disabled={isSubmitting || (step === 4 && isAnalyzing)}>
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || isAnalyzing || !data.outcome_type || !confirmProfessionalJudgement} 
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Letter...
                </>
              ) : (
                'Generate Outcome Letter'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
