import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, X, Check } from 'lucide-react';
import { CompactMicButton } from '@/components/ai4gp/studio/CompactMicButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GeneratedQuestion {
  question_text: string;
  question_type: 'rating' | 'text' | 'multiple_choice' | 'yes_no' | 'scale';
  options: string[];
  is_required: boolean;
  confidence: number;
}

interface SurveyAIGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddQuestions: (questions: GeneratedQuestion[]) => void;
  surveyType?: string;
  existingQuestionCount: number;
}

const questionTypeLabels: Record<string, string> = {
  rating: 'Rating (1-5)',
  text: 'Free Text',
  multiple_choice: 'Multiple Choice',
  yes_no: 'Yes/No',
  scale: 'Scale (1-10)',
};

export const SurveyAIGenerateModal: React.FC<SurveyAIGenerateModalProps> = ({
  open,
  onOpenChange,
  onAddQuestions,
  surveyType,
  existingQuestionCount,
}) => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Please describe your questions',
        description: 'Enter a description of the survey questions you need.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedQuestions([]);
    setSelectedIndices(new Set());
    setHasGenerated(false);

    try {
      const { data, error } = await supabase.functions.invoke('generate-survey-questions', {
        body: {
          prompt: prompt.trim(),
          surveyType,
          existingQuestionCount,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate questions');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const questions: GeneratedQuestion[] = data?.questions || [];

      if (questions.length === 0) {
        toast({
          title: 'No questions generated',
          description: 'Try rephrasing your description or being more specific.',
        });
        return;
      }

      setGeneratedQuestions(questions);
      setSelectedIndices(new Set(questions.map((_, i) => i)));
      setHasGenerated(true);
    } catch (error: any) {
      console.error('Error generating questions:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleQuestion = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    const selected = generatedQuestions.filter((_, i) => selectedIndices.has(i));
    if (selected.length === 0) {
      toast({
        title: 'No questions selected',
        description: 'Please select at least one question to add.',
        variant: 'destructive',
      });
      return;
    }
    onAddQuestions(selected);
    handleClose();
  };

  const handleClose = () => {
    setPrompt('');
    setGeneratedQuestions([]);
    setSelectedIndices(new Set());
    setHasGenerated(false);
    setIsGenerating(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            Ask AI to Generate Questions
          </DialogTitle>
          <DialogDescription>
            Describe the survey questions you need and AI will generate them for you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Input section */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Textarea
                placeholder="e.g. 'Create 5 patient satisfaction questions about waiting times and staff friendliness'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={isGenerating}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating) {
                    handleGenerate();
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <CompactMicButton
                  onTranscriptUpdate={setPrompt}
                  currentValue={prompt}
                  disabled={isGenerating}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Press Ctrl+Enter to generate or use the microphone
              </p>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Questions
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
              <p className="text-sm font-medium">Generating your questions...</p>
              <p className="text-xs">This usually takes a few seconds</p>
            </div>
          )}

          {/* Generated questions preview */}
          {hasGenerated && generatedQuestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Generated {generatedQuestions.length} question{generatedQuestions.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedIndices.size} selected
                </p>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {generatedQuestions.map((q, index) => {
                  const isSelected = selectedIndices.has(index);
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/50 bg-muted/30 opacity-60'
                      }`}
                      onClick={() => toggleQuestion(index)}
                    >
                      <div
                        className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {q.question_text}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-xs">
                            {questionTypeLabels[q.question_type] || q.question_type}
                          </Badge>
                          {q.is_required && (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          )}
                          {q.question_type === 'multiple_choice' && q.options.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {q.options.length} options
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {hasGenerated && generatedQuestions.length > 0 && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setGeneratedQuestions([]);
              setHasGenerated(false);
              setSelectedIndices(new Set());
            }}>
              Regenerate
            </Button>
            <Button onClick={handleAddSelected} disabled={selectedIndices.size === 0}>
              Add {selectedIndices.size} Question{selectedIndices.size !== 1 ? 's' : ''} to Survey
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
