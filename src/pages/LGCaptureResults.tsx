import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLGCapture, LGPatient } from '@/hooks/useLGCapture';
import { LGProcessingStatus } from '@/components/lg-capture/LGProcessingStatus';
import { LGDownloadPanel } from '@/components/lg-capture/LGDownloadPanel';
import { LGSummaryPreview } from '@/components/lg-capture/LGSummaryPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Plus, RefreshCw, User, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { LGEmailButton } from '@/components/lg-capture/LGEmailButton';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function formatUKDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === 'Unknown') return dateStr || 'Pending...';
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {
    // Return original if parsing fails
  }
  return dateStr;
}

function formatNhsNumber(nhs: string | null | undefined): string {
  if (!nhs) return '';
  const cleaned = nhs.replace(/\s/g, '');
  if (cleaned.length !== 10) return nhs;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
}

export default function LGCaptureResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatient, triggerProcessing, deletePatient, isLoading: deleteLoading } = useLGCapture();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
    
    // Poll for updates while processing
    const interval = setInterval(() => {
      if (patient && ['queued', 'processing', 'uploading'].includes(patient.job_status)) {
        loadPatient();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  // Reload when status changes
  useEffect(() => {
    if (patient && ['queued', 'processing', 'uploading'].includes(patient.job_status)) {
      const interval = setInterval(loadPatient, 3000);
      return () => clearInterval(interval);
    }
  }, [patient?.job_status]);

  const handleStatusChange = (status: LGPatient['job_status']) => {
    if (patient) {
      setPatient({ ...patient, job_status: status });
    }
    // Reload to get updated data
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

  const handleDelete = async () => {
    if (!patient) return;
    const success = await deletePatient(patient.id, patient.practice_ods);
    if (success) {
      navigate('/lg-capture/patients');
    }
  };

  if (loading || !patient) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if we have AI-extracted data
  const hasExtractedData = patient.ai_extracted_name || patient.ai_extracted_nhs || patient.ai_extracted_dob;
  const isProcessing = ['queued', 'processing', 'uploading'].includes(patient.job_status);

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

      {/* Patient Info - AI Extracted */}
      <Card className={patient.requires_verification ? 'border-amber-500' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Patient Details
            {isProcessing && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (Extracting from documents...)
              </span>
            )}
            {patient.requires_verification && (
              <span className="text-xs font-normal text-amber-600 ml-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Needs verification
              </span>
            )}
            {hasExtractedData && !patient.requires_verification && patient.job_status === 'succeeded' && (
              <span className="text-xs font-normal text-green-600 ml-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                AI Extracted
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isProcessing && !hasExtractedData ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Extracting patient details...</p>
                <p className="text-sm text-muted-foreground">AI is reading the scanned documents</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Patient:</span>
              <span className="font-medium">
                {patient.ai_extracted_name || patient.patient_name || (
                  <span className="text-muted-foreground italic">Pending...</span>
                )}
              </span>
              
              <span className="text-muted-foreground">NHS:</span>
              <span className="font-medium font-mono">
                {patient.ai_extracted_nhs || patient.nhs_number ? (
                  formatNhsNumber(patient.ai_extracted_nhs || patient.nhs_number)
                ) : (
                  <span className="text-muted-foreground italic">Pending...</span>
                )}
              </span>
              
              <span className="text-muted-foreground">DOB:</span>
              <span className="font-medium">
                {patient.ai_extracted_dob || patient.dob ? (
                  formatUKDate(patient.ai_extracted_dob || patient.dob)
                ) : (
                  <span className="text-muted-foreground italic">Pending...</span>
                )}
              </span>
              
              <span className="text-muted-foreground">Pages:</span>
              <span className="font-medium">{patient.images_count}</span>
              
              {patient.ai_extraction_confidence !== null && patient.ai_extraction_confidence !== undefined && (
                <>
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className={`font-medium ${
                    patient.ai_extraction_confidence >= 0.8 ? 'text-green-600' : 
                    patient.ai_extraction_confidence >= 0.5 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {Math.round(patient.ai_extraction_confidence * 100)}%
                  </span>
                </>
              )}
              
              <span className="text-muted-foreground">ID:</span>
              <span className="font-mono text-xs">{patient.id}</span>
            </div>
          )}
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
          <LGEmailButton patient={patient} />
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

      {/* Delete Record */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Record
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the patient record, all scanned images, and generated outputs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
