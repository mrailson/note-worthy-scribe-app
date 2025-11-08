import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Image, Mail, Download, Loader2, CheckCircle, AlertCircle, Camera, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ComplaintData {
  patient_name?: string;
  patient_dob?: string;
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
}

interface ComplaintImportProps {
  onDataExtracted: (data: ComplaintData) => void;
  onClose: () => void;
}

export const ComplaintImport: React.FC<ComplaintImportProps> = ({ onDataExtracted, onClose }) => {
  const deviceInfo = useDeviceInfo();
  const [textContent, setTextContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ComplaintData | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
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

  const downloadExample = async (exampleNumber: number, exampleName: string) => {
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
      
      showToast.success(`Downloaded: ${exampleName}`, { section: 'complaints' });
    } catch (error) {
      console.error('Download error:', error);
      showToast.error('Failed to download example', { section: 'complaints' });
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
                  <DropdownMenuItem onClick={() => downloadExample(1, "High Priority - Clinical Care & Staff Attitude")}>
                    Example 1: High Priority - Clinical Care & Staff Attitude
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(2, "Medium Priority - Appointment Delays")}>
                    Example 2: Medium Priority - Appointment Delays
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(3, "High Priority - Medication Error")}>
                    Example 3: High Priority - Medication Error
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(4, "Low Priority - Facility & Cleanliness")}>
                    Example 4: Low Priority - Facility & Cleanliness
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(5, "Medium Priority - Test Results Delay")}>
                    Example 5: Medium Priority - Test Results Delay
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(6, "High Priority - Misdiagnosis Concern")}>
                    Example 6: High Priority - Misdiagnosis Concern
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(7, "Medium Priority - Discrimination")}>
                    Example 7: Medium Priority - Discrimination & Accessibility
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(8, "Low Priority - Administrative Error")}>
                    Example 8: Low Priority - Administrative Error
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(9, "High Priority - Child Safeguarding")}>
                    Example 9: High Priority - Child Safeguarding Concern
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(10, "Medium Priority - Prescription Error")}>
                    Example 10: Medium Priority - Prescription Error
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(11, "High Priority - Privacy & Data Breach")}>
                    Example 11: High Priority - Privacy & Data Breach
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(12, "VEXATIOUS - Unreasonable Demands")} className="text-orange-600 font-semibold">
                    Example 12: VEXATIOUS - Unreasonable Demands
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(13, "VEXATIOUS - Aggressive Communication")} className="text-orange-600 font-semibold">
                    Example 13: VEXATIOUS - Aggressive Communication
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(14, "Medium Priority - Mental Health Care Gap")}>
                    Example 14: Medium Priority - Mental Health Care Gap
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(15, "High Priority - Multiple Systems Failures")}>
                    Example 15: High Priority - Multiple Systems Failures
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(16, "Medium Priority - Communication Breakdown")}>
                    Example 16: Medium Priority - Communication Breakdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(17, "High Priority - Aggressive Staff Behaviour")}>
                    Example 17: High Priority - Aggressive Staff Behaviour
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(18, "Low Priority - Telephone System Issues")}>
                    Example 18: Low Priority - Telephone System Issues
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(19, "Medium Priority - Prescription Safety Concern")}>
                    Example 19: Medium Priority - Prescription Safety
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExample(20, "High Priority - Delayed Cancer Diagnosis")}>
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
              "grid w-full grid-cols-2",
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
                    File Upload
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
                  {selectedFiles.map((file, index) => (
                    <div key={index} className={cn(
                      "flex items-center justify-between bg-gray-50 rounded-lg",
                      deviceInfo.isIPhone ? "p-4" : "p-3"
                    )}>
                      <div className={cn(
                        "flex items-center gap-2 flex-1 min-w-0",
                        deviceInfo.isIPhone && "w-full"
                      )}>
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className={cn(
                          "truncate",
                          deviceInfo.isIPhone ? "text-sm" : "text-sm"
                        )}>{file.name}</span>
                        <Badge variant="secondary" className="flex-shrink-0 text-xs">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Badge>
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
                  ))}
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