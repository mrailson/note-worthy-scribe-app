import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLGCapture, CapturedImage, LGPatient } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, FileImage, Trash2, GripVertical, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

// Import demo images (pages 1-30)
import demoPage1 from '@/assets/demo/lg-demo-page-1.jpg';
import demoPage2 from '@/assets/demo/lg-demo-page-2.jpg';
import demoPage3 from '@/assets/demo/lg-demo-page-3.jpg';
import demoPage4 from '@/assets/demo/lg-demo-page-4.jpg';
import demoPage5 from '@/assets/demo/lg-demo-page-5.jpg';
import demoPage6 from '@/assets/demo/lg-demo-page-6.jpg';
import demoPage7 from '@/assets/demo/lg-demo-page-7.jpg';
import demoPage8 from '@/assets/demo/lg-demo-page-8.jpg';
import demoPage9 from '@/assets/demo/lg-demo-page-9.jpg';
import demoPage10 from '@/assets/demo/lg-demo-page-10.jpg';
import demoPage11 from '@/assets/demo/lg-demo-page-11.jpg';
import demoPage12 from '@/assets/demo/lg-demo-page-12.jpg';
import demoPage13 from '@/assets/demo/lg-demo-page-13.jpg';
import demoPage14 from '@/assets/demo/lg-demo-page-14.jpg';
import demoPage15 from '@/assets/demo/lg-demo-page-15.jpg';
import demoPage16 from '@/assets/demo/lg-demo-page-16.jpg';
import demoPage17 from '@/assets/demo/lg-demo-page-17.jpg';
import demoPage18 from '@/assets/demo/lg-demo-page-18.jpg';
import demoPage19 from '@/assets/demo/lg-demo-page-19.jpg';
import demoPage20 from '@/assets/demo/lg-demo-page-20.jpg';
import demoPage21 from '@/assets/demo/lg-demo-page-21.jpg';
import demoPage22 from '@/assets/demo/lg-demo-page-22.jpg';
import demoPage23 from '@/assets/demo/lg-demo-page-23.jpg';
import demoPage24 from '@/assets/demo/lg-demo-page-24.jpg';
import demoPage25 from '@/assets/demo/lg-demo-page-25.jpg';
import demoPage26 from '@/assets/demo/lg-demo-page-26.jpg';
import demoPage27 from '@/assets/demo/lg-demo-page-27.jpg';
import demoPage28 from '@/assets/demo/lg-demo-page-28.jpg';
import demoPage29 from '@/assets/demo/lg-demo-page-29.jpg';
import demoPage30 from '@/assets/demo/lg-demo-page-30.jpg';

// All 30 demo images
const ALL_DEMO_IMAGES = [
  demoPage1, demoPage2, demoPage3, demoPage4, demoPage5,
  demoPage6, demoPage7, demoPage8, demoPage9, demoPage10,
  demoPage11, demoPage12, demoPage13, demoPage14, demoPage15,
  demoPage16, demoPage17, demoPage18, demoPage19, demoPage20,
  demoPage21, demoPage22, demoPage23, demoPage24, demoPage25,
  demoPage26, demoPage27, demoPage28, demoPage29, demoPage30,
];

async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function LGCaptureDemoService() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatient } = useLGCapture();
  const { queuePatient } = useLGUploadQueue();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const loadDemoImages = async (count: number) => {
    setIsLoading(true);
    try {
      // Build list of images, cycling through the 30 available images as needed
      const imagesToLoad: string[] = [];
      for (let i = 0; i < count; i++) {
        imagesToLoad.push(ALL_DEMO_IMAGES[i % ALL_DEMO_IMAGES.length]);
      }
      
      const loadedImages: CapturedImage[] = await Promise.all(
        imagesToLoad.map(async (imgUrl, index) => {
          const dataUrl = await urlToDataUrl(imgUrl);
          return {
            id: `demo-${Date.now()}-${index}`,
            dataUrl,
            timestamp: Date.now() + index,
          };
        })
      );
      setImages(loadedImages);
      toast.success(`Loaded ${count} demo pages`);
    } catch (error) {
      console.error('Error loading demo images:', error);
      toast.error('Failed to load demo images');
    } finally {
      setIsLoading(false);
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

      {/* Download Test Pages */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="font-medium text-sm">Want to test with your phone camera?</p>
              <p className="text-xs text-muted-foreground">Download and print the test pages</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <a 
                href="https://drive.google.com/drive/folders/1-EXAMPLE-FOLDER-ID" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" />
                Download Test Pages
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Demo Load Buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Load Demo Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              variant="outline"
              onClick={() => loadDemoImages(3)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>3 Pages</span>
              <span className="text-xs text-muted-foreground">Quick</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoImages(10)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>10 Pages</span>
              <span className="text-xs text-muted-foreground">Standard</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoImages(15)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>15 Pages</span>
              <span className="text-xs text-muted-foreground">Medium</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoImages(20)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>20 Pages</span>
              <span className="text-xs text-muted-foreground">Large</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoImages(50)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>50 Pages</span>
              <span className="text-xs text-muted-foreground">XL</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoImages(75)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>75 Pages</span>
              <span className="text-xs text-muted-foreground">XXL</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoImages(100)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>100 Pages</span>
              <span className="text-xs text-muted-foreground">Max</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoImages(200)}
              disabled={isLoading}
              className="h-16 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span>200 Pages</span>
              <span className="text-xs text-muted-foreground">Ultra</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading demo images...</span>
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
