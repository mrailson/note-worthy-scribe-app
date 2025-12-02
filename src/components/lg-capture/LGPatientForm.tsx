import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { validateNHSNumber, formatNHSNumber } from '@/utils/nhsNumberValidator';
import { LGPrivacyBanner } from './LGPrivacyBanner';
import { LGSafetyBanner } from './LGSafetyBanner';
import { Loader2, CheckCircle2 } from 'lucide-react';

const patientSchema = z.object({
  patient_name: z.string().min(2, 'Patient name is required'),
  nhs_number: z.string().refine(
    (val) => validateNHSNumber(val).valid,
    (val) => ({ message: validateNHSNumber(val).error || 'Invalid NHS number' })
  ),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  sex: z.enum(['male', 'female', 'other', 'unknown']),
  practice_ods: z.string().min(1, 'Practice ODS code is required'),
  uploader_name: z.string().min(2, 'Uploader name is required'),
});

type PatientFormData = z.infer<typeof patientSchema>;

export interface LGPatientFormProps {
  onSubmit: (data: {
    practice_ods: string;
    uploader_name: string;
    patient_name: string;
    nhs_number: string;
    dob: string;
    sex: string;
  }) => Promise<void>;
  isLoading?: boolean;
  defaultValues?: Partial<PatientFormData>;
}

export function LGPatientForm({ onSubmit, isLoading, defaultValues }: LGPatientFormProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState<PatientFormData | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      sex: 'unknown',
      ...defaultValues,
    },
  });

  // Reset form when defaultValues change (e.g., when demo data is loaded)
  useEffect(() => {
    if (defaultValues) {
      reset(defaultValues);
    }
  }, [defaultValues, reset]);

  const watchedValues = watch();
  const missingFields: string[] = [];
  if (!watchedValues.nhs_number) missingFields.push('NHS Number');
  if (!watchedValues.dob) missingFields.push('Date of Birth');

  const handleFormSubmit = (data: PatientFormData) => {
    // Format NHS number before confirming
    const validation = validateNHSNumber(data.nhs_number);
    if (validation.formatted) {
      data.nhs_number = validation.formatted;
    }
    setFormData(data);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (formData) {
      await onSubmit({
        practice_ods: formData.practice_ods!,
        uploader_name: formData.uploader_name!,
        patient_name: formData.patient_name!,
        nhs_number: formData.nhs_number!,
        dob: formData.dob!,
        sex: formData.sex!,
      });
    }
  };

  const handleNHSChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue('nhs_number', value);
  };

  if (showConfirm && formData) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Confirm Patient Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LGPrivacyBanner />
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{formData.patient_name}</span>
              
              <span className="text-muted-foreground">NHS Number:</span>
              <span className="font-medium font-mono">{formData.nhs_number}</span>
              
              <span className="text-muted-foreground">DOB:</span>
              <span className="font-medium">{formData.dob}</span>
              
              <span className="text-muted-foreground">Sex:</span>
              <span className="font-medium capitalize">{formData.sex}</span>
              
              <span className="text-muted-foreground">Practice ODS:</span>
              <span className="font-medium">{formData.practice_ods}</span>
              
              <span className="text-muted-foreground">Uploader:</span>
              <span className="font-medium">{formData.uploader_name}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Edit
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Confirm & Start Capture'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>New Patient Capture</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <LGPrivacyBanner />
          <LGSafetyBanner missingFields={missingFields} />

          <div className="space-y-2">
            <Label htmlFor="patient_name">Patient Full Name *</Label>
            <Input
              id="patient_name"
              {...register('patient_name')}
              placeholder="Enter patient's full name"
            />
            {errors.patient_name && (
              <p className="text-xs text-destructive">{errors.patient_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nhs_number">NHS Number *</Label>
            <Input
              id="nhs_number"
              {...register('nhs_number')}
              onChange={handleNHSChange}
              placeholder="000 000 0000"
              className="font-mono"
            />
            {errors.nhs_number && (
              <p className="text-xs text-destructive">{errors.nhs_number.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input
              id="dob"
              type="date"
              {...register('dob')}
            />
            {errors.dob && (
              <p className="text-xs text-destructive">{errors.dob.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Sex *</Label>
            <Select
              value={watchedValues.sex || 'unknown'}
              onValueChange={(value) => setValue('sex', value as PatientFormData['sex'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            {errors.sex && (
              <p className="text-xs text-destructive">{errors.sex.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="practice_ods">Practice ODS Code *</Label>
            <Input
              id="practice_ods"
              {...register('practice_ods')}
              placeholder="e.g., Y12345"
              className="uppercase"
            />
            {errors.practice_ods && (
              <p className="text-xs text-destructive">{errors.practice_ods.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="uploader_name">Your Name (Uploader) *</Label>
            <Input
              id="uploader_name"
              {...register('uploader_name')}
              placeholder="Enter your name"
            />
            {errors.uploader_name && (
              <p className="text-xs text-destructive">{errors.uploader_name.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Continue to Capture'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
