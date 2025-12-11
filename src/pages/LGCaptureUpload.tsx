import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Upload, FileImage, FileText, Trash2, RotateCcw, GripVertical, FastForward, Loader2, Eye, EyeOff, Camera, Files, X, Check, AlertCircle, ArrowRight, History, ListOrdered, RefreshCw, FolderOpen, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { generateULID } from '@/utils/ulid';
import { extractPdfPages, PdfExtractionProgress, ExtractedPage } from '@/utils/pdfPageExtractor';
import { analyseBlankness } from '@/utils/blankPageDetector';
import { autoCorrectOrientation } from '@/utils/pageOrientationDetector';
import { CapturedImage } from '@/hooks/useLGCapture';
import { useDropzone } from 'react-dropzone';
import { LGCameraModal } from '@/components/lg-capture/LGCameraModal';
import WatchFolderSettings from '@/components/lg-capture/WatchFolderSettings';
import BulkUploadHistory from '@/components/lg-capture/BulkUploadHistory';
import { LGProcessingQueue } from '@/components/lg-capture/LGProcessingQueue';

interface UploadImage extends CapturedImage {
  isBlank?: boolean;
  blankConfidence?: number;
}

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

type CaptureMode = 'single' | 'bulk';

export default function LGCaptureUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { queuePatient, activeUploads, queue } = useLGUploadQueue();
  
  // Mode state - check URL param for initial mode
  const initialMode = searchParams.get('mode') === 'single' ? 'single' : 'bulk';
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  
  // Single patient mode state
  const [images, setImages] = useState<UploadImage[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<PdfExtractionProgress | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalysingCapture, setIsAnalysingCapture] = useState(false);
  
  // Bulk mode state
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [practiceOds, setPracticeOds] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  
  const maxPages = 1000;
  
  // Blank detection threshold adjusters for testing
  const [whiteThreshold, setWhiteThreshold] = useState(85);
  const [stdDevThreshold, setStdDevThreshold] = useState(16);

  const blankCount = images.filter(img => img.isBlank).length;
  const nonBlankImages = images.filter(img => !img.isBlank);

  // Load settings on mount for bulk mode
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

  const startNewBatch = () => {
    setFiles([]);
    setBatchId(crypto.randomUUID());
  };

  // Single patient file handling
  const handleSingleFiles = useCallback(async (acceptedFiles: File[]) => {
    const remainingSlots = maxPages - images.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxPages} pages allowed`);
      return;
    }

    const newImages: UploadImage[] = [];
    setIsExtracting(true);

    try {
      for (const file of acceptedFiles) {
        if (newImages.length >= remainingSlots) break;

        if (file.type === 'application/pdf') {
          toast.info(`Extracting pages from ${file.name}...`);
          const pages = await extractPdfPages(file, 150, (progress) => {
            setExtractionProgress(progress);
          }, true);
          
          for (const page of pages) {
            if (newImages.length >= remainingSlots) break;
            // Auto-correct upside-down pages
            const { dataUrl: correctedUrl, wasRotated } = await autoCorrectOrientation(page.dataUrl);
            if (wasRotated) {
              console.log(`Page ${newImages.length + 1} was upside-down - rotated`);
            }
            newImages.push({
              id: generateULID(),
              dataUrl: correctedUrl,
              timestamp: Date.now(),
              isBlank: page.isBlank,
              blankConfidence: page.blankConfidence,
            });
          }
          setExtractionProgress(null);
        } else if (file.type.startsWith('image/')) {
          let dataUrl = await readFileAsDataUrl(file);
          
          // Auto-correct upside-down pages
          const { dataUrl: correctedUrl, wasRotated } = await autoCorrectOrientation(dataUrl);
          if (wasRotated) {
            console.log(`Image ${file.name} was upside-down - rotated`);
            dataUrl = correctedUrl;
          }
          
          let isBlank = false;
          let blankConfidence = 0;
          try {
            const result = await analyseBlankness(dataUrl, whiteThreshold, stdDevThreshold);
            isBlank = result.isBlank;
            blankConfidence = result.confidence;
          } catch {
            // Ignore analysis errors
          }
          
          newImages.push({
            id: generateULID(),
            dataUrl,
            timestamp: Date.now(),
            isBlank,
            blankConfidence,
          });
        }
      }

      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      console.error('File processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to process file(s): ${errorMessage}`);
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  }, [images.length]);

  // Bulk mode file handling
  const handleBulkFiles = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length !== acceptedFiles.length) {
      toast.warning('Some files were skipped - only PDF files are accepted in bulk mode');
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
    onDrop: mode === 'single' ? handleSingleFiles : handleBulkFiles,
    accept: mode === 'single' 
      ? {
          'image/jpeg': ['.jpg', '.jpeg'],
          'image/png': ['.png'],
          'image/webp': ['.webp'],
          'application/pdf': ['.pdf'],
        }
      : { 'application/pdf': ['.pdf'] },
    disabled: isExtracting || isSubmitting || isProcessingBulk,
    multiple: true,
  });

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCameraCapture = useCallback(async (capturedImage: CapturedImage) => {
    setIsAnalysingCapture(true);
    
    let isBlank = false;
    let blankConfidence = 0;
    
    try {
      const result = await analyseBlankness(capturedImage.dataUrl, whiteThreshold, stdDevThreshold);
      isBlank = result.isBlank;
      blankConfidence = result.confidence;
    } catch {
      // Ignore analysis errors
    }
    
    const uploadImage: UploadImage = {
      ...capturedImage,
      isBlank,
      blankConfidence,
    };
    
    setImages(prev => [...prev, uploadImage]);
    setIsAnalysingCapture(false);
  }, []);

  const rotateImage = useCallback((index: number) => {
    const image = images[index];
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.height;
      canvas.height = img.width;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const newDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setImages(prev => {
        const newImages = [...prev];
        newImages[index] = { ...image, dataUrl: newDataUrl };
        return newImages;
      });
    };
    img.src = image.dataUrl;
  }, [images]);

  const deleteImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleBlank = useCallback((index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      newImages[index] = { 
        ...newImages[index], 
        isBlank: !newImages[index].isBlank,
        blankConfidence: newImages[index].isBlank ? 0 : 1,
      };
      return newImages;
    });
  }, []);

  const removeAllBlanks = useCallback(() => {
    setImages(prev => prev.filter(img => !img.isBlank));
  }, []);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setImages(prev => {
      const newImages = [...prev];
      const [draggedItem] = newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, draggedItem);
      return newImages;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Single patient submit
  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }

    const imagesToSubmit = nonBlankImages;
    
    if (imagesToSubmit.length === 0) {
      toast.error('No pages to submit (all pages marked as blank)');
      return;
    }

    setIsSubmitting(true);

    try {
      const savedPracticeOds = localStorage.getItem('lg_practice_ods') || 'UNKNOWN';
      const savedUploaderName = localStorage.getItem('lg_uploader_name') || 'Unknown';

      const patientId = generateULID();
      const { error } = await supabase
        .from('lg_patients')
        .insert({
          id: patientId,
          user_id: user.id,
          practice_ods: savedPracticeOds,
          uploader_name: savedUploaderName,
          job_status: 'draft',
          sex: 'unknown',
          images_count: imagesToSubmit.length,
        });

      if (error) {
        throw error;
      }

      queuePatient(patientId, savedPracticeOds, imagesToSubmit);
      
      navigate('/lg-capture/patients');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit files');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk mode process files
  const processBulkFiles = async () => {
    if (!user?.id || !practiceOds || !uploaderName) {
      toast.error('Please configure practice settings first');
      navigate('/lg-capture');
      return;
    }

    setIsProcessingBulk(true);
    const pendingFiles = files.filter(f => f.status === 'pending');

    for (const qFile of pendingFiles) {
      try {
        setFiles(prev => prev.map(f => 
          f.id === qFile.id ? { ...f, status: 'extracting' as const, progress: 10 } : f
        ));

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
          true
        );

        const pageCount = pages.length;
        
        setFiles(prev => prev.map(f => 
          f.id === qFile.id ? { ...f, pageCount, progress: 50 } : f
        ));

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

        const capturedImages: CapturedImage[] = pages
          .filter(p => !p.isBlank)
          .map((page, index) => ({
            id: `${patientId}-page-${index + 1}`,
            dataUrl: page.dataUrl,
            timestamp: Date.now()
          }));

        queuePatient(patientId, practiceOds, capturedImages);

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

    setIsProcessingBulk(false);
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

  const getProgressText = () => {
    if (!extractionProgress) return 'Processing files...';
    if (extractionProgress.phase === 'analysing') {
      return `Detecting blank pages ${extractionProgress.currentPage}/${extractionProgress.totalPages}...`;
    }
    return `Extracting page ${extractionProgress.currentPage} of ${extractionProgress.totalPages}...`;
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const queuedCount = files.filter(f => f.status === 'queued').length;
  const failedCount = files.filter(f => f.status === 'failed').length;

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/lg-capture')}
        className="mb-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to LG Capture
      </Button>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Capture Lloyd George Pages</h1>
        <p className="text-muted-foreground text-sm">
          {mode === 'single' 
            ? 'Upload files or use camera. Drop multiple PDFs to merge into one record.'
            : 'Drop multiple PDF files to queue them all for processing automatically'
          }
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={mode === 'single' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('single')}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Single Patient
          </Button>
          <Button
            variant={mode === 'bulk' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('bulk')}
            className="gap-2"
          >
            <Files className="h-4 w-4" />
            Bulk PDFs
          </Button>
        </div>
      </div>

      {/* SINGLE PATIENT MODE */}
      {mode === 'single' && (
        <>
          {/* Drop Zone */}
          <Card>
            <CardContent className="p-6">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}
                  ${isExtracting || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input {...getInputProps()} />
                
                {isExtracting ? (
                  <div className="space-y-4">
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {getProgressText()}
                    </p>
                    {extractionProgress && (
                      <Progress value={extractionProgress.percentage} className="max-w-xs mx-auto" />
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center gap-4 mb-4">
                      <FileImage className="h-10 w-10 text-muted-foreground" />
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium mb-2">
                      {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse • Drop multiple PDFs to merge
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports: JPEG, PNG, WebP images and PDF files (up to 1000 pages)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Blank pages are automatically detected
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Camera Button */}
          <Button
            onClick={() => setIsCameraOpen(true)}
            variant="outline"
            className="w-full h-14 text-lg"
            size="lg"
            disabled={isExtracting || isSubmitting || images.length >= maxPages}
          >
            <Camera className="mr-2 h-6 w-6" />
            📷 Capture with Camera
            {isAnalysingCapture && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          </Button>

          {/* Camera Modal */}
          <LGCameraModal
            open={isCameraOpen}
            onOpenChange={setIsCameraOpen}
            onCapture={handleCameraCapture}
            capturedCount={images.length}
            maxPages={maxPages}
          />

          {/* Submit Button */}
          {images.length > 0 && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isExtracting || nonBlankImages.length === 0}
              className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <FastForward className="mr-2 h-5 w-5" />
                  Submit for Processing ({nonBlankImages.length} pages)
                  {blankCount > 0 && <span className="ml-1 text-green-200">• {blankCount} blank excluded</span>}
                </>
              )}
            </Button>
          )}

          {/* Image Grid */}
          {images.length > 0 && (
            <div className="space-y-3">
              {/* Threshold Adjusters */}
              <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
                <div className="text-sm font-medium">Blank Detection Settings (for testing)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="text-xs text-muted-foreground">White % Threshold</label>
                    <input
                      type="number"
                      value={whiteThreshold}
                      onChange={(e) => setWhiteThreshold(Number(e.target.value))}
                      className="w-full mt-1 px-2 py-1 text-sm border rounded"
                      min={50}
                      max={99}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Std Dev Threshold</label>
                    <input
                      type="number"
                      value={stdDevThreshold}
                      onChange={(e) => setStdDevThreshold(Number(e.target.value))}
                      className="w-full mt-1 px-2 py-1 text-sm border rounded"
                      min={5}
                      max={50}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const updatedImages = await Promise.all(
                        images.map(async (img) => {
                          try {
                            const result = await analyseBlankness(img.dataUrl, whiteThreshold, stdDevThreshold);
                            return { ...img, isBlank: result.isBlank, blankConfidence: result.confidence };
                          } catch {
                            return img;
                          }
                        })
                      );
                      setImages(updatedImages);
                    }}
                  >
                    Re-analyse All
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Lower white% = more aggressive. Higher stdDev = more tolerant of edge marks.
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    {images.length} page(s) • Drag to reorder
                  </p>
                  {blankCount > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      {blankCount} blank
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {blankCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={removeAllBlanks}
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      Remove {blankCount} blank
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImages([])}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear all
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((image, index) => {
                  return (
                  <div
                    key={image.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`relative aspect-[3/4] bg-muted rounded-lg overflow-hidden cursor-move border-2 ${
                      draggedIndex === index ? 'border-primary opacity-50' : 
                      image.isBlank ? 'border-amber-400 opacity-60' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={image.dataUrl}
                      alt={`Page ${index + 1}`}
                      className={`absolute inset-0 w-full h-full object-cover ${image.isBlank ? 'grayscale' : ''}`}
                    />
                    
                    {image.isBlank && (
                      <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                        <Badge className="bg-amber-500 text-white text-xs">BLANK</Badge>
                      </div>
                    )}
                    
                    <div className={`absolute top-1 left-1 text-xs font-bold px-2 py-1 rounded ${
                      image.isBlank ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded">
                      <GripVertical className="h-3 w-3" />
                    </div>
                    
                    <div className="absolute bottom-1 right-1 flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBlank(index);
                        }}
                        className={`p-1.5 rounded ${
                          image.isBlank 
                            ? 'bg-amber-500 text-white hover:bg-amber-600' 
                            : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                        title={image.isBlank ? 'Mark as not blank' : 'Mark as blank'}
                      >
                        {image.isBlank ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rotateImage(index);
                        }}
                        className="bg-black/50 text-white p-1.5 rounded hover:bg-black/70"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImage(index);
                        }}
                        className="bg-red-500/80 text-white p-1.5 rounded hover:bg-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info Card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Blank pages are automatically detected and excluded from processing to save time and costs. 
                You can manually toggle the blank status of any page using the eye icon.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* BULK MODE */}
      {mode === 'bulk' && (
        <Tabs defaultValue="upload" className="w-full">
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
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6 mt-6">
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
                  
                  <div className="flex gap-2 pt-3">
                    {pendingCount > 0 ? (
                      <Button
                        onClick={processBulkFiles}
                        disabled={isProcessingBulk}
                        className="flex-1"
                      >
                        {isProcessingBulk ? (
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

            {/* Watch Folder Settings */}
            <WatchFolderSettings 
              practiceOds={practiceOds}
              uploaderName={uploaderName}
              batchId={batchId}
            />

            {/* My Stats Button */}
            <Button
              variant="outline"
              onClick={() => navigate('/lg-capture/my-stats')}
              className="w-full"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              My Stats
            </Button>
          </TabsContent>

          <TabsContent value="queue" className="space-y-4 mt-6">
            <p className="text-muted-foreground text-sm">
              View files currently being uploaded and processed
            </p>
            <LGProcessingQueue />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistoryRefreshTrigger(prev => prev + 1)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <BulkUploadHistory refreshTrigger={historyRefreshTrigger} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
