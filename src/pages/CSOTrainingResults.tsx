import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCSORegistration } from '@/hooks/useCSORegistration';
import { csoAssessmentQuestions } from '@/data/csoAssessmentQuestions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Award, RotateCcw, Home } from 'lucide-react';

interface AssessmentResult {
  id: string;
  attempt_number: number;
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  questions_answered: any;
  completed_at: string;
}

export default function CSOTrainingResults() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { registration } = useCSORegistration();
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!assessmentId || !registration?.id) return;

      try {
        const { data, error } = await supabase
          .from('cso_assessments')
          .select('*')
          .eq('id', assessmentId)
          .eq('registration_id', registration.id)
          .single();

        if (error) throw error;
        setAssessment(data);
      } catch (error) {
        console.error('Error fetching assessment:', error);
        navigate('/cso-training-dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssessment();
  }, [assessmentId, registration?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!assessment || !registration) {
    return null;
  }

  const questionAnswers = assessment.questions_answered as Record<string, string>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate('/cso-training-dashboard')} className="mb-4">
            <Home className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>

          <h1 className="text-3xl font-bold mb-2">Assessment Results</h1>
          <p className="text-muted-foreground">
            Attempt {assessment.attempt_number} • Completed {new Date(assessment.completed_at).toLocaleDateString('en-GB', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        {/* Results Summary */}
        <Card className={`p-8 mb-8 ${assessment.passed ? 'border-primary bg-primary/5' : 'border-destructive bg-destructive/5'}`}>
          <div className="text-center">
            {assessment.passed ? (
              <Award className="h-16 w-16 text-primary mx-auto mb-4" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            )}
            
            <h2 className="text-3xl font-bold mb-2">
              {assessment.passed ? 'Congratulations!' : 'Not Quite There'}
            </h2>
            
            <p className="text-xl text-muted-foreground mb-6">
              {assessment.passed 
                ? 'You have successfully passed the Clinical Safety Officer Level 1 Assessment'
                : 'You need 80% to pass. Review the questions below and try again.'
              }
            </p>

            <div className="flex items-center justify-center gap-8 mb-6">
              <div>
                <p className="text-4xl font-bold">{assessment.percentage}%</p>
                <p className="text-sm text-muted-foreground">Overall Score</p>
              </div>
              <div>
                <p className="text-4xl font-bold">{assessment.score}/{assessment.total_questions}</p>
                <p className="text-sm text-muted-foreground">Correct Answers</p>
              </div>
            </div>

            {assessment.passed ? (
              <div className="space-y-3">
                <Button size="lg" onClick={() => navigate(`/cso-certificate/${assessment.id}`)}>
                  <Award className="h-5 w-5 mr-2" />
                  View Certificate
                </Button>
                <p className="text-sm text-muted-foreground">
                  Your certificate is ready to download
                </p>
              </div>
            ) : (
              <Button size="lg" onClick={() => navigate('/cso-training-assessment')}>
                <RotateCcw className="h-5 w-5 mr-2" />
                Retake Assessment
              </Button>
            )}
          </div>
        </Card>

        {/* Question Review */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Question Review</h2>
          
          {Object.entries(questionAnswers).map(([questionId, userAnswer], index) => {
            const question = csoAssessmentQuestions.find(q => q.id === questionId);
            if (!question) return null;

            const isCorrect = userAnswer === question.correctAnswer;
            const selectedOption = question.options.find(opt => opt.id === userAnswer);
            const correctOption = question.options.find(opt => opt.id === question.correctAnswer);

            return (
              <Card key={questionId} className={`p-6 ${isCorrect ? 'border-primary/50' : 'border-destructive/50'}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${isCorrect ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold">Question {index + 1}</h3>
                      <Badge variant={isCorrect ? 'default' : 'destructive'}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </Badge>
                    </div>

                    <p className="mb-4">{question.question}</p>

                    <div className="space-y-2 mb-4">
                      <div className={`p-3 rounded-lg ${
                        isCorrect 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'bg-destructive/10 border border-destructive/20'
                      }`}>
                        <p className="text-sm font-medium mb-1">Your Answer:</p>
                        <p>{selectedOption?.text}</p>
                      </div>

                      {!isCorrect && (
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-sm font-medium mb-1">Correct Answer:</p>
                          <p>{correctOption?.text}</p>
                        </div>
                      )}
                    </div>

                    {question.explanation && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">Explanation:</p>
                        <p className="text-sm text-muted-foreground">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <Button variant="outline" onClick={() => navigate('/cso-training-dashboard')}>
            Return to Dashboard
          </Button>
          {!assessment.passed && (
            <Button onClick={() => navigate('/cso-training-assessment')}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
