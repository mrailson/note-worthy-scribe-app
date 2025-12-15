import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Home, Upload, FileText, Check, X, Loader2, 
  FolderOpen, AlertCircle, ArrowRight, Files, History, RefreshCw, ListOrdered,
  Search, Plus, CheckCircle2, XCircle, Clock, ShieldCheck, RotateCcw, UserX,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLGCapture, LGPatient } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { extractPdfPages, ExtractedPage } from '@/utils/pdfPageExtractor';
import { generateULID } from '@/utils/ulid';
// Toast messages removed from LG Capture service
import { format } from 'date-fns';
import { CapturedImage } from '@/hooks/useLGCapture';
import WatchFolderPipelineView from '@/components/lg-capture/WatchFolderPipelineView';
import BulkUploadHistory from '@/components/lg-capture/BulkUploadHistory';
import { LGProcessingQueue } from '@/components/lg-capture/LGProcessingQueue';
import { LGValidationModal } from '@/components/lg-capture/LGValidationModal';
import pdfIcon from '@/assets/pdf-icon.png';

interface QueuedFile {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  pageCount: number | null;
  status: 'pending' | 'extracting' | 'uploading' | 'queued' | 'failed';
  progress: number;
  error?: string;
  patientId?: string;
  batchId: string;
}

export default function LGCaptureBulk() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listPatients, isLoading: isPatientsLoading } = useLGCapture();
  const { queuePatient, activeUploads, queue } = useLGUploadQueue();
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [practiceOds, setPracticeOds] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const [recentlyQueuedCount, setRecentlyQueuedCount] = useState(0);
  const [activeTab, setActiveTab] = useState('upload');
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const [processingFilesCount, setProcessingFilesCount] = useState(0);
  
  // Individual captures state (for history tab)
  const [patients, setPatients] = useState<LGPatient[]>([]);
  const [search, setSearch] = useState('');
  const [practiceNames, setPracticeNames] = useState<Record<string, string>>({});
  const [batchHistoryOpen, setBatchHistoryOpen] = useState(true);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [selectedPatientForValidation, setSelectedPatientForValidation] = useState<LGPatient | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [showMixedPatientWarnings, setShowMixedPatientWarnings] = useState(true);

  const startNewBatch = () => {
    setFiles([]);
    setBatchId(crypto.randomUUID());
    setRecentlyQueuedCount(0);
  };

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'lg_capture_defaults')
        .maybeSingle();
      
      if (data?.setting_value) {
        const defaults = data.setting_value as { 
          practiceOds?: string; 
          uploaderName?: string;
          compressionLevel?: number;
          mixedPatientDetection?: boolean;
          preserveQuality?: boolean;
        };
        if (defaults.practiceOds) setPracticeOds(defaults.practiceOds);
        if (defaults.uploaderName) setUploaderName(defaults.uploaderName);
        // Store compressionLevel in localStorage for use when queuing
        if (defaults.compressionLevel) {
          localStorage.setItem('lg_compression_level', String(defaults.compressionLevel));
        }
        // Store preserveQuality in localStorage for use when queuing
        if (defaults.preserveQuality !== undefined) {
          localStorage.setItem('lg_preserve_quality', String(defaults.preserveQuality));
        }
        // Load mixed patient detection setting
        if (defaults.mixedPatientDetection !== undefined) {
          setShowMixedPatientWarnings(defaults.mixedPatientDetection);
        }
      }
      
      // Fallback to localStorage
      if (!practiceOds) setPracticeOds(localStorage.getItem('lg_practice_ods') || '');
      if (!uploaderName) setUploaderName(localStorage.getItem('lg_uploader_name') || '');
    };
    loadSettings();
  }, [user?.id]);

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

  // Load patients for history tab
  useEffect(() => {
    const load = async () => {
      const data = await listPatients();
      setPatients(data);
    };
    load();
  }, [listPatients, historyRefreshTrigger]);

  // Real-time subscription for patient updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupSubscription = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      
      channel = supabase
        .channel('lg-patients-bulk-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'lg_patients',
          filter: `user_id=eq.${authUser.id}`,
        }, (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updated = payload.new as LGPatient;
            if (updated.user_id !== authUser.id) return;
            
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

  const handleRefreshPatients = async () => {
    const data = await listPatients(search || undefined);
    setPatients(data);
  };

  const handleReprocessSummary = async (patientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReprocessingId(patientId);
    try {
      const { error } = await supabase.functions.invoke('lg-process-summary', {
        body: { patientId }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Reprocess error:', err);
    } finally {
      setReprocessingId(null);
    }
  };

  const formatNhsNumber = (nhs: string | null | undefined): string => {
    if (!nhs) return '—';
    const cleaned = nhs.replace(/\s/g, '');
    if (cleaned.length !== 10) return nhs;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  };

  const formatDob = (dob: string | null | undefined): string => {
    if (!dob) return '—';
    try {
      const date = new Date(dob);
      if (isNaN(date.getTime())) return dob;
      return format(date, 'dd-MM-yyyy');
    } catch {
      return dob;
    }
  };

  const getPatientStatusBadge = (patient: LGPatient) => {
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

    switch (patient.job_status) {
      case 'succeeded':
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

  const handleDownloadPdf = async (patient: LGPatient, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let cleanPath = url.startsWith('lg/') ? url.slice(3) : url;
      
      let { data, error } = await supabase.storage
        .from('lg')
        .download(cleanPath);
      
      if (error || !data) {
        const basePath = `${patient.practice_ods}/${patient.id}/final`;
        const { data: files } = await supabase.storage
          .from('lg')
          .list(basePath, { limit: 20 });
        
        if (files && files.length > 0) {
          const pdfFiles = files.filter(f => f.name.endsWith('.pdf') && !f.name.includes('compressed'));
          const targetFile = pdfFiles.find(f => f.name.startsWith('Lloyd_George')) || pdfFiles[0];
          if (targetFile) {
            cleanPath = `${basePath}/${targetFile.name}`;
            const result = await supabase.storage.from('lg').download(cleanPath);
            data = result.data;
            error = result.error;
          }
        }
      }
      
      if (error || !data) throw error || new Error('No data');
      
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanPath.split('/').pop() || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('PDF download error:', err);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length !== acceptedFiles.length) {
      console.log('Some files were skipped - only PDF files are accepted');
    }
    
    const newFiles: QueuedFile[] = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      fileSize: file.size,
      pageCount: null,
      status: 'pending',
      progress: 0,
      batchId
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, [batchId]);

  // Auto-process files when they are dropped (if settings are configured)
  useEffect(() => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length > 0 && !isProcessing && user?.id && practiceOds && uploaderName) {
      // Small delay to allow UI to update and batch multiple rapid drops
      const timer = setTimeout(() => {
        processFiles();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [files, isProcessing, user?.id, practiceOds, uploaderName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true
  });

  const processFiles = async () => {
    if (!user?.id || !practiceOds || !uploaderName) {
      navigate('/lg-capture');
      return;
    }

    setIsProcessing(true);
    const pendingFiles = files.filter(f => f.status === 'pending');

    for (const qFile of pendingFiles) {
      try {
        // Update status to extracting
        setFiles(prev => prev.map(f => 
          f.id === qFile.id ? { ...f, status: 'extracting' as const, progress: 10 } : f
        ));

        // Check if preserve quality mode is enabled
        const preserveQuality = localStorage.getItem('lg_preserve_quality') === 'true';

        // Extract pages from PDF - NO page removal, PDFs are pre-cleansed
        // Preserve quality mode keeps original visual fidelity but avoids over-scaling (prevents PDF generation timeouts)
        const pages = await extractPdfPages(
          qFile.file,
          150,
          (progress) => {
            setFiles(prev => prev.map(f => 
              f.id === qFile.id 
                ? { ...f, progress: 10 + Math.round(progress.percentage * 0.4) } 
                : f
            ));
          },
          false, // skip blank detection - PDFs are pre-cleansed
          preserveQuality // pass preserve quality flag
        );

        const pageCount = pages.length;
        
        setFiles(prev => prev.map(f => 
          f.id === qFile.id ? { ...f, pageCount, progress: 50 } : f
        ));

        // Create patient record
        const patientId = generateULID();
        
        const { error: insertError } = await supabase
          .from('lg_patients')
          .insert({
            id: patientId,
            user_id: user.id,
            practice_ods: practiceOds,
            uploader_name: uploaderName,
            job_status: 'draft',
            images_count: pageCount,
            source_page_count: pageCount, // Track original PDF page count before any processing
            sex: 'unknown',
            batch_id: batchId,
            source_filename: qFile.fileName // Store original filename for backup reference
          });

        if (insertError) {
          throw new Error(`Failed to create patient record: ${insertError.message}`);
        }

        setFiles(prev => prev.map(f => 
          f.id === qFile.id 
            ? { ...f, status: 'uploading' as const, patientId, progress: 60 } 
            : f
        ));

        // Convert ExtractedPage[] to CapturedImage[] for queue
        const capturedImages: CapturedImage[] = pages
          // NO FILTERING - all pages preserved as scans are pre-cleansed
          .map((page, index) => ({
            id: `${patientId}-page-${index + 1}`,
            dataUrl: page.dataUrl,
            timestamp: Date.now(),
            blob: page.blob,
          }));

        // Queue for upload with file metadata and compression level
        const compressionLevel = parseInt(localStorage.getItem('lg_compression_level') || '4', 10);
        const preserveQualityFlag = localStorage.getItem('lg_preserve_quality') === 'true';
        queuePatient(patientId, practiceOds, capturedImages, {
          fileName: qFile.fileName,
          fileSize: qFile.fileSize,
          compressionLevel: compressionLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          preserveQuality: preserveQualityFlag
        });

        setFiles(prev => prev.map(f => 
          f.id === qFile.id 
            ? { ...f, status: 'queued' as const, progress: 100 } 
            : f
        ));

      } catch (err) {
        console.error('Error processing file:', qFile.fileName, err);
        setFiles(prev => prev.map(f => 
          f.id === qFile.id 
            ? { ...f, status: 'failed' as const, error: err instanceof Error ? err.message : 'Unknown error' } 
            : f
        ));
      }
    }

    // After all files processed, clear the list and show confirmation
    const successCount = files.filter(f => f.status !== 'failed').length + pendingFiles.filter(f => !files.find(pf => pf.id === f.id && pf.status === 'failed')).length;
    const queuedNow = pendingFiles.length - files.filter(f => pendingFiles.find(pf => pf.id === f.id) && f.status === 'failed').length;
    
    if (queuedNow > 0) {
      setRecentlyQueuedCount(queuedNow);
      setFiles([]); // Clear files immediately
      setBatchId(crypto.randomUUID()); // New batch ID for next uploads
    }

    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const getStatusBadge = (status: QueuedFile['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'extracting':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">Extracting...</Badge>;
      case 'uploading':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">Uploading...</Badge>;
      case 'queued':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200"><Check className="h-3 w-3 mr-1" />Queued</Badge>;
      case 'failed':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Failed</Badge>;
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const queuedCount = files.filter(f => f.status === 'queued').length;
  const failedCount = files.filter(f => f.status === 'failed').length;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      <Button variant="ghost" onClick={() => navigate('/lg-capture')} className="mb-2">
        <Home className="mr-2 h-4 w-4" />
        Back to LG Capture
      </Button>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Files className="h-6 w-6" />
          Bulk Capture
        </h1>
        <p className="text-muted-foreground text-sm">
          Drop multiple PDF files to queue them all for processing automatically
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            Queue
            {(activeUploads > 0 || queue.length > 0) && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeUploads + queue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
            {processingFilesCount > 0 && (
              <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs bg-amber-100 text-amber-700 border-amber-300">
                {processingFilesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6 mt-6">
          {/* Confirmation Banner */}
          {recentlyQueuedCount > 0 && (
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        {recentlyQueuedCount} file{recentlyQueuedCount !== 1 ? 's' : ''} queued for processing
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        You may add more files when ready
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveTab('queue');
                      setRecentlyQueuedCount(0);
                    }}
                    className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900"
                  >
                    View Queue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Watch Folder Pipeline View */}
          <WatchFolderPipelineView 
            practiceOds={practiceOds}
            uploaderName={uploaderName}
            batchId={batchId}
          />

          {/* Drop Zone */}
          <Card>
            <CardContent className="pt-6">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                {isDragActive ? (
                  <p className="text-primary font-medium">Drop PDF files here...</p>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">Drop PDF files here or click to browse</p>
                    <p className="text-sm text-muted-foreground">Each PDF will be treated as a separate patient record</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Files ({files.length})</span>
                  <div className="flex items-center gap-2 text-sm font-normal">
                    {queuedCount > 0 && (
                      <span className="text-green-600">{queuedCount} Queued for Processing by Notewell AI</span>
                    )}
                    {failedCount > 0 && (
                      <span className="text-destructive">{failedCount} failed</span>
                    )}
                  </div>
                </CardTitle>
                
                {/* Queue Process Button - Above file list */}
                <div className="flex gap-2 pt-3">
                  {pendingCount > 0 ? (
                    <Button
                      onClick={processFiles}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Queue {pendingCount} File{pendingCount !== 1 ? 's' : ''} for Processing
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex-1 space-y-3">
                      {queuedCount > 0 && (
                        <p className="text-green-600 font-medium text-center text-sm">
                          All Files uploaded, Please start a new batch when ready
                        </p>
                      )}
                      <Button
                        onClick={startNewBatch}
                        variant="default"
                        className="w-full"
                      >
                        <Files className="mr-2 h-4 w-4" />
                        New Batch
                      </Button>
                    </div>
                  )}
                  {queuedCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => navigate('/lg-capture/patients')}
                    >
                      View Recent Captures
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[320px]">
                  <div className="space-y-3 pr-4">
                    {files.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{file.fileName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                            {file.pageCount !== null && (
                              <>
                                <span>•</span>
                                <span>{file.pageCount} pages</span>
                              </>
                            )}
                          </div>
                          {(file.status === 'extracting' || file.status === 'uploading') && (
                            <Progress value={file.progress} className="h-1 mt-2" />
                          )}
                          {file.error && (
                            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {file.error}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(file.status)}
                          {file.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeFile(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <FolderOpen className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">How Bulk Capture Works</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>• Each PDF is treated as one patient's Lloyd George record</li>
                    <li>• Pages are extracted and blank pages removed automatically</li>
                    <li>• Files are queued for background processing</li>
                    <li>• Email summaries arrive as each file completes</li>
                    <li>• A batch report email is sent when all files are processed</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4 mt-6">
          <p className="text-muted-foreground text-sm">
            View files currently being uploaded and processed
          </p>
          <LGProcessingQueue />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-6">
          {/* Bulk Upload Batches Section - Collapsible */}
          <Collapsible open={batchHistoryOpen} onOpenChange={setBatchHistoryOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                  {batchHistoryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Files className="h-4 w-4" />
                  <span className="font-medium">Bulk Upload Batches</span>
                  {processingFilesCount > 0 && (
                    <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs bg-amber-100 text-amber-700 border-amber-300">
                      {processingFilesCount} processing
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistoryRefreshTrigger(prev => prev + 1)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <CollapsibleContent className="mt-3">
              <BulkUploadHistory 
                refreshTrigger={historyRefreshTrigger} 
                onProcessingCountChange={setProcessingFilesCount}
                showMixedPatientWarnings={showMixedPatientWarnings}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Divider */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Individual Captures</p>
            <p className="text-muted-foreground text-sm mb-4">
              Search by patient name or NHS number
            </p>
          </div>
          
          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isPatientsLoading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* New Patient Button */}
          <Button onClick={() => navigate('/lg-capture/upload')} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            New Patient
          </Button>

          {/* Patient List */}
          {isPatientsLoading ? (
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
                const patientAny = patient as any;
                const multipleNhs = (patientAny.all_nhs_numbers_found?.length || 0) > 1;
                const multipleDobs = (patientAny.all_dobs_found?.length || 0) > 1;
                const hasConflict = patientAny.identity_verification_status === 'conflict' || (multipleNhs && multipleDobs);
                
                return (
                  <Card
                    key={patient.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${hasConflict ? 'border-red-500 border-2' : ''}`}
                    onClick={() => navigate(`/lg-capture/results/${patient.id}`)}
                  >
                    {/* RED banner for identity conflict */}
                    {hasConflict && (
                      <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2 text-sm">
                        <UserX className="h-4 w-4 flex-shrink-0" />
                        <span className="font-semibold">⚠️ MIXED PATIENT RECORDS</span>
                        <span className="opacity-90">
                          — Contains records from multiple patients
                        </span>
                      </div>
                    )}
                    <CardContent className="p-4">
                      {/* Identity conflict details */}
                      {hasConflict && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          {multipleNhs && (
                            <p>NHS numbers: {patientAny.all_nhs_numbers_found?.map((n: string) => n.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')).join(', ')}</p>
                          )}
                          {multipleDobs && (
                            <p>DOBs: {patientAny.all_dobs_found?.join(', ')}</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {patient.patient_name || patient.ai_extracted_name || 'Extracting...'}
                            </p>
                            {/* Reprocess icon for records missing patient details */}
                            {patient.job_status === 'succeeded' && !patient.patient_name && !patient.ai_extracted_name && (
                              <button
                                onClick={(e) => handleReprocessSummary(patient.id, e)}
                                disabled={reprocessingId === patient.id}
                                className="p-1 rounded hover:bg-amber-100 transition-colors text-amber-600"
                                title="Reprocess to extract patient details"
                              >
                                <RotateCcw className={`h-4 w-4 ${reprocessingId === patient.id ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground font-mono">
                            NHS: {formatNhsNumber(patient.nhs_number || patient.ai_extracted_nhs)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            DOB: {formatDob(patient.dob || patient.ai_extracted_dob)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            {getPatientStatusBadge(patient)}
                            {/* PDF Icon */}
                            {hasPdf && patient.job_status === 'succeeded' && (
                              pdfPartUrls && pdfPartUrls.length > 0 ? (
                                pdfPartUrls.map((url: string, index: number) => (
                                  <button
                                    key={index}
                                    onClick={(e) => handleDownloadPdf(patient, url, e)}
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
                                  onClick={(e) => handleDownloadPdf(patient, pdfUrl, e)}
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
          
          {/* Validation Modal */}
          {selectedPatientForValidation && (
            <LGValidationModal
              open={validationModalOpen}
              onClose={() => {
                setValidationModalOpen(false);
                setSelectedPatientForValidation(null);
              }}
              patient={selectedPatientForValidation}
              onValidated={() => {
                handleRefreshPatients();
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}