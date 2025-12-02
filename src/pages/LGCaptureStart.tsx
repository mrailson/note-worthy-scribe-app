import { useNavigate } from 'react-router-dom';
import { useLGCapture } from '@/hooks/useLGCapture';
import { LGPatientForm } from '@/components/lg-capture/LGPatientForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function LGCaptureStart() {
  const navigate = useNavigate();
  const { createPatient, isLoading } = useLGCapture();

  const handleSubmit = async (data: {
    practice_ods: string;
    uploader_name: string;
    patient_name: string;
    nhs_number: string;
    dob: string;
    sex: string;
  }) => {
    const patientId = await createPatient(data);
    if (patientId) {
      navigate(`/lg-capture/capture/${patientId}`);
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

      <LGPatientForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
