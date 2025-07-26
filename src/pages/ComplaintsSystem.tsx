import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { ComplaintImport } from "@/components/ComplaintImport";
import { PracticeManager } from "@/components/PracticeManager";

import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search,
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
  Save
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { FormattedLetterContent } from "@/components/FormattedLetterContent";
import { createLetterDocument } from "@/utils/letterFormatter";

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
  
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedOutcome, setSelectedOutcome] = useState("all");
  const [dashboardFilter, setDashboardFilter] = useState("all");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
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
  
  // Audit log states
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [complianceAuditLogs, setComplianceAuditLogs] = useState<any[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('workflow');

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
          setShowLetterModal(true);
        } else {
          toast.error('No acknowledgement letter found for this complaint');
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
          setShowLetterModal(true);
          console.log('Modal state after setting:', { 
            showLetterModal: true, 
            modalLetterContent: outcome.outcome_letter?.substring(0, 100) + '...' 
          });
        } else {
          console.log('No outcome found, showing error toast');
          toast.error('No outcome letter found for this complaint');
        }
      }
    } catch (error) {
      console.error('Error fetching letter:', error);
      toast.error('Failed to load letter');
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
  const [showImport, setShowImport] = useState(false);
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
    consent_given: false,
    consent_details: "",
    complaint_on_behalf: false,
  });

  const categoryOptions = [
    { value: "clinical_care", label: "Clinical Care" },
    { value: "staff_attitude", label: "Staff Attitude" },
    { value: "appointment_system", label: "Appointment System" },
    { value: "communication", label: "Communication" },
    { value: "facilities", label: "Facilities" },
    { value: "billing", label: "Billing" },
    { value: "waiting_times", label: "Waiting Times" },
    { value: "medication", label: "Medication" },
    { value: "referrals", label: "Referrals" },
    { value: "other", label: "Other" },
  ];

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
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
    }
  }, [user]);

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
          .single();
        
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
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast.error("Failed to fetch complaints");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
        staff_mentioned: formData.staff_mentioned ? formData.staff_mentioned.split(',').map(s => s.trim()) : null,
        priority: formData.priority as any,
        consent_given: formData.consent_given,
        consent_details: formData.consent_details || null,
        complaint_on_behalf: formData.complaint_on_behalf,
        created_by: user.id,
        status: 'submitted' as any,
      };

      const { data, error } = await supabase
        .from('complaints')
        .insert({
          ...complaintData,
          reference_number: '' // Will be auto-generated by trigger
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Complaint submitted successfully. Reference: ${data.reference_number}`);

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
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
      toast.error("Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ComplaintFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

      toast.success('Acknowledgement letter generated successfully');
      fetchComplaints(); // Refresh to show updated status
      loadLettersStatus(); // Refresh letters status
    } catch (error) {
      console.error('Error generating acknowledgement:', error);
      toast.error('Failed to generate acknowledgement letter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendStaffNotifications = async (complaintId: string) => {
    if (involvedParties.length === 0) {
      toast.error('Please add at least one staff member to notify');
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

      toast.success('Notifications sent to staff members');
      setInvolvedParties([]);
      fetchComplaints();
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast.error('Failed to send staff notifications');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateOutcomeLetter = async (complaintId: string) => {
    if (!outcomeType || !outcomeSummary) {
      toast.error('Please select outcome type and provide summary');
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
      toast.success('Outcome letter generated and complaint closed');
      fetchComplaints();
    } catch (error) {
      console.error('Error generating outcome letter:', error);
      toast.error('Failed to generate outcome letter');
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

      toast.success('Outcome letter saved successfully');
      setEditingOutcome(false);
    } catch (error) {
      console.error('Error saving outcome letter:', error);
      toast.error('Failed to save outcome letter');
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
      toast.error('Failed to fetch audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  // Export audit logs to Word document
  const exportAuditToWord = async () => {
    try {
      const logs = filteredAuditLogs;
      
      if (logs.length === 0) {
        toast.error('No audit logs to export');
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
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${selectedComplaint?.reference_number || 'all'}-${format(new Date(), 'yyyy-MM-dd')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Audit log exported to Word successfully');
    } catch (error) {
      console.error('Error exporting audit log:', error);
      toast.error('Failed to export audit log');
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

  const addInvolvedParty = () => {
    if (!newParty.staffName || !newParty.staffEmail) {
      toast.error('Please provide staff name and email');
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
        complaint_id_param: complaintId
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
        complaint_id_param: complaintId
      });

      if (summaryError) throw summaryError;
      if (summaryData && summaryData.length > 0) {
        setComplianceSummary(summaryData[0]);
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
      
      toast.success('Compliance check updated');
    } catch (error) {
      console.error('Error updating compliance check:', error);
      toast.error('Failed to update compliance check');
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
      toast.success('AI analysis completed');
    } catch (error) {
      console.error('Error analyzing outcome:', error);
      toast.error('Failed to analyze complaint outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportData = (importedData: any) => {
    // Auto-populate form with imported data
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
      staff_mentioned: importedData.staff_mentioned ? importedData.staff_mentioned.join(', ') : prev.staff_mentioned,
      priority: importedData.priority || prev.priority,
      consent_given: importedData.consent_given !== undefined ? importedData.consent_given : prev.consent_given,
      complaint_on_behalf: importedData.complaint_on_behalf !== undefined ? importedData.complaint_on_behalf : prev.complaint_on_behalf,
    }));
    
    toast.success('Form populated with imported data - please review and submit');
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
      <Header onNewMeeting={() => {}} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">🏥 GP Practice Complaint Management System</h1>
          <p className="text-muted-foreground">Secure, NHS-compliant complaint management with full audit trail</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="view">View Complaints</TabsTrigger>
            <TabsTrigger value="new">New Complaint</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="settings">Practice & Signatures</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => { setDashboardFilter("all"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Complaints</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complaints.length}</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => { setDashboardFilter("open"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {complaints.filter(c => ['submitted', 'under_review'].includes(c.status)).length}
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => { setDashboardFilter("overdue"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {complaints.filter(isOverdue).length}
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => { setDashboardFilter("closed_this_month"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Closed This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {complaints.filter(c => c.status === 'closed' && 
                      new Date(c.closed_at || '').getMonth() === new Date().getMonth()).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complaints.slice(0, 5).map((complaint) => (
                    <div key={complaint.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{complaint.reference_number}</p>
                        <p className="text-sm text-muted-foreground">{complaint.complaint_title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(complaint.status)}>
                          {getStatusIcon(complaint.status)}
                          <span className="ml-1">{getStatusLabel(complaint.status)}</span>
                        </Badge>
                        {isOverdue(complaint) && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* View Complaints Tab */}
          <TabsContent value="view" className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Search & Filter Complaints</CardTitle>
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
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="partially_upheld">Partially Upheld</SelectItem>
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
                    <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{complaint.complaint_title}</CardTitle>
                              {isOverdue(complaint) && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="flex items-center gap-4">
                              <span><strong>Ref:</strong> {complaint.reference_number}</span>
                              <span><strong>Patient:</strong> {complaint.patient_name}</span>
                              <span><strong>Date:</strong> {format(new Date(complaint.incident_date), 'dd/MM/yyyy')}</span>
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-muted-foreground">Priority:</span>
                              <Badge className={getPriorityColor(complaint.priority)}>
                                {getPriorityLabel(complaint.priority)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-muted-foreground">Status:</span>
                              <Badge className={getStatusColor(complaint.status)}>
                                {getStatusIcon(complaint.status)}
                                <span className="ml-1">{getStatusLabel(complaint.status)}</span>
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
                                <span><strong>Location:</strong> {complaint.location_service}</span>
                              </div>
                            )}
                            {complaint.response_due_date && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span><strong>Due:</strong> {format(new Date(complaint.response_due_date), 'dd/MM/yyyy')}</span>
                              </div>
                            )}
                          </div>
                          
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
                                  lettersStatus[complaint.id].outcomeType.charAt(0).toUpperCase() + 
                                  lettersStatus[complaint.id].outcomeType.slice(1).replace('_', ' ') 
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
                            setSelectedComplaint(complaint);
                            setShowDetails(true);
                            await fetchComplianceData(complaint.id);
                            await fetchAuditLogs(complaint.id);
                          }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Manage Workflow
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
          <TabsContent value="new" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Submit New Complaint</CardTitle>
                    <CardDescription>Record a new patient complaint following NHS procedures</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowImport(true)}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import Data
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitComplaint} className="space-y-6">
                  {/* Patient Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Patient Information
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="patient_name">Patient Name *</Label>
                        <Input 
                          id="patient_name" 
                          value={formData.patient_name}
                          onChange={(e) => handleInputChange('patient_name', e.target.value)}
                          placeholder="Enter patient's full name" 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient_dob">Date of Birth</Label>
                        <Input 
                          id="patient_dob" 
                          type="date"
                          value={formData.patient_dob}
                          onChange={(e) => handleInputChange('patient_dob', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="patient_contact_phone">Contact Phone</Label>
                        <Input 
                          id="patient_contact_phone" 
                          value={formData.patient_contact_phone}
                          onChange={(e) => handleInputChange('patient_contact_phone', e.target.value)}
                          placeholder="Phone number" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient_contact_email">Contact Email</Label>
                        <Input 
                          id="patient_contact_email" 
                          type="email"
                          value={formData.patient_contact_email}
                          onChange={(e) => handleInputChange('patient_contact_email', e.target.value)}
                          placeholder="Email address" 
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
                        <Input 
                          id="staff_mentioned" 
                          value={formData.staff_mentioned}
                          onChange={(e) => handleInputChange('staff_mentioned', e.target.value)}
                          placeholder="Comma-separated list of staff names" 
                        />
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
                          required
                        />
                        <Label htmlFor="consent_given" className="text-sm">
                          I consent to the practice processing this complaint in accordance with NHS procedures and GDPR requirements *
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

                  <div className="flex gap-4 pt-4">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit Complaint"}
                    </Button>
                    <Button type="button" variant="outline">
                      Save as Draft
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
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

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Complaint Audit Log</CardTitle>
                <CardDescription>
                  Comprehensive audit trail of all complaint activities, status changes, and compliance updates
                  {selectedComplaint && (
                    <div className="mt-2 text-sm">
                      Currently viewing logs for: <strong>{selectedComplaint.reference_number}</strong>
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="audit-search">Search Audit Log</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="audit-search"
                        placeholder="Search by action, user, or description..."
                        value={auditSearchTerm}
                        onChange={(e) => setAuditSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Action Type</Label>
                    <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by action type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="create">Created</SelectItem>
                        <SelectItem value="view">Viewed</SelectItem>
                        <SelectItem value="edit">Edited</SelectItem>
                        <SelectItem value="status_change">Status Changes</SelectItem>
                        <SelectItem value="compliance_update">Compliance Updates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setAuditSearchTerm("");
                        setAuditActionFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>


                {/* Audit Log Display */}
                {auditLoading ? (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground">Loading audit logs...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAuditLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No audit logs found. Select a complaint to view its audit trail.
                      </div>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <Card key={log.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getActionBadgeVariant(log.action_type)}>
                                    {log.action_type.replace('_', ' ').toUpperCase()}
                                  </Badge>
                                  <span className="text-sm font-medium">
                                    {log.profiles?.full_name || log.user_email}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {log.action_description}
                                </p>
                                {(log.old_values || log.new_values) && (
                                  <div className="text-xs text-muted-foreground">
                                    <details className="mt-2">
                                      <summary className="cursor-pointer">View Details</summary>
                                      <div className="mt-2 space-y-1">
                                        {log.old_values && (
                                          <div>
                                            <strong>Previous:</strong> {JSON.stringify(log.old_values, null, 2)}
                                          </div>
                                        )}
                                        {log.new_values && (
                                          <div>
                                            <strong>New:</strong> {JSON.stringify(log.new_values, null, 2)}
                                          </div>
                                        )}
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Complaints Reports & Analytics</CardTitle>
                <CardDescription>Generate reports for CQC, ICB and internal quality improvement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Download className="h-5 w-5" />
                    <span>Monthly Summary</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <FileText className="h-5 w-5" />
                    <span>Annual Report</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Users className="h-5 w-5" />
                    <span>Staff Analysis</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Building className="h-5 w-5" />
                    <span>Category Trends</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Clock className="h-5 w-5" />
                    <span>Response Times</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>Escalations Report</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Templates</CardTitle>
                <CardDescription>Manage standard response templates for acknowledgments and replies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Template
                  </Button>
                  
                  <div className="text-muted-foreground">
                    Template management functionality coming soon...
                  </div>
                </div>
              </CardContent>
            </Card>
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
                    Configure your signature details for acknowledgement and outcome letters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">
                      Complaint letters will automatically include your signature from GP Scribe Settings.
                    </p>
                    <Button 
                      onClick={() => window.open('/gp-scribe-settings', '_blank')}
                      className="mb-4"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Configure GP Signature Settings
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Opens in a new tab. Configure your name, title, qualifications, and practice details.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <PracticeManager />
              
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
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="compliance">Compliance</TabsTrigger>
                    <TabsTrigger value="audit">Audit Log</TabsTrigger>
                  </TabsList>

                  {/* Workflow Tab */}
                  <TabsContent value="workflow" className="space-y-6">

                  {/* NHS Compliance Tracking */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          NHS Compliance & Best Practice
                        </div>
                        {complianceSummary && (
                          <Badge variant={complianceSummary.compliance_percentage >= 80 ? "default" : "destructive"}>
                            {complianceSummary.compliance_percentage}% Complete
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {complianceSummary && (
                        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{complianceSummary.compliant_items}</div>
                            <div className="text-sm text-muted-foreground">Completed</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{complianceSummary.total_items - complianceSummary.compliant_items}</div>
                            <div className="text-sm text-muted-foreground">Outstanding</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{complianceSummary.total_items}</div>
                            <div className="text-sm text-muted-foreground">Total Checks</div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {complianceChecks.map((check) => (
                          <div 
                            key={check.id} 
                            className={`flex items-start justify-between p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                              check.is_compliant ? 'bg-green-50 border-green-200' : 'bg-white hover:bg-gray-50'
                            }`}
                            onClick={() => updateComplianceCheck(check.id, !check.is_compliant)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={check.is_compliant}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updateComplianceCheck(check.id, e.target.checked);
                                  }}
                                  className="rounded pointer-events-none"
                                  tabIndex={-1}
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
                            <div className="space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAcknowledgementLetter(!showAcknowledgementLetter)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {showAcknowledgementLetter ? 'Hide' : 'View'} Letter
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
                          <Button onClick={addInvolvedParty} size="sm">
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
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => removeInvolvedParty(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
                              <SelectItem value="partially_upheld">Partially Upheld</SelectItem>
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
                              <strong>Progress:</strong> {complianceSummary.compliant_items} of {complianceSummary.total_items} items completed
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

                        <div className="space-y-3">
                          {complianceChecks.map((check) => (
                            <div key={check.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={check.is_compliant}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      updateComplianceCheck(check.id, e.target.checked);
                                    }}
                                    className="rounded pointer-events-none"
                                    tabIndex={-1}
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
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {filteredAuditLogs.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No audit logs found for this complaint</p>
                              </div>
                            ) : (
                              filteredAuditLogs.map((log) => (
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
                                      {(log.old_values || log.new_values) && (
                                        <div className="text-xs text-muted-foreground">
                                          {log.old_values && <div>Previous: {JSON.stringify(log.old_values)}</div>}
                                          {log.new_values && <div>New: {JSON.stringify(log.new_values)}</div>}
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
                              ))
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
          )}
        
        {/* Complaint Import Modal */}
        {showImport && (
          <ComplaintImport
            onDataExtracted={handleImportData}
            onClose={() => setShowImport(false)}
          />
        )}
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
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
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
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="border rounded-lg p-8 bg-white shadow-sm">
                  <FormattedLetterContent content={modalLetterContent} />
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(modalLetterContent);
                      toast.success('Letter copied to clipboard');
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      try {
                        const doc = createLetterDocument(
                          modalLetterContent,
                          letterType,
                          viewingLetterComplaint.reference_number
                        );
                        
                        const blob = await Packer.toBlob(doc);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${letterType}-letter-${viewingLetterComplaint.reference_number}.docx`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Letter downloaded successfully');
                      } catch (error) {
                        console.error('Error generating DOCX:', error);
                        toast.error('Failed to generate document');
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
        )}
      </div>
    );
  };

export default ComplaintsSystem;