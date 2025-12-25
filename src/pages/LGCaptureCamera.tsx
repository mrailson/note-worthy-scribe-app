import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { useLGCapture, CapturedImage, LGPatient } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { LGCameraCapture } from '@/components/lg-capture/LGCameraCapture';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
// Toast messages removed from LG Capture service

export default function LGCaptureCamera() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatient } = useLGCapture();
  const { queuePatient } = useLGUploadQueue();
  
  const [patient, setPatient] = useState<LGPatient | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);

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

  const handleDoneNextPatient = () => {
    if (!patient || images.length === 0) {
      return;
    }

    // Add to background queue (doesn't wait)
    queuePatient(patient.id, patient.practice_ods, images);
    
    // Immediately navigate to start page for next patient
    navigate('/lg-capture/start');
  };

  if (!patient) {
    return (
      <>
        <Header />
        <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/lg-capture')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <LGCameraCapture
        images={images}
        onImagesChange={setImages}
        onFinish={handleDoneNextPatient}
        isProcessing={false}
      />
      </div>
    </>
  );
}