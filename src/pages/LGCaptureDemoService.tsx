import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLGCapture, CapturedImage, LGPatient } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, FileImage, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { extractPdfPages } from '@/utils/pdfPageExtractor';

// Demo PDF paths - Small, Medium, Large
const DEMO_PDFS = {
  small: '/demo/lg-small.pdf',
  medium: '/demo/lg-medium.pdf',
  large: '/demo/lg-large.pdf',
};

export default function LGCaptureDemoService() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatient } = useLGCapture();
  const { queuePatient } = useLGUploadQueue();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadPatient = async () => {
      if (!id) return;
      const data = await getPatient(id);
      if (data) {
        setPatient(data);
      } else {
        toast.error('Session not found');
        navigate('/lg-capture');
      }
    };
    loadPatient();
  }, [id, getPatient, navigate]);

  const loadDemoPdf = async (size: 'small' | 'medium' | 'large') => {
    setIsLoading(true);
    setLoadingLabel(size.charAt(0).toUpperCase() + size.slice(1));
    try {
      // Fetch the PDF file
      const response = await fetch(DEMO_PDFS[size]);
      const blob = await response.blob();
      const file = new File([blob], `lg-${size}.pdf`, { type: 'application/pdf' });
      
      // Extract pages from PDF
      const extractedPages = await extractPdfPages(file, 150, (progress) => {
        // Could add progress UI here if needed
      }, true);
      
      // Convert to CapturedImage format
      const loadedImages: CapturedImage[] = extractedPages.map((page, index) => ({
        id: `demo-${Date.now()}-${index}`,
        dataUrl: page.dataUrl,
        timestamp: Date.now() + index,
        isBlank: page.isBlank,
        isMostlyBlank: page.isMostlyBlank,
        blankConfidence: page.blankConfidence,
      }));
      
      setImages(loadedImages);
      toast.success(`Loaded ${loadedImages.length} pages from ${size} demo`);
    } catch (error) {
      console.error('Error loading demo PDF:', error);
      toast.error('Failed to load demo PDF');
    } finally {
      setIsLoading(false);
      setLoadingLabel('');
    }
  };

  const handleDoneNextPatient = () => {
    if (!patient || images.length === 0) {
      toast.error('Please load demo images first');
      return;
    }

    queuePatient(patient.id, patient.practice_ods, images);
    navigate('/lg-capture/start');
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    setImages(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (!patient) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/lg-capture')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to LG Capture
      </Button>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">LG Digitisation Test Service</h1>
        <p className="text-muted-foreground text-sm">
          Test the Notewell AI system with pre-loaded simulated Lloyd George pages
        </p>
      </div>

      {/* Info Card */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground text-center">
            Use the demo buttons below to load pre-made test pages, or use the camera to capture your own
          </p>
        </CardContent>
      </Card>

      {/* Demo Load Buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Load Demo Lloyd George Record</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => loadDemoPdf('small')}
              disabled={isLoading}
              className="h-20 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span className="font-medium">Small</span>
              <span className="text-xs text-muted-foreground">Dorothy Shaw</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoPdf('medium')}
              disabled={isLoading}
              className="h-20 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span className="font-medium">Medium</span>
              <span className="text-xs text-muted-foreground">Edward Blackwood</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoPdf('large')}
              disabled={isLoading}
              className="h-20 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span className="font-medium">Large</span>
              <span className="text-xs text-muted-foreground">Albert Thornton</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading {loadingLabel} demo PDF...</span>
        </div>
      )}

      {/* Images Grid */}
      {images.length > 0 && !isLoading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Captured Pages ({images.length})</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImages([])}
                className="text-destructive hover:text-destructive"
              >
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Submit Button - at top for easy access */}
            <Button
              onClick={handleDoneNextPatient}
              className="w-full h-14 text-lg"
              size="lg"
            >
              Submit and Process LG ({images.length} Pages)
            </Button>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 cursor-move transition-all ${
                    draggedIndex === index ? 'opacity-50 border-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <img
                    src={image.dataUrl}
                    alt={`Page ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-background/80 px-1.5 py-0.5 rounded text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="absolute top-1 right-1 flex gap-1">
                    <button
                      onClick={() => removeImage(index)}
                      className="bg-destructive/80 hover:bg-destructive text-destructive-foreground p-1 rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Drag pages to reorder • Click trash to remove
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
