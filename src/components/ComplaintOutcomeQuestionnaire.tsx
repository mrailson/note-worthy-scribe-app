import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SpeechToText } from '@/components/SpeechToText';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface QuestionnaireData {
  investigation_complete: boolean;
  parties_consulted: boolean;
  fair_consideration: boolean;
  outcome_type: 'upheld' | 'partially_upheld' | 'not_upheld' | '';
  tone: 'professional' | 'empathetic' | 'apologetic' | 'factual' | 'strong' | 'firm';
  key_findings: string;
  actions_taken: string;
  improvements_made: string;
  additional_context: string;
  is_vexatious: boolean;
}

interface ComplaintOutcomeQuestionnaireProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaintId: string;
  complaintData: {
    reference_number: string;
    complaint_description: string;
    category: string;
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
  const [data, setData] = useState<QuestionnaireData>({
    investigation_complete: false,
    parties_consulted: false,
    fair_consideration: false,
    outcome_type: '',
    tone: 'professional',
    key_findings: '',
    actions_taken: '',
    improvements_made: '',
    additional_context: '',
    is_vexatious: false,
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step === 1) {
      if (!data.fair_consideration) {
        toast({
          title: 'CQC Compliance Required',
          description: 'You must confirm that all complaint items were investigated fairly before proceeding.',
          variant: 'destructive',
        });
        return;
      }
      if (!data.outcome_type) {
        toast({
          title: 'Outcome Required',
          description: 'Please select the outcome type.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (step === 2) {
      if (!data.key_findings || data.key_findings.length < 20) {
        toast({
          title: 'Key Findings Required',
          description: 'Please provide a brief summary of key findings (at least 20 characters).',
          variant: 'destructive',
        });
        return;
      }
    }

    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save questionnaire to database
      const { data: savedQuestionnaire, error: saveError } = await supabase
        .from('complaint_outcome_questionnaires')
        .insert([{
          complaint_id: complaintId,
          created_by: user.id,
          questionnaire_data: data as any,
        }])
        .select()
        .single();

      if (saveError) throw saveError;

      // Generate outcome letter using edge function
      const { data: letterData, error: letterError } = await supabase.functions.invoke(
        'generate-complaint-outcome-letter',
        {
          body: {
            complaintId,
            outcomeType: data.outcome_type,
            outcomeSummary: data.key_findings,
            questionnaireData: data,
          },
        }
      );

      if (letterError) throw letterError;

      // Save the generated outcome letter
      const { error: outcomeError } = await supabase
        .from('complaint_outcomes')
        .insert({
          complaint_id: complaintId,
          outcome_type: data.outcome_type,
          outcome_summary: data.key_findings,
          outcome_letter: letterData.outcomeLetter,
          decided_by: user.id,
        });

      if (outcomeError) throw outcomeError;

      // Update complaint status to closed
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
      }

      toast({
        title: 'Success',
        description: 'Outcome letter generated and complaint closed successfully!',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error generating outcome letter:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate outcome letter',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Investigation Validation</h3>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="investigation_complete"
                    checked={data.investigation_complete}
                    onCheckedChange={(checked) =>
                      setData({ ...data, investigation_complete: checked as boolean })
                    }
                  />
                  <Label htmlFor="investigation_complete" className="text-sm font-normal cursor-pointer">
                    All complaint items have been thoroughly investigated
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="parties_consulted"
                    checked={data.parties_consulted}
                    onCheckedChange={(checked) =>
                      setData({ ...data, parties_consulted: checked as boolean })
                    }
                  />
                  <Label htmlFor="parties_consulted" className="text-sm font-normal cursor-pointer">
                    All parties involved have been consulted
                  </Label>
                </div>

                <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="fair_consideration"
                      checked={data.fair_consideration}
                      onCheckedChange={(checked) =>
                        setData({ ...data, fair_consideration: checked as boolean })
                      }
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor="fair_consideration" className="text-sm font-semibold cursor-pointer text-amber-900">
                        CQC Compliance Confirmation *
                      </Label>
                      <p className="text-xs text-amber-800 mt-1">
                        Are you happy that all the patient's complaint items were investigated and properly
                        considered in a fair way?
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Outcome Type *
              </Label>
              <Select value={data.outcome_type} onValueChange={(value: any) => setData({ ...data, outcome_type: value })}>
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

            <div className="flex items-start space-x-2">
              <Checkbox
                id="is_vexatious"
                checked={data.is_vexatious}
                onCheckedChange={(checked) => setData({ ...data, is_vexatious: checked as boolean })}
              />
              <Label htmlFor="is_vexatious" className="text-sm font-normal cursor-pointer">
                This complaint is vexatious or unreasonable
              </Label>
            </div>
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
              {(data.tone === 'strong' || data.tone === 'firm') && !data.is_vexatious && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  You selected a strong tone but didn't mark this as vexatious
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
              <SpeechToText
                onTranscription={(text) =>
                  setData({ ...data, key_findings: (data.key_findings + ' ' + text).slice(0, 150) })
                }
                className="w-full"
              />
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
              <SpeechToText
                onTranscription={(text) =>
                  setData({ ...data, actions_taken: (data.actions_taken + ' ' + text).slice(0, 150) })
                }
                className="w-full"
              />
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
              <SpeechToText
                onTranscription={(text) =>
                  setData({ ...data, improvements_made: (data.improvements_made + ' ' + text).slice(0, 150) })
                }
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Step 3: Final Review */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Review Your Answers</h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Outcome:</span> {data.outcome_type.replace('_', ' ').toUpperCase()}
                </div>
                <div>
                  <span className="font-medium">Tone:</span> {data.tone.charAt(0).toUpperCase() + data.tone.slice(1)}
                </div>
                <div>
                  <span className="font-medium">CQC Compliance:</span>{' '}
                  {data.fair_consideration ? '✓ Confirmed' : '✗ Not confirmed'}
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
              <SpeechToText
                onTranscription={(text) =>
                  setData({ ...data, additional_context: (data.additional_context + ' ' + text).slice(0, 200) })
                }
                className="w-full"
              />
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-900">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Your answers will be saved for audit purposes</li>
                <li>An outcome letter will be automatically generated</li>
                <li>You can review and edit the letter before sending</li>
                <li>The complaint status will be updated to closed</li>
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
            <Button onClick={handleNext} disabled={isSubmitting}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
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
