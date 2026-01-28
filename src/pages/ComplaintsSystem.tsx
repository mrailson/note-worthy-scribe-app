import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { useNavigate } from "react-router-dom";
import { useDeviceInfo } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { ComplaintSignatureSettings } from "@/components/ComplaintSignatureSettings";
import { ComplaintImport } from "@/components/ComplaintImport";
import { PatientDetailsImportModal, PatientDetailsData } from "@/components/complaints/PatientDetailsImportModal";
import { ComplianceCheckCleanupButton } from "@/components/ComplianceCheckCleanupButton";
import { HierarchicalReports } from "@/components/complaints/HierarchicalReports";
import { ComplaintsSummaryView } from "@/components/complaints/ComplaintsSummaryView";
import { 
  maskPatientData, 
  getUserRoleLevel, 
  canViewFullPatientData,
  PatientDataMaskingOptions 
} from "@/utils/patientDataMasking";
import { PatientDataDisclosureWarning, PatientDataWarningBanner } from "@/components/PatientDataDisclosure";
import { usePatientDataAccess } from "@/hooks/usePatientDataAccess";
import { NHSComplianceBanner } from "@/components/NHSComplianceBanner";

import {
  FileText,
  User,
  Calendar,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Edit,
  Trash2,
  Plus,
  Download,
  FileCheck,
  Filter,
  Search,
  AlertCircle,
  Building,
  MapPin,
  Mail,
  FileOutput,
  Users,
  BarChart3,
  Activity,
  RefreshCw,
  ChevronRight,
  Eye,
  Send,
  UserCheck,
  FileSignature,
  ExternalLink,
  Home,
  BookOpen,
  Settings,
  X,
  Upload,
  Shield,
  Save,
  Copy,
  FlaskConical,
  LayoutGrid,
  List,
  UserPlus
} from "lucide-react";
import { format } from "date-fns";
import { showToast } from "@/utils/toastWrapper";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { FormattedLetterContent } from "@/components/FormattedLetterContent";
import { createLetterDocument, fetchLetterDetails } from "@/utils/letterFormatter";
import { cn } from "@/lib/utils";
import { calculateDaysUntilDeadline, addWorkingDays, calculateWorkingDays } from "@/utils/workingDays";
import { logComplaintViewWithMetadata } from "@/utils/auditLogger";

// Helper to identify simulated/example complaints
const isSimulatedComplaint = (complaint: Complaint): boolean => {
  return complaint.patient_name?.toLowerCase().includes('james robert williams') || false;
};

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
  gp_practices?: {
    name: string;
  };
  complaint_outcomes?: Array<{
    outcome_summary: string;
    outcome_type: string;
    sent_at?: string | null;
  }>;
}

interface ComplaintFormData {
  patient_name: string;
  patient_dob: string;
  patient_contact_phone: string;
  patient_contact_email: string;
  patient_address: string;
  incident_date: string;
  complaint_title: string;
  complaint_description: string;
  category: string;
  location_service: string;
  staff_mentioned: string;
  priority: string;
  consent_given: boolean;
  consent_details: string;
  complaint_on_behalf: boolean;
}

const ComplaintsSystem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const deviceInfo = useDeviceInfo();
  
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedOutcome, setSelectedOutcome] = useState("all");
  const [dashboardFilter, setDashboardFilter] = useState("");
  const [showSummaryView, setShowSummaryView] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dashboardCurrentPage, setDashboardCurrentPage] = useState(1);
  const dashboardItemsPerPage = 8;
  const [submitting, setSubmitting] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [involvedParties, setInvolvedParties] = useState<Array<{staffName: string; staffEmail: string; staffRole: string}>>([]);
  const [newParty, setNewParty] = useState({staffName: '', staffEmail: '', staffRole: ''});
  const [outcomeType, setOutcomeType] = useState('');
  const [outcomeSummary, setOutcomeSummary] = useState('');
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [outcomeLetter, setOutcomeLetter] = useState("");
  const [showOutcomeLetter, setShowOutcomeLetter] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [acknowledgementLetter, setAcknowledgementLetter] = useState("");
  const [showAcknowledgementLetter, setShowAcknowledgementLetter] = useState(false);
  const [viewingLetterComplaint, setViewingLetterComplaint] = useState<Complaint | null>(null);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [letterType, setLetterType] = useState<'acknowledgement' | 'outcome'>('acknowledgement');
  const [modalLetterContent, setModalLetterContent] = useState("");
  
  // Edit letter states
  const [isEditingLetter, setIsEditingLetter] = useState(false);
  const [editedLetterContent, setEditedLetterContent] = useState("");
  
  // Success modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newComplaintRef, setNewComplaintRef] = useState("");
  const [newComplaintData, setNewComplaintData] = useState<{
    title: string;
    description: string;
    created_at: string;
  } | null>(null);
  
  // Tab state
  const [currentTab, setCurrentTab] = useState("dashboard");
  
  // Audit log states
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [complianceAuditLogs, setComplianceAuditLogs] = useState<any[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const AUDIT_ITEMS_PER_PAGE = 20;
  const MAX_AUDIT_PAGES = 20;
  
  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [complaintToDelete, setComplaintToDelete] = useState<Complaint | null>(null);
  const [userPracticeId, setUserPracticeId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('workflow');
  
  // Patient data access management
  const [userRole, setUserRole] = useState<string | null>(null);
  const {
    showDisclosureDialog,
    pendingAccess,
    requestPatientDataAccess,
    approveAccess,
    revokeAccess,
    setShowDisclosureDialog,
    hasActiveAccess,
    getTimeRemaining,
    getActiveSessionCount
  } = usePatientDataAccess({ userRole });
  
  // Import complaint states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPatientImportModal, setShowPatientImportModal] = useState(false);

  // Fetch audit logs when audit tab is selected
  useEffect(() => {
    if (activeTab === 'audit' && selectedComplaint?.id) {
      fetchAuditLogs(selectedComplaint.id);
    }
  }, [activeTab, selectedComplaint?.id]);

  // Load acknowledgement and outcome letters when complaint is selected
  useEffect(() => {
    if (selectedComplaint?.id) {
      loadComplaintLetters(selectedComplaint.id);
    }
  }, [selectedComplaint?.id]);

  const loadComplaintLetters = async (complaintId: string) => {
    try {
      // Load existing acknowledgement letter if it exists
      const { data: acknowledgement } = await supabase
        .from('complaint_acknowledgements')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (acknowledgement) {
        setAcknowledgementLetter(acknowledgement.acknowledgement_letter);
      } else {
        setAcknowledgementLetter('');
      }
      
      // Load existing outcome if it exists
      const { data: outcome } = await supabase
        .from('complaint_outcomes')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (outcome) {
        setExistingOutcome(outcome);
        setOutcomeType(outcome.outcome_type);
        setOutcomeSummary(outcome.outcome_summary);
        setOutcomeLetter(outcome.outcome_letter);
      } else {
        setExistingOutcome(null);
        setOutcomeType('');
        setOutcomeSummary('');
        setOutcomeLetter('');
      }
    } catch (error) {
      console.error('Error loading complaint letters:', error);
    }
  };

  const viewLetter = async (complaint: Complaint, type: 'acknowledgement' | 'outcome') => {
    console.log('ViewLetter called for', complaint.reference_number, 'type:', type);
    setViewingLetterComplaint(complaint);
    setLetterType(type);
    
    try {
      if (type === 'acknowledgement') {
        const { data: acknowledgement, error } = await supabase
          .from('complaint_acknowledgements')
          .select('*')
          .eq('complaint_id', complaint.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        console.log('Acknowledgement data:', { acknowledgement, error });
        
        if (acknowledgement) {
          setModalLetterContent(acknowledgement.acknowledgement_letter);
          setEditedLetterContent(acknowledgement.acknowledgement_letter);
          setIsEditingLetter(false);
          setShowLetterModal(true);
        } else {
          showToast.error('No acknowledgement letter found for this complaint', { section: 'complaints' });
        }
      } else {
        const { data: outcomes, error } = await supabase
          .from('complaint_outcomes')
          .select('*')
          .eq('complaint_id', complaint.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        const outcome = outcomes?.[0];
        
        console.log('Outcome data:', { outcome, error });
        
        if (outcome) {
          console.log('Outcome letter content:', outcome.outcome_letter);
          console.log('Setting modal content and showing modal');
          setModalLetterContent(outcome.outcome_letter);
          setEditedLetterContent(outcome.outcome_letter);
          setIsEditingLetter(false);
          setShowLetterModal(true);
          console.log('Modal state after setting:', { 
            showLetterModal: true, 
            modalLetterContent: outcome.outcome_letter?.substring(0, 100) + '...' 
          });
        } else {
          console.log('No outcome found, showing error toast');
          showToast.error('No outcome letter found for this complaint', { section: 'complaints' });
        }
      }
    } catch (error) {
      console.error('Error fetching letter:', error);
      showToast.error('Failed to load letter', { section: 'complaints' });
    }
  };

  const checkLetterExists = async (complaintId: string, type: 'acknowledgement' | 'outcome'): Promise<boolean> => {
    try {
      if (type === 'acknowledgement') {
        const { data, error } = await supabase
          .from('complaint_acknowledgements')
          .select('id')
          .eq('complaint_id', complaintId)
          .limit(1)
          .maybeSingle();
        
        console.log(`Acknowledgement check for ${complaintId}:`, { data, error });
        return !!data;
      } else {
        const { data, error } = await supabase
          .from('complaint_outcomes')
          .select('id')
          .eq('complaint_id', complaintId)
          .limit(1)
          .maybeSingle();
        
        console.log(`Outcome check for ${complaintId}:`, { data, error });
        return !!data;
      }
    } catch (error) {
      console.error(`Error checking ${type} letter for ${complaintId}:`, error);
      return false;
    }
  };
  
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [complianceChecks, setComplianceChecks] = useState<Array<{
    id: string;
    compliance_item: string;
    is_compliant: boolean;
    evidence: string | null;
    notes: string | null;
  }>>([]);
  const [complianceSummary, setComplianceSummary] = useState<{
    total_items: number;
    compliant_items: number;
    compliance_percentage: number;
    outstanding_items: string[];
  } | null>(null);
  const [lettersStatus, setLettersStatus] = useState<Record<string, { hasAcknowledgement: boolean; hasOutcome: boolean; outcomeType?: string }>>({});

  const [formData, setFormData] = useState<ComplaintFormData>({
    patient_name: "",
    patient_dob: "",
    patient_contact_phone: "",
    patient_contact_email: "",
    patient_address: "",
    incident_date: "",
    complaint_title: "",
    complaint_description: "",
    category: "",
    location_service: "",
    staff_mentioned: "",
    priority: "medium",
    consent_given: true,
    consent_details: "",
    complaint_on_behalf: false,
  });

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

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Open - Under Review" },
    { value: "response_sent", label: "Response Sent" },
    { value: "closed", label: "Closed" },
    { value: "escalated", label: "Escalated" },
  ];

  const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
  ];

  useEffect(() => {
    if (user) {
      fetchComplaints();
      fetchUserRole();
      fetchUserPractice();
    }
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;
    
    try {
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return;
      }
      
      setUserRole(roleData?.role || 'standard');
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      setUserRole('standard');
    }
  };

  const fetchUserPractice = async () => {
    if (!user?.id) return;
    
    try {
      const { data: practiceIds } = await supabase.rpc('get_user_practice_ids', {
        p_user_id: user.id
      });
      
      if (practiceIds && practiceIds.length > 0) {
        setUserPracticeId(practiceIds[0]);
      }
    } catch (error) {
      console.error('Error fetching user practice:', error);
    }
  };

  useEffect(() => {
    if (complaints.length > 0) {
      loadLettersStatus();
    }
  }, [complaints]);

  const loadLettersStatus = async () => {
    console.log('Loading letters status for', complaints.length, 'complaints');
    const status: Record<string, { hasAcknowledgement: boolean; hasOutcome: boolean; outcomeType?: string }> = {};
    
    for (const complaint of complaints) {
      const [hasAck, hasOutcome] = await Promise.all([
        checkLetterExists(complaint.id, 'acknowledgement'),
        checkLetterExists(complaint.id, 'outcome')
      ]);
      
      let outcomeType: string | undefined;
      if (hasOutcome) {
        const { data: outcomeData } = await supabase
          .from('complaint_outcomes')
          .select('outcome_type')
          .eq('complaint_id', complaint.id)
          .limit(1)
          .maybeSingle();
        
        outcomeType = outcomeData?.outcome_type;
      }
      
      status[complaint.id] = {
        hasAcknowledgement: hasAck,
        hasOutcome: hasOutcome,
        outcomeType: outcomeType
      };
      
      console.log(`Complaint ${complaint.reference_number}:`, { hasAck, hasOutcome, outcomeType });
    }
    
    console.log('Final letters status:', status);
    setLettersStatus(status);
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          complaint_outcomes(outcome_summary, outcome_type, sent_at),
          gp_practices(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map complaints and update status to 'closed' if outcome summary exists
      const mappedComplaints = (data || []).map(complaint => ({
        ...complaint,
        status: complaint.complaint_outcomes?.[0]?.outcome_summary ? 'closed' : complaint.status
      }));
      
      setComplaints(mappedComplaints);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      showToast.error("Failed to fetch complaints", { section: 'complaints' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation: require consent only when submitting on behalf of someone else
    if (formData.complaint_on_behalf && !formData.consent_given) {
      showToast.error("Consent is required when submitting on behalf of someone else.", { section: 'complaints' });
      document.getElementById('consent_given')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      setSubmitting(true);
      
      const complaintData = {
        patient_name: formData.patient_name,
        patient_dob: formData.patient_dob || null,
        patient_contact_phone: formData.patient_contact_phone || null,
        patient_contact_email: formData.patient_contact_email || null,
        patient_address: formData.patient_address || null,
        incident_date: formData.incident_date,
        complaint_title: formData.complaint_title,
        complaint_description: formData.complaint_description,
        category: formData.category as any,
        location_service: formData.location_service || null,
        staff_mentioned: Array.isArray((formData as any).staff_mentioned)
          ? ((formData as any).staff_mentioned as string[])
          : (formData.staff_mentioned
              ? formData.staff_mentioned.split(',').map(s => s.trim()).filter(Boolean)
              : null),
        priority: formData.priority as any,
        consent_given: formData.consent_given,
        consent_details: formData.consent_details || null,
        complaint_on_behalf: formData.complaint_on_behalf,
        practice_id: userPracticeId,
        created_by: user.id,
        status: 'submitted' as any,
      };

      console.log('Submitting complaint data:', complaintData); // Debug log

      const { data, error } = await supabase
        .from('complaints')
        .insert({
          ...complaintData,
          reference_number: '' // Will be auto-generated by trigger
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      // Show success modal and store reference
      setNewComplaintRef(data.reference_number);
      setNewComplaintData({
        title: data.complaint_title,
        description: data.complaint_description,
        created_at: data.created_at
      });
      setShowSuccessModal(true);

      // Reset form
      setFormData({
        patient_name: "",
        patient_dob: "",
        patient_contact_phone: "",
        patient_contact_email: "",
        patient_address: "",
        incident_date: "",
        complaint_title: "",
        complaint_description: "",
        category: "",
        location_service: "",
        staff_mentioned: "",
        priority: "medium",
        consent_given: false,
        consent_details: "",
        complaint_on_behalf: false,
      });

      // Refresh complaints list
      fetchComplaints();
      
      // Initialize compliance checklist for new complaint
      if (data?.id) {
        await initializeComplianceChecklist(data.id);
        
        // Auto-generate acknowledgement letter in the background
        // This runs asynchronously without blocking the user experience
        showToast.info('Generating acknowledgement letter...', { section: 'complaints', duration: 3000 });
        
        supabase.functions.invoke('generate-complaint-acknowledgement', {
          body: { complaintId: data.id }
        }).then(({ data: ackData, error: ackError }) => {
          if (ackError) {
            console.error('Background acknowledgement generation error:', ackError);
            showToast.error('Failed to generate acknowledgement letter', { section: 'complaints' });
          } else {
            console.log('Acknowledgement letter generated automatically');
            showToast.success('Acknowledgement letter ready', { section: 'complaints' });
            // Silently refresh the complaints list to show the acknowledgement status
            fetchComplaints();
          }
        }).catch(err => {
          console.error('Failed to generate acknowledgement in background:', err);
          showToast.error('Failed to generate acknowledgement letter', { section: 'complaints' });
        });
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
      showToast.error("Failed to submit complaint", { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ComplaintFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImportedData = (importedData: any) => {
    setFormData(prev => ({
      ...prev,
      patient_name: importedData.patient_name || prev.patient_name,
      patient_dob: importedData.patient_dob || prev.patient_dob,
      patient_contact_phone: importedData.patient_contact_phone || prev.patient_contact_phone,
      patient_contact_email: importedData.patient_contact_email || prev.patient_contact_email,
      patient_address: importedData.patient_address || prev.patient_address,
      incident_date: importedData.incident_date || prev.incident_date,
      complaint_title: importedData.complaint_title || prev.complaint_title,
      complaint_description: importedData.complaint_description || prev.complaint_description,
      category: importedData.category || prev.category,
      location_service: importedData.location_service || prev.location_service,
      staff_mentioned: Array.isArray(importedData.staff_mentioned)
        ? importedData.staff_mentioned.join(', ')
        : (importedData.staff_mentioned || prev.staff_mentioned),
      complaint_on_behalf: importedData.complaint_on_behalf ?? prev.complaint_on_behalf,
    }));
    setShowImportModal(false);
    showToast.success("Complaint data imported successfully!", { section: 'complaints' });
  };

  // Handle patient details import (patient-only fields)
  const handlePatientImport = (patientData: PatientDetailsData) => {
    setFormData(prev => ({
      ...prev,
      patient_name: patientData.patient_name || prev.patient_name,
      patient_dob: patientData.patient_dob || prev.patient_dob,
      patient_contact_phone: patientData.patient_contact_phone || prev.patient_contact_phone,
      patient_contact_email: patientData.patient_contact_email || prev.patient_contact_email,
      patient_address: patientData.patient_address || prev.patient_address,
    }));
    setShowPatientImportModal(false);
  };

  const handleGenerateAcknowledgement = async (complaintId: string) => {
    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke('generate-complaint-acknowledgement', {
        body: { complaintId }
      });

      if (error) throw error;

      // Set the acknowledgement letter in state to display it
      if (data?.acknowledgementLetter) {
        setAcknowledgementLetter(data.acknowledgementLetter);
      }

      showToast.success('Acknowledgement letter generated successfully', { section: 'complaints' });
      fetchComplaints(); // Refresh to show updated status
      loadLettersStatus(); // Refresh letters status
    } catch (error) {
      console.error('Error generating acknowledgement:', error);
      showToast.error('Failed to generate acknowledgement letter', { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };


  const handleSendStaffNotifications = async (complaintId: string) => {
    if (involvedParties.length === 0) {
      showToast.error('Please add at least one staff member to notify', { section: 'complaints' });
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke('send-complaint-notifications', {
        body: { 
          complaintId,
          involvedParties 
        }
      });

      if (error) throw error;

      showToast.success('Notifications sent to staff members', { section: 'complaints' });
      setInvolvedParties([]);
      fetchComplaints();
    } catch (error) {
      console.error('Error sending notifications:', error);
      showToast.error('Failed to send staff notifications', { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateOutcomeLetter = async (complaintId: string) => {
    if (!outcomeType || !outcomeSummary) {
      showToast.error('Please select outcome type and provide summary', { section: 'complaints' });
      return;
    }

    try {
      setSubmitting(true);
      const { data: letterData, error: letterError } = await supabase.functions.invoke('generate-complaint-outcome-letter', {
        body: { 
          complaintId,
          outcomeType,
          outcomeSummary 
        }
      });

      if (letterError) throw letterError;

      // Store or update the outcome in database
      if (existingOutcome) {
        const { error: updateError } = await supabase
          .from('complaint_outcomes')
          .update({
            outcome_type: outcomeType,
            outcome_summary: outcomeSummary,
            outcome_letter: letterData.outcomeLetter,
            decided_by: user?.id,
            decided_at: new Date().toISOString()
          })
          .eq('id', existingOutcome.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('complaint_outcomes')
          .insert({
            complaint_id: complaintId,
            outcome_type: outcomeType,
            outcome_summary: outcomeSummary,
            outcome_letter: letterData.outcomeLetter,
            decided_by: user?.id,
          });

        if (insertError) throw insertError;
      }

      // Update complaint status
      const { error: updateError } = await supabase
        .from('complaints')
        .update({ status: 'closed' })
        .eq('id', complaintId);

      if (updateError) throw updateError;

      setOutcomeLetter(letterData.outcomeLetter);
      setShowOutcomeLetter(true);
      showToast.success('Outcome letter generated and complaint closed', { section: 'complaints' });
      fetchComplaints();
    } catch (error) {
      console.error('Error generating outcome letter:', error);
      showToast.error('Failed to generate outcome letter', { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveOutcomeLetter = async () => {
    if (!existingOutcome) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('complaint_outcomes')
        .update({
          outcome_letter: outcomeLetter,
          outcome_type: outcomeType,
          outcome_summary: outcomeSummary
        })
        .eq('id', existingOutcome.id);

      if (error) throw error;

      showToast.success('Outcome letter saved successfully', { section: 'complaints' });
      setEditingOutcome(false);
    } catch (error) {
      console.error('Error saving outcome letter:', error);
      showToast.error('Failed to save outcome letter', { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch audit logs for the selected complaint
  const fetchAuditLogs = async (complaintId: string) => {
    try {
      setAuditLoading(true);
      console.log('Fetching audit logs for complaint:', complaintId);
      
      // Fetch general audit logs
      const { data: generalLogs, error: generalError } = await supabase
        .from('complaint_audit_detailed')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });
      
      if (generalError) {
        console.error('Error fetching audit logs:', generalError);
        setAuditLogs([]);
        return;
      }
      
      // Deduplicate VIEW events - keep only one per minute with combined context
      const deduplicatedLogs = (generalLogs || []).reduce((acc: any[], log: any) => {
        if (log.action_type === 'VIEW') {
          const logMinute = new Date(log.created_at).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
          const existingViewInMinute = acc.find(
            l => l.action_type === 'VIEW' && 
            new Date(l.created_at).toISOString().slice(0, 16) === logMinute
          );
          
          if (existingViewInMinute) {
            // Add context to existing entry
            const existingContext = existingViewInMinute.new_values?.context || '';
            const newContext = log.new_values?.context || '';
            if (newContext && !existingContext.includes(newContext)) {
              existingViewInMinute.action_description = 'Viewed complaint (multiple tabs)';
              existingViewInMinute.new_values = {
                ...existingViewInMinute.new_values,
                contexts: [...(existingViewInMinute.new_values?.contexts || [existingContext]), newContext]
              };
            }
            return acc;
          }
        }
        return [...acc, log];
      }, []);
      
      setAuditLogs(deduplicatedLogs);

      if (generalError) {
        console.error('Error fetching general audit logs:', generalError);
        throw generalError;
      }

      console.log('General audit logs fetched:', generalLogs?.length || 0);

      // Fetch compliance audit logs
      const { data: complianceLogs, error: complianceError } = await supabase
        .from('complaint_compliance_audit')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });

      if (complianceError) {
        console.error('Error fetching compliance audit logs:', complianceError);
        throw complianceError;
      }

      console.log('Compliance audit logs fetched:', complianceLogs?.length || 0);

      setAuditLogs(generalLogs || []);
      setComplianceAuditLogs(complianceLogs || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      showToast.error('Failed to fetch audit logs', { section: 'complaints' });
    } finally {
      setAuditLoading(false);
    }
  };

  // Export audit logs to Word document
  const exportAuditToWord = async () => {
    try {
      const logs = filteredAuditLogs;
      
      if (logs.length === 0) {
        showToast.error('No audit logs to export', { section: 'complaints' });
        return;
      }

      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `Complaint Audit Log - ${selectedComplaint?.reference_number || 'All Complaints'}`,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`,
              spacing: { after: 400 }
            }),
            ...logs.map(log => new Paragraph({
              children: [
                new TextRun({
                  text: `${format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')} - `,
                  bold: true
                }),
                new TextRun({
                  text: `${log.action_type.replace('_', ' ').toUpperCase()} - `,
                  color: getActionColor(log.action_type)
                }),
                new TextRun({
                  text: `${log.profiles?.full_name || log.user_email} - `,
                  italics: true
                }),
                new TextRun({
                  text: log.action_description
                })
              ],
              spacing: { after: 200 }
            }))
          ]
        }]
      });

      // Generate and download
      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${selectedComplaint?.reference_number || 'all'}-${format(new Date(), 'yyyy-MM-dd')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      showToast.success('Audit log exported to Word successfully', { section: 'complaints' });
    } catch (error) {
      console.error('Error exporting audit log:', error);
      showToast.error('Failed to export audit log', { section: 'complaints' });
    }
  };

  // Get action color for Word export
  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'create': return '00AA00';
      case 'view': return '0066CC';
      case 'edit': return 'FF6600';
      case 'status_change': return 'CC0000';
      case 'compliance_update': return '6600CC';
      default: return '000000';
    }
  };

  // Get badge variant for action types
  const getActionBadgeVariant = (actionType: string) => {
    switch (actionType) {
      case 'create': return 'default';
      case 'view': return 'secondary';
      case 'edit': return 'outline';
      case 'status_change': return 'destructive';
      case 'compliance_update': return 'default';
      default: return 'secondary';
    }
  };

  // Filter audit logs based on search and action type
  const filteredAuditLogs = [...auditLogs, ...complianceAuditLogs.map(log => ({
    ...log,
    action_type: 'compliance_update',
    action_description: `${log.compliance_item} changed from ${log.previous_status ? 'completed' : 'pending'} to ${log.new_status ? 'completed' : 'pending'}`
  }))].filter(log => {
    const matchesSearch = 
      log.action_description.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (log.profiles?.full_name || log.user_email || '').toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      log.action_type.toLowerCase().includes(auditSearchTerm.toLowerCase());
    
    const matchesAction = auditActionFilter === 'all' || log.action_type === auditActionFilter;
    
    return matchesSearch && matchesAction;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Pagination calculations for audit logs
  const totalAuditPages = Math.min(Math.ceil(filteredAuditLogs.length / AUDIT_ITEMS_PER_PAGE), MAX_AUDIT_PAGES);
  const auditStartIndex = (auditCurrentPage - 1) * AUDIT_ITEMS_PER_PAGE;
  const auditEndIndex = auditStartIndex + AUDIT_ITEMS_PER_PAGE;
  const paginatedAuditLogs = filteredAuditLogs.slice(auditStartIndex, auditEndIndex);
  const maxDisplayableRecords = MAX_AUDIT_PAGES * AUDIT_ITEMS_PER_PAGE;
  
  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setAuditCurrentPage(1);
  }, [auditSearchTerm, auditActionFilter]);

  const addInvolvedParty = () => {
    if (!newParty.staffName || !newParty.staffEmail) {
      showToast.error('Please provide staff name and email', { section: 'complaints' });
      return;
    }

    setInvolvedParties(prev => [...prev, newParty]);
    setNewParty({staffName: '', staffEmail: '', staffRole: ''});
  };

  const removeInvolvedParty = (index: number) => {
    setInvolvedParties(prev => prev.filter((_, i) => i !== index));
  };

  const initializeComplianceChecklist = async (complaintId: string) => {
    try {
      const { error } = await supabase.rpc('initialize_complaint_compliance', {
        p_complaint_id: complaintId
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error initializing compliance checklist:', error);
    }
  };

  const fetchComplianceData = async (complaintId: string) => {
    try {
      // Fetch compliance checks
      const { data: checksData, error: checksError } = await supabase
        .from('complaint_compliance_checks')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('compliance_item');

      if (checksError) throw checksError;
      setComplianceChecks(checksData || []);

      // Fetch compliance summary
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_complaint_compliance_summary', {
        p_complaint_id: complaintId
      });

      if (summaryError) throw summaryError;
      if (summaryData && summaryData.length > 0) {
        // Map the response to match the expected state structure
        const summary = summaryData[0];
        setComplianceSummary({
          total_items: Number(summary.total_checks),
          compliant_items: Number(summary.completed_checks),
          compliance_percentage: Number(summary.compliance_percentage),
          outstanding_items: [] // Can be calculated from checksData if needed
        });
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    }
  };

  const updateComplianceCheck = async (checkId: string, isCompliant: boolean, evidence?: string) => {
    try {
      // Get the current check details for logging
      const currentCheck = complianceChecks.find(check => check.id === checkId);
      if (!currentCheck) {
        console.error('Compliance check not found');
        return;
      }

      console.log('Updating compliance check:', {
        checkId,
        currentStatus: currentCheck.is_compliant,
        newStatus: isCompliant,
        selectedComplaint: selectedComplaint?.id
      });

      // Log the compliance change BEFORE updating
      if (selectedComplaint) {
        const { error: logError } = await supabase.rpc('log_compliance_change', {
          p_complaint_id: selectedComplaint.id,
          p_compliance_check_id: checkId,
          p_compliance_item: currentCheck.compliance_item,
          p_previous_status: currentCheck.is_compliant,
          p_new_status: isCompliant
        });

        if (logError) {
          console.error('Error logging compliance change:', logError);
        } else {
          console.log('Compliance change logged successfully');
        }
      }

      // Update the compliance check
      const { error } = await supabase
        .from('complaint_compliance_checks')
        .update({ 
          is_compliant: isCompliant, 
          evidence,
          checked_by: user?.id,
          checked_at: new Date().toISOString()
        })
        .eq('id', checkId);

      if (error) throw error;

      // Update local state immediately
      setComplianceChecks(prev => 
        prev.map(check => 
          check.id === checkId 
            ? { ...check, is_compliant: isCompliant }
            : check
        )
      );

      // Refresh compliance data and audit logs
      if (selectedComplaint) {
        await fetchComplianceData(selectedComplaint.id);
        await fetchAuditLogs(selectedComplaint.id);
      }
      
      showToast.success('Compliance check updated', { section: 'complaints' });
    } catch (error) {
      console.error('Error updating compliance check:', error);
      showToast.error('Failed to update compliance check', { section: 'complaints' });
    }
  };

  const handleAnalyzeOutcome = async (complaintId: string) => {
    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke('analyze-complaint-outcome', {
        body: { complaintId }
      });

      if (error) throw error;

      setAiAnalysis(data.analysis);
      showToast.success('AI analysis completed', { section: 'complaints' });
    } catch (error) {
      console.error('Error analyzing outcome:', error);
      showToast.error('Failed to analyze complaint outcome', { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const mapAICategoryToFormCategory = (aiCategory: string): string => {
    const categoryMapping: { [key: string]: string } = {
      'clinical_care': 'Clinical Care & Treatment',
      'medication': 'Prescriptions',
      'communication': 'Communication Issues',
      'referrals': 'Test Results & Follow-Up',
      'staff_attitude': 'Staff Attitude & Behaviour',
      'appointment_system': 'Appointments & Access',
      'waiting_times': 'Appointments & Access',
      'facilities': 'Facilities & Environment',
      'billing': 'Administration',
      'other': 'other'
    };
    
    return categoryMapping[aiCategory] || 'other';
  };

  const handleDeleteComplaint = async (complaint: Complaint) => {
    setComplaintToDelete(complaint);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteComplaint = async () => {
    if (!complaintToDelete) return;
    
    setDeleting(true);
    try {
      const complaintId = complaintToDelete.id;
      
      // Use secure database function to cascade delete complaint and all related records
      const { data, error } = await supabase.rpc('delete_complaint_cascade', {
        p_complaint_id: complaintId
      });

      if (error) throw error;
      
      // Check if the function returned a success response
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete complaint');
      }

      // Remove from local state
      setComplaints(prev => prev.filter(c => c.id !== complaintId));
      
      showToast.success(`Complaint ${complaintToDelete.reference_number} has been permanently deleted`, { section: 'complaints' });
      setShowDeleteConfirm(false);
      setComplaintToDelete(null);
    } catch (error) {
      console.error('Error deleting complaint:', error);
      showToast.error('Failed to delete complaint. Please try again.', { section: 'complaints' });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft": return <Edit className="h-4 w-4" />;
      case "submitted": return <AlertCircle className="h-4 w-4" />;
      case "under_review": return <Clock className="h-4 w-4" />;
      case "response_sent": return <Send className="h-4 w-4" />;
      case "closed": return <CheckCircle className="h-4 w-4" />;
      case "escalated": return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "submitted": return "bg-blue-100 text-blue-800";
      case "under_review": return "bg-yellow-100 text-yellow-800";
      case "response_sent": return "bg-purple-100 text-purple-800";
      case "closed": return "bg-green-100 text-green-800";
      case "escalated": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "urgent": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryLabel = (category: string) => {
    const option = categoryOptions.find(opt => opt.value === category);
    return option?.label || category;
  };

  const getStatusLabel = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.label || status;
  };

  const getStatusDisplayLabel = (complaint: Complaint) => {
    const statusLabel = getStatusLabel(complaint.status);
    
    // If closed and has outcome type, append it
    if (complaint.status === 'closed' && complaint.complaint_outcomes?.[0]?.outcome_type) {
      const outcomeType = complaint.complaint_outcomes[0].outcome_type;
      // Capitalize first letter of each word
      const formattedOutcome = outcomeType
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${statusLabel} - ${formattedOutcome}`;
    }
    
    return statusLabel;
  };

  const getPriorityLabel = (priority: string) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option?.label || priority;
  };

  const isOverdue = (complaint: Complaint) => {
    if (!complaint.response_due_date) return false;
    return new Date(complaint.response_due_date) < new Date() && complaint.status !== 'closed';
  };

  const filteredComplaints = complaints.filter(complaint => {
    const matchesSearch = 
      complaint.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.complaint_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.reference_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || complaint.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || complaint.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || complaint.priority === selectedPriority;
    
    // Check outcome match
    let matchesOutcome = true;
    if (selectedOutcome !== 'all') {
      const hasOutcome = lettersStatus[complaint.id]?.hasOutcome;
      const outcomeType = lettersStatus[complaint.id]?.outcomeType;
      
      if (selectedOutcome === 'in_progress') {
        matchesOutcome = !hasOutcome;
      } else {
        matchesOutcome = hasOutcome && outcomeType === selectedOutcome;
      }
    }

    // Apply dashboard filter
    let matchesDashboardFilter = true;
    if (dashboardFilter === "open") {
      matchesDashboardFilter = ['submitted', 'under_review'].includes(complaint.status);
    } else if (dashboardFilter === "overdue") {
      matchesDashboardFilter = isOverdue(complaint);
    } else if (dashboardFilter === "closed_this_month") {
      matchesDashboardFilter = complaint.status === 'closed' && 
        new Date(complaint.closed_at || '').getMonth() === new Date().getMonth();
    } else if (dashboardFilter === "all") {
      matchesDashboardFilter = true;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority && matchesOutcome && matchesDashboardFilter;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedComplaints = filteredComplaints.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedStatus, selectedPriority, selectedOutcome, dashboardFilter]);

  // Reset dashboard pagination when filter changes
  useEffect(() => {
    setDashboardCurrentPage(1);
  }, [dashboardFilter]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <SEO 
        title="NHS Complaints Management System | NoteWell AI"
        description="Secure, NHS-compliant complaint management system with full evidence tracking, audit trails, and automated acknowledgement letters for GP practices."
        canonical="https://www.gpnotewell.co.uk/complaints"
        keywords="NHS complaints management, GP complaint system, medical complaints handling, NHS compliance, complaint audit trail"
      />
      <Header onNewMeeting={() => {}} />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <MaintenanceBanner />
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground mb-2">
                <span className="hidden sm:inline">🏥 GP Practice Complaint Management System</span>
                <span className="sm:hidden">🏥 Complaints</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                <span className="hidden sm:inline">Secure, NHS-compliant complaint management with full evidence management and audit trail</span>
                <span className="sm:hidden">NHS-compliant complaint management</span>
              </p>
            </div>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className={cn(
          deviceInfo.isIPhone ? "space-y-3" : "space-y-4 sm:space-y-6"
        )}>
          <TabsList className={cn(
            "grid w-full gap-1 p-1",
            deviceInfo.isIPhone 
              ? "grid-cols-3 h-auto" 
              : "grid-cols-2 sm:grid-cols-5 h-auto"
          )}>
            <TabsTrigger 
              value="dashboard" 
              className={cn(
                "flex items-center gap-1 text-xs sm:text-sm touch-manipulation",
                deviceInfo.isIPhone ? "min-h-[52px] flex-col py-2" : "min-h-[44px]"
              )}
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Home</span>
            </TabsTrigger>
            <TabsTrigger 
              value="view" 
              className={cn(
                "flex items-center gap-1 text-xs sm:text-sm touch-manipulation",
                deviceInfo.isIPhone ? "min-h-[52px] flex-col py-2" : "min-h-[44px]"
              )}
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">View Complaints</span>
              <span className="sm:hidden">View</span>
            </TabsTrigger>
            <TabsTrigger 
              value="new" 
              className={cn(
                "flex items-center gap-1 text-xs sm:text-sm touch-manipulation",
                deviceInfo.isIPhone ? "min-h-[52px] flex-col py-2" : "min-h-[44px]"
              )}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Complaint</span>
              <span className="sm:hidden">New</span>
            </TabsTrigger>
            {!deviceInfo.isIPhone && (
              <>
                <TabsTrigger value="reports" className="flex items-center gap-1 min-h-[44px] text-xs sm:text-sm touch-manipulation">
                  <BarChart3 className="h-4 w-4" />
                  <span>Reports</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-1 min-h-[44px] text-xs sm:text-sm touch-manipulation">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Signature Settings</span>
                  <span className="sm:hidden">Settings</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

           {/* Dashboard Tab */}
          <TabsContent value="dashboard" className={cn(
            deviceInfo.isIPhone ? "space-y-3" : "space-y-4 sm:space-y-6"
          )}>
            <div className={cn(
              "grid gap-3 sm:gap-4",
              deviceInfo.isIPhone ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
            )}>
              <Card 
                className={cn(
                  "cursor-pointer hover:shadow-md transition-all",
                  showSummaryView && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => { 
                  setShowSummaryView(!showSummaryView);
                  if (!showSummaryView) {
                    setDashboardFilter("all");
                  }
                }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-between">
                    <span>
                      <span className="hidden sm:inline">Total Complaints</span>
                      <span className="sm:hidden">Total</span>
                    </span>
                    {showSummaryView ? (
                      <List className="h-4 w-4 text-primary" />
                    ) : (
                      <LayoutGrid className="h-4 w-4" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">{complaints.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    <span className="hidden sm:inline">
                      {showSummaryView ? 'Click to hide summary view' : 'Click for summary view'}
                    </span>
                    <span className="sm:hidden">
                      {showSummaryView ? 'Hide summary' : 'Summary view'}
                    </span>
                  </p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => { 
                      setDashboardFilter("open");
                    }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Open</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-orange-600">
                    {complaints.filter(c => ['submitted', 'under_review'].includes(c.status)).length}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    <span className="hidden sm:inline">Click to view open complaints</span>
                    <span className="sm:hidden">View open</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => { 
                      setDashboardFilter("overdue");
                    }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-red-600">
                    {complaints.filter(isOverdue).length}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    <span className="hidden sm:inline">Click to view overdue complaints</span>
                    <span className="sm:hidden">View overdue</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => { 
                      setDashboardFilter("closed_this_month");
                    }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Closed This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {complaints.filter(c => c.status === 'closed' && 
                      new Date(c.closed_at || '').getMonth() === new Date().getMonth()).length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Click to view closed complaints</p>
                </CardContent>
              </Card>
            </div>

            {/* Summary View - Expandable full-width cards */}
            {showSummaryView && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <LayoutGrid className="h-5 w-5 text-primary" />
                      All Complaints Summary
                      <Badge variant="secondary" className="ml-2">{complaints.length}</Badge>
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowSummaryView(false)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Quick overview of all complaints with key details
                  </p>
                </CardHeader>
                <CardContent>
                  <ComplaintsSummaryView
                    complaints={complaints}
                    onViewDetails={(complaint) => {
                      setSelectedComplaint(complaint as Complaint);
                      setShowDetails(true);
                    }}
                    calculateDaysUntilDeadline={calculateDaysUntilDeadline}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {dashboardFilter === "" && "Recent Activity"}
                    {dashboardFilter === "all" && "Total Complaints"}
                    {dashboardFilter === "open" && "Open Complaints"}
                    {dashboardFilter === "overdue" && "Overdue Complaints"}
                    {dashboardFilter === "closed_this_month" && "Closed This Month"}
                  </CardTitle>
                  {dashboardFilter !== "" && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setDashboardFilter("")}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear filter
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Column headings */}
                <div className="flex items-center justify-between border-b pb-2 mb-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-muted-foreground">Complaint</p>
                  </div>
                  <div className="grid items-center gap-3 grid-cols-[110px_230px_100px_180px_auto] w-[780px]">
                    <div className="text-sm font-semibold text-muted-foreground text-center">Open Date</div>
                    <div className="text-sm font-semibold text-muted-foreground text-center">Practice</div>
                    <div className="text-sm font-semibold text-muted-foreground text-center">Deadline</div>
                    <div className="text-sm font-semibold text-muted-foreground text-center">Status</div>
                    <div className="text-sm font-semibold text-muted-foreground text-center">Actions</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {(() => {
                    const complaintsToShow = dashboardFilter === "" ? complaints.slice(0, 5) : filteredComplaints;
                    const startIndex = (dashboardCurrentPage - 1) * dashboardItemsPerPage;
                    const endIndex = dashboardFilter === "" ? 5 : startIndex + dashboardItemsPerPage;
                    const paginatedComplaints = dashboardFilter === "" 
                      ? complaintsToShow 
                      : complaintsToShow.slice(startIndex, endIndex);
                    
                    return paginatedComplaints.map((complaint) => {
                    const startDate = complaint.submitted_at ?? complaint.created_at;
                    const daysRemaining = startDate ? calculateDaysUntilDeadline(startDate) : null;
                    
                    // For closed complaints, calculate if they were early or late
                    const isClosed = complaint.status === 'closed';
                    let daysEarlyOrLate = null;
                    if (isClosed && complaint.closed_at && startDate) {
                      const submittedDate = new Date(startDate);
                      const closedDate = new Date(complaint.closed_at);
                      const deadline = addWorkingDays(submittedDate, 20);
                      daysEarlyOrLate = calculateWorkingDays(closedDate, deadline);
                    }
                    
                    const getDaysColor = () => {
                      if (isClosed) {
                        return daysEarlyOrLate && daysEarlyOrLate > 0 ? 'bg-green-500' : 'bg-destructive';
                      }
                      if (daysRemaining === null) return 'bg-muted';
                      if (daysRemaining < 0) return 'bg-destructive';
                      if (daysRemaining <= 4) return 'bg-destructive';
                      if (daysRemaining <= 9) return 'bg-amber-500';
                      return 'bg-green-500';
                    };
                    
                    const getDaysText = () => {
                      if (isClosed) {
                        if (daysEarlyOrLate === null) return 'Closed';
                        if (daysEarlyOrLate > 0) return `${daysEarlyOrLate} days early`;
                        if (daysEarlyOrLate < 0) return `${Math.abs(daysEarlyOrLate)} days late`;
                        return 'On time';
                      }
                      if (daysRemaining === null) return 'Not submitted';
                      if (daysRemaining < 0) return `Over target by ${Math.abs(daysRemaining)} days`;
                      if (daysRemaining === 0) return 'Due today';
                      if (daysRemaining === 1) return '1 day left';
                      return `${daysRemaining} days left`;
                    };
                    
                    const getIconOrNumber = () => {
                      if (isClosed) {
                        if (daysEarlyOrLate && daysEarlyOrLate > 0) {
                          return <CheckCircle className="h-7 w-7 shrink-0" />;
                        }
                        if (daysEarlyOrLate && daysEarlyOrLate < 0) {
                          return <XCircle className="h-7 w-7 shrink-0" />;
                        }
                        return <CheckCircle className="h-7 w-7 shrink-0" />;
                      }
                      if (daysRemaining === null) return <div className="text-2xl font-bold h-7 w-7 flex items-center justify-center shrink-0">?</div>;
                      if (daysRemaining >= 0) return <div className="text-2xl font-bold h-7 w-7 flex items-center justify-center shrink-0">{daysRemaining}</div>;
                      return <AlertCircle className="h-7 w-7 shrink-0" />;
                    };

                    return (
                      <div key={complaint.id} className="flex items-center justify-between border-b pb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold">{complaint.reference_number}</p>
                            {isSimulatedComplaint(complaint) && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
                                <FlaskConical className="h-3 w-3 mr-1" />
                                Simulated
                              </Badge>
                            )}
                          </div>
                          <p className="text-base text-muted-foreground">{complaint.complaint_title}</p>
                        </div>
                        <div className="grid items-center gap-3 grid-cols-[110px_230px_100px_180px_auto] w-[780px]">
                          {/* Open Date */}
                          <div className="text-sm text-muted-foreground text-center">
                            {format(new Date(complaint.submitted_at || complaint.created_at), 'do MMM yyyy')}
                          </div>
                          {/* Practice Name */}
                          <div className="text-sm text-muted-foreground text-center truncate px-2">
                            {complaint.gp_practices?.name || 'N/A'}
                          </div>
                          {/* Days remaining indicator */}
                          <div className="flex flex-col items-center w-[100px]">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn(
                                  "relative w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-lg cursor-help",
                                  getDaysColor()
                                )}>
                                  {getIconOrNumber()}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" align="center" className="p-4 max-w-xs z-50">
                                <div className="space-y-2">
                                  <div className="font-semibold text-base border-b pb-2">
                                    {isClosed ? 'Complaint Timeline' : 'Important Dates'}
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="text-xs text-muted-foreground">
                                        {isClosed ? 'Opened' : 'Complaint Opened'}
                                      </div>
                                      <div className="font-medium">{format(new Date(startDate), 'do MMM yyyy')}</div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">
                                          {isClosed ? 'Acknowledgement Letter' : 'Acknowledgement Due'}
                                        </div>
                                        <div className="font-medium">{format(addWorkingDays(new Date(startDate), 3), 'do MMM yyyy')}</div>
                                      </div>
                                      {isClosed && complaint.acknowledged_at && (
                                        <div className="mt-1">
                                          {new Date(complaint.acknowledged_at) <= addWorkingDays(new Date(startDate), 3) ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-destructive" />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <div className="flex-1">
                                        <div className="text-xs text-muted-foreground">
                                          {isClosed ? 'Outcome Letter' : 'Outcome Letter Due'}
                                        </div>
                                        <div className="font-medium">{format(addWorkingDays(new Date(startDate), 20), 'do MMM yyyy')}</div>
                                      </div>
                                      {isClosed && complaint.closed_at && (
                                        <div className="mt-1">
                                          {new Date(complaint.closed_at) <= addWorkingDays(new Date(startDate), 20) ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-destructive" />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {isClosed && complaint.closed_at && (
                                      <div className="pt-2 border-t">
                                        <div className="text-xs text-muted-foreground">Closed</div>
                                        <div className="font-medium">{format(new Date(complaint.closed_at), 'do MMM yyyy')}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            <p className={cn(
                              "text-xs font-medium mt-1 text-center",
                              isClosed ? 
                                (daysEarlyOrLate && daysEarlyOrLate > 0 ? 'text-green-600' : 'text-destructive') :
                                daysRemaining === null ? 'text-muted-foreground' :
                                daysRemaining < 0 ? 'text-destructive' : 
                                daysRemaining <= 4 ? 'text-destructive' :
                                daysRemaining <= 9 ? 'text-amber-600' : 'text-green-600'
                            )}>
                              {getDaysText()}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge className={getStatusColor(complaint.status)}>
                              {complaint.status === 'under_review' && complaint.acknowledged_at ? (
                                <Mail className="h-5 w-5 mr-1" />
                              ) : (
                                getStatusIcon(complaint.status)
                              )}
                              <span className="ml-1">{getStatusDisplayLabel(complaint)}</span>
                            </Badge>
                            {isOverdue(complaint) && (
                              <Badge variant="destructive">Overdue</Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                            if (complaint.status === 'submitted') {
                              console.log('Button clicked but complaint is still being processed');
                              return;
                            }
                            try {
                              await logComplaintViewWithMetadata(complaint.id, 'dashboard_recent_activity');
                            } catch (error) {
                              console.error('Error logging complaint view:', error);
                            }
                            navigate(`/complaints/${complaint.id}`);
                          }}
                          disabled={complaint.status === 'submitted'}
                          className={complaint.status === 'submitted' ? 'opacity-50 cursor-not-allowed' : ''}
                          title={complaint.status === 'submitted' ? 'Generating acknowledgement letter - please wait' : 'View complaint details'}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {complaint.status === 'submitted' ? 'Generating...' : 'View Details'}
                        </Button>
                      </div>
                    </div>
                    );
                  })})()}
                </div>
                
                {/* Pagination for filtered results */}
                {dashboardFilter !== "" && filteredComplaints.length > dashboardItemsPerPage && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDashboardCurrentPage(p => Math.max(1, p - 1))}
                      disabled={dashboardCurrentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {dashboardCurrentPage} of {Math.ceil(filteredComplaints.length / dashboardItemsPerPage)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDashboardCurrentPage(p => Math.min(Math.ceil(filteredComplaints.length / dashboardItemsPerPage), p + 1))}
                      disabled={dashboardCurrentPage >= Math.ceil(filteredComplaints.length / dashboardItemsPerPage)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* View Complaints Tab */}
          <TabsContent value="view" className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Search & Filter Complaints</span>
                  {dashboardFilter !== "all" && (
                    <Badge variant="secondary" className="ml-2">
                      {dashboardFilter === "open" && "Showing Open Complaints"}
                      {dashboardFilter === "overdue" && "Showing Overdue Complaints"}
                      {dashboardFilter === "closed_this_month" && "Showing Closed This Month"}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search complaints..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categoryOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {statusOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All priorities</SelectItem>
                        {priorityOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Outcome</Label>
                    <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
                      <SelectTrigger>
                        <SelectValue placeholder="All outcomes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All outcomes</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="upheld">Upheld</SelectItem>
                        <SelectItem value="rejected">Not Upheld</SelectItem>
                        <SelectItem value="partially_upheld">Partially upheld</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSearchTerm("");
                          setSelectedCategory("all");
                          setSelectedStatus("all");
                          setSelectedPriority("all");
                          setSelectedOutcome("all");
                          setDashboardFilter("all");
                        }}
                      >
                        Clear Filters
                      </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Complaints List */}
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground">Loading complaints...</div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredComplaints.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="text-muted-foreground">No complaints found matching your criteria</div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Active Filter Display */}
                    {dashboardFilter !== "all" && (
                      <Card className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              Showing: {dashboardFilter === "open" && "Open Complaints"}
                              {dashboardFilter === "overdue" && "Overdue Complaints"}
                              {dashboardFilter === "closed_this_month" && "Closed This Month"}
                            </p>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setDashboardFilter("all")}
                            >
                              <X className="h-4 w-4" />
                              Clear Filter
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {paginatedComplaints.map((complaint) => (
                    <Card key={complaint.id} className={cn(
                      "hover:shadow-md transition-shadow",
                      deviceInfo.isIPhone && "touch-manipulation"
                    )}>
                      <CardHeader className={cn(deviceInfo.isIPhone && "pb-3")}>
                        <div className={cn(
                          "flex items-center justify-between",
                          deviceInfo.isIPhone && "flex-col items-start gap-2"
                        )}>
                          <div className={cn(
                            "space-y-1",
                            deviceInfo.isIPhone && "w-full"
                          )}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className={cn(
                                deviceInfo.isIPhone ? "text-base" : "text-lg"
                              )}>{complaint.complaint_title}</CardTitle>
                              {isOverdue(complaint) && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            <CardDescription className={cn(
                              "flex items-center gap-2 flex-wrap",
                              deviceInfo.isIPhone && "text-xs"
                            )}>
                              <span className="whitespace-nowrap"><strong>Ref:</strong> {complaint.reference_number}</span>
                              <span className={cn(deviceInfo.isIPhone && "whitespace-nowrap")}><strong>Patient:</strong> {
                                hasActiveAccess(complaint.id) 
                                  ? complaint.patient_name
                                  : maskPatientData(complaint, { 
                                      showFullData: false, 
                                      roleLevel: getUserRoleLevel(userRole) 
                                    }).name
                              }</span>
                              <span className="whitespace-nowrap"><strong>Date:</strong> {format(new Date(complaint.incident_date), 'dd/MM/yyyy')}</span>
                            </CardDescription>
                          </div>
                          <div className={cn(
                            "flex gap-2",
                            deviceInfo.isIPhone && "w-full flex-wrap"
                          )}>
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                "font-medium text-muted-foreground",
                                deviceInfo.isIPhone ? "text-[10px]" : "text-xs"
                              )}>Priority:</span>
                              <Badge className={getPriorityColor(complaint.priority)}>
                                {getPriorityLabel(complaint.priority)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                "font-medium text-muted-foreground",
                                deviceInfo.isIPhone ? "text-[10px]" : "text-xs"
                              )}>Status:</span>
                              <Badge className={getStatusColor(complaint.status)}>
                                {complaint.status === 'under_review' && complaint.acknowledged_at ? (
                                  <Mail className="h-5 w-5 mr-1" />
                                ) : (
                                  getStatusIcon(complaint.status)
                                )}
                                <span className="ml-1">{getStatusDisplayLabel(complaint)}</span>
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                          <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              <span><strong>Category:</strong> {getCategoryLabel(complaint.category)}</span>
                            </div>
                            {complaint.location_service && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span><strong>Practice:</strong> {complaint.location_service}</span>
                              </div>
                            )}
                            {complaint.response_due_date && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span><strong>Due:</strong> {format(new Date(complaint.response_due_date), 'dd/MM/yyyy')}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Days until deadline */}
                          {(() => {
                            const startDate = complaint.submitted_at ?? complaint.created_at;
                            const daysRemaining = startDate ? calculateDaysUntilDeadline(startDate) : null;
                            console.log(`Days calculation for ${complaint.reference_number}:`, {
                              startDate,
                              submitted_at: complaint.submitted_at,
                              created_at: complaint.created_at,
                              status: complaint.status,
                              daysRemaining
                            });
                            
                            if (daysRemaining !== null) {
                              const isUrgent = daysRemaining <= 5;
                              const isOverdue = daysRemaining < 0;
                              const isClosed = complaint.status === 'closed';
                              
                              return (
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className={cn(
                                    "h-4 w-4",
                                    isOverdue && !isClosed ? "text-destructive" : isUrgent && !isClosed ? "text-orange-500" : "text-muted-foreground"
                                  )} />
                                  <span className={cn(
                                    isOverdue && !isClosed && "text-destructive font-semibold",
                                    isUrgent && !isOverdue && !isClosed && "text-orange-500 font-medium"
                                  )}>
                                    <strong>Days to close:</strong> {
                                      isClosed
                                        ? 'Closed'
                                        : isOverdue 
                                        ? `${Math.abs(daysRemaining)} working days overdue`
                                        : `${daysRemaining} working days remaining`
                                    }
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {complaint.complaint_description}
                          </p>
                          
                          {complaint.staff_mentioned && complaint.staff_mentioned.length > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span><strong>Staff mentioned:</strong> {complaint.staff_mentioned.join(', ')}</span>
                            </div>
                          )}
                          
                          {/* Outcome Status */}
                          <div className="flex items-center gap-2 text-sm">
                            <span><strong>Outcome Status:</strong></span>
                            {lettersStatus[complaint.id]?.hasOutcome ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                {lettersStatus[complaint.id]?.outcomeType ? 
                                  (lettersStatus[complaint.id].outcomeType === 'rejected' ? 'Not Upheld' :
                                   lettersStatus[complaint.id].outcomeType.charAt(0).toUpperCase() + 
                                   lettersStatus[complaint.id].outcomeType.slice(1).replace('_', ' '))
                                  : 'Completed'}
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                In Progress
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={async () => {
                                if (complaint.status === 'submitted') {
                                  console.log('Button clicked but complaint is still being processed');
                                  return;
                                }
                                try {
                                  await logComplaintViewWithMetadata(complaint.id, 'complaints_list_view');
                                } catch (error) {
                                  console.error('Error logging complaint view:', error);
                                }
                                navigate(`/complaints/${complaint.id}`);
                              }}
                              disabled={complaint.status === 'submitted'}
                              className={complaint.status === 'submitted' ? 'opacity-50 cursor-not-allowed' : ''}
                              title={complaint.status === 'submitted' ? 'Generating acknowledgement letter - please wait' : 'View complaint details'}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {complaint.status === 'submitted' ? 'Generating...' : 'View Details'}
                            </Button>
                            
                            {lettersStatus[complaint.id]?.hasAcknowledgement ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => viewLetter(complaint, 'acknowledgement')}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                View Acknowledgement
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleGenerateAcknowledgement(complaint.id)}
                                disabled={submitting || complaint.status !== 'submitted'}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Generate Acknowledgement
                              </Button>
                            )}
                            
                            {lettersStatus[complaint.id]?.hasOutcome ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  console.log('Outcome button clicked for', complaint.reference_number);
                                  viewLetter(complaint, 'outcome');
                                }}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                View Outcome Letter
                              </Button>
                             ) : (
                               <div className="text-xs text-muted-foreground">
                                 No outcome letter available
                               </div>
                             )}
                             
                             {/* Delete Button */}
                             <Button 
                               size="sm" 
                               variant="outline"
                               onClick={() => handleDeleteComplaint(complaint)}
                               className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                             >
                               <Trash2 className="h-4 w-4 mr-1" />
                               Delete
                             </Button>
                             
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-center mt-6">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                                }}
                                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                            
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              
                              return (
                                <PaginationItem key={pageNum}>
                                  <PaginationLink
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setCurrentPage(pageNum);
                                    }}
                                    isActive={currentPage === pageNum}
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            })}
                            
                            {totalPages > 5 && currentPage < totalPages - 2 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            
                            <PaginationItem>
                              <PaginationNext 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                                }}
                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* New Complaint Tab */}
          <TabsContent value="new" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">Submit New Complaint</CardTitle>
                    <CardDescription className="text-sm">
                      <span className="hidden sm:inline">Record a new patient complaint following NHS procedures</span>
                      <span className="sm:hidden">Record new patient complaint</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPatientImportModal(true)}
                      className="flex items-center gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="hidden sm:inline">Import Patient Details</span>
                      <span className="sm:hidden">Patient</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowImportModal(true)}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="hidden sm:inline">Import Complaint Data</span>
                      <span className="sm:hidden">Complaint</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <form onSubmit={handleSubmitComplaint} className="space-y-4 sm:space-y-6">
                  {/* Patient Information Section */}
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 sm:h-5 sm:w-5" />
                      Patient Information
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="patient_name" className="text-sm">Patient Name *</Label>
                        <Input 
                          id="patient_name" 
                          value={formData.patient_name}
                          onChange={(e) => handleInputChange('patient_name', e.target.value)}
                          placeholder="Enter patient's full name"
                          className="min-h-[44px] touch-manipulation"
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient_dob" className="text-sm">Date of Birth</Label>
                        <Input 
                          id="patient_dob" 
                          type="date"
                          value={formData.patient_dob}
                          onChange={(e) => handleInputChange('patient_dob', e.target.value)}
                          className="min-h-[44px] touch-manipulation"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="patient_contact_phone" className="text-sm">Contact Phone</Label>
                        <Input 
                          id="patient_contact_phone" 
                          value={formData.patient_contact_phone}
                          onChange={(e) => handleInputChange('patient_contact_phone', e.target.value)}
                          placeholder="Phone number"
                          className="min-h-[44px] touch-manipulation"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient_contact_email" className="text-sm">Contact Email</Label>
                        <Input 
                          id="patient_contact_email" 
                          type="email"
                          value={formData.patient_contact_email}
                          onChange={(e) => handleInputChange('patient_contact_email', e.target.value)}
                          placeholder="Email address"
                          className="min-h-[44px] touch-manipulation"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="patient_address">Patient Address</Label>
                      <Textarea 
                        id="patient_address" 
                        value={formData.patient_address}
                        onChange={(e) => handleInputChange('patient_address', e.target.value)}
                        placeholder="Full address including postcode"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Complaint Details Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Complaint Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="incident_date">Date of Incident *</Label>
                        <Input 
                          id="incident_date" 
                          type="date"
                          value={formData.incident_date}
                          onChange={(e) => handleInputChange('incident_date', e.target.value)}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select 
                          value={formData.category} 
                          onValueChange={(value) => handleInputChange('category', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select 
                          value={formData.priority} 
                          onValueChange={(value) => handleInputChange('priority', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="complaint_title">Complaint Title *</Label>
                      <Input 
                        id="complaint_title" 
                        value={formData.complaint_title}
                        onChange={(e) => handleInputChange('complaint_title', e.target.value)}
                        placeholder="Brief summary of the complaint" 
                        required 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="complaint_description">Detailed Description *</Label>
                      <Textarea 
                        id="complaint_description" 
                        value={formData.complaint_description}
                        onChange={(e) => handleInputChange('complaint_description', e.target.value)}
                        placeholder="Provide detailed information about the complaint including what happened, when, where, and how it affected the patient..."
                        rows={6}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location_service">Location/Service</Label>
                        <Input 
                          id="location_service" 
                          value={formData.location_service}
                          onChange={(e) => handleInputChange('location_service', e.target.value)}
                          placeholder="e.g., Reception, GP Consultation Room 1" 
                        />
                      </div>
                        <div className="space-y-2">
                          <Label htmlFor="staff_mentioned">Staff Members Mentioned</Label>
                          <div className="space-y-2">
                            <Input 
                              id="staff_mentioned" 
                              value={formData.staff_mentioned}
                              onChange={(e) => handleInputChange('staff_mentioned', e.target.value)}
                              placeholder="e.g. Receptionist, Practice Nurse, Dr Smith" 
                            />
                            <div className="flex flex-wrap gap-2">
                              {['Receptionist', 'Practice Manager', 'Practice Nurse', 'Administrative Staff', 'Healthcare Assistant'].map(role => (
                                <Button
                                  key={role}
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  onClick={() => {
                                    const current = formData.staff_mentioned;
                                    const roles = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];
                                    if (!roles.includes(role)) {
                                      const newValue = roles.length > 0 ? `${current}, ${role}` : role;
                                      handleInputChange('staff_mentioned', newValue);
                                    }
                                  }}
                                  className="text-xs"
                                >
                                  + {role}
                                </Button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Click quick-add buttons above or type staff names separated by commas. Email addresses will be auto-populated to malcolm.railson@nhs.net for Oak Lane Medical Practice staff.
                            </p>
                          </div>
                        </div>
                    </div>
                  </div>

                  {/* Consent and Legal Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Consent & Legal Requirements</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-start space-x-2">
                        <input
                          type="checkbox"
                          id="complaint_on_behalf"
                          checked={formData.complaint_on_behalf}
                          onChange={(e) => handleInputChange('complaint_on_behalf', e.target.checked)}
                          className="mt-1"
                        />
                        <Label htmlFor="complaint_on_behalf" className="text-sm">
                          This complaint is being made on behalf of someone else
                        </Label>
                      </div>

                      <div className="flex items-start space-x-2">
                        <input
                          type="checkbox"
                          id="consent_given"
                          checked={formData.consent_given}
                          onChange={(e) => handleInputChange('consent_given', e.target.checked)}
                          className="mt-1"
                        />
                        <Label htmlFor="consent_given" className="text-sm">
                          Consent obtained for processing this complaint
                        </Label>
                      </div>

                      {formData.complaint_on_behalf && (
                        <div className="space-y-2">
                          <Label htmlFor="consent_details">Consent Details</Label>
                          <Textarea 
                            id="consent_details" 
                            value={formData.consent_details}
                            onChange={(e) => handleInputChange('consent_details', e.target.value)}
                            placeholder="Please provide details of consent obtained to make this complaint on behalf of the patient"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "pt-4",
                    deviceInfo.isIPhone ? "flex flex-col gap-3" : "flex gap-4"
                  )}>
                    <Button 
                      type="submit" 
                      disabled={submitting}
                      className={cn(
                        deviceInfo.isIPhone && "w-full min-h-[48px] text-base"
                      )}
                    >
                      {submitting ? "Submitting..." : "Submit Complaint"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      className={cn(
                        deviceInfo.isIPhone && "w-full min-h-[48px]"
                      )}
                    >
                      Save as Draft
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      className={cn(
                        deviceInfo.isIPhone && "w-full min-h-[48px]"
                      )}
                      onClick={() => setFormData({
                        patient_name: "",
                        patient_dob: "",
                        patient_contact_phone: "",
                        patient_contact_email: "",
                        patient_address: "",
                        incident_date: "",
                        complaint_title: "",
                        complaint_description: "",
                        category: "",
                        location_service: "",
                        staff_mentioned: "",
                        priority: "medium",
                        consent_given: false,
                        consent_details: "",
                        complaint_on_behalf: false,
                      })}
                    >
                      Clear Form
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <HierarchicalReports />
          </TabsContent>


          {/* Practice & Signatures Tab */}
          <TabsContent value="settings">
            <div className="space-y-6">
               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Signature Settings for Complaint Letters
                  </CardTitle>
                  <CardDescription>
                    Configure your signature details, practice branding, and letter templates for acknowledgement and outcome letters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ComplaintSignatureSettings />
                </CardContent>
              </Card>

              
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Document Formatting
                  </CardTitle>
                  <CardDescription>
                    Practice logos and footer details for complaint documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Automatic Integration</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Your practice logos and footer details from the Practice Management section above will automatically be included in:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Acknowledgement letters (practice logo and contact details)</li>
                        <li>• Outcome letters (practice footer and signature)</li>
                        <li>• Word document exports with proper formatting</li>
                        <li>• PDF exports with logo placement</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 border rounded-lg bg-accent/50">
                      <h4 className="font-medium mb-2">Best Practices</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Upload logos in PNG format with transparent backgrounds</li>
                        <li>• Keep logo files under 1MB for best performance</li>
                        <li>• Include complete contact details in practice settings</li>
                        <li>• Set one practice as default for automatic selection</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Complaint Workflow Management Modal */}
        {showDetails && selectedComplaint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Complaint Workflow Management</h2>
                  <Button 
                    variant="outline" 
                     onClick={() => {
                       setShowDetails(false);
                       setSelectedComplaint(null);
                       setInvolvedParties([]);
                       setOutcomeType('');
                       setOutcomeSummary('');
                       setAiAnalysis('');
                       setComplianceChecks([]);
                       setComplianceSummary(null);
                       setActiveTab('workflow');
                       setAuditLogs([]);
                       setComplianceAuditLogs([]);
                     }}
                  >
                    Close
                  </Button>
                </div>

                {/* Complaint Header */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {selectedComplaint.reference_number} - {selectedComplaint.complaint_title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Patient:</strong> {selectedComplaint.patient_name}</div>
                      <div><strong>Category:</strong> {getCategoryLabel(selectedComplaint.category)}</div>
                      <div><strong>Priority:</strong> {getPriorityLabel(selectedComplaint.priority)}</div>
                      <div><strong>Status:</strong> {getStatusLabel(selectedComplaint.status)}</div>
                      <div><strong>Incident Date:</strong> {format(new Date(selectedComplaint.incident_date), 'dd/MM/yyyy')}</div>
                      {selectedComplaint.response_due_date && (
                        <div><strong>Due Date:</strong> {format(new Date(selectedComplaint.response_due_date), 'dd/MM/yyyy')}</div>
                      )}
                    </div>
                    <div className="mt-4">
                      <strong>Description:</strong>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedComplaint.complaint_description}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Complaint Workflow Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 gap-1 h-auto p-1">
                    <TabsTrigger value="workflow" className="flex items-center gap-1 min-h-[44px] text-xs sm:text-sm touch-manipulation">
                      <FileText className="h-4 w-4" />
                      <span>Workflow</span>
                    </TabsTrigger>
                    <TabsTrigger value="compliance" className="flex items-center gap-1 min-h-[44px] text-xs sm:text-sm touch-manipulation">
                      <Shield className="h-4 w-4" />
                      <span>Compliance</span>
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="flex items-center gap-1 min-h-[44px] text-xs sm:text-sm touch-manipulation">
                      <Clock className="h-4 w-4" />
                      <span className="hidden sm:inline">Audit Log</span>
                      <span className="sm:hidden">Audit</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Workflow Tab */}
                  <TabsContent value="workflow" className="space-y-6">
                    {/* Workflow content starts here */}

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
                          onClick={() => handleGenerateAcknowledgement(selectedComplaint.id)}
                          disabled={submitting}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          {submitting ? 'Generating...' : 'Generate Acknowledgement Letter'}
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Badge variant="default">Letter Generated</Badge>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAcknowledgementLetter(!showAcknowledgementLetter)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Letter
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const doc = await createLetterDocument(
                                      acknowledgementLetter,
                                      'acknowledgement',
                                      selectedComplaint.reference_number
                                    );
                                    
                                    const blob = await Packer.toBlob(doc);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `acknowledgement-letter-${selectedComplaint.reference_number}.docx`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    showToast.success('Letter downloaded successfully', { section: 'complaints' });
                                  } catch (error) {
                                    console.error('Error downloading letter:', error);
                                    showToast.error('Failed to download letter', { section: 'complaints' });
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateAcknowledgement(selectedComplaint.id)}
                                disabled={submitting}
                              >
                                {submitting ? 'Regenerating...' : 'Regenerate Letter'}
                              </Button>
                            </div>
                          </div>
                          {showAcknowledgementLetter && (
                            <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                              <pre className="whitespace-pre-wrap text-sm">{acknowledgementLetter}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Legacy Acknowledgement Letter Section - Remove this */}
                  {false && acknowledgementLetter && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Acknowledgement Letter
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAcknowledgementLetter(!showAcknowledgementLetter)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {showAcknowledgementLetter ? 'Hide' : 'View'} Letter
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      {showAcknowledgementLetter && (
                        <CardContent>
                          <div className="border rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-sm">{acknowledgementLetter}</pre>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            This acknowledgement letter was sent to confirm receipt of the complaint and outline next steps.
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* AI Outcome Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          AI Outcome Analysis
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleAnalyzeOutcome(selectedComplaint.id)}
                          disabled={submitting}
                        >
                          {submitting ? 'Analyzing...' : 'Get AI Recommendation'}
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {aiAnalysis ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <pre className="text-sm whitespace-pre-wrap text-foreground">{aiAnalysis}</pre>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            This analysis is based on NHS standards, CQC requirements, and professional medical guidelines. 
                            It should be reviewed by qualified staff before making final decisions.
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Click "Get AI Recommendation" to analyze this complaint and receive outcome suggestions with detailed reasoning.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Staff Notifications Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Staff Notifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Add Staff Members to Notify</Label>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                          <Input
                            placeholder="Staff name"
                            value={newParty.staffName}
                            onChange={(e) => setNewParty(prev => ({...prev, staffName: e.target.value}))}
                          />
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={newParty.staffEmail}
                            onChange={(e) => setNewParty(prev => ({...prev, staffEmail: e.target.value}))}
                          />
                          <Input
                            placeholder="Role (optional)"
                            value={newParty.staffRole}
                            onChange={(e) => setNewParty(prev => ({...prev, staffRole: e.target.value}))}
                          />
                          <Button onClick={addInvolvedParty} size="sm" className="min-h-[44px] touch-manipulation">
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>

                      {involvedParties.length > 0 && (
                        <div>
                          <Label className="text-sm font-medium">Staff to be notified:</Label>
                           <div className="space-y-2 mt-2">
                             {involvedParties.map((party, index) => (
                               <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                 <div className="text-sm">
                                   <strong>{party.staffName}</strong> ({party.staffEmail})
                                   {party.staffRole && ` - ${party.staffRole}`}
                                 </div>
                                 <div className="flex gap-2">
                                   <Button 
                                     size="sm" 
                                     variant="default"
                                     onClick={() => {
                                       const feedbackUrl = `/staff-feedback?complaintId=${selectedComplaint.id}&staffName=${encodeURIComponent(party.staffName)}&staffEmail=${encodeURIComponent(party.staffEmail)}&staffRole=${encodeURIComponent(party.staffRole || '')}`;
                                       window.open(feedbackUrl, '_blank');
                                     }}
                                   >
                                     <Eye className="h-4 w-4 mr-1" />
                                     Respond
                                   </Button>
                                   <Button 
                                     size="sm" 
                                     variant="outline" 
                                     onClick={() => removeInvolvedParty(index)}
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </div>
                               </div>
                             ))}
                          </div>
                          <Button 
                            onClick={() => handleSendStaffNotifications(selectedComplaint.id)}
                            disabled={submitting}
                            className="mt-3"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {submitting ? 'Sending...' : 'Send Notifications'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Outcome Decision Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Complaint Outcome
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Outcome Decision</Label>
                          <Select value={outcomeType} onValueChange={setOutcomeType}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select outcome" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rejected">Complaint Rejected</SelectItem>
                              <SelectItem value="upheld">Complaint Upheld</SelectItem>
                              <SelectItem value="partially_upheld">Partially upheld</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Outcome Summary</Label>
                        <Textarea
                          placeholder="Provide a summary of the investigation findings and decision rationale..."
                          value={outcomeSummary}
                          onChange={(e) => setOutcomeSummary(e.target.value)}
                          rows={4}
                        />
                      </div>

                      {/* Show existing outcome letter if it exists */}
                      {existingOutcome && outcomeLetter && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Final Outcome Letter</Label>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowOutcomeLetter(!showOutcomeLetter)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {showOutcomeLetter ? 'Hide' : 'View'} Letter
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingOutcome(!editingOutcome)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                {editingOutcome ? 'Cancel' : 'Edit'}
                              </Button>
                            </div>
                          </div>
                          
                          {showOutcomeLetter && (
                            <div className="border rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
                              {editingOutcome ? (
                                <div className="space-y-4">
                                  <Textarea
                                    value={outcomeLetter}
                                    onChange={(e) => setOutcomeLetter(e.target.value)}
                                    rows={12}
                                    className="w-full"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={handleSaveOutcomeLetter}
                                      disabled={submitting}
                                    >
                                      <Save className="h-4 w-4 mr-1" />
                                      {submitting ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingOutcome(false)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <pre className="whitespace-pre-wrap text-sm">{outcomeLetter}</pre>
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    This is the final outcome letter that will be sent to the patient explaining the decision.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show existing outcome letter if it exists */}
                      {existingOutcome && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Generated Outcome Letter</Label>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowOutcomeLetter(!showOutcomeLetter)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Letter
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const letterDetails = await fetchLetterDetails();
                                    const doc = await createLetterDocument(
                                      outcomeLetter,
                                      'outcome',
                                      selectedComplaint.reference_number,
                                      letterDetails.signatoryName,
                                      letterDetails.practiceDetails
                                    );
                                    
                                    const blob = await Packer.toBlob(doc);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `outcome-letter-${selectedComplaint.reference_number}.docx`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    showToast.success('Letter downloaded successfully', { section: 'complaints' });
                                  } catch (error) {
                                    console.error('Error downloading letter:', error);
                                    showToast.error('Failed to download letter', { section: 'complaints' });
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateOutcomeLetter(selectedComplaint.id)}
                                disabled={submitting}
                              >
                                Regenerate Letter
                              </Button>
                            </div>
                          </div>
                          
                          {showOutcomeLetter && (
                            <div className="border rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
                              {editingOutcome ? (
                                <div className="space-y-4">
                                  <Textarea
                                    value={outcomeLetter}
                                    onChange={(e) => setOutcomeLetter(e.target.value)}
                                    rows={12}
                                    className="w-full"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={handleSaveOutcomeLetter}
                                      disabled={submitting}
                                    >
                                      <Save className="h-4 w-4 mr-1" />
                                      {submitting ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingOutcome(false)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <pre className="whitespace-pre-wrap text-sm">{outcomeLetter}</pre>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <Button 
                        onClick={() => handleGenerateOutcomeLetter(selectedComplaint.id)}
                        disabled={submitting || !outcomeType || !outcomeSummary}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {submitting ? 'Generating...' : existingOutcome ? 'Regenerate Outcome Letter' : 'Generate Outcome Letter & Close Complaint'}
                      </Button>
                    </CardContent>
                  </Card>
                  </TabsContent>

                  {/* Compliance Tab */}
                  <TabsContent value="compliance" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          NHS Compliance Checklist
                          {complianceSummary && (
                            <Badge variant={complianceSummary.compliance_percentage >= 100 ? "default" : "secondary"}>
                              {complianceSummary.compliance_percentage}% Complete
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Ensure your complaint handling meets NHS England standards and CQC requirements
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {complianceSummary && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm text-muted-foreground">
                              <strong>Progress:</strong> {complianceChecks && complianceChecks.length > 0 ? (() => {
                                const keys = new Set(complianceChecks.map(c => (c.compliance_item || '').trim().toLowerCase()));
                                const map = new Map<string, boolean>();
                                for (const c of complianceChecks) {
                                  const k = (c.compliance_item || '').trim().toLowerCase();
                                  map.set(k, (map.get(k) || false) || !!c.is_compliant);
                                }
                                const completed = Array.from(map.values()).filter(Boolean).length;
                                const total = keys.size;
                                return <>{completed} of {total} items completed</>;
                              })() : <>{complianceSummary.compliant_items} of {complianceSummary.total_items} items completed</>}
                              {complianceSummary.outstanding_items && complianceSummary.outstanding_items.length > 0 && (
                                <div className="mt-2">
                                  <strong>Outstanding items:</strong>
                                  <ul className="list-disc list-inside mt-1">
                                    {complianceSummary.outstanding_items.slice(0, 3).map((item, index) => (
                                      <li key={index} className="text-xs">{item}</li>
                                    ))}
                                    {complianceSummary.outstanding_items.length > 3 && (
                                      <li className="text-xs">...and {complianceSummary.outstanding_items.length - 3} more</li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedComplaint && complianceChecks && new Set(complianceChecks.map(c => (c.compliance_item || '').trim().toLowerCase())).size < complianceChecks.length && (
                          <div className="mb-4">
                            <ComplianceCheckCleanupButton 
                              complaintId={selectedComplaint.id} 
                              onCleanupComplete={() => fetchComplianceData(selectedComplaint.id)}
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
                                }
                              }
                            });
                            
                            return Array.from(uniqueChecksMap.values());
                          })().map((check) => (
                            <div key={check.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={check.is_compliant}
                                    onChange={(e) => {
                                      updateComplianceCheck(check.id, e.target.checked);
                                    }}
                                    className="rounded cursor-pointer"
                                  />
                                  <span className={`text-sm font-medium ${
                                    check.is_compliant ? 'line-through text-muted-foreground' : 'text-foreground'
                                  }`}>
                                    {check.compliance_item}
                                  </span>
                                  {check.is_compliant && (
                                    <Badge variant="default" className="ml-auto">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Complete
                                    </Badge>
                                  )}
                                </div>
                                {check.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 ml-6">{check.notes}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>CQC/ICB Compliance:</strong> This checklist ensures your complaint handling follows NHS England procedures, 
                            CQC regulations, and demonstrates good governance for inspection purposes.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Audit Log Tab */}
                  <TabsContent value="audit" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Complaint Audit Log</CardTitle>
                        <CardDescription>
                          Complete audit trail for this complaint: {selectedComplaint.reference_number}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Search and filters */}
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Input
                              placeholder="Search audit logs..."
                              value={auditSearchTerm}
                              onChange={(e) => setAuditSearchTerm(e.target.value)}
                            />
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => exportAuditToWord()}
                            disabled={auditLoading}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export to Word
                          </Button>
                        </div>

                        {/* Audit logs display */}
                        {auditLoading ? (
                          <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-2 text-muted-foreground">Loading audit logs...</p>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-3">
                              {paginatedAuditLogs.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                  <p>No audit logs found for this complaint</p>
                                </div>
                              ) : (
                                <>
                                  {/* Results summary */}
                                  <div className="text-sm text-muted-foreground">
                                    Showing {auditStartIndex + 1}-{Math.min(auditEndIndex, filteredAuditLogs.length)} of {filteredAuditLogs.length} records
                                    {filteredAuditLogs.length > maxDisplayableRecords && (
                                      <span className="ml-2 text-amber-600">
                                        (Limited to first {maxDisplayableRecords} records)
                                      </span>
                                    )}
                                  </div>

                                  {paginatedAuditLogs.map((log) => (
                                    <div key={`${log.id}-${log.created_at}`} className="border rounded-lg p-3 bg-gray-50">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant={
                                              log.action_type === 'create' ? 'default' :
                                              log.action_type === 'status_change' ? 'secondary' :
                                              log.action_type === 'compliance_change' ? 'outline' :
                                              'secondary'
                                            }>
                                              {log.action_type?.replace('_', ' ').toUpperCase() || 'ACTION'}
                                            </Badge>
                                            <span className="text-sm font-medium">
                                              {log.profiles?.full_name || log.user_email || 'System User'}
                                            </span>
                                          </div>
                                          <p className="text-sm text-muted-foreground mb-2">
                                            {log.action_description || log.compliance_item}
                                          </p>
                                          
                                          {/* Display context for VIEW actions */}
                                          {log.action_type === 'VIEW' && log.new_values?.contexts && (
                                            <div className="text-xs text-muted-foreground mb-2">
                                              <span className="font-medium">Tabs viewed: </span>
                                              {log.new_values.contexts.map((ctx: string) => 
                                                ctx.replace(/_/g, ' ').replace(/complaint|details|page/gi, '').trim()
                                              ).filter(Boolean).join(', ') || 'Details page'}
                                            </div>
                                          )}
                                          
                                          {/* Display old and new values if available (excluding VIEW contexts) */}
                                          {((log.old_values && Object.keys(log.old_values).length > 0) || 
                                            (log.new_values && log.action_type !== 'VIEW' && Object.keys(log.new_values).length > 0)) && (
                                            <div className="text-xs text-muted-foreground">
                                              {log.old_values && Object.keys(log.old_values).length > 0 && (
                                                <div>Previous: {JSON.stringify(log.old_values)}</div>
                                              )}
                                              {log.new_values && log.action_type !== 'VIEW' && Object.keys(log.new_values).length > 0 && (
                                                <div>New: {JSON.stringify(log.new_values)}</div>
                                              )}
                                              {log.previous_status !== undefined && log.new_status !== undefined && (
                                                <div>Changed from {log.previous_status ? 'Complete' : 'Incomplete'} to {log.new_status ? 'Complete' : 'Incomplete'}</div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground text-right">
                                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Pagination Controls */}
                                  {totalAuditPages > 1 && (
                                    <Pagination className="mt-4">
                                      <PaginationContent>
                                        <PaginationItem>
                                          <PaginationPrevious 
                                            onClick={() => setAuditCurrentPage(prev => Math.max(1, prev - 1))}
                                            className={auditCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                          />
                                        </PaginationItem>
                                        
                                        {/* First page */}
                                        {auditCurrentPage > 3 && (
                                          <>
                                            <PaginationItem>
                                              <PaginationLink onClick={() => setAuditCurrentPage(1)} className="cursor-pointer">
                                                1
                                              </PaginationLink>
                                            </PaginationItem>
                                            <PaginationItem>
                                              <PaginationEllipsis />
                                            </PaginationItem>
                                          </>
                                        )}
                                        
                                        {/* Current page and surrounding pages */}
                                        {Array.from({ length: totalAuditPages }, (_, i) => i + 1)
                                          .filter(page => {
                                            return page === auditCurrentPage || 
                                                   page === auditCurrentPage - 1 || 
                                                   page === auditCurrentPage + 1 ||
                                                   (page === 1 && auditCurrentPage <= 3) ||
                                                   (page === 2 && auditCurrentPage <= 3) ||
                                                   (page === totalAuditPages && auditCurrentPage >= totalAuditPages - 2) ||
                                                   (page === totalAuditPages - 1 && auditCurrentPage >= totalAuditPages - 2);
                                          })
                                          .map(page => (
                                            <PaginationItem key={page}>
                                              <PaginationLink
                                                onClick={() => setAuditCurrentPage(page)}
                                                isActive={auditCurrentPage === page}
                                                className="cursor-pointer"
                                              >
                                                {page}
                                              </PaginationLink>
                                            </PaginationItem>
                                          ))}
                                        
                                        {/* Last page */}
                                        {auditCurrentPage < totalAuditPages - 2 && (
                                          <>
                                            <PaginationItem>
                                              <PaginationEllipsis />
                                            </PaginationItem>
                                            <PaginationItem>
                                              <PaginationLink onClick={() => setAuditCurrentPage(totalAuditPages)} className="cursor-pointer">
                                                {totalAuditPages}
                                              </PaginationLink>
                                            </PaginationItem>
                                          </>
                                        )}
                                        
                                        <PaginationItem>
                                          <PaginationNext 
                                            onClick={() => setAuditCurrentPage(prev => Math.min(totalAuditPages, prev + 1))}
                                            className={auditCurrentPage === totalAuditPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                          />
                                        </PaginationItem>
                                      </PaginationContent>
                                    </Pagination>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
          )}
        
          {/* Patient Data Disclosure Dialog */}
          {showDisclosureDialog && pendingAccess && (
            <PatientDataDisclosureWarning
              isOpen={showDisclosureDialog}
              onClose={() => setShowDisclosureDialog(false)}
              onApprove={() => approveAccess('Complaint investigation', 'NHS complaint handling')}
              patientReference={pendingAccess.patientName.charAt(0) + '***'}
              complaintReference={pendingAccess.complaintReference}
              userRole={userRole || 'standard'}
            />
          )}

          {/* Success Modal */}
         <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
           <DialogContent className="sm:max-w-2xl p-8">
             <DialogHeader className="space-y-2">
               <DialogTitle className="flex items-center gap-2 text-xl">
                 <CheckCircle className="h-6 w-6 text-green-600" />
                 New Complaint Created
               </DialogTitle>
               <DialogDescription className="text-base px-2">
                 Your complaint has been successfully submitted and assigned reference number:
               </DialogDescription>
             </DialogHeader>
             <div className="flex flex-col space-y-4 py-4 px-4">
               <div className="text-center">
                 <div className="text-3xl font-bold text-primary tracking-wide mb-2">
                   {newComplaintRef}
                 </div>
               </div>

               {newComplaintData && (
                 <div className="space-y-3">
                   <div>
                     <h4 className="text-sm font-semibold text-muted-foreground mb-1">Complaint Title</h4>
                     <p className="text-sm font-medium mb-3">{newComplaintData.title}</p>
                   </div>
                   <div className="bg-muted/50 rounded-lg p-4">
                     <div>
                       <h4 className="text-sm font-semibold text-muted-foreground mb-2">Brief Summary</h4>
                       <p className="text-sm line-clamp-6 leading-relaxed">{newComplaintData.description}</p>
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-900">
                       <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Acknowledgement Due By</h4>
                       <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                         {(() => {
                           const createdDate = new Date(newComplaintData.created_at);
                           const dueDate = new Date(createdDate);
                           dueDate.setDate(dueDate.getDate() + 3);
                           return dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                         })()}
                       </p>
                       <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">3 working days</p>
                     </div>

                     <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-900">
                       <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Outcome Deadline</h4>
                       <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                         {(() => {
                           const createdDate = new Date(newComplaintData.created_at);
                           const deadlineDate = new Date(createdDate);
                           deadlineDate.setDate(deadlineDate.getDate() + 20);
                           return deadlineDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                         })()}
                       </p>
                       <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">20 working days</p>
                     </div>
                   </div>
                 </div>
               )}

               <Button 
                 onClick={() => {
                   setShowSuccessModal(false);
                   setCurrentTab("dashboard");
                 }}
                 className="w-full mt-2"
                 size="lg"
               >
                 Go to Dashboard
               </Button>
             </div>
           </DialogContent>
         </Dialog>
       </div>
         {/* Letter Viewing Modal */}
        {(() => {
          console.log('Modal render check:', { 
            showLetterModal, 
            viewingLetterComplaint: !!viewingLetterComplaint,
            modalLetterContent: modalLetterContent?.substring(0, 50) + '...' 
          });
          return showLetterModal && viewingLetterComplaint;
        })() && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-xl font-semibold">
                    {letterType === 'acknowledgement' ? 'Acknowledgement Letter' : 'Outcome Letter'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {viewingLetterComplaint.reference_number} - {viewingLetterComplaint.complaint_title}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowLetterModal(false);
                    setViewingLetterComplaint(null);
                    setModalLetterContent('');
                    setIsEditingLetter(false);
                    setEditedLetterContent('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="border rounded-lg p-8 bg-white shadow-sm">
                  {isEditingLetter ? (
                    <div className="space-y-4">
                      <Label htmlFor="edit-letter">Edit Letter Content</Label>
                      <Textarea
                        id="edit-letter"
                        value={editedLetterContent}
                        onChange={(e) => setEditedLetterContent(e.target.value)}
                        className="min-h-[600px] font-mono text-sm"
                        placeholder="Edit the letter content..."
                      />
                    </div>
                  ) : (
                    <FormattedLetterContent content={modalLetterContent} />
                  )}
                </div>
                <div className="mt-6 flex justify-between">
                  <div className="flex gap-3">
                    {isEditingLetter ? (
                      <>
                        <Button 
                          onClick={() => {
                            setModalLetterContent(editedLetterContent);
                            setIsEditingLetter(false);
                            showToast.success('Letter updated successfully', { section: 'complaints' });
                          }}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditedLetterContent(modalLetterContent);
                            setIsEditingLetter(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setEditedLetterContent(modalLetterContent);
                          setIsEditingLetter(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Letter
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(isEditingLetter ? editedLetterContent : modalLetterContent);
                        showToast.success('Letter copied to clipboard', { section: 'complaints' });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const contentToDownload = isEditingLetter ? editedLetterContent : modalLetterContent;
                          const letterDetails = await fetchLetterDetails();
                          const doc = await createLetterDocument(
                            contentToDownload,
                            letterType,
                            viewingLetterComplaint.reference_number,
                            letterDetails.signatoryName,
                            letterDetails.practiceDetails
                          );
                          
                          const blob = await Packer.toBlob(doc);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${letterType}-letter-${viewingLetterComplaint.reference_number}.docx`;
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast.success('Letter downloaded successfully', { section: 'complaints' });
                        } catch (error) {
                          console.error('Error generating DOCX:', error);
                          showToast.error('Failed to generate document', { section: 'complaints' });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download DOCX
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the complaint and all associated data.
              </DialogDescription>
            </DialogHeader>
            
            {complaintToDelete && (
              <div className="py-4">
                <div className="space-y-2 text-sm">
                  <div><strong>Reference:</strong> {complaintToDelete.reference_number}</div>
                  <div><strong>Patient:</strong> {complaintToDelete.patient_name}</div>
                  <div><strong>Title:</strong> {complaintToDelete.complaint_title}</div>
                  <div><strong>Status:</strong> {complaintToDelete.status}</div>
                </div>
                
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive font-medium">
                    Warning: This will permanently delete:
                  </p>
                  <ul className="text-xs text-destructive mt-1 ml-4 list-disc">
                    <li>Complaint record and all details</li>
                    <li>All associated letters and documents</li>
                    <li>Investigation findings and evidence</li>
                    <li>Compliance checks and audit logs</li>
                    <li>All related staff responses</li>
                  </ul>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setComplaintToDelete(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteComplaint}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Permanently
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
         </Dialog>
         
         {/* Import Complaint Modal */}
         {showImportModal && (
           <ComplaintImport
             onDataExtracted={handleImportedData}
             onClose={() => setShowImportModal(false)}
           />
         )}
         
         {/* Import Patient Details Modal */}
         <PatientDetailsImportModal
           isOpen={showPatientImportModal}
           onClose={() => setShowPatientImportModal(false)}
           onImport={handlePatientImport}
         />
       </div>
     );
   };

export default ComplaintsSystem;