import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateScore, getRandomQuestions, AssessmentQuestion } from '@/data/csoAssessmentQuestions';

export interface AssessmentAttempt {
  id: string;
  registration_id: string;
  attempt_number: number;
  questions_answered: any;
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  started_at: string;
  completed_at: string;
}

export const useCSOAssessment = (registrationId?: string) => {
  const [currentQuestions, setCurrentQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);

  const startAssessment = () => {
    const questions = getRandomQuestions(10);
    setCurrentQuestions(questions);
    setCurrentAnswers({});
  };

  const setAnswer = (questionId: string, answer: string) => {
    setCurrentAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitAssessment = async (): Promise<AssessmentAttempt | null> => {
    if (!registrationId) {
      console.error('Registration ID is required');
      return null;
    }

    if (Object.keys(currentAnswers).length !== currentQuestions.length) {
      console.error('Please answer all questions before submitting');
      return null;
    }

    setIsSubmitting(true);

    try {
      // Calculate score
      const result = calculateScore(currentAnswers);

      // Get previous attempts to determine attempt number
      const { data: previousAttempts, error: fetchError } = await supabase
        .from('cso_assessments')
        .select('attempt_number')
        .eq('registration_id', registrationId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const attemptNumber = previousAttempts && previousAttempts.length > 0 
        ? previousAttempts[0].attempt_number + 1 
        : 1;

      // Store assessment result
      const { data: assessment, error: insertError } = await supabase
        .from('cso_assessments')
        .insert({
          registration_id: registrationId,
          attempt_number: attemptNumber,
          questions_answered: currentAnswers,
          score: result.score,
          total_questions: result.totalQuestions,
          percentage: result.percentage,
          passed: result.passed,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return assessment;
    } catch (error) {
      console.error('Error submitting assessment:', error);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchAttempts = async () => {
    if (!registrationId) return;

    try {
      const { data, error } = await supabase
        .from('cso_assessments')
        .select('*')
        .eq('registration_id', registrationId)
        .order('attempt_number', { ascending: false });

      if (error) throw error;

      setAttempts(data || []);
    } catch (error) {
      console.error('Error fetching attempts:', error);
    }
  };

  const getPassedAttempt = (): AssessmentAttempt | null => {
    return attempts.find(a => a.passed) || null;
  };

  return {
    currentQuestions,
    currentAnswers,
    isSubmitting,
    attempts,
    startAssessment,
    setAnswer,
    submitAssessment,
    fetchAttempts,
    getPassedAttempt
  };
};
