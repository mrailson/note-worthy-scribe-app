import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, FileImage, FileText, Trash2, RotateCcw, GripVertical, FastForward, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { generateULID } from '@/utils/ulid';
import { extractPdfPages, PdfExtractionProgress } from '@/utils/pdfPageExtractor';
import { analyseBlankness } from '@/utils/blankPageDetector';
import { CapturedImage } from '@/hooks/useLGCapture';
import { useDropzone } from 'react-dropzone';

interface UploadImage extends CapturedImage {
  isBlank?: boolean;
  blankConfidence?: number;
}

export default function LGCaptureUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { queuePatient } = useLGUploadQueue();
  
  const [images, setImages] = useState<UploadImage[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<PdfExtractionProgress | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const maxPages = 100;

  const blankCount = images.filter(img => img.isBlank).length;
  const nonBlankImages = images.filter(img => !img.isBlank);

  const handleFiles = useCallback(async (acceptedFiles: File[]) => {
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
          // Extract PDF pages with blank detection
          toast.info(`Extracting pages from ${file.name}...`);
          const pages = await extractPdfPages(file, 150, (progress) => {
            setExtractionProgress(progress);
          }, true); // detectBlanks = true
          
          for (const page of pages) {
            if (newImages.length >= remainingSlots) break;
            newImages.push({
              id: generateULID(),
              dataUrl: page.dataUrl,
              timestamp: Date.now(),
              isBlank: page.isBlank,
              blankConfidence: page.blankConfidence,
            });
          }
          setExtractionProgress(null);
        } else if (file.type.startsWith('image/')) {
          // Process image file and detect blank
          const dataUrl = await readFileAsDataUrl(file);
          
          let isBlank = false;
          let blankConfidence = 0;
          try {
            const result = await analyseBlankness(dataUrl);
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
        const blankInNew = newImages.filter(img => img.isBlank).length;
        if (blankInNew > 0) {
          toast.success(`Added ${newImages.length} page(s) • ${blankInNew} blank detected`);
        } else {
          toast.success(`Added ${newImages.length} page(s)`);
        }
      }
    } catch (error) {
      console.error('File processing error:', error);
      toast.error('Failed to process file(s)');
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  }, [images.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    },
    disabled: isExtracting || isSubmitting,
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
        blankConfidence: newImages[index].isBlank ? 0 : 1, // Manual override
      };
      return newImages;
    });
  }, []);

  const removeAllBlanks = useCallback(() => {
    setImages(prev => prev.filter(img => !img.isBlank));
    toast.success(`Removed ${blankCount} blank page(s)`);
  }, [blankCount]);

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

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }

    // Submit only non-blank images
    const imagesToSubmit = nonBlankImages;
    
    if (imagesToSubmit.length === 0) {
      toast.error('No pages to submit (all pages marked as blank)');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get saved settings
      const practiceOds = localStorage.getItem('lg_practice_ods') || 'UNKNOWN';
      const uploaderName = localStorage.getItem('lg_uploader_name') || 'Unknown';

      // Create patient record
      const patientId = generateULID();
      const { error } = await supabase
        .from('lg_patients')
        .insert({
          id: patientId,
          user_id: user.id,
          practice_ods: practiceOds,
          uploader_name: uploaderName,
          job_status: 'draft',
          sex: 'unknown',
          images_count: imagesToSubmit.length,
        });

      if (error) {
        throw error;
      }

      // Queue for upload and processing (only non-blank images)
      queuePatient(patientId, practiceOds, imagesToSubmit);
      
      if (blankCount > 0) {
        toast.success(`${imagesToSubmit.length} pages queued (${blankCount} blank excluded)`);
      } else {
        toast.success('Files queued for processing');
      }
      navigate('/lg-capture/patients');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit files');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProgressText = () => {
    if (!extractionProgress) return 'Processing files...';
    if (extractionProgress.phase === 'analysing') {
      return `Detecting blank pages ${extractionProgress.currentPage}/${extractionProgress.totalPages}...`;
    }
    return `Extracting page ${extractionProgress.currentPage} of ${extractionProgress.totalPages}...`;
  };

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
        <h1 className="text-2xl font-bold">Upload Lloyd George Files</h1>
        <p className="text-muted-foreground text-sm">
          Upload images or PDF files for a single patient
        </p>
      </div>

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
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports: JPEG, PNG, WebP images and PDF files
                </p>
                <p className="text-xs text-muted-foreground">
                  Blank pages are automatically detected
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button - moved above image grid */}
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
            {images.map((image, index) => (
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
                
                {/* Blank overlay */}
                {image.isBlank && (
                  <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                    <Badge className="bg-amber-500 text-white text-xs">BLANK</Badge>
                  </div>
                )}
                
                {/* Page number badge */}
                <div className={`absolute top-1 left-1 text-xs font-bold px-2 py-1 rounded ${
                  image.isBlank ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'
                }`}>
                  {index + 1}
                </div>
                
                {/* Drag handle */}
                <div className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded">
                  <GripVertical className="h-3 w-3" />
                </div>
                
                {/* Action buttons */}
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
            ))}
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
    </div>
  );
}
