import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Header } from "@/components/Header";
import { ViewFullResponseModal } from "@/components/ViewFullResponseModal";
import { AcknowledgementQuickPick } from "@/components/AcknowledgementQuickPick";
import { ComplianceCheckCleanupButton } from "@/components/ComplianceCheckCleanupButton";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";

import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText,
  Plus,
  Calendar,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  Users,
  Send,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  Brain,
  Shield,
  X,
  Save,
  AlertTriangle,
  ArrowLeft,
  Search,
  RefreshCw,
  ChevronDown,
  BookOpen,
  Sparkles,
  Loader2,
  Headphones,
  Copy
} from "lucide-react";
import { format } from "date-fns";
import { showToast } from '@/utils/toastWrapper';
import { createLetterDocument, fetchLetterDetails } from "@/utils/letterFormatter";
import { Document, Packer } from "docx";
import { exportComplaintReportToWord } from "@/utils/exportComplaintReport";
import { InvestigationEvidence } from "@/components/InvestigationEvidence";
import { InvestigationFindings } from "@/components/InvestigationFindings";
import { InvestigationDecisionAndLearning } from "@/components/InvestigationDecisionAndLearning";
import { InvestigationEvidenceTab } from "@/components/InvestigationEvidenceTab";
import { calculateDaysUntilDeadline, calculateWorkingDays } from "@/utils/workingDays";
import { logComplaintViewWithMetadata } from "@/utils/auditLogger";

import { FormattedLetterContent } from "@/components/FormattedLetterContent";
import { CQCReportModal } from "@/components/CQCReportModal";
import { ComplaintOutcomeQuestionnaire } from "@/components/ComplaintOutcomeQuestionnaire";
import RichTextEditor, { EditorCommands } from "@/components/RichTextEditor";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import FindReplacePanel from "@/components/FindReplacePanel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Maximize2, Minimize2, FileEdit, Eye as EyeIcon, Columns, ChevronUp } from "lucide-react";
import { AIEditLetterDialog } from "@/components/AIEditLetterDialog";
import { ManualAcknowledgementGenerator } from "@/components/ManualAcknowledgementGenerator";
import { EnhancedAuditLogViewer } from "@/components/EnhancedAuditLogViewer";
import { ComplaintAudioOverviewPlayer } from "@/components/complaints/ComplaintAudioOverviewPlayer";
import { ComplaintReviewConversation } from "@/components/complaints/ComplaintReviewConversation";
import { ComplaintReviewNote } from "@/components/complaints/ComplaintReviewNote";
import { AddComplaintDocumentDialog } from "@/components/complaints/AddComplaintDocumentDialog";
import { getComplaintSourceLabel, getAcknowledgementRecipientLabel } from "@/utils/complaintSourceLabels";

interface Complaint {
  id: string;
  reference_number: string;
  patient_name: string;
  patient_dob: string | null;
  patient_contact_phone: string | null;
  patient_contact_email: string | null;
  patient_address: string | null;
  incident_date: string;
  complaint_title: string;
  complaint_description: string;
  category: string;
  subcategory: string | null;
  location_service: string | null;
  staff_mentioned: string[] | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  consent_given: boolean;
  consent_details: string | null;
  complaint_on_behalf: boolean;
  submitted_at: string | null;
  acknowledged_at: string | null;
  response_due_date: string | null;
  closed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  practice_id: string | null;
  data_retention_date: string | null;
  complaint_source: string | null;
  creator?: {
    full_name: string | null;
    email: string | null;
  };
}

const ComplaintDetails = () => {
  const { user } = useAuth();
  const { id: complaintId } = useParams();
  const navigate = useNavigate();
  
  // All state hooks must be called before any conditional returns
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [previousComplaintsCount, setPreviousComplaintsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("workflow");
  const [outcomeType, setOutcomeType] = useState('');
  const [outcomeSummary, setOutcomeSummary] = useState('');
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [outcomeLetter, setOutcomeLetter] = useState("");
  const [showOutcomeLetter, setShowOutcomeLetter] = useState(false);
  const [outcomeLetterSent, setOutcomeLetterSent] = useState(false);
  const [outcomeLetterSentAt, setOutcomeLetterSentAt] = useState<string | null>(null);
  const [isEditingOutcomeLetter, setIsEditingOutcomeLetter] = useState(false);
  const [editedOutcomeLetterContent, setEditedOutcomeLetterContent] = useState("");
  const [outcomeEditorMode, setOutcomeEditorMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [hasUnsavedOutcomeChanges, setHasUnsavedOutcomeChanges] = useState(false);
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [acknowledgementLetter, setAcknowledgementLetter] = useState("");
  const [acknowledgementId, setAcknowledgementId] = useState<string | null>(null);
  const [acknowledgementDate, setAcknowledgementDate] = useState<string | null>(null);
  const [showAcknowledgementLetter, setShowAcknowledgementLetter] = useState(false);
  const [showAcknowledgementModal, setShowAcknowledgementModal] = useState(false);
  const [isEditingAcknowledgement, setIsEditingAcknowledgement] = useState(false);
  const [editedAcknowledgementContent, setEditedAcknowledgementContent] = useState("");
  const [isCheckingAcknowledgement, setIsCheckingAcknowledgement] = useState(false);
  const [editorMode, setEditorMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingModalClose, setPendingModalClose] = useState(false);
  const [editorApi, setEditorApi] = useState<EditorCommands | null>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [complianceChecks, setComplianceChecks] = useState<any[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [complianceAuditLogs, setComplianceAuditLogs] = useState<any[]>([]);
  const [complaintDocuments, setComplaintDocuments] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingAcknowledgement, setIsGeneratingAcknowledgement] = useState(false);
  const [isRegeneratingOutcome, setIsRegeneratingOutcome] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(false);
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
  const [acknowledgementSentToPatient, setAcknowledgementSentToPatient] = useState(false);
  const [acknowledgementSentAt, setAcknowledgementSentAt] = useState<string | null>(null);
  const [audioOverview, setAudioOverview] = useState<any>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [reviewConversations, setReviewConversations] = useState<any[]>([]);
  const [showAudioSummarySection, setShowAudioSummarySection] = useState(false);
  const [showReviewNotesSection, setShowReviewNotesSection] = useState(false);
  const [isReSummarising, setIsReSummarising] = useState(false);
  const [showAddDocumentDialog, setShowAddDocumentDialog] = useState(false);


  // Define all functions before useEffect
  const fetchComplaintDetails = async () => {
    if (!user || !complaintId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('id', complaintId)
        .single();

      if (error) throw error;
      
      // Fetch creator profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', data.created_by)
        .maybeSingle();
      
      setComplaint({ ...data, creator: creatorProfile });
      
      // Count previous complaints from the same patient in last 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      let prevComplaintsCount = 0;
      {
        // Build query safely when practice_id can be null
        const base = supabase
          .from('complaints')
          .select('*', { count: 'exact', head: true })
          .eq('patient_name', data.patient_name)
          .neq('id', complaintId)
          .gte('created_at', twelveMonthsAgo.toISOString());

        const { count, error: prevErr } = data.practice_id
          ? await base.eq('practice_id', data.practice_id)
          : await base.is('practice_id', null);

        if (prevErr) {
          console.error('Error counting previous complaints:', prevErr);
        } else {
          prevComplaintsCount = count || 0;
        }
      }

      setPreviousComplaintsCount(prevComplaintsCount);

      // Fetch existing outcome if available
      const { data: outcomeData } = await supabase
        .from('complaint_outcomes')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (outcomeData) {
        setExistingOutcome(outcomeData);
        setOutcomeType(outcomeData.outcome_type);
        setOutcomeSummary(outcomeData.outcome_summary);
        setOutcomeLetter(outcomeData.outcome_letter || "");
        setOutcomeLetterSent(!!outcomeData.sent_at);
        setOutcomeLetterSentAt(outcomeData.sent_at);
        
        // Fetch the questionnaire data used to generate this outcome
        console.log('🔍 Fetching questionnaire data for complaint:', complaintId);
        const { data: questionnaireData, error: questionnaireError } = await supabase
          .from('complaint_outcome_questionnaires')
          .select('*')
          .eq('complaint_id', complaintId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (questionnaireError) {
          console.error('❌ Error fetching questionnaire data:', questionnaireError);
        }
        
        console.log('📊 Questionnaire query result:', { 
          hasData: !!questionnaireData, 
          data: questionnaireData,
          error: questionnaireError 
        });
        
        if (questionnaireData) {
          // Fetch the user profile for the person who created the questionnaire
          let createdByName = 'Unknown User';
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', questionnaireData.created_by)
              .maybeSingle();
            
            if (profileError) {
              console.error('Error fetching profile for questionnaire creator:', profileError);
            }
            
            if (profileData?.full_name) {
              createdByName = profileData.full_name;
            }
          } catch (error) {
            console.error('Failed to fetch profile:', error);
          }
          
          const questionnaireContent = typeof questionnaireData.questionnaire_data === 'object' 
            ? questionnaireData.questionnaire_data as Record<string, any>
            : {};
          
          setOutcomeQuestionnaireData({
            ...questionnaireContent,
            created_by_name: createdByName,
            created_at: questionnaireData.created_at
          });
          
          console.log('✅ Loaded questionnaire data for outcome:', {
            complaintId,
            hasData: !!questionnaireContent,
            createdBy: createdByName,
            keys: Object.keys(questionnaireContent)
          });
          
          // Load AI analysis if it exists in the questionnaire data
          if (questionnaireContent.ai_analysis && typeof questionnaireContent.ai_analysis === 'string') {
            setAiAnalysis(questionnaireContent.ai_analysis);
          }
        } else {
          console.warn('⚠️ No questionnaire data found for complaint:', complaintId);
        }
        
        // If there's outcome data but no investigation method set yet, 
        // we'll check later if it should be "direct-investigation"
      }

      // Fetch acknowledgement letter (get the most recent one)
      const { data: ackData } = await supabase
        .from('complaint_acknowledgements')
        .select('id, acknowledgement_letter, created_at, sent_at')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ackData) {
        console.log('Acknowledgement data:', ackData);
        setAcknowledgementId(ackData.id);
        setAcknowledgementLetter(ackData.acknowledgement_letter);
        setAcknowledgementDate(ackData.created_at);
        setAcknowledgementSentToPatient(!!ackData.sent_at);
        setAcknowledgementSentAt(ackData.sent_at);
      }

      // Set up real-time subscription for acknowledgement updates
      const acknowledgementChannel = supabase
        .channel(`acknowledgement_${complaintId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'complaint_acknowledgements',
            filter: `complaint_id=eq.${complaintId}`
          },
          (payload) => {
            console.log('Acknowledgement updated:', payload);
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              setAcknowledgementId(newData.id);
              setAcknowledgementLetter(newData.acknowledgement_letter);
              setAcknowledgementDate(newData.created_at);
              setAcknowledgementSentToPatient(!!newData.sent_at);
              setAcknowledgementSentAt(newData.sent_at);
              showToast.success('Acknowledgement letter ready', { section: 'complaints' });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(acknowledgementChannel);
      };

      // Fetch audio overview if available
      const { data: audioData } = await supabase
        .from('complaint_audio_overviews')
        .select('*')
        .eq('complaint_id', complaintId)
        .maybeSingle();

      if (audioData) {
        setAudioOverview(audioData);
      }

      // Fetch review conversations
      const { data: reviewData, error: reviewError } = await supabase
        .from('complaint_review_conversations')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });

      if (reviewError) {
        console.error('Error fetching review conversations:', reviewError);
      } else if (reviewData) {
        setReviewConversations(reviewData);
      }

    } catch (error) {
      console.error('Error fetching complaint details:', error);
      showToast.error("Failed to load complaint details", { section: 'complaints' });
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceData = async () => {
    if (!user || !complaintId) return;
    try {
      const { data: checks, error: checksError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId);

      if (checksError) throw checksError;
      
      // Define standard complaint handling order
      const standardOrder = [
        'Acknowledgement sent within 3 working days',
        'Investigation completed within 20 working days',
        'NHS Constitution pledge - may be extended with good reason',
        'Complainant informed of investigation timeline',
        'All relevant staff interviewed',
        'Medical records reviewed',
        'Evidence collected and documented',
        'Investigation findings documented',
        'Response letter drafted',
        'Response reviewed by appropriate authority',
        'Final response sent to complainant',
        'Complaint outcome recorded',
        'Learning points identified',
        'Action plan created if needed',
        'Complainant satisfaction checked'
      ];
      
      // Sort checks by the standard order with stable tie-breakers so items never jump
      const orderMap = new Map(standardOrder.map((item, i) => [item, i]));
      const sortedChecks = (checks || [])
        .sort((a: any, b: any) => {
          const rankA = orderMap.has(a.compliance_item) ? orderMap.get(a.compliance_item)! : 1000;
          const rankB = orderMap.has(b.compliance_item) ? orderMap.get(b.compliance_item)! : 1000;
          if (rankA !== rankB) return rankA - rankB;
          const da = a.created_at || '';
          const db = b.created_at || '';
          if (da !== db) return da.localeCompare(db);
          return String(a.id).localeCompare(String(b.id));
        });
      
      setComplianceChecks(sortedChecks);

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


  const fetchComplaintDocuments = async () => {
    if (!user || !complaintId) return;
    try {
      const { data, error } = await supabase
        .from('complaint_documents')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setComplaintDocuments(data || []);
    } catch (error) {
      console.error('Error fetching complaint documents:', error);
    }
  };

  const fetchAuditLogs = async () => {
    if (!user || !complaintId) return;
    try {
      const { data: logs, error } = await supabase
        .from('complaint_audit_detailed')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Deduplicate VIEW events - keep only one per minute
      const deduplicatedLogs = (logs || []).reduce((acc: any[], log: any) => {
        if (log.action_type === 'VIEW') {
          const logMinute = new Date(log.created_at).toISOString().slice(0, 16);
          const existingViewInMinute = acc.find(
            l => l.action_type === 'VIEW' && 
            new Date(l.created_at).toISOString().slice(0, 16) === logMinute
          );
          if (existingViewInMinute) return acc;
        }
        return [...acc, log];
      }, []);
      
      setAuditLogs(deduplicatedLogs);

      const { data: complianceLogs, error: complianceError } = await supabase
        .from('complaint_compliance_audit')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });

      if (complianceError) throw complianceError;
      setComplianceAuditLogs(complianceLogs || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  // Log complaint view when component loads
  const logComplaintView = async () => {
    if (!user || !complaintId) return;
    try {
      await logComplaintViewWithMetadata(complaintId, 'complaint_details_page');
    } catch (error) {
      console.error('Error logging complaint view:', error);
      // Don't show toast for view logging errors to avoid cluttering UI
    }
  };

  // useEffect hook - must be called before conditional returns
  useEffect(() => {
    if (user && complaintId) {
      fetchComplaintDetails();
      fetchComplianceData();
      fetchAuditLogs();
      fetchComplaintDocuments();
      logComplaintView(); // Log the view
    }
  }, [user, complaintId]);

  // Refresh compliance data when active tab changes to ensure sync
  useEffect(() => {
    if (activeTab === 'compliance' && user && complaintId) {
      fetchComplianceData();
    }
  }, [activeTab, user, complaintId]);

  // Set up real-time listener for compliance changes to sync between tabs
  useEffect(() => {
    if (!user || !complaintId) return;

    const channel = supabase
      .channel('compliance-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'complaint_compliance_checks',
          filter: `complaint_id=eq.${complaintId}`
        },
        () => {
          // Refresh compliance data when any check is updated
          fetchComplianceData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, complaintId]);



  // Countdown effect for acknowledgement generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isGeneratingAcknowledgement && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingAcknowledgement, countdown]);

  // Conditional return AFTER all hooks are called
  if (!user) {
    return <LoginForm />;
  }



  const getCategoryLabel = (category: string) => {
    const categoryOptions = [
      { value: "Administration", label: "Administration" },
      { value: "Appointments & Access", label: "Appointments & Access" },
      { value: "Clinical Care & Treatment", label: "Clinical Care & Treatment" },
      { value: "Communication Issues", label: "Communication Issues" },
      { value: "Confidentiality & Data", label: "Confidentiality & Data" },
      { value: "Digital Services", label: "Digital Services" },
      { value: "Facilities & Environment", label: "Facilities & Environment" },
      { value: "other", label: "Other" },
      { value: "Prescriptions", label: "Prescriptions" },
      { value: "Staff Attitude & Behaviour", label: "Staff Attitude & Behaviour" },
      { value: "Test Results & Follow-Up", label: "Test Results & Follow-Up" },
    ];
    
    const option = categoryOptions.find(opt => opt.value === category);
    return option ? option.label : category;
  };

  const getPriorityLabel = (priority: string) => {
    const priorityMap: { [key: string]: string } = {
      low: "Low",
      medium: "Medium", 
      high: "High",
      urgent: "Urgent"
    };
    return priorityMap[priority] || priority;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      draft: "Draft",
      submitted: "Submitted",
      under_review: "Open - Under Review",
      response_sent: "Response Sent", 
      closed: "Closed",
      escalated: "Escalated"
    };
    return statusMap[status] || status;
  };

  const updateComplianceCheck = async (checkId: string, isCompliant: boolean) => {
    try {
      const { error } = await supabase
        .from('complaint_compliance_checks')
        .update({ 
          is_compliant: isCompliant, 
          checked_at: new Date().toISOString(),
          checked_by: user.id 
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
      fetchComplianceData();
      
      showToast.success("Compliance check updated", { section: 'complaints' });
    } catch (error) {
      console.error('Error updating compliance check:', error);
      showToast.error("Failed to update compliance check", { section: 'complaints' });
    }
  };

  const markAllCompliant = async () => {
    try {
      // Get all non-compliant items
      const nonCompliantChecks = complianceChecks.filter(check => !check.is_compliant);

      if (nonCompliantChecks.length === 0) {
        showToast.success("All items are already completed", { section: 'complaints' });
        return;
      }

      // Update each item individually
      for (const check of nonCompliantChecks) {
        const { error } = await supabase
          .from('complaint_compliance_checks')
          .update({
            is_compliant: true,
            checked_at: new Date().toISOString(),
            checked_by: user.id
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
      fetchComplianceData();
      
      showToast.success(`Marked ${nonCompliantChecks.length} items as completed`, { section: 'complaints' });
    } catch (error) {
      console.error('Error marking all items as compliant:', error);
      showToast.error("Failed to mark all items as completed", { section: 'complaints' });
    }
  };

  const handleGenerateAcknowledgement = async (complaintId: string) => {
    setSubmitting(true);
    setIsGeneratingAcknowledgement(true);
    setCountdown(10);
    try {
      const { data, error } = await supabase.functions.invoke('generate-complaint-acknowledgement', {
        body: { complaintId }
      });

      if (error) throw error;

      setAcknowledgementLetter(data.acknowledgementLetter);
      showToast.success("Acknowledgement letter generated successfully", { section: 'complaints' });
    } catch (error) {
      console.error('Error generating acknowledgement:', error);
      showToast.error("Failed to generate acknowledgement letter", { section: 'complaints' });
    } finally {
      setSubmitting(false);
      setIsGeneratingAcknowledgement(false);
    }
  };

  const handleMarkAcknowledgementSent = async (isSent: boolean) => {
    if (!complaintId || !complaint || !acknowledgementId) return;
    
    try {
      const now = isSent ? new Date().toISOString() : null;
      
      // Update the specific acknowledgement record using its ID
      const { error: ackError } = await supabase
        .from('complaint_acknowledgements')
        .update({ 
          sent_at: now,
          sent_by: isSent ? user?.id : null
        })
        .eq('id', acknowledgementId);

      if (ackError) throw ackError;

      // Update complaint status to under_review if marking as sent
      if (isSent) {
        const { error: statusError } = await supabase
          .from('complaints')
          .update({ 
            status: 'under_review',
            acknowledged_at: now
          })
          .eq('id', complaintId);

        if (statusError) throw statusError;
        
        setComplaint({ ...complaint, status: 'under_review', acknowledged_at: now });
      }

      setAcknowledgementSentToPatient(isSent);
      setAcknowledgementSentAt(now);
      
      showToast.success(isSent 
        ? "Acknowledgement marked as sent to patient" 
        : "Acknowledgement send status cleared",
        { section: 'complaints' }
      );
    } catch (error) {
      console.error('Error updating acknowledgement sent status:', error);
      showToast.error("Failed to update acknowledgement status", { section: 'complaints' });
    }
  };

  const handleAnalyzeOutcome = async (complaintId: string) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-complaint-outcome', {
        body: { complaintId }
      });

      if (error) throw error;

      setAiAnalysis(data.analysis);
      showToast.success("AI analysis completed", { section: 'complaints' });
    } catch (error) {
      console.error('Error analyzing outcome:', error);
      showToast.error("Failed to analyze complaint", { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };


  const handleSaveOutcomeLetter = async () => {
    if (!complaint || !editedOutcomeLetterContent.trim()) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('complaint_outcomes')
        .update({ 
          outcome_letter: editedOutcomeLetterContent
        })
        .eq('complaint_id', complaint.id);

      if (error) throw error;

      setOutcomeLetter(editedOutcomeLetterContent);
      setIsEditingOutcomeLetter(false);
      setHasUnsavedOutcomeChanges(false);
      showToast.success("Outcome letter updated successfully", { section: 'complaints' });
    } catch (error) {
      console.error('Error saving outcome letter:', error);
      showToast.error("Failed to save outcome letter", { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateOutcomeLetter = async () => {
    if (!existingOutcome || !complaint) {
      showToast.error("No existing outcome found to regenerate", { section: 'complaints' });
      return;
    }

    try {
      setIsRegeneratingOutcome(true);
      console.log('Regenerating outcome letter for complaint:', complaint.id);

      const { data, error } = await supabase.functions.invoke('generate-complaint-outcome-letter', {
        body: {
          complaintId: complaint.id,
          outcomeType: existingOutcome.outcome_type,
          outcomeSummary: existingOutcome.outcome_summary
        }
      });

      if (error) {
        console.error('Error generating outcome letter:', error);
        throw error;
      }

      if (data?.outcomeLetter) {
        // Update the outcome letter in the database
        const { error: updateError } = await supabase
          .from('complaint_outcomes')
          .update({ outcome_letter: data.outcomeLetter })
          .eq('complaint_id', complaint.id);

        if (updateError) {
          console.error('Error updating outcome letter:', updateError);
          throw updateError;
        }

        setOutcomeLetter(data.outcomeLetter);
        showToast.success("Outcome letter regenerated successfully with practice logo included", { section: 'complaints' });
      } else {
        throw new Error('No outcome letter received from generator');
      }
    } catch (error) {
      console.error('Error regenerating outcome letter:', error);
      showToast.error("Failed to regenerate outcome letter", { section: 'complaints' });
    } finally {
      setIsRegeneratingOutcome(false);
    }
  };

  const handleToggleOutcomeLetterSent = async (isSent: boolean) => {
    if (!existingOutcome || !complaintId) return;
    
    try {
      const now = isSent ? new Date().toISOString() : null;
      
      const { error } = await supabase
        .from('complaint_outcomes')
        .update({ 
          sent_at: now,
          sent_by: isSent ? user?.id : null
        })
        .eq('id', existingOutcome.id);

      if (error) throw error;

      setOutcomeLetterSent(isSent);
      setOutcomeLetterSentAt(now);
      showToast.success(isSent ? "Outcome letter marked as sent" : "Outcome letter marked as not sent", { section: 'complaints' });
    } catch (error) {
      console.error('Error updating outcome letter sent status:', error);
      showToast.error("Failed to update outcome letter status", { section: 'complaints' });
    }
  };

  const handleDownloadAcknowledgementLetter = async () => {
    if (!acknowledgementLetter || !complaint) return;
    
    try {
      const doc = await createLetterDocument(acknowledgementLetter, 'acknowledgement', complaint.reference_number);
      const buffer = await Packer.toBlob(doc);
      
      // Create download link
      const url = window.URL.createObjectURL(buffer);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Acknowledgement_Letter_${complaint.reference_number}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast.success("Acknowledgement letter downloaded successfully", { section: 'complaints' });
    } catch (error) {
      console.error('Error downloading acknowledgement letter:', error);
      showToast.error("Failed to download acknowledgement letter", { section: 'complaints' });
    }
  };

  const handleSendAcknowledgementEmail = async () => {
    if (!acknowledgementLetter || !complaint) return;

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
      showToast.error("Please provide at least one recipient", { section: 'complaints' });
      return;
    }

    // Check if patient email is available when patient is selected
    if (emailToPatient && !complaint.patient_contact_email) {
      showToast.error("No patient email address available", { section: 'complaints' });
      return;
    }

    // Get user profile for BCC email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user?.id)
      .single();

    if (bccToUser && !profile?.email) {
      showToast.error("No user email address available", { section: 'complaints' });
      return;
    }

    // Resolve practice name for subject line
    let practiceName = 'Medical Practice';

    if (complaint.practice_id) {
      const { data: practiceData, error: practiceError } = await supabase
        .from('practice_details')
        .select('practice_name')
        .eq('id', complaint.practice_id)
        .maybeSingle();
      if (practiceError) console.error('Error fetching practice by id:', practiceError);
      if (practiceData?.practice_name) practiceName = practiceData.practice_name;
    } else if (user?.id) {
      // Fallback: latest practice for current user (handles multiple rows)
      const { data: latestPractice, error: latestError } = await supabase
        .from('practice_details')
        .select('practice_name, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) console.error('Error fetching latest user practice:', latestError);
      if (latestPractice?.practice_name) practiceName = latestPractice.practice_name;
    }

    console.log('Using practice name for email:', practiceName);

    setIsSendingAcknowledgementEmail(true);
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
        bccRecipients.length = 0; // Clear BCC array
      }

      // Format the letter content as HTML matching the Word document style
      const { formatLetterForEmail } = await import('@/utils/formatLetterForEmail');
      const formattedLetterHtml = formatLetterForEmail(acknowledgementLetter);

      const emailData = {
        to_email: toRecipients.join(', '),
        cc_email: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
        bcc_email: bccRecipients.length > 0 ? bccRecipients.join(', ') : undefined,
        subject: `Complaint Acknowledgement - ${complaint.reference_number} - ${practiceName}`,
        message: formattedLetterHtml,
        template_type: 'complaint_acknowledgement',
        from_name: 'NHS Complaints Team',
        reply_to: 'complaints@nhs.net',
        complaint_reference: complaint.reference_number
      };

      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: emailData
      });

      if (error) {
        console.error('Email sending error:', error);
        throw new Error(error.message || 'Failed to send email');
      }

      if (!data?.success) {
        console.error('EmailJS error:', data);
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients];
      showToast.success(`Acknowledgement letter sent to ${allRecipients.length} recipient(s)`, { section: 'complaints' });
      setShowAcknowledgementEmailDialog(false);
    } catch (error) {
      console.error('Error sending acknowledgement email:', error);
      showToast.error(error instanceof Error ? error.message : 'Failed to send email', { section: 'complaints' });
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
        .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    };

    const manualToList = parseEmails(manualToEmails);
    const manualCcList = parseEmails(manualCcEmails);

    // Check if at least one recipient is selected or provided
    if (!emailToPatient && !bccToUser && manualToList.length === 0 && manualCcList.length === 0) {
      showToast.error('Please provide at least one recipient', { section: 'complaints' });
      return;
    }

    // Check if patient email is available when patient is selected
    if (emailToPatient && !complaint.patient_contact_email) {
      showToast.error('No patient email address available', { section: 'complaints' });
      return;
    }

    // Get user profile for BCC email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user?.id)
      .single();

    if (bccToUser && !profile?.email) {
      showToast.error('No user email address available', { section: 'complaints' });
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
      showToast.success(`Outcome letter sent to ${allRecipients.length} recipient(s)`, { section: 'complaints' });
      setShowOutcomeEmailDialog(false);
      
      // Update the sent_at timestamp in the database
      try {
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('complaint_outcomes')
          .update({ sent_at: now })
          .eq('complaint_id', complaintId);
        
        if (!updateError) {
          setOutcomeLetterSent(true);
          setOutcomeLetterSentAt(now);
        }
      } catch (updateError) {
        console.error('Failed to update sent_at timestamp:', updateError);
      }
    } catch (error) {
      console.error('Error sending outcome email:', error);
      showToast.error(error instanceof Error ? error.message : 'Failed to send email', { section: 'complaints' });
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
      let contentToSave = editedAcknowledgementContent;
      if (logoMatch && !editedAcknowledgementContent.includes('<!-- logo_url:')) {
        contentToSave = `${logoMatch[0]}\n${editedAcknowledgementContent}`;
      }
      
      const { error } = await supabase
        .from('complaint_acknowledgements')
        .update({ 
          acknowledgement_letter: contentToSave,
          sent_at: new Date().toISOString()
        })
        .eq('complaint_id', complaint.id);

      if (error) throw error;

      // Update complaint status to under_review if not already
      const { error: statusError } = await supabase
        .from('complaints')
        .update({ 
          status: 'under_review',
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', complaint.id)
        .neq('status', 'under_review'); // Only update if not already under_review

      if (statusError) {
        console.error('Failed to update complaint status:', statusError);
        // Don't throw error here, acknowledgement letter was still saved successfully
      }

      setAcknowledgementLetter(contentToSave);
      setIsEditingAcknowledgement(false);
      showToast.success("Acknowledgement letter updated successfully", { section: 'complaints' });
    } catch (error) {
      console.error('Error saving acknowledgement letter:', error);
      showToast.error("Failed to save acknowledgement letter", { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateComplaintAudio = async (voiceProvider?: string, voiceId?: string, updatedText?: string) => {
    if (!complaint) return;
    
    setIsGeneratingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-complaint-audio-overview', {
        body: {
          complaintId: complaint.id,
          voiceProvider: voiceProvider || 'elevenlabs',
          voiceId: voiceId || 'G17SuINrv2H9FC6nvetn',
          overrideText: updatedText
        }
      });

      if (error) throw error;

      // Refresh to get new audio data
      await fetchComplaintDetails();
      showToast.success('Audio overview generated successfully', { section: 'complaints' });
    } catch (error: any) {
      console.error('Error generating audio:', error);
      showToast.error(`Failed to generate audio: ${error.message}`, { section: 'complaints' });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleRegenerateOutcomeWithAI = async (instructions: string) => {
    if (!complaint || !instructions.trim()) return;
    
    setIsRegeneratingWithAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-outcome-letter', {
        body: {
          complaintId: complaint.id,
          currentLetter: outcomeLetter,
          instructions: instructions,
          complaintDescription: complaint.complaint_description,
          referenceNumber: complaint.reference_number
        }
      });

      if (error) throw error;

      if (data?.regeneratedLetter) {
        setOutcomeLetter(data.regeneratedLetter);
        
        // Update the database with the new letter
        const { error: updateError } = await supabase
          .from('complaint_outcomes')
          .update({ 
            outcome_letter: data.regeneratedLetter,
            updated_at: new Date().toISOString()
          })
          .eq('complaint_id', complaint.id);

        if (updateError) throw updateError;

        showToast.success('Outcome letter regenerated with AI', { section: 'complaints' });
      }
    } catch (error) {
      console.error('Error regenerating outcome letter with AI:', error);
      showToast.error('Failed to regenerate outcome letter', { section: 'complaints' });
    } finally {
      setIsRegeneratingWithAI(false);
    }
  };

  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let workingDays = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  };

  // Helper function to check acknowledgement status
  const checkAcknowledgementStatus = async () => {
    const { data, error } = await supabase
      .from('complaint_acknowledgements')
      .select('id, acknowledgement_letter, created_at, sent_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking acknowledgement status:', error);
      return { exists: false, hasContent: false, data: null };
    }

    const hasContent = data?.acknowledgement_letter && 
                      data.acknowledgement_letter.replace(/<!--.*?-->|\s/g, '').length > 0;
    
    return { exists: !!data, hasContent, data };
  };

  const handleOpenAcknowledgementModal = async () => {
    // Check if acknowledgement letter has meaningful content
    const contentWithoutComments = acknowledgementLetter.replace(/<!--.*?-->|\s/g, '');
    
    if (!contentWithoutComments || contentWithoutComments.length === 0) {
      // Letter is empty, check if it's being generated
      setIsCheckingAcknowledgement(true);
      showToast.info('Checking acknowledgement status...', { section: 'complaints' });
      
      let attempts = 0;
      const maxAttempts = 15; // 30 seconds (2 seconds per attempt)
      
      const pollInterval = setInterval(async () => {
        attempts++;
        const status = await checkAcknowledgementStatus();
        
        if (status.hasContent && status.data) {
          // Found the letter!
          clearInterval(pollInterval);
          setAcknowledgementId(status.data.id);
          setAcknowledgementLetter(status.data.acknowledgement_letter);
          setAcknowledgementDate(status.data.created_at);
          setAcknowledgementSentToPatient(!!status.data.sent_at);
          setAcknowledgementSentAt(status.data.sent_at);
          setIsCheckingAcknowledgement(false);
          
          // Now open the modal with the loaded content
          openModalWithContent(status.data.acknowledgement_letter);
          return;
        }
        
        if (attempts >= maxAttempts) {
          // Timeout - show empty state in modal
          clearInterval(pollInterval);
          setIsCheckingAcknowledgement(false);
          showToast.warning('Acknowledgement is still generating. Opening empty view...', { section: 'complaints' });
          openModalWithContent('');
        }
      }, 2000);
      
      return;
    }
    
    // Letter exists, open normally
    openModalWithContent(acknowledgementLetter);
  };

  const openModalWithContent = (letterContent: string) => {
    // Try to restore draft from localStorage
    const draftKey = `ack_draft_${complaintId}`;
    const savedDraft = localStorage.getItem(draftKey);
    
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const draftTime = new Date(draft.timestamp).getTime();
        const letterTime = acknowledgementDate ? new Date(acknowledgementDate).getTime() : 0;
        
        if (draftTime > letterTime) {
          // Auto-restore newer draft
          setEditedAcknowledgementContent(draft.content);
        } else {
          const contentWithoutLogo = letterContent.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
          setEditedAcknowledgementContent(contentWithoutLogo);
          localStorage.removeItem(draftKey);
        }
      } catch (e) {
        const contentWithoutLogo = letterContent.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
        setEditedAcknowledgementContent(contentWithoutLogo);
      }
    } else {
      // Remove logo comment for editing, we'll add it back on save
      const contentWithoutLogo = letterContent.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
      setEditedAcknowledgementContent(contentWithoutLogo);
    }
    
    setIsEditingAcknowledgement(false);
    setEditorMode('split');
    setIsFullscreen(false);
    setHasUnsavedChanges(false);
    setShowFindReplace(false);
    setShowAcknowledgementModal(true);
  };

  const handleCloseAcknowledgementModal = (force = false) => {
    if (!force && hasUnsavedChanges) {
      setPendingModalClose(true);
      setShowUnsavedDialog(true);
      return;
    }
    
    setShowAcknowledgementModal(false);
    setHasUnsavedChanges(false);
    setPendingModalClose(false);
  };

  const handleDiscardChanges = () => {
    const draftKey = `ack_draft_${complaintId}`;
    localStorage.removeItem(draftKey);
    setShowUnsavedDialog(false);
    if (pendingModalClose) {
      setShowAcknowledgementModal(false);
      setPendingModalClose(false);
    } else {
      setIsEditingAcknowledgement(false);
      setEditedAcknowledgementContent(acknowledgementLetter);
    }
    setHasUnsavedChanges(false);
  };

  const handleEditorChange = (content: string) => {
    setEditedAcknowledgementContent(content);
    setHasUnsavedChanges(true);
    
    // Autosave to localStorage
    const draftKey = `ack_draft_${complaintId}`;
    localStorage.setItem(draftKey, JSON.stringify({
      content,
      timestamp: new Date().toISOString(),
    }));
  };

  const insertPlaceholder = (placeholder: string) => {
    if (editorApi) {
      editorApi.insertText(placeholder);
      editorApi.focus();
    } else {
      showToast.error('Editor not ready', { section: 'complaints' });
    }
  };


  const handleDeleteComplaint = async () => {
    if (!complaint || !user) return;
    
    setIsDeleting(true);
    try {
      // Delete the complaint (cascading deletes will handle related records)
      const { error } = await supabase
        .from('complaints')
        .delete()
        .eq('id', complaint.id);

      if (error) throw error;

      showToast.success("Complaint deleted successfully", { section: 'complaints' });
      navigate('/complaints');
    } catch (error) {
      console.error('Error deleting complaint:', error);
      showToast.error("Failed to delete complaint", { section: 'complaints' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading complaint details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-2xl font-bold mb-2">Complaint Not Found</h2>
            <p className="text-muted-foreground mb-4">The complaint you're looking for could not be found.</p>
            <Button onClick={() => navigate('/complaints')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Complaints
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with back button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/complaints')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Complaints
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Complaint Details</h1>
                <p className="text-muted-foreground">Manage complaint workflow and compliance</p>
              </div>
            </div>
          </div>

          {/* Complaint Header */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {complaint.reference_number} - {complaint.complaint_title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Patient:</strong> {complaint.patient_name}</div>
                <div><strong>Category:</strong> {getCategoryLabel(complaint.category)}</div>
                <div>
                  <strong>Status: </strong>
                  {complaint.status === 'under_review' && acknowledgementSentToPatient && (
                    <Mail className="h-3 w-3 inline ml-1 mr-1" />
                  )}
                  {getStatusLabel(complaint.status)}
                  {complaint.status === 'closed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-7 px-2 gap-1 align-middle"
                      onClick={async () => {
                        try {
                          showToast.info('Generating complaint report...', { section: 'complaints' });

                          let workingDaysToAcknowledge: number | undefined;
                          if (complaint.submitted_at && complaint.acknowledged_at) {
                            workingDaysToAcknowledge = calculateWorkingDays(
                              complaint.submitted_at,
                              complaint.acknowledged_at
                            );
                          }

                          const evidenceFiles = complaintDocuments.map(doc => ({
                            name: doc.file_name,
                            type: doc.file_type || 'Unknown'
                          }));

                          // Get the most recent AI review if available
                          const latestReview = reviewConversations.length > 0 ? reviewConversations[0] : null;
                          const aiReview = latestReview ? {
                            conversation_summary: latestReview.conversation_summary,
                            challenges_identified: latestReview.challenges_identified || [],
                            recommendations: latestReview.recommendations || [],
                            conversation_duration: latestReview.conversation_duration || 0,
                            conversation_started_at: latestReview.conversation_started_at,
                            created_by: latestReview.created_by || 'System User',
                          } : undefined;

                          await exportComplaintReportToWord({
                            complaint,
                            audioOverview: audioOverview?.audio_overview_text,
                            investigationSummary: existingOutcome?.investigation_summary,
                            findingsText: existingOutcome?.findings_text,
                            outcome: existingOutcome ? {
                              outcome_type: existingOutcome.outcome_type,
                              outcome_summary: existingOutcome.outcome_summary
                            } : undefined,
                            outcomeLetter,
                            acknowledgementLetter,
                            evidenceFiles,
                            workingDaysToAcknowledge,
                            aiReview,
                          });

                          showToast.success('Complaint report downloaded', { section: 'complaints' });
                        } catch (error) {
                          console.error('Error downloading report:', error);
                          showToast.error('Failed to download complaint report', { section: 'complaints' });
                        }
                      }}
                    >
                      <Download className="h-3 w-3" />
                      <span className="text-xs">Download Full Report</span>
                    </Button>
                  )}
                </div>
                <div><strong>Incident Date:</strong> {format(new Date(complaint.incident_date), 'dd/MM/yyyy')}</div>
                {complaint.response_due_date && (
                  <div><strong>Due Date:</strong> {format(new Date(complaint.response_due_date), 'dd/MM/yyyy')}</div>
                )}
              </div>
              
              {/* Days Remaining / Processing Time Display */}
              {complaint.submitted_at && (() => {
                const isClosed = complaint.status === 'closed';
                const daysRemaining = calculateDaysUntilDeadline(complaint.submitted_at);
                
                if (isClosed && complaint.closed_at) {
                  // Calculate days taken to process the complaint - inline to avoid type issues
                  const submittedDate = new Date(complaint.submitted_at);
                  const closedDate = new Date(complaint.closed_at);
                  
                  let daysTaken = 0;
                  const current = new Date(submittedDate);
                  current.setHours(0, 0, 0, 0);
                  closedDate.setHours(0, 0, 0, 0);
                  
                  while (current <= closedDate) {
                    const dayOfWeek = current.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                      daysTaken++;
                    }
                    current.setDate(current.getDate() + 1);
                  }
                  
                  const withinTarget = daysTaken <= 20;
                  
                  return (
                    <Alert className={`mt-4 ${withinTarget ? 'border-green-500 bg-green-50' : 'border-orange-500 bg-orange-50'}`}>
                      <CheckCircle className={`h-4 w-4 ${withinTarget ? 'text-green-600' : 'text-orange-600'}`} />
                      <AlertTitle className={withinTarget ? 'text-green-900' : 'text-orange-900'}>
                        Complaint Processed
                      </AlertTitle>
                      <AlertDescription className={withinTarget ? 'text-green-800' : 'text-orange-800'}>
                        Completed in <strong>{daysTaken} working days</strong>
                        {withinTarget ? ' - Within 20 working day target ✓' : ' - Exceeded 20 working day target'}
                      </AlertDescription>
                    </Alert>
                  );
                } else if (daysRemaining !== null) {
                  // Show days remaining for open complaints
                  const isUrgent = daysRemaining <= 5;
                  const isOverdue = daysRemaining < 0;
                  
                  return (
                    <Alert className={`mt-4 ${isOverdue ? 'border-destructive bg-destructive/10' : isUrgent ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'}`}>
                      <Clock className={`h-4 w-4 ${isOverdue ? 'text-destructive' : isUrgent ? 'text-orange-600' : 'text-blue-600'}`} />
                      <AlertTitle className={isOverdue ? 'text-destructive' : isUrgent ? 'text-orange-900' : 'text-blue-900'}>
                        {isOverdue ? 'Overdue' : 'Days Remaining'}
                      </AlertTitle>
                      <AlertDescription className={isOverdue ? 'text-destructive' : isUrgent ? 'text-orange-800' : 'text-blue-800'}>
                        {isOverdue 
                          ? <><strong>{Math.abs(daysRemaining)} working days overdue</strong> to meet the 20 working day target</>
                          : <><strong>{daysRemaining} working days remaining</strong> to meet the 20 working day target</>
                        }
                      </AlertDescription>
                    </Alert>
                  );
                }
                return null;
              })()}
              
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-foreground">Description:</strong>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={async () => { 
                      setIsReSummarising(true); 
                      try { 
                        const { data, error } = await supabase.functions.invoke('re-summarise-complaint', { body: { complaintId: complaint.id } }); 
                        if (error) throw error; 
                        if (data?.success) { 
                          showToast.success('Description re-summarised successfully'); 
                          const { data: refreshed } = await supabase.from('complaints').select('*').eq('id', complaint.id).single(); 
                          if (refreshed) setComplaint(refreshed); 
                        } else { 
                          throw new Error(data?.error || 'Failed to re-summarise'); 
                        } 
                      } catch (err: any) { 
                        console.error('Re-summarise error:', err); 
                        showToast.error(err.message || 'Failed to re-summarise description'); 
                      } finally { 
                        setIsReSummarising(false); 
                      } 
                    }} 
                    disabled={isReSummarising} 
                    className="gap-1.5"
                  >
                    {isReSummarising ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Re-summarise
                  </Button>
                </div>
                <p className="mt-1 text-base text-muted-foreground">{complaint.complaint_description
                  .replace(/([.!?])(?!\s|$)(?=[A-Z“”"'])/g, '$1 ')
                  .replace(/\s{2,}/g, ' ')
                }</p>
              </div>
            </CardContent>
          </Card>

          {/* Complaint Workflow Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-5 gap-1">
              <TabsTrigger value="details" className="flex-shrink-0 min-w-[80px] px-3 py-2 text-sm whitespace-nowrap touch-manipulation active:scale-95">
                Details
              </TabsTrigger>
              <TabsTrigger value="workflow" className="flex-shrink-0 min-w-[80px] px-3 py-2 text-sm whitespace-nowrap touch-manipulation active:scale-95">
                <span className="hidden sm:inline">Correspondence</span>
                <span className="sm:hidden">Response</span>
              </TabsTrigger>
              <TabsTrigger value="investigation" className="flex-shrink-0 min-w-[80px] px-3 py-2 text-sm whitespace-nowrap touch-manipulation active:scale-95">
                <span className="hidden sm:inline">Investigation Evidence</span>
                <span className="sm:hidden">Investigation</span>
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex-shrink-0 min-w-[80px] px-3 py-2 text-sm whitespace-nowrap touch-manipulation active:scale-95">
                Compliance
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex-shrink-0 min-w-[80px] px-3 py-2 text-sm whitespace-nowrap touch-manipulation active:scale-95">
                <span className="hidden sm:inline">Audit Log</span>
                <span className="sm:hidden">Audit</span>
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              {/* Important Dates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Important Dates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium">Complaint Received</Label>
                      <p className="text-sm text-muted-foreground">
                        {complaint.created_at ? format(new Date(complaint.created_at), 'dd/MM/yyyy HH:mm') : 'Not recorded'}
                      </p>
                    </div>
                    <div>
                      <Label className="font-medium">Incident Date</Label>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(complaint.incident_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    {complaint.submitted_at && (
                      <div>
                        <Label className="font-medium">Submitted Date</Label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(complaint.submitted_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                    
                    {/* Acknowledgment Deadline */}
                    {(complaint.submitted_at || complaint.created_at) && (
                      <div>
                        <Label className="font-medium">Acknowledgment Deadline</Label>
                        <p className="text-sm text-muted-foreground">
                          {(() => {
                            const baseDate = complaint.submitted_at || complaint.created_at;
                            const deadline = new Date(baseDate);
                            let workingDaysAdded = 0;
                            
                            while (workingDaysAdded < 3) {
                              deadline.setDate(deadline.getDate() + 1);
                              const dayOfWeek = deadline.getDay();
                              if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                workingDaysAdded++;
                              }
                            }
                            
                            const now = new Date();
                            const daysLeft = calculateWorkingDays(now.toISOString(), deadline.toISOString());
                            const isOverdue = now > deadline;
                            const isUrgent = daysLeft <= 7 && !isOverdue;
                            
                            return (
                              <>
                                {format(deadline, 'dd/MM/yyyy')}
                                {complaint.status !== 'closed' && complaint.status !== 'resolved' && !complaint.acknowledged_at && (
                                  <span className={`ml-2 text-xs font-medium ${
                                    isOverdue ? 'text-red-600' : isUrgent ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {isOverdue ? '⚠ Overdue' : `(${daysLeft} days left)`}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </p>
                      </div>
                    )}
                    
                    {complaint.acknowledged_at && (
                      <div>
                        <Label className="font-medium">Acknowledged Date</Label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(complaint.acknowledged_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                    
                    {/* Investigation & Outcome Letter Deadline */}
                    {(complaint.submitted_at || complaint.created_at) && (
                      <div>
                        <Label className="font-medium">Investigation & Outcome Deadline</Label>
                        <p className="text-sm text-muted-foreground">
                          {(() => {
                            const baseDate = complaint.submitted_at || complaint.created_at;
                            const deadline = new Date(baseDate);
                            let workingDaysAdded = 0;
                            
                            while (workingDaysAdded < 20) {
                              deadline.setDate(deadline.getDate() + 1);
                              const dayOfWeek = deadline.getDay();
                              if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                workingDaysAdded++;
                              }
                            }
                            
                            const now = new Date();
                            const daysLeft = calculateWorkingDays(now.toISOString(), deadline.toISOString());
                            const isOverdue = now > deadline;
                            const isUrgent = daysLeft <= 7 && !isOverdue;
                            
                            return (
                              <>
                                {format(deadline, 'dd/MM/yyyy')}
                                {complaint.status !== 'closed' && complaint.status !== 'resolved' && !outcomeLetter && (
                                  <span className={`ml-2 text-xs font-medium ${
                                    isOverdue ? 'text-red-600' : isUrgent ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {isOverdue ? '⚠ Overdue' : `(${daysLeft} days left)`}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </p>
                      </div>
                    )}
                    
                    {complaint.response_due_date && (
                      <div>
                        <Label className="font-medium">Response Due Date</Label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(complaint.response_due_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    )}
                    {complaint.closed_at && (
                      <div>
                        <Label className="font-medium">Closed Date</Label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(complaint.closed_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                    <div>
                      <Label className="font-medium">Last Updated</Label>
                      <p className="text-sm text-muted-foreground">
                        {complaint.updated_at ? format(new Date(complaint.updated_at), 'dd/MM/yyyy HH:mm') : 'Not recorded'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Patient Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Patient Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium">Patient Name</Label>
                      <p className="text-sm text-muted-foreground">{complaint.patient_name}</p>
                    </div>
                    {complaint.patient_dob && (
                      <div>
                        <Label className="font-medium">Date of Birth</Label>
                        <p className="text-sm text-muted-foreground">{format(new Date(complaint.patient_dob), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                    {complaint.patient_contact_phone && (
                      <div>
                        <Label className="font-medium">Phone Number</Label>
                        <p className="text-sm text-muted-foreground">
                          <a href={`tel:${complaint.patient_contact_phone}`} className="hover:underline">
                            {complaint.patient_contact_phone}
                          </a>
                        </p>
                      </div>
                    )}
                    {complaint.patient_contact_email && (
                      <div>
                        <Label className="font-medium">Email Address</Label>
                        <p className="text-sm text-muted-foreground">
                          <a href={`mailto:${complaint.patient_contact_email}`} className="hover:underline">
                            {complaint.patient_contact_email}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                  {complaint.patient_address && (
                    <div>
                      <Label className="font-medium">Address</Label>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{complaint.patient_address}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label className="font-medium">Previous Complaints (12 months)</Label>
                      <p className={`text-sm ${
                        previousComplaintsCount > 3 
                          ? 'text-red-600 font-bold' 
                          : previousComplaintsCount > 2 
                            ? 'text-orange-600 font-bold' 
                            : 'text-muted-foreground'
                      }`}>
                        {previousComplaintsCount} Previous
                      </p>
                    </div>
                    <div>
                      <Label className="font-medium">Complaint Made On Behalf</Label>
                      <p className="text-sm text-muted-foreground">
                        {complaint.complaint_on_behalf ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium">Consent Given</Label>
                      <p className="text-sm text-muted-foreground">
                        {complaint.consent_given ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                  {complaint.consent_details && (
                    <div>
                      <Label className="font-medium">Consent Details</Label>
                      <p className="text-sm text-muted-foreground mt-1">{complaint.consent_details}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Complaint Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Complaint Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium">Reference Number</Label>
                      <p className="text-sm text-muted-foreground font-mono">{complaint.reference_number}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Category</Label>
                      <p className="text-sm text-muted-foreground">{getCategoryLabel(complaint.category)}</p>
                    </div>
                    {complaint.subcategory && (
                      <div>
                        <Label className="font-medium">Subcategory</Label>
                        <p className="text-sm text-muted-foreground">{complaint.subcategory}</p>
                      </div>
                    )}
                    <div>
                      <Label className="font-medium">Priority</Label>
                      <Badge variant={complaint.priority === 'urgent' ? 'destructive' : complaint.priority === 'high' ? 'default' : 'secondary'}>
                        {getPriorityLabel(complaint.priority)}
                      </Badge>
                    </div>
                    <div>
                      <Label className="font-medium">Status</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant={complaint.status === 'closed' ? 'default' : complaint.status === 'submitted' ? 'secondary' : 'outline'}>
                          {complaint.status === 'under_review' && acknowledgementSentToPatient && (
                            <Mail className="h-3 w-3 mr-1" />
                          )}
                          {getStatusLabel(complaint.status)}
                        </Badge>
                        {complaint.status === 'closed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1"
                            onClick={async () => {
                              try {
                                showToast.info('Generating complaint report...', { section: 'complaints' });
                                
                                // Calculate working days to acknowledge
                                let workingDaysToAcknowledge: number | undefined;
                                if (complaint.submitted_at && complaint.acknowledged_at) {
                                  workingDaysToAcknowledge = calculateWorkingDays(
                                    complaint.submitted_at,
                                    complaint.acknowledged_at
                                  );
                                }

                                // Prepare evidence files list
                                const evidenceFiles = complaintDocuments.map(doc => ({
                                  name: doc.file_name,
                                  type: doc.file_type || 'Unknown'
                                }));

                                // Get the most recent AI review if available
                                const latestReview = reviewConversations.length > 0 ? reviewConversations[0] : null;
                                const aiReview = latestReview ? {
                                  conversation_summary: latestReview.conversation_summary,
                                  challenges_identified: latestReview.challenges_identified || [],
                                  recommendations: latestReview.recommendations || [],
                                  conversation_duration: latestReview.conversation_duration || 0,
                                  conversation_started_at: latestReview.conversation_started_at,
                                  created_by: latestReview.created_by || 'System User',
                                } : undefined;

                          await exportComplaintReportToWord({
                            complaint,
                            audioOverview: audioOverview?.audio_overview_text,
                            investigationSummary: existingOutcome?.investigation_summary,
                                  findingsText: existingOutcome?.findings_text,
                                  outcome: existingOutcome ? {
                                    outcome_type: existingOutcome.outcome_type,
                                    outcome_summary: existingOutcome.outcome_summary
                                  } : undefined,
                                  outcomeLetter,
                                  acknowledgementLetter,
                                  evidenceFiles,
                                  workingDaysToAcknowledge,
                                  aiReview,
                                });

                                showToast.success('Complaint report downloaded', { section: 'complaints' });
                              } catch (error) {
                                console.error('Error downloading report:', error);
                                showToast.error('Failed to download complaint report', { section: 'complaints' });
                              }
                            }}
                          >
                            <Download className="h-3 w-3" />
                            <span className="text-xs">Download Full Report</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="font-medium">Complaint Title</Label>
                    <p className="text-sm text-muted-foreground mt-1">{complaint.complaint_title}</p>
                  </div>
                  {complaint.location_service && (
                    <div>
                      <Label className="font-medium">Location/Service</Label>
                      <p className="text-sm text-muted-foreground">{complaint.location_service}</p>
                    </div>
                  )}
                  {complaint.staff_mentioned && complaint.staff_mentioned.length > 0 && (
                    <div>
                      <Label className="font-medium">Staff Mentioned</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {complaint.staff_mentioned.map((staff, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {staff}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="font-medium">Complaint Description</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg border">
                <p className="text-base text-foreground whitespace-pre-line">{complaint.complaint_description
                  .replace(/([.!?])(?!\s|$)(?=[A-Z“”"'])/g, '$1 ')
                  .replace(/\s{2,}/g, ' ')
                }</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Original Complaint Files - Always show, with upload option */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Complaint Files & Documents
                      </CardTitle>
                      <CardDescription>
                        Files and documents submitted with or related to this complaint
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddDocumentDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Document
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {complaintDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {complaintDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.file_type && `${doc.file_type} • `}
                                {doc.file_size && `${(doc.file_size / 1024).toFixed(1)} KB • `}
                                Uploaded: {format(new Date(doc.uploaded_at), 'dd/MM/yyyy HH:mm')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Download file logic
                                const { data } = supabase.storage
                                  .from('communication-files')
                                  .getPublicUrl(doc.file_path);
                                window.open(data.publicUrl, '_blank');
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // View file logic
                                const { data } = supabase.storage
                                  .from('communication-files')
                                  .getPublicUrl(doc.file_path);
                                window.open(data.publicUrl, '_blank');
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No documents uploaded yet</p>
                      <p className="text-xs mt-1">Click "Add Document" to upload files</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Document Dialog */}
              <AddComplaintDocumentDialog
                open={showAddDocumentDialog}
                onOpenChange={setShowAddDocumentDialog}
                complaintId={complaintId || ''}
                onSuccess={fetchComplaintDocuments}
              />

              {/* Administrative Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Administrative Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium">Complaint Source</Label>
                      <p className="text-sm text-muted-foreground">
                        {getComplaintSourceLabel(complaint.complaint_source)}
                      </p>
                    </div>
                    {complaint.assigned_to && (
                      <div>
                        <Label className="font-medium">Assigned To</Label>
                        <p className="text-sm text-muted-foreground">{complaint.assigned_to}</p>
                      </div>
                    )}
                    {complaint.practice_id && (
                      <div>
                        <Label className="font-medium">Practice ID</Label>
                        <p className="text-sm text-muted-foreground font-mono">{complaint.practice_id}</p>
                      </div>
                    )}
                    <div>
                      <Label className="font-medium">Created By</Label>
                      <p className="text-sm text-muted-foreground">
                        {complaint.creator?.full_name || complaint.creator?.email || 'Notewell AI system'}
                      </p>
                    </div>
                    {complaint.data_retention_date && (
                      <div>
                        <Label className="font-medium">Data Retention Until</Label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(complaint.data_retention_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Delete Complaint Section */}
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Permanently delete this complaint and all associated data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Complaint
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workflow Tab */}
            <TabsContent value="workflow" className="space-y-6">
              {/* Generate Acknowledgement Letter */}
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
                  {!acknowledgementLetter ? (
                    <Button 
                      onClick={() => handleGenerateAcknowledgement(complaint.id)}
                      disabled={submitting}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {submitting 
                        ? (countdown > 0 ? `Generating... (${countdown}s)` : 'Generating...') 
                        : 'Generate Acknowledgement Letter'}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Letter Generated</Badge>
                            <button
                              onClick={() => handleGenerateAcknowledgement(complaint.id)}
                              disabled={submitting}
                              className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                              title="Regenerate acknowledgement letter"
                            >
                              <RefreshCw className={`h-3 w-3 ${submitting ? 'animate-spin' : ''}`} />
                            </button>
                            {acknowledgementSentToPatient && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sent to {getAcknowledgementRecipientLabel(complaint?.complaint_source)}
                              </Badge>
                            )}
                            {complaint?.status === 'under_review' && acknowledgementSentToPatient && (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Under Review
                              </Badge>
                            )}
                          </div>
                          {acknowledgementDate && (complaint?.submitted_at || complaint?.created_at) && (
                            <div className="text-sm text-muted-foreground">
                              Generated: {format(new Date(acknowledgementDate), 'dd/MM/yyyy HH:mm')}
                              {acknowledgementSentAt && (
                                <>
                                  <br />
                                  Sent to {getAcknowledgementRecipientLabel(complaint?.complaint_source).toLowerCase()}: {format(new Date(acknowledgementSentAt), 'dd/MM/yyyy HH:mm')}
                                </>
                              )}
                              <br />
                              <span className={`font-medium ${
                                calculateWorkingDays(complaint.submitted_at || complaint.created_at, acknowledgementDate) <= 3 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {calculateWorkingDays(complaint.submitted_at || complaint.created_at, acknowledgementDate)} working day{calculateWorkingDays(complaint.submitted_at || complaint.created_at, acknowledgementDate) !== 1 ? 's' : ''} after complaint {complaint.submitted_at ? 'submitted' : 'received'}
                                {calculateWorkingDays(complaint.submitted_at || complaint.created_at, acknowledgementDate) <= 3 
                                  ? ' ✓ Within target' 
                                  : ' ⚠ Exceeded 3-day target'
                                }
                              </span>
                            </div>
                          )}
                          
                          {/* Checkbox for marking acknowledgement as sent */}
                          <div className="flex items-center space-x-2 mt-2 p-3 border rounded-lg bg-muted/50">
                            <Checkbox 
                              id="ack-sent"
                              checked={acknowledgementSentToPatient}
                              onCheckedChange={(checked) => handleMarkAcknowledgementSent(checked as boolean)}
                            />
                            <Label htmlFor="ack-sent" className="text-sm font-medium cursor-pointer">
                              Mark acknowledgement as sent to {getAcknowledgementRecipientLabel(complaint?.complaint_source)}
                            </Label>
                          </div>
                        </div>
                        <div className="space-x-2">
                          {acknowledgementLetter && acknowledgementLetter.replace(/<!--.*?-->|\s/g, '').length > 0 ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenAcknowledgementModal}
                                disabled={isCheckingAcknowledgement}
                              >
                                {isCheckingAcknowledgement ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Eye className="h-4 w-4 mr-1" />
                                )}
                                View Letter
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadAcknowledgementLetter}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.functions.invoke(
                                    'generate-complaint-acknowledgement',
                                    { body: { complaintId: complaint.id } }
                                  );
                                  if (error) throw error;
                                  showToast.success('Acknowledgement generated successfully', { section: 'complaints' });
                                } catch (error) {
                                  console.error('Error generating acknowledgement:', error);
                                  showToast.error('Failed to generate acknowledgement', { section: 'complaints' });
                                }
                              }}
                            >
                              <Sparkles className="h-4 w-4 mr-1" />
                              Generate Acknowledgement
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Manual Acknowledgement Generator - shown when status is stuck */}
              {complaint.status === 'submitted' && (
                <ManualAcknowledgementGenerator
                  complaintId={complaint.id}
                  complaintReference={complaint.reference_number}
                  currentStatus={complaint.status}
                  onSuccess={() => {
                    // Refresh complaint data
                    fetchComplaintDetails();
                  }}
                />
              )}

              {/* Outcome Letter Section */}
              {existingOutcome && outcomeLetter && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <FileText className="h-5 w-5" />
                      Outcome Letter - Complaint {
                        existingOutcome.outcome_type === 'upheld' ? 'Upheld' :
                        existingOutcome.outcome_type === 'partially_upheld' ? 'Partially upheld' :
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
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-green-600 text-white">
                              Outcome: {
                                existingOutcome.outcome_type === 'upheld' ? 'Complaint Upheld' :
                                existingOutcome.outcome_type === 'partially_upheld' ? 'Complaint Partially upheld' :
                                'Complaint Not Upheld'
                              }
                            </Badge>
                            <button
                              onClick={handleRegenerateOutcomeLetter}
                              disabled={isRegeneratingOutcome}
                              className="text-green-700 hover:text-green-900 transition-colors disabled:opacity-50"
                              title="Regenerate outcome letter"
                            >
                              <RefreshCw className={`h-3 w-3 ${isRegeneratingOutcome ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                          {existingOutcome.decided_at && (
                            <div className="text-sm text-green-700">
                              Decided: {format(new Date(existingOutcome.decided_at), 'dd/MM/yyyy HH:mm')}
                            </div>
                          )}
                        </div>
                        <div className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowOutcomeLetter(true)}
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
                                // Fetch signatory and practice details for proper name/contact display
                                const letterDetails = await fetchLetterDetails(existingOutcome?.decided_by);
                                const doc = await createLetterDocument(
                                  outcomeLetter, 
                                  'outcome', 
                                  complaint.reference_number,
                                  letterDetails.signatoryName,
                                  letterDetails.practiceDetails
                                );
                                const buffer = await Packer.toBlob(doc);
                                
                                const url = window.URL.createObjectURL(buffer);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `Outcome_Letter_${complaint.reference_number}.docx`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                                
                                showToast.success("Outcome letter downloaded successfully", { section: 'complaints' });
                              } catch (error) {
                                console.error('Error downloading outcome letter:', error);
                                showToast.error("Failed to download outcome letter", { section: 'complaints' });
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
                            onClick={() => navigate(`/complaints/${complaintId}/ai-report`)}
                            className="border-purple-500 text-purple-600 hover:bg-purple-50"
                          >
                            <Brain className="h-4 w-4 mr-1" />
                            AI Report
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const latestReview = reviewConversations?.[0];
                              const aiReview = latestReview ? {
                                conversation_summary: latestReview.conversation_summary,
                                challenges_identified: latestReview.challenges_identified || [],
                                recommendations: latestReview.recommendations || [],
                                conversation_duration: latestReview.conversation_duration || 0,
                                conversation_started_at: latestReview.conversation_started_at,
                                created_by: latestReview.created_by || 'System User',
                              } : undefined;

                              await exportComplaintReportToWord({
                                complaint,
                                audioOverview: audioOverview?.audio_overview_text,
                                investigationSummary: existingOutcome?.investigation_summary,
                                findingsText: existingOutcome?.findings_text,
                                outcome: existingOutcome ? {
                                  outcome_type: existingOutcome.outcome_type,
                                  outcome_summary: existingOutcome.outcome_summary
                                } : undefined,
                                acknowledgementLetter,
                                outcomeLetter: existingOutcome?.outcome_letter,
                                aiReview
                              });
                            }}
                            className="border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Indemnity Report
                          </Button>
                        </div>
                      </div>
                      
                      {/* Outcome Letter Sent Checkbox */}
                      <div className="flex items-center gap-3 p-3 bg-green-100 rounded border border-green-200">
                        <Checkbox
                          id="outcome-letter-sent"
                          checked={outcomeLetterSent}
                          onCheckedChange={(checked) => handleToggleOutcomeLetterSent(checked as boolean)}
                        />
                        <Label htmlFor="outcome-letter-sent" className="text-sm font-medium text-green-800 cursor-pointer">
                          Outcome letter/email sent to patient
                        </Label>
                        {outcomeLetterSentAt && (
                          <span className="text-xs text-green-600 ml-auto">
                            Sent: {format(new Date(outcomeLetterSentAt), 'dd/MM/yyyy HH:mm')}
                          </span>
                        )}
                      </div>
                      
                      {/* Questionnaire Responses Section */}
                      {outcomeQuestionnaireData && (
                        <div className="p-4 bg-green-100 rounded border border-green-200">
                          <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Questionnaire Responses (used to investigate and complete response to complaint)
                          </h4>
                          
                          {/* Submission Details */}
                          <div className="mb-3 pb-3 border-b border-green-200">
                            <div className="flex items-center gap-4 text-sm text-green-700">
                              <span className="font-medium">Completed by:</span>
                              <span className="text-green-900">{outcomeQuestionnaireData.created_by_name}</span>
                              <span className="text-green-600">•</span>
                              <span className="text-green-900">
                                {outcomeQuestionnaireData.created_at 
                                  ? new Date(outcomeQuestionnaireData.created_at).toLocaleString('en-GB', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : 'Unknown date'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            {outcomeQuestionnaireData.investigation_complete !== undefined && (
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-green-700 min-w-[200px]">All items investigated:</span>
                                <span className="text-green-900">{outcomeQuestionnaireData.investigation_complete ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {outcomeQuestionnaireData.parties_consulted !== undefined && (
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-green-700 min-w-[200px]">All parties consulted:</span>
                                <span className="text-green-900">{outcomeQuestionnaireData.parties_consulted ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {outcomeQuestionnaireData.fair_consideration !== undefined && (
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-green-700 min-w-[200px]">Fair consideration given:</span>
                                <span className="text-green-900">{outcomeQuestionnaireData.fair_consideration ? 'Yes - CQC compliant' : 'No'}</span>
                              </div>
                            )}
                            {outcomeQuestionnaireData.is_vexatious && (
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-green-700 min-w-[200px]">Vexatious complaint:</span>
                                <span className="text-green-900">Yes</span>
                              </div>
                            )}
                            {outcomeQuestionnaireData.actions_taken && (
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-green-700 min-w-[200px]">Actions taken:</span>
                                <span className="text-green-900">{outcomeQuestionnaireData.actions_taken}</span>
                              </div>
                            )}
                            {outcomeQuestionnaireData.improvements_made && (
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-green-700 min-w-[200px]">Improvements made:</span>
                                <span className="text-green-900">{outcomeQuestionnaireData.improvements_made}</span>
                              </div>
                            )}
                            {outcomeQuestionnaireData.additional_context && (
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-green-700 min-w-[200px]">Additional context:</span>
                                <span className="text-green-900">{outcomeQuestionnaireData.additional_context}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Green tick if sent within 20 working days */}
                      {existingOutcome.decided_at && complaint.created_at && (() => {
                        const workingDays = calculateWorkingDays(complaint.created_at, existingOutcome.decided_at);
                        const isWithinTimeframe = workingDays <= 20;
                        
                        if (isWithinTimeframe) {
                          return (
                            <div className="flex items-center gap-2 p-3 bg-green-100 rounded border border-green-200">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-green-800">
                                Outcome sent within 20 working days ({workingDays} days)
                              </span>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="flex items-center gap-2 p-3 bg-amber-100 rounded border border-amber-200">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">
                              Outcome sent after target timeframe ({workingDays} working days)
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Outcome Letter Dialog */}
              <Dialog 
                open={showOutcomeLetter} 
                onOpenChange={(open) => {
                  if (!open && hasUnsavedOutcomeChanges) {
                    if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                      setIsEditingOutcomeLetter(false);
                      setHasUnsavedOutcomeChanges(false);
                      setEditedOutcomeLetterContent(outcomeLetter);
                      setShowOutcomeLetter(false);
                    }
                  } else {
                    if (!open) {
                      setIsEditingOutcomeLetter(false);
                    }
                    setShowOutcomeLetter(open);
                  }
                }}
              >
                <DialogContent className="max-w-6xl h-[95vh] min-h-0 overflow-hidden !p-0 !flex flex-col !gap-0">
                  <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Outcome Letter - {complaint?.reference_number}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {isEditingOutcomeLetter ? 'Edit mode' : 'Final outcome letter for this complaint'}
                      </span>
                    </DialogTitle>
                  </DialogHeader>
                  
                  {/* Action bar */}
                  <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/30">
                    {isEditingOutcomeLetter ? (
                      <>
                        <div className="flex items-center gap-1 bg-background rounded-md p-1 border">
                          <Button
                            variant={outcomeEditorMode === 'edit' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setOutcomeEditorMode('edit')}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={outcomeEditorMode === 'split' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setOutcomeEditorMode('split')}
                          >
                            Split
                          </Button>
                          <Button
                            variant={outcomeEditorMode === 'preview' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setOutcomeEditorMode('preview')}
                          >
                            Preview
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (hasUnsavedOutcomeChanges) {
                                if (window.confirm('Discard changes?')) {
                                  setEditedOutcomeLetterContent(outcomeLetter);
                                  setIsEditingOutcomeLetter(false);
                                  setHasUnsavedOutcomeChanges(false);
                                }
                              } else {
                                setIsEditingOutcomeLetter(false);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveOutcomeLetter}
                            disabled={submitting || !hasUnsavedOutcomeChanges}
                          >
                            {submitting ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" />
                                Save Letter
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEmailToPatient(!!complaint?.patient_contact_email);
                              setBccToUser(false);
                              setManualToEmails('');
                              setManualCcEmails('');
                              setShowOutcomeEmailDialog(true);
                            }}
                            disabled={isSendingOutcomeEmail}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Email
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                // Fetch signatory and practice details for proper name/contact display
                                const letterDetails = await fetchLetterDetails(existingOutcome?.decided_by);
                                const doc = await createLetterDocument(
                                  outcomeLetter,
                                  'outcome',
                                  complaint?.reference_number || 'OUTCOME',
                                  letterDetails.signatoryName,
                                  letterDetails.practiceDetails
                                );
                                const blob = await Packer.toBlob(doc);
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Outcome_Letter_${complaint?.reference_number || 'OUTCOME'}.docx`;
                                a.click();
                                URL.revokeObjectURL(url);
                                showToast.success('Outcome letter downloaded', { section: 'complaints' });
                              } catch (error) {
                                console.error('Error downloading outcome letter:', error);
                                showToast.error('Failed to download outcome letter', { section: 'complaints' });
                              }
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => setShowOutcomeAIEdit(true)}
                          >
                            <Brain className="h-4 w-4 mr-1" />
                            AI Edit
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(outcomeLetter);
                              showToast.success('Letter copied to clipboard', { section: 'complaints' });
                            }}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditedOutcomeLetterContent(outcomeLetter);
                            setIsEditingOutcomeLetter(true);
                            setHasUnsavedOutcomeChanges(false);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Letter
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {/* Content area */}
                  <div className="flex-1 min-h-0 overflow-hidden relative px-6 pb-6 pt-4">
                    {isRegeneratingOutcome && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg animate-fade-in">
                        <div className="text-center space-y-3">
                          <div className="relative">
                            <RefreshCw className="h-12 w-12 text-primary animate-spin mx-auto" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-8 w-8 rounded-full border-2 border-primary/30 animate-ping" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Regenerating outcome letter...</p>
                            <p className="text-xs text-muted-foreground">Please wait while AI creates a new version</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {isEditingOutcomeLetter ? (
                      <div className={`h-full ${outcomeEditorMode === 'split' ? 'grid grid-cols-2 gap-4' : ''}`}>
                        {(outcomeEditorMode === 'edit' || outcomeEditorMode === 'split') && (
                          <div className="h-full overflow-y-auto">
                            <RichTextEditor
                              content={editedOutcomeLetterContent}
                              onChange={(newContent) => {
                                setEditedOutcomeLetterContent(newContent);
                                setHasUnsavedOutcomeChanges(true);
                              }}
                              className="min-h-[60vh]"
                            />
                          </div>
                        )}
                        {(outcomeEditorMode === 'preview' || outcomeEditorMode === 'split') && (
                          <div className="h-full overflow-y-auto bg-gray-50 rounded-lg p-4">
                            <FormattedLetterContent
                              content={editedOutcomeLetterContent}
                              signatoryUserId={existingOutcome?.decided_by}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`h-full overflow-y-auto transition-opacity duration-300 ${isRegeneratingOutcome ? 'opacity-30' : 'opacity-100'}`}>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <FormattedLetterContent
                            content={outcomeLetter}
                            signatoryUserId={existingOutcome?.decided_by}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              {/* AI Edit Outcome Letter Dialog */}
              <AIEditLetterDialog
                open={showOutcomeAIEdit}
                onOpenChange={setShowOutcomeAIEdit}
                currentLetter={outcomeLetter}
                onRegenerateWithAI={handleRegenerateOutcomeWithAI}
                letterType="outcome"
                isRegenerating={isRegeneratingWithAI}
              />
              
              {/* Direct link to outcome letter creation */}
              {acknowledgementLetter && !existingOutcome && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-blue-900">Ready to Create Outcome Letter?</h3>
                        <p className="text-sm text-blue-700 mt-1">Skip directly to creating the final complaint outcome letter for the patient</p>
                      </div>
                      <Button
                        onClick={() => setShowQuestionnaireModal(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Create Outcome Letter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}


            </TabsContent>

            {/* Investigation Evidence Tab */}
            <TabsContent value="investigation" className="space-y-6">
              <InvestigationEvidenceTab 
                complaintId={complaint.id} 
                practiceId={complaint.practice_id} 
                onCreateOutcomeLetter={() => setShowQuestionnaireModal(true)}
              />
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-6">
              {/* Executive Audio Summary */}
              {existingOutcome && (
                <Collapsible open={showAudioSummarySection} onOpenChange={setShowAudioSummarySection}>
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <div className="flex items-start justify-between w-full">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="flex-1 justify-between p-0 h-auto hover:bg-transparent">
                            <div className="text-left">
                              <CardTitle className="flex items-center gap-2 text-blue-800">
                                <Headphones className="h-5 w-5" />
                                Executive Audio Summary
                              </CardTitle>
                              <CardDescription className="text-blue-700">
                                AI-generated audio briefing for management and partners
                              </CardDescription>
                            </div>
                            {showAudioSummarySection ? (
                              <ChevronUp className="h-5 w-5 text-blue-800" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-blue-800" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchComplaintDetails();
                          }}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                          title="Refresh audio summary"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <ComplaintAudioOverviewPlayer
                          complaintId={complaint.id}
                          audioOverviewUrl={audioOverview?.audio_overview_url}
                          audioOverviewText={audioOverview?.audio_overview_text}
                          audioOverviewDuration={audioOverview?.audio_overview_duration}
                          onRegenerateAudio={handleRegenerateComplaintAudio}
                        />
                        
                        {/* AI Critical Friend Complaint Review - Only show if audio exists */}
                        {audioOverview?.audio_overview_url && (
                          <ComplaintReviewConversation
                            complaintId={complaint.id}
                            reviewConversations={reviewConversations}
                            onReviewComplete={() => {
                              // Refetch review conversations after completion
                              fetchComplaintDetails();
                            }}
                            onRegenerateSummary={(conversationId, newSummary) => {
                              // Update the conversation in the local state
                              setReviewConversations(prev => 
                                prev.map(c => 
                                  c.id === conversationId 
                                    ? { ...c, conversation_summary: newSummary }
                                    : c
                                )
                              );
                            }}
                          />
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>NHS Compliance Overview</CardTitle>
                      <CardDescription>Track compliance with NHS England complaints procedures and CQC requirements</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={async () => {
                          const latestReview = reviewConversations?.[0];
                          const aiReview = latestReview ? {
                            conversation_summary: latestReview.conversation_summary,
                            challenges_identified: latestReview.challenges_identified || [],
                            recommendations: latestReview.recommendations || [],
                            conversation_duration: latestReview.conversation_duration || 0,
                            conversation_started_at: latestReview.conversation_started_at,
                            created_by: latestReview.created_by || 'System User',
                          } : undefined;

                          await exportComplaintReportToWord({
                            complaint,
                            audioOverview: audioOverview?.audio_overview_text,
                            investigationSummary: existingOutcome?.investigation_summary,
                            findingsText: existingOutcome?.findings_text,
                            outcome: existingOutcome ? {
                              outcome_type: existingOutcome.outcome_type,
                              outcome_summary: existingOutcome.outcome_summary
                            } : undefined,
                            acknowledgementLetter,
                            outcomeLetter: existingOutcome?.outcome_letter,
                            aiReview
                          });
                        }}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Export Full Report
                      </Button>
                      {complianceChecks.length > 0 && complianceSummary?.compliance_percentage !== 100 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={markAllCompliant}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Mark All Compliant
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {complianceChecks && complianceChecks.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mb-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {(() => {
                            const map = new Map<string, boolean>();
                            for (const c of complianceChecks) {
                              const key = (c.compliance_item || '').trim().toLowerCase();
                              map.set(key, (map.get(key) || false) || !!c.is_compliant);
                            }
                            return Array.from(map.values()).filter(Boolean).length;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">Items Complete</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">
                          {(() => {
                            const keys = new Set(complianceChecks.map(c => (c.compliance_item || '').trim().toLowerCase()));
                            const map = new Map<string, boolean>();
                            for (const c of complianceChecks) {
                              const key = (c.compliance_item || '').trim().toLowerCase();
                              map.set(key, (map.get(key) || false) || !!c.is_compliant);
                            }
                            const completed = Array.from(map.values()).filter(Boolean).length;
                            return keys.size - completed;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">Items Outstanding</div>
                      </div>
                    </div>
                  ) : (complianceSummary && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mb-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{complianceSummary.compliant_items}</div>
                        <div className="text-sm text-muted-foreground">Items Complete</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">{complianceSummary.total_items - complianceSummary.compliant_items}</div>
                        <div className="text-sm text-muted-foreground">Items Outstanding</div>
                      </div>
                    </div>
                  ))}

                  {complianceChecks && new Set(complianceChecks.map(c => (c.compliance_item || '').trim().toLowerCase())).size < complianceChecks.length && (
                    <div className="mb-6">
                      <ComplianceCheckCleanupButton 
                        complaintId={complaintId!} 
                        onCleanupComplete={fetchComplianceData}
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {(() => {
                      // Deduplicate compliance checks - keep only one per item
                      const uniqueChecksMap = new Map<string, typeof complianceChecks[0]>();
                      
                      complianceChecks.forEach(check => {
                        const key = (check.compliance_item || '').trim().toLowerCase();
                        const existing = uniqueChecksMap.get(key);
                        
                        if (!existing) {
                          uniqueChecksMap.set(key, check);
                        } else {
                          // Prefer compliant over non-compliant
                          if (check.is_compliant && !existing.is_compliant) {
                            uniqueChecksMap.set(key, check);
                          } else if (check.is_compliant === existing.is_compliant) {
                            // If both same status, prefer more recently checked
                            const checkDate = check.checked_at ? new Date(check.checked_at).getTime() : 0;
                            const existingDate = existing.checked_at ? new Date(existing.checked_at).getTime() : 0;
                            if (checkDate > existingDate) {
                              uniqueChecksMap.set(key, check);
                            }
                          }
                        }
                      });
                      
                      return Array.from(uniqueChecksMap.values());
                    })().map((check) => (
                      <Card 
                        key={check.id} 
                        className={`transition-colors ${
                          check.is_compliant ? 'border-green-500 bg-green-50' : 'border-gray-200'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={check.is_compliant}
                              onChange={(e) => {
                                updateComplianceCheck(check.id, e.target.checked);
                              }}
                              className="mt-1 h-5 w-5 rounded accent-green-600 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-medium ${
                                  check.is_compliant ? 'text-green-700' : 'text-foreground'
                                }`}>
                                  {check.compliance_item}
                                </h4>
                                <div className="w-28 flex justify-end">
                                  <Badge className={`bg-green-600 hover:bg-green-700 transition-none ${check.is_compliant ? 'opacity-100' : 'opacity-0'}`}>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Complete
                                  </Badge>
                                </div>
                              </div>
                              {check.notes && (
                                <p className="text-sm text-muted-foreground mt-2">{check.notes}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1 min-h-5">
                                {check.checked_at ? `${check.is_compliant ? 'Completed' : 'Last updated'}: ${format(new Date(check.checked_at), 'dd/MM/yyyy HH:mm')}` : '\u00A0'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audit Log Tab */}
            <TabsContent value="audit" className="space-y-6">
              <EnhancedAuditLogViewer logs={auditLogs} />

              {complianceAuditLogs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Changes Log</CardTitle>
                    <CardDescription>History of compliance check updates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {complianceAuditLogs.map((log) => (
                        <div key={log.id} className="border-l-2 border-green-200 pl-4 py-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{log.compliance_item}</h4>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm">
                            Changed from <span className={log.previous_status ? 'text-green-600' : 'text-red-600'}>
                              {log.previous_status ? 'Complete' : 'Incomplete'}
                            </span> to <span className={log.new_status ? 'text-green-600' : 'text-red-600'}>
                              {log.new_status ? 'Complete' : 'Incomplete'}
                            </span>
                          </p>
                          {log.user_email && (
                            <p className="text-xs text-muted-foreground">By: {log.user_email}</p>
                          )}
                          {log.notes && (
                            <p className="text-xs text-muted-foreground mt-1">Notes: {log.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This action cannot be undone. This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>The complaint record (Reference: <strong>{complaint?.reference_number}</strong>)</li>
                <li>All acknowledgement and outcome letters</li>
                <li>Staff responses and involved parties</li>
                <li>Compliance checks and audit logs</li>
                <li>All uploaded documents</li>
                <li>Investigation findings and evidence</li>
              </ul>
              <p className="font-semibold text-destructive mt-4">All complaint data will be permanently deleted.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteComplaint}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Acknowledgement Letter Modal */}
      <Dialog open={showAcknowledgementModal} onOpenChange={(open) => !open && handleCloseAcknowledgementModal()}>
        <DialogContent className={`p-0 flex flex-col overflow-hidden ${isFullscreen ? 'max-w-[98vw] w-[98vw] h-[98vh]' : 'max-w-5xl w-[85vw] h-[88vh]'}`}>
          <div className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="flex-shrink-0 p-4 pr-14 border-b">
              <div className="flex items-start justify-between gap-4">
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
              {/* Empty state if no content */}
              {(!editedAcknowledgementContent || editedAcknowledgementContent.replace(/<!--.*?-->|\s/g, '').length === 0) && (
                <div className="flex flex-col items-centre justify-centre py-12 px-4 text-centre">
                  <div className="mb-4">
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Acknowledgement Letter is Being Generated</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    The AI is currently generating your acknowledgement letter. This usually takes 5-10 seconds.
                  </p>
                  <div className="flex gap-2 justify-centre">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.functions.invoke(
                            'generate-complaint-acknowledgement',
                            { body: { complaintId: complaint.id } }
                          );
                          if (error) throw error;
                          showToast.success('Acknowledgement generated successfully', { section: 'complaints' });
                        } catch (error) {
                          console.error('Error generating acknowledgement:', error);
                          showToast.error('Failed to generate acknowledgement', { section: 'complaints' });
                        }
                      }}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Now
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowAcknowledgementModal(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Action bar */}
              {editedAcknowledgementContent && editedAcknowledgementContent.replace(/<!--.*?-->|\s/g, '').length > 0 && (
              <div className="flex items-center justify-between gap-2 pb-2 border-b flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await handleDownloadAcknowledgementLetter();
                        showToast.success('Letter downloaded', { section: 'complaints' });
                      } catch (error) {
                        console.error('Download failed:', error);
                        showToast.error(`Download failed: ${error.message}`, { section: 'complaints' });
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
                    onEditClick={!isEditingAcknowledgement ? () => setIsEditingAcknowledgement(true) : undefined}
                  />
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await handleGenerateAcknowledgement(complaint.id);
                    }}
                    disabled={isGeneratingAcknowledgement}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isGeneratingAcknowledgement ? 'animate-spin' : ''}`} />
                    {isGeneratingAcknowledgement ? 'Regenerating...' : 'Regenerate'}
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
                          <Columns className="h-3.5 w-3.5 mr-1" />
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
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (hasUnsavedChanges) {
                            setShowUnsavedDialog(true);
                          } else {
                            setIsEditingAcknowledgement(false);
                            setEditedAcknowledgementContent(acknowledgementLetter);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await handleSaveAcknowledgementLetter();
                          const draftKey = `ack_draft_${complaintId}`;
                          localStorage.removeItem(draftKey);
                          setHasUnsavedChanges(false);
                        }}
                        disabled={submitting || !editedAcknowledgementContent.trim()}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {submitting ? 'Saving...' : 'Save Letter'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              )}
              
              {/* Letter content */}
              <div className="flex-1 overflow-hidden relative">
                {isGeneratingAcknowledgement && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg animate-fade-in">
                    <div className="text-center space-y-3">
                      <div className="relative">
                        <RefreshCw className="h-12 w-12 text-primary animate-spin mx-auto" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-8 w-8 rounded-full border-2 border-primary/30 animate-ping" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Regenerating acknowledgement letter...</p>
                        <p className="text-xs text-muted-foreground">Please wait while AI creates a new version</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className={`h-full transition-opacity duration-300 ${isGeneratingAcknowledgement ? 'opacity-30' : 'opacity-100'}`}>
                {!isEditingAcknowledgement ? (
                  <div className="bg-muted/30 p-4 rounded-lg h-full overflow-auto">
                    <div 
                      className={`mx-auto bg-background p-8 rounded shadow-sm ${isFullscreen ? 'max-w-[92vw]' : 'max-w-[72vw]'}`}
                    >
                      <FormattedLetterContent content={acknowledgementLetter} />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col gap-2 overflow-hidden">
                    {editorMode === 'split' && (
                      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden border rounded-lg">
                        <ResizablePanel defaultSize={50} minSize={30}>
                          <div className="h-full overflow-y-auto bg-background">
                            <RichTextEditor
                              content={editedAcknowledgementContent}
                              onChange={handleEditorChange}
                              placeholder="Edit the acknowledgement letter..."
                              className="h-full border-0"
                              onReady={setEditorApi}
                              showStatus
                            />
                          </div>
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={50} minSize={30}>
                          <div className="h-full overflow-auto bg-muted/30 p-4">
                            <div 
                              className={`mx-auto bg-background p-8 rounded shadow-sm ${isFullscreen ? 'max-w-[85vw]' : 'max-w-[68vw]'}`}
                            >
                              <FormattedLetterContent content={editedAcknowledgementContent} />
                            </div>
                          </div>
                        </ResizablePanel>
                      </ResizablePanelGroup>
                    )}
                    
                    {editorMode === 'edit' && (
                      <div className="flex-1 overflow-hidden border rounded-lg">
                        <RichTextEditor
                          content={editedAcknowledgementContent}
                          onChange={handleEditorChange}
                          placeholder="Edit the acknowledgement letter..."
                          className="h-full"
                          onReady={setEditorApi}
                          showStatus
                        />
                      </div>
                    )}
                    
                    {editorMode === 'preview' && (
                      <div className="flex-1 overflow-auto bg-muted/30 p-4 rounded-lg border">
                        <div 
                          className={`mx-auto bg-background p-8 rounded shadow-sm ${isFullscreen ? 'max-w-[92vw]' : 'max-w-[72vw]'}`}
                        >
                          <FormattedLetterContent content={editedAcknowledgementContent} />
                        </div>
                      </div>
                    )}
                    
                    {/* Find & Replace panel */}
                    <Collapsible open={showFindReplace} onOpenChange={setShowFindReplace} className="flex-shrink-0 max-h-48 overflow-y-auto">
                      <div className="border rounded-lg">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between h-7 px-2">
                            <span className="text-xs font-medium">Find & Replace</span>
                            <ChevronDown className={`h-3 w-3 transition-transform ${showFindReplace ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-2 border-t max-h-40 overflow-y-auto">
                            <FindReplacePanel
                              getCurrentText={() => editedAcknowledgementContent}
                              onApply={(updatedText) => {
                                setEditedAcknowledgementContent(updatedText);
                                setHasUnsavedChanges(true);
                                showToast.success('Replacements applied', { section: 'complaints' });
                              }}
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  </div>
                )}
                </div>
              </div>
              
              {/* Word count */}
              <div className="border-t pt-1 mt-1 px-3 pb-1">
                <p className="text-xs text-muted-foreground">
                  Word count: {editedAcknowledgementContent.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(word => word.length > 0).length}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
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
                    disabled={!complaint?.patient_contact_email}
                  />
                  <Label
                    htmlFor="emailToPatientOutcome"
                    className={`text-sm font-normal cursor-pointer ${!complaint?.patient_contact_email ? 'text-muted-foreground' : ''}`}
                  >
                    Patient ({complaint?.patient_contact_email || 'No email available'})
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

      {/* Outcome Questionnaire Modal */}
      {complaint && (
        <ComplaintOutcomeQuestionnaire
          open={showQuestionnaireModal}
          onOpenChange={setShowQuestionnaireModal}
          complaintId={complaint.id}
          complaintData={{
            reference_number: complaint.reference_number,
            complaint_description: complaint.complaint_description,
            category: complaint.category,
            patient_name: complaint.patient_name,
          }}
          onSuccess={() => {
            fetchComplaintDetails();
            showToast.success('Outcome letter created successfully!', { section: 'complaints' });
          }}
        />
      )}

      {/* AI Analysis Modal */}
      <Dialog open={showAiAnalysisModal} onOpenChange={setShowAiAnalysisModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI-Generated Guidance (Advisory Only)
            </DialogTitle>
            <DialogDescription>
              AI-generated analysis for guidance purposes only
            </DialogDescription>
          </DialogHeader>
          
          {/* Disclaimer Banner */}
          <Alert className="bg-amber-50 border-amber-300">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-900 font-semibold">Advisory Guidance Only</AlertTitle>
            <AlertDescription className="text-amber-800 text-sm leading-relaxed">
              This AI-generated analysis is provided for guidance purposes only. It does not constitute a final decision. The practice must conduct a thorough review and make the final determination based on professional judgement and all available evidence. <strong>Human oversight is required for all AI-generated content.</strong>
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border">
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
              {aiAnalysis.replace(/\*\*/g, '').replace(/##/g, '')}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintDetails;