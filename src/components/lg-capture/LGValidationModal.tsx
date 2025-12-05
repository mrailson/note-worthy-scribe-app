import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface LGValidationModalProps {
  open: boolean;
  onClose: () => void;
  patient: {
    id: string;
    patient_name: string | null;
    nhs_number: string | null;
    dob: string | null;
  };
  onValidated: () => void;
}

interface ValidationResult {
  nhs_match: boolean;
  dob_match: boolean;
  file_detected: boolean;
  extracted_nhs: string | null;
  extracted_dob: string | null;
  extracted_files: string[];
  confidence: number;
}

const formatNhsNumber = (nhs: string | null): string => {
  if (!nhs) return '—';
  const clean = nhs.replace(/\s/g, '');
  if (clean.length !== 10) return nhs;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export function LGValidationModal({ open, onClose, patient, onValidated }: LGValidationModalProps) {
  const [clinicalSystem, setClinicalSystem] = useState<'emis' | 'systmone'>('systmone');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setScreenshot(base64);
      setScreenshotPreview(base64);
      setValidationResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const validateScreenshot = async () => {
    if (!screenshot) {
      toast.error('Please upload a screenshot first');
      return;
    }

    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('lg-validate-upload', {
        body: {
          patientId: patient.id,
          screenshotBase64: screenshot,
          expectedNhs: patient.nhs_number?.replace(/\s/g, '') || '',
          expectedDob: patient.dob || '',
          clinicalSystem
        }
      });

      if (error) throw error;

      if (data?.validation) {
        setValidationResult({
          nhs_match: data.validation.nhs_match,
          dob_match: data.validation.dob_match,
          file_detected: data.validation.file_detected,
          extracted_nhs: data.extracted?.nhs_number || null,
          extracted_dob: data.extracted?.dob || null,
          extracted_files: data.extracted?.uploaded_files || [],
          confidence: data.extracted?.confidence || 0
        });
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast.error('Failed to validate screenshot');
    } finally {
      setValidating(false);
    }
  };

  const confirmValidation = async () => {
    const isOverride = validationResult && (!validationResult.nhs_match || !validationResult.dob_match);
    
    if (isOverride && !overrideReason.trim()) {
      toast.error('Please provide a reason for manual override');
      return;
    }

    try {
      // Update patient record with validation status
      const supabaseAny = supabase as any;
      const validationData: any = {
        validated_at: new Date().toISOString(),
        publish_status: 'validated',
        validation_result: {
          clinical_system: clinicalSystem,
          nhs_match: validationResult?.nhs_match || false,
          dob_match: validationResult?.dob_match || false,
          file_detected: validationResult?.file_detected || false,
          confidence: validationResult?.confidence || 0,
          manual_override: isOverride,
          override_reason: isOverride ? overrideReason : null,
          validated_at: new Date().toISOString()
        }
      };

      const { error } = await supabaseAny
        .from('lg_patients')
        .update(validationData)
        .eq('id', patient.id);

      if (error) throw error;

      toast.success(isOverride ? 'Validation confirmed with manual override' : 'Upload validated successfully');
      onValidated();
      handleClose();
    } catch (err) {
      console.error('Error confirming validation:', err);
      toast.error('Failed to save validation');
    }
  };

  const handleClose = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    setValidationResult(null);
    setManualOverride(false);
    setOverrideReason('');
    onClose();
  };

  const allMatch = validationResult && validationResult.nhs_match && validationResult.dob_match;
  const hasMismatch = validationResult && (!validationResult.nhs_match || !validationResult.dob_match);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Validate Upload to Clinical System</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Clinical System Selection */}
          <div className="space-y-3">
            <Label>Select your clinical system:</Label>
            <RadioGroup 
              value={clinicalSystem} 
              onValueChange={(v) => setClinicalSystem(v as 'emis' | 'systmone')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="emis" id="emis" />
                <Label htmlFor="emis" className="cursor-pointer">EMIS Web</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="systmone" id="systmone" />
                <Label htmlFor="systmone" className="cursor-pointer">SystmOne</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Expected Patient Details */}
          <div className="space-y-2">
            <Label>Expected Patient Details:</Label>
            <div className="bg-muted/50 p-4 rounded-lg border space-y-1">
              <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{patient.patient_name || '—'}</span></p>
              <p><span className="text-muted-foreground">NHS:</span> <span className="font-mono font-medium">{formatNhsNumber(patient.nhs_number)}</span></p>
              <p><span className="text-muted-foreground">DOB:</span> <span className="font-medium">{formatDate(patient.dob)}</span></p>
            </div>
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-2">
            <Label>Upload screenshot showing patient record with uploaded file:</Label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              {screenshotPreview ? (
                <div className="space-y-3">
                  <img 
                    src={screenshotPreview} 
                    alt="Screenshot preview" 
                    className="max-h-48 mx-auto rounded border"
                  />
                  <p className="text-sm text-muted-foreground">Click or drag to replace</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <div>
                    <p className="font-medium">Drag & drop screenshot or click to upload</p>
                    <p className="text-sm text-muted-foreground">Supports: PNG, JPG, WEBP (max 10MB)</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground italic">
              This screenshot is used only to verify the correct patient file was uploaded to the correct patient record in the clinical system. It is not stored or retained.
            </p>
          </div>

          {/* Validate Button */}
          {screenshot && !validationResult && (
            <Button 
              onClick={validateScreenshot} 
              disabled={validating}
              className="w-full"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analysing screenshot...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Verify Screenshot
                </>
              )}
            </Button>
          )}

          {/* Validation Result */}
          {validationResult && (
            <div className="space-y-3">
              <Label>Verification Result:</Label>
              <div className={`p-4 rounded-lg border space-y-2 ${
                allMatch ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 
                'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
              }`}>
                <div className="flex items-center gap-2">
                  {validationResult.nhs_match ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span>
                    NHS Number: {validationResult.extracted_nhs || 'Not found'} — 
                    <span className={validationResult.nhs_match ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {validationResult.nhs_match ? ' MATCH' : ' MISMATCH'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {validationResult.dob_match ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span>
                    Date of Birth: {validationResult.extracted_dob ? formatDate(validationResult.extracted_dob) : 'Not found'} — 
                    <span className={validationResult.dob_match ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {validationResult.dob_match ? ' MATCH' : ' MISMATCH'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {validationResult.file_detected ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <span>
                    File uploaded: {validationResult.extracted_files.length > 0 ? validationResult.extracted_files.join(', ') : 'Not detected'} — 
                    <span className={validationResult.file_detected ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                      {validationResult.file_detected ? ' DETECTED' : ' NOT DETECTED'}
                    </span>
                  </span>
                </div>
                <div className="pt-2 border-t mt-2">
                  <Badge variant="outline">Confidence: {Math.round(validationResult.confidence * 100)}%</Badge>
                </div>
              </div>

              {/* Manual Override for Mismatches */}
              {hasMismatch && (
                <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Verification mismatch detected</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        The extracted details don't match the expected values. If you're certain the file was uploaded correctly, you can manually override.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="override-reason">Override reason (required):</Label>
                    <textarea
                      id="override-reason"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g., Screenshot quality was poor but verified manually on screen"
                      className="w-full p-2 border rounded-md text-sm min-h-[80px] bg-background"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {validationResult && (
            <Button 
              onClick={confirmValidation}
              variant={allMatch ? 'default' : 'destructive'}
              disabled={hasMismatch && !overrideReason.trim()}
            >
              {allMatch ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Validated
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Confirm Override
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
