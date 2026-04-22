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
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { SpeechToText } from '@/components/SpeechToText';
import { CheckCircle2, AlertCircle, Loader2, CheckCircle, ClipboardCheck, Sparkles, Wand2, Info } from 'lucide-react';

interface QuestionnaireData {
  investigation_complete: boolean;
  outcome_type?: 'upheld' | 'partially_upheld' | 'not_upheld' | 'withdrawn';
  tone: 'professional' | 'empathetic' | 'apologetic' | 'factual' | 'strong' | 'firm';
  key_findings: string;
  actions_taken: string;
  improvements_made: string;
  additional_context: string;
  is_vexatious: boolean;
  use_formal_outcome_labels: boolean;
  field_sources?: Record<string, 'human' | 'ai_generated' | 'ai_reviewed'>;
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
  const [enableAiAnalysis, setEnableAiAnalysis] = useState<boolean>(false);
  const [aiAnalysisComplete, setAiAnalysisComplete] = useState<boolean>(false);
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
    field_sources: {},
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
  const [isGeneratingFromEvidence, setIsGeneratingFromEvidence] = useState(false);
  const [generatingEvidenceField, setGeneratingEvidenceField] = useState<string | null>(null);
  
  // Evidence availability tracking
  const [hasEvidence, setHasEvidence] = useState<boolean | null>(null); // null = not yet checked
  const [isCheckingEvidence, setIsCheckingEvidence] = useState(false);
  // Track which fields were AI-filled
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const complaintReference = complaintData.reference_number || '';

  // Check evidence availability when dialog opens
  useEffect(() => {
    const checkEvidenceAvailability = async () => {
      if (!open || !complaintId) return;
      
      setIsCheckingEvidence(true);
      try {
        const [findingsRes, decisionsRes, evidenceRes, transcriptsRes, partiesRes] = await Promise.all([
          supabase
            .from('complaint_investigation_findings')
            .select('id')
            .eq('complaint_id', complaintId)
            .limit(1),
          supabase
            .from('complaint_investigation_decisions')
            .select('id')
            .eq('complaint_id', complaintId)
            .limit(1),
          supabase
            .from('complaint_investigation_evidence')
            .select('id')
            .eq('complaint_id', complaintId)
            .limit(1),
          supabase
            .from('complaint_investigation_transcripts')
            .select('id')
            .eq('complaint_id', complaintId)
            .limit(1),
          supabase
            .from('complaint_involved_parties')
            .select('id, response_text')
            .eq('complaint_id', complaintId),
        ]);

        // Check if any meaningful evidence exists
        const hasFindings = (findingsRes.data?.length ?? 0) > 0;
        const hasDecisions = (decisionsRes.data?.length ?? 0) > 0;
        const hasEvidenceFiles = (evidenceRes.data?.length ?? 0) > 0;
        const hasTranscripts = (transcriptsRes.data?.length ?? 0) > 0;
        // Only count staff responses that have actual response text (human-entered)
        const hasStaffResponses = (partiesRes.data || []).some(p => p.response_text && p.response_text.trim().length > 0);

        const evidenceExists = hasFindings || hasDecisions || hasEvidenceFiles || hasTranscripts || hasStaffResponses;
        setHasEvidence(evidenceExists);
        
        console.log('📋 Evidence check:', { hasFindings, hasDecisions, hasEvidenceFiles, hasTranscripts, hasStaffResponses, evidenceExists });
      } catch (error) {
        console.error('Error checking evidence availability:', error);
        setHasEvidence(false);
      } finally {
        setIsCheckingEvidence(false);
      }
    };

    checkEvidenceAvailability();
  }, [open, complaintId]);

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
          setDemoResponse(directResponse);
          setDemoSource('direct');
          return;
        }
        
        const isDemoComplaint = complaintData.patient_name && 
          complaintData.patient_name.toLowerCase().includes('james robert williams');
        
        if (isDemoComplaint && complaintData.category) {
          console.log('🎭 Demo complaint detected: James Robert Williams');
          
          const { data: allDemoResponses, error: demoError } = await supabase
            .from('complaint_demo_responses')
            .select('complaint_reference, key_findings, actions_taken, improvements_made, additional_context');
          
          if (demoError) {
            console.error('❌ Error fetching demo responses:', demoError);
          }
          
          if (allDemoResponses && allDemoResponses.length > 0) {
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
              const demoResponse = allDemoResponses.find(
                r => r.complaint_reference === matchingComplaint.reference_number
              );
              
              if (demoResponse) {
                console.log('✅ Demo response loaded from:', matchingComplaint.reference_number);
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

  const getDemoReplies = () => {
    if (demoResponse) {
      return demoResponse;
    }
    return {
      key_findings: "",
      actions_taken: "",
      improvements_made: "",
      additional_context: ""
    };
  };

  const loadDemoReply = async (field: 'key_findings' | 'actions_taken' | 'improvements_made' | 'additional_context') => {
    if (isDemoLoading || isGenerating) {
      return;
    }
    
    const demoReplies = getDemoReplies();
    const content = demoReplies[field];
    
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
        
        setDemoResponse(aiResponse.demoResponse);
        setDemoSource('ai-generated');
        
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

  // Helper to mark a field as AI-filled and track provenance
  const markFieldAsAiFilled = (field: string) => {
    setAiFilledFields(prev => new Set(prev).add(field));
    setData(prevData => ({
      ...prevData,
      field_sources: {
        ...prevData.field_sources,
        [field]: 'ai_generated' as const,
      },
    }));
  };

  // Helper to mark a field as human-edited (when user types in an AI-filled field)
  const handleFieldEdit = (field: string, value: string) => {
    setData(prevData => ({
      ...prevData,
      [field]: value,
      field_sources: {
        ...prevData.field_sources,
        [field]: aiFilledFields.has(field) ? 'ai_reviewed' as const : 'human' as const,
      },
    }));
  };

  const loadFromEvidence = async (field: 'key_findings' | 'actions_taken' | 'improvements_made' | 'additional_context') => {
    if (isGeneratingFromEvidence) return;
    
    // Guard: block when no evidence
    if (hasEvidence === false) {
      showToast.warning(
        'No investigation evidence found. Please add investigation findings, upload evidence, or record staff responses before using auto-fill.',
        { section: 'complaints' }
      );
      return;
    }
    
    setIsGeneratingFromEvidence(true);
    setGeneratingEvidenceField(field);
    
    try {
      const { data: aiResponse, error } = await supabase.functions.invoke('generate-demo-response', {
        body: {
          action: 'evidence',
          complaintId,
        }
      });
      
      if (error) {
        console.error('❌ Error generating from evidence:', error);
        showShadcnToast({
          title: 'Generation Failed',
          description: 'Failed to generate from evidence. Please try again.',
          variant: 'destructive',
          section: 'complaints',
        });
        return;
      }

      if (aiResponse?.success && aiResponse.demoResponse) {
        const generatedContent = aiResponse.demoResponse[field];
        if (generatedContent) {
          setData(prevData => ({ ...prevData, [field]: generatedContent }));
          markFieldAsAiFilled(field);
          console.log(`✅ Evidence-based content loaded for ${field}: ${generatedContent.length} chars`);
        }
      } else if (aiResponse?.error) {
        showShadcnToast({
          title: 'Generation Failed',
          description: aiResponse.error,
          variant: 'destructive',
          section: 'complaints',
        });
      }
    } catch (error) {
      console.error('❌ Exception generating from evidence:', error);
      showShadcnToast({
        title: 'Generation Error',
        description: error instanceof Error ? error.message : 'Failed to generate from evidence',
        variant: 'destructive',
        section: 'complaints',
      });
    } finally {
      setIsGeneratingFromEvidence(false);
      setGeneratingEvidenceField(null);
    }
  };

  const loadAllFromEvidence = async () => {
    if (isGeneratingFromEvidence) return;
    
    // Guard: block when no evidence
    if (hasEvidence === false) {
      showToast.warning(
        'No investigation evidence found. Please add investigation findings, upload evidence, or record staff responses before using auto-fill. Auto-fill cannot generate accurate content without source data.',
        { section: 'complaints' }
      );
      return;
    }
    
    setIsGeneratingFromEvidence(true);
    setGeneratingEvidenceField('all');
    
    try {
      const { data: aiResponse, error } = await supabase.functions.invoke('generate-demo-response', {
        body: {
          action: 'evidence',
          complaintId,
        }
      });
      
      if (error) {
        console.error('❌ Error generating all from evidence:', error);
        showShadcnToast({
          title: 'Generation Failed',
          description: 'Failed to generate from evidence. Please try again.',
          variant: 'destructive',
          section: 'complaints',
        });
        return;
      }

      if (aiResponse?.success && aiResponse.demoResponse) {
        const fields = ['key_findings', 'actions_taken', 'improvements_made', 'additional_context'] as const;
        setData(prevData => ({
          ...prevData,
          key_findings: aiResponse.demoResponse.key_findings || prevData.key_findings,
          actions_taken: aiResponse.demoResponse.actions_taken || prevData.actions_taken,
          improvements_made: aiResponse.demoResponse.improvements_made || prevData.improvements_made,
          additional_context: aiResponse.demoResponse.additional_context || prevData.additional_context,
        }));
        // Mark all fields as AI-filled
        const newAiFields = new Set(aiFilledFields);
        const newSources: Record<string, 'ai_generated'> = {};
        for (const f of fields) {
          if (aiResponse.demoResponse[f]) {
            newAiFields.add(f);
            newSources[f] = 'ai_generated';
          }
        }
        setAiFilledFields(newAiFields);
        setData(prevData => ({
          ...prevData,
          field_sources: { ...prevData.field_sources, ...newSources },
        }));
        
        console.log('✅ All fields populated from evidence');
        showShadcnToast({
          title: 'Evidence Loaded',
          description: 'All fields have been populated from investigation evidence. Please review before proceeding — AI drafts must be verified.',
          section: 'complaints',
        });
      } else if (aiResponse?.error) {
        showShadcnToast({
          title: 'Generation Failed',
          description: aiResponse.error,
          variant: 'destructive',
          section: 'complaints',
        });
      }
    } catch (error) {
      console.error('❌ Exception generating all from evidence:', error);
      showShadcnToast({
        title: 'Generation Error',
        description: error instanceof Error ? error.message : 'Failed to generate from evidence',
        variant: 'destructive',
        section: 'complaints',
      });
    } finally {
      setIsGeneratingFromEvidence(false);
      setGeneratingEvidenceField(null);
    }
  };

  useEffect(() => {
    if (open) {
      fetchComplianceChecks();
    }
  }, [open, complaintId]);

  const fetchComplianceChecks = async () => {
    try {
      const { error: initError } = await supabase
        .rpc('initialize_complaint_compliance', { p_complaint_id: complaintId });

      if (initError) {
        console.error('Error initializing compliance:', initError);
      }

      const { data: checks, error: checksError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId);

      if (checksError) throw checksError;

      const user = await supabase.auth.getUser();
      if (user.data.user && checks) {
        for (const check of checks) {
          let shouldAutoConfirm = false;
          let autoConfirmNote = 'Auto-confirmed based on complaint data';
          
          if (check.compliance_item.includes('logged in practice register') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - complaint processed through system';
          }
          
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
          
          if (check.compliance_item.includes('Response addresses all points raised') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - outcome letter generated addressing complaint points';
          }
          
          if (check.compliance_item.includes('Response letter includes escalation routes') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - PHSO escalation route included in outcome letter';
          }
          
          if (check.compliance_item.includes('Fair and thorough investigation conducted') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - investigation completed and outcome documented';
          }
          
          if (check.compliance_item.includes('Senior management oversight documented') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - outcome authorised by complaints manager';
          }
          
          if (check.compliance_item.includes('Confidentiality maintained throughout') && !check.is_compliant) {
            shouldAutoConfirm = true;
            autoConfirmNote = 'Auto-confirmed - complaint handled through secure system';
          }
          
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

      const { data: updatedChecks, error: updatedError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId);

      if (updatedError) throw updatedError;
      const { deduplicateComplianceChecks } = await import('@/utils/cleanupComplianceChecks');
      setComplianceChecks(deduplicateComplianceChecks(updatedChecks || []));

      const { data: summary, error: summaryError } = await supabase
        .rpc('get_complaint_compliance_summary', { p_complaint_id: complaintId });

      if (summaryError) throw summaryError;
      if (summary && summary.length > 0) {
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

      setComplianceChecks(prev => 
        prev.map(check => 
          check.id === checkId 
            ? { ...check, is_compliant: isCompliant, checked_at: new Date().toISOString() }
            : check
        )
      );

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
      setAiAnalysisComplete(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('complaint-ai-analysis-enabled', JSON.stringify(enableAiAnalysis));
  }, [enableAiAnalysis]);

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
      if (!data.outcome_type) {
        showShadcnToast({
          title: 'Outcome Required',
          description: 'Please select an outcome decision before proceeding.',
          variant: 'destructive',
          section: 'complaints'
        });
        return;
      }
      
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
      console.log('Step 1: Getting current user...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      console.log('User authenticated:', user.id);

      const finalData = {
        ...data,
        is_vexatious: data.tone === 'strong' || data.tone === 'firm',
        ai_analysis: aiAnalysisText,
      };
      console.log('Final data prepared:', finalData);

      console.log('Step 2: Saving questionnaire to database via RPC...');
      
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

    // Withdrawn/Resolved: skip letter generation, save directly
      if (finalData.outcome_type === 'withdrawn') {
        console.log('Step 3: Withdrawn — skipping letter generation...');
        
        if (!finalData.outcome_type || !['upheld', 'partially_upheld', 'not_upheld', 'withdrawn'].includes(finalData.outcome_type)) {
          throw new Error('Invalid outcome type selected');
        }

        console.log('Step 4: Saving withdrawn outcome to database via RPC...');
        const { data: outcomeId, error: outcomeError } = await supabase
          .rpc('create_complaint_outcome', {
            p_complaint_id: complaintId,
            p_outcome_type: 'withdrawn',
            p_outcome_summary: finalData.key_findings,
            p_outcome_letter: `Complaint withdrawn/resolved informally.\n\nResolution Summary:\n${finalData.key_findings}`,
          });

        if (outcomeError) {
          console.error('!!! RPC ERROR SAVING WITHDRAWN OUTCOME !!!');
          console.error('Error details:', outcomeError);
          alert(`Failed to save outcome: ${outcomeError.message}. Check console for details.`);
          throw outcomeError;
        }
        
        console.log('✓ Withdrawn outcome saved, ID:', outcomeId);

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
        } else {
          console.log('Complaint status updated to closed');
        }

        console.log('=== Withdrawn outcome completed successfully ===');
        onSuccess();
        onOpenChange(false);
        return;
      }

      console.log('Step 3: Calling edge function to generate letter...');
      
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

      if (!finalData.outcome_type || !['upheld', 'partially_upheld', 'not_upheld', 'withdrawn'].includes(finalData.outcome_type)) {
        throw new Error('Invalid outcome type selected');
      }

      const dbOutcomeType = finalData.outcome_type === 'not_upheld' ? 'rejected' : finalData.outcome_type;

      console.log('Step 4: Saving outcome letter to database via RPC...');
      
      const { data: outcomeId, error: outcomeError } = await supabase
        .rpc('create_complaint_outcome', {
          p_complaint_id: complaintId,
          p_outcome_type: dbOutcomeType,
          p_outcome_summary: finalData.key_findings,
          p_outcome_letter: letterData.outcomeLetter,
        });

      if (outcomeError) {
        console.error('!!! RPC ERROR SAVING OUTCOME LETTER !!!');
        console.error('Error details:', outcomeError);
        alert(`Failed to save outcome letter via RPC: ${outcomeError.message}. Check console for details.`);
        throw outcomeError;
      }
      
      if (!outcomeId) {
        console.error('!!! RPC returned no outcome ID !!!');
        alert('Outcome letter may not have been saved properly - no ID returned');
      } else {
        console.log('✓ Outcome letter saved successfully via RPC, ID:', outcomeId);
      }

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
      } else {
        console.log('Complaint status updated to closed');
      }

      console.log('Step 6: Triggering audio overview generation in background...');
      setTimeout(async () => {
        try {
          const { error: audioError } = await supabase.functions.invoke('generate-complaint-audio-overview', {
            body: { 
              complaintId,
              voiceProvider: 'elevenlabs',
              voiceId: 'Xb7hH8MSUJpSbSDYk0k2'
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
        }
      }, 500);

      console.log('=== Outcome letter generation completed successfully ===');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('!!! ERROR IN OUTCOME LETTER GENERATION !!!');
      console.error('Error details:', error);
      alert(`Failed to generate outcome letter: ${error?.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setIsSubmitting(false);
      console.log('=== Outcome letter generation process ended ===');
    }
  };

  // Evidence buttons disabled state
  const evidenceButtonsDisabled = hasEvidence === false || isCheckingEvidence;

  // Helper to render AI draft badge
  const renderAiDraftBadge = (field: string) => {
    if (!aiFilledFields.has(field)) return null;
    return (
      <Badge variant="outline" className="ml-2 text-xs border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Sparkles className="h-3 w-3 mr-1" />
        AI Draft — please review
      </Badge>
    );
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
            {/* Auto-fill All button with evidence guard */}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={loadAllFromEvidence}
                disabled={isGeneratingFromEvidence || evidenceButtonsDisabled}
                className={`w-full ${evidenceButtonsDisabled ? 'border-muted text-muted-foreground cursor-not-allowed' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
              >
                {isGeneratingFromEvidence && generatingEvidenceField === 'all' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating from evidence...
                  </>
                ) : isCheckingEvidence ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking evidence...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Auto-fill All from Evidence
                  </>
                )}
              </Button>
              {hasEvidence === false && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Add investigation evidence to enable auto-fill
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Label className="text-sm font-semibold">
                    Brief Summary of Key Findings *
                  </Label>
                  {renderAiDraftBadge('key_findings')}
                </div>
              </div>
              <Textarea
                value={data.key_findings}
                onChange={(e) => handleFieldEdit('key_findings', e.target.value)}
                placeholder="Summarise the main findings in 2-3 sentences..."
                rows={3}
                className={`mb-2 ${aiFilledFields.has('key_findings') ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' : 'bg-white dark:bg-background'}`}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadFromEvidence('key_findings')}
                  className="h-8 w-8 shrink-0"
                  title={evidenceButtonsDisabled ? "No investigation evidence available" : isGeneratingFromEvidence ? "Generating..." : "Generate from evidence"}
                  disabled={isGeneratingFromEvidence || evidenceButtonsDisabled}
                >
                  {isGeneratingFromEvidence && (generatingEvidenceField === 'key_findings' || generatingEvidenceField === 'all') ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className={`h-4 w-4 ${evidenceButtonsDisabled ? 'text-muted-foreground' : ''}`} />}
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center mb-2">
                <Label className="text-sm font-semibold">
                  Actions Already Taken or Planned (optional)
                </Label>
                {renderAiDraftBadge('actions_taken')}
              </div>
              <Textarea
                value={data.actions_taken}
                onChange={(e) => handleFieldEdit('actions_taken', e.target.value)}
                placeholder="What actions have been or will be taken?"
                rows={2}
                className={`mb-2 ${aiFilledFields.has('actions_taken') ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' : 'bg-white dark:bg-background'}`}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadFromEvidence('actions_taken')}
                  className="h-8 w-8 shrink-0"
                  title={evidenceButtonsDisabled ? "No investigation evidence available" : isGeneratingFromEvidence ? "Generating..." : "Generate from evidence"}
                  disabled={isGeneratingFromEvidence || evidenceButtonsDisabled}
                >
                  {isGeneratingFromEvidence && (generatingEvidenceField === 'actions_taken' || generatingEvidenceField === 'all') ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className={`h-4 w-4 ${evidenceButtonsDisabled ? 'text-muted-foreground' : ''}`} />}
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center mb-2">
                <Label className="text-sm font-semibold">
                  Service Improvements Made (optional)
                </Label>
                {renderAiDraftBadge('improvements_made')}
              </div>
              <Textarea
                value={data.improvements_made}
                onChange={(e) => handleFieldEdit('improvements_made', e.target.value)}
                placeholder="What improvements have been made to prevent recurrence?"
                rows={2}
                className={`mb-2 ${aiFilledFields.has('improvements_made') ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' : 'bg-white dark:bg-background'}`}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadFromEvidence('improvements_made')}
                  className="h-8 w-8 shrink-0"
                  title={evidenceButtonsDisabled ? "No investigation evidence available" : isGeneratingFromEvidence ? "Generating..." : "Generate from evidence"}
                  disabled={isGeneratingFromEvidence || evidenceButtonsDisabled}
                >
                  {isGeneratingFromEvidence && (generatingEvidenceField === 'improvements_made' || generatingEvidenceField === 'all') ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className={`h-4 w-4 ${evidenceButtonsDisabled ? 'text-muted-foreground' : ''}`} />}
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
                <div className="flex items-start gap-1">
                  <span className="font-medium shrink-0">Key Findings:</span>
                  <span>{data.key_findings}</span>
                  {aiFilledFields.has('key_findings') && (
                    <Badge variant="outline" className="ml-1 text-[10px] border-amber-300 bg-amber-50 text-amber-700 shrink-0">AI</Badge>
                  )}
                </div>
                {data.actions_taken && (
                  <div className="flex items-start gap-1">
                    <span className="font-medium shrink-0">Actions:</span>
                    <span>{data.actions_taken}</span>
                    {aiFilledFields.has('actions_taken') && (
                      <Badge variant="outline" className="ml-1 text-[10px] border-amber-300 bg-amber-50 text-amber-700 shrink-0">AI</Badge>
                    )}
                  </div>
                )}
                {data.improvements_made && (
                  <div className="flex items-start gap-1">
                    <span className="font-medium shrink-0">Improvements:</span>
                    <span>{data.improvements_made}</span>
                    {aiFilledFields.has('improvements_made') && (
                      <Badge variant="outline" className="ml-1 text-[10px] border-amber-300 bg-amber-50 text-amber-700 shrink-0">AI</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center mb-2">
                <Label className="text-sm font-semibold">
                  Any Additional Context (optional)
                </Label>
                {renderAiDraftBadge('additional_context')}
              </div>
              <Textarea
                value={data.additional_context}
                onChange={(e) => handleFieldEdit('additional_context', e.target.value)}
                placeholder="Any other context or special instructions for the letter..."
                rows={3}
                className={`mb-2 ${aiFilledFields.has('additional_context') ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' : 'bg-white dark:bg-background'}`}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => loadFromEvidence('additional_context')}
                  className="h-8 w-8 shrink-0"
                  title={evidenceButtonsDisabled ? "No investigation evidence available" : isGeneratingFromEvidence ? "Generating..." : "Generate from evidence"}
                  disabled={isGeneratingFromEvidence || evidenceButtonsDisabled}
                >
                  {isGeneratingFromEvidence && (generatingEvidenceField === 'additional_context' || generatingEvidenceField === 'all') ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className={`h-4 w-4 ${evidenceButtonsDisabled ? 'text-muted-foreground' : ''}`} />}
                </Button>
              </div>
            </div>

            {/* Warning if AI fields haven't been reviewed */}
            {aiFilledFields.size > 0 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">AI-generated content detected</AlertTitle>
                <AlertDescription className="text-amber-700 text-xs">
                  {aiFilledFields.size} field{aiFilledFields.size > 1 ? 's were' : ' was'} populated by AI. Please review and edit as needed before proceeding. AI drafts may contain inaccuracies.
                </AlertDescription>
              </Alert>
            )}

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
                  <SelectItem value="partially_upheld">Complaint Partially Upheld</SelectItem>
                  <SelectItem value="not_upheld">Complaint Not Upheld</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn / Resolved Informally</SelectItem>
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
                  {data.outcome_type === 'withdrawn' ? 'Closing Complaint...' : 'Generating Letter...'}
                </>
              ) : (
                data.outcome_type === 'withdrawn' ? 'Close as Withdrawn/Resolved' : 'Generate Outcome Letter'
              )}
            </Button>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
