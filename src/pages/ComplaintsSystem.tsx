import { useState, useEffect } from "react";
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
  Upload
} from "lucide-react";
import { format } from "date-fns";

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
  const [submitting, setSubmitting] = useState(false);

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
      console.error("Failed to fetch complaints");
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

      console.log(`Complaint submitted successfully. Reference: ${data.reference_number}`);

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
    } catch (error) {
      console.error('Error submitting complaint:', error);
      console.error("Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ComplaintFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="view">View Complaints</TabsTrigger>
            <TabsTrigger value="new">New Complaint</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Complaints</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complaints.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {complaints.filter(c => ['submitted', 'under_review'].includes(c.status)).length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {complaints.filter(isOverdue).length}
                  </div>
                </CardContent>
              </Card>
              <Card>
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
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedCategory("all");
                        setSelectedStatus("all");
                        setSelectedPriority("all");
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
                  filteredComplaints.map((complaint) => (
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
                            <Badge className={getPriorityColor(complaint.priority)}>
                              {getPriorityLabel(complaint.priority)}
                            </Badge>
                            <Badge className={getStatusColor(complaint.status)}>
                              {getStatusIcon(complaint.status)}
                              <span className="ml-1">{getStatusLabel(complaint.status)}</span>
                            </Badge>
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
                          
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4 mr-1" />
                              Update Status
                            </Button>
                            <Button size="sm" variant="outline">
                              <Send className="h-4 w-4 mr-1" />
                              Send Response
                            </Button>
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4 mr-1" />
                              Export
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          {/* New Complaint Tab */}
          <TabsContent value="new" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit New Complaint</CardTitle>
                <CardDescription>Record a new patient complaint following NHS procedures</CardDescription>
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
        </Tabs>
      </div>
    </div>
  );
};

export default ComplaintsSystem;