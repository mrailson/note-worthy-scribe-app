import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { CalendarIcon, Upload, FileText, Loader2, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

interface AppointmentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string, sessionDate: Date, sessionName?: string) => Promise<boolean>;
}

export const AppointmentImportModal = ({ isOpen, onClose, onImport }: AppointmentImportModalProps) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [sessionName, setSessionName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setUploadedFileName(file.name);
    
    try {
      // Read file as base64
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const fileType = file.name.toLowerCase().endsWith('.docx') ? 'word' : 
                       file.name.toLowerCase().endsWith('.doc') ? 'word' :
                       file.name.toLowerCase().endsWith('.xlsx') ? 'excel' :
                       file.name.toLowerCase().endsWith('.xls') ? 'excel' : 'unknown';

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
        showToast.success('Excel file processed');
      } else if (fileType === 'word') {
        // Use edge function for Word files
        const mimeType = file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        const { data, error } = await supabase.functions.invoke('extract-document-text', {
          body: { dataUrl, fileType: 'word' }
        });
        
        if (error) throw error;
        
        if (data?.extractedText) {
          setPastedText(data.extractedText);
          setActiveTab('paste');
          showToast.success('Document processed');
        } else {
          throw new Error('No text extracted');
        }
      } else {
        // Try reading as plain text
        const text = await file.text();
        setPastedText(text);
        setActiveTab('paste');
        showToast.success('File loaded');
      }
    } catch (error) {
      console.error('File processing error:', error);
      showToast.error('Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  }, []);

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
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  const handleImport = async () => {
    if (!pastedText.trim()) {
      showToast.error('Please paste or upload appointment data');
      return;
    }

    setIsProcessing(true);
    try {
      const success = await onImport(pastedText, sessionDate, sessionName || undefined);
      if (success) {
        // Reset and close
        setPastedText('');
        setSessionName('');
        setUploadedFileName(null);
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedText(text);
        showToast.success('Pasted from clipboard');
      }
    } catch (error) {
      showToast.error('Unable to access clipboard');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Appointments</DialogTitle>
          <DialogDescription>
            Import your appointment list from a Word document, Excel file, or paste directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Session Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Appointment Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !sessionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {sessionDate ? format(sessionDate, "dd MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={sessionDate}
                    onSelect={(date) => date && setSessionDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Session Name (optional)</Label>
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., Morning Surgery"
              />
            </div>
          </div>

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
                placeholder="Paste your appointment list here. The system will extract patient names, NHS numbers, DOB, contact details, etc."
                className="min-h-[200px] font-mono text-sm"
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
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    {isDragActive ? (
                      <p className="text-primary">Drop the file here...</p>
                    ) : (
                      <>
                        <p className="font-medium">Drag & drop a file here</p>
                        <p className="text-sm text-muted-foreground">
                          or click to browse (Word, Excel, TXT, CSV)
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
              
              {/* Helpful tip */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p>
                  <strong>Tip:</strong> Download your "Detailed Appointments" as a Word document from your clinical system and import it directly. 
                  This includes patient NHS Numbers, dates of birth, and appointment times which will auto-populate your consultations in Notewell Scribe.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview count */}
          {pastedText && (
            <p className="text-sm text-muted-foreground">
              Text length: {pastedText.length} characters
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isProcessing || !pastedText.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Import Appointments'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
