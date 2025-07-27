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
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createLetterDocument } from "@/utils/letterFormatter";
import { Document, Packer } from "docx";

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
        .single();

      if (outcomeData) {
        setExistingOutcome(outcomeData);
        setOutcomeType(outcomeData.outcome_type);
        setOutcomeSummary(outcomeData.outcome_summary);
        setOutcomeLetter(outcomeData.outcome_letter || "");
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

  // useEffect hook - must be called before conditional returns
  useEffect(() => {
    if (user && complaintId) {
      fetchComplaintDetails();
      fetchComplianceData();
      fetchAuditLogs();
      fetchComplaintDocuments();
    }
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
      resolved: "Resolved"
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

  const handleDownloadAcknowledgementLetter = async () => {
    if (!acknowledgementLetter || !complaint) return;
    
    try {
      const doc = createLetterDocument(acknowledgementLetter, 'acknowledgement', complaint.reference_number);
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

              {/* Investigation Workflow */}
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
                          />
                          <Label htmlFor="input-required" className="text-sm cursor-pointer">
                            Input Required - Request responses from involved parties
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Suggested Staff Input Section */}
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <Label className="text-sm font-medium text-blue-900">System Suggestions</Label>
                      </div>
                      <p className="text-sm text-blue-800">
                        Based on the complaint details, the following staff may need to provide input:
                      </p>
                      <div className="space-y-2">
                        {/* Dynamic suggestions based on complaint content */}
                        {complaint.staff_mentioned && complaint.staff_mentioned.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-blue-900">Mentioned Staff:</Label>
                            {complaint.staff_mentioned.map((staff, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="flex items-center space-x-2">
                                  <input type="checkbox" className="rounded" defaultChecked />
                                  <span className="text-sm">{staff}</span>
                                  <Badge variant="outline" className="text-xs">Mentioned</Badge>
                                </div>
                                <Button variant="ghost" size="sm" className="text-xs">
                                  Override
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Category-based suggestions */}
                        {complaint.category === 'Appointments & Access' && (
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <div className="flex items-center space-x-2">
                              <input type="checkbox" className="rounded" defaultChecked />
                              <span className="text-sm">Reception Team</span>
                              <Badge variant="outline" className="text-xs">Suggested</Badge>
                            </div>
                            <Button variant="ghost" size="sm" className="text-xs">
                              Override
                            </Button>
                          </div>
                        )}
                        
                        {complaint.category === 'Clinical Care & Treatment' && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center space-x-2">
                                <input type="checkbox" className="rounded" defaultChecked />
                                <span className="text-sm">Treating Clinician</span>
                                <Badge variant="outline" className="text-xs">Suggested</Badge>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs">
                                Override
                              </Button>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center space-x-2">
                                <input type="checkbox" className="rounded" />
                                <span className="text-sm">Practice Nurse</span>
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs">
                                Override
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="pt-2">
                        <Button variant="outline" size="sm" className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Additional Staff
                        </Button>
                      </div>
                    </div>

                    {/* Input Tracking Section */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Input Status Tracking</Label>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                          Once staff are selected, emails will be sent with complaint details and tracked here:
                        </div>
                        
                        {/* Sample tracking items - would be populated dynamically */}
                        <div className="space-y-2 p-3 bg-gray-50 rounded border">
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No staff input requests sent yet. Select investigation method and staff members above.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button className="flex-1">
                        <Send className="h-4 w-4 mr-2" />
                        Send Input Requests
                      </Button>
                      <Button variant="outline">
                        <Save className="h-4 w-4 mr-2" />
                        Save Settings
                      </Button>
                    </div>
                  </CardContent>
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
                      onClick={() => handleAnalyzeOutcome(complaint.id)}
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
                        onClick={() => handleSendStaffNotifications(complaint.id)}
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>NHS Compliance Overview</CardTitle>
                  <CardDescription>Track compliance with NHS England complaints procedures and CQC requirements</CardDescription>
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
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
            <div className="flex-1 overflow-y-auto border rounded-lg bg-white">
              {!isEditingAcknowledgement ? (
                <div className="p-6">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {acknowledgementLetter}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <Textarea
                    value={editedAcknowledgementContent}
                    onChange={(e) => setEditedAcknowledgementContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm resize-none border-0 focus:ring-0 p-2"
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