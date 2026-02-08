import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, CheckCircle, AlertCircle, Mail, Sparkles, Loader2 } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { SimpleBrowserMic } from '@/components/ai4gp/SimpleBrowserMic';
interface ComplaintDetails {
  complaint_id: string;
  reference_number: string;
  complaint_title: string;
  complaint_description: string;
  category: string;
  incident_date: string;
  location_service: string;
  staff_name: string;
  staff_email: string;
  staff_role: string;
  response_text: string | null;
  response_submitted: boolean;
}

export default function ComplaintResponse() {
  const { token: routeToken } = useParams<{ token: string }>();
  const [complaint, setComplaint] = useState<ComplaintDetails | null>(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  
  // Find token from route params, query string, or hash (to support various email client behaviours)
  const getEffectiveToken = (): string | null => {
    if (routeToken) return routeToken;
    try {
      const url = new URL(window.location.href);
      const qsToken = url.searchParams.get('accessToken') || url.searchParams.get('token') || url.searchParams.get('t');
      if (qsToken) return qsToken;
      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const hashToken = hashParams.get('accessToken') || hashParams.get('token') || hashParams.get('t');
        if (hashToken) return hashToken;
      }
    } catch (e) {
      console.warn('Unable to parse URL for token', e);
    }
    return null;
  };

  useEffect(() => {
    const t = getEffectiveToken();
    setToken(t);
    if (t) {
      fetchComplaintDetails();
    } else {
      setLoading(false);
      setShowManualEntry(true);
    }
  }, [routeToken]);

  const fetchComplaintDetails = async (providedToken?: string) => {
    try {
      const effective = providedToken || routeToken || getEffectiveToken();
      console.log('Fetching complaint with access token:', effective);

      if (!effective) {
        setError('Invalid access link - no token provided');
        setLoading(false);
        setShowManualEntry(true);
        return;
      }
      
      setLoading(true);
      setError('');

      // Timeout safeguard to avoid infinite loading on some mobile browsers
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        setError('This link is taking longer than expected to load. Please try again or request a new link.');
        setLoading(false);
      }, 12000);

      const { data, error } = await supabase.rpc('get_complaint_for_external_access', {
        access_token_param: effective
      });

      if (!timedOut) {
        clearTimeout(timeoutId);
      }

      console.log('RPC Response:', { data, error });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const complaintData = data[0];
        console.log('Complaint data loaded:', complaintData);
        setComplaint(complaintData);
        setResponse(complaintData.response_text || '');
        setToken(effective);
        setShowManualEntry(false);
      } else {
        console.warn('No complaint data returned');
        setError('Complaint not found or access link has expired. Please check your email for a valid link.');
        setShowManualEntry(true);
      }
    } catch (err) {
      console.error('Error fetching complaint:', err);
      setError(`Failed to load complaint details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!response.trim()) {
      showToast.error('Please enter your response', { section: 'complaints' });
      return;
    }

    setSubmitting(true);
    try {
      if (!token) {
        showToast.error('Invalid access link - missing token', { section: 'complaints' });
        setSubmitting(false);
        return;
      }
      
      console.log('Submitting response with token:', token);
      const { data, error } = await supabase.rpc('submit_external_response', {
        access_token_param: token,
        response_text_param: response
      });

      console.log('Submit response result:', { data, error });

      if (error) {
        console.error('Submit error details:', JSON.stringify(error, null, 2));
        throw new Error(error.message || error.hint || 'Failed to submit response');
      }

      if (data === false) {
        throw new Error('This link has expired or is invalid. Please request a new link from the practice.');
      }

      if (data === true) {
        showToast.success('Response submitted successfully', { section: 'complaints' });
        await fetchComplaintDetails(); // Refresh to show updated status
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err) {
      console.error('Error submitting response:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit response';
      showToast.error(errorMessage, { section: 'complaints' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualTokenSubmit = () => {
    if (!manualToken.trim()) {
      showToast.error('Please enter your access code', { section: 'complaints' });
      return;
    }
    fetchComplaintDetails(manualToken.trim());
  };

  const handleLoadDemo = async () => {
    if (!complaint) return;

    setIsGeneratingDemo(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-staff-demo-notes', {
        body: {
          complaintId: complaint.complaint_id,
          staffRole: complaint.staff_role,
          staffName: complaint.staff_name
        }
      });

      if (error) throw error;

      if (data?.notes) {
        setResponse(data.notes);
        showToast.success(`Demo notes loaded for ${complaint.staff_role}`, { section: 'complaints' });
      } else {
        throw new Error('No notes generated');
      }
    } catch (err) {
      console.error('Error generating demo notes:', err);
      showToast.error('Failed to generate demo notes', { section: 'complaints' });
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading complaint details...</p>
        </div>
      </div>
    );
  }

  if (showManualEntry && !complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Complaint Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please enter the access code from your email to view the complaint details.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <label className="text-sm font-medium">Access Code</label>
              <Textarea
                placeholder="Paste your access code here..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                rows={3}
                className="font-mono"
              />
            </div>
            <Button 
              onClick={handleManualTokenSubmit}
              disabled={!manualToken.trim() || loading}
              className="w-full"
            >
              {loading ? 'Loading...' : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !showManualEntry) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => setShowManualEntry(true)}
              variant="outline"
              className="w-full"
            >
              Enter Access Code Manually
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No complaint found</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">NHS Complaint Response</h1>
            <p className="text-muted-foreground mt-2">
              Please review the complaint details and provide your response
            </p>
            {!showManualEntry && (
              <button
                onClick={() => setShowManualEntry(true)}
                className="text-sm text-primary hover:underline mt-2"
              >
                Having trouble? Enter access code manually
              </button>
            )}
          </div>

          <Alert className="border-blue-200 bg-blue-50">
            <Mail className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Important:</strong> For specific details about staff members, patients, or other identifiable information, 
              please refer to the email notification you received from the system.
            </AlertDescription>
          </Alert>

          {complaint.response_submitted && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your response has been submitted successfully. Thank you for your cooperation.
              </AlertDescription>
            </Alert>
          )}

          {!complaint.response_submitted && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Action Required:</strong> Please provide your response to this complaint. 
                This link expires 14 days after it was sent to you.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Complaint Details</span>
                <Badge variant="outline">{complaint.reference_number}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">{complaint.complaint_title}</h3>
                <p className="text-muted-foreground">{complaint.complaint_description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {complaint.category.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Incident Date: {new Date(complaint.incident_date).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Service Area: {complaint.location_service ? 'Specified in email' : 'Not specified'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Please provide your response to this complaint. Include any relevant information about the incident and any actions taken.
                </p>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Enter your response here..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={10}
                    disabled={complaint.response_submitted}
                    className="min-h-[200px]"
                  />
                  {!complaint.response_submitted && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <SimpleBrowserMic
                          onTranscriptUpdate={(transcript) => setResponse(transcript)}
                          disabled={complaint.response_submitted}
                        />

                        <Button
                          onClick={handleLoadDemo}
                          disabled={isGeneratingDemo}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          {isGeneratingDemo ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Load Demo
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Click the microphone to dictate your response using your browser's speech recognition
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {!complaint.response_submitted && (
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSubmitResponse}
                    disabled={submitting || !response.trim()}
                    className="px-8"
                  >
                    {submitting ? 'Submitting...' : 'Submit Response'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              This is a secure link for responding to NHS complaint reference {complaint.reference_number}.
              If you have any questions, please contact the practice directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}