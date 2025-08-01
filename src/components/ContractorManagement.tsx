import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { 
  Upload, 
  Search, 
  Filter, 
  Star, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  User,
  Award,
  Briefcase,
  MessageSquare,
  Download,
  X,
  FileImage
} from "lucide-react";

interface Contractor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  trade: string;
  availability_status: string;
  availability_date?: string;
  overall_score: number;
  experience_score: number;
  certification_score: number;
  availability_score: number;
  completeness_score: number;
  status: string;
  ai_summary?: string;
  red_flags?: string[];
  verified: boolean;
  created_at: string;
}

interface ContractorCompetency {
  id: string;
  competency_type: string;
  name: string;
  level: string;
  verified: boolean;
  expiry_date?: string;
  issuing_body?: string;
}

interface ContractorExperience {
  id: string;
  employer: string;
  position?: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
}

interface ContractorRecommendation {
  id: string;
  recommendation_type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

const ContractorManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [competencies, setCompetencies] = useState<ContractorCompetency[]>([]);
  const [experience, setExperience] = useState<ContractorExperience[]>([]);
  const [recommendations, setRecommendations] = useState<ContractorRecommendation[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const trades = [
    "Electrician", "Plumber", "Carpenter", "Heating Engineer", "Gas Engineer",
    "Painter", "Decorator", "Roofer", "Bricklayer", "Plasterer", "Tiler", "Joiner"
  ];

  useEffect(() => {
    if (user) {
      fetchContractors();
    }
  }, [user]);

  const fetchContractors = async () => {
    try {
      const { data, error } = await supabase
        .from('contractors')
        .select('*')
        .order('overall_score', { ascending: false });

      if (error) throw error;
      setContractors(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchContractorDetails = async (contractorId: string) => {
    try {
      // Fetch competencies
      const { data: compData } = await supabase
        .from('contractor_competencies')
        .select('*')
        .eq('contractor_id', contractorId);

      // Fetch experience
      const { data: expData } = await supabase
        .from('contractor_experience')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('start_date', { ascending: false });

      // Fetch recommendations
      const { data: recData } = await supabase
        .from('contractor_recommendations')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('priority', { ascending: false });

      setCompetencies(compData || []);
      setExperience(expData || []);
      setRecommendations(recData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
    
    // Initialize progress tracking
    const initialProgress = fileArray.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploadProgress(initialProgress);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    const newProgress = uploadProgress.filter((_, i) => i !== index);
    setUploadProgress(newProgress);
  };

  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getFileContent = async (file: File): Promise<string> => {
    if (file.type.startsWith('image/')) {
      // For images, return base64 data for OCR processing
      return await processImageFile(file);
    } else {
      // For text files, read as text
      return await file.text();
    }
  };

  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  const uploadMultipleFiles = async () => {
    if (selectedFiles.length === 0 || !user) return;

    setUploading(true);
    
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Update progress
        setUploadProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'uploading' as const, progress: 10 } : p
        ));

        // Create contractor entry
        const { data: contractor, error: contractorError } = await supabase
          .from('contractors')
          .insert({
            user_id: user.id,
            name: 'Processing...',
            trade: 'Unknown',
            status: 'pending'
          })
          .select()
          .single();

        if (contractorError) throw contractorError;

        // Update progress
        setUploadProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 30 } : p
        ));

        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${contractor.id}-${Date.now()}.${fileExt}`;
        const filePath = `resumes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('contractor-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Update progress
        setUploadProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 50 } : p
        ));

        // Create resume record
        const { data: resume, error: resumeError } = await supabase
          .from('contractor_resumes')
          .insert({
            contractor_id: contractor.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id
          })
          .select()
          .single();

        if (resumeError) throw resumeError;

        // Update progress
        setUploadProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'processing' as const, progress: 70 } : p
        ));

        // Get file content
        const fileContent = await getFileContent(file);

        // Process the resume with AI
        const { error: processError } = await supabase.functions.invoke('process-contractor-resume', {
          body: {
            resumeId: resume.id,
            fileContent: fileContent,
            isImage: isImageFile(file)
          }
        });

        if (processError) {
          setUploadProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'error' as const, error: processError.message } : p
          ));
          continue;
        }

        // Update progress to completed
        setUploadProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'completed' as const, progress: 100 } : p
        ));
      }

      toast({
        title: "Success",
        description: `${selectedFiles.length} resume(s) uploaded and processing completed`,
      });

      // Reset and close dialog after a short delay
      setTimeout(() => {
        setShowUploadDialog(false);
        setSelectedFiles([]);
        setUploadProgress([]);
        fetchContractors();
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-amber-500">Good</Badge>;
    if (score >= 40) return <Badge className="bg-orange-500">Fair</Badge>;
    return <Badge variant="destructive">Needs Review</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500">Approved</Badge>;
      case 'needs_review': return <Badge className="bg-amber-500">Needs Review</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  const filteredContractors = contractors.filter(contractor => {
    const matchesSearch = contractor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contractor.trade.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contractor.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTrade = selectedTrade === "all" || contractor.trade === selectedTrade;
    const matchesStatus = selectedStatus === "all" || contractor.status === selectedStatus;
    
    return matchesSearch && matchesTrade && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Upload */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contractor Management</h1>
          <p className="text-muted-foreground">AI-powered contractor screening and management</p>
        </div>
        
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Resume
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Contractor Resumes</DialogTitle>
              <DialogDescription>
                Upload multiple resumes at once. Supported formats: PDF, Word documents, text files, and JPEG images. Our AI will automatically extract and analyze the information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="resumes">Resume Files (Multiple selection supported)</Label>
                <Input
                  id="resumes"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  onChange={handleFileSelection}
                  multiple
                  disabled={uploading}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Select multiple files to upload them all at once
                </p>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files ({selectedFiles.length})</Label>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {file.type.startsWith('image/') ? (
                            <FileImage className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-gray-500" />
                          )}
                          <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={uploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploadProgress.length > 0 && (
                <div className="space-y-3">
                  <Label>Upload Progress</Label>
                  {uploadProgress.map((progress, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{progress.fileName}</span>
                        <div className="flex items-center gap-2">
                          {progress.status === 'completed' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {progress.status === 'error' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          {progress.status === 'uploading' && (
                            <Clock className="h-4 w-4 text-blue-500" />
                          )}
                          {progress.status === 'processing' && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          )}
                          <span className="text-sm capitalize text-muted-foreground">
                            {progress.status}
                          </span>
                        </div>
                      </div>
                      <Progress value={progress.progress} className="h-2" />
                      {progress.error && (
                        <p className="text-xs text-red-500">{progress.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadDialog(false);
                    setSelectedFiles([]);
                    setUploadProgress([]);
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={uploadMultipleFiles}
                  disabled={selectedFiles.length === 0 || uploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}` : 'Files'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search contractors, trades, or locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedTrade} onValueChange={setSelectedTrade}>
              <SelectTrigger>
                <SelectValue placeholder="Trade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {trades.map(trade => (
                  <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          Found {filteredContractors.length} contractor{filteredContractors.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Contractor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredContractors.map(contractor => (
          <Card key={contractor.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {contractor.name}
                    {contractor.verified && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </CardTitle>
                  <CardDescription>{contractor.trade}</CardDescription>
                </div>
                <div className="text-right space-y-1">
                  {getScoreBadge(contractor.overall_score)}
                  <div className="text-sm font-medium">{contractor.overall_score}/100</div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Score Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Experience</span>
                  <span>{contractor.experience_score}/40</span>
                </div>
                <Progress value={(contractor.experience_score / 40) * 100} className="h-2" />
                
                <div className="flex justify-between text-sm">
                  <span>Certifications</span>
                  <span>{contractor.certification_score}/30</span>
                </div>
                <Progress value={(contractor.certification_score / 30) * 100} className="h-2" />
              </div>

              {/* Contact & Location */}
              <div className="space-y-2 text-sm">
                {contractor.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{contractor.location}</span>
                  </div>
                )}
                {contractor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{contractor.email}</span>
                  </div>
                )}
                {contractor.availability_status !== 'unknown' && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{contractor.availability_status.replace('_', ' ')}</span>
                  </div>
                )}
              </div>

              {/* Red Flags */}
              {contractor.red_flags && contractor.red_flags.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    {contractor.red_flags.length} concern{contractor.red_flags.length !== 1 ? 's' : ''} identified
                  </span>
                </div>
              )}

              {/* Status */}
              <div className="flex justify-between items-center">
                {getStatusBadge(contractor.status)}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedContractor(contractor);
                    fetchContractorDetails(contractor.id);
                  }}
                >
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContractors.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No contractors found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or upload a new resume
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contractor Details Dialog */}
      {selectedContractor && (
        <Dialog open={!!selectedContractor} onOpenChange={() => setSelectedContractor(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedContractor.name}
                {selectedContractor.verified && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedContractor.trade} • Score: {selectedContractor.overall_score}/100
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="experience">Experience</TabsTrigger>
                <TabsTrigger value="competencies">Skills & Certs</TabsTrigger>
                <TabsTrigger value="recommendations">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* AI Summary */}
                {selectedContractor.ai_summary && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">AI Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedContractor.ai_summary}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Score Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Experience ({selectedContractor.experience_score}/40)</span>
                          <span>{Math.round((selectedContractor.experience_score / 40) * 100)}%</span>
                        </div>
                        <Progress value={(selectedContractor.experience_score / 40) * 100} />
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Certifications ({selectedContractor.certification_score}/30)</span>
                          <span>{Math.round((selectedContractor.certification_score / 30) * 100)}%</span>
                        </div>
                        <Progress value={(selectedContractor.certification_score / 30) * 100} />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Availability ({selectedContractor.availability_score}/20)</span>
                          <span>{Math.round((selectedContractor.availability_score / 20) * 100)}%</span>
                        </div>
                        <Progress value={(selectedContractor.availability_score / 20) * 100} />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Profile Completeness ({selectedContractor.completeness_score}/10)</span>
                          <span>{Math.round((selectedContractor.completeness_score / 10) * 100)}%</span>
                        </div>
                        <Progress value={(selectedContractor.completeness_score / 10) * 100} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Red Flags */}
                {selectedContractor.red_flags && selectedContractor.red_flags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg text-red-600">Concerns Identified</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedContractor.red_flags.map((flag, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                            <span className="text-sm">{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="experience" className="space-y-4">
                {experience.length > 0 ? (
                  experience.map(exp => (
                    <Card key={exp.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{exp.position || 'Position'}</h4>
                            <p className="text-muted-foreground">{exp.employer}</p>
                            <p className="text-sm text-muted-foreground">
                              {exp.start_date} - {exp.is_current ? 'Present' : exp.end_date || 'Unknown'}
                            </p>
                            {exp.description && (
                              <p className="text-sm mt-2">{exp.description}</p>
                            )}
                          </div>
                          {exp.is_current && (
                            <Badge variant="outline">Current</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No experience data available</p>
                )}
              </TabsContent>

              <TabsContent value="competencies" className="space-y-4">
                {competencies.length > 0 ? (
                  <div className="space-y-4">
                    {['certification', 'skill', 'tool', 'system'].map(type => {
                      const items = competencies.filter(c => c.competency_type === type);
                      if (items.length === 0) return null;

                      return (
                        <Card key={type}>
                          <CardHeader>
                            <CardTitle className="text-lg capitalize">{type}s</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {items.map(comp => (
                                <div key={comp.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <p className="font-medium">{comp.name}</p>
                                    {comp.level !== 'unknown' && (
                                      <p className="text-sm text-muted-foreground capitalize">{comp.level}</p>
                                    )}
                                    {comp.issuing_body && (
                                      <p className="text-xs text-muted-foreground">{comp.issuing_body}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {comp.verified && <CheckCircle className="h-4 w-4 text-green-500" />}
                                    {comp.expiry_date && (
                                      <Badge variant="outline" className="text-xs">
                                        Expires: {comp.expiry_date}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No competencies data available</p>
                )}
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                {recommendations.length > 0 ? (
                  recommendations.map(rec => (
                    <Card key={rec.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{rec.title}</h4>
                              <Badge 
                                variant={rec.priority === 'high' ? 'destructive' : 
                                        rec.priority === 'medium' ? 'default' : 'outline'}
                              >
                                {rec.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.description}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {rec.recommendation_type}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No recommendations available</p>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ContractorManagement;