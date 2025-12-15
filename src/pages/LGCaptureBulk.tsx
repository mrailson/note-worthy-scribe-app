import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Home, Upload, FileText, Check, X, Loader2, 
  FolderOpen, AlertCircle, ArrowRight, Files, RefreshCw, ListOrdered 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { extractPdfPages, ExtractedPage } from '@/utils/pdfPageExtractor';
import { removePatchPage } from '@/utils/patchPageDetector';
import { generateULID } from '@/utils/ulid';
import { toast } from 'sonner';
import { CapturedImage } from '@/hooks/useLGCapture';
import WatchFolderSettings from '@/components/lg-capture/WatchFolderSettings';
import { LGProcessingQueue } from '@/components/lg-capture/LGProcessingQueue';

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
  const { queuePatient, activeUploads, queue } = useLGUploadQueue();
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [practiceOds, setPracticeOds] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const [recentlyQueuedCount, setRecentlyQueuedCount] = useState(0);
  const [activeTab, setActiveTab] = useState('upload');

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
        const defaults = data.setting_value as { practiceOds?: string; uploaderName?: string };
        if (defaults.practiceOds) setPracticeOds(defaults.practiceOds);
        if (defaults.uploaderName) setUploaderName(defaults.uploaderName);
      }
      
      // Fallback to localStorage
      if (!practiceOds) setPracticeOds(localStorage.getItem('lg_practice_ods') || '');
      if (!uploaderName) setUploaderName(localStorage.getItem('lg_uploader_name') || '');
    };
    loadSettings();
  }, [user?.id]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length !== acceptedFiles.length) {
      toast.warning('Some files were skipped - only PDF files are accepted');
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true
  });

  const processFiles = async () => {
    if (!user?.id || !practiceOds || !uploaderName) {
      toast.error('Please configure practice settings first');
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

        // Extract pages from PDF
        let pages = await extractPdfPages(
          qFile.file,
          150,
          (progress) => {
            setFiles(prev => prev.map(f => 
              f.id === qFile.id 
                ? { ...f, progress: 10 + Math.round(progress.percentage * 0.4) } 
                : f
            ));
          },
          true // detect blanks
        );

        // Remove patch page if detected (max 1 page, first page only, >90% confidence)
        const originalCount = pages.length;
        pages = removePatchPage(pages, (removedPage, reason) => {
          console.log(`[Bulk Capture] Removed patch page from ${qFile.fileName}: ${reason}`);
          toast.info(`Removed scanner patch page from ${qFile.fileName}`);
        });
        
        if (pages.length < originalCount) {
          console.log(`[Bulk Capture] ${qFile.fileName}: Reduced from ${originalCount} to ${pages.length} pages (patch page removed)`);
        }

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
            batch_id: batchId
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
            timestamp: Date.now()
          }));

        // Queue for upload with file metadata
        queuePatient(patientId, practiceOds, capturedImages, {
          fileName: qFile.fileName,
          fileSize: qFile.fileSize
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
      toast.success(`${queuedNow} file${queuedNow !== 1 ? 's' : ''} queued for processing`);
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
        <TabsList className="grid w-full grid-cols-2">
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

          {/* Watch Folder Settings */}
          {/* Watch Folder Settings */}
          <WatchFolderSettings 
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
      </Tabs>
    </div>
  );
}