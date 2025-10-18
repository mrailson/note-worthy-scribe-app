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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SpeechToText } from '@/components/SpeechToText';
import { CheckCircle2, AlertCircle, Loader2, CheckCircle, ClipboardCheck, Sparkles } from 'lucide-react';

interface QuestionnaireData {
  investigation_complete: boolean;
  outcome_type: 'upheld' | 'partially_upheld' | 'not_upheld' | '';
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
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<QuestionnaireData>({
    investigation_complete: false,
    outcome_type: '',
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

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  // Generate contextually relevant demo replies specific to each demo complaint
  const getDemoReplies = () => {
    const refNumber = complaintData.reference_number || '';
    const description = complaintData.complaint_description?.toLowerCase() || '';
    
    // Specific replies for each demo complaint by reference number
    if (refNumber === 'COMP250001') {
      // Communication Issues - Queue waiting and receptionist asking about problem
      return {
        key_findings: "Investigation confirmed that Mr Clarke's call was received during peak morning hours (8:30-9:00am) when call volumes are highest. Receptionist followed NHS England guidance requiring brief triage information to prioritise urgent calls. Average wait time that morning was 8 minutes, which exceeds our 5-minute target.",
        actions_taken: "Personal apology letter sent to Mr Clarke. Additional receptionist cover added during peak hours. New cloud-based phone system installed with callback facility. Triage protocol leaflet sent explaining NHS requirements for prioritising urgent medical needs.",
        improvements_made: "Implemented callback option for waits over 3 minutes. Recruited additional part-time receptionist. Created patient information leaflet explaining confidentiality protections and why basic triage questions are necessary. Monthly monitoring of call wait times.",
        additional_context: "Mr Clarke offered face-to-face meeting with practice manager to discuss concerns. Explained that receptionists asking about nature of problem is NHS guidance, not practice nosiness. Confidentiality training certificates available for his review. Complaints policy updated to include explanation of phone triage requirements."
      };
    } else if (refNumber === 'COMP250003') {
      // Prescriptions - Wrong inhaler issued to Anita Patel
      return {
        key_findings: "Investigation identified dispensing error at pharmacy, not prescribing error. Dr Shah correctly prescribed Clenil (preventer inhaler). Pharmacy dispensed Ventolin (reliever) instead. Root cause: Similar packaging and inadequate final check by locum pharmacist. Mrs Patel's asthma control was not compromised as she had sufficient preventer inhaler remaining.",
        actions_taken: "Immediate meeting held with pharmacy manager. Locum pharmacist provided with additional supervision. New dispensing double-check protocol implemented. Mrs Patel offered home delivery of correct medication same day. Personal apology from pharmacy manager and lead GP.",
        improvements_made: "Electronic prescription system now flags look-alike/sound-alike medications. Mandatory final check by qualified pharmacist before handover. Colour-coded shelf labels for respiratory medications. Monthly dispensing error audits. Staff training on high-risk medication identification.",
        additional_context: "Incident reported to NHS England as per patient safety protocols. Learning shared at PCN medicines management meeting. Mrs Patel offered annual asthma review with practice nurse and direct contact number for any future prescription concerns. No harm occurred but near-miss taken very seriously."
      };
    } else if (refNumber === 'COMP250004') {
      // Clinical Care - 45 minute wait, rude receptionist Emma, rushed Dr Sarah Smith
      return {
        key_findings: "Investigation confirmed 42-minute delay due to two emergency patients requiring urgent GP attention. Receptionist Emma Thompson provided updates twice but acknowledges her tone may have appeared dismissive during particularly busy period. Dr Smith confirms consultation was shorter than ideal (8 minutes vs usual 15) due to appointment backlog. Physical examination notes recorded but patient felt examination was inadequate.",
        actions_taken: "Face-to-face apology meeting held with patient. Emma Thompson provided with customer service refresher training and reflective practice supervision. Dr Smith re-examined patient for 30 minutes at no charge and arranged neurological referral for recurring headaches. Practice manager reviewed appointment scheduling with all GPs.",
        improvements_made: "New protocol: Reception staff must explain reason for delays over 15 minutes and offer rescheduling option. Emergency slots increased from 2 to 4 per day to reduce impact on routine appointments. GPs now flag patients requiring longer consultations. Receptionist team enrolled in de-escalation training programme. Monthly patient feedback surveys introduced.",
        additional_context: "Patient invited to join Patient Participation Group to help improve services. Neurological referral fast-tracked. Patient offered choice of any GP for future appointments. Practice committed £12,000 to additional GP sessions to reduce appointment pressure. Significant event analysis shared with entire practice team."
      };
    } else if (refNumber === 'COMP250005') {
      // Clinical Care - Multiple inaccuracies in medical records
      return {
        key_findings: "Investigation confirmed serious data integrity failures. Incorrect address resulted from system migration error affecting 47 patient records. Sarah Baker's test results incorrectly filed due to human error during data entry - both patients share similar NHS numbers (differing by one digit). Missing July 2024 notes discovered in unattached documents folder due to scanning error. Records corrected immediately upon complaint but initial 3-week delay was unacceptable.",
        actions_taken: "All 47 affected patient records corrected within 48 hours. Personal written apology to patient from practice manager and senior GP. Data Protection Impact Assessment completed. Sarah Baker informed of breach and her records corrected. Enhanced data quality audit commissioned. Staff member involved provided with additional training and supervision.",
        improvements_made: "Mandatory double-check system for all data entry implemented. Weekly automated data quality audits. NHS number verification now includes three-point check. Document scanning quality review process established. Staff training on GDPR compliance and record accuracy. Practice appointed Data Protection Champion. Quarterly data quality reports to Partners meeting.",
        additional_context: "Incident reported to ICO as potential data breach but assessed as low risk due to swift correction. Patient offered free Subject Access Request copy of entire record for personal verification. £50 goodwill gesture offered to compensate for time and distress. New system means this type of error is now virtually impossible. Patient invited to review corrected records with GP."
      };
    } else if (refNumber === 'COMP250006' || refNumber === 'COMP250007' || refNumber === 'COMP250008') {
      // Clinical Care - Mr Mitchell's missed heart attack
      return {
        key_findings: "Serious clinical assessment failure identified. Dr Anderson documented patient's symptoms and family history but failed to recognise red flags for acute coronary syndrome. No safety-netting advice provided. GP acknowledged during investigation that chest pain, left arm radiation, and cardiac family history should have triggered urgent assessment/referral. Significant learning opportunity for entire practice.",
        actions_taken: "Immediate significant event analysis conducted. Dr Anderson completed mandatory CPD on acute cardiac presentations. Personal face-to-face apology meeting with Mr Mitchell and his family. Full Duty of Candour letter sent explaining what happened and why. Cardiology consultant reviewed care and confirmed no long-term harm due to swift A&E treatment. Case discussed at protected learning time session.",
        improvements_made: "Urgent chest pain pathway implemented with decision support tool on all GP computers. Mandatory annual training on recognition of cardiac red flags for all clinicians. Point-of-care ECG machine purchased (£8,500) now available in every consultation room. Safety-netting protocol template added to clinical system. Monthly clinical audit of chest pain presentations. Senior GP review of all locum and newly qualified GP consultations involving cardiac symptoms.",
        additional_context: "Mr Mitchell's ongoing cardiac care coordinated with hospital. Practice paid for private stress echocardiogram (£450) to ensure complete assessment. Incident reported to NHS England as required. Learning shared across PCN. Dr Anderson underwent fitness-to-practise review with responsible officer - remediation plan completed satisfactorily. Practice introduced 'no-blame' culture but with clear accountability for learning. Mr Mitchell invited to share his story at practice training day (with consent)."
      };
    } else if (refNumber === 'COMP250009') {
      // Delayed test results - Emma Richardson
      return {
        key_findings: "Investigation confirmed blood test results were available 3 working days after sample taken but notification failure prevented patient contact. Results showed borderline anaemia (Hb 108 g/L) requiring dietary advice but not urgent treatment. SMS system error combined with GP oversight failure led to 6-week delay before patient telephoned to chase results. Significant event analysis identified systems failure.",
        actions_taken: "Personal apology from GP and practice manager provided in face-to-face meeting. Patient seen within 48 hours for full discussion of results and treatment plan. SMS notification system debugged and verified functional. Significant event analysis completed with full practice team. All unreported results from same period reviewed (3 other patients identified and contacted).",
        improvements_made: "Automated result notification system upgraded with SMS plus postal letter backup. Weekly audit of unreported abnormal results introduced. Dedicated results telephone line established with guaranteed callback within 4 hours. Patient portal access rolled out for all test results. Monthly tracking dashboard for notification failures. Locum GPs now receive daily unreported results alert.",
        additional_context: "Patient's iron levels now being monitored quarterly with automatic recall system. Haematology referral arranged as precautionary measure despite borderline results. Practice paid for private iron infusion therapy (£200) to accelerate treatment and acknowledge failing. Learning from this case shared across entire PCN at clinical governance meeting. Patient invited to Patient Participation Group to help improve notification systems."
      };
    } else if (refNumber === 'COMP250010') {
      // Repeated appointment cancellations - James Williams
      return {
        key_findings: "Investigation confirmed four consecutive appointments cancelled over 6-week period: two due to GP sickness (48 hours' notice given), one due to emergency building maintenance requiring consultation room closure (4 hours' notice), one due to administrative error where wrong patient's appointment cancelled (24 hours' notice). Notification sent via SMS but patient's mobile telephone number outdated in system since June 2024 - patient never received messages.",
        actions_taken: "Personal telephone call and written apology from practice manager. Priority appointment booked with senior GP partner within 2 days. Patient's contact details updated and verified across all systems. £25 compensation offered for wasted travel costs to cancelled appointments. Practice manager met with patient face-to-face to explain each cancellation circumstance and apologise for communication failure.",
        improvements_made: "Quarterly contact details verification campaign for all registered patients. Double-notification system (SMS plus telephone call) implemented for all cancellations under 48 hours' notice. Minimum 72-hour advance notice policy unless genuine emergency. Automatic rescheduling offered within same week when practice initiates cancellation. Monthly audit of cancellation rates, reasons, and notification success. Emergency locum arrangements improved to reduce GP absence cancellations.",
        additional_context: "Patient now has dedicated appointment coordinator contact for any future issues. Travel expenses for cancelled appointments reimbursed in full. Practice reviewing GP cover arrangements with locum agency to ensure better continuity. Patient involved in co-designing new appointment reminder and notification system. Cancellation rate reduced by 40% since improvements implemented. Building maintenance now scheduled outside clinical hours wherever possible."
      };
    } else if (refNumber === 'COMP250011' || refNumber === 'COMP250013') {
      // Staff Attitude & Behaviour - Vexatious complaint (both COMP250011 and COMP250013)
      return {
        key_findings: "Comprehensive investigation conducted including review of all complaint allegations. Staff interviews, CCTV review, prescription processing audit, and consultation records examination completed. No evidence found to support claims of deliberate targeting, discrimination, or unprofessional conduct. All staff interactions were appropriate and professional. Diagnosis by Dr Jenkins clinically appropriate and evidence-based. Prescription processing times within NHS standard targets. Patient's demands for unlimited appointments, daily apologies, personal staff contact details, and CCTV release are unreasonable and not clinically indicated. Pattern of behaviour including threatening language, recording staff without consent, and multiple simultaneous complaint routes indicates vexatious complaint as defined by NHS England framework.",
        actions_taken: "Detailed written response provided addressing each allegation with supporting evidence. Independent review by neighbouring practice manager confirmed professional staff conduct throughout. All staff provided formal statements demonstrating appropriate interactions. Patient offered mediation which was declined. Legal advice obtained regarding covert recordings and threatening behaviour. Practice's duty of care to staff wellbeing considered alongside patient care obligations. Boundary agreement letter drafted in consultation with NHS England guidance.",
        improvements_made: "Reinforced zero-tolerance policy on threatening behaviour and covert recordings. Enhanced staff support mechanisms including debriefing sessions and occupational health referrals. Developed clear procedure for managing unreasonable complainant behaviour in line with NHS England framework. Staff training on personal safety, professional boundaries, and de-escalation techniques. Updated practice complaints policy to explicitly address vexatious complaints and unacceptable behaviour. Security measures reviewed at reception area.",
        additional_context: "Patient placed on boundary management agreement permitting continued access to essential medical services but requiring advance appointments, specific time allocations, and maintenance of professional conduct. Patient retains right to register with alternative practice if dissatisfied. All correspondence shared with ICB complaints team and MP office with full factual account. NHS England guidance on managing persistent and vexatious complainants applied fairly and proportionately. Practice position legally defensible and clinically appropriate. Staff wellbeing prioritised whilst maintaining duty of care to patient. No evidence of discrimination - patient's protected characteristics fully respected throughout."
      };
    } else if (refNumber === 'COMP250012') {
      // Poor hygiene/facilities - David Thompson
      return {
        key_findings: "Investigation confirmed visible staining on waiting room chairs, overflowing sanitary bin in disabled toilet, and carpet wear with stains in high-traffic areas. Daily cleaning contractor had signed checklist indicating work completed, but inspection revealed substandard work quality. Patient's photographs provided compelling evidence of hygiene failures. Contract cleaning company failed to meet agreed standards despite premium pricing (£1,200/month). Practice manager's spot-check system inadequate to identify ongoing issues.",
        actions_taken: "Immediate deep clean commissioned and completed within 24 hours of complaint. Cleaning contract terminated with 7-day notice period. New cleaning company appointed with improved specification and supervision. All waiting room chairs professionally cleaned, two replaced entirely (£340). Sanitary bins changed to larger capacity with twice-daily emptying schedule. Waiting room carpet completely replaced (£3,200 investment). Patient invited to re-inspect facilities following improvements.",
        improvements_made: "Practice manager now conducts daily visual inspections with photographic record logged. Patient feedback forms specifically ask about cleanliness with monthly analysis. Monthly hygiene audits by external CQC-trained assessor. Additional cleaning rounds added at 1:00pm during busy surgery periods. Instant-report system for hygiene concerns via QR code posters in waiting areas and toilets. Cleaning staff now directly employed rather than contracted to ensure accountability.",
        additional_context: "Patient invited to re-inspect facilities and confirmed satisfaction with improvements in writing. CQC inspection scheduled for next quarter - practice confident in demonstrating compliance with hygiene standards. Learning from this incident shared at practice meeting about contract monitoring failures. New cleaning company provides real-time digital cleaning logs accessible to practice manager. Patient joined Patient Participation Group to help maintain cleanliness standards. All staff reminded to report hygiene issues immediately rather than assuming cleaners will address."
      };
    }
    
    // No demo response available - return empty strings for non-demo complaints
    return {
      key_findings: "",
      actions_taken: "",
      improvements_made: "",
      additional_context: ""
    };
  };

  const loadDemoReply = (field: 'key_findings' | 'actions_taken' | 'improvements_made' | 'additional_context') => {
    const demoReplies = getDemoReplies();
    setData({ ...data, [field]: demoReplies[field] });
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
      if (!data.outcome_type) {
        // Switch to investigation tab to show the missing outcome field
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

    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    console.log('=== Starting outcome letter generation ===');
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
        is_vexatious: data.tone === 'strong' || data.tone === 'firm'
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

      // Save the generated outcome letter using RPC function
      console.log('Step 4: Saving outcome letter to database via RPC...');
      console.log('Outcome data to save:', {
        complaint_id: complaintId,
        outcome_type: finalData.outcome_type,
        outcome_summary: finalData.key_findings,
        letter_length: letterData.outcomeLetter?.length,
      });
      
      const { data: outcomeId, error: outcomeError } = await supabase
        .rpc('create_complaint_outcome', {
          p_complaint_id: complaintId,
          p_outcome_type: finalData.outcome_type,
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
                    setData({ ...data, key_findings: (data.key_findings + ' ' + text).slice(0, 150) })
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
                    setData({ ...data, actions_taken: (data.actions_taken + ' ' + text).slice(0, 150) })
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
                    setData({ ...data, improvements_made: (data.improvements_made + ' ' + text).slice(0, 150) })
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
                <h3 className="font-semibold text-green-900">Review Your Answers</h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Outcome:</span> {data.outcome_type.replace('_', ' ').toUpperCase()}
                </div>
                <div>
                  <span className="font-medium">Tone:</span> {data.tone.charAt(0).toUpperCase() + data.tone.slice(1)}
                  {(data.tone === 'strong' || data.tone === 'firm') && ' (Vexatious)'}
                </div>
                <div>
                  <span className="font-medium">Investigation:</span> ✓ Complete
                </div>
                {complianceSummary && (
                  <div>
                    <span className="font-medium">CQC Compliance:</span> {complianceSummary.compliant_items}/{complianceSummary.total_items} items ({complianceSummary.compliance_percentage}%)
                  </div>
                )}
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
                    setData({ ...data, additional_context: (data.additional_context + ' ' + text).slice(0, 200) })
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
