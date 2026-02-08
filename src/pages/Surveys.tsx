import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Search, QrCode, BarChart3, Edit, Pause, Play, Archive, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { QRCodeModal } from '@/components/survey/QRCodeModal';

interface Survey {
  id: string;
  title: string;
  description: string | null;
  survey_type: string;
  status: string;
  is_anonymous: boolean;
  start_date: string | null;
  end_date: string | null;
  public_token: string;
  short_code: string;
  created_at: string;
  response_count?: number;
}

const surveyTypeLabels: Record<string, string> = {
  patient_experience: 'Patient Experience',
  staff: 'Staff Survey',
  custom: 'Custom',
  event_training: 'Event/Training',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  closed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const Surveys = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);

  const { data: surveys, isLoading, refetch } = useQuery({
    queryKey: ['surveys', user?.id],
    queryFn: async () => {
      const { data: surveysData, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get response counts for each survey
      const surveysWithCounts = await Promise.all(
        (surveysData || []).map(async (survey) => {
          const { count } = await supabase
            .from('survey_responses')
            .select('*', { count: 'exact', head: true })
            .eq('survey_id', survey.id);
          
          return { ...survey, response_count: count || 0 };
        })
      );

      return surveysWithCounts as Survey[];
    },
    enabled: !!user,
  });

  const filteredSurveys = surveys?.filter((survey) => {
    const matchesSearch = survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      survey.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || survey.survey_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || survey.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleStatusChange = async (surveyId: string, newStatus: string) => {
    const { error } = await supabase
      .from('surveys')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', surveyId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update survey status',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `Survey ${newStatus === 'active' ? 'activated' : newStatus}`,
      });
      refetch();
    }
  };

  const handleDeleteSurvey = async (surveyId: string) => {
    try {
      // 1. Get all question IDs for this survey (needed to delete answers)
      const { data: questionRows } = await supabase
        .from('survey_questions')
        .select('id')
        .eq('survey_id', surveyId);

      const questionIds = (questionRows || []).map((q) => q.id);

      // 2. Delete answers referencing those questions
      if (questionIds.length > 0) {
        const { error: answersError } = await supabase
          .from('survey_answers')
          .delete()
          .in('question_id', questionIds);

        if (answersError) {
          console.error('Error deleting answers:', answersError);
        }
      }

      // 3. Delete responses
      const { error: responsesError } = await supabase
        .from('survey_responses')
        .delete()
        .eq('survey_id', surveyId);

      if (responsesError) {
        console.error('Error deleting responses:', responsesError);
      }

      // 4. Delete questions
      if (questionIds.length > 0) {
        const { error: questionsError } = await supabase
          .from('survey_questions')
          .delete()
          .eq('survey_id', surveyId);

        if (questionsError) {
          console.error('Error deleting questions:', questionsError);
        }
      }

      // 5. Delete the survey itself
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete survey',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Survey deleted',
          description: 'The survey has been permanently removed',
        });
        refetch();
      }
    } catch (err) {
      console.error('Error during survey deletion:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while deleting the survey',
        variant: 'destructive',
      });
    }
  };

  const copyLink = (shortCode: string) => {
    const url = `${window.location.origin}/s/${shortCode}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copied',
      description: 'Short survey link copied to clipboard',
    });
  };

  const openQRModal = (survey: Survey) => {
    setSelectedSurvey(survey);
    setQrModalOpen(true);
  };

  return (
    <ProtectedRoute requiredModule="survey_manager_access">
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">Surveys</h1>
              <p className="text-muted-foreground">Create and manage surveys for your practice</p>
            </div>
            <Button onClick={() => navigate('/surveys/create')} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Survey
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search surveys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="patient_experience">Patient Experience</SelectItem>
                <SelectItem value="staff">Staff Survey</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="event_training">Event/Training</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Survey List */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredSurveys?.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground mb-4">No surveys found</p>
                <Button onClick={() => navigate('/surveys/create')}>
                  Create your first survey
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSurveys?.map((survey) => (
                <Card key={survey.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">{survey.title}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                          {survey.description || 'No description'}
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[survey.status]}>
                        {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">{surveyTypeLabels[survey.survey_type]}</Badge>
                      {survey.is_anonymous && (
                        <Badge variant="secondary">Anonymous</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {survey.response_count} response{survey.response_count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        Created {format(new Date(survey.created_at), 'dd MMM yyyy')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/surveys/${survey.id}/edit`)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/surveys/${survey.id}/results`)}
                      >
                        <BarChart3 className="h-3.5 w-3.5 mr-1" />
                        Results
                      </Button>
                      {survey.status === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(survey.id, 'paused')}
                        >
                          <Pause className="h-3.5 w-3.5 mr-1" />
                          Pause
                        </Button>
                      ) : survey.status === 'draft' || survey.status === 'paused' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(survey.id, 'active')}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Activate
                        </Button>
                      ) : null}
                      {survey.status !== 'closed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(survey.id, 'closed')}
                        >
                          <Archive className="h-3.5 w-3.5 mr-1" />
                          Close
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Survey</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete "{survey.title}"? This will also delete all {survey.response_count} response{survey.response_count !== 1 ? 's' : ''}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSurvey(survey.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(survey.short_code)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openQRModal(survey)}
                      >
                        <QrCode className="h-3.5 w-3.5 mr-1" />
                        QR
                      </Button>
                      {survey.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/survey/${survey.public_token}`, '_blank')}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Preview
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>

        {selectedSurvey && (
          <QRCodeModal
            open={qrModalOpen}
            onOpenChange={setQrModalOpen}
            surveyTitle={selectedSurvey.title}
            publicToken={selectedSurvey.public_token}
            shortCode={selectedSurvey.short_code}
          />
        )}
      </div>
    </ProtectedRoute>
  );
};

export default Surveys;
