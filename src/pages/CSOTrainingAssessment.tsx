import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCSORegistration } from '@/hooks/useCSORegistration';
import { useCSOProgress } from '@/hooks/useCSOProgress';
import { useCSOAssessment } from '@/hooks/useCSOAssessment';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CSOTrainingAssessment() {
  const navigate = useNavigate();
  const { registration, isLoading: regLoading } = useCSORegistration();
  const { areAllModulesComplete } = useCSOProgress(registration?.id);
  const { currentQuestions, currentAnswers, startAssessment, setAnswer, submitAssessment, isSubmitting } = useCSOAssessment(registration?.id);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  useEffect(() => {
    if (!regLoading && !registration) {
      navigate('/cso-training-register');
      return;
    }
    
    if (!regLoading && !areAllModulesComplete()) {
      navigate('/cso-training-dashboard');
      return;
    }

    if (currentQuestions.length === 0) {
      startAssessment();
    }
  }, [registration, regLoading, areAllModulesComplete, currentQuestions.length]);

  if (regLoading || currentQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing assessment...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = currentQuestions[currentQuestionIndex];
  const answeredCount = Object.keys(currentAnswers).length;
  const progressPercentage = (answeredCount / currentQuestions.length) * 100;
  const isLastQuestion = currentQuestionIndex === currentQuestions.length - 1;
  const allAnswered = answeredCount === currentQuestions.length;

  const handleNext = () => {
    if (!isLastQuestion) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    const result = await submitAssessment();
    if (result) {
      navigate(`/cso-training-results/${result.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={() => navigate('/cso-training-dashboard')}>
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Badge variant="secondary">
              Question {currentQuestionIndex + 1} of {currentQuestions.length}
            </Badge>
          </div>

          <h1 className="text-3xl font-bold mb-2">Clinical Safety Officer Assessment</h1>
          <p className="text-muted-foreground mb-4">
            Answer all questions to the best of your ability. You need 80% (8 out of 10) to pass.
          </p>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{answeredCount} of {currentQuestions.length} answered</span>
              <span>{Math.round(progressPercentage)}% complete</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Important Instructions */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              <li>Select one answer for each question</li>
              <li>You can navigate back and forth between questions</li>
              <li>All questions must be answered before submitting</li>
              <li>Unlimited retakes are available if you don't pass</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Question Card */}
        <Card className="p-8 mb-6">
          <div className="mb-6">
            <Badge variant="outline" className="mb-4">
              {currentQuestion.category.toUpperCase().replace('_', ' ')}
            </Badge>
            <h2 className="text-xl font-semibold mb-6">{currentQuestion.question}</h2>
          </div>

          <RadioGroup
            value={currentAnswers[currentQuestion.id] || ''}
            onValueChange={(value) => setAnswer(currentQuestion.id, value)}
          >
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <div
                  key={option.id}
                  className={`flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                    currentAnswers[currentQuestion.id] === option.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setAnswer(currentQuestion.id, option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer leading-relaxed">
                    {option.text}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          {currentAnswers[currentQuestion.id] && (
            <div className="mt-4 flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>Answer saved</span>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-1">
            {currentQuestions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`h-8 w-8 rounded-full text-xs font-medium transition-all ${
                  index === currentQuestionIndex 
                    ? 'bg-primary text-primary-foreground' 
                    : currentAnswers[q.id]
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
                aria-label={`Question ${index + 1}`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {isLastQuestion ? (
            <Button 
              onClick={() => setShowConfirmSubmit(true)}
              disabled={!allAnswered}
            >
              Submit Assessment
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Submission Confirmation */}
        {showConfirmSubmit && (
          <Card className="p-6 border-primary">
            <h3 className="text-lg font-semibold mb-4">Ready to submit?</h3>
            <p className="text-muted-foreground mb-6">
              You have answered all {currentQuestions.length} questions. Once submitted, your assessment will be graded immediately.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Confirm and Submit'}
              </Button>
              <Button variant="outline" onClick={() => setShowConfirmSubmit(false)} disabled={isSubmitting}>
                Review Answers
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
