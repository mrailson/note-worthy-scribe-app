import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLGCapture, CapturedImage, LGPatient } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, FileImage, Trash2, GripVertical, Users } from 'lucide-react';
import { toast } from 'sonner';
import { extractPdfPages } from '@/utils/pdfPageExtractor';

// Demo PDF paths - Single Patient demos
const SINGLE_PATIENT_DEMOS = {
  small: '/demo/lg-small.pdf',
  medium: '/demo/lg-medium.pdf',
  large: '/demo/lg-large.pdf',
};

// Multi-patient demo PDFs
const MULTI_PATIENT_PDFS = [
  { path: '/demo/multi-01-margaret-thompson.pdf', name: 'Margaret Thompson' },
  { path: '/demo/multi-02-robert-hughes.pdf', name: 'Robert Hughes' },
  { path: '/demo/multi-03-sophie-clarke.pdf', name: 'Sophie Clarke' },
  { path: '/demo/multi-04-william-davies.pdf', name: 'William Davies' },
  { path: '/demo/multi-05-patricia-brown.pdf', name: 'Patricia Brown' },
  { path: '/demo/multi-06-daniel-taylor.pdf', name: 'Daniel Taylor' },
  { path: '/demo/multi-07-dorothy-evans.pdf', name: 'Dorothy Evans' },
  { path: '/demo/multi-08-michael-roberts.pdf', name: 'Michael Roberts' },
  { path: '/demo/multi-09-emma-watson.pdf', name: 'Emma Watson' },
  { path: '/demo/multi-10-george-mitchell.pdf', name: 'George Mitchell' },
  { path: '/demo/multi-11-harold-jenkins.pdf', name: 'Harold Jenkins' },
  { path: '/demo/multi-12-barbara-pearson.pdf', name: 'Barbara Pearson' },
  { path: '/demo/multi-13-kenneth-williams.pdf', name: 'Kenneth Williams' },
  { path: '/demo/multi-14-jean-foster.pdf', name: 'Jean Foster' },
  { path: '/demo/multi-15-peter-griffiths.pdf', name: 'Peter Griffiths' },
  { path: '/demo/multi-16-susan-chapman.pdf', name: 'Susan Chapman' },
  { path: '/demo/multi-17-arthur-stevens.pdf', name: 'Arthur Stevens' },
  { path: '/demo/multi-18-christine-howard.pdf', name: 'Christine Howard' },
  { path: '/demo/multi-19-raymond-cox.pdf', name: 'Raymond Cox' },
  { path: '/demo/multi-20-maureen-bennett.pdf', name: 'Maureen Bennett' },
];

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
      const response = await fetch(SINGLE_PATIENT_DEMOS[size]);
      const blob = await response.blob();
      const file = new File([blob], `lg-${size}.pdf`, { type: 'application/pdf' });
      
      const extractedPages = await extractPdfPages(file, 150, undefined, true);
      
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

  const loadMultiPatientDemo = async (size: 'small' | 'mid' | 'large') => {
    const patientCount = size === 'small' ? 5 : size === 'mid' ? 10 : 20;
    const patientsToLoad = MULTI_PATIENT_PDFS.slice(0, patientCount);
    
    setIsLoading(true);
    setLoadingLabel(`Multi-Patient ${size.charAt(0).toUpperCase() + size.slice(1)} (${patientCount} patients)`);
    
    try {
      const allImages: CapturedImage[] = [];
      
      for (let i = 0; i < patientsToLoad.length; i++) {
        const patient = patientsToLoad[i];
        const response = await fetch(patient.path);
        const blob = await response.blob();
        const file = new File([blob], `multi-${i + 1}.pdf`, { type: 'application/pdf' });
        
        const extractedPages = await extractPdfPages(file, 150, undefined, true);
        
        const patientImages: CapturedImage[] = extractedPages.map((page, pageIndex) => ({
          id: `multi-${i}-${Date.now()}-${pageIndex}`,
          dataUrl: page.dataUrl,
          timestamp: Date.now() + (i * 1000) + pageIndex,
          isBlank: page.isBlank,
          isMostlyBlank: page.isMostlyBlank,
          blankConfidence: page.blankConfidence,
        }));
        
        allImages.push(...patientImages);
      }
      
      setImages(allImages);
      toast.success(`Loaded ${allImages.length} pages from ${patientCount} patients`);
    } catch (error) {
      console.error('Error loading multi-patient demo:', error);
      toast.error('Failed to load multi-patient demo');
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

      {/* Single Patient Demos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            Single LG Patient
          </CardTitle>
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

      {/* Multi-Patient Demos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Multi-Patient Scan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => loadMultiPatientDemo('small')}
              disabled={isLoading}
              className="h-20 flex-col gap-1"
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">Small</span>
              <span className="text-xs text-muted-foreground">5 patients</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadMultiPatientDemo('mid')}
              disabled={isLoading}
              className="h-20 flex-col gap-1"
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">Mid</span>
              <span className="text-xs text-muted-foreground">10 patients</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadMultiPatientDemo('large')}
              disabled={isLoading}
              className="h-20 flex-col gap-1"
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">Large</span>
              <span className="text-xs text-muted-foreground">20 patients</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading {loadingLabel}...</span>
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
