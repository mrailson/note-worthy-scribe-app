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

const ComplaintDetails = () => {
  const { user } = useAuth();
  const { complaintId } = useParams();
  const navigate = useNavigate();
  
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
  const [showAcknowledgementLetter, setShowAcknowledgementLetter] = useState(false);
  const [complianceChecks, setComplianceChecks] = useState<any[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [complianceAuditLogs, setComplianceAuditLogs] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return <LoginForm />;
  }

  // Fetch complaint details
  useEffect(() => {
    if (complaintId) {
      fetchComplaintDetails();
      fetchComplianceData();
      fetchAuditLogs();
    }
  }, [complaintId]);

  const fetchComplaintDetails = async () => {
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

      // Fetch acknowledgement letter
      const { data: ackData } = await supabase
        .from('complaint_acknowledgements')
        .select('acknowledgement_letter')
        .eq('complaint_id', complaintId)
        .single();

      if (ackData) {
        setAcknowledgementLetter(ackData.acknowledgement_letter);
      }

    } catch (error) {
      console.error('Error fetching complaint details:', error);
      toast.error("Failed to load complaint details");
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceData = async () => {
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

  const fetchAuditLogs = async () => {
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
              <Card>
                <CardHeader>
                  <CardTitle>Patient Information</CardTitle>
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
                        <Label className="font-medium">Phone</Label>
                        <p className="text-sm text-muted-foreground">{complaint.patient_contact_phone}</p>
                      </div>
                    )}
                    {complaint.patient_contact_email && (
                      <div>
                        <Label className="font-medium">Email</Label>
                        <p className="text-sm text-muted-foreground">{complaint.patient_contact_email}</p>
                      </div>
                    )}
                  </div>
                  {complaint.patient_address && (
                    <div>
                      <Label className="font-medium">Address</Label>
                      <p className="text-sm text-muted-foreground">{complaint.patient_address}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Complaint Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium">Category</Label>
                      <p className="text-sm text-muted-foreground">{getCategoryLabel(complaint.category)}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Priority</Label>
                      <p className="text-sm text-muted-foreground">{getPriorityLabel(complaint.priority)}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Status</Label>
                      <p className="text-sm text-muted-foreground">{getStatusLabel(complaint.status)}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Incident Date</Label>
                      <p className="text-sm text-muted-foreground">{format(new Date(complaint.incident_date), 'dd/MM/yyyy')}</p>
                    </div>
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
                      <p className="text-sm text-muted-foreground">{complaint.staff_mentioned.join(', ')}</p>
                    </div>
                  )}
                  <div>
                    <Label className="font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">{complaint.complaint_description}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

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
                      onClick={() => handleGenerateAcknowledgement(complaint.id)}
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
                            onClick={() => handleGenerateAcknowledgement(complaint.id)}
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
    </div>
  );
};

export default ComplaintDetails;