import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLGCapture } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { LGPrivacyBanner } from '@/components/lg-capture/LGPrivacyBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Camera, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function LGCaptureStart() {
  const navigate = useNavigate();
  const { createPatient, isLoading } = useLGCapture();
  const { activeUploads } = useLGUploadQueue();
  
  const [practiceOds, setPracticeOds] = useState('K83042');
  const [uploaderName, setUploaderName] = useState('Malcolm Railson');
  const [errors, setErrors] = useState<{ practiceOds?: string; uploaderName?: string }>({});

  useEffect(() => {
    // Load saved settings from localStorage
    const savedOds = localStorage.getItem('lg_practice_ods');
    const savedName = localStorage.getItem('lg_uploader_name');
    if (savedOds) setPracticeOds(savedOds);
    if (savedName) setUploaderName(savedName);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const newErrors: typeof errors = {};
    if (!practiceOds.trim()) newErrors.practiceOds = 'Practice ODS is required';
    if (!uploaderName.trim()) newErrors.uploaderName = 'Your name is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save settings
    localStorage.setItem('lg_practice_ods', practiceOds.trim());
    localStorage.setItem('lg_uploader_name', uploaderName.trim());

    // Create patient record (minimal - AI will extract details from OCR)
    const patientId = await createPatient({
      practice_ods: practiceOds.trim(),
      uploader_name: uploaderName.trim(),
    });

    if (patientId) {
      navigate(`/lg-capture/capture/${patientId}`);
    } else {
      toast.error('Failed to create session');
    }
  };

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

      <LGPrivacyBanner />

      {/* Background upload indicator */}
      {activeUploads > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Upload className="h-4 w-4 animate-pulse" />
          <span>{activeUploads} patient{activeUploads > 1 ? 's' : ''} uploading in background...</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Start New Capture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="practiceOds">Practice ODS Code</Label>
              <Input
                id="practiceOds"
                value={practiceOds}
                onChange={(e) => {
                  setPracticeOds(e.target.value.toUpperCase());
                  setErrors(prev => ({ ...prev, practiceOds: undefined }));
                }}
                placeholder="e.g. K83042"
                className={errors.practiceOds ? 'border-destructive' : ''}
              />
              {errors.practiceOds && (
                <p className="text-sm text-destructive">{errors.practiceOds}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="uploaderName">Your Name</Label>
              <Input
                id="uploaderName"
                value={uploaderName}
                onChange={(e) => {
                  setUploaderName(e.target.value);
                  setErrors(prev => ({ ...prev, uploaderName: undefined }));
                }}
                placeholder="e.g. Jane Smith"
                className={errors.uploaderName ? 'border-destructive' : ''}
              />
              {errors.uploaderName && (
                <p className="text-sm text-destructive">{errors.uploaderName}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Start Capture
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}