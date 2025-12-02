import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLGCapture } from '@/hooks/useLGCapture';
import { LGPatientForm } from '@/components/lg-capture/LGPatientForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';

const DEMO_PATIENT = {
  patient_name: 'James Wilson',
  nhs_number: '9434765919',
  dob: '1952-03-15',
  sex: 'male' as const,
  practice_ods: 'K83044',
  uploader_name: 'Malcolm Railson',
};

export default function LGCaptureStart() {
  const navigate = useNavigate();
  const { createPatient, isLoading } = useLGCapture();
  const [defaultValues, setDefaultValues] = useState<typeof DEMO_PATIENT | undefined>();

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

  const loadDemoData = () => {
    setDefaultValues(DEMO_PATIENT);
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/lg-capture')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDemoData}
        >
          <Zap className="mr-2 h-4 w-4" />
          Load Demo Data
        </Button>
      </div>

      <LGPatientForm onSubmit={handleSubmit} isLoading={isLoading} defaultValues={defaultValues} />
    </div>
  );
}
