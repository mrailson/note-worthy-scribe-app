import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientContext } from "@/types/scribe";
import { validateNHSNumber, formatNHSNumber } from "@/utils/nhsNumberValidator";
import { supabase } from "@/integrations/supabase/client";
import { 
  ClipboardPaste, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  X,
  User,
  RefreshCw,
  Camera,
  ChevronDown,
  ChevronRight,
  Keyboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/utils/toastWrapper";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PatientContextCaptureProps {
  patientContext: PatientContext | null;
  onPatientContextChange: (context: PatientContext | null) => void;
  emrFormat?: 'emis' | 'systmone';
}

type CaptureState = 'idle' | 'processing' | 'success' | 'error';

export const PatientContextCapture = ({
  patientContext,
  onPatientContextChange,
  emrFormat = 'emis'
}: PatientContextCaptureProps) => {
  const [captureState, setCaptureState] = useState<CaptureState>(
    patientContext ? 'success' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualNhsNumber, setManualNhsNumber] = useState('');
  const [manualDob, setManualDob] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pasteTargetRef = useRef<HTMLDivElement>(null);

  // Handle paste event (from document listener)
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processImage(file);
        }
        break;
      }
    }
  }, []);

  // Handle paste event from contenteditable (for right-click paste)
  const handlePasteEvent = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processImage(file);
        }
        break;
      }
    }
  }, []);


  // Set up paste listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Listen on document for paste when container is focused or in view
    const handleDocumentPaste = (e: ClipboardEvent) => {
      // Only process if we're in idle or error state
      if (captureState === 'idle' || captureState === 'error') {
        handlePaste(e);
      }
    };

    document.addEventListener('paste', handleDocumentPaste);
    return () => document.removeEventListener('paste', handleDocumentPaste);
  }, [handlePaste, captureState]);

  // Process image file
  const processImage = async (file: File) => {
    setCaptureState('processing');
    setError(null);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);

      // Call the edge function
      const { data, error: fnError } = await supabase.functions.invoke('extract-patient-context', {
        body: { 
          imageBase64: base64,
          clinicalSystem: emrFormat
        }
      });

      if (fnError) throw fnError;

      if (!data.success) {
        throw new Error(data.error || 'Failed to extract patient details');
      }

      // Validate NHS number
      const nhsValidation = validateNHSNumber(data.nhsNumber);
      if (!nhsValidation.valid) {
        throw new Error(`NHS number validation failed: ${nhsValidation.error}`);
      }

      // Create patient context
      const context: PatientContext = {
        name: data.name,
        nhsNumber: nhsValidation.formatted || formatNHSNumber(data.nhsNumber),
        dateOfBirth: data.dob || '',
        extractedAt: new Date().toISOString(),
        confidence: data.confidence,
        rawExtract: data.rawText,
        address: data.address || undefined,
        phoneNumbers: data.phoneNumbers || undefined,
        gender: data.gender || undefined
      };

      onPatientContextChange(context);
      setCaptureState('success');
      showToast.success('Patient details extracted successfully', { section: 'gpscribe' });

    } catch (err) {
      console.error('Error processing image:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process image';
      setError(errorMessage);
      setCaptureState('error');
      showToast.error(errorMessage, { section: 'gpscribe' });
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await processImage(file);
    }
  };

  // Clear patient context
  const handleClear = () => {
    onPatientContextChange(null);
    setCaptureState('idle');
    setError(null);
    setManualName('');
    setManualNhsNumber('');
    setManualDob('');
  };

  // Retry extraction
  const handleRetry = () => {
    setCaptureState('idle');
    setError(null);
  };

  // Handle manual entry save
  const handleManualSave = () => {
    if (!manualName.trim() && !manualNhsNumber.trim() && !manualDob.trim()) {
      showToast.error('Please enter at least one detail', { section: 'gpscribe' });
      return;
    }

    // Format NHS number if provided
    let formattedNhs = '';
    if (manualNhsNumber.trim()) {
      const cleaned = manualNhsNumber.replace(/\s/g, '');
      formattedNhs = formatNHSNumber(cleaned);
    }

    const context: PatientContext = {
      name: manualName.trim() || 'Patient',
      nhsNumber: formattedNhs,
      dateOfBirth: manualDob.trim() || '',
      extractedAt: new Date().toISOString(),
      confidence: 1.0, // Manual = full confidence
    };

    onPatientContextChange(context);
    setCaptureState('success');
    setShowManualEntry(false);
    showToast.success('Patient details saved', { section: 'gpscribe' });
  };

  // Render confirmed patient details
  if (captureState === 'success' && patientContext) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{patientContext.name}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {patientContext.nhsNumber && (
                  <span>
                    <span className="font-medium">NHS:</span> {patientContext.nhsNumber}
                  </span>
                )}
                {patientContext.dateOfBirth && (
                  <span>
                    <span className="font-medium">DOB:</span> {patientContext.dateOfBirth}
                  </span>
                )}
                {patientContext.gender && (
                  <span>
                    <span className="font-medium">Sex:</span> {patientContext.gender === 'M' ? 'Male' : 'Female'}
                  </span>
                )}
                {patientContext.address && (
                  <span className="basis-full text-xs opacity-75">
                    📍 {patientContext.address}
                  </span>
                )}
                {patientContext.phoneNumbers && (
                  <span className="text-xs opacity-75">
                    📞 {patientContext.phoneNumbers.preferred && patientContext.phoneNumbers[patientContext.phoneNumbers.preferred] 
                      ? `${patientContext.phoneNumbers[patientContext.phoneNumbers.preferred]} (preferred)`
                      : patientContext.phoneNumbers.mobile || patientContext.phoneNumbers.home || patientContext.phoneNumbers.work}
                  </span>
                )}
              </div>
              {patientContext.confidence && patientContext.confidence < 0.8 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Low confidence extraction - please verify details
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear patient</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render capture area
  return (
    <div ref={containerRef}>
      <Card 
        className={cn(
          "border-dashed transition-colors",
          isDragOver && "border-primary bg-primary/5",
          captureState === 'error' && "border-destructive/50 bg-destructive/5"
        )}
      >
        <CardContent className="pt-4 pb-4">
          {captureState === 'processing' ? (
            <div className="flex flex-col items-center justify-center py-4 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extracting patient details...</p>
            </div>
          ) : captureState === 'error' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Extraction failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Camera className="h-4 w-4" />
                <span className="text-sm font-medium">Screenshot Patient Details</span>
              </div>
              
              {/* Visible paste area - textarea that accepts right-click paste */}
              <div
                ref={pasteTargetRef}
                contentEditable
                onPaste={handlePasteEvent}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onMouseDown={(e) => {
                  // Ensure focus is maintained on right-click
                  if (e.button === 2) {
                    e.currentTarget.focus();
                  }
                }}
                onContextMenu={(e) => {
                  // Ensure the element stays focused when context menu opens
                  pasteTargetRef.current?.focus();
                }}
                className={cn(
                  "w-full min-h-[80px] p-4 rounded-md border border-dashed text-center text-sm text-muted-foreground",
                  "bg-muted/30 cursor-text transition-all outline-none",
                  "hover:border-primary/50 hover:bg-muted/50",
                  "focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-primary/5",
                  "flex items-center justify-center",
                  isFocused && "ring-2 ring-primary/50 border-primary bg-primary/5"
                )}
                tabIndex={0}
                aria-label="Take a screenshot and paste here"
                suppressContentEditableWarning
                style={{ caretColor: 'transparent' }}
              >
                <div className="pointer-events-none select-none space-y-1">
                  <p className="font-medium">
                    Take a screenshot of the patient banner in SystmOne
                  </p>
                  <p className="text-xs opacity-75">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Win</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Shift</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">S</kbd> then paste here — I'll extract the name and NHS number
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground flex-1">
                  Or drag &amp; drop an image
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Manual entry collapsible */}
              <Collapsible open={showManualEntry} onOpenChange={setShowManualEntry}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground -ml-2"
                  >
                    {showManualEntry ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Keyboard className="h-4 w-4" />
                    <span>Or enter details manually</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Use as a memory jogger — all fields are optional
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-name" className="text-xs">
                        Name
                      </Label>
                      <Input
                        id="manual-name"
                        placeholder="e.g. James Smith, J.S., or initials"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-nhs" className="text-xs">
                        NHS Number
                      </Label>
                      <Input
                        id="manual-nhs"
                        placeholder="e.g. 123 456 7890 or just last 4 digits"
                        value={manualNhsNumber}
                        onChange={(e) => setManualNhsNumber(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-dob" className="text-xs">
                        Date of Birth
                      </Label>
                      <Input
                        id="manual-dob"
                        placeholder="e.g. 1975 or 15/03/1975"
                        value={manualDob}
                        onChange={(e) => setManualDob(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    
                    <Button 
                      onClick={handleManualSave}
                      size="sm"
                      className="w-full"
                    >
                      Save Details
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};