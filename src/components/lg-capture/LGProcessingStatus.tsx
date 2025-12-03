import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, XCircle, FileText, Brain, Code } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';

interface LGProcessingStatusProps {
  patient: LGPatient;
  onStatusChange?: (status: LGPatient['job_status']) => void;
}

const STEPS = [
  { key: 'uploading', label: 'Uploading images', icon: FileText },
  { key: 'queued', label: 'Queued for processing', icon: Loader2 },
  { key: 'processing', label: 'Processing (OCR & AI)', icon: Brain },
  { key: 'succeeded', label: 'Complete', icon: CheckCircle2 },
];

export function LGProcessingStatus({ patient, onStatusChange }: LGProcessingStatusProps) {
  const [currentPatient, setCurrentPatient] = useState(patient);

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
          const updated = payload.new as LGPatient;
          setCurrentPatient(updated);
          onStatusChange?.(updated.job_status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id, onStatusChange]);

  const getStepStatus = (stepKey: string) => {
    const statusOrder = ['draft', 'uploading', 'queued', 'processing', 'succeeded', 'failed'];
    const currentIndex = statusOrder.indexOf(currentPatient.job_status);
    const stepIndex = statusOrder.indexOf(stepKey);

    if (currentPatient.job_status === 'failed') {
      return stepIndex <= currentIndex ? 'failed' : 'pending';
    }

    // When succeeded, all steps including 'succeeded' should show as complete
    if (currentPatient.job_status === 'succeeded') {
      return stepIndex <= currentIndex ? 'complete' : 'pending';
    }

    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const getProgress = () => {
    const statusProgress: Record<string, number> = {
      draft: 0,
      uploading: 25,
      queued: 40,
      processing: 70,
      succeeded: 100,
      failed: 0,
    };
    return statusProgress[currentPatient.job_status] || 0;
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
        <Progress value={getProgress()} className="h-2" />

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

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Patient: {currentPatient.patient_name}</p>
          <p>NHS: {currentPatient.nhs_number}</p>
          <p>Pages: {currentPatient.images_count}</p>
        </div>
      </CardContent>
    </Card>
  );
}
