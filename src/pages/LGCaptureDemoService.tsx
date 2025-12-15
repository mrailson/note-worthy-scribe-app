import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLGCapture, CapturedImage, LGPatient } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Loader2, FileImage, Trash2, GripVertical, Users, Check, FileText, Settings, ChevronDown } from 'lucide-react';

type ServiceLevel = 'rename_only' | 'index_summary' | 'full_service';
// Toast messages removed from LG Capture service
import { extractPdfPages } from '@/utils/pdfPageExtractor';
import { generateULID } from '@/utils/ulid';
import { supabase } from '@/integrations/supabase/client';

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

interface MultiPatientProgress {
  patientName: string;
  status: 'pending' | 'extracting' | 'queued' | 'failed';
  progress: number;
  pageCount?: number;
  error?: string;
}

export default function LGCaptureDemoService() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPatient } = useLGCapture();
  const { queuePatient } = useLGUploadQueue();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Multi-patient state
  const [multiPatientProgress, setMultiPatientProgress] = useState<MultiPatientProgress[]>([]);
  const [isProcessingMulti, setIsProcessingMulti] = useState(false);
  
  // Service level state
  const [serviceLevel, setServiceLevel] = useState<ServiceLevel>('full_service');

  useEffect(() => {
    const loadPatient = async () => {
      if (!id) return;
      const data = await getPatient(id);
      if (data) {
        setPatient(data);
      } else {
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
        blankConfidence: page.blankConfidence,
      }));
      
      setImages(loadedImages);
    } catch (error) {
      console.error('Error loading demo PDF:', error);
    } finally {
      setIsLoading(false);
      setLoadingLabel('');
    }
  };

  const loadMultiPatientDemo = async (size: 'small' | 'mid' | 'large') => {
    if (!user?.id || !patient) {
      toast.error('Please ensure you are logged in');
      return;
    }

    const patientCount = size === 'small' ? 5 : size === 'mid' ? 10 : 20;
    const patientsToLoad = MULTI_PATIENT_PDFS.slice(0, patientCount);
    const batchId = crypto.randomUUID();
    
    // Initialize progress tracking
    setMultiPatientProgress(patientsToLoad.map(p => ({
      patientName: p.name,
      status: 'pending',
      progress: 0
    })));
    
    setIsProcessingMulti(true);
    setLoadingLabel(`Processing ${patientCount} patients...`);
    
    let successCount = 0;
    
    for (let i = 0; i < patientsToLoad.length; i++) {
      const patientData = patientsToLoad[i];
      
      try {
        // Update status to extracting
        setMultiPatientProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'extracting', progress: 20 } : p
        ));

        // Fetch and extract PDF
        const response = await fetch(patientData.path);
        const blob = await response.blob();
        const file = new File([blob], `${patientData.name}.pdf`, { type: 'application/pdf' });
        
        const extractedPages = await extractPdfPages(file, 150, (progress) => {
          setMultiPatientProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, progress: 20 + Math.round(progress.percentage * 0.4) } : p
          ));
        }, true);

        const pageCount = extractedPages.length;
        
        setMultiPatientProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, pageCount, progress: 60 } : p
        ));

        // Create patient record in database
        const patientId = generateULID();
        
        const { error: insertError } = await supabase
          .from('lg_patients')
          .insert({
            id: patientId,
            user_id: user.id,
            practice_ods: patient.practice_ods,
            uploader_name: patient.uploader_name || 'Demo User',
            job_status: 'draft',
            images_count: pageCount,
            sex: 'unknown',
            batch_id: batchId
          });

        if (insertError) {
          throw new Error(`Failed to create patient record: ${insertError.message}`);
        }

        setMultiPatientProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 80 } : p
        ));

        // Convert to CapturedImage format (filter out blank pages)
        const capturedImages: CapturedImage[] = extractedPages
          // NO FILTERING - all pages preserved as scans are pre-cleansed
          .map((page, pageIndex) => ({
            id: `${patientId}-page-${pageIndex + 1}`,
            dataUrl: page.dataUrl,
            timestamp: Date.now() + pageIndex
          }));

        // Queue for processing
        queuePatient(patientId, patient.practice_ods, capturedImages, {
          fileName: `${patientData.name}.pdf`,
          fileSize: blob.size,
          serviceLevel: serviceLevel
        });

        setMultiPatientProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'queued', progress: 100 } : p
        ));
        
        successCount++;

      } catch (error) {
        console.error(`Error processing ${patientData.name}:`, error);
        setMultiPatientProgress(prev => prev.map((p, idx) => 
          idx === i ? { 
            ...p, 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          } : p
        ));
      }
    }

    // Clean up the template patient record (it was only used for practice/uploader settings)
    if (patient && successCount > 0) {
      const { error: deleteError } = await supabase
        .from('lg_patients')
        .delete()
        .eq('id', patient.id)
        .eq('job_status', 'draft')
        .eq('images_count', 0);
      
      if (!deleteError) {
        console.log('Cleaned up unused template patient record:', patient.id);
      }
    }

    setIsProcessingMulti(false);
    setLoadingLabel('');
    
    if (successCount > 0) {
      toast.success(`${successCount} patient${successCount !== 1 ? 's' : ''} queued for processing`);
    }
  };

  const handleDoneNextPatient = () => {
    if (!patient || images.length === 0) {
      toast.error('Please load demo images first');
      return;
    }

    queuePatient(patient.id, patient.practice_ods, images, {
      serviceLevel: serviceLevel
    });
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

  const clearMultiProgress = () => {
    setMultiPatientProgress([]);
  };

  if (!patient) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const queuedCount = multiPatientProgress.filter(p => p.status === 'queued').length;
  const failedCount = multiPatientProgress.filter(p => p.status === 'failed').length;

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

      {/* Service Level Selector - Collapsible */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Service Level
                  <Badge variant="secondary" className="text-xs font-normal">
                    {serviceLevel === 'full_service' ? 'Full Service' : 
                     serviceLevel === 'index_summary' ? 'Rename + Index' : 'Rename Only'}
                  </Badge>
                </span>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <RadioGroup
                value={serviceLevel}
                onValueChange={(value) => setServiceLevel(value as ServiceLevel)}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="rename_only" id="demo-rename_only" className="mt-0.5" />
                  <Label htmlFor="demo-rename_only" className="flex-1 cursor-pointer">
                    <div className="font-medium">Rename Only</div>
                    <div className="text-xs text-muted-foreground">
                      Quick rename to Lloyd George format, no AI processing
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="index_summary" id="demo-index_summary" className="mt-0.5" />
                  <Label htmlFor="demo-index_summary" className="flex-1 cursor-pointer">
                    <div className="font-medium">Rename + Index</div>
                    <div className="text-xs text-muted-foreground">
                      Add index page and summary header, no SNOMED coding
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="full_service" id="demo-full_service" className="mt-0.5" />
                  <Label htmlFor="demo-full_service" className="flex-1 cursor-pointer">
                    <div className="font-medium">Full Service</div>
                    <div className="text-xs text-muted-foreground">
                      Complete AI summary with SNOMED codes (current behaviour)
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
              disabled={isLoading || isProcessingMulti}
              className="h-20 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span className="font-medium">Small</span>
              <span className="text-xs text-muted-foreground">Dorothy Shaw</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoPdf('medium')}
              disabled={isLoading || isProcessingMulti}
              className="h-20 flex-col gap-1"
            >
              <FileImage className="h-5 w-5" />
              <span className="font-medium">Medium</span>
              <span className="text-xs text-muted-foreground">Edward Blackwood</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadDemoPdf('large')}
              disabled={isLoading || isProcessingMulti}
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
            Multi-Patient Scan (Bulk PDF Demo)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Each PDF is processed as a separate patient record, just like the Bulk Capture workflow
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => loadMultiPatientDemo('small')}
              disabled={isLoading || isProcessingMulti}
              className="h-20 flex-col gap-1"
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">Small</span>
              <span className="text-xs text-muted-foreground">5 patients</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadMultiPatientDemo('mid')}
              disabled={isLoading || isProcessingMulti}
              className="h-20 flex-col gap-1"
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">Mid</span>
              <span className="text-xs text-muted-foreground">10 patients</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => loadMultiPatientDemo('large')}
              disabled={isLoading || isProcessingMulti}
              className="h-20 flex-col gap-1"
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">Large</span>
              <span className="text-xs text-muted-foreground">20 patients</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Patient Progress */}
      {multiPatientProgress.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Processing {multiPatientProgress.length} Patients</span>
              <div className="flex items-center gap-2">
                {queuedCount > 0 && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                    {queuedCount} Queued
                  </Badge>
                )}
                {failedCount > 0 && (
                  <Badge variant="destructive">{failedCount} Failed</Badge>
                )}
                {!isProcessingMulti && (
                  <Button variant="ghost" size="sm" onClick={clearMultiProgress}>
                    Clear
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {multiPatientProgress.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.patientName}</p>
                    {p.pageCount && (
                      <p className="text-xs text-muted-foreground">{p.pageCount} pages</p>
                    )}
                    {(p.status === 'extracting') && (
                      <Progress value={p.progress} className="h-1 mt-1" />
                    )}
                    {p.error && (
                      <p className="text-xs text-destructive mt-1">{p.error}</p>
                    )}
                  </div>
                  <div>
                    {p.status === 'pending' && (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                    {p.status === 'extracting' && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Processing
                      </Badge>
                    )}
                    {p.status === 'queued' && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Queued
                      </Badge>
                    )}
                    {p.status === 'failed' && (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {queuedCount > 0 && !isProcessingMulti && (
              <div className="mt-4 pt-4 border-t">
                <Button 
                  onClick={() => navigate('/lg-capture/patients')}
                  className="w-full"
                >
                  View Recent Captures ({queuedCount} queued)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading {loadingLabel}...</span>
        </div>
      )}

      {/* Images Grid (for single patient demos) */}
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
