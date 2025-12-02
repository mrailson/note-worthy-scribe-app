import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLGCapture, LGPatient } from '@/hooks/useLGCapture';
import { LGProcessingStatus } from '@/components/lg-capture/LGProcessingStatus';
import { LGDownloadPanel } from '@/components/lg-capture/LGDownloadPanel';
import { LGSummaryPreview } from '@/components/lg-capture/LGSummaryPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function LGCaptureResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatient, triggerProcessing } = useLGCapture();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPatient = async () => {
    if (!id) return;
    setLoading(true);
    const data = await getPatient(id);
    if (data) {
      setPatient(data);
    } else {
      toast.error('Patient not found');
      navigate('/lg-capture');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPatient();
  }, [id]);

  const handleStatusChange = (status: LGPatient['job_status']) => {
    if (patient) {
      setPatient({ ...patient, job_status: status });
    }
    // Reload to get updated URLs
    if (status === 'succeeded' || status === 'failed') {
      loadPatient();
    }
  };

  const handleRetry = async () => {
    if (!patient) return;
    const success = await triggerProcessing(patient.id);
    if (success) {
      toast.success('Processing restarted');
      loadPatient();
    }
  };

  if (loading || !patient) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/lg-capture/patients')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to List
      </Button>

      {/* Patient Info */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Patient Record</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Patient:</span>
            <span className="font-medium">{patient.patient_name}</span>
            <span className="text-muted-foreground">NHS:</span>
            <span className="font-medium font-mono">{patient.nhs_number}</span>
            <span className="text-muted-foreground">DOB:</span>
            <span className="font-medium">{patient.dob}</span>
            <span className="text-muted-foreground">Pages:</span>
            <span className="font-medium">{patient.images_count}</span>
            <span className="text-muted-foreground">ID:</span>
            <span className="font-mono text-xs">{patient.id}</span>
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      <LGProcessingStatus patient={patient} onStatusChange={handleStatusChange} />

      {/* Retry Button for Failed */}
      {patient.job_status === 'failed' && (
        <Button
          onClick={handleRetry}
          variant="outline"
          className="w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry Processing
        </Button>
      )}

      {/* Download Panel */}
      {patient.job_status === 'succeeded' && (
        <>
          <LGDownloadPanel patient={patient} />
          <LGSummaryPreview patient={patient} />
        </>
      )}

      {/* Start Next Patient */}
      {patient.job_status === 'succeeded' && (
        <Button
          onClick={() => navigate('/lg-capture/start')}
          className="w-full"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          Start Next Patient
        </Button>
      )}
    </div>
  );
}
