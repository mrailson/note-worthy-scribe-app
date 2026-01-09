import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Image as ImageIcon, 
  Upload, 
  Languages, 
  Loader2, 
  FileText,
  Copy,
  X,
  Maximize2,
  Expand,
  Sparkles,
  Download,
  Mail,
  Printer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { useDocumentGeneration } from '@/hooks/useDocumentGeneration';
import { MedicalTranslationInfo } from './MedicalTranslationInfo';
import { MedicalTranslationAuditViewer } from './MedicalTranslationAuditViewer';
import { TranslationVerificationDetails } from './TranslationVerificationDetails';
import { ClinicalWarningsDisplay } from './ClinicalWarningsDisplay';

interface ValidationIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  originalValue: string;
  suggestedCorrection?: string;
  normalRange?: string;
  position?: { start: number; end: number };
  source?: string;
}

interface MedicalValue {
  value: number;
  unit: string;
  type: string;
  position: { start: number; end: number };
  raw: string;
}

interface ClinicalVerificationResult {
  hasIssues: boolean;
  issues: ValidationIssue[];
  detectedValues: MedicalValue[];
  overallSafety: 'safe' | 'warning' | 'unsafe';
  confidence: number;
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
  clinicalVerification?: ClinicalVerificationResult;
}

interface ImageTranslationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
];

export const ImageTranslationModal: React.FC<ImageTranslationModalProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const getLanguageName = (code: string) => {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase();
    const base = lower.split('-')[0];
    const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
    return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
  };
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [showFullScreenOriginal, setShowFullScreenOriginal] = useState(false);
  const [showFullScreenText, setShowFullScreenText] = useState(false);
  const [improvedText, setImprovedText] = useState<string | null>(null);
  const [isImprovingText, setIsImprovingText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { exportToPDF, exportToWord } = useDocumentGeneration();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an image or supported document
    const isImage = file.type.startsWith('image/');
    const isDocument = file.name.toLowerCase().endsWith('.pdf') || 
                      file.name.toLowerCase().endsWith('.docx') || 
                      file.name.toLowerCase().endsWith('.txt');

    if (!isImage && !isDocument) {
      showToast.error('Please select an image file (JPG, PNG, etc.) or document file (PDF, DOCX, TXT)', { section: 'translation' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      showToast.error('File size must be less than 10MB', { section: 'translation' });
      return;
    }

    setSelectedImage(file);
    
    // Create preview only for images
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
    
    // Reset previous results
    setResult(null);
  };

  const processDocument = async () => {
    if (!selectedImage) {
      showToast.error('Please select a file first', { section: 'translation' });
      return;
    }

    setIsProcessing(true);
    try {
      const isImage = selectedImage.type.startsWith('image/');
      
      if (isImage) {
        // Process image with OCR
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            
            const { data, error } = await supabase.functions.invoke('image-ocr-translate', {
              body: {
                imageData: base64,
                targetLanguage: targetLanguage,
              },
            });

            if (error) {
              console.error('Document translation error:', error);
              showToast.error('Failed to process document', { section: 'translation' });
              return;
            }

            setResult(data as TranslationResult);
            console.log('Translation result received:', data);
            console.log('Clinical verification in result:', data.clinicalVerification);
            showToast.success('Document processed successfully', { section: 'translation' });
          } catch (error) {
            console.error('Error processing image:', error);
            showToast.error('Failed to process image', { section: 'translation' });
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(selectedImage);
      } else {
        // Process document (PDF, DOCX, TXT)
        const formData = new FormData();
        formData.append('doc', selectedImage);

        const { data, error } = await supabase.functions.invoke('upload-to-text', {
          body: formData,
        });

        if (error) {
          console.error('Document extraction error:', error);
          showToast.error('Failed to extract text from document', { section: 'translation' });
          return;
        }

        if (data?.text) {
          // Now translate the extracted text
          const { data: translationData, error: translationError } = await supabase.functions.invoke('image-ocr-translate', {
            body: {
              extractedText: data.text,
              targetLanguage: targetLanguage,
            },
          });

          if (translationError) {
            console.error('Text translation error:', translationError);
            showToast.error('Failed to translate document text', { section: 'translation' });
            return;
          }

          setResult(translationData as TranslationResult);
          console.log('Translation result received:', translationData);
          showToast.success('Document processed and translated successfully', { section: 'translation' });
        } else {
          showToast.error('No text could be extracted from the document', { section: 'translation' });
        }
      }
    } catch (error) {
      console.error('Error processing document:', error);
      showToast.error('Failed to process document', { section: 'translation' });
    } finally {
      if (!selectedImage?.type.startsWith('image/')) {
        setIsProcessing(false);
      }
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast.success('Text copied to clipboard', { section: 'translation' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast.error('Failed to copy text', { section: 'translation' });
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResult(null);
    setImprovedText(null);
    setTargetLanguage('en');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const improveTextLayout = async () => {
    if (!result?.translatedText) return;

    setIsImprovingText(true);
    try {
      console.log('Calling improve-text-layout function...');
      
      const { data, error } = await supabase.functions.invoke('improve-text-layout', {
        body: {
          text: result.translatedText,
          sourceLanguage: result.detectedLanguage,
          targetLanguage: targetLanguage,
        },
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Text improvement error:', error);
        showToast.error(`Failed to improve text layout: ${error.message}`, { section: 'translation' });
        return;
      }

      if (data?.improvedText) {
        setImprovedText(data.improvedText);
        showToast.success('Text layout improved with AI', { section: 'translation' });
      } else {
        showToast.error('No improved text received from AI', { section: 'translation' });
      }
    } catch (error) {
      console.error('Error improving text:', error);
      showToast.error(`Failed to improve text layout: ${error.message}`, { section: 'translation' });
    } finally {
      setIsImprovingText(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handlePrint = () => {
    const printContent = improvedText || result?.translatedText || '';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Translated Document</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body>
            <h1>Translated Document</h1>
            <pre>${printContent}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleEmailRequest = () => {
    showToast.info('Email functionality coming soon!', { section: 'translation' });
  };

  const DownloadDropdown = ({ text, title = "Translated Document" }: { text: string, title?: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          Download
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportToWord(text, title)}
            className="w-full justify-start flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Download as Word
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportToPDF(text, title)}
            className="w-full justify-start flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Download as PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEmailRequest}
            className="w-full justify-start flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Email to me
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            className="w-full justify-start flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] m-0 p-0 rounded-none flex flex-col">
        <DialogHeader className="flex-shrink-0 p-6 border-b">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Document Translation - Full Interface
            </div>
            <div className="flex items-center gap-2">
              <MedicalTranslationInfo />
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="flex items-center gap-2"
              >
                Reset All
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Section */}
          <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border rounded-lg p-6 bg-muted/20">
              {/* Left - Upload Controls */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Upload Document</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.docx,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Select File
                    </Button>
                    
                    {selectedImage && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {selectedImage.name}
                      </Badge>
                     )}
                   </div>
                   
                   <p className="text-sm text-muted-foreground">
                     Supports: Images (JPG, PNG, etc.), PDF documents, Word documents (DOCX), and text files (TXT)
                   </p>

                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium min-w-fit">Target Language:</label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={processDocument} 
                    disabled={!selectedImage || isProcessing}
                    className="w-full"
                    size="lg"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4 mr-2" />
                    )}
                    Extract & Translate Text
                  </Button>
                </div>
              </div>

              {/* Right - Image Preview */}
              {imagePreview ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Image Preview</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullScreenImage(true)}
                      className="flex items-center gap-1"
                    >
                      <Expand className="w-3 h-3" />
                      Enlarge
                    </Button>
                  </div>
                  <div className="border rounded-lg p-4 bg-background cursor-pointer hover:bg-muted/10 transition-colors"
                       onClick={() => setShowFullScreenImage(true)}>
                    <img
                      src={imagePreview}
                      alt="Selected document"
                      className="max-w-full h-64 object-contain mx-auto"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <div className="text-center space-y-2">
                    <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground">No image selected</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clinical Verification Section */}
          {result?.clinicalVerification && (
            <div className="w-full space-y-4">
              <h3 className="text-lg font-semibold">Clinical Verification</h3>
              <ClinicalWarningsDisplay
                verificationResult={result.clinicalVerification}
                originalText={result.originalText}
                translatedText={result.translatedText}
              />
            </div>
          )}

          {/* Translation Results */}
          {result && (  
            <div className="w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Original Text */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Original Text</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {getLanguageName(result.detectedLanguage)} - {Math.round(result.confidence * 100)}% confidence
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFullScreenOriginal(true)}
                        className="flex items-center gap-1"
                      >
                        <Expand className="w-3 h-3" />
                        Enlarge
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyText(result.originalText)}
                        className="flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="bg-background border rounded-lg p-6 min-h-[300px] max-h-[500px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {result.originalText}
                    </pre>
                  </div>
                </div>

                {/* Translated Text */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Translated Text ({languages.find(l => l.code === targetLanguage)?.name})
                    </h3>
                    <div className="flex items-center gap-2">
                      <TranslationVerificationDetails
                        originalText={result.originalText}
                        translatedText={result.translatedText}
                        sourceLanguage={result.detectedLanguage}
                        targetLanguage={languages.find(l => l.code === targetLanguage)?.name || targetLanguage}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={improveTextLayout}
                        disabled={isImprovingText}
                        className="flex items-center gap-1"
                      >
                        {isImprovingText ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        {isImprovingText ? 'Improving...' : 'AI Format'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFullScreenText(true)}
                        className="flex items-center gap-1"
                      >
                        <Expand className="w-3 h-3" />
                        Enlarge
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyText(improvedText || result.translatedText)}
                        className="flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                      <DownloadDropdown 
                        text={improvedText || result.translatedText}
                        title="Translated Document"
                      />
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 min-h-[300px] max-h-[500px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {improvedText || result.translatedText}
                    </pre>
                    {improvedText && (
                      <div className="mt-4 pt-4 border-t border-primary/20">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Sparkles className="w-4 h-4" />
                          AI-improved formatting applied
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Full Screen Image Modal */}
      <Dialog open={showFullScreenImage} onOpenChange={setShowFullScreenImage}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] m-0 p-0 rounded-none flex flex-col">
          <DialogHeader className="flex-shrink-0 p-6 border-b">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Document Image - Full Screen View
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            <div className="h-full flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Selected document - full view"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Original Text Modal */}
      <Dialog open={showFullScreenOriginal} onOpenChange={setShowFullScreenOriginal}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] m-0 p-0 rounded-none flex flex-col">
          <DialogHeader className="flex-shrink-0 p-6 border-b">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Original Text - Full Screen View ({result?.detectedLanguage || ''})
              </div>
              <div className="flex items-center gap-2">
                {result && (
                  <TranslationVerificationDetails
                    originalText={result.originalText}
                    translatedText={result.translatedText}
                    sourceLanguage={result.detectedLanguage}
                    targetLanguage={languages.find(l => l.code === targetLanguage)?.name || targetLanguage}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => result && handleCopyText(result.originalText)}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy All
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            <div className="max-w-4xl mx-auto">
              <div className="bg-background border rounded-lg p-8 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-foreground">
                  {result?.originalText || ''}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Translated Text Modal */}
      <Dialog open={showFullScreenText} onOpenChange={setShowFullScreenText}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] m-0 p-0 rounded-none flex flex-col">
          <DialogHeader className="flex-shrink-0 p-6 border-b">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Translated Text - Full Screen View ({languages.find(l => l.code === targetLanguage)?.name})
              </div>
              <div className="flex items-center gap-2">
                {result && (
                  <TranslationVerificationDetails
                    originalText={result.originalText}
                    translatedText={result.translatedText}
                    sourceLanguage={result.detectedLanguage}
                    targetLanguage={languages.find(l => l.code === targetLanguage)?.name || targetLanguage}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={improveTextLayout}
                  disabled={isImprovingText}
                  className="flex items-center gap-2"
                  title="Improve text layout with AI"
                >
                  {isImprovingText ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isImprovingText ? 'Improving...' : 'AI Format'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => result && handleCopyText(improvedText || result.translatedText)}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy All
                </Button>
                {result && (
                  <DownloadDropdown 
                    text={improvedText || result.translatedText}
                    title="Translated Document - Full View"
                  />
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 bg-primary/5">
            <div className="max-w-4xl mx-auto">
              <div className="bg-background border rounded-lg p-8 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-foreground">
                  {improvedText || result?.translatedText || ''}
                </pre>
                {improvedText && (
                  <div className="mt-4 pt-4 border-t border-muted">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="w-4 h-4" />
                      AI-improved formatting applied
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};