import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Image as ImageIcon,
  Clipboard,
  Copy,
  Download
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { generateLGFilename } from '@/utils/lgFilenameGenerator';

interface LGValidationModalProps {
  open: boolean;
  onClose: () => void;
  patient: {
    id: string;
    patient_name: string | null;
    nhs_number: string | null;
    dob: string | null;
    images_count: number | null;
    created_at: string;
    pdf_url: string | null;
    pdf_final_size_mb: number | null;
    pdf_part_urls?: string[] | null;
    pdf_split?: boolean | null;
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

  // Process image file/blob into base64
  const processImageFile = useCallback((file: File | Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setScreenshot(base64);
      setScreenshotPreview(base64);
      setValidationResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle paste from clipboard (Ctrl+V / Cmd+V)
  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
        }
        break;
      }
    }
  }, [processImageFile]);

  // Handle "Paste from Clipboard" button click (for right-click paste workflow)
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          processImageFile(blob);
          return;
        }
      }
      toast.error('No image found in clipboard. Copy a screenshot first.');
    } catch (err) {
      console.error('Clipboard read error:', err);
      toast.error('Unable to read clipboard. Try using Ctrl+V or drag & drop.');
    }
  }, [processImageFile]);

  // Listen for paste events when modal is open
  useEffect(() => {
    if (open) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [open, handlePaste]);

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
          expectedDob: patient.dob || ''
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Now we have the completed LG electronically, we need to attach it to the patient record for <span className="text-primary">{patient.patient_name || 'the patient'}</span></DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Step 1: Open Clinical System */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">1</div>
            <div className="flex-1">
              <p className="font-medium">Open your Clinical System</p>
              <p className="text-sm text-muted-foreground">Open EMIS Web or SystmOne</p>
            </div>
          </div>

          {/* Step 2: Open Patient Record */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">2</div>
            <div className="flex-1">
              <p className="font-medium">Open the record for patient: <span className="text-primary">{patient.patient_name || 'Unknown'}</span></p>
              <div className="mt-2 bg-muted/50 p-3 rounded-lg border space-y-1 text-sm">
                <p className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">NHS:</span> 
                  <span className="font-mono font-semibold">{formatNhsNumber(patient.nhs_number)}</span>
                  {patient.nhs_number && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(patient.nhs_number?.replace(/\s/g, '') || '');
                      }}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Copy NHS number"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground italic">(click to copy for search)</span>
                </p>
                <p className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">DOB:</span> 
                  <span className="font-semibold">{formatDate(patient.dob)}</span>
                  {patient.dob && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(formatDate(patient.dob));
                      }}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Copy date of birth"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Attach File(s) */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">3</div>
            <div className="flex-1">
              {patient.pdf_split && patient.pdf_part_urls && patient.pdf_part_urls.length > 1 ? (
                <>
                  <p className="font-medium">Attach <span className="text-destructive font-bold">ALL {patient.pdf_part_urls.length}</span> Lloyd George files to the patient record</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-1">
                    ⚠️ This record has been split into {patient.pdf_part_urls.length} parts. Each file must be uploaded and verified separately.
                  </p>
                  <div className="mt-3 space-y-2">
                    {patient.pdf_part_urls.map((partUrl, index) => {
                      const partNumber = index + 1;
                      const totalParts = patient.pdf_part_urls!.length;
                      const filename = generateLGFilename({
                        patientName: patient.patient_name,
                        nhsNumber: patient.nhs_number,
                        dob: patient.dob,
                        partNumber,
                        totalParts
                      });
                      // Estimate ~4.8MB per part (split threshold) - last part may be smaller
                      const isLastPart = index === patient.pdf_part_urls!.length - 1;
                      const estimatedSizeMb = isLastPart ? '≤4.8' : '~4.8';
                      
                      return (
                        <div key={index} className="bg-primary p-4 rounded-lg text-primary-foreground">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-lg">Part {partNumber} of {totalParts} • {estimatedSizeMb} MB</p>
                              <p className="text-primary-foreground/80 text-sm mt-0.5 break-all">
                                {filename}
                              </p>
                              <p className="text-primary-foreground/70 text-xs mt-1">
                                {patient.patient_name || 'Unknown'} | NHS: {formatNhsNumber(patient.nhs_number)} | DOB: {formatDate(patient.dob)}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="flex-shrink-0 p-2 hover:bg-primary-foreground/10 rounded transition-colors"
                              onClick={async () => {
                                try {
                                  const storagePath = partUrl.startsWith('lg/') 
                                    ? partUrl.substring(3) 
                                    : partUrl;
                                  const { data, error } = await supabase.storage
                                    .from('lg')
                                    .createSignedUrl(storagePath, 3600);
                                  if (error || !data?.signedUrl) {
                                    toast.error('Failed to get download link');
                                    return;
                                  }
                                  // Force download instead of opening in browser
                                  const response = await fetch(data.signedUrl);
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = filename;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  window.URL.revokeObjectURL(url);
                                } catch {
                                  toast.error('Failed to download file');
                                }
                              }}
                              title={`Download Part ${partNumber}`}
                            >
                              <Download className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium">Attach the Lloyd George file to the patient record</p>
                  <div className="mt-2 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-900 space-y-2 text-sm">
                    <p className="break-all">
                      <span className="text-muted-foreground">Filename:</span>{' '}
                      <span className="font-mono font-semibold">
                        {generateLGFilename({
                          patientName: patient.patient_name,
                          nhsNumber: patient.nhs_number,
                          dob: patient.dob,
                          partNumber: 1,
                          totalParts: 1
                        })}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground italic">Tip: the filename always starts with Lloyd_George_Record</p>
                    <div className="flex items-center gap-4 pt-1 flex-wrap">
                      <span><span className="text-muted-foreground">Pages:</span> <span className="font-medium">{patient.images_count || '—'}</span></span>
                      <span><span className="text-muted-foreground">Size:</span> <span className="font-medium">{patient.pdf_final_size_mb ? `${patient.pdf_final_size_mb.toFixed(2)} MB` : '—'}</span></span>
                      {patient.pdf_url && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 py-1"
                          onClick={async () => {
                            try {
                              const storagePath = patient.pdf_url!.startsWith('lg/') 
                                ? patient.pdf_url!.substring(3) 
                                : patient.pdf_url!;
                              const { data, error } = await supabase.storage
                                .from('lg')
                                .createSignedUrl(storagePath, 3600);
                              if (error || !data?.signedUrl) {
                                toast.error('Failed to get download link');
                                return;
                              }
                              // Force download instead of opening in browser
                              const downloadFilename = generateLGFilename({
                                patientName: patient.patient_name,
                                nhsNumber: patient.nhs_number,
                                dob: patient.dob,
                                partNumber: 1,
                                totalParts: 1
                              });
                              const response = await fetch(data.signedUrl);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = downloadFilename;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                            } catch {
                              toast.error('Failed to download file');
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 4: Take Screenshot */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">4</div>
            <div className="flex-1">
              <p className="font-medium">When the file is added to the record of <span className="text-primary">{patient.patient_name || 'the patient'}</span>, take a screenshot and paste it below</p>
              <p className="text-sm text-muted-foreground mb-2">The system will check and confirm — it's vital we never accidentally save to the wrong patient. Press <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs font-mono">Win</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs font-mono">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs font-mono">S</kbd> to capture.</p>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                {screenshotPreview ? (
                  <div className="space-y-2">
                    <img 
                      src={screenshotPreview} 
                      alt="Screenshot preview" 
                      className="max-h-40 mx-auto rounded border"
                    />
                    <p className="text-sm text-muted-foreground">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-3">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                      <Clipboard className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Drag & drop, click to upload, or Ctrl+V / ⌘+V</p>
                      <p className="text-xs text-muted-foreground">Supports: PNG, JPG, WEBP (max 10MB)</p>
                    </div>
                  </div>
                )}
              </div>
              
              {!screenshotPreview && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePasteFromClipboard}
                  className="w-full mt-2"
                  size="sm"
                >
                  <Clipboard className="h-4 w-4 mr-2" />
                  Paste from Clipboard
                </Button>
              )}
            </div>
          </div>

          {/* Step 5: Verify */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold">5</div>
            <div className="flex-1">
              <p className="font-medium text-muted-foreground">Notewell will verify the correct file was uploaded to the correct patient</p>
              <p className="text-xs text-muted-foreground italic mt-1">The screenshot is used only for verification and is not stored or retained.</p>
            </div>
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
