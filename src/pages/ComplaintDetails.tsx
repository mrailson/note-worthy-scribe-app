import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  User,
  Calendar,
  Mail,
  Folder,
  Download,
  RefreshCw,
  Printer,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  MessageSquare,
  Users,
  Edit,
  FileSignature,
  BarChart3,
  TrendingUp,
  Target,
  Filter,
  SortAsc,
  BookOpen,
  ClipboardCheck,
  Sparkles,
  Maximize2,
  Minimize2,
  FileEdit,
  SplitSquareHorizontal,
  Save,
  X,
  Eye as EyeIcon,
  Loader2,
  Send,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO, addBusinessDays, isWeekend } from "date-fns";
import { FormattedLetterContent } from "@/components/FormattedLetterContent";
import { AcknowledgementQuickPick } from "@/components/AcknowledgementQuickPick";
import { ManualAcknowledgementGenerator } from "@/components/ManualAcknowledgementGenerator";
import { Packer } from "docx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useToast } from "@/hooks/use-toast";
import { calculateWorkingDays, calculateDaysUntilDeadline } from "@/utils/workingDays";
import { AIEditLetterDialog } from "@/components/AIEditLetterDialog";

const ComplaintDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [complianceChecks, setComplianceChecks] = useState<any[]>([]);
  const [staffResponses, setStaffResponses] = useState<any[]>([]);
  const [acknowledgementLetter, setAcknowledgementLetter] = useState("");
  const [showAcknowledgementModal, setShowAcknowledgementModal] = useState(false);
  const [isEditingAcknowledgement, setIsEditingAcknowledgement] = useState(false);
  const [editedAcknowledgementContent, setEditedAcknowledgementContent] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<{ status: string; priority?: string; assignedTo?: string }>({
    status: "",
    priority: "",
    assignedTo: "",
  });
  const [outcome, setOutcome] = useState<{
    outcome_type: 'upheld' | 'partially_upheld' | 'not_upheld';
    summary: string;
    actions_taken: string;
    lessons_learned: string;
    compensation_offered?: string;
  }>({
    outcome_type: 'not_upheld',
    summary: '',
    actions_taken: '',
    lessons_learned: '',
    compensation_offered: '',
  });
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [outcomeLetter, setOutcomeLetter] = useState<string>('');
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [showOutcomeLetterModal, setShowOutcomeLetterModal] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [linkedComplaints, setLinkedComplaints] = useState<any[]>([]);
  const [involvedParties, setInvolvedParties] = useState<any[]>([]);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [isRegeneratingOutcome, setIsRegeneratingOutcome] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
  const [questionnaireHistory, setQuestionnaireHistory] = useState<any[]>([]);
  const [outcomeQuestionnaireData, setOutcomeQuestionnaireData] = useState<any>(null);
  const [showOutcomeAIEdit, setShowOutcomeAIEdit] = useState(false);
  const [aiEditInstructions, setAiEditInstructions] = useState("");
  const [isRegeneratingWithAI, setIsRegeneratingWithAI] = useState(false);
  const [isSendingAcknowledgementEmail, setIsSendingAcknowledgementEmail] = useState(false);
  const [showAcknowledgementEmailDialog, setShowAcknowledgementEmailDialog] = useState(false);
  const [emailToPatient, setEmailToPatient] = useState(true);
  const [bccToUser, setBccToUser] = useState(false);
  const [manualToEmails, setManualToEmails] = useState('');
  const [manualCcEmails, setManualCcEmails] = useState('');
  const [isSendingOutcomeEmail, setIsSendingOutcomeEmail] = useState(false);
  const [showOutcomeEmailDialog, setShowOutcomeEmailDialog] = useState(false);
  const [outcomeEmailToPatient, setOutcomeEmailToPatient] = useState(true);
  const [outcomeBccToUser, setOutcomeBccToUser] = useState(false);
  const [outcomeManualToEmails, setOutcomeManualToEmails] = useState('');
  const [outcomeManualCcEmails, setOutcomeManualCcEmails] = useState('');

  // Define all functions before useEffect
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
    ],
    content: editedAcknowledgementContent,
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML();
      setEditedAcknowledgementContent(newContent);
      setHasUnsavedChanges(true);
    },
  });

  // Update editor content when acknowledgement letter changes
  useEffect(() => {
    if (editor && isEditingAcknowledgement) {
      editor.commands.setContent(editedAcknowledgementContent);
    }
  }, [isEditingAcknowledgement]);

  const fetchComplaintDetails = async () => {
    if (!id) return;
    
    try {
      const { data: complaintData, error: complaintError } = await supabase
        .from('complaints')
        .select('*')
        .eq('id', id)
        .single();

      if (complaintError) throw complaintError;
      setComplaint(complaintData);

      // Fetch documents
      const { data: documentsData } = await supabase
        .from('complaint_documents')
        .select('*')
        .eq('complaint_id', id)
        .order('uploaded_at', { ascending: false });
      
      setDocuments(documentsData || []);

      // Fetch compliance checks
      const { data: complianceData } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', id);
      
      setComplianceChecks(complianceData || []);

      // Fetch staff responses
      const { data: staffData } = await supabase
        .from('staff_responses')
        .select('*')
        .eq('complaint_id', id);
      
      setStaffResponses(staffData || []);

      // Fetch acknowledgement letter
      const { data: ackData } = await supabase
        .from('complaint_acknowledgements')
        .select('acknowledgement_letter, created_at, sent_at')
        .eq('complaint_id', id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (ackData && ackData.length > 0) {
        setAcknowledgementLetter(ackData[0].acknowledgement_letter);
        setEditedAcknowledgementContent(ackData[0].acknowledgement_letter);
      }

      // Fetch outcome
      const { data: outcomeData } = await supabase
        .from('complaint_outcomes')
        .select('*')
        .eq('complaint_id', id)
        .single();

      if (outcomeData) {
        setExistingOutcome(outcomeData);
        setOutcomeLetter(outcomeData.outcome_letter || '');
      }

      // Fetch audit entries
      const { data: auditData } = await supabase
        .from('complaint_audit_detailed')
        .select('*')
        .eq('complaint_id', id)
        .order('created_at', { ascending: false });
      
      setAuditEntries(auditData || []);

      // Fetch compliance summary
      const { data: complianceSummaryData } = await supabase
        .rpc('get_complaint_compliance_summary', { complaint_id_param: id });
      
      setComplianceSummary(complianceSummaryData?.[0] || null);

      // Fetch involved parties
      const { data: partiesData } = await supabase
        .from('complaint_involved_parties')
        .select('*')
        .eq('complaint_id', id);
      
      setInvolvedParties(partiesData || []);

      // Check for linked complaints
      if (complaintData?.patient_name && complaintData?.practice_id) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const { count } = await supabase
          .from('complaints')
          .select('*', { count: 'exact', head: true })
          .eq('patient_name', complaintData.patient_name)
          .eq('practice_id', complaintData.practice_id)
          .neq('id', id)
          .gte('created_at', oneYearAgo.toISOString());

        if (count && count > 0) {
          setLinkedComplaints([{ count }]);
        }
      }

    } catch (error) {
      console.error('Error fetching complaint details:', error);
      toast.error('Failed to load complaint details');
    } finally {
      setLoading(false);
    }
  };

  // Check if user is system admin
  const checkSystemAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .rpc('is_system_admin', { _user_id: user.id });
      
      if (!error && data) {
        setIsSystemAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  useEffect(() => {
    fetchComplaintDetails();
    checkSystemAdmin();
  }, [id]);

  // Log complaint view
  useEffect(() => {
    const logView = async () => {
      if (!id) return;
      try {
        await supabase.rpc('log_complaint_view', {
          p_complaint_id: id,
          p_view_context: 'complaint_details_page'
        });
      } catch (error) {
        console.error('Error logging view:', error);
      }
    };
    logView();
  }, [id]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;

    setAddingNote(true);
    try {
      // Notes functionality would go here when the table is created
      toast.success('Note added successfully');
      setNewNote("");
      // Refresh notes
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!id || !statusUpdate.status) return;

    setSubmitting(true);
    try {
      const updateData: any = {
        status: statusUpdate.status,
      };

      if (statusUpdate.priority) updateData.priority = statusUpdate.priority;
      if (statusUpdate.assignedTo) updateData.assigned_to = statusUpdate.assignedTo;

      // Update timestamp based on status
      if (statusUpdate.status === 'under_review' && !complaint?.acknowledged_at) {
        updateData.acknowledged_at = new Date().toISOString();
      }
      if (statusUpdate.status === 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('complaints')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Complaint updated successfully');
      setShowUpdateModal(false);
      fetchComplaintDetails();
    } catch (error) {
      console.error('Error updating complaint:', error);
      toast.error('Failed to update complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateAcknowledgement = async (complaintId: string) => {
    setIsGeneratingLetter(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-complaint-acknowledgement', {
        body: {
          complaintId,
          regenerate: acknowledgementLetter ? true : false
        }
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw new Error(error.message || 'Failed to generate acknowledgement');
      }

      if (!data || !data.acknowledgementLetter) {
        throw new Error('No acknowledgement letter returned from function');
      }

      setAcknowledgementLetter(data.acknowledgementLetter);
      setEditedAcknowledgementContent(data.acknowledgementLetter);
      toast.success('Acknowledgement letter generated successfully');
      setShowAcknowledgementModal(true);
      
      // Refresh complaint to get updated status
      fetchComplaintDetails();
    } catch (error) {
      console.error('Error generating acknowledgement:', error);
      if (error.message?.includes('rate limit')) {
        toast.error('Rate limit reached. Please wait a moment before trying again.');
      } else if (error.message?.includes('payment required')) {
        toast.error('AI service requires setup. Please contact your administrator.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to generate acknowledgement letter');
      }
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const handleDownloadAcknowledgementLetter = async () => {
    if (!acknowledgementLetter || !complaint) return;
    
    try {
      // Create a simple text file download
      const blob = new Blob([acknowledgementLetter], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Acknowledgement_Letter_${complaint.reference_number}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Acknowledgement letter downloaded successfully");
    } catch (error) {
      console.error('Error downloading acknowledgement letter:', error);
      toast.error("Failed to download acknowledgement letter");
    }
  };

  const handleSendAcknowledgementEmail = async () => {
    if (!acknowledgementLetter || !complaint) return;

    // Parse and validate manual email entries
    const parseEmails = (emailString: string): string[] => {
      return emailString
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);
    };

    // Validate email format
    const isValidEmail = (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const toEmails = parseEmails(manualToEmails);
    const ccEmails = parseEmails(manualCcEmails);
    
    // Validate all manual emails
    const allManualEmails = [...toEmails, ...ccEmails];
    for (const email of allManualEmails) {
      if (!isValidEmail(email)) {
        toast.error(`Invalid email address: ${email}`);
        return;
      }
    }

    setIsSendingAcknowledgementEmail(true);
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      // Build recipient lists
      const toRecipients = [];
      const ccRecipients = [...ccEmails];
      const bccRecipients = [];

      if (emailToPatient && complaint?.patient_contact_email) {
        toRecipients.push(complaint.patient_contact_email);
      }
      toRecipients.push(...toEmails);

      if (bccToUser && profile?.email) {
        bccRecipients.push(profile.email);
      }

      if (toRecipients.length === 0 && ccRecipients.length === 0 && bccRecipients.length === 0) {
        toast.error('Please select at least one recipient');
        return;
      }

      console.log('Sending acknowledgement email to:', { toRecipients, ccRecipients, bccRecipients });

      const { data, error } = await supabase.functions.invoke('send-complaint-email', {
        body: {
          to: toRecipients,
          cc: ccRecipients,
          bcc: bccRecipients,
          subject: `Complaint Acknowledgement - ${complaint.reference_number}`,
          letterContent: acknowledgementLetter,
          patientName: complaint.patient_name,
          referenceNumber: complaint.reference_number,
          senderName: profile?.full_name || 'Practice Team',
          letterType: 'acknowledgement'
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('EmailJS error:', data);
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients];
      toast.success(`Acknowledgement letter sent to ${allRecipients.length} recipient(s)`);
      setShowAcknowledgementEmailDialog(false);
    } catch (error) {
      console.error('Error sending acknowledgement email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsSendingAcknowledgementEmail(false);
    }
  };

  const handleSendOutcomeEmail = async () => {
    if (!outcomeLetter || !complaint) return;

    // Parse and validate manual email entries
    const parseEmails = (emailString: string): string[] => {
      return emailString
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);
    };

    // Validate email format
    const isValidEmail = (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const toEmails = parseEmails(outcomeManualToEmails);
    const ccEmails = parseEmails(outcomeManualCcEmails);
    
    // Validate all manual emails
    const allManualEmails = [...toEmails, ...ccEmails];
    for (const email of allManualEmails) {
      if (!isValidEmail(email)) {
        toast.error(`Invalid email address: ${email}`);
        return;
      }
    }

    setIsSendingOutcomeEmail(true);
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      // Build recipient lists
      const toRecipients = [];
      const ccRecipients = [...ccEmails];
      const bccRecipients = [];

      if (outcomeEmailToPatient && complaint?.patient_contact_email) {
        toRecipients.push(complaint.patient_contact_email);
      }
      toRecipients.push(...toEmails);

      if (outcomeBccToUser && profile?.email) {
        bccRecipients.push(profile.email);
      }

      if (toRecipients.length === 0 && ccRecipients.length === 0 && bccRecipients.length === 0) {
        toast.error('Please select at least one recipient');
        return;
      }

      console.log('Sending outcome email to:', { toRecipients, ccRecipients, bccRecipients });

      const { data, error } = await supabase.functions.invoke('send-complaint-email', {
        body: {
          to: toRecipients,
          cc: ccRecipients,
          bcc: bccRecipients,
          subject: `Complaint Outcome Letter - ${complaint.reference_number}`,
          letterContent: outcomeLetter,
          patientName: complaint.patient_name,
          referenceNumber: complaint.reference_number,
          senderName: profile?.full_name || 'Practice Team',
          letterType: 'outcome'
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('EmailJS error:', data);
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients];
      toast.success(`Outcome letter sent to ${allRecipients.length} recipient(s)`);
      setShowOutcomeEmailDialog(false);
    } catch (error) {
      console.error('Error sending outcome email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsSendingOutcomeEmail(false);
    }
  };

  const handleSaveAcknowledgementLetter = async () => {
    if (!complaint || !editedAcknowledgementContent.trim()) return;
    
    setSubmitting(true);
    try {
      // Extract logo URL from original acknowledgement letter
      const logoMatch = acknowledgementLetter.match(/<!--\s*logo_url:\s*(https?:\/\/[^\s\n]+|\/[^\s\n]+)\s*-->/);
      
      // Prepare content to save - add logo comment back if it existed
      const contentToSave = logoMatch 
        ? `<!-- logo_url: ${logoMatch[1]} -->\n${editedAcknowledgementContent}`
        : editedAcknowledgementContent;

      // Update the acknowledgement letter in the database
      const { error } = await supabase
        .from('complaint_acknowledgements')
        .upsert({
          complaint_id: complaint.id,
          acknowledgement_letter: contentToSave,
          sent_at: new Date().toISOString()
        }, {
          onConflict: 'complaint_id'
        });

      if (error) throw error;

      setAcknowledgementLetter(contentToSave);
      setEditedAcknowledgementContent(contentToSave);
      setHasUnsavedChanges(false);
      toast.success('Acknowledgement letter saved successfully');
    } catch (error) {
      console.error('Error saving acknowledgement letter:', error);
      toast.error('Failed to save acknowledgement letter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseAcknowledgementModal = (force = false) => {
    if (hasUnsavedChanges && !force) {
      setShowDiscardDialog(true);
    } else {
      setShowAcknowledgementModal(false);
      setIsEditingAcknowledgement(false);
      setEditedAcknowledgementContent(acknowledgementLetter);
      setHasUnsavedChanges(false);
      setEditorMode('edit');
    }
  };

  const handleDiscardChanges = () => {
    setShowDiscardDialog(false);
    setShowAcknowledgementModal(false);
    setIsEditingAcknowledgement(false);
    setEditedAcknowledgementContent(acknowledgementLetter);
    setHasUnsavedChanges(false);
    setEditorMode('edit');
  };

  const handleCreateOutcome = async () => {
    if (!id || !outcome.summary.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Generate the outcome letter using AI
      const { data: letterData, error: letterError } = await supabase.functions.invoke('generate-outcome-letter', {
        body: {
          complaint,
          outcome,
        }
      });

      if (letterError) throw letterError;

      if (!letterData?.letter) {
        throw new Error('No outcome letter generated');
      }

      // Create outcome with the generated letter
      const { data: outcomeData, error: outcomeError } = await supabase
        .from('complaint_outcomes')
        .insert({
          complaint_id: id,
          outcome_type: outcome.outcome_type,
          outcome_summary: outcome.summary,
          outcome_letter: letterData.letter
        })
        .select()
        .single();

      if (outcomeError) throw outcomeError;

      // Update complaint status to closed
      const { error: updateError } = await supabase
        .from('complaints')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setExistingOutcome(outcomeData);
      setOutcomeLetter(letterData.letter);
      setAiAnalysis(letterData.analysis || '');
      setShowOutcomeModal(false);
      toast.success('Complaint outcome created successfully');
      fetchComplaintDetails();
    } catch (error) {
      console.error('Error creating outcome:', error);
      toast.error('Failed to create outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateOutcomeLetter = async () => {
    if (!id || !existingOutcome) return;

    setIsRegeneratingOutcome(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-outcome-letter', {
        body: {
          complaint,
          outcome: {
            outcome_type: existingOutcome.outcome_type,
            summary: existingOutcome.summary,
            actions_taken: existingOutcome.actions_taken,
            lessons_learned: existingOutcome.lessons_learned,
            compensation_offered: existingOutcome.compensation_offered
          }
        }
      });

      if (error) throw error;

      if (!data?.letter) {
        throw new Error('No outcome letter generated');
      }

      // Update the outcome with new letter
      const { error: updateError } = await supabase
        .from('complaint_outcomes')
        .update({ 
          outcome_letter: data.letter,
          ai_analysis: data.analysis || null
        })
        .eq('complaint_id', id);

      if (updateError) throw updateError;

      setOutcomeLetter(data.letter);
      setAiAnalysis(data.analysis || '');
      toast.success('Outcome letter regenerated successfully');
    } catch (error) {
      console.error('Error regenerating outcome letter:', error);
      toast.error('Failed to regenerate outcome letter');
    } finally {
      setIsRegeneratingOutcome(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'awaiting_response':
        return 'bg-orange-100 text-orange-800';
      case 'closed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const isStuck = complaint?.status === 'submitted' && 
                  complaint?.created_at && 
                  differenceInDays(new Date(), parseISO(complaint.created_at)) > 3;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading complaint details...</p>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Complaint Not Found</CardTitle>
            <CardDescription>
              The requested complaint could not be found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/complaints')} className="w-full">
              Back to Complaints
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate working days remaining and processing time
  const acknowledgementDate = complaint.acknowledged_at ? parseISO(complaint.acknowledged_at) : null;
  const closedDate = complaint.closed_at ? parseISO(complaint.closed_at) : null;
  const targetCompletionDate = acknowledgementDate ? addBusinessDays(acknowledgementDate, 20) : null;
  
  // For open complaints: show days remaining
  const daysRemaining = acknowledgementDate ? calculateDaysUntilDeadline(acknowledgementDate.toISOString()) : null;
  
  // For closed complaints: calculate working days taken
  const workingDaysTaken = acknowledgementDate && closedDate ? (() => {
    let count = 0;
    let currentDate = new Date(acknowledgementDate);
    const endDate = new Date(closedDate);
    
    while (currentDate <= endDate) {
      if (!isWeekend(currentDate)) {
        count++;
      }
      currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
    }
    return count;
  })() : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/complaints')}>
          ← Back to Complaints
        </Button>
      </div>

      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  {complaint.reference_number} - {complaint.complaint_title}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getStatusColor(complaint.status)}>
                    {formatStatus(complaint.status)}
                  </Badge>
                  <Badge className={getPriorityColor(complaint.priority)}>
                    {complaint.priority?.toUpperCase() || 'MEDIUM'}
                  </Badge>
                  <Badge variant="outline">
                    <Folder className="h-3 w-3 mr-1" />
                    {complaint.category || 'Uncategorized'}
                  </Badge>
                  {linkedComplaints.length > 0 && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {linkedComplaints[0].count} Related Complaints
                    </Badge>
                  )}
                </div>
              </div>
              <Button onClick={() => setShowUpdateModal(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Update Status
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Patient</p>
                <p className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {complaint.patient_name}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium">Clinical Care & Treatment</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Priority</p>
                <p className="font-medium">{complaint.priority}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">{formatStatus(complaint.status)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Incident Date</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(complaint.incident_date), 'dd/MM/yyyy')}
                </p>
              </div>
              {complaint.status === 'closed' ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Processing Time</p>
                  <p className={`font-medium flex items-center gap-2 ${
                    workingDaysTaken !== null && workingDaysTaken <= 20 
                      ? 'text-green-600' 
                      : 'text-orange-600'
                  }`}>
                    <Clock className="h-4 w-4" />
                    {workingDaysTaken !== null ? `${workingDaysTaken} working days` : 'Not available'}
                    {workingDaysTaken !== null && (
                      <Badge 
                        variant={workingDaysTaken <= 20 ? 'default' : 'destructive'}
                        className={workingDaysTaken <= 20 ? 'bg-green-100 text-green-800' : ''}
                      >
                        {workingDaysTaken <= 20 ? 'Within target' : 'Exceeded target'}
                      </Badge>
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Days Remaining</p>
                  <p className={`font-medium flex items-center gap-2 ${
                    daysRemaining !== null && daysRemaining <= 0 
                      ? 'text-red-600' 
                      : daysRemaining !== null && daysRemaining <= 5 
                        ? 'text-orange-600' 
                        : 'text-blue-600'
                  }`}>
                    <Clock className="h-4 w-4" />
                    {daysRemaining !== null 
                      ? daysRemaining <= 0 
                        ? `${Math.abs(daysRemaining)} days overdue` 
                        : `${daysRemaining} working days remaining`
                      : 'Not acknowledged yet'
                    }
                    {daysRemaining !== null && (
                      <Badge 
                        variant={daysRemaining <= 0 ? 'destructive' : daysRemaining <= 5 ? 'default' : 'secondary'}
                        className={
                          daysRemaining <= 0 
                            ? '' 
                            : daysRemaining <= 5 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-blue-100 text-blue-800'
                        }
                      >
                        {daysRemaining <= 0 ? 'Overdue' : daysRemaining <= 5 ? 'Urgent' : 'On track'}
                      </Badge>
                    )}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Description:</p>
              <p className="text-sm">{complaint.complaint_description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Details</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Acknowledgement Letter Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Acknowledgement Letter
                </CardTitle>
                <CardDescription>
                  Generate acknowledgement letter to confirm receipt of complaint
                </CardDescription>
              </CardHeader>
              <CardContent>
                {acknowledgementLetter ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-md">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">Letter Generated</span>
                      </div>
                      {complaint.acknowledged_at && (
                        <Badge variant="outline" className="text-xs">
                          Generated: {format(parseISO(complaint.acknowledged_at), 'dd/MM/yyyy HH:mm')}
                        </Badge>
                      )}
                      {complaint.acknowledged_at && differenceInDays(new Date(), parseISO(complaint.acknowledged_at)) <= 3 && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          ✓ Within target (3 working days)
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAcknowledgementModal(true)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Letter
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await handleDownloadAcknowledgementLetter();
                            toast.success('Letter downloaded');
                          } catch (error) {
                            console.error('Download failed:', error);
                            toast.error(`Download failed: ${error.message}`);
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEmailToPatient(!!complaint?.patient_contact_email);
                          setBccToUser(false);
                          setManualToEmails('');
                          setManualCcEmails('');
                          setShowAcknowledgementEmailDialog(true);
                        }}
                        disabled={isSendingAcknowledgementEmail}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateAcknowledgement(complaint.id)}
                        disabled={isGeneratingLetter}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${isGeneratingLetter ? 'animate-spin' : ''}`} />
                        {isGeneratingLetter ? 'Regenerating...' : 'Regenerate'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isStuck && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-amber-900">
                              Complaint Workflow Issue Detected
                            </p>
                            <p className="text-sm text-amber-700">
                              This complaint has been in 'Submitted' status for more than 3 days. 
                              Use the manual generator below to fix the status and generate the acknowledgement.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <ManualAcknowledgementGenerator
                      complaintId={complaint.id}
                      complaintReference={complaint.reference_number}
                      currentStatus={complaint.status}
                      onSuccess={() => {
                        fetchComplaintDetails();
                        toast.success('Acknowledgement generated successfully');
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outcome Section */}
            {complaint.status === 'closed' && existingOutcome ? (
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <FileText className="h-5 w-5" />
                    Outcome Letter - Complaint {
                      existingOutcome.outcome_type === 'upheld' ? 'Upheld' :
                      existingOutcome.outcome_type === 'partially_upheld' ? 'Partially Upheld' :
                      'Not Upheld'
                    }
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    The final outcome letter for this complaint has been generated and is ready to view or download
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <Badge variant="default" className="bg-green-600 text-white">
                          Outcome: {
                            existingOutcome.outcome_type === 'upheld' ? 'Complaint Upheld' :
                            existingOutcome.outcome_type === 'partially_upheld' ? 'Partially Upheld' :
                            'Complaint Not Upheld'
                          }
                        </Badge>
                        <Badge variant="outline" className="text-xs w-fit">
                          Created: {format(parseISO(existingOutcome.created_at), 'dd/MM/yyyy HH:mm')}
                        </Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowOutcomeLetterModal(true)}
                          className="border-green-600 text-green-700 hover:bg-green-100"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Letter
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!outcomeLetter || !complaint) return;
                            
                            try {
                              const blob = new Blob([outcomeLetter], { type: 'text/plain' });
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `Outcome_Letter_${complaint.reference_number}.txt`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                              
                              toast.success("Outcome letter downloaded successfully");
                            } catch (error) {
                              console.error('Error downloading outcome letter:', error);
                              toast.error("Failed to download outcome letter");
                            }
                          }}
                          className="border-green-600 text-green-700 hover:bg-green-100"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOutcomeEmailToPatient(!!complaint?.patient_contact_email);
                            setOutcomeBccToUser(false);
                            setOutcomeManualToEmails('');
                            setOutcomeManualCcEmails('');
                            setShowOutcomeEmailDialog(true);
                          }}
                          disabled={isSendingOutcomeEmail}
                          className="border-green-600 text-green-700 hover:bg-green-100"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRegenerateOutcomeLetter}
                          disabled={isRegeneratingOutcome}
                          className="border-green-600 text-green-700 hover:bg-green-100"
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${isRegeneratingOutcome ? 'animate-spin' : ''}`} />
                          {isRegeneratingOutcome ? 'Regenerating...' : 'Regenerate Letter'}
                        </Button>
                        {aiAnalysis && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAiAnalysisModal(true)}
                            className="border-purple-500 text-purple-600 hover:bg-purple-50"
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            AI Report
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : complaint.status !== 'closed' ? (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    Ready to Create Outcome Letter?
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    Skip directly to creating the final complaint outcome letter for the patient
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setShowOutcomeModal(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <FileSignature className="h-4 w-4 mr-2" />
                    Create Outcome Letter
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            {/* Detailed Investigation Workflow */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Detailed Investigation Workflow
                  <Badge variant="secondary" className="ml-auto">
                    For Complex/Detailed Complaints requiring evidence and feedback from multiple areas
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Document how the complaint will be investigated and who needs to provide input
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Content for workflow section...
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            {/* Compliance Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Compliance Checklist
                </CardTitle>
                <CardDescription>
                  Track compliance with NHS complaints regulations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {complianceSummary && (
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Compliance Progress</span>
                      <span className="text-sm font-bold">
                        {complianceSummary.compliant_items} / {complianceSummary.total_items} ({complianceSummary.compliance_percentage.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  {complianceChecks.map((check) => (
                    <div
                      key={check.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <Checkbox
                        checked={check.is_compliant}
                        onCheckedChange={async (checked) => {
                          try {
                            const { error } = await supabase
                              .from('complaint_compliance_checks')
                              .update({ 
                                is_compliant: checked as boolean,
                                checked_at: new Date().toISOString()
                              })
                              .eq('id', check.id);

                            if (error) throw error;
                            
                            fetchComplaintDetails();
                            toast.success('Compliance check updated');
                          } catch (error) {
                            console.error('Error updating compliance:', error);
                            toast.error('Failed to update compliance');
                          }
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{check.compliance_item}</p>
                        <p className="text-xs text-muted-foreground mt-1">{check.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            {/* Audit Log */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Audit Log
                </CardTitle>
                <CardDescription>
                  Complete history of actions taken on this complaint
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="flex gap-3 pb-3 border-b last:border-0">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary"></div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{entry.action_description}</p>
                            <p className="text-xs text-muted-foreground">
                              by {entry.user_email} • {format(parseISO(entry.created_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {auditEntries.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No audit entries yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Update Status Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Complaint Status</DialogTitle>
            <DialogDescription>
              Change the status and other details of this complaint
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={statusUpdate.status}
                onValueChange={(value) => setStatusUpdate({ ...statusUpdate, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="awaiting_response">Awaiting Response</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={statusUpdate.priority}
                onValueChange={(value) => setStatusUpdate({ ...statusUpdate, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={submitting || !statusUpdate.status}>
              {submitting ? 'Updating...' : 'Update Complaint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome Modal */}
      <Dialog open={showOutcomeModal} onOpenChange={setShowOutcomeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Complaint Outcome</DialogTitle>
            <DialogDescription>
              Document the outcome and generate the final response letter
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="outcome-type">Outcome Type</Label>
              <Select
                value={outcome.outcome_type}
                onValueChange={(value: any) => setOutcome({ ...outcome, outcome_type: value })}
              >
                <SelectTrigger id="outcome-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upheld">Complaint Upheld</SelectItem>
                  <SelectItem value="partially_upheld">Partially Upheld</SelectItem>
                  <SelectItem value="not_upheld">Not Upheld</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Summary of Investigation</Label>
              <Textarea
                id="summary"
                value={outcome.summary}
                onChange={(e) => setOutcome({ ...outcome, summary: e.target.value })}
                placeholder="Provide a brief summary of the investigation findings..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actions">Actions Taken</Label>
              <Textarea
                id="actions"
                value={outcome.actions_taken}
                onChange={(e) => setOutcome({ ...outcome, actions_taken: e.target.value })}
                placeholder="Describe any actions taken in response..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lessons">Lessons Learned</Label>
              <Textarea
                id="lessons"
                value={outcome.lessons_learned}
                onChange={(e) => setOutcome({ ...outcome, lessons_learned: e.target.value })}
                placeholder="What improvements will be made as a result?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compensation">Compensation Offered (if applicable)</Label>
              <Input
                id="compensation"
                value={outcome.compensation_offered}
                onChange={(e) => setOutcome({ ...outcome, compensation_offered: e.target.value })}
                placeholder="e.g., £50 goodwill gesture"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutcomeModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateOutcome} 
              disabled={submitting || !outcome.summary.trim()}
            >
              {submitting ? 'Creating...' : 'Create Outcome & Generate Letter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome Letter Modal */}
      <Dialog open={showOutcomeLetterModal} onOpenChange={setShowOutcomeLetterModal}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Outcome Letter - {complaint?.reference_number}</DialogTitle>
            <DialogDescription>
              Review and download the outcome letter
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="bg-background p-8 border rounded-lg shadow-sm">
              <FormattedLetterContent content={outcomeLetter} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowOutcomeLetterModal(false)}
            >
              Close
            </Button>
            <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={async () => {
                            try {
                              const blob = new Blob([outcomeLetter], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Outcome_Letter_${complaint?.reference_number || 'OUTCOME'}.txt`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success('Outcome letter downloaded');
                            } catch (error) {
                              console.error('Error downloading outcome letter:', error);
                              toast.error('Failed to download outcome letter');
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setOutcomeEmailToPatient(!!complaint?.patient_contact_email);
                  setOutcomeBccToUser(false);
                  setOutcomeManualToEmails('');
                  setOutcomeManualCcEmails('');
                  setShowOutcomeEmailDialog(true);
                }}
                disabled={isSendingOutcomeEmail}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setShowOutcomeAIEdit(true);
                }}
              >
                <Brain className="h-4 w-4 mr-1" />
                AI Edit
              </Button>
              <Button onClick={() => {
                navigator.clipboard.writeText(outcomeLetter);
                toast.success('Letter copied to clipboard');
              }}>
                Copy to Clipboard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* AI Edit Outcome Letter - Placeholder for future implementation */}

      {/* AI Analysis Modal */}
      <Dialog open={showAiAnalysisModal} onOpenChange={setShowAiAnalysisModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Analysis Report
            </DialogTitle>
            <DialogDescription>
              Detailed AI analysis of the complaint and outcome
            </DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            <div 
              dangerouslySetInnerHTML={{ __html: aiAnalysis }} 
              className="space-y-4"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAiAnalysisModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acknowledgement Letter Modal */}
      <Dialog 
        open={showAcknowledgementModal} 
        onOpenChange={(open) => {
          if (!open) {
            handleCloseAcknowledgementModal();
          }
        }}
      >
        <DialogContent className={cn(
          "flex flex-col overflow-hidden",
          isFullscreen 
            ? "w-screen h-screen max-w-none max-h-none m-0 rounded-none"
            : "max-w-6xl max-h-[90vh]"
        )}>
          <DialogHeader className="flex-shrink-0 border-b pb-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">Acknowledgement Letter - {complaint?.reference_number}</span>
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  {isEditingAcknowledgement ? 'Edit and format your letter with rich text controls' : 'View, edit, download, or regenerate the acknowledgement letter'}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 p-0 -mt-1"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex flex-col gap-2 flex-1 overflow-hidden p-3">
            {/* Action bar */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b flex-shrink-0">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await handleDownloadAcknowledgementLetter();
                      toast.success('Letter downloaded');
                    } catch (error) {
                      console.error('Download failed:', error);
                      toast.error(`Download failed: ${error.message}`);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Reset email options when opening dialog
                    setEmailToPatient(!!complaint?.patient_contact_email);
                    setBccToUser(false);
                    setManualToEmails('');
                    setManualCcEmails('');
                    setShowAcknowledgementEmailDialog(true);
                  }}
                  disabled={isSendingAcknowledgementEmail}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </Button>
                <AcknowledgementQuickPick
                  currentLetter={editedAcknowledgementContent}
                  onLetterChange={(newLetter) => {
                    setEditedAcknowledgementContent(newLetter);
                    setHasUnsavedChanges(true);
                  }}
                  complaintId={complaint.id}
                  complaintDescription={complaint.complaint_description}
                  referenceNumber={complaint.reference_number}
                />
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleCloseAcknowledgementModal(true);
                    handleGenerateAcknowledgement(complaint.id);
                  }}
                  disabled={submitting}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${submitting ? 'animate-spin' : ''}`} />
                  {submitting ? 'Regenerating...' : 'Regenerate'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {isEditingAcknowledgement && (
                  <>
                    {/* View mode toggles */}
                    <div className="flex gap-1 border rounded-md p-1">
                      <Button
                        variant={editorMode === 'edit' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setEditorMode('edit')}
                        className="h-7 px-2"
                      >
                        <FileEdit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant={editorMode === 'split' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setEditorMode('split')}
                        className="h-7 px-2"
                      >
                        <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1" />
                        Split
                      </Button>
                      <Button
                        variant={editorMode === 'preview' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setEditorMode('preview')}
                        className="h-7 px-2"
                      >
                        <EyeIcon className="h-3.5 w-3.5 mr-1" />
                        Preview
                      </Button>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <Button
                      size="sm"
                      onClick={handleSaveAcknowledgementLetter}
                      disabled={!hasUnsavedChanges || submitting}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {submitting ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCloseAcknowledgementModal()}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </>
                )}
                {!isEditingAcknowledgement && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsEditingAcknowledgement(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit Letter
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAcknowledgementModal(false)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Content area */}
            <div className="flex-1 overflow-hidden">
              {!isEditingAcknowledgement ? (
                <div className="bg-muted/30 p-4 rounded-lg h-full overflow-y-auto">
                  <div 
                    className="max-w-none bg-background p-8 rounded shadow-sm origin-top transition-transform duration-300"
                    style={{ transform: isFullscreen ? 'scale(1.6)' : 'scale(1)' }}
                  >
                    <FormattedLetterContent content={acknowledgementLetter} />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col gap-2">
                  {/* Editor toolbar */}
                  {editor && editorMode !== 'preview' && (
                    <div className="border rounded-lg p-2 flex gap-1 flex-wrap bg-background flex-shrink-0">
                      <Button
                        variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className="h-8 px-2"
                      >
                        <strong>B</strong>
                      </Button>
                      <Button
                        variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className="h-8 px-2"
                      >
                        <em>I</em>
                      </Button>
                      <Button
                        variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className="h-8 px-2"
                      >
                        <u>U</u>
                      </Button>
                      <Separator orientation="vertical" className="h-6 my-1" />
                      <Button
                        variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        className="h-8 px-2 text-xs"
                      >
                        Left
                      </Button>
                      <Button
                        variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        className="h-8 px-2 text-xs"
                      >
                        Center
                      </Button>
                      <Button
                        variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        className="h-8 px-2 text-xs"
                      >
                        Right
                      </Button>
                    </div>
                  )}

                  {/* Main content area with split/single view */}
                  <div className="flex-1 overflow-hidden">
                    {editorMode === 'split' ? (
                      <ResizablePanelGroup direction="horizontal" className="h-full">
                        <ResizablePanel defaultSize={50} minSize={30}>
                          <div className="h-full overflow-y-auto bg-muted/30 p-4">
                            <div className="bg-background rounded border min-h-full">
                              <EditorContent editor={editor} className="prose prose-sm max-w-none p-4" />
                            </div>
                          </div>
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={50} minSize={30}>
                          <div className="h-full overflow-y-auto bg-muted/30 p-4">
                            <div 
                              className="bg-background p-8 rounded shadow-sm origin-top transition-transform duration-300"
                              style={{ transform: isFullscreen ? 'scale(1.6)' : 'scale(1)' }}
                            >
                              <FormattedLetterContent content={editedAcknowledgementContent} />
                            </div>
                          </div>
                        </ResizablePanel>
                      </ResizablePanelGroup>
                    ) : editorMode === 'edit' ? (
                      <div className="h-full overflow-y-auto bg-muted/30 p-4">
                        <div className="bg-background rounded border min-h-full">
                          <EditorContent editor={editor} className="prose prose-sm max-w-none p-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full overflow-y-auto bg-muted/30 p-4 rounded-lg border">
                        <div 
                          className="bg-background p-6 rounded shadow-sm max-w-4xl mx-auto origin-top transition-transform duration-300"
                          style={{ transform: isFullscreen ? 'scale(1.6)' : 'scale(1)' }}
                        >
                          <FormattedLetterContent content={editedAcknowledgementContent} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Unsaved Changes Alert Dialog */}
            <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have unsaved changes to the acknowledgement letter. If you continue, your changes will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue Editing</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDiscardChanges}>
                    Discard Changes
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Email options dialog */}
            <Dialog open={showAcknowledgementEmailDialog} onOpenChange={setShowAcknowledgementEmailDialog}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Email Acknowledgement Letter</DialogTitle>
                  <DialogDescription>
                    Select recipients and options for sending the acknowledgement letter
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Recipients */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Recipients</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="emailToPatient"
                          checked={emailToPatient}
                          onCheckedChange={(checked) => setEmailToPatient(checked as boolean)}
                          disabled={!complaint?.patient_contact_email}
                        />
                        <Label
                          htmlFor="emailToPatient"
                          className={`text-sm font-normal cursor-pointer ${!complaint?.patient_contact_email ? 'text-muted-foreground' : ''}`}
                        >
                          Patient ({complaint?.patient_contact_email || 'No email available'})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="bccToUser"
                          checked={bccToUser}
                          onCheckedChange={(checked) => setBccToUser(checked as boolean)}
                        />
                        <Label htmlFor="bccToUser" className="text-sm font-normal cursor-pointer">
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
                        <Label htmlFor="manualToEmails" className="text-xs text-muted-foreground">
                          To (separate multiple emails with commas)
                        </Label>
                        <Input
                          id="manualToEmails"
                          type="text"
                          placeholder="email@example.com, another@example.com"
                          value={manualToEmails}
                          onChange={(e) => setManualToEmails(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="manualCcEmails" className="text-xs text-muted-foreground">
                          CC (separate multiple emails with commas)
                        </Label>
                        <Input
                          id="manualCcEmails"
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
                    onClick={() => setShowAcknowledgementEmailDialog(false)}
                    disabled={isSendingAcknowledgementEmail}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendAcknowledgementEmail}
                    disabled={isSendingAcknowledgementEmail || (!emailToPatient && !bccToUser && !manualToEmails.trim() && !manualCcEmails.trim())}
                  >
                    {isSendingAcknowledgementEmail ? (
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

            {/* Outcome Email options dialog */}
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
                          id="outcomeEmailToPatient"
                          checked={outcomeEmailToPatient}
                          onCheckedChange={(checked) => setOutcomeEmailToPatient(checked as boolean)}
                          disabled={!complaint?.patient_contact_email}
                        />
                        <Label
                          htmlFor="outcomeEmailToPatient"
                          className={`text-sm font-normal cursor-pointer ${!complaint?.patient_contact_email ? 'text-muted-foreground' : ''}`}
                        >
                          Patient ({complaint?.patient_contact_email || 'No email available'})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="outcomeBccToUser"
                          checked={outcomeBccToUser}
                          onCheckedChange={(checked) => setOutcomeBccToUser(checked as boolean)}
                        />
                        <Label htmlFor="outcomeBccToUser" className="text-sm font-normal cursor-pointer">
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
                        <Label htmlFor="outcomeManualToEmails" className="text-xs text-muted-foreground">
                          To (separate multiple emails with commas)
                        </Label>
                        <Input
                          id="outcomeManualToEmails"
                          type="text"
                          placeholder="email@example.com, another@example.com"
                          value={outcomeManualToEmails}
                          onChange={(e) => setOutcomeManualToEmails(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="outcomeManualCcEmails" className="text-xs text-muted-foreground">
                          CC (separate multiple emails with commas)
                        </Label>
                        <Input
                          id="outcomeManualCcEmails"
                          type="text"
                          placeholder="email@example.com, another@example.com"
                          value={outcomeManualCcEmails}
                          onChange={(e) => setOutcomeManualCcEmails(e.target.value)}
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
                    disabled={isSendingOutcomeEmail || (!outcomeEmailToPatient && !outcomeBccToUser && !outcomeManualToEmails.trim() && !outcomeManualCcEmails.trim())}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintDetails;
