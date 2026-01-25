import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ArrowRight, Plus, Trash2, GripVertical, Save, Eye, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SurveyImportModal } from '@/components/surveys/SurveyImportModal';
import { ImportedQuestion } from '@/hooks/useSurveyImport';
interface Question {
  id?: string;
  question_text: string;
  question_type: 'rating' | 'text' | 'multiple_choice' | 'yes_no' | 'scale';
  options: string[];
  is_required: boolean;
  display_order: number;
}

interface SurveyData {
  title: string;
  description: string;
  survey_type: 'patient_experience' | 'staff' | 'custom' | 'event_training';
  is_anonymous: boolean;
  start_date: Date | null;
  end_date: Date | null;
}

const questionTypeLabels: Record<string, string> = {
  rating: 'Rating (1-5 stars)',
  text: 'Free Text',
  multiple_choice: 'Multiple Choice',
  yes_no: 'Yes/No',
  scale: 'Scale (1-10)',
};

const questionTemplates: Record<string, Question[]> = {
  patient_experience: [
    {
      question_text: 'How likely are you to recommend our practice to friends and family?',
      question_type: 'scale',
      options: [],
      is_required: true,
      display_order: 1,
    },
    {
      question_text: 'How would you rate your overall experience today?',
      question_type: 'rating',
      options: [],
      is_required: true,
      display_order: 2,
    },
    {
      question_text: 'Is there anything we could improve?',
      question_type: 'text',
      options: [],
      is_required: false,
      display_order: 3,
    },
  ],
  staff: [
    {
      question_text: 'How satisfied are you with your work-life balance?',
      question_type: 'rating',
      options: [],
      is_required: true,
      display_order: 1,
    },
    {
      question_text: 'Do you feel supported by management?',
      question_type: 'yes_no',
      options: [],
      is_required: true,
      display_order: 2,
    },
    {
      question_text: 'What would make this a better place to work?',
      question_type: 'text',
      options: [],
      is_required: false,
      display_order: 3,
    },
  ],
  event_training: [
    {
      question_text: 'How useful was this session?',
      question_type: 'rating',
      options: [],
      is_required: true,
      display_order: 1,
    },
    {
      question_text: 'Would you recommend this training to colleagues?',
      question_type: 'yes_no',
      options: [],
      is_required: true,
      display_order: 2,
    },
    {
      question_text: 'Any suggestions for future sessions?',
      question_type: 'text',
      options: [],
      is_required: false,
      display_order: 3,
    },
  ],
  custom: [],
};

const SurveyBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState('details');
  const [isSaving, setIsSaving] = useState(false);
  const [practiceId, setPracticeId] = useState<string | null>(null);

  const [surveyData, setSurveyData] = useState<SurveyData>({
    title: '',
    description: '',
    survey_type: 'custom',
    is_anonymous: true,
    start_date: null,
    end_date: null,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);

  // Fetch practice ID
  useEffect(() => {
    const fetchPracticeId = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', user.id)
        .not('practice_id', 'is', null)
        .single();
      
      if (data?.practice_id) {
        setPracticeId(data.practice_id);
      }
    };
    
    fetchPracticeId();
  }, [user]);

  // Fetch existing survey if editing
  useEffect(() => {
    const fetchSurvey = async () => {
      if (!id) return;

      const { data: survey, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !survey) {
        toast({
          title: 'Error',
          description: 'Failed to load survey',
          variant: 'destructive',
        });
        navigate('/surveys');
        return;
      }

      setSurveyData({
        title: survey.title,
        description: survey.description || '',
        survey_type: survey.survey_type as SurveyData['survey_type'],
        is_anonymous: survey.is_anonymous,
        start_date: survey.start_date ? new Date(survey.start_date) : null,
        end_date: survey.end_date ? new Date(survey.end_date) : null,
      });

      const { data: questionsData } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', id)
        .order('display_order');

      if (questionsData) {
        setQuestions(
          questionsData.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type as Question['question_type'],
            options: (q.options as string[]) || [],
            is_required: q.is_required,
            display_order: q.display_order,
          }))
        );
      }
    };

    fetchSurvey();
  }, [id, navigate, toast]);

  const handleTypeChange = (newType: SurveyData['survey_type']) => {
    setSurveyData((prev) => ({ ...prev, survey_type: newType }));
    
    // Suggest templates for new surveys
    if (!isEditing && questions.length === 0 && questionTemplates[newType]?.length > 0) {
      setQuestions(questionTemplates[newType]);
    }
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        question_type: 'rating',
        options: [],
        is_required: true,
        display_order: prev.length + 1,
      },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      const newQuestions = prev.filter((_, i) => i !== index);
      return newQuestions.map((q, i) => ({ ...q, display_order: i + 1 }));
    });
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    setQuestions((prev) => {
      const newQuestions = [...prev];
      [newQuestions[index], newQuestions[newIndex]] = [
        newQuestions[newIndex],
        newQuestions[index],
      ];
      return newQuestions.map((q, i) => ({ ...q, display_order: i + 1 }));
    });
  };

  const handleImportQuestions = (title: string, importedQuestions: ImportedQuestion[]) => {
    // Update title if currently empty
    if (!surveyData.title.trim() && title) {
      setSurveyData(prev => ({ ...prev, title }));
    }

    // Convert imported questions to Question format and merge
    const startOrder = questions.length + 1;
    const newQuestions: Question[] = importedQuestions.map((q, idx) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options || [],
      is_required: q.is_required,
      display_order: startOrder + idx,
    }));

    setQuestions(prev => [...prev, ...newQuestions]);
    
    toast({
      title: 'Questions imported',
      description: `Added ${newQuestions.length} question${newQuestions.length !== 1 ? 's' : ''} to your survey`,
    });
  };

  const handleSave = async (asDraft = false) => {
    if (!user || !practiceId) {
      toast({
        title: 'Error',
        description: 'Unable to save survey. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    if (!surveyData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a survey title',
        variant: 'destructive',
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one question',
        variant: 'destructive',
      });
      return;
    }

    const emptyQuestions = questions.filter((q) => !q.question_text.trim());
    if (emptyQuestions.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'All questions must have text',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const surveyPayload = {
        title: surveyData.title.trim(),
        description: surveyData.description.trim() || null,
        survey_type: surveyData.survey_type,
        is_anonymous: surveyData.is_anonymous,
        start_date: surveyData.start_date?.toISOString() || null,
        end_date: surveyData.end_date?.toISOString() || null,
        status: asDraft ? 'draft' : 'active',
        practice_id: practiceId,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      let surveyId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('surveys')
          .update(surveyPayload)
          .eq('id', id);

        if (error) throw error;

        // Delete existing questions and re-insert
        await supabase.from('survey_questions').delete().eq('survey_id', id);
      } else {
        const { data, error } = await supabase
          .from('surveys')
          .insert(surveyPayload)
          .select('id')
          .single();

        if (error) throw error;
        surveyId = data.id;
      }

      // Insert questions
      const questionsPayload = questions.map((q) => ({
        survey_id: surveyId,
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        options: q.options.length > 0 ? q.options : null,
        is_required: q.is_required,
        display_order: q.display_order,
      }));

      const { error: questionsError } = await supabase
        .from('survey_questions')
        .insert(questionsPayload);

      if (questionsError) throw questionsError;

      toast({
        title: 'Success',
        description: `Survey ${isEditing ? 'updated' : 'created'} successfully`,
      });

      navigate('/surveys');
    } catch (error) {
      console.error('Error saving survey:', error);
      toast({
        title: 'Error',
        description: 'Failed to save survey. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute requiredModule="survey_manager_access">
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/surveys')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {isEditing ? 'Edit Survey' : 'Create Survey'}
                </h1>
                <p className="text-muted-foreground">
                  {isEditing ? 'Modify your survey settings and questions' : 'Set up a new survey for your practice'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleSave(true)} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
              <Button onClick={() => handleSave(false)} disabled={isSaving}>
                {isSaving ? 'Saving...' : isEditing ? 'Update & Activate' : 'Create & Activate'}
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="details">1. Details</TabsTrigger>
              <TabsTrigger value="questions">2. Questions</TabsTrigger>
              <TabsTrigger value="settings">3. Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Survey Details</CardTitle>
                  <CardDescription>Basic information about your survey</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Survey Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Patient Satisfaction Survey Q1 2026"
                      value={surveyData.title}
                      onChange={(e) => setSurveyData((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the survey purpose..."
                      value={surveyData.description}
                      onChange={(e) => setSurveyData((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Survey Type</Label>
                    <Select
                      value={surveyData.survey_type}
                      onValueChange={(value) => handleTypeChange(value as SurveyData['survey_type'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient_experience">Patient Experience (FFT)</SelectItem>
                        <SelectItem value="staff">Staff Survey</SelectItem>
                        <SelectItem value="event_training">Event/Training Feedback</SelectItem>
                        <SelectItem value="custom">Custom Survey</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      {surveyData.survey_type !== 'custom' && 'Selecting a type will suggest template questions'}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => setActiveTab('questions')}>
                      Next: Questions
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="questions">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Questions</CardTitle>
                      <CardDescription>Add and configure your survey questions</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setShowImportModal(true)} variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Import from File
                      </Button>
                      <Button onClick={addQuestion} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Question
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questions.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground mb-4">No questions added yet</p>
                      <Button onClick={addQuestion}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Question
                      </Button>
                    </div>
                  ) : (
                    questions.map((question, index) => (
                      <Card key={index} className="relative">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveQuestion(index, 'up')}
                                disabled={index === 0}
                              >
                                <GripVertical className="h-4 w-4" />
                              </Button>
                              <Badge variant="secondary" className="text-xs">
                                {index + 1}
                              </Badge>
                            </div>
                            
                            <div className="flex-1 space-y-4">
                              <div className="space-y-2">
                                <Label>Question Text *</Label>
                                <Input
                                  placeholder="Enter your question..."
                                  value={question.question_text}
                                  onChange={(e) =>
                                    updateQuestion(index, { question_text: e.target.value })
                                  }
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Question Type</Label>
                                  <Select
                                    value={question.question_type}
                                    onValueChange={(value) =>
                                      updateQuestion(index, {
                                        question_type: value as Question['question_type'],
                                        options: value === 'multiple_choice' ? ['Option 1', 'Option 2'] : [],
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(questionTypeLabels).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex items-center space-x-2 pt-8">
                                  <Switch
                                    id={`required-${index}`}
                                    checked={question.is_required}
                                    onCheckedChange={(checked) =>
                                      updateQuestion(index, { is_required: checked })
                                    }
                                  />
                                  <Label htmlFor={`required-${index}`}>Required</Label>
                                </div>
                              </div>

                              {question.question_type === 'multiple_choice' && (
                                <div className="space-y-2">
                                  <Label>Options</Label>
                                  {question.options.map((option, optIndex) => (
                                    <div key={optIndex} className="flex gap-2">
                                      <Input
                                        value={option}
                                        onChange={(e) => {
                                          const newOptions = [...question.options];
                                          newOptions[optIndex] = e.target.value;
                                          updateQuestion(index, { options: newOptions });
                                        }}
                                        placeholder={`Option ${optIndex + 1}`}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          const newOptions = question.options.filter(
                                            (_, i) => i !== optIndex
                                          );
                                          updateQuestion(index, { options: newOptions });
                                        }}
                                        disabled={question.options.length <= 2}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      updateQuestion(index, {
                                        options: [...question.options, `Option ${question.options.length + 1}`],
                                      });
                                    }}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Option
                                  </Button>
                                </div>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => removeQuestion(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setActiveTab('details')}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button onClick={() => setActiveTab('settings')}>
                      Next: Settings
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Survey Settings</CardTitle>
                  <CardDescription>Configure anonymity and schedule options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base">Anonymous Responses</Label>
                      <p className="text-sm text-muted-foreground">
                        {surveyData.is_anonymous
                          ? 'Respondents will not be asked for identifying information'
                          : 'Respondents can optionally provide their details'}
                      </p>
                    </div>
                    <Switch
                      checked={surveyData.is_anonymous}
                      onCheckedChange={(checked) =>
                        setSurveyData((prev) => ({ ...prev, is_anonymous: checked }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date (optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !surveyData.start_date && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {surveyData.start_date
                              ? format(surveyData.start_date, 'dd MMM yyyy')
                              : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={surveyData.start_date || undefined}
                            onSelect={(date) =>
                              setSurveyData((prev) => ({ ...prev, start_date: date || null }))
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>End Date (optional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !surveyData.end_date && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {surveyData.end_date
                              ? format(surveyData.end_date, 'dd MMM yyyy')
                              : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={surveyData.end_date || undefined}
                            onSelect={(date) =>
                              setSurveyData((prev) => ({ ...prev, end_date: date || null }))
                            }
                            disabled={(date) =>
                              surveyData.start_date ? date < surveyData.start_date : false
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setActiveTab('questions')}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleSave(true)} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-2" />
                        Save as Draft
                      </Button>
                      <Button onClick={() => handleSave(false)} disabled={isSaving}>
                        {isSaving ? 'Saving...' : isEditing ? 'Update & Activate' : 'Create & Activate'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <SurveyImportModal
            open={showImportModal}
            onOpenChange={setShowImportModal}
            onImport={handleImportQuestions}
            currentTitle={surveyData.title}
          />
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default SurveyBuilder;
