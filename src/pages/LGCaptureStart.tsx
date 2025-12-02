import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLGCapture } from '@/hooks/useLGCapture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LGPrivacyBanner } from '@/components/lg-capture/LGPrivacyBanner';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'lg-capture-settings';

export default function LGCaptureStart() {
  const navigate = useNavigate();
  const { createPatient, isLoading } = useLGCapture();
  
  const [practiceOds, setPracticeOds] = useState('K83042');
  const [uploaderName, setUploaderName] = useState('Malcolm Railson');
  const [errors, setErrors] = useState<{ practiceOds?: string; uploaderName?: string }>({});

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { practiceOds: savedOds, uploaderName: savedName } = JSON.parse(saved);
        if (savedOds) setPracticeOds(savedOds);
        if (savedName) setUploaderName(savedName);
      } catch (e) {
        console.error('Failed to load saved settings:', e);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: typeof errors = {};
    if (!practiceOds.trim()) newErrors.practiceOds = 'Practice ODS code is required';
    if (!uploaderName.trim()) newErrors.uploaderName = 'Your name is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ practiceOds, uploaderName }));

    const patientId = await createPatient({
      practice_ods: practiceOds.toUpperCase().trim(),
      uploader_name: uploaderName.trim(),
    });
    
    if (patientId) {
      navigate(`/lg-capture/capture/${patientId}`);
    }
  };

  return (
    <div className="container max-w-md mx-auto py-8 px-4 space-y-6">
      <Button variant="ghost" onClick={() => navigate('/lg-capture')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Start New Capture</CardTitle>
          <CardDescription>
            Just enter your practice and name. Patient details will be extracted automatically from the scanned documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <LGPrivacyBanner />

            <div className="space-y-2">
              <Label htmlFor="practice_ods">Practice ODS Code *</Label>
              <Input
                id="practice_ods"
                value={practiceOds}
                onChange={(e) => {
                  setPracticeOds(e.target.value);
                  setErrors(prev => ({ ...prev, practiceOds: undefined }));
                }}
                placeholder="e.g., Y12345"
                className="uppercase text-lg"
              />
              {errors.practiceOds && (
                <p className="text-xs text-destructive">{errors.practiceOds}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="uploader_name">Your Name *</Label>
              <Input
                id="uploader_name"
                value={uploaderName}
                onChange={(e) => {
                  setUploaderName(e.target.value);
                  setErrors(prev => ({ ...prev, uploaderName: undefined }));
                }}
                placeholder="Enter your name"
                className="text-lg"
              />
              {errors.uploaderName && (
                <p className="text-xs text-destructive">{errors.uploaderName}</p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-5 w-5" />
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
