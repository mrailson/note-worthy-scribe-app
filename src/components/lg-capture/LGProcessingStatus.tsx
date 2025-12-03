import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, XCircle, FileText, Brain, Code, Eye, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';

interface LGProcessingStatusProps {
  patient: LGPatient;
  onStatusChange?: (status: LGPatient['job_status']) => void;
}

// Extended patient type with new batch processing fields
interface ExtendedPatient extends LGPatient {
  processing_phase?: string;
  ocr_batches_total?: number;
  ocr_batches_completed?: number;
  pdf_generation_status?: string;
}

export function LGProcessingStatus({ patient, onStatusChange }: LGProcessingStatusProps) {
  const [currentPatient, setCurrentPatient] = useState<ExtendedPatient>(patient as ExtendedPatient);

  useEffect(() => {
    // Subscribe to changes
    const channel = supabase
      .channel(`lg_patient_${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lg_patients',
          filter: `id=eq.${patient.id}`,
        },
        (payload) => {
          const updated = payload.new as ExtendedPatient;
          setCurrentPatient(updated);
          onStatusChange?.(updated.job_status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id, onStatusChange]);

  // Determine if using batched processing
  const isBatched = (currentPatient.ocr_batches_total || 0) > 0;
  const ocrProgress = isBatched && currentPatient.ocr_batches_total 
    ? Math.round((currentPatient.ocr_batches_completed || 0) / currentPatient.ocr_batches_total * 100)
    : 0;

  const getSteps = () => {
    if (isBatched) {
      return [
        { key: 'uploading', label: 'Uploading images', icon: FileText },
        { key: 'ocr', label: `Reading text from pages (${currentPatient.ocr_batches_completed || 0}/${currentPatient.ocr_batches_total})`, icon: Eye },
        { key: 'summary', label: 'Generating clinical summary', icon: Brain },
        { key: 'pdf', label: 'Creating PDF document', icon: FileDown },
        { key: 'complete', label: 'Complete', icon: CheckCircle2 },
      ];
    }
    return [
      { key: 'uploading', label: 'Uploading images', icon: FileText },
      { key: 'queued', label: 'Queued for processing', icon: Loader2 },
      { key: 'processing', label: 'Processing (OCR & AI)', icon: Brain },
      { key: 'succeeded', label: 'Complete', icon: CheckCircle2 },
    ];
  };

  const STEPS = getSteps();

  const getStepStatus = (stepKey: string) => {
    const phase = currentPatient.processing_phase || currentPatient.job_status;
    
    if (currentPatient.job_status === 'failed') {
      return 'failed';
    }

    if (currentPatient.job_status === 'succeeded') {
      return 'complete';
    }

    if (isBatched) {
      // Batched processing phases: pending -> ocr -> summary -> pdf -> complete
      const phaseOrder = ['uploading', 'ocr', 'summary', 'pdf', 'complete'];
      const currentIndex = phaseOrder.indexOf(phase);
      const stepIndex = phaseOrder.indexOf(stepKey);

      if (stepIndex < currentIndex) return 'complete';
      if (stepIndex === currentIndex) return 'current';
      return 'pending';
    } else {
      // Single-pass processing
      const statusOrder = ['draft', 'uploading', 'queued', 'processing', 'succeeded', 'failed'];
      const currentIndex = statusOrder.indexOf(currentPatient.job_status);
      const stepIndex = statusOrder.indexOf(stepKey);

      if (stepIndex < currentIndex) return 'complete';
      if (stepIndex === currentIndex) return 'current';
      return 'pending';
    }
  };

  const getProgress = () => {
    const phase = currentPatient.processing_phase || currentPatient.job_status;

    if (currentPatient.job_status === 'failed') return 0;
    if (currentPatient.job_status === 'succeeded') return 100;

    if (isBatched) {
      // More granular progress for batched processing
      const phaseProgress: Record<string, number> = {
        pending: 0,
        uploading: 10,
        ocr: 10 + (ocrProgress * 0.5), // 10-60%
        summary: 65,
        pdf: 85,
        complete: 100,
      };
      return phaseProgress[phase] || 0;
    } else {
      const statusProgress: Record<string, number> = {
        draft: 0,
        uploading: 25,
        queued: 40,
        processing: 70,
        succeeded: 100,
        failed: 0,
      };
      return statusProgress[currentPatient.job_status] || 0;
    }
  };

  const getPdfStatus = () => {
    const pdfStatus = currentPatient.pdf_generation_status;
    if (pdfStatus === 'queued') {
      return { text: 'PDF generating in background...', color: 'text-amber-600' };
    }
    if (pdfStatus === 'generating') {
      return { text: 'PDF being created...', color: 'text-blue-600' };
    }
    if (pdfStatus === 'complete') {
      return { text: 'PDF ready', color: 'text-green-600' };
    }
    return null;
  };

  if (currentPatient.job_status === 'failed') {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Processing Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {currentPatient.error_message || 'An unknown error occurred during processing.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Patient ID: {currentPatient.id}
          </p>
        </CardContent>
      </Card>
    );
  }

  const pdfStatus = getPdfStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {currentPatient.job_status === 'succeeded' ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Processing Complete
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Processing...
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Progress value={getProgress()} className="h-2" />
          {isBatched && currentPatient.processing_phase === 'ocr' && (
            <p className="text-xs text-muted-foreground text-center">
              Reading text from pages: {ocrProgress}%
            </p>
          )}
        </div>

        <div className="space-y-3">
          {STEPS.map((step) => {
            const status = getStepStatus(step.key);
            const Icon = step.icon;
            
            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  status === 'complete' ? 'bg-green-50 text-green-700' :
                  status === 'current' ? 'bg-primary/10 text-primary' :
                  status === 'failed' ? 'bg-destructive/10 text-destructive' :
                  'bg-muted/50 text-muted-foreground'
                }`}
              >
                {status === 'complete' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : status === 'current' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : status === 'failed' ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5 opacity-50" />
                )}
                <span className="text-sm font-medium">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* PDF status for batched processing */}
        {pdfStatus && currentPatient.job_status === 'succeeded' && (
          <div className={`text-sm ${pdfStatus.color} flex items-center gap-2`}>
            {pdfStatus.text === 'PDF ready' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {pdfStatus.text}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Patient: {currentPatient.patient_name || currentPatient.ai_extracted_name || 'Extracting...'}</p>
          <p>NHS: {currentPatient.nhs_number || currentPatient.ai_extracted_nhs || 'Extracting...'}</p>
          <p>Pages: {currentPatient.images_count}</p>
          {isBatched && (
            <p className="text-amber-600">Large record - using background processing</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
