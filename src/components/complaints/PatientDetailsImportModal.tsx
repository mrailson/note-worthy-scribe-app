import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, ClipboardPaste, Image, FileText, User, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { validateNHSNumber, formatNHSNumber } from '@/utils/nhsNumberValidator';

export interface PatientDetailsData {
  patient_name?: string;
  patient_dob?: string;
  patient_nhs_number?: string;
  patient_contact_phone?: string;
  patient_contact_email?: string;
  patient_address?: string;
}

interface PatientDetailsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: PatientDetailsData) => void;
}

export const PatientDetailsImportModal: React.FC<PatientDetailsImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<PatientDetailsData | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setPastedText('');
      setUploadedFileName(null);
      setExtractedData(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Handle image OCR extraction
  const handleImageOCR = useCallback(async (file: File) => {
    setIsProcessing(true);
    setUploadedFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const mimeType = file.type || 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // Use the extract-document-text edge function for OCR
      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: { dataUrl, fileType: 'image' }
      });

      if (error) throw error;

      if (data?.extractedText) {
        setPastedText(data.extractedText);
        setActiveTab('paste');
        showToast.success('Screenshot processed via OCR', { section: 'complaints' });
      } else {
        throw new Error('No text extracted from image');
      }
    } catch (error) {
      console.error('Image OCR error:', error);
      showToast.error('Failed to extract text from screenshot', { section: 'complaints' });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    // Check if it's an image file
    if (file.type.startsWith('image/')) {
      return handleImageOCR(file);
    }

    setIsProcessing(true);
    setUploadedFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const fileType = file.name.toLowerCase().endsWith('.docx') ? 'word' :
                       file.name.toLowerCase().endsWith('.doc') ? 'word' :
                       file.name.toLowerCase().endsWith('.xlsx') ? 'excel' :
                       file.name.toLowerCase().endsWith('.xls') ? 'excel' :
                       file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'unknown';

      if (fileType === 'excel') {
        // Use xlsx-js-style for Excel files (client-side)
        const XLSX = await import('xlsx-js-style');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        let extractedText = '';
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(sheet);
          if (csvData && csvData.trim()) {
            extractedText += csvData + '\n';
          }
        });

        setPastedText(extractedText);
        setActiveTab('paste');
        showToast.success('Excel file processed', { section: 'complaints' });
      } else if (fileType === 'word' || fileType === 'pdf') {
        // Use edge function for Word/PDF files
        const mimeType = file.type || 'application/octet-stream';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const { data, error } = await supabase.functions.invoke('extract-document-text', {
          body: { dataUrl, fileType }
        });

        if (error) throw error;

        if (data?.extractedText) {
          setPastedText(data.extractedText);
          setActiveTab('paste');
          showToast.success('Document processed', { section: 'complaints' });
        } else {
          throw new Error('No text extracted');
        }
      } else {
        // Try reading as plain text
        const text = await file.text();
        setPastedText(text);
        setActiveTab('paste');
        showToast.success('File loaded', { section: 'complaints' });
      }
    } catch (error) {
      console.error('File processing error:', error);
      showToast.error('Failed to process file', { section: 'complaints' });
    } finally {
      setIsProcessing(false);
    }
  }, [handleImageOCR]);

  // Handle paste events for images (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isOpen || isProcessing) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleImageOCR(file);
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen, isProcessing, handleImageOCR]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  const handleExtractDetails = async () => {
    if (!pastedText.trim()) {
      showToast.error('Please paste or upload patient information', { section: 'complaints' });
      return;
    }

    setIsProcessing(true);
    setExtractedData(null);

    try {
      const { data, error } = await supabase.functions.invoke('extract-patient-details-complaint', {
        body: { text: pastedText }
      });

      if (error) throw error;

      if (data?.success && data?.patientData) {
        // Validate and format NHS number
        if (data.patientData.patient_nhs_number) {
          const validation = validateNHSNumber(data.patientData.patient_nhs_number);
          if (validation.valid && validation.formatted) {
            data.patientData.patient_nhs_number = validation.formatted;
          }
        }

        setExtractedData(data.patientData);
        showToast.success('Patient details extracted', { section: 'complaints' });
      } else {
        throw new Error(data?.error || 'Failed to extract patient details');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      showToast.error('Failed to extract patient details', { section: 'complaints' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    if (extractedData) {
      onImport(extractedData);
      onClose();
      showToast.success('Patient details imported', { section: 'complaints' });
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedText(text);
        showToast.success('Pasted from clipboard', { section: 'complaints' });
      }
    } catch (error) {
      showToast.error('Unable to access clipboard', { section: 'complaints' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Import Patient Details
          </DialogTitle>
          <DialogDescription>
            Import patient demographic details from a screenshot, document, or pasted text.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Paste a screenshot (Ctrl+V), drag & drop a file, or paste text containing patient details. 
              The AI will extract name, DOB, NHS number, phone, email, and address.
            </AlertDescription>
          </Alert>

          {/* Import Method Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paste' | 'upload')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste" className="gap-2">
                <ClipboardPaste className="h-4 w-4" />
                Paste Text
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasteFromClipboard}
                  className="gap-2"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Paste from Clipboard
                </Button>
              </div>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste text containing patient details here. Include name, DOB, NHS number, phone, email, address..."
                className="min-h-[150px] font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="upload" className="space-y-3">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                <input {...getInputProps()} />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Processing {uploadedFileName}...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                    {isDragActive ? (
                      <p className="text-primary">Drop the file here...</p>
                    ) : (
                      <>
                        <p className="font-medium">Drag & drop a file or paste a screenshot</p>
                        <p className="text-sm text-muted-foreground">
                          Word, Excel, PDF, TXT, or screenshots (PNG, JPG)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Press Ctrl+V to paste a screenshot from clipboard
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
              {uploadedFileName && !isProcessing && (
                <p className="text-sm text-muted-foreground mt-2">
                  Loaded: {uploadedFileName}
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* Preview count */}
          {pastedText && !extractedData && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Text length: {pastedText.length} characters
              </p>
              <Button onClick={handleExtractDetails} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  'Extract Patient Details'
                )}
              </Button>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Extracted Patient Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {extractedData.patient_name && (
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{extractedData.patient_name}</p>
                  </div>
                )}
                {extractedData.patient_dob && (
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{extractedData.patient_dob}</p>
                  </div>
                )}
                {extractedData.patient_nhs_number && (
                  <div>
                    <Label className="text-muted-foreground">NHS Number</Label>
                    <p className="font-medium">{extractedData.patient_nhs_number}</p>
                  </div>
                )}
                {extractedData.patient_contact_phone && (
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{extractedData.patient_contact_phone}</p>
                  </div>
                )}
                {extractedData.patient_contact_email && (
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{extractedData.patient_contact_email}</p>
                  </div>
                )}
                {extractedData.patient_address && (
                  <div className="sm:col-span-2">
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium">{extractedData.patient_address}</p>
                  </div>
                )}
              </div>
              {!extractedData.patient_name && !extractedData.patient_nhs_number && (
                <p className="text-muted-foreground text-sm italic">
                  No patient details were found in the text. Try pasting different content.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            {extractedData ? (
              <Button 
                onClick={handleConfirmImport} 
                disabled={!extractedData.patient_name && !extractedData.patient_nhs_number}
              >
                Import Patient Details
              </Button>
            ) : (
              <Button onClick={handleExtractDetails} disabled={isProcessing || !pastedText.trim()}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Extract Patient Details'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
