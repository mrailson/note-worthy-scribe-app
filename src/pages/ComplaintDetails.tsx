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
  Headphones
} from "lucide-react";
import { format } from "date-fns";
import { showToast } from '@/utils/toastWrapper';
import { createLetterDocument } from "@/utils/letterFormatter";
import { Document, Packer } from "docx";
import { InvestigationEvidence } from "@/components/InvestigationEvidence";
import { InvestigationFindings } from "@/components/InvestigationFindings";
import { InvestigationDecisionAndLearning } from "@/components/InvestigationDecisionAndLearning";
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
  const [involvedParties, setInvolvedParties] = useState<Array<{staffName: string; staffEmail: string; staffRole: string}>>([]);
  const [newParty, setNewParty] = useState({staffName: '', staffEmail: '', staffRole: ''});
  const [outcomeType, setOutcomeType] = useState('');
  const [outcomeSummary, setOutcomeSummary] = useState('');
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [outcomeLetter, setOutcomeLetter] = useState("");
  const [showOutcomeLetter, setShowOutcomeLetter] = useState(false);
  const [outcomeLetterSent, setOutcomeLetterSent] = useState(false);
  const [outcomeLetterSentAt, setOutcomeLetterSentAt] = useState<string | null>(null);
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [acknowledgementLetter, setAcknowledgementLetter] = useState("");
  const [acknowledgementDate, setAcknowledgementDate] = useState<string | null>(null);
  const [showAcknowledgementLetter, setShowAcknowledgementLetter] = useState(false);
  const [showAcknowledgementModal, setShowAcknowledgementModal] = useState(false);
  const [isEditingAcknowledgement, setIsEditingAcknowledgement] = useState(false);
  const [editedAcknowledgementContent, setEditedAcknowledgementContent] = useState("");
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
  
  // Investigation workflow state
  const [investigationMethod, setInvestigationMethod] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Array<{name: string; email: string; role: string; suggested: boolean; type: string}>>([]);
  const [additionalStaff, setAdditionalStaff] = useState({name: '', email: '', role: ''});
  const [inputRequests, setInputRequests] = useState<Array<{id: string; staffName: string; staffEmail: string; status: string; sentAt: string; responseReceived: boolean; responseReceivedAt?: string; responseText?: string; isTestResponse?: boolean}>>([]);
  const [workflowSettings, setWorkflowSettings] = useState<any>(null);
  const [editingStaffIndex, setEditingStaffIndex] = useState<number | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState<string>('');
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  const emailUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
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
      
      const { count: prevComplaintsCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('patient_name', data.patient_name)
        .eq('practice_id', data.practice_id)
        .neq('id', complaintId)
        .gte('created_at', twelveMonthsAgo.toISOString());
      
      setPreviousComplaintsCount(prevComplaintsCount || 0);

      // Fetch existing outcome if available
      const { data: outcomeData } = await supabase
        .from('complaint_outcomes')
        .select('*')
        .eq('complaint_id', complaintId)
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
        .select('acknowledgement_letter, created_at, sent_at')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ackData) {
        console.log('Acknowledgement data:', ackData);
        setAcknowledgementLetter(ackData.acknowledgement_letter);
        setAcknowledgementDate(ackData.created_at);
        setAcknowledgementSentToPatient(!!ackData.sent_at);
        setAcknowledgementSentAt(ackData.sent_at);
      }

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

  const fetchStaffResponses = async () => {
    if (!user || !complaintId) return;
    try {
      const { data: parties, error } = await supabase
        .from('complaint_involved_parties')
        .select('*')
        .eq('complaint_id', complaintId);

      if (error) throw error;

      // Also fetch staff_responses and merge
      const { data: staffResp, error: staffRespError } = await supabase
        .from('staff_responses')
        .select('*')
        .eq('complaint_id', complaintId);

      if (staffRespError) {
        console.warn('Could not load staff_responses:', staffRespError);
      }

      const byEmail = new Map<string, any>();
      const byName = new Map<string, any>();
      (staffResp || []).forEach(r => {
        if (r.staff_email) byEmail.set(String(r.staff_email).toLowerCase(), r);
        if (r.staff_name) byName.set(String(r.staff_name).toLowerCase(), r);
      });

      let requests: Array<any> = [];

      if (parties && parties.length > 0) {
        requests = parties.map(party => {
          // Debug: Log what we're getting from the database
          console.log('Staff response data from DB:', {
            staffName: party.staff_name,
            staffEmail: party.staff_email,
            response_submitted_at: party.response_submitted_at,
            response_text: party.response_text
          });

          const resp =
            (party.staff_email && byEmail.get(String(party.staff_email).toLowerCase())) ||
            (party.staff_name && byName.get(String(party.staff_name).toLowerCase()));

          const responseSubmittedAt = party.response_submitted_at || resp?.responded_at || null;
          const responseText = party.response_text || resp?.response_text || undefined;

          return {
            id: party.id,
            staffName: party.staff_name,
            staffEmail: party.staff_email,
            status: responseSubmittedAt ? 'completed' : 'pending',
            sentAt: party.response_requested_at,
            responseReceived: !!responseSubmittedAt,
            responseReceivedAt: responseSubmittedAt,
            responseText: responseText,
            isTestResponse: !!responseText
          };
        });
      }

      // Include any staff_responses not already present in involved parties
      const existingKeys = new Set(requests.map(r => String(r.staffEmail || r.staffName || '').toLowerCase()));
      (staffResp || []).forEach(r => {
        const key = String(r.staff_email || r.staff_name || '').toLowerCase();
        if (key && !existingKeys.has(key)) {
          requests.push({
            id: r.id,
            staffName: r.staff_name,
            staffEmail: r.staff_email,
            status: 'completed',
            sentAt: r.responded_at,
            responseReceived: true,
            responseReceivedAt: r.responded_at,
            responseText: r.response_text,
            isTestResponse: false
          });
        }
      });

      console.log('Processed input requests (merged):', requests);
      setInputRequests(requests);

      // Also update selectedStaff if needed
      const staffList = (parties || []).map(party => ({
        name: party.staff_name,
        email: party.staff_email,
        role: party.staff_role || '',
        suggested: false,
        type: 'added'
      }));

      if (selectedStaff.length === 0) {
        setSelectedStaff(staffList);
      }

      // Automatically set investigation method to "input-required" if there are existing input requests
      if (requests.length > 0 && !investigationMethod) {
        setInvestigationMethod("input-required");
        console.log('Auto-restored investigation method to "input-required" based on existing input requests');
      }

      console.log('Loaded staff responses:', requests);
    } catch (error) {
      console.error('Error fetching staff responses:', error);
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
      fetchStaffResponses(); // Add this to load staff responses
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

  // Set up real-time listener for staff responses changes
  useEffect(() => {
    if (!user || !complaintId) return;

    const channel = supabase
      .channel('staff-responses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_responses',
          filter: `complaint_id=eq.${complaintId}`
        },
        (payload) => {
          console.log('Staff responses database change detected:', payload);
          setTimeout(() => {
            fetchStaffResponses();
          }, 800);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, complaintId]);

  // Cleanup email timeout on unmount
  useEffect(() => {
    return () => {
      if (emailUpdateTimeout.current) {
        clearTimeout(emailUpdateTimeout.current);
      }
    };
  }, []);

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
    if (!complaintId || !complaint) return;
    
    try {
      const now = isSent ? new Date().toISOString() : null;
      
      // Update the acknowledgement record
      const { error: ackError } = await supabase
        .from('complaint_acknowledgements')
        .update({ 
          sent_at: now,
          sent_by: isSent ? user?.id : null
        })
        .eq('complaint_id', complaintId);

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

  const addInvolvedParty = () => {
    if (newParty.staffName && newParty.staffEmail) {
      setInvolvedParties([...involvedParties, { ...newParty }]);
      setNewParty({staffName: '', staffEmail: '', staffRole: ''});
    }
  };

  const removeInvolvedParty = (index: number) => {
    setInvolvedParties(involvedParties.filter((_, i) => i !== index));
  };

  const handleSendStaffNotifications = async (complaintId: string) => {
    if (involvedParties.length === 0) {
      showToast.error("Please add staff members to notify", { section: 'complaints' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-complaint-notifications', {
        body: { 
          complaintId,
          involvedParties 
        }
      });

      if (error) throw error;

      showToast.success("Staff notifications sent successfully", { section: 'complaints' });
      setInvolvedParties([]);
    } catch (error) {
      console.error('Error sending notifications:', error);
      showToast.error("Failed to send staff notifications", { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveOutcomeLetter = async () => {
    if (!existingOutcome) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('complaint_outcomes')
        .update({ outcome_letter: outcomeLetter })
        .eq('id', existingOutcome.id);

      if (error) throw error;

      setEditingOutcome(false);
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

  const handleOpenAcknowledgementModal = () => {
    // Try to restore draft from localStorage
    const draftKey = `ack_draft_${complaintId}`;
    const savedDraft = localStorage.getItem(draftKey);
    
    // Extract and preserve logo URL from acknowledgement letter
    const logoMatch = acknowledgementLetter.match(/<!--\s*logo_url:\s*(https?:\/\/[^\s\n]+|\/[^\s\n]+)\s*-->/);
    const logoUrl = logoMatch ? logoMatch[0] : null;
    
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const draftTime = new Date(draft.timestamp).getTime();
        const letterTime = acknowledgementDate ? new Date(acknowledgementDate).getTime() : 0;
        
        if (draftTime > letterTime) {
          // Auto-restore newer draft
          setEditedAcknowledgementContent(draft.content);
        } else {
          const contentWithoutLogo = acknowledgementLetter.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
          setEditedAcknowledgementContent(contentWithoutLogo);
          localStorage.removeItem(draftKey);
        }
      } catch (e) {
        const contentWithoutLogo = acknowledgementLetter.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
        setEditedAcknowledgementContent(contentWithoutLogo);
      }
    } else {
      // Remove logo comment for editing, we'll add it back on save
      const contentWithoutLogo = acknowledgementLetter.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
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

  // Investigation workflow functions
  const handleInvestigationMethodChange = async (method: string) => {
    setInvestigationMethod(method);
    
    // Auto-populate suggested staff based on complaint details
    if (method === "input-required") {
      const suggestions: Array<{name: string; email: string; role: string; suggested: boolean; type: string}> = [];
      
      // Get practice ID for fetching defaults
      let practiceId: string | null = null;
      if (complaint?.practice_id) {
        practiceId = complaint.practice_id;
      } else {
        // Try to get from user roles if not on complaint
        const { data: practiceData } = await supabase
          .from('user_roles')
          .select('practice_id')
          .eq('user_id', complaint?.created_by)
          .limit(1)
          .maybeSingle();
        practiceId = practiceData?.practice_id || null;
      }
      
      // Add mentioned staff with default email lookups
      if (complaint?.staff_mentioned) {
        for (const staff of complaint.staff_mentioned) {
          // For demo purposes, only add Emma Thompson and auto-populate email
          if (staff !== 'Emma Thompson') {
            continue; // Skip all other staff members
          }
          
          let defaultEmail = 'malcolm.railson@nhs.net'; // Auto-populate for demo
          let defaultRole = 'Receptionist';
          
          // Still try to get default contact but use demo email as fallback
          if (practiceId) {
            const { data: defaultContact } = await supabase
              .rpc('get_default_staff_contact', {
                p_practice_id: practiceId,
                p_staff_role: staff,
                p_staff_name: staff
              });
            
            if (defaultContact && defaultContact.length > 0) {
              // Use demo email instead of default contact for Emma Thompson
              defaultRole = staff;
            }
          }
          
          suggestions.push({
            name: staff,
            email: defaultEmail,
            role: defaultRole,
            suggested: true,
            type: 'mentioned'
          });
        }
      }
      
      // Add category-based suggestions with default emails
      if (complaint?.category === 'Appointments & Access') {
        let receptionEmail = '';
        if (practiceId) {
          const { data: defaultContact } = await supabase
            .rpc('get_default_staff_contact', {
              p_practice_id: practiceId,
              p_staff_role: 'Receptionist'
            });
          
          if (defaultContact && defaultContact.length > 0) {
            receptionEmail = defaultContact[0].default_email;
          }
        }
        
        suggestions.push({
          name: 'Reception Team',
          email: receptionEmail,
          role: 'Reception',
          suggested: true,
          type: 'category-based'
        });
      }
      
      if (complaint?.category === 'Clinical Care & Treatment') {
        let clinicianEmail = '';
        if (practiceId) {
          const { data: defaultContact } = await supabase
            .rpc('get_default_staff_contact', {
              p_practice_id: practiceId,
              p_staff_role: 'Practice Nurse'
            });
          
          if (defaultContact && defaultContact.length > 0) {
            clinicianEmail = defaultContact[0].default_email;
          }
        }
        
        suggestions.push({
          name: 'Treating Clinician',
          email: clinicianEmail,
          role: 'Clinician',
          suggested: true,
          type: 'category-based'
        });
      }
      
      setSelectedStaff(suggestions);
    } else {
      setSelectedStaff([]);
    }
  };

  const handleStaffSelection = (index: number, selected: boolean) => {
    setSelectedStaff(prev => 
      prev.map((staff, i) => 
        i === index ? { ...staff, selected } : staff
      )
    );
  };

  const handleAddAdditionalStaff = async () => {
    if (additionalStaff.name && additionalStaff.email) {
      // Check if we should auto-populate email from defaults
      let emailToUse = additionalStaff.email;
      
      if (!emailToUse && additionalStaff.role) {
        // Try to get default email for this role
        let practiceId: string | null = null;
        if (complaint?.practice_id) {
          practiceId = complaint.practice_id;
        } else {
          const { data: practiceData } = await supabase
            .from('user_roles')
            .select('practice_id')
            .eq('user_id', complaint?.created_by)
            .limit(1)
            .maybeSingle();
          practiceId = practiceData?.practice_id || null;
        }
        
        if (practiceId) {
          const { data: defaultContact } = await supabase
            .rpc('get_default_staff_contact', {
              p_practice_id: practiceId,
              p_staff_role: additionalStaff.role
            });
          
          if (defaultContact && defaultContact.length > 0) {
            emailToUse = defaultContact[0].default_email;
          }
        }
      }
      
      setSelectedStaff(prev => [...prev, {
        name: additionalStaff.name,
        email: emailToUse,
        role: additionalStaff.role || 'Staff Member',
        suggested: false,
        type: 'additional'
      }]);
      setAdditionalStaff({name: '', email: '', role: ''});
    }
  };

  const handleRemoveStaff = (index: number) => {
    setSelectedStaff(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendInputRequests = async () => {
    if (selectedStaff.length === 0) {
      showToast.error("Please select staff members to request input from", { section: 'complaints' });
      return;
    }

    // Check if requests have already been sent for currently selected staff
    const hasExistingRequests = selectedStaff.some(staff => 
      inputRequests.some(request => request.staffName === staff.name && request.staffEmail === staff.email)
    );
    
    if (hasExistingRequests) {
      showToast.error("Input requests have already been sent for some of the selected staff. Check the tracking section below.", { section: 'complaints' });
      return;
    }

    setSubmitting(true);
    try {
      // Prepare the data for the edge function
      const involvedParties = selectedStaff
        .filter(staff => staff.email) // Only include staff with email addresses
        .map(staff => ({
          staffName: staff.name,
          staffEmail: staff.email,
          staffRole: staff.role
        }));

      if (involvedParties.length === 0) {
        showToast.error("Please ensure all selected staff have email addresses", { section: 'complaints' });
        return;
      }

      // Call the edge function with the correct data structure
      const { data, error } = await supabase.functions.invoke('send-complaint-notifications', {
        body: {
          complaintId: complaint?.id,
          involvedParties: involvedParties
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) throw error;

      // Check if emails were actually sent
      if (data?.error) {
        throw new Error(data.error);
      }

      // Check email results
      const emailResults = data?.emailResults || [];
      const failedEmails = emailResults.filter((result: any) => result.status === 'failed');
      
      if (failedEmails.length > 0) {
        console.error('Failed emails:', failedEmails);
        showToast.error(`${failedEmails.length} emails failed to send. Check console for details.`, { section: 'complaints' });
      }

      const successfulEmails = emailResults.filter((result: any) => result.status === 'sent');
      
      if (successfulEmails.length === 0) {
        throw new Error('No emails were sent successfully. Please check EmailJS configuration.');
      }

      // Update local state with sent requests - but don't mark as completed yet
      const newInputRequests = involvedParties.map(party => ({
        id: Math.random().toString(36).substr(2, 9), // temporary ID
        staffName: party.staffName,
        staffEmail: party.staffEmail,
        status: 'pending', // Always start as pending, not 'Sent'
        sentAt: new Date().toISOString(),
        responseReceived: false
      }));

      setInputRequests(newInputRequests);
      
      if (successfulEmails.length === involvedParties.length) {
        showToast.success(`Input requests sent to ${successfulEmails.length} staff members`, { section: 'complaints' });
      } else {
        showToast.success(`${successfulEmails.length} of ${involvedParties.length} emails sent successfully`, { section: 'complaints' });
      }
      
      // Log the activity
      console.log('Email results:', emailResults);
      
    } catch (error) {
      console.error('Error sending input requests:', error);
      showToast.error("Failed to send input requests: " + error.message, { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearInputRequests = async () => {
    setSubmitting(true);
    try {
      // Clear any existing complaint_involved_parties records for this complaint
      const { error } = await supabase
        .from('complaint_involved_parties')
        .delete()
        .eq('complaint_id', complaint?.id);

      if (error) throw error;

      // Clear local state
      setInputRequests([]);
      showToast.success("Input requests cleared. You can now send new requests.", { section: 'complaints' });
      
    } catch (error) {
      console.error('Error clearing input requests:', error);
      showToast.error("Failed to clear input requests", { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestReply = async (requestId: string, staffName: string) => {
    setSubmitting(true);
    try {
      // Generate a realistic test response based on the complaint category
      const testResponses = {
        "Communication Issues": `I want to sincerely apologize for the breach of confidentiality that occurred. As the receptionist involved, I acknowledge that I should not have discussed the patient's test results in a public area where other patients could overhear.

I understand the importance of maintaining patient confidentiality at all times, and I take full responsibility for this error in judgment. This incident occurred during a particularly busy period, but I recognize that this is not an excuse for compromising patient privacy.

I have already taken steps to ensure this doesn't happen again by:
- Reviewing the practice's confidentiality policies
- Requesting additional training on GDPR and patient confidentiality
- Implementing a personal checklist to ensure all patient discussions occur in private areas

I deeply regret the distress this has caused to the patient and understand the impact this has had on their trust in our practice. I am committed to maintaining the highest standards of confidentiality going forward.`,
        
        "Clinical Care & Treatment": `Thank you for bringing this matter to my attention. I have carefully reviewed the patient's care and the circumstances surrounding this complaint.

After thorough consideration of the case notes and treatment decisions made, I want to provide my perspective on the clinical care provided. The treatment plan was developed based on the patient's presenting symptoms and clinical history available at the time.

I acknowledge that the patient's experience did not meet their expectations, and I sincerely apologize for any distress caused. Following this complaint, I have:
- Reviewed the latest clinical guidelines for this condition
- Discussed the case with colleagues for peer review
- Identified areas where communication could have been clearer

I am committed to learning from this experience and ensuring that all patients receive the highest standard of care and communication.`,
        
        "default": `Thank you for the opportunity to provide my input regarding this complaint. I have carefully considered the concerns raised and want to address them thoroughly.

I sincerely apologize for any part I played in the patient's unsatisfactory experience. Patient care and satisfaction are our top priorities, and I regret that we fell short of the standards expected.

After reflection, I have identified several areas for improvement and have taken the following actions:
- Reviewed relevant policies and procedures
- Sought additional guidance from senior colleagues
- Implemented changes to prevent similar issues in the future

I am committed to ensuring that all patients receive the care and service they deserve.`
      };

      const response = testResponses[complaint?.category as keyof typeof testResponses] || testResponses.default;

      // Update the complaint_involved_parties record with the test response
      const { error } = await supabase
        .from('complaint_involved_parties')
        .update({
          response_text: response,
          response_submitted_at: new Date().toISOString()
        })
        .eq('complaint_id', complaint?.id)
        .eq('staff_name', staffName);

      if (error) throw error;

      // Update local state to mark as completed
      setInputRequests(prev => prev.map(request => 
        request.id === requestId 
          ? { 
              ...request, 
              responseReceived: true, 
              status: 'completed',
              responseReceivedAt: new Date().toISOString(),
              responseText: response,
              isTestResponse: true
            }
          : request
      ));

      showToast.success(`Test reply generated for ${staffName}`, { section: 'complaints' });
      
    } catch (error) {
      console.error('Error generating test reply:', error);
      showToast.error("Failed to generate test reply", { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };
  const handleSaveWorkflowSettings = async () => {
    setSubmitting(true);
    try {
      const settings = {
        investigation_method: investigationMethod,
        selected_staff: selectedStaff,
        input_requests: inputRequests
      };

      // Save to complaint record or a separate workflow settings table
      const { error } = await supabase
        .from('complaints')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', complaint?.id);

      if (error) throw error;

      setWorkflowSettings(settings);
      showToast.success("Workflow settings saved", { section: 'complaints' });
      
    } catch (error) {
      console.error('Error saving workflow settings:', error);
      showToast.error("Failed to save workflow settings", { section: 'complaints' });
    } finally {
      setSubmitting(false);
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
            
            <Button 
              onClick={() => navigate('/complaints-guide')}
              variant="outline"
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 shrink-0"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              User Guide
            </Button>
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
                <div><strong>Priority:</strong> {getPriorityLabel(complaint.priority)}</div>
                <div><strong>Status:</strong> 
                  {complaint.status === 'under_review' && acknowledgementSentToPatient && (
                    <Mail className="h-3 w-3 inline ml-1 mr-1" />
                  )}
                  {getStatusLabel(complaint.status)}
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
                <strong>Description:</strong>
                <p className="mt-1 text-base text-muted-foreground">{complaint.complaint_description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Complaint Workflow Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
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
                      <Badge variant={complaint.status === 'closed' ? 'default' : complaint.status === 'submitted' ? 'secondary' : 'outline'}>
                        {complaint.status === 'under_review' && acknowledgementSentToPatient && (
                          <Mail className="h-3 w-3 mr-1" />
                        )}
                        {getStatusLabel(complaint.status)}
                      </Badge>
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
                      <p className="text-base text-foreground whitespace-pre-line">{complaint.complaint_description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Original Complaint Files */}
              {complaintDocuments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Original Complaint Files
                    </CardTitle>
                    <CardDescription>
                      Files and documents submitted with the original complaint
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}

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
                            {acknowledgementSentToPatient && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sent to Patient
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
                                  Sent to patient: {format(new Date(acknowledgementSentAt), 'dd/MM/yyyy HH:mm')}
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
                              Mark acknowledgement as sent to patient
                            </Label>
                          </div>
                        </div>
                        <div className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenAcknowledgementModal}
                          >
                            <Eye className="h-4 w-4 mr-1" />
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
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateAcknowledgement(complaint.id)}
                            disabled={submitting}
                          >
                            <RefreshCw className={`h-4 w-4 mr-1 ${submitting ? 'animate-spin' : ''}`} />
                            {submitting ? 'Regenerating...' : 'Regenerate Letter'}
                          </Button>
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
                              existingOutcome.outcome_type === 'partially_upheld' ? 'Complaint Partially Upheld' :
                              'Complaint Not Upheld'
                            }
                          </Badge>
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
                                const doc = await createLetterDocument(outcomeLetter, 'outcome', complaint.reference_number);
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

              {/* Executive Audio Summary - Show after outcome */}
              {existingOutcome && (
                <Collapsible open={showAudioSummarySection} onOpenChange={setShowAudioSummarySection}>
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
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
                        
                        {/* AI Review Conversation - Only show if audio exists */}
                        {audioOverview?.audio_overview_url && (
                          <ComplaintReviewConversation
                            complaintId={complaint.id}
                            onReviewComplete={() => {
                              // Refetch review conversations after completion
                              fetchComplaintDetails();
                            }}
                          />
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Review Conversation Notes - Show any existing reviews */}
              {reviewConversations.length > 0 && (
                <Collapsible open={showReviewNotesSection} onOpenChange={setShowReviewNotesSection}>
                  <Card>
                    <CardHeader>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                          <CardTitle className="text-left">
                            AI Review Conversation Records ({reviewConversations.length})
                          </CardTitle>
                          {showReviewNotesSection ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="space-y-4">
                          {reviewConversations.map((conversation) => (
                            <ComplaintReviewNote
                              key={conversation.id}
                              conversation={conversation}
                              reviewerName="System User"
                              onRegenerate={(newSummary) => {
                                // Update the conversation in the local state
                                setReviewConversations(prev => 
                                  prev.map(c => 
                                    c.id === conversation.id 
                                      ? { ...c, conversation_summary: newSummary }
                                      : c
                                  )
                                );
                              }}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Outcome Letter Dialog */}
              <Dialog open={showOutcomeLetter} onOpenChange={setShowOutcomeLetter}>
                <DialogContent className="max-w-6xl max-h-[98vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Outcome Letter - {complaint?.reference_number}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        Final outcome letter for this complaint
                      </span>
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="flex flex-col gap-4 max-h-[82vh]">
                    <div className="flex-1 overflow-y-auto">
                      <div className="bg-gray-50 p-2 rounded-lg">
                        <FormattedLetterContent content={outcomeLetter} />
                      </div>
                    </div>
                    
                    <div className="flex justify-between gap-2">
                      <Button variant="outline" onClick={() => setShowOutcomeLetter(false)}>
                        Close
                      </Button>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
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
                          onClick={async () => {
                            try {
                              const doc = await createLetterDocument(
                                outcomeLetter,
                                'outcome',
                                complaint?.reference_number || 'OUTCOME'
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
                          onClick={() => {
                            setShowOutcomeAIEdit(true);
                          }}
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          AI Edit
                        </Button>
                        <Button onClick={() => {
                          navigator.clipboard.writeText(outcomeLetter);
                          showToast.success('Letter copied to clipboard', { section: 'complaints' });
                        }}>
                          Copy to Clipboard
                        </Button>
                      </div>
                    </div>
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
              
              {acknowledgementLetter && (
                <Collapsible open={isWorkflowOpen} onOpenChange={setIsWorkflowOpen}>
                  <Card>
                    <CardHeader>
                      <CollapsibleTrigger className="flex items-center justify-between w-full hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Brain className="h-5 w-5" />
                          <div>
                            <CardTitle className="text-left">
                              Detailed Investigation Workflow{" "}
                              <span className="text-xs font-normal text-muted-foreground">(For Complex/Detailed Complaints requiring evidence and feedback from multiple areas)</span>
                            </CardTitle>
                            <CardDescription className="text-left">
                              Determine how the complaint will be investigated and who needs to provide input
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Investigation Method</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="direct-investigation"
                            name="investigation-method"
                            className="rounded"
                            checked={investigationMethod === "direct-investigation"}
                            onChange={() => handleInvestigationMethodChange("direct-investigation")}
                          />
                          <Label htmlFor="direct-investigation" className="text-sm cursor-pointer">
                            Direct Investigation - I will investigate this complaint directly
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="input-required"
                            name="investigation-method"
                            className="rounded"
                            checked={investigationMethod === "input-required"}
                            onChange={() => handleInvestigationMethodChange("input-required")}
                          />
                          <Label htmlFor="input-required" className="text-sm cursor-pointer">
                            Input Required - Request responses from involved parties
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Input Tracking Section - Hidden when Direct Investigation is selected */}
                    {investigationMethod !== "direct-investigation" && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Input Status Tracking</Label>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            Track the status of input requests sent to staff members:
                          </div>
                          
                          <div className="space-y-2 p-3 bg-gray-50 rounded border">
                            {inputRequests.length === 0 ? (
                              <div className="text-sm text-muted-foreground text-center py-4">
                                {investigationMethod === "input-required" 
                                  ? "No staff input requests sent yet. Select staff members and click 'Send Input Requests'."
                                  : "No staff input requests sent yet. Select investigation method and staff members above."
                                }
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {inputRequests.map((request) => {
                                  const sentDate = new Date(request.sentAt);
                                  const daysSinceRequest = Math.floor((new Date().getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
                                  const responseDeadline = new Date(sentDate.getTime() + (10 * 24 * 60 * 60 * 1000)); // 10 days deadline
                                  const daysLeft = Math.floor((responseDeadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                  const isOverdue = daysLeft < 0;
                                  
                                  return (
                                    <div key={request.id} className="border rounded-lg p-4 bg-white">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="font-medium text-foreground">{request.staffName}</span>
                                            <Badge 
                                              variant={
                                                request.responseReceived 
                                                  ? "default" 
                                                  : isOverdue 
                                                    ? "destructive" 
                                                    : "secondary"
                                              }
                                            >
                                              {request.responseReceived 
                                                ? "Response Received" 
                                                : isOverdue 
                                                  ? `Overdue (${Math.abs(daysLeft)} days)` 
                                                  : `${daysLeft} days left`
                                              }
                                            </Badge>
                                            {request.isTestResponse && (
                                              <Badge variant="outline" className="text-xs">
                                                Test Response
                                              </Badge>
                                            )}
                                          </div>
                                          
                                          <div className="text-sm text-muted-foreground space-y-1">
                                            <p>Email: {request.staffEmail}</p>
                                            <p>Request sent: {format(sentDate, 'dd/MM/yyyy HH:mm')} ({daysSinceRequest} days ago)</p>
                                            {!request.responseReceived && (
                                              <p className={isOverdue ? "text-red-600 font-medium" : ""}>
                                                Response due: {format(responseDeadline, 'dd/MM/yyyy')}
                                                {isOverdue && " (OVERDUE)"}
                                              </p>
                                            )}
                                            {request.responseReceived && request.responseReceivedAt && (
                                              <p className="text-green-600">
                                                Response received: {format(new Date(request.responseReceivedAt), 'dd/MM/yyyy HH:mm')}
                                              </p>
                                            )}
                                          </div>

                                          {/* Show response details if available */}
                                          {request.responseReceived && request.responseText && (
                                            <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                                              <h5 className="text-sm font-medium text-foreground mb-2">Response:</h5>
                                              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                                                {request.responseText.length > 200 
                                                  ? `${request.responseText.substring(0, 200)}...` 
                                                  : request.responseText
                                                }
                                              </div>
                                              {request.responseText.length > 200 && (
                                                <ViewFullResponseModal 
                                                  responseText={request.responseText}
                                                  staffName={request.staffName}
                                                />
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div className="flex flex-col items-end gap-2 ml-4">
                                          {/* Status indicator */}
                                          <div className="flex items-center gap-1">
                                            {request.responseReceived ? (
                                              <CheckCircle className="h-4 w-4 text-green-500" />
                                            ) : isOverdue ? (
                                              <AlertTriangle className="h-4 w-4 text-red-500" />
                                            ) : (
                                              <Clock className="h-4 w-4 text-yellow-500" />
                                            )}
                                          </div>
                                          
                                          {/* Test Reply button for pending requests */}
                                          {!request.responseReceived && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleTestReply(request.id, request.staffName)}
                                              disabled={submitting}
                                              className="text-xs"
                                            >
                                              Test Reply
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Save Settings Button - Always visible when investigation method is selected but not input-required */}
                    {investigationMethod && investigationMethod !== "input-required" && (
                      <div className="flex justify-end pt-4">
                        <Button 
                          variant="outline"
                          onClick={handleSaveWorkflowSettings}
                          disabled={submitting || !investigationMethod}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {submitting ? 'Saving...' : 'Save Settings'}
                        </Button>
                      </div>
                    )}

                    {/* Direct Investigation Section */}
                    {investigationMethod === "direct-investigation" && (
                      <div className="space-y-6 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Search className="h-4 w-4 text-green-600" />
                          <Label className="text-sm font-medium text-green-900">Direct Investigation</Label>
                        </div>
                        <p className="text-sm text-green-800 mb-4">
                          Conduct your investigation directly using the tools below to gather evidence, document findings, and make decisions.
                        </p>

                        <div className="space-y-6">
                          <InvestigationEvidence complaintId={complaint.id} disabled={submitting} />
                          <InvestigationFindings complaintId={complaint.id} disabled={submitting} />
                          <InvestigationDecisionAndLearning complaintId={complaint.id} disabled={submitting} />
                        </div>
                      </div>
                    )}

                    {/* Suggested Staff Input Section */}
                    {investigationMethod === "input-required" && (
                      <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <Label className="text-sm font-medium text-blue-900">Staff Selection</Label>
                        </div>
                        <p className="text-sm text-blue-800">
                          Select staff members who need to provide input for the investigation:
                        </p>
                        
                        {selectedStaff.length > 0 && (
                          <div className="space-y-2">
                            {selectedStaff.map((staff, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="flex items-center space-x-2 flex-1">
                                  <input 
                                    type="checkbox" 
                                    className="rounded" 
                                    defaultChecked={staff.suggested}
                                    onChange={(e) => handleStaffSelection(index, e.target.checked)}
                                  />
                                    <div className="flex flex-col flex-1">
                                      <span className="text-sm font-medium">{staff.name}</span>
                                      {staff.email ? (
                                        editingStaffIndex === index ? (
                                          // Edit mode
                                          <div className="flex items-center gap-2 mt-1">
                                            <Input
                                              type="email"
                                              placeholder="Enter email address"
                                              value={editingStaffIndex === index ? editingEmailValue : staff.email}
                                              onChange={(e) => {
                                                const newValue = e.target.value;
                                                setEditingEmailValue(newValue);
                                                
                                                // Clear any existing timeout
                                                if (emailUpdateTimeout.current) {
                                                  clearTimeout(emailUpdateTimeout.current);
                                                }
                                                
                                                // Set a new timeout to update the main state after user stops typing
                                                emailUpdateTimeout.current = setTimeout(() => {
                                                  const updatedStaff = [...selectedStaff];
                                                  updatedStaff[index].email = newValue;
                                                  setSelectedStaff(updatedStaff);
                                                }, 500); // 500ms delay
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  // Clear timeout and immediately save
                                                  if (emailUpdateTimeout.current) {
                                                    clearTimeout(emailUpdateTimeout.current);
                                                  }
                                                  const updatedStaff = [...selectedStaff];
                                                  updatedStaff[index].email = editingEmailValue;
                                                  setSelectedStaff(updatedStaff);
                                                  setEditingStaffIndex(null);
                                                }
                                              }}
                                              className="text-xs h-6 w-60"
                                              maxLength={50}
                                              autoFocus
                                            />
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                // Clear timeout and immediately save
                                                if (emailUpdateTimeout.current) {
                                                  clearTimeout(emailUpdateTimeout.current);
                                                }
                                                const updatedStaff = [...selectedStaff];
                                                updatedStaff[index].email = editingEmailValue;
                                                setSelectedStaff(updatedStaff);
                                                setEditingStaffIndex(null);
                                              }}
                                              className="text-xs h-6"
                                            >
                                              Save
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                // Clear timeout and cancel editing
                                                if (emailUpdateTimeout.current) {
                                                  clearTimeout(emailUpdateTimeout.current);
                                                }
                                                setEditingStaffIndex(null);
                                                setEditingEmailValue('');
                                              }}
                                              className="text-xs h-6"
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        ) : (
                                          // Display mode
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">{staff.email}</span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setEditingEmailValue(staff.email);
                                                setEditingStaffIndex(index);
                                              }}
                                              className="text-xs h-5 px-2"
                                            >
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )
                                      ) : (
                                        // No email - initial entry mode
                                        <div className="flex items-center gap-2 mt-1">
                                          <Input
                                            type="email"
                                            placeholder="Enter email address"
                                            value={staff.email}
                                            onChange={(e) => {
                                              const newValue = e.target.value;
                                              
                                              // Clear any existing timeout
                                              if (emailUpdateTimeout.current) {
                                                clearTimeout(emailUpdateTimeout.current);
                                              }
                                              
                                              // Set a new timeout to update the main state after user stops typing
                                              emailUpdateTimeout.current = setTimeout(() => {
                                                const updatedStaff = [...selectedStaff];
                                                updatedStaff[index].email = newValue;
                                                setSelectedStaff(updatedStaff);
                                              }, 500); // 500ms delay
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                // Don't auto-save, wait for user to click save
                                              }
                                            }}
                                            className="text-xs h-6 w-60"
                                            maxLength={50}
                                          />
                                          <span className="text-xs text-red-500">Email required</span>
                                        </div>
                                      )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {staff.type === 'mentioned' ? 'Mentioned' : 
                                     staff.type === 'category-based' ? 'Suggested' : 'Added'}
                                  </Badge>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    onClick={() => {
                                      const feedbackUrl = `/staff-feedback?complaintId=${complaintId}&staffName=${encodeURIComponent(staff.name)}&staffEmail=${encodeURIComponent(staff.email)}&staffRole=${encodeURIComponent(staff.role || '')}`;
                                      window.open(feedbackUrl, '_blank');
                                    }}
                                    className="text-xs"
                                  >
                                    Respond
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleRemoveStaff(index)}
                                    className="text-xs text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Add Additional Staff */}
                        <div className="pt-2 space-y-2">
                          <Label className="text-xs font-medium text-blue-900">Add Additional Staff:</Label>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <Input
                              placeholder="Staff name"
                              value={additionalStaff.name}
                              onChange={(e) => setAdditionalStaff(prev => ({...prev, name: e.target.value}))}
                              className="text-sm"
                            />
                            <Input
                              type="email"
                              placeholder="Email address"
                              value={additionalStaff.email}
                              onChange={(e) => setAdditionalStaff(prev => ({...prev, email: e.target.value}))}
                              className="text-sm"
                            />
                            <Input
                              placeholder="Role (optional)"
                              value={additionalStaff.role}
                              onChange={(e) => setAdditionalStaff(prev => ({...prev, role: e.target.value}))}
                              className="text-sm"
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleAddAdditionalStaff}
                              disabled={!additionalStaff.name || !additionalStaff.email}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                        
                        {/* Action Buttons for Input Required */}
                        <div className="flex gap-2 pt-4 border-t border-blue-200">
                          <Button 
                            className="flex-1"
                            onClick={handleSendInputRequests}
                            disabled={submitting || selectedStaff.length === 0 || selectedStaff.some(staff => 
                              inputRequests.some(request => request.staffName === staff.name && request.staffEmail === staff.email)
                            )}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {selectedStaff.some(staff => 
                              inputRequests.some(request => request.staffName === staff.name && request.staffEmail === staff.email)
                            ) ? 'Requests Already Sent' : submitting ? 'Sending...' : 'Send Input Requests'}
                          </Button>
                          {selectedStaff.some(staff => 
                            inputRequests.some(request => request.staffName === staff.name && request.staffEmail === staff.email)
                          ) && (
                            <Button 
                              variant="destructive"
                              size="sm"
                              onClick={handleClearInputRequests}
                              disabled={submitting}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Clear Requests
                            </Button>
                          )}
                          <Button 
                            variant="outline"
                            onClick={handleSaveWorkflowSettings}
                            disabled={submitting}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {submitting ? 'Saving...' : 'Save Settings'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Outcome Section for Input Required - Show when all responses received */}
                    {investigationMethod === "input-required" && inputRequests.length > 0 && 
                     inputRequests.every(request => request.responseReceived) && (
                      <div className="space-y-6 p-4 bg-green-50 rounded-lg border border-green-200 mt-6">
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <Label className="text-sm font-medium text-green-900">Investigation & Decision</Label>
                        </div>
                        <p className="text-sm text-green-800 mb-4">
                          All staff responses have been received. You can now review the evidence, document your findings, and make a decision on the complaint.
                        </p>

                         <div className="space-y-6">
                           <InvestigationEvidence complaintId={complaint.id} disabled={submitting} />
                           <InvestigationFindings complaintId={complaint.id} disabled={submitting} />
                           <InvestigationDecisionAndLearning complaintId={complaint.id} disabled={submitting} />
                           
                         </div>
                      </div>
                     )}
                       </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

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

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>NHS Compliance Overview</CardTitle>
                      <CardDescription>Track compliance with NHS England complaints procedures and CQC requirements</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
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
              {/* Action bar */}
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
              
              {/* Letter content */}
              <div className="flex-1 overflow-hidden">
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