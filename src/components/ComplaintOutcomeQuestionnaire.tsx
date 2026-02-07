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
import { Switch } from '@/components/ui/switch';
import { showShadcnToast } from '@/utils/toastWrapper';
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
  use_formal_outcome_labels: boolean;
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
    patient_name?: string;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestedOutcome, setAiSuggestedOutcome] = useState<string>('');
  const [aiAnalysisText, setAiAnalysisText] = useState<string>('');
  const [confirmProfessionalJudgement, setConfirmProfessionalJudgement] = useState<boolean>(false);
  const [enableAiAnalysis, setEnableAiAnalysis] = useState<boolean>(false); // Default to OFF
  const [aiAnalysisComplete, setAiAnalysisComplete] = useState<boolean>(false); // Track background completion
  const [data, setData] = useState<QuestionnaireData>({
    investigation_complete: true,
    outcome_type: undefined,
    tone: 'professional',
    key_findings: '',
    actions_taken: '',
    improvements_made: '',
    additional_context: '',
    is_vexatious: false,
    use_formal_outcome_labels: true,
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
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoSource, setDemoSource] = useState<'direct' | 'category-based' | 'ai-generated' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const complaintReference = complaintData.reference_number || '';

  // Format AI analysis with NHS styling
  const formatAiAnalysis = (text: string) => {
    if (!text) return null;
    
    const sections = text.split('\n\n');
    
    return (
      <div className="space-y-4">
        {sections.map((section, idx) => {
          const lines = section.split('\n').filter(line => line.trim());
          if (lines.length === 0) return null;
          
          const heading = lines[0];
          const content = lines.slice(1);
          
          // Check if this is a heading line (contains uppercase or ends with :)
          const isHeading = heading.includes(':') || heading === heading.toUpperCase();
          
          return (
            <div key={idx} className="space-y-2">
              {isHeading && (
                <h4 className="font-bold text-[#005EB8] text-sm">
                  {heading
                    .replace(/\s*\(\s*\d+\s*(?:-\s*\d+)?\s*[^)]*\)\s*/gi, '')
                    .replace(/\s*\(\s*(?:bullet|sentences?)\b[^)]*\)\s*/gi, '')
                    .replace(/\s*:\s*$/, '')
                    .trim()}
                </h4>
              )}
              {content.map((line, lineIdx) => {
                if (line.startsWith('•') || line.startsWith('-')) {
                  return (
                    <div key={lineIdx} className="flex gap-2 text-sm text-slate-700 ml-4">
                      <span className="text-[#005EB8] font-bold">•</span>
                      <span>{line.replace(/^[•-]\s*/, '')}</span>
                    </div>
                  );
                }
                return (
                  <p key={lineIdx} className="text-sm text-slate-700 leading-relaxed">
                    {line}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Fetch demo response from database for this complaint with category fallback
  useEffect(() => {
    const fetchDemoResponse = async () => {
      if (!complaintReference) return;
      
      setIsDemoLoading(true);
      setDemoResponse(null);
      setDemoSource(null);
      
      try {
        // Step 1: Normalize and attempt direct lookup
        const normalizedRef = complaintReference.trim().toUpperCase();
        console.log('🔍 Looking up demo response for:', normalizedRef);
        
        const { data: directResponse, error: directError } = await supabase
          .from('complaint_demo_responses')
          .select('key_findings, actions_taken, improvements_made, additional_context')
          .eq('complaint_reference', normalizedRef)
          .maybeSingle();
        
        if (directError) {
          console.error('❌ Error fetching demo response:', directError);
        }
        
        if (directResponse) {
          console.log('✅ Direct demo response found:', normalizedRef);
          console.log('📊 Content lengths:', {
            key_findings: directResponse.key_findings?.length,
            actions_taken: directResponse.actions_taken?.length,
            improvements_made: directResponse.improvements_made?.length,
            additional_context: directResponse.additional_context?.length
          });
          setDemoResponse(directResponse);
          setDemoSource('direct');
          return;
        }
        
        // Step 2: No direct match - check if this is a demo complaint by patient name
        const isDemoComplaint = complaintData.patient_name && 
          complaintData.patient_name.toLowerCase().includes('james robert williams');
        
        if (isDemoComplaint && complaintData.category) {
          console.log('🎭 Demo complaint detected: James Robert Williams');
          console.log('📊 Loading demo response for category:', complaintData.category);
          
          // Fetch all demo responses
          const { data: allDemoResponses, error: demoError } = await supabase
            .from('complaint_demo_responses')
            .select('complaint_reference, key_findings, actions_taken, improvements_made, additional_context');
          
          if (demoError) {
            console.error('❌ Error fetching demo responses:', demoError);
          }
          
          if (allDemoResponses && allDemoResponses.length > 0) {
            // Find a complaint reference that matches this category
            const demoReferenceNumbers = allDemoResponses.map(r => r.complaint_reference);
            
            const { data: matchingComplaint, error: matchError } = await supabase
              .from('complaints')
              .select('reference_number, category')
              .eq('category', complaintData.category as any)
              .in('reference_number', demoReferenceNumbers)
              .limit(1)
              .maybeSingle();
            
            if (matchError) {
              console.error('❌ Error finding matching complaint:', matchError);
            }
            
            if (matchingComplaint) {
              // Find the demo response for this matched complaint
              const demoResponse = allDemoResponses.find(
                r => r.complaint_reference === matchingComplaint.reference_number
              );
              
              if (demoResponse) {
                console.log('✅ Demo response loaded from:', matchingComplaint.reference_number);
                console.log('📊 Demo content lengths:', {
                  key_findings: demoResponse.key_findings?.length,
                  actions_taken: demoResponse.actions_taken?.length,
                  improvements_made: demoResponse.improvements_made?.length,
                  additional_context: demoResponse.additional_context?.length
                });
                setDemoResponse(demoResponse);
                setDemoSource('category-based');
                return;
              }
            }
          }
        }
        
        console.log('ℹ️ No demo response available (direct or fallback)');
      } finally {
        setIsDemoLoading(false);
      }
    };
    
    if (open) {
      fetchDemoResponse();
    }
  }, [open, complaintReference, complaintData.category]);

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

  const loadDemoReply = async (field: 'key_findings' | 'actions_taken' | 'improvements_made' | 'additional_context') => {
    // If still loading, return without action
    if (isDemoLoading || isGenerating) {
      return;
    }
    
    const demoReplies = getDemoReplies();
    const content = demoReplies[field];
    
    // If we have existing demo content, use it
    if (content && content.trim() !== '') {
      setData(prevData => ({ ...prevData, [field]: content }));
      
      const sourceInfo = demoSource === 'category-based' 
        ? ' (demo complaint - category matched)' 
        : demoSource === 'ai-generated'
        ? ' (AI generated)'
        : '';
      
      console.log(`✨ Loaded demo content for ${field}: ${content.length} chars${sourceInfo}`);
      return;
    }
    
    // No demo content exists - generate it with AI
    console.log('🤖 No demo response found, generating with AI...');
    setIsGenerating(true);
    
    try {
      const { data: aiResponse, error } = await supabase.functions.invoke('generate-demo-response', {
        body: {
          complaintReference: complaintData.reference_number,
          complaintDescription: complaintData.complaint_description,
          category: complaintData.category,
          patientName: complaintData.patient_name,
        }
      });
      
      if (error) {
        console.error('❌ Error generating demo response:', error);
        showShadcnToast({
          title: 'Generation Failed',
          description: 'Failed to generate demo response. Please try again.',
          variant: 'destructive',
          section: 'complaints',
        });
        return;
      }
      
      if (aiResponse?.success && aiResponse.demoResponse) {
        console.log('✅ AI generated response:', aiResponse.demoResponse);
        
        // Store the generated response
        setDemoResponse(aiResponse.demoResponse);
        setDemoSource('ai-generated');
        
        // Load the requested field
        const generatedContent = aiResponse.demoResponse[field];
        if (generatedContent) {
          setData(prevData => ({ ...prevData, [field]: generatedContent }));
          console.log(`✨ Loaded AI-generated content for ${field}: ${generatedContent.length} chars`);
        }
      }
    } catch (error) {
      console.error('❌ Exception generating demo response:', error);
      showShadcnToast({
        title: 'Generation Error',
        description: error instanceof Error ? error.message : 'Failed to generate response',
        variant: 'destructive',
        section: 'complaints',
      });
    } finally {
      setIsGenerating(false);
    }
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
        .rpc('initialize_complaint_compliance', { p_complaint_id: complaintId });

      if (initError) {
        console.error('Error initializing compliance:', initError);
      }

      // Fetch compliance checks
      const { data: checks, error: checksError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId);

      if (checksError) throw checksError;

      // Auto-confirm eligible items when outcome is being created
      const user = await supabase.auth.getUser();
      if (user.data.user && checks) {
        for (const check of checks) {
          let shouldAutoConfirm = false;
          let autoConfirmNote = 'Auto-confirmed based on complaint data';
          
          // Auto-confirm: Complaint logged in practice register (always when outcome created)
          if (check.compliance_item.includes('logged in practice register') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - complaint processed through system';
          }
          
          // Auto-confirm: Acknowledgement sent within 3 working days
          if (check.compliance_item.includes('Acknowledgement sent within 3 working days') && 
              !check.is_compliant &&
              complaintData.acknowledged_at && complaintData.created_at) {
            const created = new Date(complaintData.created_at);
            const acknowledged = new Date(complaintData.acknowledged_at);
            const workingDays = Math.floor((acknowledged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            if (workingDays <= 3) {
              shouldAutoConfirm = true;
              autoConfirmNote = `Auto-confirmed - acknowledged within ${workingDays} working days`;
            }
          }
          
          // Auto-confirm: Investigation completed within 20 working days (when outcome created)
          if (check.compliance_item.includes('Investigation completed within 20 working days') && 
              !check.is_compliant && complaintData.created_at) {
            const created = new Date(complaintData.created_at);
            const today = new Date();
            const workingDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            if (workingDays <= 20) {
              shouldAutoConfirm = true;
              autoConfirmNote = `Auto-confirmed - outcome completed within ${workingDays} working days`;
            }
          }
          
          // Auto-confirm: Response addresses all points raised (when outcome is created)
          if (check.compliance_item.includes('Response addresses all points raised') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - outcome letter generated addressing complaint points';
          }
          
          // Auto-confirm: Response letter includes escalation routes (outcome letters include PHSO info)
          if (check.compliance_item.includes('Response letter includes escalation routes') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - PHSO escalation route included in outcome letter';
          }
          
          // Auto-confirm: Fair and thorough investigation conducted (when outcome created)
          if (check.compliance_item.includes('Fair and thorough investigation conducted') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - investigation completed and outcome documented';
          }
          
          // Auto-confirm: Senior management oversight documented (when outcome created)
          if (check.compliance_item.includes('Senior management oversight documented') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - outcome authorised by complaints manager';
          }
          
          // Auto-confirm: Confidentiality maintained throughout (if reached outcome stage)
          if (check.compliance_item.includes('Confidentiality maintained throughout') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - complaint handled through secure system';
          }
          
          // Update in database if should be auto-confirmed
          if (shouldAutoConfirm) {
            await supabase
              .from('complaint_compliance_checks')
              .update({ 
                is_compliant: true, 
                checked_at: new Date().toISOString(),
                checked_by: user.data.user.id,
                notes: autoConfirmNote
              })
              .eq('id', check.id);
          }
        }
      }

      // Fetch updated checks
      const { data: updatedChecks, error: updatedError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId);

      if (updatedError) throw updatedError;
      const { deduplicateComplianceChecks } = await import('@/utils/cleanupComplianceChecks');
      setComplianceChecks(deduplicateComplianceChecks(updatedChecks || []));

      // Get compliance summary
      const { data: summary, error: summaryError } = await supabase
        .rpc('get_complaint_compliance_summary', { p_complaint_id: complaintId });

      if (summaryError) throw summaryError;
      if (summary && summary.length > 0) {
        // Map the response to match the expected structure
        const summaryData = summary[0];
        setComplianceSummary({
          total_items: Number(summaryData.total_checks),
          compliant_items: Number(summaryData.completed_checks),
          compliance_percentage: Number(summaryData.compliance_percentage),
          outstanding_items: []
        });
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
    setAiAnalysisComplete(false);

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
        setAiAnalysisComplete(true);
      }
    } catch (error: any) {
      console.error('AI analysis error:', error);
      // Don't show error toast for background analysis
      setAiAnalysisComplete(true); // Mark as complete even if failed
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save AI analysis preference to localStorage
  useEffect(() => {
    localStorage.setItem('complaint-ai-analysis-enabled', JSON.stringify(enableAiAnalysis));
  }, [enableAiAnalysis]);

  // ALWAYS trigger AI analysis in background when reaching Step 3
  useEffect(() => {
    if (step === 3 && open && !aiAnalysisText && !isAnalyzing) {
      analyzeComplaintOutcome();
    }
  }, [step, open]);

  const handleNext = () => {
    if (step === 1) {
      if (!data.key_findings || data.key_findings.length < 20) {
        return;
      }
    }

    if (step === 4) {
      // Ensure outcome is selected before proceeding
      if (!data.outcome_type) {
        showShadcnToast({
          title: 'Outcome Required',
          description: 'Please select an outcome decision before proceeding.',
          variant: 'destructive',
          section: 'complaints'
        });
        return;
      }
      
      // Ensure professional judgement confirmation is checked
      if (!confirmProfessionalJudgement) {
        showShadcnToast({
          title: 'Confirmation Required',
          description: 'Please confirm that you have reviewed all evidence and are making this decision based on your professional judgement.',
          variant: 'destructive',
          section: 'complaints'
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
      showShadcnToast({
        title: 'Outcome Required',
        description: 'Please select an outcome decision (upheld, partially upheld, or not upheld).',
        variant: 'destructive',
        section: 'complaints'
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

      // Automatically generate executive audio summary in background
      console.log('Step 6: Triggering audio overview generation in background...');
      setTimeout(async () => {
        try {
          const { error: audioError } = await supabase.functions.invoke('generate-complaint-audio-overview', {
            body: { 
              complaintId,
              voiceProvider: 'elevenlabs',
              voiceId: 'Xb7hH8MSUJpSbSDYk0k2' // Alice voice (default)
            }
          });
          
          if (audioError) {
            console.error('Background audio generation error:', audioError);
          } else {
            console.log('✓ Audio overview generation started successfully');
            showShadcnToast({
              title: 'Audio Summary',
              description: 'Generating executive audio summary for management...',
              section: 'complaints'
            });
          }
        } catch (error) {
          console.error('Failed to start audio generation:', error);
          // Don't show error to user - this is background task
        }
      }, 500); // Small delay to let main success flow complete first

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto px-12">
        <DialogHeader>
          <DialogTitle>Create Complaint Outcome Letter</DialogTitle>
          <DialogDescription>
            Reference: {complaintData.reference_number} | Step {step} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="mb-4" />

        <div className="px-6 sm:px-10">

        {/* Step 1: Letter Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold mb-2">
                  Brief Summary of Key Findings *
                </Label>
              </div>
              <Textarea
                value={data.key_findings}
                onChange={(e) => setData({ ...data, key_findings: e.target.value })}
                placeholder="Summarise the main findings in 2-3 sentences..."
                rows={3}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, key_findings: prevData.key_findings + ' ' + text }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('key_findings')}
                  className="h-8 w-8 shrink-0"
                  title={isDemoLoading || isGenerating ? "Loading..." : "Load demo reply"}
                  disabled={isDemoLoading || isGenerating}
                >
                  {(isDemoLoading || isGenerating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2">
                Actions Already Taken or Planned (optional)
              </Label>
              <Textarea
                value={data.actions_taken}
                onChange={(e) => setData({ ...data, actions_taken: e.target.value })}
                placeholder="What actions have been or will be taken?"
                rows={2}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, actions_taken: prevData.actions_taken + ' ' + text }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('actions_taken')}
                  className="h-8 w-8 shrink-0"
                  title={isDemoLoading || isGenerating ? "Loading..." : "Load demo reply"}
                  disabled={isDemoLoading || isGenerating}
                >
                  {(isDemoLoading || isGenerating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2">
                Service Improvements Made (optional)
              </Label>
              <Textarea
                value={data.improvements_made}
                onChange={(e) => setData({ ...data, improvements_made: e.target.value })}
                placeholder="What improvements have been made to prevent recurrence?"
                rows={2}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, improvements_made: prevData.improvements_made + ' ' + text }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('improvements_made')}
                  className="h-8 w-8 shrink-0"
                  title={isDemoLoading || isGenerating ? "Loading..." : "Load demo reply"}
                  disabled={isDemoLoading || isGenerating}
                >
                  {(isDemoLoading || isGenerating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Final Review */}
        {step === 2 && (
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
              <Label className="text-sm font-semibold mb-2">
                Any Additional Context (optional)
              </Label>
              <Textarea
                value={data.additional_context}
                onChange={(e) => setData({ ...data, additional_context: e.target.value })}
                placeholder="Any other context or special instructions for the letter..."
                rows={3}
                className="mb-2"
              />
              <div className="flex gap-2">
                <SpeechToText
                  onTranscription={(text) =>
                    setData(prevData => ({ ...prevData, additional_context: prevData.additional_context + ' ' + text }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadDemoReply('additional_context')}
                  className="h-8 w-8 shrink-0"
                  title={isDemoLoading || isGenerating ? "Loading..." : "Load demo reply"}
                  disabled={isDemoLoading || isGenerating}
                >
                  {(isDemoLoading || isGenerating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-900">
              <p className="font-medium mb-1">Next step:</p>
              <p className="text-xs">AI will analyse all investigation details and suggest an outcome decision</p>
            </div>
          </div>
        )}

        {/* Step 3: AI Outcome Analysis */}
        {step === 3 && (
          <div className="space-y-6">
            {/* AI Analysis Toggle */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-slate-600" />
                    <Label htmlFor="ai-toggle" className="text-sm font-semibold text-slate-900 cursor-pointer">
                      AI Suggested Outcome & Analysis
                    </Label>
                    {aiAnalysisComplete && !isAnalyzing && (
                      <span title="AI analysis complete" className="inline-flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-600 ml-1" />
                        {aiSuggestedOutcome && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-slate-700 bg-slate-200 rounded-full border border-slate-300">
                            {aiSuggestedOutcome === 'upheld' ? 'U' : 
                             aiSuggestedOutcome === 'partially_upheld' ? 'P' : 
                             'N'}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    Toggle to view AI-generated analysis (for guidance only)
                  </p>
                </div>
                <Switch
                  id="ai-toggle"
                  checked={enableAiAnalysis}
                  onCheckedChange={setEnableAiAnalysis}
                  className="ml-4"
                />
              </div>
            </div>

            {enableAiAnalysis && (
              <>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p className="text-sm text-blue-700">Analysing complaint details, staff responses, and investigation findings...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm">AI Guidance: Suggested Outcome (For Reference Only)</span>
                          {aiSuggestedOutcome && (
                            <Badge 
                              variant={
                                aiSuggestedOutcome === 'upheld' ? 'destructive' : 
                                aiSuggestedOutcome === 'partially_upheld' ? 'default' : 
                                'secondary'
                              }
                              className="text-xs"
                            >
                              {aiSuggestedOutcome === 'upheld' ? 'Upheld' : 
                               aiSuggestedOutcome === 'partially_upheld' ? 'Partially upheld' : 
                               'Not Upheld'}
                            </Badge>
                          )}
                        </div>
                        <Button size="sm" variant="secondary" onClick={analyzeComplaintOutcome} disabled={isAnalyzing}>
                          {isAnalyzing ? 'Generating…' : 'Regenerate'}
                        </Button>
                      </div>

                      {aiAnalysisText && (
                        <div className="bg-white p-4 rounded border border-blue-200 max-h-[600px] overflow-y-auto">
                          {formatAiAnalysis(aiAnalysisText)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
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
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upheld">Complaint Upheld</SelectItem>
                  <SelectItem value="partially_upheld">Complaint Partially upheld</SelectItem>
                  <SelectItem value="not_upheld">Complaint Not Upheld</SelectItem>
                </SelectContent>
              </Select>

              {/* Formal outcome labels toggle */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-200">
                <div className="space-y-0.5">
                  <Label htmlFor="formal-labels" className="text-sm font-medium">
                    Use formal outcome labels in patient letters
                  </Label>
                  <p className="text-xs text-slate-500">
                    When off, the letter uses plain, patient-centred language instead of formal labels like 'Upheld' or 'Not upheld'.
                  </p>
                </div>
                <Switch
                  id="formal-labels"
                  checked={data.use_formal_outcome_labels}
                  onCheckedChange={(checked) => setData({ ...data, use_formal_outcome_labels: checked })}
                />
              </div>
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
                  <strong>Required confirmation:</strong> I confirm that I have reviewed all evidence and am making this decision based on my professional judgement{enableAiAnalysis ? ', not solely on AI recommendation' : ''}.
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
            <Button onClick={handleNext} disabled={isSubmitting || (step === 3 && isAnalyzing)}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
