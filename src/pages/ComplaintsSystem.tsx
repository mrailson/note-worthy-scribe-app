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
  Save,
  Tag
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
  subcategory: string | null;
  location_service: string | null;
  staff_mentioned: string[] | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  consent_given: boolean | null;
  consent_details: string | null;
  complaint_on_behalf: boolean | null;
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
  subcategory: string;
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
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedOutcome, setSelectedOutcome] = useState("all");
  const [dashboardFilter, setDashboardFilter] = useState("all");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  // Modal states
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [existingOutcome, setExistingOutcome] = useState<any>(null);
  const [outcomeType, setOutcomeType] = useState("");
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [acknowledgementLetter, setAcknowledgementLetter] = useState("");
  const [outcomeLetter, setOutcomeLetter] = useState("");
  const [showOutcomeLetter, setShowOutcomeLetter] = useState(false);
  const [viewingLetterComplaint, setViewingLetterComplaint] = useState<Complaint | null>(null);
  const [modalLetterContent, setModalLetterContent] = useState("");
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [letterType, setLetterType] = useState<'acknowledgement' | 'outcome'>('acknowledgement');
  
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
    subcategory: "",
    location_service: "",
    staff_mentioned: "",
    priority: "medium",
    consent_given: false,
    consent_details: "",
    complaint_on_behalf: false,
  });

  const categoryOptions = [
    { value: "Appointments & Access", label: "Appointments & Access" },
    { value: "Clinical Care & Treatment", label: "Clinical Care & Treatment" },
    { value: "Communication Issues", label: "Communication Issues" },
    { value: "Staff Attitude & Behaviour", label: "Staff Attitude & Behaviour" },
    { value: "Prescriptions", label: "Prescriptions" },
    { value: "Test Results & Follow-Up", label: "Test Results & Follow-Up" },
    { value: "Administration", label: "Administration" },
    { value: "Facilities & Environment", label: "Facilities & Environment" },
    { value: "Digital Services", label: "Digital Services" },
    { value: "Confidentiality & Data", label: "Confidentiality & Data" },
  ];

  const subcategoryOptions: Record<string, { value: string; label: string; severity: string }[]> = {
    "Appointments & Access": [
      { value: "Booking Issues", label: "Booking Issues", severity: "medium" },
      { value: "Waiting Times", label: "Waiting Times", severity: "high" },
      { value: "Urgent Care Access", label: "Urgent Care Access", severity: "high" },
    ],
    "Clinical Care & Treatment": [
      { value: "Misdiagnosis", label: "Misdiagnosis", severity: "high" },
      { value: "Delayed Referral", label: "Delayed Referral", severity: "high" },
      { value: "Treatment Concern", label: "Treatment Concern", severity: "high" },
    ],
    "Communication Issues": [
      { value: "Poor Explanation", label: "Poor Explanation", severity: "medium" },
      { value: "Lack of Updates", label: "Lack of Updates", severity: "medium" },
    ],
    "Staff Attitude & Behaviour": [
      { value: "Rude Behaviour", label: "Rude Behaviour", severity: "medium" },
      { value: "Lack of Empathy", label: "Lack of Empathy", severity: "medium" },
    ],
    "Prescriptions": [
      { value: "Delay in Issue", label: "Delay in Issue", severity: "medium" },
      { value: "Medication Error", label: "Medication Error", severity: "high" },
    ],
    "Test Results & Follow-Up": [
      { value: "Result Delays", label: "Result Delays", severity: "medium" },
      { value: "No Follow-Up", label: "No Follow-Up", severity: "high" },
    ],
    "Administration": [
      { value: "Record Errors", label: "Record Errors", severity: "high" },
      { value: "Referral Letter Issues", label: "Referral Letter Issues", severity: "medium" },
    ],
    "Facilities & Environment": [
      { value: "Cleanliness", label: "Cleanliness", severity: "low" },
      { value: "Accessibility", label: "Accessibility", severity: "medium" },
    ],
    "Digital Services": [
      { value: "Online Booking Issues", label: "Online Booking Issues", severity: "medium" },
      { value: "Access to Records", label: "Access to Records", severity: "medium" },
    ],
    "Confidentiality & Data": [
      { value: "Breach of Data", label: "Breach of Data", severity: "high" },
    ],
  };

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
    { value: "response_sent", label: "Response Sent" },
    { value: "closed", label: "Closed" },
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
    }
    
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

  const checkLetterExists = async (complaintId: string, type: 'acknowledgement' | 'outcome'): Promise<boolean> => {
    try {
      if (type === 'acknowledgement') {
        const { data, error } = await supabase
          .from('complaint_acknowledgements')
          .select('id')
          .eq('complaint_id', complaintId)
          .limit(1)
          .maybeSingle();
        
        return !!data;
      } else {
        const { data, error } = await supabase
          .from('complaint_outcomes')
          .select('id')
          .eq('complaint_id', complaintId)
          .limit(1)
          .maybeSingle();
        
        return !!data;
      }
    } catch (error) {
      console.error(`Error checking ${type} letter for ${complaintId}:`, error);
      return false;
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSubmitting(true);
      
      const { data, error } = await supabase
        .from('complaints')
        .insert({
          ...formData,
          created_by: user.id,
          status: 'submitted'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Complaint submitted successfully");
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
        subcategory: "",
        location_service: "",
        staff_mentioned: "",
        priority: "medium",
        consent_given: false,
        consent_details: "",
        complaint_on_behalf: false,
      });
      
      fetchComplaints();
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
      if (data?.letter) {
        setAcknowledgementLetter(data.letter);
        toast.success('Acknowledgement letter generated successfully');
        
        // Refresh the letters status
        await loadLettersStatus();
      }
    } catch (error) {
      console.error('Error generating acknowledgement:', error);
      toast.error('Failed to generate acknowledgement letter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateOutcomeLetter = async (complaintId: string) => {
    if (!outcomeType || !outcomeSummary) {
      toast.error('Please fill in all outcome details');
      return;
    }

    try {
      setSubmitting(true);
      
      const { data, error } = await supabase.functions.invoke('generate-complaint-outcome-letter', {
        body: { 
          complaintId,
          outcomeType,
          outcomeSummary 
        }
      });

      if (error) throw error;

      if (data?.letter) {
        setOutcomeLetter(data.letter);
        setShowOutcomeLetter(true);
        toast.success('Outcome letter generated successfully');
        
        // Refresh the letters status
        await loadLettersStatus();
      }
    } catch (error) {
      console.error('Error generating outcome letter:', error);
      toast.error('Failed to generate outcome letter');
    } finally {
      setSubmitting(false);
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

  const getSubcategoryLabel = (category: string, subcategory: string) => {
    if (!category || !subcategory) return '';
    const categorySuboptions = subcategoryOptions[category];
    if (!categorySuboptions) return subcategory;
    const option = categorySuboptions.find(opt => opt.value === subcategory);
    return option?.label || subcategory;
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

  useEffect(() => {
    // Filter complaints based on filters and search term
    const filtered = complaints.filter(complaint => {
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

      // Dashboard filter logic
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

    setFilteredComplaints(filtered);
    setCurrentPage(1);
  }, [complaints, searchTerm, selectedCategory, selectedStatus, selectedPriority, selectedOutcome, dashboardFilter, lettersStatus]);

  // Pagination logic
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedComplaints = filteredComplaints.slice(startIndex, startIndex + itemsPerPage);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <div className="max-w-md mx-auto">
            <LoginForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4">
        <Tabs defaultValue="complaints" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
            <TabsTrigger value="submit">Submit Complaint</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="practice">Practice Manager</TabsTrigger>
          </TabsList>

          <TabsContent value="complaints" className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Complaints Management</h1>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card 
                className={`cursor-pointer transition-colors ${dashboardFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setDashboardFilter('all')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Complaints</p>
                      <p className="text-2xl font-bold">{complaints.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-colors ${dashboardFilter === 'open' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setDashboardFilter('open')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Open</p>
                      <p className="text-2xl font-bold">
                        {complaints.filter(c => ['submitted', 'under_review'].includes(c.status)).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-colors ${dashboardFilter === 'overdue' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setDashboardFilter('overdue')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Overdue</p>
                      <p className="text-2xl font-bold">
                        {complaints.filter(isOverdue).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-colors ${dashboardFilter === 'closed_this_month' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setDashboardFilter('closed_this_month')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Closed This Month</p>
                      <p className="text-2xl font-bold">
                        {complaints.filter(c => 
                          c.status === 'closed' && 
                          new Date(c.closed_at || '').getMonth() === new Date().getMonth()
                        ).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <Label>Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search complaints..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div>
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
                  <div>
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
                  <div>
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
                  <div>
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
                        <SelectItem value="partially_upheld">Partially Upheld</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="outline" onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("all");
                    setSelectedStatus("all");
                    setSelectedPriority("all");
                    setSelectedOutcome("all");
                    setDashboardFilter("all");
                  }}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Complaints List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading complaints...</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {paginatedComplaints.map((complaint) => (
                  <Card key={complaint.id} className="w-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {complaint.reference_number} - {complaint.complaint_title}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{complaint.patient_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(complaint.incident_date), 'dd/MM/yyyy')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                              {getPriorityLabel(complaint.priority)}
                            </Badge>
                            <Badge variant="outline">
                              {getStatusLabel(complaint.status)}
                            </Badge>
                          </div>
                          {isOverdue(complaint) && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                          
                          {/* Outcome Status */}
                          <div className="text-xs">
                            {lettersStatus[complaint.id]?.hasOutcome ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                {lettersStatus[complaint.id].outcomeType === 'upheld' ? 'Upheld' :
                                 lettersStatus[complaint.id].outcomeType === 'rejected' ? 'Not Upheld' : 
                                 lettersStatus[complaint.id].outcomeType === 'partially_upheld' ? 'Partially Upheld' :
                                 (lettersStatus[complaint.id].outcomeType ? 
                                   lettersStatus[complaint.id].outcomeType.charAt(0).toUpperCase() + 
                                   lettersStatus[complaint.id].outcomeType.slice(1).replace('_', ' ') :
                                   'Completed')}
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
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Manage Workflow
                            </Button>
                            
                            {lettersStatus[complaint.id]?.hasAcknowledgement ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setViewingLetterComplaint(complaint);
                                  setLetterType('acknowledgement');
                                  setModalLetterContent('');
                                  setShowLetterModal(true);
                                }}
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
                                  setViewingLetterComplaint(complaint);
                                  setLetterType('outcome');
                                  setModalLetterContent('');
                                  setShowLetterModal(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                View Outcome Letter
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedComplaint(complaint);
                                  setShowDetails(true);
                                }}
                                disabled={submitting}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Create Outcome
                              </Button>
                            )}
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
                          {complaint.subcategory && (
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                              <span><strong>Subcategory:</strong> {getSubcategoryLabel(complaint.category, complaint.subcategory)}</span>
                            </div>
                          )}
                        </div>
                        {complaint.location_service && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span><strong>Location:</strong> {complaint.location_service}</span>
                          </div>
                        )}
                        <div className="text-sm">
                          <strong>Description:</strong>
                          <p className="mt-1 text-muted-foreground">{complaint.complaint_description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredComplaints.length === 0 && (
                  <Card>
                    <CardContent className="py-8">
                      <div className="text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No complaints found matching your filters.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit New Complaint</CardTitle>
                <CardDescription>
                  Please provide all the details about your complaint to help us address your concerns effectively.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitComplaint} className="space-y-6">
                  {/* Patient Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Patient Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="patient_name">Patient Name *</Label>
                        <Input
                          id="patient_name"
                          value={formData.patient_name}
                          onChange={(e) => handleInputChange('patient_name', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="patient_dob">Date of Birth</Label>
                        <Input
                          id="patient_dob"
                          type="date"
                          value={formData.patient_dob}
                          onChange={(e) => handleInputChange('patient_dob', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="patient_contact_phone">Phone Number</Label>
                        <Input
                          id="patient_contact_phone"
                          type="tel"
                          value={formData.patient_contact_phone}
                          onChange={(e) => handleInputChange('patient_contact_phone', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="patient_contact_email">Email Address</Label>
                        <Input
                          id="patient_contact_email"
                          type="email"
                          value={formData.patient_contact_email}
                          onChange={(e) => handleInputChange('patient_contact_email', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="patient_address">Address</Label>
                      <Textarea
                        id="patient_address"
                        value={formData.patient_address}
                        onChange={(e) => handleInputChange('patient_address', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Complaint Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Complaint Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="incident_date">Incident Date *</Label>
                        <Input
                          id="incident_date"
                          type="date"
                          value={formData.incident_date}
                          onChange={(e) => handleInputChange('incident_date', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                          <SelectTrigger>
                            <SelectValue />
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
                      <div>
                        <Label htmlFor="category">Category *</Label>
                        <Select 
                          value={formData.category} 
                          onValueChange={(value) => {
                            handleInputChange('category', value);
                            handleInputChange('subcategory', ''); // Reset subcategory when category changes
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
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
                      {formData.category && subcategoryOptions[formData.category] && (
                        <div>
                          <Label htmlFor="subcategory">Subcategory</Label>
                          <Select 
                            value={formData.subcategory} 
                            onValueChange={(value) => handleInputChange('subcategory', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              {subcategoryOptions[formData.category].map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="complaint_title">Complaint Title *</Label>
                      <Input
                        id="complaint_title"
                        value={formData.complaint_title}
                        onChange={(e) => handleInputChange('complaint_title', e.target.value)}
                        placeholder="Brief summary of the complaint"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="complaint_description">Complaint Description *</Label>
                      <Textarea
                        id="complaint_description"
                        value={formData.complaint_description}
                        onChange={(e) => handleInputChange('complaint_description', e.target.value)}
                        placeholder="Please provide a detailed description of your complaint..."
                        rows={6}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="location_service">Location/Service</Label>
                      <Input
                        id="location_service"
                        value={formData.location_service}
                        onChange={(e) => handleInputChange('location_service', e.target.value)}
                        placeholder="e.g., Reception, Dr. Smith's office, Pharmacy"
                      />
                    </div>
                    <div>
                      <Label htmlFor="staff_mentioned">Staff Members Involved</Label>
                      <Input
                        id="staff_mentioned"
                        value={formData.staff_mentioned}
                        onChange={(e) => handleInputChange('staff_mentioned', e.target.value)}
                        placeholder="Names of staff members involved (optional)"
                      />
                    </div>
                  </div>

                  {/* Consent Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Consent & Authorization
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          id="complaint_on_behalf"
                          type="checkbox"
                          checked={formData.complaint_on_behalf}
                          onChange={(e) => handleInputChange('complaint_on_behalf', e.target.checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="complaint_on_behalf" className="text-sm">
                          I am making this complaint on behalf of someone else
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          id="consent_given"
                          type="checkbox"
                          checked={formData.consent_given}
                          onChange={(e) => handleInputChange('consent_given', e.target.checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="consent_given" className="text-sm">
                          I consent to the processing of this complaint and understand that information may be shared with relevant parties for investigation purposes
                        </Label>
                      </div>
                      {formData.complaint_on_behalf && (
                        <div>
                          <Label htmlFor="consent_details">Consent Details</Label>
                          <Textarea
                            id="consent_details"
                            value={formData.consent_details}
                            onChange={(e) => handleInputChange('consent_details', e.target.value)}
                            placeholder="Please provide details about your authorization to make this complaint on behalf of the patient..."
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={submitting} className="min-w-32">
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Submitting...
                        </div>
                      ) : (
                        'Submit Complaint'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <ComplaintImport onImport={(data) => {
              setFormData(prev => ({
                ...prev,
                patient_name: data.patient_name || prev.patient_name,
                patient_dob: data.patient_dob || prev.patient_dob,
                patient_contact_phone: data.patient_contact_phone || prev.patient_contact_phone,
                patient_contact_email: data.patient_contact_email || prev.patient_contact_email,
                patient_address: data.patient_address || prev.patient_address,
                incident_date: data.incident_date || prev.incident_date,
                complaint_title: data.complaint_title || prev.complaint_title,
                complaint_description: data.complaint_description || prev.complaint_description,
                category: data.category || prev.category,
                location_service: data.location_service || prev.location_service,
                staff_mentioned: data.staff_mentioned || prev.staff_mentioned,
                priority: data.priority || prev.priority,
                consent_given: data.consent_given !== undefined ? data.consent_given : prev.consent_given,
                complaint_on_behalf: data.complaint_on_behalf !== undefined ? data.complaint_on_behalf : prev.complaint_on_behalf,
              }));
              toast.success('Form populated with imported data - please review and submit');
              setShowImport(false);
            }} onClose={() => setShowImport(false)} />
          </TabsContent>

          <TabsContent value="practice" className="space-y-6">
            <PracticeManager />
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
                      setExistingOutcome(null);
                      setOutcomeType('');
                      setOutcomeSummary('');
                      setAcknowledgementLetter('');
                      setOutcomeLetter('');
                      setShowOutcomeLetter(false);
                      setViewingLetterComplaint(null);
                      setModalLetterContent('');
                      setShowLetterModal(false);
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
                      {selectedComplaint.subcategory && (
                        <div><strong>Subcategory:</strong> {getSubcategoryLabel(selectedComplaint.category, selectedComplaint.subcategory)}</div>
                      )}
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

                {/* Letters Management */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Acknowledgement Letter
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {lettersStatus[selectedComplaint.id]?.hasAcknowledgement ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Generated</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setViewingLetterComplaint(selectedComplaint);
                              setLetterType('acknowledgement');
                              setModalLetterContent('');
                              setShowLetterModal(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            View Letter
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-yellow-600">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-medium">Not Generated</span>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleGenerateAcknowledgement(selectedComplaint.id)}
                            disabled={submitting || selectedComplaint.status !== 'submitted'}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Generate Letter
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Outcome Letter
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {lettersStatus[selectedComplaint.id]?.hasOutcome ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {lettersStatus[selectedComplaint.id].outcomeType === 'upheld' ? 'Upheld' :
                               lettersStatus[selectedComplaint.id].outcomeType === 'rejected' ? 'Not Upheld' : 
                               lettersStatus[selectedComplaint.id].outcomeType === 'partially_upheld' ? 'Partially Upheld' :
                               'Completed'}
                            </span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setViewingLetterComplaint(selectedComplaint);
                              setLetterType('outcome');
                              setModalLetterContent('');
                              setShowLetterModal(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            View Letter
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-yellow-600">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-medium">Not Generated</span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <Label htmlFor="outcomeType">Outcome Type</Label>
                              <Select value={outcomeType} onValueChange={setOutcomeType}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select outcome" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="upheld">Upheld</SelectItem>
                                  <SelectItem value="rejected">Not Upheld</SelectItem>
                                  <SelectItem value="partially_upheld">Partially Upheld</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="outcomeSummary">Outcome Summary</Label>
                              <Textarea
                                id="outcomeSummary"
                                value={outcomeSummary}
                                onChange={(e) => setOutcomeSummary(e.target.value)}
                                placeholder="Brief summary of the outcome..."
                                rows={3}
                              />
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => handleGenerateOutcomeLetter(selectedComplaint.id)}
                              disabled={submitting || !outcomeType || !outcomeSummary}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Generate Outcome
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Letter Viewing Modal */}
        {showLetterModal && viewingLetterComplaint && (
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
                    onClick={async () => {
                      try {
                        const doc = createLetterDocument(
                          modalLetterContent,
                          `${letterType}-${viewingLetterComplaint.reference_number}`
                        );
                        const blob = await Packer.toBlob(doc);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${letterType}-${viewingLetterComplaint.reference_number}.docx`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success('Word document generated successfully');
                      } catch (error) {
                        console.error('Error generating Word document:', error);
                        toast.error('Failed to generate Word document');
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Word
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintsSystem;