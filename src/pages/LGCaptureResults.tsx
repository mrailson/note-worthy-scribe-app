import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { useLGCapture, LGPatient, getPreviousNames, getIdentityIssues } from '@/hooks/useLGCapture';
import { generateLGFilename } from '@/utils/lgFilenameGenerator';
import { LGProcessingStatus } from '@/components/lg-capture/LGProcessingStatus';
import { LGDownloadPanel } from '@/components/lg-capture/LGDownloadPanel';
import { LGSummaryPreview } from '@/components/lg-capture/LGSummaryPreview';
import { LGProcessingMetrics } from '@/components/lg-capture/LGProcessingMetrics';
import { LGAskAI } from '@/components/lg-capture/LGAskAI';
import { LGPipelineStatusDashboard } from '@/components/lg-capture/LGPipelineStatusDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Plus, RefreshCw, User, AlertTriangle, CheckCircle2, Trash2, ShieldCheck, ShieldAlert, ShieldX, Users } from 'lucide-react';
import pdfIcon from '@/assets/pdf-icon.png';
// Toast messages removed from LG Capture service
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
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
  const { getPatient, triggerProcessing, retrySummary, restartOCR, retryPdfGeneration, deletePatient, isLoading: actionLoading } = useLGCapture();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [summaryJson, setSummaryJson] = useState<any>(null);
  const [snomedJson, setSnomedJson] = useState<any>(null);

  const loadPatient = async () => {
    if (!id) return;
    setLoading(true);
    const data = await getPatient(id);
    if (data) {
      setPatient(data);
      
      // Load summary and snomed JSON for Ask AI
      if (data.job_status === 'succeeded') {
        const basePath = `${data.practice_ods}/${id}`;
        try {
          const { data: summaryData } = await supabase.storage
            .from('lg')
            .download(`${basePath}/final/summary.json`);
          if (summaryData) {
            setSummaryJson(JSON.parse(await summaryData.text()));
          }
        } catch (e) { /* ignore */ }
        
        try {
          const { data: snomedData } = await supabase.storage
            .from('lg')
            .download(`${basePath}/final/snomed.json`);
          if (snomedData) {
            setSnomedJson(JSON.parse(await snomedData.text()));
          }
        } catch (e) { /* ignore */ }
      }
    } else {
      navigate('/lg-capture');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPatient();
    
    // Poll for updates while processing or waiting for PDF
    const interval = setInterval(() => {
      if (patient && (
        ['queued', 'processing', 'uploading'].includes(patient.job_status) ||
        (patient.job_status === 'succeeded' && (patient as any).pdf_generation_status === 'queued')
      )) {
        loadPatient();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  // Reload when status changes
  useEffect(() => {
    if (patient && (
      ['queued', 'processing', 'uploading'].includes(patient.job_status) ||
      (patient.job_status === 'succeeded' && (patient as any).pdf_generation_status === 'queued')
    )) {
      const interval = setInterval(loadPatient, 3000);
      return () => clearInterval(interval);
    }
  }, [patient?.job_status, (patient as any)?.pdf_generation_status]);

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
      loadPatient();
    }
  };

  const handleRetrySummary = async () => {
    if (!patient) return;
    const success = await retrySummary(patient.id);
    if (success) {
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
  const previousNames = getPreviousNames(patient);
  const identityIssues = getIdentityIssues(patient);
  const identityStatus = patient.identity_verification_status;

  // Get PDF URLs
  const pdfUrl = (patient as any).pdf_url;
  const pdfPartUrls = (patient as any).pdf_part_urls;
  const hasPdf = pdfUrl || (pdfPartUrls && pdfPartUrls.length > 0);

  const handleDownloadPdf = async (url: string, partNumber?: number) => {
    try {
      // Extract the path from the URL or use it directly
      const path = url.includes('lg/') ? url.split('lg/')[1] : url;
      const { data, error } = await supabase.storage
        .from('lg')
        .createSignedUrl(path, 60);
      
      if (error || !data?.signedUrl) {
        console.error('Failed to generate download link');
        return;
      }
      
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('PDF download error:', err);
    }
  };

  return (
    <>
      <Header />
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
      <Card className={patient.requires_verification ? 'border-amber-500' : identityStatus === 'conflict' ? 'border-destructive' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
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
            
            {/* PDF Download Icons */}
            {hasPdf && (
              <div className="flex items-center gap-1">
                {pdfPartUrls && pdfPartUrls.length > 0 ? (
                  // Multiple PDF parts
                  pdfPartUrls.map((url: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => handleDownloadPdf(url, index + 1)}
                      className="p-1 rounded-lg hover:bg-muted transition-colors group relative"
                      title={`Download PDF Part ${index + 1}`}
                    >
                      <img src={pdfIcon} alt="PDF" className="h-8 w-8 group-hover:opacity-80" />
                      <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {index + 1}
                      </span>
                    </button>
                  ))
                ) : pdfUrl ? (
                  // Single PDF
                  <button
                    onClick={() => handleDownloadPdf(pdfUrl)}
                    className="p-1 rounded-lg hover:bg-muted transition-colors"
                    title="Download PDF"
                  >
                    <img src={pdfIcon} alt="PDF" className="h-8 w-8 hover:opacity-80" />
                  </button>
                ) : null}
              </div>
            )}
          </div>
          
          {/* Identity Verification Status Badge */}
          {identityStatus && identityStatus !== 'pending' && (
            <div className="mt-2">
              {identityStatus === 'verified' && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Identity Verified
                </Badge>
              )}
              {identityStatus === 'warning' && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  Review Recommended
                </Badge>
              )}
              {identityStatus === 'conflict' && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <ShieldX className="h-3 w-3 mr-1" />
                  Identity Conflict Detected
                </Badge>
              )}
            </div>
          )}
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
            <div className="grid gap-2 text-sm" style={{ gridTemplateColumns: 'auto 1fr' }}>
              {/* Source File - at top */}
              {patient.source_filename && (
                <>
                  <span className="text-muted-foreground">Source File:</span>
                  <span className="font-medium text-xs">
                    {patient.source_filename}
                    <span className="text-muted-foreground ml-2">
                      {new Date(patient.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' '}
                      {new Date(patient.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {(patient as any).original_size_mb && (
                        <> · {((patient as any).original_size_mb as number).toFixed(2)} MB</>
                      )}
                    </span>
                  </span>
                </>
              )}
              
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
              
              {/* Previous Names */}
              {previousNames.length > 0 && (
                <>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Previous Names:
                  </span>
                  <div className="space-y-1">
                    {previousNames.map((prev, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{prev.name}</span>
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {prev.type}
                        </Badge>
                        {prev.evidence && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({prev.evidence})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              {/* AI Processed File Name - at bottom when complete */}
              {patient.job_status === 'succeeded' && (patient as any).pdf_url && (
                <>
                  <span className="text-muted-foreground">LG PDF:</span>
                  <span className="font-medium text-xs text-green-600 break-all">
                    {generateLGFilename({
                      patientName: patient.ai_extracted_name || patient.patient_name,
                      nhsNumber: patient.ai_extracted_nhs || patient.nhs_number,
                      dob: patient.ai_extracted_dob || patient.dob,
                      partNumber: 1,
                      totalParts: (patient as any).pdf_parts || 1
                    })}
                  </span>
                </>
              )}
            </div>
          )}
          
          {/* Identity Issues Warning */}
          {identityIssues.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                <ShieldX className="h-4 w-4" />
                Identity Verification Issues
              </h4>
              <ul className="space-y-1">
                {identityIssues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-red-700">
                    <strong className="capitalize">{issue.type.replace(/_/g, ' ')}:</strong>{' '}
                    {issue.description}
                    {issue.page_reference && (
                      <span className="text-red-500 text-xs ml-1">({issue.page_reference})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Download Panel - shown first when processing is complete */}
      {patient.job_status === 'succeeded' && (
        <>
          {/* Retry PDF Generation if stuck or failed */}
          {(['queued', 'generating', 'failed'].includes(patient.pdf_generation_status || '') && patient.pdf_generation_status !== 'complete') && (
            <Card className="border-amber-500 bg-amber-50">
              <CardContent className="pt-4">
                <p className="text-sm text-amber-700 mb-3">
                  {patient.pdf_generation_status === 'failed' 
                    ? 'PDF generation failed. Click below to retry.'
                    : patient.pdf_generation_status === 'generating'
                    ? 'PDF generation appears stuck. Click below to retry.'
                    : 'PDF generation is queued but hasn\'t started. Click below to retry.'}
                </p>
                <Button
                  onClick={async () => {
                    const success = await retryPdfGeneration(patient.id);
                    if (success) {
                      loadPatient();
                    }
                  }}
                  variant="outline"
                  className="w-full border-amber-500 text-amber-700 hover:bg-amber-100"
                  disabled={actionLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry PDF Generation
                </Button>
              </CardContent>
            </Card>
          )}
          
          <LGDownloadPanel patient={patient} />
          
          {/* Pipeline Status Dashboard */}
          <LGPipelineStatusDashboard patient={patient} />
        </>
      )}

      {/* Summary and Metrics - shown after processing complete */}
      {patient.job_status === 'succeeded' && (
        <>
          <LGSummaryPreview patient={patient} />
          
          {/* Ask AI about the record - below Clinical Summary */}
          <LGAskAI patient={patient} summaryJson={summaryJson} snomedJson={snomedJson} />
          
          {/* Processing Status - below Ask AI */}
          <LGProcessingStatus patient={patient} onStatusChange={handleStatusChange} />
          
          <LGProcessingMetrics patient={patient} />
        </>
      )}

      {/* Processing Status for non-succeeded states */}
      {patient.job_status !== 'succeeded' && (
        <LGProcessingStatus patient={patient} onStatusChange={handleStatusChange} />
      )}

      {/* Retry Button for Failed or Stuck Queued */}
      {(patient.job_status === 'failed' || 
        (patient.job_status === 'queued' && !patient.processing_started_at)) && (
        <Button
          onClick={handleRetry}
          variant="outline"
          className="w-full"
          disabled={actionLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {patient.job_status === 'failed' ? 'Retry Processing' : 'Start Processing'}
        </Button>
      )}

      {/* Retry Summary Button - for stuck jobs where OCR completed */}
      {patient.job_status === 'processing' && 
        (patient as any).processing_phase === 'summary' && (
        <div className="space-y-2">
          <Button
            onClick={handleRetrySummary}
            variant="outline"
            className="w-full"
            disabled={actionLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Summary Generation
          </Button>
          <Button
            onClick={async () => {
              const success = await restartOCR(patient.id);
              if (success) {
                loadPatient();
              }
            }}
            variant="outline"
            className="w-full text-amber-600 hover:text-amber-700"
            disabled={actionLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart OCR from Scratch (if files missing)
          </Button>
        </div>
      )}

      {/* Reprocess Button - for re-running with updated logic */}
      {patient.job_status === 'succeeded' && (
        <Button
          onClick={async () => {
            const success = await restartOCR(patient.id);
            if (success) {
              loadPatient();
            }
          }}
          variant="outline"
          className="w-full"
          disabled={actionLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reprocess Record
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
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
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

      {/* Start Next Patient */}
      {patient.job_status === 'succeeded' && (
        <Button
          onClick={() => navigate('/lg-capture')}
          className="w-full"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          Start Next Patient
        </Button>
      )}
      </div>
    </>
  );
}
