import React, { useState, useCallback, lazy, Suspense } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, ArrowLeft, FolderOpen, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StepChoose } from './StepChoose';
import { StepBrief } from './StepBrief';
import { StepUpload } from './StepUpload';
import { StepGenerate } from './StepGenerate';
import { HarmTriageGate } from './HarmTriageGate';
import type { DocumentType } from './documentTypes';

const MyDocuments = lazy(() => import('./MyDocuments').then(m => ({ default: m.MyDocuments })));

export interface DocumentStudioState {
  selectedType: DocumentType | null;
  freeFormRequest: string;
  clarifyingAnswers: Record<string, string | string[]>;
  supportingText: string;
  uploadedFiles: File[];
  generatedContent: string | null;
  isGenerating: boolean;
  version: number;
  versionLabel: string;
  harmTriageResult: string | null;
}

const INITIAL_STATE: DocumentStudioState = {
  selectedType: null,
  freeFormRequest: '',
  clarifyingAnswers: {},
  supportingText: '',
  uploadedFiles: [],
  generatedContent: null,
  isGenerating: false,
  version: 1,
  versionLabel: 'v1.0',
  harmTriageResult: null,
};

type Step = 'choose' | 'brief' | 'upload' | 'generate';

const STEPS: { id: Step; label: string; num: number }[] = [
  { id: 'choose', label: 'Choose', num: 1 },
  { id: 'brief', label: 'Brief', num: 2 },
  { id: 'upload', label: 'Upload', num: 3 },
  { id: 'generate', label: 'Generate', num: 4 },
];

interface DocumentStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DocumentStudioModal: React.FC<DocumentStudioModalProps> = ({ open, onOpenChange }) => {
  const [currentStep, setCurrentStep] = useState<Step>('choose');
  const [state, setState] = useState<DocumentStudioState>(INITIAL_STATE);
  const [showMyDocuments, setShowMyDocuments] = useState(false);
  const [showHarmTriage, setShowHarmTriage] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());

  const updateState = useCallback((updates: Partial<DocumentStudioState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleReset = useCallback(() => {
    setState(INITIAL_STATE);
    setCurrentStep('choose');
    setCompletedSteps(new Set());
    setShowHarmTriage(false);
  }, []);

  const handleSelectType = useCallback((docType: DocumentType) => {
    updateState({ selectedType: docType, freeFormRequest: '' });
    
    // Learning Event Report → show harm triage gate
    if (docType.type_key === 'learning_event_report') {
      setShowHarmTriage(true);
      return;
    }
    
    setCompletedSteps(prev => new Set(prev).add('choose'));
    setCurrentStep('brief');
  }, [updateState]);

  const handleFreeFormSelect = useCallback((text: string) => {
    updateState({ freeFormRequest: text, selectedType: null });
    setCompletedSteps(prev => new Set(prev).add('choose'));
    setCurrentStep('brief');
  }, [updateState]);

  const handleHarmTriageContinue = useCallback((result: string) => {
    updateState({ harmTriageResult: result });
    setShowHarmTriage(false);
    setCompletedSteps(prev => new Set(prev).add('choose'));
    setCurrentStep('brief');
  }, [updateState]);

  const handleNext = useCallback(() => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    }
  }, [currentStep]);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'choose': return !!state.selectedType || !!state.freeFormRequest.trim();
      case 'brief': return true; // Questions are optional
      case 'upload': return true; // Upload is optional
      case 'generate': return false;
      default: return false;
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  if (showMyDocuments) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                My Documents
              </DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMyDocuments(false)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Studio
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <MyDocuments />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Document Studio
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMyDocuments(true)}>
                <FolderOpen className="h-4 w-4 mr-2" />
                My Documents
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Step Indicator */}
        {!showHarmTriage && (
          <div className="flex gap-1 px-4 py-3 border-b flex-shrink-0">
            {STEPS.map(({ id, label, num }) => {
              const isActive = currentStep === id;
              const isCompleted = completedSteps.has(id);
              return (
                <button
                  key={id}
                  onClick={() => {
                    // Allow clicking completed steps or current step
                    if (isCompleted || isActive) setCurrentStep(id);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all flex-1 justify-center',
                    isActive && 'bg-primary text-primary-foreground shadow-sm',
                    !isActive && isCompleted && 'bg-primary/10 text-primary cursor-pointer',
                    !isActive && !isCompleted && 'text-muted-foreground cursor-default'
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold flex-shrink-0',
                    isActive && 'bg-primary-foreground text-primary',
                    !isActive && isCompleted && 'bg-primary text-primary-foreground',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                  )}>
                    {isCompleted && !isActive ? <Check className="h-3 w-3" /> : num}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {showHarmTriage ? (
            <HarmTriageGate
              onContinue={handleHarmTriageContinue}
              onCancel={handleReset}
            />
          ) : (
            <>
              {currentStep === 'choose' && (
                <StepChoose
                  onSelectType={handleSelectType}
                  onFreeFormSelect={handleFreeFormSelect}
                  selectedType={state.selectedType}
                  freeFormRequest={state.freeFormRequest}
                />
              )}
              {currentStep === 'brief' && (
                <StepBrief
                  documentType={state.selectedType}
                  freeFormRequest={state.freeFormRequest}
                  answers={state.clarifyingAnswers}
                  onUpdateAnswers={(answers) => updateState({ clarifyingAnswers: answers })}
                  uploadedFiles={state.uploadedFiles}
                  supportingText={state.supportingText}
                />
              )}
              {currentStep === 'upload' && (
                <StepUpload
                  supportingText={state.supportingText}
                  onSupportingTextChange={(text) => updateState({ supportingText: text })}
                  uploadedFiles={state.uploadedFiles}
                  onFilesChange={(files) => updateState({ uploadedFiles: files })}
                />
              )}
              {currentStep === 'generate' && (
                <StepGenerate
                  state={state}
                  onUpdateState={updateState}
                  onEditAndRegenerate={() => setCurrentStep('brief')}
                  onReset={handleReset}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!showHarmTriage && (
          <div className="border-t p-3 flex items-center justify-between bg-muted/30 flex-shrink-0">
            <div>
              {currentStepIndex > 0 && currentStep !== 'generate' && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
            <div>
              {currentStep !== 'generate' && (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  {currentStep === 'upload' ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  ) : (
                    'Next'
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentStudioModal;
