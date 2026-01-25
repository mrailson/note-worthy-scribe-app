import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, BarChart3, Users, Clock, TrendingUp, Star } from 'lucide-react';
import { format, subDays, isWithinInterval } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  display_order: number;
}

interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string | null;
  answer_rating: number | null;
  answer_options: string[] | null;
}

interface Response {
  id: string;
  submitted_at: string;
  respondent_name: string | null;
  respondent_email: string | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const SurveyResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState('all');

  const { data: survey, isLoading: surveyLoading } = useQuery({
    queryKey: ['survey', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: questions } = useQuery({
    queryKey: ['survey-questions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', id)
        .order('display_order');

      if (error) throw error;
      return data as Question[];
    },
    enabled: !!id,
  });

  const { data: responses } = useQuery({
    queryKey: ['survey-responses', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as Response[];
    },
    enabled: !!id,
  });

  const { data: answers } = useQuery({
    queryKey: ['survey-answers', id],
    queryFn: async () => {
      if (!responses || responses.length === 0) return [];
      
      const responseIds = responses.map((r) => r.id);
      const { data, error } = await supabase
        .from('survey_answers')
        .select('*')
        .in('response_id', responseIds);

      if (error) throw error;
      return data as Answer[];
    },
    enabled: !!responses && responses.length > 0,
  });

  // Filter responses by date range
  const filteredResponses = responses?.filter((response) => {
    if (dateRange === 'all') return true;
    
    const submittedDate = new Date(response.submitted_at);
    const now = new Date();
    
    switch (dateRange) {
      case '7days':
        return isWithinInterval(submittedDate, { start: subDays(now, 7), end: now });
      case '30days':
        return isWithinInterval(submittedDate, { start: subDays(now, 30), end: now });
      case '90days':
        return isWithinInterval(submittedDate, { start: subDays(now, 90), end: now });
      default:
        return true;
    }
  });

  const filteredResponseIds = new Set(filteredResponses?.map((r) => r.id) || []);
  const filteredAnswers = answers?.filter((a) => filteredResponseIds.has(a.response_id));

  // Calculate statistics for each question
  const getQuestionStats = (questionId: string, questionType: string, options: string[] | null) => {
    const questionAnswers = filteredAnswers?.filter((a) => a.question_id === questionId) || [];
    
    if (questionType === 'rating' || questionType === 'scale') {
      const ratings = questionAnswers
        .filter((a) => a.answer_rating !== null)
        .map((a) => a.answer_rating!);
      
      if (ratings.length === 0) return null;
      
      const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      const max = questionType === 'rating' ? 5 : 10;
      
      const distribution = Array.from({ length: max }, (_, i) => ({
        label: String(i + 1),
        count: ratings.filter((r) => r === i + 1).length,
      }));
      
      return { type: 'rating', average, max, distribution, total: ratings.length };
    }
    
    if (questionType === 'yes_no') {
      const yesCount = questionAnswers.filter((a) => 
        a.answer_text?.toLowerCase() === 'yes'
      ).length;
      const noCount = questionAnswers.filter((a) => 
        a.answer_text?.toLowerCase() === 'no'
      ).length;
      
      return {
        type: 'yes_no',
        data: [
          { name: 'Yes', value: yesCount },
          { name: 'No', value: noCount },
        ],
        total: yesCount + noCount,
      };
    }
    
    if (questionType === 'multiple_choice' && options) {
      const optionCounts = options.map((opt) => ({
        name: opt,
        value: questionAnswers.filter((a) => 
          a.answer_text === opt || a.answer_options?.includes(opt)
        ).length,
      }));
      
      return { type: 'multiple_choice', data: optionCounts, total: questionAnswers.length };
    }
    
    if (questionType === 'text') {
      const textAnswers = questionAnswers
        .filter((a) => a.answer_text)
        .map((a) => a.answer_text!);
      
      return { type: 'text', answers: textAnswers, total: textAnswers.length };
    }
    
    return null;
  };

  const exportToCSV = () => {
    if (!questions || !filteredResponses || !filteredAnswers) return;

    const headers = ['Response ID', 'Submitted At', ...questions.map((q) => q.question_text)];
    
    const rows = filteredResponses.map((response) => {
      const responseAnswers = filteredAnswers.filter((a) => a.response_id === response.id);
      const row = [
        response.id,
        format(new Date(response.submitted_at), 'dd/MM/yyyy HH:mm'),
      ];
      
      questions.forEach((question) => {
        const answer = responseAnswers.find((a) => a.question_id === question.id);
        if (answer) {
          if (answer.answer_rating !== null) {
            row.push(String(answer.answer_rating));
          } else if (answer.answer_text) {
            row.push(answer.answer_text);
          } else if (answer.answer_options) {
            row.push(answer.answer_options.join('; '));
          } else {
            row.push('');
          }
        } else {
          row.push('');
        }
      });
      
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${survey?.title || 'survey'}-results-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast({
      title: 'Export complete',
      description: 'Survey results exported to CSV',
    });
  };

  if (surveyLoading) {
    return (
      <ProtectedRoute requiredModule="survey_manager_access">
        <div className="min-h-screen bg-gradient-subtle">
          <Header onNewMeeting={() => {}} />
          <main className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="grid grid-cols-3 gap-4 mt-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-muted rounded" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!survey) {
    return (
      <ProtectedRoute requiredModule="survey_manager_access">
        <div className="min-h-screen bg-gradient-subtle">
          <Header onNewMeeting={() => {}} />
          <main className="container mx-auto px-4 py-8 text-center">
            <p className="text-muted-foreground">Survey not found</p>
            <Button onClick={() => navigate('/surveys')} className="mt-4">
              Back to Surveys
            </Button>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const totalResponses = filteredResponses?.length || 0;
  const averageRating = (() => {
    const ratingQuestions = questions?.filter((q) => q.question_type === 'rating') || [];
    if (ratingQuestions.length === 0 || !filteredAnswers) return null;
    
    const allRatings = ratingQuestions.flatMap((q) =>
      filteredAnswers
        .filter((a) => a.question_id === q.id && a.answer_rating !== null)
        .map((a) => a.answer_rating!)
    );
    
    if (allRatings.length === 0) return null;
    return allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;
  })();

  return (
    <ProtectedRoute requiredModule="survey_manager_access">
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/surveys')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{survey.title}</h1>
                <p className="text-muted-foreground">Survey Results Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalResponses}</p>
                    <p className="text-sm text-muted-foreground">Total Responses</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {averageRating !== null && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                      <Star className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{averageRating.toFixed(1)}/5</p>
                      <p className="text-sm text-muted-foreground">Average Rating</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{questions?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Questions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Results */}
          {totalResponses === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No responses yet</p>
                <p className="text-muted-foreground">
                  Share your survey link to start collecting responses
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {questions?.map((question) => {
                const stats = getQuestionStats(question.id, question.question_type, question.options as string[] | null);
                if (!stats) return null;

                return (
                  <Card key={question.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{question.question_text}</CardTitle>
                      <CardDescription>
                        {stats.total} response{stats.total !== 1 ? 's' : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {stats.type === 'rating' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl font-bold">
                              {stats.average.toFixed(1)}
                            </div>
                            <div className="text-muted-foreground">
                              out of {stats.max}
                            </div>
                          </div>
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stats.distribution}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {(stats.type === 'yes_no' || stats.type === 'multiple_choice') && (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(0)}%`
                                }
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {stats.data.map((_, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {stats.type === 'text' && (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {stats.answers.length === 0 ? (
                            <p className="text-muted-foreground">No text responses</p>
                          ) : (
                            stats.answers.map((answer, index) => (
                              <div
                                key={index}
                                className="p-3 bg-muted rounded-lg text-sm"
                              >
                                "{answer}"
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default SurveyResults;
