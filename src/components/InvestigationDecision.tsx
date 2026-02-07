import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, XCircle, Scale, Save, Edit, ClipboardCheck, FileText, Download, Eye, Mail, Loader2 } from 'lucide-react';
import { SpeechToText } from '@/components/SpeechToText';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { FormattedLetterContent } from '@/components/FormattedLetterContent';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { createLetterDocument, fetchLetterDetails } from '@/utils/letterFormatter';

interface InvestigationDecisionProps {
  complaintId: string;
  disabled?: boolean;
}

interface InvestigationDecision {
  id: string;
  decision_type: 'uphold' | 'reject' | 'partially_uphold';
  decision_reasoning: string;
  corrective_actions: string | null;
  lessons_learned: string | null;
  decided_by: string;
  decided_at: string;
  created_at: string;
  updated_at: string;
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

export function InvestigationDecision({ complaintId, disabled = false }: InvestigationDecisionProps) {
  const [decision, setDecision] = useState<InvestigationDecision | null>(null);
  const [decisionType, setDecisionType] = useState<string>('');
  const [decisionReasoning, setDecisionReasoning] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('decision');
  const [generatingOutcomeLetter, setGeneratingOutcomeLetter] = useState(false);
  const [outcomeLetter, setOutcomeLetter] = useState<string>('');
  const [showOutcomeLetter, setShowOutcomeLetter] = useState(false);
  const [editingOutcomeLetter, setEditingOutcomeLetter] = useState(false);
  const [editedOutcomeLetter, setEditedOutcomeLetter] = useState<string>('');
  const [savingOutcomeLetter, setSavingOutcomeLetter] = useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [letterStyle, setLetterStyle] = useState<string>('professional');
  const [isSendingOutcomeEmail, setIsSendingOutcomeEmail] = useState(false);
  const [showOutcomeEmailDialog, setShowOutcomeEmailDialog] = useState(false);
  const [emailToPatient, setEmailToPatient] = useState(true);
  const [bccToUser, setBccToUser] = useState(false);
  const [manualToEmails, setManualToEmails] = useState('');
  const [manualCcEmails, setManualCcEmails] = useState('');

  useEffect(() => {
    fetchInvestigationDecision();
    fetchComplianceChecks();
    fetchExistingOutcome();
  }, [complaintId]);

  const fetchExistingOutcome = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_outcomes')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingOutcome(data);
        setOutcomeLetter(data.outcome_letter || '');
        // Load the saved letter style
        if (data.letter_style) {
          setLetterStyle(data.letter_style);
        }
      }
    } catch (error) {
      console.error('Error fetching existing outcome:', error);
    }
  };

  const fetchInvestigationDecision = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_decisions')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDecision(data as InvestigationDecision);
        setDecisionType(data.decision_type);
        setDecisionReasoning(data.decision_reasoning);
        setCorrectiveActions(data.corrective_actions || '');
        setLessonsLearned(data.lessons_learned || '');
        setEditing(false);
      } else {
        setEditing(true);
      }
    } catch (error) {
      console.error('Error fetching investigation decision:', error);
      toast.error('Failed to load investigation decision');
    }
  };

  const fetchComplianceChecks = async () => {
    try {
      const { data: checks, error: checksError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId);

      if (checksError) throw checksError;
      const { deduplicateComplianceChecks } = await import('@/utils/cleanupComplianceChecks');
      setComplianceChecks(deduplicateComplianceChecks(checks || []));

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
      toast.error('Failed to load compliance checks');
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
      
      toast.success("Compliance check updated");
    } catch (error) {
      console.error('Error updating compliance check:', error);
      toast.error("Failed to update compliance check");
    }
  };

  const markAllCompliant = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      // Get all non-compliant items
      const nonCompliantChecks = complianceChecks.filter(check => !check.is_compliant);

      if (nonCompliantChecks.length === 0) {
        toast.success("All items are already completed");
        return;
      }

      // Update each item individually
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

      // Update local state
      setComplianceChecks(prev => 
        prev.map(check => ({
          ...check,
          is_compliant: true,
          checked_at: new Date().toISOString()
        }))
      );

      // Refresh compliance summary
      fetchComplianceChecks();
      
      toast.success(`Marked ${nonCompliantChecks.length} items as completed`);
    } catch (error) {
      console.error('Error marking all items as compliant:', error);
      toast.error("Failed to mark all items as completed");
    }
  };

  const saveInvestigationDecision = async () => {
    if (!decisionType || !decisionReasoning.trim()) {
      toast.error('Please provide both decision type and reasoning');
      return;
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      if (decision) {
        // Update existing decision
        const { data, error } = await supabase
          .from('complaint_investigation_decisions')
          .update({
            decision_type: decisionType as any,
            decision_reasoning: decisionReasoning,
            corrective_actions: correctiveActions || null,
            lessons_learned: lessonsLearned || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', decision.id)
          .select()
          .single();

        if (error) throw error;
        setDecision(data as InvestigationDecision);
      } else {
        // Create new decision
        const { data, error } = await supabase
          .from('complaint_investigation_decisions')
          .insert({
            complaint_id: complaintId,
            decision_type: decisionType as any,
            decision_reasoning: decisionReasoning,
            corrective_actions: correctiveActions || null,
            lessons_learned: lessonsLearned || null,
            decided_by: user.data.user.id
          })
          .select()
          .single();

        if (error) throw error;
        setDecision(data as InvestigationDecision);
      }

      setEditing(false);
      toast.success('Investigation decision saved successfully');
    } catch (error) {
      console.error('Error saving investigation decision:', error);
      toast.error('Failed to save investigation decision');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    if (decision) {
      setDecisionType(decision.decision_type);
      setDecisionReasoning(decision.decision_reasoning);
      setCorrectiveActions(decision.corrective_actions || '');
      setLessonsLearned(decision.lessons_learned || '');
      setEditing(false);
    }
  };

  const getDecisionIcon = (type: string) => {
    switch (type) {
      case 'uphold':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'reject':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'partially_uphold':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Scale className="h-4 w-4" />;
    }
  };

  const getDecisionLabel = (type: string) => {
    switch (type) {
      case 'uphold':
        return 'Upheld';
      case 'reject':
        return 'Not Upheld';
      case 'partially_uphold':
        return 'Partially Upheld';
      default:
        return type;
    }
  };

  const getDecisionVariant = (type: string) => {
    switch (type) {
      case 'uphold':
        return 'default';
      case 'reject':
        return 'destructive';
      case 'partially_uphold':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const generateOutcomeLetter = async (style?: string) => {
    if (!decision) return;

    setGeneratingOutcomeLetter(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-complaint-outcome-letter', {
        body: {
          complaintId,
          outcomeType: decision.decision_type,
          outcomeSummary: decision.decision_reasoning,
          questionnaireData: {
            tone: style || letterStyle
          }
        }
      });

      if (error) throw error;

      if (data && data.outcomeLetter) {
        const newOutcomeLetter = data.outcomeLetter;
        setOutcomeLetter(newOutcomeLetter);
        
        // Save to database and create audit log
        await saveOutcomeLetterToDatabase(newOutcomeLetter, true);

        setShowOutcomeLetter(true);
        // Auto-scroll to bottom when modal opens with new content
        setTimeout(() => {
          if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
              scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
          }
        }, 100);
        toast.success('Outcome letter generated successfully');
      } else {
        throw new Error('No outcome letter generated');
      }
    } catch (error) {
      console.error('Error generating outcome letter:', error);
      toast.error('Failed to generate outcome letter');
    } finally {
      setGeneratingOutcomeLetter(false);
    }
  };

  const mapDecisionTypeToOutcomeType = (decisionType: string) => {
    switch (decisionType) {
      case 'uphold':
        return 'upheld';
      case 'reject':
        return 'not_upheld';
      case 'partially_uphold':
        return 'partially_upheld';
      default:
        return decisionType;
    }
  };

  const saveOutcomeLetterToDatabase = async (letterContent: string, isGenerated = false) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      if (existingOutcome) {
        // Update existing outcome
        const { error } = await supabase
          .from('complaint_outcomes')
          .update({ 
            outcome_letter: letterContent,
            letter_style: letterStyle,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOutcome.id);

        if (error) throw error;
        
        // Update complaint status to closed if not already
        const { error: statusError } = await supabase
          .from('complaints')
          .update({ 
            status: 'closed',
            closed_at: new Date().toISOString()
          })
          .eq('id', complaintId)
          .neq('status', 'closed'); // Only update if not already closed

        if (statusError) {
          console.error('Failed to update complaint status:', statusError);
          // Don't throw error here, outcome letter was still saved successfully
        } else {
          // Generate CQC compliance report when complaint is completed
          try {
            console.log('Generating CQC compliance report for completed complaint:', complaintId);
            const { data: cqcReportData, error: cqcError } = await supabase.functions.invoke(
              'generate-cqc-compliance-report',
              { body: { complaintId } }
            );
            
            if (cqcError) {
              console.error('Failed to generate CQC compliance report:', cqcError);
              // Don't fail the main process, just log the error
            } else {
              console.log('CQC compliance report generated successfully:', cqcReportData?.evidenceRecord?.id);
              toast.success('CQC compliance report generated automatically');
            }
          } catch (cqcReportError) {
            console.error('Error generating CQC compliance report:', cqcReportError);
            // Continue without failing the main process
          }
        }
      } else {
        // Create new outcome (this would require decision data)
        if (!decision) return;
        
        const { data, error } = await supabase
          .from('complaint_outcomes')
          .insert({
            complaint_id: complaintId,
            outcome_type: mapDecisionTypeToOutcomeType(decision.decision_type),
            outcome_summary: decision.decision_reasoning,
            outcome_letter: letterContent,
            letter_style: letterStyle,
            decided_by: user.data.user.id
          })
          .select()
          .single();

        if (error) throw error;
        setExistingOutcome(data);
        
        // Status will be automatically updated by the database trigger
      }

      // Add audit log
      await supabase.functions.invoke('log-complaint-activity', {
        body: {
          complaintId,
          actionType: isGenerated ? 'outcome_letter_generated' : 'outcome_letter_edited',
          actionDescription: isGenerated 
            ? 'Outcome letter generated using AI' 
            : 'Outcome letter manually edited',
          newValues: { outcome_letter_length: letterContent.length }
        }
      });

    } catch (error) {
      console.error('Error saving outcome letter:', error);
      throw error;
    }
  };

  const handleEditOutcomeLetter = () => {
    setEditedOutcomeLetter(outcomeLetter);
    setEditingOutcomeLetter(true);
  };

  const handleSaveOutcomeLetter = async () => {
    if (!editedOutcomeLetter.trim()) {
      toast.error('Outcome letter cannot be empty');
      return;
    }

    setSavingOutcomeLetter(true);
    try {
      await saveOutcomeLetterToDatabase(editedOutcomeLetter, false);
      setOutcomeLetter(editedOutcomeLetter);
      setEditingOutcomeLetter(false);
      toast.success('Outcome letter saved successfully');
    } catch (error) {
      console.error('Error saving outcome letter:', error);
      toast.error('Failed to save outcome letter');
    } finally {
      setSavingOutcomeLetter(false);
    }
  };

  const handleCancelEditOutcomeLetter = () => {
    setEditedOutcomeLetter('');
    setEditingOutcomeLetter(false);
  };

  const handleSendOutcomeEmail = async () => {
    if (!outcomeLetter) return;

    // Get complaint data
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      toast.error('Failed to load complaint data');
      return;
    }

    // Parse and validate manual email entries
    const parseEmails = (emailString: string): string[] => {
      return emailString
        .split(',')
        .map(email => email.trim())
        .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    };

    const manualToList = parseEmails(manualToEmails);
    const manualCcList = parseEmails(manualCcEmails);

    // Check if at least one recipient is selected or provided
    if (!emailToPatient && !bccToUser && manualToList.length === 0 && manualCcList.length === 0) {
      toast.error('Please provide at least one recipient');
      return;
    }

    // Check if patient email is available when patient is selected
    if (emailToPatient && !complaint.patient_contact_email) {
      toast.error('No patient email address available');
      return;
    }

    // Get user profile for BCC email
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user?.id)
      .single();

    if (bccToUser && !profile?.email) {
      toast.error('No user email address available');
      return;
    }

    // Resolve practice name for subject line
    let practiceName = 'Medical Practice';

    if (complaint.practice_id) {
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('practice_name')
        .eq('id', complaint.practice_id)
        .maybeSingle();
      if (practiceData?.practice_name) practiceName = practiceData.practice_name;
    } else if (user?.id) {
      const { data: latestPractice } = await supabase
        .from('practice_details')
        .select('practice_name, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestPractice?.practice_name) practiceName = latestPractice.practice_name;
    }

    setIsSendingOutcomeEmail(true);
    try {
      // Build TO recipients list
      const toRecipients: string[] = [];
      if (emailToPatient && complaint.patient_contact_email) {
        toRecipients.push(complaint.patient_contact_email);
      }
      toRecipients.push(...manualToList);

      // Build CC list
      const ccRecipients = manualCcList;

      // Build BCC list
      const bccRecipients: string[] = [];
      if (bccToUser && profile?.email) {
        bccRecipients.push(profile.email);
      }

      // If only BCC is selected, move it to "To" instead
      if (toRecipients.length === 0 && bccRecipients.length > 0) {
        toRecipients.push(...bccRecipients);
        bccRecipients.length = 0;
      }

      // Format the letter content as HTML
      const { formatLetterForEmail } = await import('@/utils/formatLetterForEmail');
      const formattedLetterHtml = formatLetterForEmail(outcomeLetter);

      const emailData = {
        to_email: toRecipients.join(', '),
        cc_email: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
        bcc_email: bccRecipients.length > 0 ? bccRecipients.join(', ') : undefined,
        subject: `Complaint Outcome - ${complaint.reference_number} - ${practiceName}`,
        message: formattedLetterHtml,
        template_type: 'complaint_outcome',
        from_name: 'NHS Complaints Team',
        reply_to: 'complaints@nhs.net',
        complaint_reference: complaint.reference_number
      };

      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: emailData
      });

      if (error) {
        throw new Error(error.message || 'Failed to send email');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients];
      toast.success(`Outcome letter sent to ${allRecipients.length} recipient(s)`);
      setShowOutcomeEmailDialog(false);
      
      // Update the sent_at timestamp in the database
      try {
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('complaint_outcomes')
          .update({ sent_at: now })
          .eq('complaint_id', complaintId);
        
        if (!updateError && existingOutcome) {
          setExistingOutcome({ ...existingOutcome, sent_at: now });
        }
      } catch (updateError) {
        console.error('Failed to update sent_at timestamp:', updateError);
      }
    } catch (error) {
      console.error('Error sending outcome email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsSendingOutcomeEmail(false);
    }
  };

  const handleDownloadOutcomeLetter = async () => {
    if (!outcomeLetter) {
      toast.error('No outcome letter available for download');
      return;
    }
    
    try {
      console.log('=== OUTCOME LETTER DOWNLOAD DEBUG ===');
      console.log('Starting outcome letter download...');
      console.log('Letter content length:', outcomeLetter.length);
      console.log('Letter content preview:', outcomeLetter.substring(0, 100) + '...');
      
      // Get complaint details for filename
      console.log('Fetching complaint reference...');
      const { data: complaint, error: complaintError } = await supabase
        .from('complaints')
        .select('reference_number')
        .eq('id', complaintId)
        .single();

      if (complaintError) {
        console.error('Complaint fetch error:', complaintError);
      }

      const referenceNumber = complaint?.reference_number || complaintId;
      console.log('Using reference number:', referenceNumber);
      
      // Fetch signatory and practice details for proper name/contact display
      const letterDetails = await fetchLetterDetails(existingOutcome?.decided_by);
      
      // Use the proper letter formatting function that handles logos
      const doc = await createLetterDocument(
        outcomeLetter, 
        'outcome', 
        referenceNumber,
        letterDetails.signatoryName,
        letterDetails.practiceDetails
      );
      console.log('Document structure created successfully with logo support');
      
      const buffer = await Packer.toBlob(doc);
      console.log('Document converted to blob, size:', buffer.size, 'bytes');
      
      if (buffer.size === 0) {
        throw new Error('Generated document is empty');
      }

      // Create and trigger download
      const url = URL.createObjectURL(buffer);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Outcome_Letter_${referenceNumber}.docx`;
      
      console.log('Triggering download for file:', link.download);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Download completed successfully');
      toast.success("Outcome letter downloaded successfully");
      
      // Add audit log for download (non-blocking)
      try {
        await supabase.functions.invoke('log-complaint-activity', {
          body: {
            complaintId,
            actionType: 'outcome_letter_downloaded',
            actionDescription: 'Outcome letter downloaded as DOCX file'
          }
        });
        console.log('Audit log added successfully');
      } catch (auditError) {
        console.error('Failed to log download activity:', auditError);
        // Don't fail the download for audit log issues
      }
    } catch (error) {
      console.error('=== OUTCOME LETTER DOWNLOAD ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      toast.error(`Failed to download outcome letter: ${error.message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Investigation Decision & Compliance
          </CardTitle>
          {decision && !editing && !disabled && activeTab === 'decision' && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="decision">Decision</TabsTrigger>
            <TabsTrigger value="compliance">
              Compliance Review{complianceSummary?.compliance_percentage === 100 ? ' (Completed)' : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decision" className="space-y-4 mt-4">
            {!editing && decision ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={getDecisionVariant(decision.decision_type)} className="flex items-center gap-1">
                    {getDecisionIcon(decision.decision_type)}
                    {getDecisionLabel(decision.decision_type)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(decision.decided_at).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <Label className="text-sm font-medium">Decision Reasoning</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: renderNHSMarkdown(decision.decision_reasoning || "")
                      }} 
                    />
                  </div>
                </div>

                {decision.corrective_actions && (
                  <div>
                    <Label className="text-sm font-medium">Corrective Actions</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: renderNHSMarkdown(decision.corrective_actions || "")
                        }} 
                      />
                    </div>
                  </div>
                )}

                {decision.lessons_learned && (
                  <div>
                    <Label className="text-sm font-medium">Lessons Learned</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: renderNHSMarkdown(decision.lessons_learned || "")
                        }} 
                      />
                    </div>
                  </div>
                )}
                
                {/* Outcome Letter Section */}
                <div className="pt-4 border-t space-y-4">
                  {outcomeLetter ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Outcome Letter</h4>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowOutcomeLetter(true)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleDownloadOutcomeLetter}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Export DOCX
                          </Button>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-md text-sm">
                        <p className="text-muted-foreground">
                          Outcome letter has been generated and saved. 
                          {outcomeLetter.length} characters.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="letter-style">Regenerate with Different Style</Label>
                        <div className="flex gap-2">
                          <Select value={letterStyle} onValueChange={setLetterStyle}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select letter style" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="professional">Professional & Balanced</SelectItem>
                              <SelectItem value="empathetic">Warm & Empathetic</SelectItem>
                              <SelectItem value="apologetic">Apologetic</SelectItem>
                              <SelectItem value="factual">Strictly Factual</SelectItem>
                              <SelectItem value="firm">Firm but Fair</SelectItem>
                              <SelectItem value="strong">Strong & Assertive (Vexatious)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="outline"
                            onClick={() => generateOutcomeLetter(letterStyle)}
                            disabled={disabled || generatingOutcomeLetter}
                          >
                            {generatingOutcomeLetter ? 'Regenerating...' : 'Regenerate'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="letter-style-initial">Letter Style</Label>
                        <Select value={letterStyle} onValueChange={setLetterStyle}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select letter style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional & Balanced</SelectItem>
                            <SelectItem value="empathetic">Warm & Empathetic</SelectItem>
                            <SelectItem value="apologetic">Apologetic</SelectItem>
                            <SelectItem value="factual">Strictly Factual</SelectItem>
                            <SelectItem value="firm">Firm but Fair</SelectItem>
                            <SelectItem value="strong">Strong & Assertive (Vexatious)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={() => generateOutcomeLetter()}
                        disabled={disabled || generatingOutcomeLetter}
                        className="w-full"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {generatingOutcomeLetter ? 'Generating Letter...' : 'Create Outcome Letter'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Edit Button */}
                <div className="flex justify-end pt-4 border-t">
                  {!disabled && (
                    <Button variant="outline" onClick={handleEdit} disabled={saving}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Decision
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="decision-type">Decision *</Label>
                  <Select value={decisionType} onValueChange={setDecisionType} disabled={disabled}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uphold">Upheld</SelectItem>
                      <SelectItem value="reject">Not Upheld</SelectItem>
                      <SelectItem value="partially_uphold">Partially Upheld</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="decision-reasoning">Decision Reasoning *</Label>
                  <div className="relative">
                    <Textarea
                      id="decision-reasoning"
                      placeholder="Explain the reasoning behind this decision based on the investigation findings..."
                      value={decisionReasoning}
                      onChange={(e) => setDecisionReasoning(e.target.value)}
                      disabled={disabled || saving}
                      rows={5}
                      className="pl-12"
                    />
                    {!disabled && (
                      <div className="absolute top-2 left-2">
                        <SpeechToText
                          onTranscription={(text) => {
                            setDecisionReasoning(prev => prev + (prev ? '\n\n' : '') + text);
                          }}
                          size="sm"
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {(decisionType === 'uphold' || decisionType === 'partially_uphold') && (
                  <div>
                    <Label htmlFor="corrective-actions">Corrective Actions</Label>
                    <div className="relative">
                      <Textarea
                        id="corrective-actions"
                        placeholder="What actions will be taken to address the issues identified..."
                        value={correctiveActions}
                        onChange={(e) => setCorrectiveActions(e.target.value)}
                        disabled={disabled || saving}
                        rows={4}
                        className="pl-12"
                      />
                      {!disabled && (
                        <div className="absolute top-2 left-2">
                          <SpeechToText
                            onTranscription={(text) => {
                              setCorrectiveActions(prev => prev + (prev ? '\n\n' : '') + text);
                            }}
                            size="sm"
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="lessons-learned">Lessons Learned</Label>
                  <div className="relative">
                    <Textarea
                      id="lessons-learned"
                      placeholder="What can be learned from this complaint to prevent similar issues..."
                      value={lessonsLearned}
                      onChange={(e) => setLessonsLearned(e.target.value)}
                      disabled={disabled || saving}
                      rows={3}
                      className="pl-12"
                    />
                    {!disabled && (
                      <div className="absolute top-2 left-2">
                        <SpeechToText
                          onTranscription={(text) => {
                            setLessonsLearned(prev => prev + (prev ? '\n\n' : '') + text);
                          }}
                          size="sm"
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={saveInvestigationDecision}
                    disabled={disabled || saving || !decisionType || !decisionReasoning.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Decision'}
                  </Button>
                  {decision && (
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  <h3 className="text-lg font-medium">NHS Compliance Checklist</h3>
                </div>
                <div className="flex items-center gap-2">
                  {complianceSummary && (
                    <Badge variant="outline" className="text-sm">
                      {complianceSummary.compliant_items} / {complianceSummary.total_items} Complete
                      ({complianceSummary.compliance_percentage}%)
                    </Badge>
                  )}
                  {!disabled && complianceChecks.length > 0 && complianceSummary?.compliance_percentage !== 100 && (
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
                        {complianceSummary.outstanding_items.slice(0, 3).map((item, index) => (
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

              <div className="space-y-3">
                {complianceChecks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No compliance checks available for this complaint
                  </div>
                ) : (
                  complianceChecks.map((check) => (
                    <div 
                      key={check.id} 
                      className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                        check.is_compliant 
                          ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                          : 'hover:bg-gray-50'
                      } ${disabled ? 'opacity-60' : ''}`}
                    >
                      <Checkbox
                        id={check.id}
                        checked={check.is_compliant}
                        onCheckedChange={(checked) => updateComplianceCheck(check.id, checked as boolean)}
                        disabled={disabled}
                        className="mt-1"
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
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Outcome Letter Dialog */}
      <Dialog open={showOutcomeLetter} onOpenChange={setShowOutcomeLetter}>
        <DialogContent className="p-0 max-w-none max-h-none w-[80vw] h-[80vh] resize overflow-auto border-2 border-gray-300" style={{ resize: 'both', minWidth: '400px', minHeight: '300px' }}>
          <div className="flex flex-col h-full">
            <DialogHeader className="flex-shrink-0 p-6 border-b">
              <DialogTitle>
                {editingOutcomeLetter ? 'Edit Outcome Letter' : 'Outcome Letter'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 p-6 overflow-hidden">
              {editingOutcomeLetter ? (
                <div className="h-full flex flex-col">
                  <Textarea
                    value={editedOutcomeLetter}
                    onChange={(e) => setEditedOutcomeLetter(e.target.value)}
                    className="flex-1 min-h-0 font-mono text-sm resize-none border focus:ring-2 p-4 bg-white"
                    placeholder="Edit outcome letter content..."
                    style={{ height: '100%' }}
                  />
                </div>
              ) : (
                <ScrollArea ref={scrollAreaRef} className="h-full">
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <FormattedLetterContent content={outcomeLetter} />
                  </div>
                </ScrollArea>
              )}
            </div>
            <div className="flex justify-between gap-2 p-6 border-t flex-shrink-0">
              <div className="flex gap-2">
                {!editingOutcomeLetter && (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleEditOutcomeLetter}
                      disabled={disabled}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        // Get complaint for patient email
                        const { data: complaint } = await supabase
                          .from('complaints')
                          .select('patient_contact_email')
                          .eq('id', complaintId)
                          .single();
                        
                        setEmailToPatient(!!complaint?.patient_contact_email);
                        setBccToUser(false);
                        setManualToEmails('');
                        setManualCcEmails('');
                        setShowOutcomeEmailDialog(true);
                      }}
                      disabled={isSendingOutcomeEmail}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </>
                )}
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    console.log('DOCX Download clicked - starting process');
                    try {
                      await handleDownloadOutcomeLetter();
                      console.log('DOCX Download completed successfully');
                    } catch (error) {
                      console.error('DOCX Download failed:', error);
                      toast.error(`Download failed: ${error.message}`);
                    }
                  }}
                  disabled={!outcomeLetter}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export DOCX
                </Button>
              </div>
              <div className="flex gap-2">
                {editingOutcomeLetter ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEditOutcomeLetter}
                      disabled={savingOutcomeLetter}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveOutcomeLetter}
                      disabled={savingOutcomeLetter || !editedOutcomeLetter.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {savingOutcomeLetter ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setShowOutcomeLetter(false)}>
                      Close
                    </Button>
                    <Button onClick={() => {
                      navigator.clipboard.writeText(outcomeLetter);
                      toast.success('Letter copied to clipboard');
                    }}>
                      Copy to Clipboard
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Resize indicator in bottom-right corner */}
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize opacity-50 hover:opacity-75">
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-400">
              <path d="M16 0v16H0z" fill="none"/>
              <path d="M16 16l-6-6M16 12l-2-2M16 8l-2-2" stroke="currentColor" strokeWidth="1" fill="none"/>
            </svg>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Outcome Letter Dialog */}
      <Dialog open={showOutcomeEmailDialog} onOpenChange={setShowOutcomeEmailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Outcome Letter</DialogTitle>
            <DialogDescription>
              Select recipients and options for sending the outcome letter
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Recipients */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Recipients</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="emailToPatientOutcome"
                    checked={emailToPatient}
                    onCheckedChange={(checked) => setEmailToPatient(checked as boolean)}
                    disabled={!emailToPatient && !manualToEmails.trim()}
                  />
                  <Label
                    htmlFor="emailToPatientOutcome"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Patient
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bccToUserOutcome"
                    checked={bccToUser}
                    onCheckedChange={(checked) => setBccToUser(checked as boolean)}
                  />
                  <Label htmlFor="bccToUserOutcome" className="text-sm font-normal cursor-pointer">
                    Me (BCC - blind copy me)
                  </Label>
                </div>
              </div>
            </div>

            {/* Manual Email Entry */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Additional Recipients</Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="manualToEmailsOutcome" className="text-xs text-muted-foreground">
                    To (separate multiple emails with commas)
                  </Label>
                  <Input
                    id="manualToEmailsOutcome"
                    type="text"
                    placeholder="email@example.com, another@example.com"
                    value={manualToEmails}
                    onChange={(e) => setManualToEmails(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="manualCcEmailsOutcome" className="text-xs text-muted-foreground">
                    CC (separate multiple emails with commas)
                  </Label>
                  <Input
                    id="manualCcEmailsOutcome"
                    type="text"
                    placeholder="email@example.com, another@example.com"
                    value={manualCcEmails}
                    onChange={(e) => setManualCcEmails(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOutcomeEmailDialog(false)}
              disabled={isSendingOutcomeEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendOutcomeEmail}
              disabled={isSendingOutcomeEmail || (!emailToPatient && !bccToUser && !manualToEmails.trim() && !manualCcEmails.trim())}
            >
              {isSendingOutcomeEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}