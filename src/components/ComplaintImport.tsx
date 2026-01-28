import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Image, Mail, Download, Loader2, CheckCircle, AlertCircle, Camera, X, User, ClipboardPaste } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { validateNHSNumber } from '@/utils/nhsNumberValidator';
import complaintPage1 from '@/assets/complaint-page-1.jpg';
import complaintPage2 from '@/assets/complaint-page-2.jpg';

interface ComplaintData {
  patient_name?: string;
  patient_dob?: string;
  patient_nhs_number?: string;
  patient_contact_phone?: string;
  patient_contact_email?: string;
  patient_address?: string;
  incident_date?: string;
  complaint_title?: string;
  complaint_description?: string;
  category?: string;
  location_service?: string;
  staff_mentioned?: string[];
  priority?: string;
  consent_given?: boolean;
  complaint_on_behalf?: boolean;
  complaint_source?: string;
}

export interface PatientDetailsData {
  patient_name?: string;
  patient_dob?: string;
  patient_nhs_number?: string;
  patient_contact_phone?: string;
  patient_contact_email?: string;
  patient_address?: string;
}

interface ComplaintImportProps {
  onDataExtracted: (data: ComplaintData) => void;
  onPatientDetailsExtracted?: (data: PatientDetailsData) => void;
  onClose: () => void;
}

export const ComplaintImport: React.FC<ComplaintImportProps> = ({ onDataExtracted, onPatientDetailsExtracted, onClose }) => {
  const deviceInfo = useDeviceInfo();
  const [textContent, setTextContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ComplaintData | null>(null);
  const [loadedExample, setLoadedExample] = useState<{number: number, name: string} | null>(null);
  const [hiddenTextFile, setHiddenTextFile] = useState<File | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Patient details import state
  const [patientText, setPatientText] = useState('');
  const [patientProcessing, setPatientProcessing] = useState(false);
  const [patientFileName, setPatientFileName] = useState<string | null>(null);
  const [extractedPatientData, setExtractedPatientData] = useState<PatientDetailsData | null>(null);

  // Auto-scroll to preview when data is extracted
  useEffect(() => {
    if (extractedData && previewRef.current) {
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [extractedData]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const maxSize = 20 * 1024 * 1024; // 20MB per file
      const invalidFiles = files.filter(f => f.size > maxSize);
      
      if (invalidFiles.length > 0) {
        showToast.error(`${invalidFiles.length} file(s) exceed 20MB limit`, { section: 'complaints' });
        return;
      }
      
      setSelectedFiles(files);
      showToast.success(`Selected: ${files.length} file(s)`, { section: 'complaints' });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setLoadedExample(null);
    
    // Clear hidden text file when all files are removed
    if (selectedFiles.length === 1) {
      setHiddenTextFile(null);
    }
  };

  const handleImport = async (source: 'file' | 'text') => {
    if (source === 'file' && selectedFiles.length === 0) {
      showToast.error('Please select at least one file to import', { section: 'complaints' });
      return;
    }
    
    if (source === 'text' && !textContent.trim()) {
      showToast.error('Please enter text content to process', { section: 'complaints' });
      return;
    }

    setProcessing(true);
    
    try {
      const formData = new FormData();
      
      if (source === 'file' && selectedFiles.length > 0) {
        // If Example 2 is loaded and we have a hidden text file, use that for processing
        if (hiddenTextFile) {
          formData.append('files', hiddenTextFile);
        } else {
          selectedFiles.forEach(file => {
            formData.append('files', file);
          });
        }
      } else {
        formData.append('textContent', textContent);
      }

      // Use direct fetch for better FormData handling
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-complaint-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Import error response:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Directly populate form fields without preview step
        onDataExtracted(data.complaintData);
        onClose();
        showToast.success('Complaint data imported successfully!', { section: 'complaints' });
      } else {
        throw new Error(data.error || 'Failed to process import');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      
      // Show specific error messages for different file types
      if (error.message?.includes('Word document')) {
        showToast.error('Word documents require manual text entry. Please copy the text from your document and paste it in the text area below.', { section: 'complaints' });
      } else if (error.message?.includes('PDF')) {
        showToast.error('PDF files require manual text entry. Please copy the text from your PDF and paste it in the text area below.', { section: 'complaints' });
      } else {
        showToast.error(error instanceof Error ? error.message : 'Failed to import data. Please try copying and pasting the text instead.', { section: 'complaints' });
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmData = () => {
    if (extractedData) {
      onDataExtracted(extractedData);
      onClose();
      showToast.success('Complaint data imported successfully!', { section: 'complaints' });
    }
  };

  const loadExample = async (exampleNumber: number, exampleName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-example-complaint', {
        body: { exampleNumber }
      });
      
      if (error) throw error;
      
      // Special handling for Example 2 - show two images instead of a text file for demo
      if (exampleNumber === 2) {
        // Fetch both complaint letter page images
        const [img1Response, img2Response] = await Promise.all([
          fetch(complaintPage1),
          fetch(complaintPage2)
        ]);
        
        const [img1Blob, img2Blob] = await Promise.all([
          img1Response.blob(),
          img2Response.blob()
        ]);
        
        // Create two File objects from the actual complaint letter pages
        const imageFile1 = new File([img1Blob], 'complaint-letter-page-1.jpg', {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        const imageFile2 = new File([img2Blob], 'complaint-letter-page-2.jpg', {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        
        // Store the text content separately for extraction
        const textBlob = new Blob([data], { type: 'text/plain' });
        const textFile = new File([textBlob], `example-complaint-${exampleNumber}.txt`, {
          type: 'text/plain',
          lastModified: Date.now()
        });
        
        // Show image files to user, but keep text file hidden for processing
        setSelectedFiles([imageFile1, imageFile2]);
        setHiddenTextFile(textFile);
        
        setLoadedExample({ number: exampleNumber, name: exampleName });
        showToast.success(`Loaded: ${exampleName}`, { section: 'complaints' });
      } else {
        // Normal behavior for all other examples
        const blob = new Blob([data], { type: 'text/plain' });
        const file = new File([blob], `example-complaint-${exampleNumber}.txt`, {
          type: 'text/plain',
          lastModified: Date.now()
        });
        
        setSelectedFiles([file]);
        setHiddenTextFile(null);
        
        setLoadedExample({ number: exampleNumber, name: exampleName });
        showToast.success(`Loaded: ${exampleName}`, { section: 'complaints' });
      }
    } catch (error) {
      console.error('Load example error:', error);
      showToast.error('Failed to load example', { section: 'complaints' });
    }
  };

  const downloadExampleFile = async (exampleNumber: number, exampleName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-example-complaint', {
        body: { exampleNumber }
      });
      
      if (error) throw error;
      
      // Create a blob and download link
      const blob = new Blob([data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `example-complaint-${exampleNumber}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast.success('Example file downloaded', { section: 'complaints' });
    } catch (error) {
      console.error('Download error:', error);
      showToast.error('Failed to download', { section: 'complaints' });
    }
  };

  // === Patient Details Import Handlers ===
  const handlePatientImageOCR = useCallback(async (file: File) => {
    setPatientProcessing(true);
    setPatientFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const mimeType = file.type || 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: { dataUrl, fileType: 'image' }
      });

      if (error) throw error;

      if (data?.extractedText) {
        setPatientText(data.extractedText);
        showToast.success('Screenshot processed via OCR', { section: 'complaints' });
      } else {
        throw new Error('No text extracted from image');
      }
    } catch (error) {
      console.error('Image OCR error:', error);
      showToast.error('Failed to extract text from screenshot', { section: 'complaints' });
    } finally {
      setPatientProcessing(false);
    }
  }, []);

  const handlePatientFileUpload = useCallback(async (file: File) => {
    if (file.type.startsWith('image/')) {
      return handlePatientImageOCR(file);
    }

    setPatientProcessing(true);
    setPatientFileName(file.name);

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

        setPatientText(extractedText);
        showToast.success('Excel file processed', { section: 'complaints' });
      } else if (fileType === 'word' || fileType === 'pdf') {
        const mimeType = file.type || 'application/octet-stream';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const { data, error } = await supabase.functions.invoke('extract-document-text', {
          body: { dataUrl, fileType }
        });

        if (error) throw error;

        if (data?.extractedText) {
          setPatientText(data.extractedText);
          showToast.success('Document processed', { section: 'complaints' });
        } else {
          throw new Error('No text extracted');
        }
      } else {
        const text = await file.text();
        setPatientText(text);
        showToast.success('File loaded', { section: 'complaints' });
      }
    } catch (error) {
      console.error('File processing error:', error);
      showToast.error('Failed to process file', { section: 'complaints' });
    } finally {
      setPatientProcessing(false);
    }
  }, [handlePatientImageOCR]);

  // Listen for paste events for patient details (Ctrl+V screenshots)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if we're on the patient tab
      const patientTabActive = document.querySelector('[data-state="active"][value="patient"]');
      if (!patientTabActive || patientProcessing) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handlePatientImageOCR(file);
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [patientProcessing, handlePatientImageOCR]);

  const patientDropzone = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) {
        handlePatientFileUpload(files[0]);
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
    disabled: patientProcessing
  });

  const handleExtractPatientDetails = async () => {
    if (!patientText.trim()) {
      showToast.error('Please paste or upload patient information', { section: 'complaints' });
      return;
    }

    setPatientProcessing(true);
    setExtractedPatientData(null);

    try {
      const { data, error } = await supabase.functions.invoke('extract-patient-details-complaint', {
        body: { text: patientText }
      });

      if (error) throw error;

      if (data?.success && data?.patientData) {
        if (data.patientData.patient_nhs_number) {
          const validation = validateNHSNumber(data.patientData.patient_nhs_number);
          if (validation.valid && validation.formatted) {
            data.patientData.patient_nhs_number = validation.formatted;
          }
        }

        setExtractedPatientData(data.patientData);
        showToast.success('Patient details extracted', { section: 'complaints' });
      } else {
        throw new Error(data?.error || 'Failed to extract patient details');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      showToast.error('Failed to extract patient details', { section: 'complaints' });
    } finally {
      setPatientProcessing(false);
    }
  };

  const handleConfirmPatientImport = () => {
    if (extractedPatientData && onPatientDetailsExtracted) {
      onPatientDetailsExtracted(extractedPatientData);
      onClose();
      showToast.success('Patient details imported', { section: 'complaints' });
    }
  };

  const handlePastePatientFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPatientText(text);
        showToast.success('Pasted from clipboard', { section: 'complaints' });
      }
    } catch (error) {
      showToast.error('Unable to access clipboard', { section: 'complaints' });
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
      deviceInfo.isIPhone ? "p-2" : "p-4"
    )}>
      <Card className={cn(
        "w-full overflow-y-auto",
        deviceInfo.isIPhone 
          ? "max-w-full h-full rounded-none" 
          : "max-w-4xl max-h-[90vh] rounded-lg"
      )}>
        <CardHeader className={cn(
          deviceInfo.isIPhone && "sticky top-0 z-10 bg-card border-b"
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className={cn(
                "flex items-center gap-2",
                deviceInfo.isIPhone ? "text-base" : "text-lg"
              )}>
                <Upload className={cn(deviceInfo.isIPhone ? "h-4 w-4" : "h-5 w-5")} />
                <span className="truncate">Import Complaint</span>
              </CardTitle>
              <CardDescription className={cn(
                deviceInfo.isIPhone ? "text-xs hidden sm:block" : "text-sm"
              )}>
                Upload photos or paste text to extract complaint information
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {!deviceInfo.isIPhone && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Examples
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuItem onClick={() => loadExample(1, "High Priority - Clinical Care & Staff Attitude")}>
                    Example 1: High Priority - Clinical Care & Staff Attitude
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(2, "Medium Priority - Appointment Delays")}>
                    Example 2: Medium Priority - Appointment Delays
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(3, "High Priority - Medication Error")}>
                    Example 3: High Priority - Medication Error
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(4, "Low Priority - Facility & Cleanliness")}>
                    Example 4: Low Priority - Facility & Cleanliness
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(5, "Medium Priority - Test Results Delay")}>
                    Example 5: Medium Priority - Test Results Delay
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(6, "High Priority - Misdiagnosis Concern")}>
                    Example 6: High Priority - Misdiagnosis Concern
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(7, "Medium Priority - Discrimination")}>
                    Example 7: Medium Priority - Discrimination & Accessibility
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(8, "Low Priority - Administrative Error")}>
                    Example 8: Low Priority - Administrative Error
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(9, "High Priority - Child Safeguarding")}>
                    Example 9: High Priority - Child Safeguarding Concern
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(10, "Medium Priority - Prescription Error")}>
                    Example 10: Medium Priority - Prescription Error
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(11, "High Priority - Privacy & Data Breach")}>
                    Example 11: High Priority - Privacy & Data Breach
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(12, "VEXATIOUS - Unreasonable Demands")} className="text-orange-600 font-semibold">
                    Example 12: VEXATIOUS - Unreasonable Demands
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(13, "VEXATIOUS - Aggressive Communication")} className="text-orange-600 font-semibold">
                    Example 13: VEXATIOUS - Aggressive Communication
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(14, "Medium Priority - Mental Health Care Gap")}>
                    Example 14: Medium Priority - Mental Health Care Gap
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(15, "High Priority - Multiple Systems Failures")}>
                    Example 15: High Priority - Multiple Systems Failures
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(16, "Medium Priority - Communication Breakdown")}>
                    Example 16: Medium Priority - Communication Breakdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(17, "High Priority - Aggressive Staff Behaviour")}>
                    Example 17: High Priority - Aggressive Staff Behaviour
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(18, "Low Priority - Telephone System Issues")}>
                    Example 18: Low Priority - Telephone System Issues
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(19, "Medium Priority - Prescription Safety Concern")}>
                    Example 19: Medium Priority - Prescription Safety
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadExample(20, "High Priority - Delayed Cancer Diagnosis")}>
                    Example 20: High Priority - Delayed Cancer Diagnosis
                  </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button 
                variant="outline" 
                onClick={onClose}
                className={cn(deviceInfo.isIPhone && "min-h-[44px] px-4")}
              >
                Close
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className={cn(
          "space-y-6",
          deviceInfo.isIPhone && "pb-safe"
        )}>
          <Alert className={cn(deviceInfo.isIPhone && "text-xs")}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {deviceInfo.isIPhone ? (
                <>
                  <strong>Take photos</strong> of complaint letters or paste text.
                  AI extracts patient details and incident information automatically. Multiple files supported.
                </>
              ) : (
                <>
                  Supported formats: Images (JPG, PNG), Text files, Email content. 
                  <strong>For Word documents and PDFs:</strong> Please copy the text content and paste it in the Text/Email tab for best results.
                  AI will automatically extract patient details, incident information, and complaint specifics. <strong>Multiple files can be uploaded at once.</strong>
                </>
              )}
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="file" className="w-full">
            <TabsList className={cn(
              "grid w-full grid-cols-3",
              deviceInfo.isIPhone && "h-auto"
            )}>
              <TabsTrigger 
                value="file" 
                className={cn(
                  "flex items-center gap-2",
                  deviceInfo.isIPhone && "py-3 min-h-[48px]"
                )}
              >
                {deviceInfo.isIPhone ? (
                  <>
                    <Camera className="h-4 w-4" />
                    Photo
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Full Complaint
                  </>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="text" 
                className={cn(
                  "flex items-center gap-2",
                  deviceInfo.isIPhone && "py-3 min-h-[48px]"
                )}
              >
                <Mail className="h-4 w-4" />
                {deviceInfo.isIPhone ? "Text" : "Text/Email"}
              </TabsTrigger>
              <TabsTrigger 
                value="patient" 
                className={cn(
                  "flex items-center gap-2",
                  deviceInfo.isIPhone && "py-3 min-h-[48px]"
                )}
              >
                <User className="h-4 w-4" />
                {deviceInfo.isIPhone ? "Patient" : "Patient Only"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div className={cn(
                "border-2 border-dashed border-gray-300 rounded-lg text-center",
                deviceInfo.isIPhone ? "p-6" : "p-8"
              )}>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt,.eml"
                  capture={deviceInfo.isIPhone ? "environment" : undefined}
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  multiple
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className={cn(
                    "space-y-4",
                    deviceInfo.isIPhone && "py-4"
                  )}>
                    <div className="flex justify-center">
                      {selectedFiles.length > 0 ? (
                        <CheckCircle className={cn(
                          "text-green-500",
                          deviceInfo.isIPhone ? "h-16 w-16" : "h-12 w-12"
                        )} />
                      ) : deviceInfo.isIPhone ? (
                        <Camera className="h-16 w-16 text-primary" />
                      ) : (
                        <Upload className="h-12 w-12 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        "font-medium",
                        deviceInfo.isIPhone ? "text-base" : "text-lg"
                      )}>
                        {selectedFiles.length > 0
                          ? `${selectedFiles.length} file(s) selected` 
                          : deviceInfo.isIPhone 
                            ? 'Take Photo or Choose Files'
                            : 'Choose file(s) to upload'
                        }
                      </p>
                      <p className={cn(
                        "text-muted-foreground mt-2",
                        deviceInfo.isIPhone ? "text-xs" : "text-sm"
                      )}>
                        {deviceInfo.isIPhone 
                          ? 'Photos, PDFs, or text files up to 20MB each'
                          : 'PDF, Word, Image, Text, or Email files up to 20MB each. Multiple files supported.'
                        }
                      </p>
                    </div>
                  </div>
                </label>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    const imageUrl = isImage ? URL.createObjectURL(file) : null;
                    
                    return (
                      <div key={index} className={cn(
                        "flex items-center justify-between bg-gray-50 rounded-lg",
                        deviceInfo.isIPhone ? "p-4" : "p-3"
                      )}>
                        <div className={cn(
                          "flex items-center gap-3 flex-1 min-w-0",
                          deviceInfo.isIPhone && "w-full"
                        )}>
                          {isImage && imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={file.name}
                              className="h-12 w-12 object-cover rounded border flex-shrink-0"
                              onError={(e) => {
                                console.log('Image load error:', e);
                              }}
                            />
                          ) : (
                            <FileText className="h-4 w-4 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "block truncate font-medium",
                              deviceInfo.isIPhone ? "text-sm" : "text-sm"
                            )}>{file.name}</span>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0 ml-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {loadedExample && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => downloadExampleFile(loadedExample.number, loadedExample.name)}
                      className="text-xs w-full justify-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download this example as file
                    </Button>
                  )}
                  <Button 
                    size={deviceInfo.isIPhone ? "default" : "sm"}
                    onClick={() => handleImport('file')}
                    disabled={processing}
                    className={cn("w-full", deviceInfo.isIPhone && "min-h-[48px]")}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing {selectedFiles.length} file(s)...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Extract Data
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text-content">Paste Email or Text Content</Label>
                <Textarea
                  id="text-content"
                  placeholder="Paste the complaint email, letter, or any text content here. The AI will extract all relevant information including patient details, incident information, and complaint specifics."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={10}
                  className="min-h-[200px]"
                />
              </div>
              
              <Button 
                onClick={() => handleImport('text')}
                disabled={processing || !textContent.trim()}
                className={cn(
                  "w-full",
                  deviceInfo.isIPhone && "min-h-[48px] text-base"
                )}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Extract Data from Text
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Patient Details Only Tab */}
            <TabsContent value="patient" className="space-y-4">
              <Alert>
                <User className="h-4 w-4" />
                <AlertDescription>
                  Import <strong>only patient demographics</strong> (name, DOB, NHS number, phone, email, address). 
                  Paste a screenshot (Ctrl+V), drag & drop a file, or paste text.
                </AlertDescription>
              </Alert>

              {/* Dropzone for patient files/screenshots */}
              <div
                {...patientDropzone.getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  patientDropzone.isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50",
                  patientProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                <input {...patientDropzone.getInputProps()} />
                {patientProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Processing {patientFileName}...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <Image className="h-8 w-8 text-muted-foreground" />
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    {patientDropzone.isDragActive ? (
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

              {/* Patient text area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="patient-text">Patient Information Text</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePastePatientFromClipboard}
                    className="gap-2"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                    Paste from Clipboard
                  </Button>
                </div>
                <Textarea
                  id="patient-text"
                  value={patientText}
                  onChange={(e) => setPatientText(e.target.value)}
                  placeholder="Paste text containing patient details here. Include name, DOB, NHS number, phone, email, address..."
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>

              {/* Extract button and preview */}
              {patientText && !extractedPatientData && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Text length: {patientText.length} characters
                  </p>
                  <Button onClick={handleExtractPatientDetails} disabled={patientProcessing}>
                    {patientProcessing ? (
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

              {/* Extracted Patient Data Preview */}
              {extractedPatientData && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Extracted Patient Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {extractedPatientData.patient_name && (
                      <div>
                        <Label className="text-muted-foreground">Name</Label>
                        <p className="font-medium">{extractedPatientData.patient_name}</p>
                      </div>
                    )}
                    {extractedPatientData.patient_dob && (
                      <div>
                        <Label className="text-muted-foreground">Date of Birth</Label>
                        <p className="font-medium">{extractedPatientData.patient_dob}</p>
                      </div>
                    )}
                    {extractedPatientData.patient_nhs_number && (
                      <div>
                        <Label className="text-muted-foreground">NHS Number</Label>
                        <p className="font-medium">{extractedPatientData.patient_nhs_number}</p>
                      </div>
                    )}
                    {extractedPatientData.patient_contact_phone && (
                      <div>
                        <Label className="text-muted-foreground">Phone</Label>
                        <p className="font-medium">{extractedPatientData.patient_contact_phone}</p>
                      </div>
                    )}
                    {extractedPatientData.patient_contact_email && (
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{extractedPatientData.patient_contact_email}</p>
                      </div>
                    )}
                    {extractedPatientData.patient_address && (
                      <div className="sm:col-span-2">
                        <Label className="text-muted-foreground">Address</Label>
                        <p className="font-medium">{extractedPatientData.patient_address}</p>
                      </div>
                    )}
                  </div>
                  {!extractedPatientData.patient_name && !extractedPatientData.patient_nhs_number && (
                    <p className="text-muted-foreground text-sm italic">
                      No patient details were found in the text. Try pasting different content.
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={handleConfirmPatientImport} 
                      disabled={!extractedPatientData.patient_name && !extractedPatientData.patient_nhs_number}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Import Patient Details
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setExtractedPatientData(null)}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {extractedData && (
            <Card className="mt-6" ref={previewRef}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Extracted Data Preview
                </CardTitle>
                <CardDescription>
                  Review the automatically extracted information and confirm to import
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><strong>Patient Name:</strong> {extractedData.patient_name || 'Not found'}</div>
                  <div><strong>DOB:</strong> {extractedData.patient_dob || 'Not found'}</div>
                  <div><strong>Phone:</strong> {extractedData.patient_contact_phone || 'Not found'}</div>
                  <div><strong>Email:</strong> {extractedData.patient_contact_email || 'Not found'}</div>
                  <div><strong>Incident Date:</strong> {extractedData.incident_date || 'Not found'}</div>
                  <div><strong>Category:</strong> {extractedData.category || 'Not found'}</div>
                  <div><strong>Priority:</strong> {extractedData.priority || 'Not found'}</div>
                  <div><strong>Location:</strong> {extractedData.location_service || 'Not found'}</div>
                </div>
                
                {extractedData.complaint_title && (
                  <div>
                    <strong>Title:</strong>
                    <p className="mt-1 text-sm text-muted-foreground">{extractedData.complaint_title}</p>
                  </div>
                )}
                
                {extractedData.complaint_description && (
                  <div>
                    <strong>Description:</strong>
                    <p className="mt-1 text-sm text-muted-foreground max-h-32 overflow-y-auto">
                      {extractedData.complaint_description}
                    </p>
                  </div>
                )}
                
                {extractedData.staff_mentioned && extractedData.staff_mentioned.length > 0 && (
                  <div>
                    <strong>Staff Mentioned:</strong>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {extractedData.staff_mentioned.join(', ')}
                    </p>
                  </div>
                )}

                <div className={cn(
                  "flex gap-2 pt-4",
                  deviceInfo.isIPhone && "flex-col"
                )}>
                  <Button 
                    onClick={handleConfirmData} 
                    className={cn(
                      "flex-1",
                      deviceInfo.isIPhone && "min-h-[48px] text-base w-full"
                    )}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Import This Data
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setExtractedData(null)}
                    className={cn(deviceInfo.isIPhone && "min-h-[48px] w-full")}
                  >
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};