import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { SpeechToText } from "@/components/SpeechToText";
import { toast } from "sonner";
import { 
  MessageSquare, 
  User, 
  Mail, 
  Calendar, 
  Building, 
  Send,
  ArrowLeft,
  FileText 
} from "lucide-react";
import { format } from "date-fns";

interface Complaint {
  id: string;
  reference_number: string;
  patient_name: string;
  incident_date: string;
  complaint_title: string;
  complaint_description: string;
  category: string;
  location_service: string | null;
  staff_mentioned: string[] | null;
  created_at: string;
}

const StaffFeedback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState("");
  const [responseSubmitted, setResponseSubmitted] = useState(false);

  const complaintId = searchParams.get('complaintId');
  const staffName = searchParams.get('staffName');
  const staffEmail = searchParams.get('staffEmail');
  const staffRole = searchParams.get('staffRole');

  useEffect(() => {
    if (complaintId) {
      fetchComplaint();
    }
  }, [complaintId]);

  const fetchComplaint = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('id', complaintId)
        .single();

      if (error) throw error;
      setComplaint(data);
    } catch (error) {
      console.error('Error fetching complaint:', error);
      toast.error('Failed to load complaint details');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceTranscription = (text: string) => {
    if (response.trim()) {
      setResponse(response + " " + text);
    } else {
      setResponse(text);
    }
  };

  const handleSubmitResponse = async () => {
    if (!response.trim()) {
      toast.error('Please provide a response before submitting');
      return;
    }

    setSubmitting(true);
    try {
      // Store the staff response in the database
      const { error } = await (supabase as any)
        .from('staff_responses')
        .insert({
          complaint_id: complaintId,
          staff_name: staffName,
          staff_email: staffEmail,
          staff_role: staffRole || null,
          response_text: response.trim(),
          responded_by: user?.id || null,
          responded_at: new Date().toISOString()
        });

      if (error) throw error;

      setResponseSubmitted(true);
      toast.success('Your response has been submitted successfully');
      
      // Clear the response after successful submission
      setResponse("");
      
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
              <CardDescription>
                Please log in to provide your response to this complaint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading complaint details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <FileText className="h-5 w-5" />
                Complaint Not Found
              </CardTitle>
              <CardDescription>
                The complaint you're trying to respond to could not be found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/complaints')} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Complaints
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Staff Response</h1>
              <p className="text-muted-foreground mt-1">
                Provide your response to complaint {complaint.reference_number}
              </p>
            </div>
            <Button onClick={() => navigate('/complaints')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Complaints
            </Button>
          </div>

          {/* Staff Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Staff Member Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{staffName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{staffEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium">{staffRole || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Complaint Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Complaint Details - {complaint.reference_number}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{complaint.category}</Badge>
                <span className="text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  {format(new Date(complaint.incident_date), 'dd MMM yyyy')}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Patient Name</Label>
                <p className="font-medium">{complaint.patient_name}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Complaint Title</Label>
                <p className="font-medium">{complaint.complaint_title}</p>
              </div>

              {complaint.location_service && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Location/Service</Label>
                  <p>{complaint.location_service}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Complaint Description</Label>
                <p className="text-sm leading-relaxed bg-gray-50 p-3 rounded-md">
                  {complaint.complaint_description}
                </p>
              </div>

              {complaint.staff_mentioned && complaint.staff_mentioned.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Staff Mentioned</Label>
                  <p>{complaint.staff_mentioned.join(', ')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Your Response
              </CardTitle>
              <CardDescription>
                Please provide your detailed response to this complaint. Your input will help with the investigation and resolution process.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {responseSubmitted && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <p className="text-green-800 font-medium">
                    ✓ Your response has been submitted successfully!
                  </p>
                  <p className="text-green-700 text-sm mt-1">
                    Thank you for providing your input. The complaint handler will review your response.
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="response">Response Details</Label>
                  <SpeechToText 
                    onTranscription={handleVoiceTranscription}
                    size="sm"
                  />
                </div>
                <Textarea
                  id="response"
                  placeholder="Please provide your detailed response, including:&#10;• Your recollection of the events&#10;• Any relevant context or circumstances&#10;• Actions you took or would take differently&#10;• Any other information that might help resolve this complaint"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={8}
                  className="mt-1"
                  disabled={responseSubmitted}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {response.length} characters
                </p>
              </div>

              <Button
                onClick={handleSubmitResponse}
                disabled={submitting || !response.trim() || responseSubmitted}
                className="w-full sm:w-auto"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting...' : responseSubmitted ? 'Response Submitted' : 'Submit Response'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StaffFeedback;