import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLGCapture, LGPatient } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Search, Plus, FileText, Loader2, CheckCircle2, XCircle, Clock, Upload, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import pdfIcon from '@/assets/pdf-icon.png';
import { LGValidationModal } from '@/components/lg-capture/LGValidationModal';

function formatNhsNumber(nhs: string | null | undefined): string {
  if (!nhs) return '—';
  const cleaned = nhs.replace(/\s/g, '');
  if (cleaned.length !== 10) return nhs;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
}

function formatDob(dob: string | null | undefined): string {
  if (!dob) return '—';
  try {
    const date = new Date(dob);
    if (isNaN(date.getTime())) return dob;
    return format(date, 'dd-MM-yyyy');
  } catch {
    return dob;
  }
}

export default function LGCapturePatients() {
  const navigate = useNavigate();
  const { listPatients, isLoading } = useLGCapture();
  const { activeUploads, queue } = useLGUploadQueue();
  
  const [patients, setPatients] = useState<LGPatient[]>([]);
  const [search, setSearch] = useState('');
  const [practiceNames, setPracticeNames] = useState<Record<string, string>>({});
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [selectedPatientForValidation, setSelectedPatientForValidation] = useState<LGPatient | null>(null);

  // Fetch practice names lookup
  useEffect(() => {
    const fetchPracticeNames = async () => {
      const { data } = await supabase
        .from('gp_practices')
        .select('practice_code, name');
      if (data) {
        const lookup: Record<string, string> = {};
        data.forEach(p => {
          lookup[p.practice_code] = p.name;
        });
        setPracticeNames(lookup);
      }
    };
    fetchPracticeNames();
  }, []);

  useEffect(() => {
    const load = async () => {
      const data = await listPatients();
      setPatients(data);
    };
    load();
  }, [listPatients]);

  // Real-time subscription for live status updates - filtered by current user
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      channel = supabase
        .channel('lg-patients-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'lg_patients',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updated = payload.new as LGPatient;
            // Defensive check: ensure record belongs to current user
            if (updated.user_id !== user.id) return;
            
            setPatients(prev => {
              const exists = prev.find(p => p.id === updated.id);
              if (exists) {
                return prev.map(p => p.id === updated.id ? updated : p);
              } else {
                return [updated, ...prev];
              }
            });
          }
        })
        .subscribe();
    };
    
    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleSearch = async () => {
    const data = await listPatients(search || undefined);
    setPatients(data);
  };

  const handleDeleteAll = async () => {
    if (deleteConfirmText.toLowerCase() !== 'yes i am sure') {
      toast.error('Please type "yes i am sure" to confirm deletion');
      return;
    }
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('lg_patients')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
      
      if (error) throw error;
      
      setPatients([]);
      setShowDeleteAllDialog(false);
      setDeleteConfirmText('');
      toast.success('All LG captures deleted successfully');
    } catch (error) {
      console.error('Delete all error:', error);
      toast.error('Failed to delete all captures');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (patient: LGPatient) => {
    // Check if this patient is in our local upload queue
    const queueItem = queue.find(q => q.patientId === patient.id);
    
    if (queueItem) {
      if (queueItem.status === 'uploading') {
        return (
          <div className="flex flex-col items-end gap-1">
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Upload className="h-3 w-3 mr-1 animate-pulse" />
              Uploading
            </Badge>
            <Progress value={queueItem.uploadProgress} className="w-20 h-1.5" />
          </div>
        );
      }
      if (queueItem.status === 'queued') {
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Queued
          </Badge>
        );
      }
    }

    // Fall back to database status
    switch (patient.job_status) {
      case 'succeeded':
        // Show orange badge if no NHS number
        const hasNhsNumber = patient.ai_extracted_nhs && patient.ai_extracted_nhs.trim() !== '';
        return (
          <Badge className={hasNhsNumber 
            ? "bg-green-100 text-green-700 hover:bg-green-100" 
            : "bg-orange-100 text-orange-700 hover:bg-orange-100"
          }>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'uploading':
        return (
          <div className="flex flex-col items-end gap-1">
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Upload className="h-3 w-3 mr-1 animate-pulse" />
              Uploading
            </Badge>
            {patient.upload_progress !== null && (
              <Progress value={patient.upload_progress} className="w-20 h-1.5" />
            )}
          </div>
        );
      case 'queued':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Queued
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {patient.job_status}
          </Badge>
        );
    }
  };

  const handleRefresh = async () => {
    const data = await listPatients(search || undefined);
    setPatients(data);
    toast.success('Refreshed');
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/lg-capture')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">Recent LG Captures</h1>
        <p className="text-muted-foreground text-sm">
          Search by patient name or NHS number
        </p>
        {activeUploads > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
            <Upload className="h-4 w-4 animate-pulse" />
            <span>{activeUploads} upload{activeUploads > 1 ? 's' : ''} in progress...</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* New Patient Button - just above patient list */}
      <Button onClick={() => navigate('/lg-capture/upload')} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        New Patient
      </Button>

      {/* Patient List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : patients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No captures found</p>
            <Button
              variant="link"
              onClick={() => navigate('/lg-capture/upload')}
              className="mt-2"
            >
              Start your first capture
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => {
            const pdfUrl = (patient as any).pdf_url;
            const pdfPartUrls = (patient as any).pdf_part_urls;
            const hasPdf = pdfUrl || (pdfPartUrls && pdfPartUrls.length > 0);
            
            const handleDownloadPdf = async (url: string, e: React.MouseEvent) => {
              e.stopPropagation();
              try {
                const { data, error } = await supabase.storage
                  .from('lg')
                  .createSignedUrl(url.replace('lg/', ''), 3600);
                if (error) throw error;
                window.open(data.signedUrl, '_blank');
              } catch (err) {
                console.error('PDF download error:', err);
                toast.error('Failed to download PDF');
              }
            };
            
            return (
              <Card
                key={patient.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/lg-capture/results/${patient.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {patient.patient_name || patient.ai_extracted_name || 'Extracting...'}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        NHS: {formatNhsNumber(patient.nhs_number || patient.ai_extracted_nhs)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        DOB: {formatDob(patient.dob || patient.ai_extracted_dob)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(patient)}
                        {/* PDF Icon - after badge */}
                        {hasPdf && patient.job_status === 'succeeded' && (
                          pdfPartUrls && pdfPartUrls.length > 0 ? (
                            pdfPartUrls.map((url: string, index: number) => (
                              <button
                                key={index}
                                onClick={(e) => handleDownloadPdf(url, e)}
                                className="p-0.5 rounded hover:bg-muted transition-colors group relative"
                                title={`Download PDF Part ${index + 1}`}
                              >
                                <img src={pdfIcon} alt="PDF" className="h-5 w-5 group-hover:opacity-80" />
                                <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-3 h-3 flex items-center justify-center">
                                  {index + 1}
                                </span>
                              </button>
                            ))
                          ) : pdfUrl ? (
                            <button
                              onClick={(e) => handleDownloadPdf(pdfUrl, e)}
                              className="p-0.5 rounded hover:bg-muted transition-colors"
                              title="Download PDF"
                            >
                              <img src={pdfIcon} alt="PDF" className="h-5 w-5 hover:opacity-80" />
                            </button>
                          ) : null
                        )}
                        {/* Validate & Upload Icon */}
                        {patient.job_status === 'succeeded' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPatientForValidation(patient);
                              setValidationModalOpen(true);
                            }}
                            className="p-1 rounded hover:bg-primary/10 transition-colors text-primary"
                            title="Validate & Upload to Clinical System"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground text-right">
                        {patient.practice_ods}{practiceNames[patient.practice_ods] ? ` - ${practiceNames[patient.practice_ods]}` : ''}
                        {patient.uploader_name && (
                          <span className="block opacity-70">Scanned by {patient.uploader_name}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground opacity-70">
                        {format(new Date(patient.created_at), 'dd-MM-yyyy HH:mm')} • {patient.images_count} pages
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete All Button */}
      {patients.length > 0 && (
        <div className="pt-6 border-t">
          <Button
            variant="destructive"
            onClick={() => setShowDeleteAllDialog(true)}
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete All Captures
          </Button>
        </div>
      )}

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All LG Captures?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                This will permanently delete <strong>all {patients.length} LG capture records</strong> and their associated files. This action cannot be undone.
              </p>
              <p>
                To confirm, please type <strong>"yes i am sure"</strong> below:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type 'yes i am sure' to confirm"
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleteConfirmText.toLowerCase() !== 'yes i am sure' || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation Modal */}
      {selectedPatientForValidation && (
        <LGValidationModal
          open={validationModalOpen}
          onClose={() => {
            setValidationModalOpen(false);
            setSelectedPatientForValidation(null);
          }}
          patient={{
            id: selectedPatientForValidation.id,
            patient_name: selectedPatientForValidation.patient_name || selectedPatientForValidation.ai_extracted_name,
            nhs_number: selectedPatientForValidation.nhs_number || selectedPatientForValidation.ai_extracted_nhs,
            dob: selectedPatientForValidation.dob || selectedPatientForValidation.ai_extracted_dob,
            images_count: selectedPatientForValidation.images_count,
            created_at: selectedPatientForValidation.created_at,
            pdf_url: (selectedPatientForValidation as any).pdf_url || null,
            pdf_final_size_mb: (selectedPatientForValidation as any).pdf_final_size_mb || null,
            pdf_part_urls: (selectedPatientForValidation as any).pdf_part_urls || null,
            pdf_split: (selectedPatientForValidation as any).pdf_split || null,
          }}
          onValidated={async () => {
            const data = await listPatients();
            setPatients(data);
          }}
        />
      )}
    </div>
  );
}