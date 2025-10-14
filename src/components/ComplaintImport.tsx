import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Image, Mail, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

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
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ComplaintData | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast.error('File size must be less than 10MB', { section: 'complaints' });
        return;
      }
      
      setSelectedFile(file);
      showToast.success(`Selected: ${file.name}`, { section: 'complaints' });
    }
  };

  const handleImport = async (source: 'file' | 'text') => {
    if (source === 'file' && !selectedFile) {
      showToast.error('Please select a file to import', { section: 'complaints' });
      return;
    }
    
    if (source === 'text' && !textContent.trim()) {
      showToast.error('Please enter text content to process', { section: 'complaints' });
      return;
    }

    setProcessing(true);
    
    try {
      const formData = new FormData();
      
      if (source === 'file' && selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('textContent', textContent);
      }

      const { data, error } = await supabase.functions.invoke('import-complaint-data', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setExtractedData(data.complaintData);
        showToast.success('Data extracted successfully! Review and confirm the details.', { section: 'complaints' });
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Complaint Data
              </CardTitle>
              <CardDescription>
                Upload files or paste text to automatically extract complaint information using AI
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download Examples
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
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Supported formats: Images (JPG, PNG), Text files, Email content. 
              <strong>For Word documents and PDFs:</strong> Please copy the text content and paste it in the Text/Email tab for best results.
              AI will automatically extract patient details, incident information, and complaint specifics.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Text/Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.eml,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      {selectedFile ? (
                        <CheckCircle className="h-12 w-12 text-green-500" />
                      ) : (
                        <Upload className="h-12 w-12 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-medium">
                        {selectedFile ? selectedFile.name : 'Choose a file to upload'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        PDF, Word, Image, Text, or Email files up to 10MB
                      </p>
                    </div>
                  </div>
                </label>
              </div>
              
              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">{selectedFile.name}</span>
                    <Badge variant="secondary">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleImport('file')}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Extract Data'
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
                className="w-full"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4 mr-2" />
                    Extract Data from Text
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>

          {extractedData && (
            <Card className="mt-6">
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

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleConfirmData} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Import This Data
                  </Button>
                  <Button variant="outline" onClick={() => setExtractedData(null)}>
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