import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLGCapture, CapturedImage, LGPatient } from '@/hooks/useLGCapture';
import { LGCameraCapture } from '@/components/lg-capture/LGCameraCapture';
import { LGPrivacyBanner } from '@/components/lg-capture/LGPrivacyBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LGCaptureCamera() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatient, uploadImages, triggerProcessing, isLoading } = useLGCapture();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadPatient = async () => {
      if (!id) return;
      const data = await getPatient(id);
      if (data) {
        setPatient(data);
      } else {
        toast.error('Patient not found');
        navigate('/lg-capture');
      }
    };
    loadPatient();
  }, [id, getPatient, navigate]);

  const handleFinish = async () => {
    if (!patient || images.length === 0) {
      toast.error('Please capture at least one page');
      return;
    }

    setUploading(true);
    
    try {
      // Upload images
      const uploadSuccess = await uploadImages(patient.id, patient.practice_ods, images);
      if (!uploadSuccess) {
        throw new Error('Upload failed');
      }

      // Trigger processing
      const processSuccess = await triggerProcessing(patient.id);
      if (!processSuccess) {
        throw new Error('Processing trigger failed');
      }

      navigate(`/lg-capture/results/${patient.id}`);
    } catch (err) {
      console.error('Finish error:', err);
      toast.error('Failed to process. Please try again.');
    } finally {
      setUploading(false);
    }
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
        Back
      </Button>

      {/* Patient Info */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Capturing for</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Patient:</span>
            <span className="font-medium">{patient.patient_name}</span>
            <span className="text-muted-foreground">NHS:</span>
            <span className="font-medium font-mono">{patient.nhs_number}</span>
            <span className="text-muted-foreground">DOB:</span>
            <span className="font-medium">{patient.dob}</span>
          </div>
        </CardContent>
      </Card>

      <LGPrivacyBanner />

      {uploading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="font-medium">Uploading {images.length} pages...</p>
            <p className="text-sm text-muted-foreground">Please don't close this page</p>
          </CardContent>
        </Card>
      ) : (
        <LGCameraCapture
          images={images}
          onImagesChange={setImages}
          onFinish={handleFinish}
        />
      )}
    </div>
  );
}
