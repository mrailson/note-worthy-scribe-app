import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Header } from "@/components/Header";
import { ViewFullResponseModal } from "@/components/ViewFullResponseModal";
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
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createLetterDocument } from "@/utils/letterFormatter";
import { Document, Packer } from "docx";
import { InvestigationEvidence } from "@/components/InvestigationEvidence";
import { InvestigationFindings } from "@/components/InvestigationFindings";
import { InvestigationDecisionAndLearning } from "@/components/InvestigationDecisionAndLearning";
import { CQCEvidence } from "@/components/CQCEvidence";
import { FormattedLetterContent } from "@/components/FormattedLetterContent";

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
}

const ComplaintDetails = () => {
  const { user } = useAuth();
  const { complaintId } = useParams();
  const navigate = useNavigate();
  
  // All state hooks must be called before any conditional returns
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("workflow");
  const [involvedParties, setInvolvedParties] = useState<Array<{staffName: string; staffEmail: string; staffRole: string}>>([]);
  const [newParty, setNewParty] = useState({staffName: '', staffEmail: '', staffRole: ''});
  const [outcomeType, setOutcomeType] = useState('');
  const [outcomeSummary, setOutcomeSummary] = useState('');
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [outcomeLetter, setOutcomeLetter] = useState("");
  const [showOutcomeLetter, setShowOutcomeLetter] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [acknowledgementLetter, setAcknowledgementLetter] = useState("");
  const [acknowledgementDate, setAcknowledgementDate] = useState<string | null>(null);
  const [showAcknowledgementLetter, setShowAcknowledgementLetter] = useState(false);
  const [showAcknowledgementModal, setShowAcknowledgementModal] = useState(false);
  const [isEditingAcknowledgement, setIsEditingAcknowledgement] = useState(false);
  const [editedAcknowledgementContent, setEditedAcknowledgementContent] = useState("");
  const [complianceChecks, setComplianceChecks] = useState<any[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [complianceAuditLogs, setComplianceAuditLogs] = useState<any[]>([]);
  const [complaintDocuments, setComplaintDocuments] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(false);
  
  // Investigation workflow state
  const [investigationMethod, setInvestigationMethod] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Array<{name: string; email: string; role: string; suggested: boolean; type: string}>>([]);
  const [additionalStaff, setAdditionalStaff] = useState({name: '', email: '', role: ''});
  const [inputRequests, setInputRequests] = useState<Array<{id: string; staffName: string; staffEmail: string; status: string; sentAt: string; responseReceived: boolean; responseReceivedAt?: string; responseText?: string; isTestResponse?: boolean}>>([]);
  const [workflowSettings, setWorkflowSettings] = useState<any>(null);
  const [editingStaffIndex, setEditingStaffIndex] = useState<number | null>(null);

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
      setComplaint(data);

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
      }

    } catch (error) {
      console.error('Error fetching complaint details:', error);
      toast.error("Failed to load complaint details");
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
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (checksError) throw checksError;
      setComplianceChecks(checks || []);

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

  const fetchStaffResponses = async () => {
    if (!user || !complaintId) return;
    try {
      const { data, error } = await supabase
        .from('complaint_involved_parties')
        .select('*')
        .eq('complaint_id', complaintId);

      if (error) throw error;

      // Convert database records to inputRequests format
      if (data && data.length > 0) {
        const requests = data.map(party => ({
          id: party.id,
          staffName: party.staff_name,
          staffEmail: party.staff_email,
          status: party.response_submitted_at ? 'completed' : 'pending',
          sentAt: party.response_requested_at,
          responseReceived: !!party.response_submitted_at,
          responseReceivedAt: party.response_submitted_at,
          responseText: party.response_text,
          isTestResponse: !!party.response_text // If there's response text, it might be a test response
        }));
        
        setInputRequests(requests);
        
        // Also update selectedStaff if needed
        const staffList = data.map(party => ({
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
      } else {
        // No input requests found - check if we should set direct investigation
        // This happens after acknowledgement letter exists but no staff input was requested
        if (!investigationMethod && acknowledgementLetter) {
          // Check if there's any investigation evidence or outcome suggesting direct investigation
          const { data: outcomeExists } = await supabase
            .from('complaint_outcomes')
            .select('id')
            .eq('complaint_id', complaintId)
            .maybeSingle();
            
          if (outcomeExists) {
            setInvestigationMethod("direct-investigation");
            console.log('Auto-restored investigation method to "direct-investigation" based on existing outcome data');
          }
        }
      }
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
      setAuditLogs(logs || []);

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
      await supabase.rpc('log_complaint_view', {
        p_complaint_id: complaintId,
        p_view_context: 'complaint_details_page'
      });
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
      under_review: "Under Review",
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
      
      toast.success("Compliance check updated");
    } catch (error) {
      console.error('Error updating compliance check:', error);
      toast.error("Failed to update compliance check");
    }
  };

  const markAllCompliant = async () => {
    try {
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
      
      toast.success(`Marked ${nonCompliantChecks.length} items as completed`);
    } catch (error) {
      console.error('Error marking all items as compliant:', error);
      toast.error("Failed to mark all items as completed");
    }
  };

  const handleGenerateAcknowledgement = async (complaintId: string) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-complaint-acknowledgement', {
        body: { complaintId }
      });

      if (error) throw error;

      setAcknowledgementLetter(data.acknowledgementLetter);
      toast.success("Acknowledgement letter generated successfully");
    } catch (error) {
      console.error('Error generating acknowledgement:', error);
      toast.error("Failed to generate acknowledgement letter");
    } finally {
      setSubmitting(false);
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
      toast.success("AI analysis completed");
    } catch (error) {
      console.error('Error analyzing outcome:', error);
      toast.error("Failed to analyze complaint");
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
      toast.error("Please add staff members to notify");
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

      toast.success("Staff notifications sent successfully");
      setInvolvedParties([]);
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast.error("Failed to send staff notifications");
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
      toast.success("Outcome letter updated successfully");
    } catch (error) {
      console.error('Error saving outcome letter:', error);
      toast.error("Failed to save outcome letter");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateOutcomeLetter = async () => {
    if (!existingOutcome || !complaint) {
      toast.error("No existing outcome found to regenerate");
      return;
    }

    try {
      setSubmitting(true);
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
        toast.success("Outcome letter regenerated successfully with practice logo included");
      } else {
        throw new Error('No outcome letter received from generator');
      }
    } catch (error) {
      console.error('Error regenerating outcome letter:', error);
      toast.error("Failed to regenerate outcome letter");
    } finally {
      setSubmitting(false);
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
      
      toast.success("Acknowledgement letter downloaded successfully");
    } catch (error) {
      console.error('Error downloading acknowledgement letter:', error);
      toast.error("Failed to download acknowledgement letter");
    }
  };

  const handleSaveAcknowledgementLetter = async () => {
    if (!complaint || !editedAcknowledgementContent.trim()) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('complaint_acknowledgements')
        .update({ 
          acknowledgement_letter: editedAcknowledgementContent,
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

      setAcknowledgementLetter(editedAcknowledgementContent);
      setIsEditingAcknowledgement(false);
      toast.success("Acknowledgement letter updated successfully");
    } catch (error) {
      console.error('Error saving acknowledgement letter:', error);
      toast.error("Failed to save acknowledgement letter");
    } finally {
      setSubmitting(false);
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
    setEditedAcknowledgementContent(acknowledgementLetter);
    setIsEditingAcknowledgement(false);
    setShowAcknowledgementModal(true);
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
          let defaultEmail = '';
          let defaultRole = 'Various';
          
          if (practiceId) {
            const { data: defaultContact } = await supabase
              .rpc('get_default_staff_contact', {
                p_practice_id: practiceId,
                p_staff_role: staff,
                p_staff_name: staff
              });
            
            if (defaultContact && defaultContact.length > 0) {
              defaultEmail = defaultContact[0].default_email;
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
      toast.error("Please select staff members to request input from");
      return;
    }

    // Check if requests have already been sent for currently selected staff
    const hasExistingRequests = selectedStaff.some(staff => 
      inputRequests.some(request => request.staffName === staff.name && request.staffEmail === staff.email)
    );
    
    if (hasExistingRequests) {
      toast.error("Input requests have already been sent for some of the selected staff. Check the tracking section below.");
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
        toast.error("Please ensure all selected staff have email addresses");
        return;
      }

      // Call the edge function with the correct data structure
      const { data, error } = await supabase.functions.invoke('send-complaint-notifications', {
        body: {
          complaintId: complaint?.id,
          involvedParties: involvedParties
        }
      });

      if (error) throw error;

      // Update local state with sent requests
      const newInputRequests = involvedParties.map(party => ({
        id: Math.random().toString(36).substr(2, 9), // temporary ID
        staffName: party.staffName,
        staffEmail: party.staffEmail,
        status: 'Sent',
        sentAt: new Date().toISOString(),
        responseReceived: false
      }));

      setInputRequests(newInputRequests);
      toast.success(`Input requests sent to ${involvedParties.length} staff members`);
      
      // Log the activity
      console.log('Email results:', data?.emailResults);
      
    } catch (error) {
      console.error('Error sending input requests:', error);
      toast.error("Failed to send input requests: " + error.message);
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
      toast.success("Input requests cleared. You can now send new requests.");
      
    } catch (error) {
      console.error('Error clearing input requests:', error);
      toast.error("Failed to clear input requests");
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

      toast.success(`Test reply generated for ${staffName}`);
      
    } catch (error) {
      console.error('Error generating test reply:', error);
      toast.error("Failed to generate test reply");
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
      toast.success("Workflow settings saved");
      
    } catch (error) {
      console.error('Error saving workflow settings:', error);
      toast.error("Failed to save workflow settings");
    } finally {
      setSubmitting(false);
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
          <div className="flex items-center gap-4 mb-6">
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
                <div><strong>Status:</strong> {getStatusLabel(complaint.status)}</div>
                <div><strong>Incident Date:</strong> {format(new Date(complaint.incident_date), 'dd/MM/yyyy')}</div>
                {complaint.response_due_date && (
                  <div><strong>Due Date:</strong> {format(new Date(complaint.response_due_date), 'dd/MM/yyyy')}</div>
                )}
              </div>
              <div className="mt-4">
                <strong>Description:</strong>
                <p className="mt-1 text-sm text-muted-foreground">{complaint.complaint_description}</p>
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
                      <Label className="font-medium">Complaint Made On Behalf</Label>
                      <p className="text-sm text-muted-foreground">
                        {complaint.complaint_on_behalf ? 'Yes' : 'No'}
                      </p>
                    </div>
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
                      <p className="text-sm text-foreground whitespace-pre-line">{complaint.complaint_description}</p>
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
                      <p className="text-sm text-muted-foreground font-mono">{complaint.created_by}</p>
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
                      {submitting ? 'Generating...' : 'Generate Acknowledgement Letter'}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-2">
                          <Badge variant="default">Letter Generated</Badge>
                          {acknowledgementDate && (complaint?.submitted_at || complaint?.created_at) ? (
                            <div className="text-sm text-muted-foreground">
                              Generated: {format(new Date(acknowledgementDate), 'dd/MM/yyyy HH:mm')}
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
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Debug: ackDate={acknowledgementDate ? 'exists' : 'missing'}, 
                              submittedAt={complaint?.submitted_at ? 'exists' : 'missing'},
                              createdAt={complaint?.created_at ? 'exists' : 'missing'}
                            </div>
                          )}
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
                            onClick={() => handleGenerateAcknowledgement(complaint.id)}
                            disabled={submitting}
                          >
                            {submitting ? 'Regenerating...' : 'Regenerate Letter'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Outcome Letter Section */}
              {existingOutcome && outcomeLetter && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <FileText className="h-5 w-5" />
                      Outcome Letter Available
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
                            Outcome: {existingOutcome.outcome_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                            onClick={handleRegenerateOutcomeLetter}
                            disabled={submitting}
                            className="border-green-600 text-green-700 hover:bg-green-100"
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            {submitting ? 'Regenerating...' : 'Regenerate Letter'}
                          </Button>
                        </div>
                      </div>
                      
                      {existingOutcome.outcome_summary && (
                        <div className="p-3 bg-green-100 rounded border border-green-200">
                          <Label className="font-medium text-green-800">Outcome Summary:</Label>
                          <p className="text-sm text-green-700 mt-1">{existingOutcome.outcome_summary}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Outcome Letter Dialog */}
              <Dialog open={showOutcomeLetter} onOpenChange={setShowOutcomeLetter}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Outcome Letter - {complaint?.reference_number}
                    </DialogTitle>
                    <DialogDescription>
                      Final outcome letter for this complaint
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex flex-col gap-4 max-h-[60vh]">
                    <div className="flex-1 overflow-y-auto">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <FormattedLetterContent content={outcomeLetter} />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowOutcomeLetter(false)}>
                        Close
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
              {acknowledgementLetter && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Investigation Workflow
                    </CardTitle>
                    <CardDescription>
                      Determine how the complaint will be investigated and who needs to provide input
                    </CardDescription>
                  </CardHeader>
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
                          <CQCEvidence complaintId={complaint.id} practiceId={complaint.practice_id} disabled={submitting} />
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
                                              value={staff.email}
                                              onChange={(e) => {
                                                const updatedStaff = [...selectedStaff];
                                                updatedStaff[index].email = e.target.value;
                                                setSelectedStaff(updatedStaff);
                                              }}
                                              className="text-xs h-6 w-60"
                                              maxLength={50}
                                              autoFocus
                                            />
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setEditingStaffIndex(null)}
                                              className="text-xs h-6"
                                            >
                                              Save
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setEditingStaffIndex(null);
                                                // Reset to original value if needed - could store original in state
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
                                              onClick={() => setEditingStaffIndex(index)}
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
                                              const updatedStaff = [...selectedStaff];
                                              updatedStaff[index].email = e.target.value;
                                              setSelectedStaff(updatedStaff);
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
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleRemoveStaff(index)}
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </Button>
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
                           <CQCEvidence complaintId={complaint.id} practiceId={complaint.practice_id} disabled={submitting} />
                         </div>
                      </div>
                    )}
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
                </CardHeader>
                <CardContent>
                  {complianceSummary && (
                    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg mb-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{complianceSummary.compliant_items}</div>
                        <div className="text-sm text-muted-foreground">Items Complete</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">{complianceSummary.total_items - complianceSummary.compliant_items}</div>
                        <div className="text-sm text-muted-foreground">Items Outstanding</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{Math.round(complianceSummary.compliance_percentage)}%</div>
                        <div className="text-sm text-muted-foreground">Overall Compliance</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {complianceChecks.map((check) => (
                      <Card 
                        key={check.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          check.is_compliant ? 'border-green-200 bg-green-50' : 'border-gray-200'
                        }`}
                        onClick={() => updateComplianceCheck(check.id, !check.is_compliant)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={check.is_compliant}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateComplianceCheck(check.id, e.target.checked);
                              }}
                              className="mt-1 rounded"
                              tabIndex={-1}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-medium ${
                                  check.is_compliant ? 'line-through text-muted-foreground' : 'text-foreground'
                                }`}>
                                  {check.compliance_item}
                                </h4>
                                {check.is_compliant && (
                                  <Badge variant="default">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Complete
                                  </Badge>
                                )}
                              </div>
                              {check.notes && (
                                <p className="text-sm text-muted-foreground mt-2">{check.notes}</p>
                              )}
                              {check.checked_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {check.is_compliant ? 'Completed' : 'Last updated'}: {format(new Date(check.checked_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                              )}
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
              <Card>
                <CardHeader>
                  <CardTitle>Complaint Activity Log</CardTitle>
                  <CardDescription>Complete audit trail of all actions taken on this complaint</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <div key={log.id} className="border-l-2 border-blue-200 pl-4 py-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{log.action_type}</h4>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{log.action_description}</p>
                          {log.user_email && (
                            <p className="text-xs text-muted-foreground">By: {log.user_email}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No activity recorded yet for this complaint.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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

      {/* Acknowledgement Letter Modal */}
      <Dialog open={showAcknowledgementModal} onOpenChange={setShowAcknowledgementModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Acknowledgement Letter - {complaint?.reference_number}
            </DialogTitle>
            <DialogDescription>
              View, edit, download, or regenerate the acknowledgement letter for this complaint
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 max-h-[60vh]">
            {/* Action buttons */}
            <div className="flex gap-2 justify-end border-b pb-4">
              {!isEditingAcknowledgement ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditingAcknowledgement(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Letter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadAcknowledgementLetter}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download DOCX
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowAcknowledgementModal(false);
                      handleGenerateAcknowledgement(complaint.id);
                    }}
                    disabled={submitting}
                  >
                    {submitting ? 'Regenerating...' : 'Regenerate Letter'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingAcknowledgement(false);
                      setEditedAcknowledgementContent(acknowledgementLetter);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveAcknowledgementLetter}
                    disabled={submitting || !editedAcknowledgementContent.trim()}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {submitting ? 'Saving...' : 'Save Letter'}
                  </Button>
                </>
              )}
            </div>
            
            {/* Letter content */}
            <div className="flex-1 overflow-y-auto">
              {!isEditingAcknowledgement ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <FormattedLetterContent content={acknowledgementLetter} />
                </div>
              ) : (
                <div className="p-4 bg-white rounded-lg border">
                  <Textarea
                    value={editedAcknowledgementContent}
                    onChange={(e) => setEditedAcknowledgementContent(e.target.value)}
                    className="min-h-[600px] font-mono text-sm resize-none border-0 focus:ring-0 p-2 bg-white text-black"
                    placeholder="Edit the acknowledgement letter content..."
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintDetails;