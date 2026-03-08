import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { DocumentType, DefaultQuestion } from './documentTypes';

interface StepBriefProps {
  documentType: DocumentType | null;
  freeFormRequest: string;
  answers: Record<string, string | string[]>;
  onUpdateAnswers: (answers: Record<string, string | string[]>) => void;
  uploadedFiles: File[];
  supportingText: string;
}

interface GeneratedQuestion {
  question: string;
  type: 'text' | 'pills';
  options?: string[];
  multiSelect?: boolean;
}

export const StepBrief: React.FC<StepBriefProps> = ({
  documentType,
  freeFormRequest,
  answers,
  onUpdateAnswers,
  uploadedFiles,
  supportingText,
}) => {
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Generate AI questions or use defaults
  useEffect(() => {
    if (hasGenerated) return;
    
    const generateQuestions = async () => {
      // Use default questions from the document type config
      if (documentType?.default_questions) {
        setQuestions(documentType.default_questions);
        setHasGenerated(true);
        return;
      }
      
      // For free-form requests, generate questions via AI
      if (freeFormRequest) {
        setIsLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('generate-document-studio', {
            body: {
              action: 'generate_questions',
              documentType: freeFormRequest,
              hasFiles: uploadedFiles.length > 0,
              hasSupportingText: !!supportingText,
            }
          });
          
          if (!error && data?.questions) {
            setQuestions(data.questions);
          } else {
            // Fallback generic questions
            setQuestions([
              { question: 'What is the main purpose of this document?', type: 'text' },
              { question: 'Who is the intended audience?', type: 'pills', options: ['Internal staff', 'Patients', 'External stakeholders', 'Partners'] },
              { question: 'Any specific requirements or constraints?', type: 'text' },
            ]);
          }
        } catch {
          setQuestions([
            { question: 'What is the main purpose of this document?', type: 'text' },
            { question: 'Who is the intended audience?', type: 'pills', options: ['Internal staff', 'Patients', 'External stakeholders', 'Partners'] },
          ]);
        } finally {
          setIsLoading(false);
        }
        setHasGenerated(true);
      }
    };
    
    generateQuestions();
  }, [documentType, freeFormRequest, hasGenerated, uploadedFiles.length, supportingText]);

  const handleTextAnswer = useCallback((questionIndex: number, value: string) => {
    onUpdateAnswers({
      ...answers,
      [`q${questionIndex}`]: value,
    });
  }, [answers, onUpdateAnswers]);

  const handlePillToggle = useCallback((questionIndex: number, option: string, multiSelect?: boolean) => {
    const key = `q${questionIndex}`;
    const current = answers[key];
    
    if (multiSelect) {
      const currentArr = Array.isArray(current) ? current : [];
      const updated = currentArr.includes(option)
        ? currentArr.filter(o => o !== option)
        : [...currentArr, option];
      onUpdateAnswers({ ...answers, [key]: updated });
    } else {
      onUpdateAnswers({ ...answers, [key]: option });
    }
  }, [answers, onUpdateAnswers]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparing questions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">A few quick questions to get this right:</h3>
        {documentType && (
          <p className="text-sm text-muted-foreground mt-1">
            Preparing your <span className="font-medium text-foreground">{documentType.display_name}</span>
          </p>
        )}
      </div>

      <div className="space-y-5">
        {questions.map((q, idx) => {
          const answerKey = `q${idx}`;
          const currentAnswer = answers[answerKey];

          return (
            <div key={idx} className="space-y-2">
              <label className="text-sm font-semibold text-foreground">{q.question}</label>
              
              {q.type === 'text' ? (
                <Textarea
                  value={(currentAnswer as string) || ''}
                  onChange={(e) => handleTextAnswer(idx, e.target.value)}
                  placeholder="Type your answer..."
                  className="min-h-[60px] resize-y"
                />
              ) : q.type === 'pills' && q.options ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map(option => {
                    const isSelected = q.multiSelect
                      ? Array.isArray(currentAnswer) && currentAnswer.includes(option)
                      : currentAnswer === option;

                    return (
                      <button
                        key={option}
                        onClick={() => handlePillToggle(idx, option, q.multiSelect)}
                        className={cn(
                          'px-4 py-1.5 rounded-2xl text-[13px] font-medium border transition-all',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {questions.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No additional questions needed. Click Next to proceed to upload.
        </p>
      )}
    </div>
  );
};
