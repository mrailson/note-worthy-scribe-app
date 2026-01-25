import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Star, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  is_anonymous: boolean;
}

const PublicSurvey = () => {
  const { token } = useParams();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [respondentInfo, setRespondentInfo] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: survey, isLoading: surveyLoading } = useQuery({
    queryKey: ['public-survey', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surveys')
        .select('id, title, description, is_anonymous')
        .eq('public_token', token)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      return data as Survey;
    },
    enabled: !!token,
  });

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['public-survey-questions', survey?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', survey!.id)
        .order('display_order');

      if (error) throw error;
      return data as Question[];
    },
    enabled: !!survey?.id,
  });

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!survey || !questions) return;

    // Validate required questions
    const missingRequired = questions.filter(
      (q) => q.is_required && !answers[q.id]
    );

    if (missingRequired.length > 0) {
      setError(`Please answer all required questions (${missingRequired.length} remaining)`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create response record
      const { data: response, error: responseError } = await supabase
        .from('survey_responses')
        .insert({
          survey_id: survey.id,
          respondent_name: !survey.is_anonymous ? respondentInfo.name || null : null,
          respondent_email: !survey.is_anonymous ? respondentInfo.email || null : null,
        })
        .select('id')
        .single();

      if (responseError) throw responseError;

      // Create answer records
      const answerRecords = questions
        .filter((q) => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '')
        .map((q) => {
          const answer = answers[q.id];
          return {
            response_id: response.id,
            question_id: q.id,
            answer_text: typeof answer === 'string' ? answer : null,
            answer_rating: typeof answer === 'number' ? answer : null,
            answer_options: Array.isArray(answer) ? answer : null,
          };
        });

      if (answerRecords.length > 0) {
        const { error: answersError } = await supabase
          .from('survey_answers')
          .insert(answerRecords);

        if (answersError) throw answersError;
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting survey:', err);
      setError('Failed to submit survey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = surveyLoading || questionsLoading;
  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
  const totalQuestions = questions?.length || 0;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading survey...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardContent className="py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Survey Not Available</h2>
            <p className="text-muted-foreground">
              This survey may have expired or is no longer accepting responses.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">
              Your response has been submitted successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{survey.title}</CardTitle>
            {survey.description && (
              <CardDescription className="text-base">{survey.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span>{answeredCount} of {totalQuestions} questions</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Respondent Info (if not anonymous) */}
        {!survey.is_anonymous && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Details (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={respondentInfo.name}
                  onChange={(e) => setRespondentInfo((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={respondentInfo.email}
                  onChange={(e) => setRespondentInfo((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questions */}
        {questions?.map((question, index) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-start gap-2">
                <span className="text-muted-foreground font-normal">{index + 1}.</span>
                {question.question_text}
                {question.is_required && <span className="text-destructive">*</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {question.question_type === 'rating' && (
                <RatingInput
                  value={answers[question.id] || 0}
                  onChange={(val) => updateAnswer(question.id, val)}
                  max={5}
                />
              )}

              {question.question_type === 'scale' && (
                <ScaleInput
                  value={answers[question.id] || 0}
                  onChange={(val) => updateAnswer(question.id, val)}
                  max={10}
                />
              )}

              {question.question_type === 'yes_no' && (
                <RadioGroup
                  value={answers[question.id] || ''}
                  onValueChange={(val) => updateAnswer(question.id, val)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                    <Label htmlFor={`${question.id}-yes`}>Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id={`${question.id}-no`} />
                    <Label htmlFor={`${question.id}-no`}>No</Label>
                  </div>
                </RadioGroup>
              )}

              {question.question_type === 'multiple_choice' && question.options && (
                <RadioGroup
                  value={answers[question.id] || ''}
                  onValueChange={(val) => updateAnswer(question.id, val)}
                  className="space-y-2"
                >
                  {(question.options as string[]).map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`${question.id}-${optIndex}`} />
                      <Label htmlFor={`${question.id}-${optIndex}`}>{option}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.question_type === 'text' && (
                <Textarea
                  placeholder="Type your answer here..."
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  rows={4}
                />
              )}
            </CardContent>
          </Card>
        ))}

        {/* Submit */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Response'}
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-3">
              {survey.is_anonymous
                ? 'Your response is anonymous'
                : 'Your details will be recorded with your response'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Rating Component (Stars)
const RatingInput = ({
  value,
  onChange,
  max = 5,
}: {
  value: number;
  onChange: (val: number) => void;
  max?: number;
}) => {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          type="button"
          className="p-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
          onMouseEnter={() => setHovered(rating)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(rating)}
        >
          <Star
            className={cn(
              'h-8 w-8 transition-colors',
              (hovered || value) >= rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
};

// Scale Component (1-10)
const ScaleInput = ({
  value,
  onChange,
  max = 10,
}: {
  value: number;
  onChange: (val: number) => void;
  max?: number;
}) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            type="button"
            className={cn(
              'flex-1 py-3 text-sm font-medium border rounded transition-colors',
              value === num
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted'
            )}
            onClick={() => onChange(num)}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PublicSurvey;
