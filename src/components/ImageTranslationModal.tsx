import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('Image size must be less than 10MB');
      return;
    }

    setSelectedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // Reset previous results
    setResult(null);
  };

  const processDocument = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }

    setIsProcessing(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke('image-ocr-translate', {
          body: {
            imageData: base64,
            targetLanguage: targetLanguage,
          },
        });

        if (error) {
          console.error('Document translation error:', error);
          toast.error('Failed to process document');
          return;
        }

        setResult(data as TranslationResult);
        console.log('Translation result received:', data);
        console.log('Clinical verification in result:', data.clinicalVerification);
        toast.success('Document processed successfully');
      };

      reader.readAsDataURL(selectedImage);
    } catch (error) {
      console.error('Error processing document:', error);
      toast.error('Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Text copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy text');
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
        toast.error(`Failed to improve text layout: ${error.message}`);
        return;
      }

      if (data?.improvedText) {
        setImprovedText(data.improvedText);
        toast.success('Text layout improved with AI');
      } else {
        toast.error('No improved text received from AI');
      }
    } catch (error) {
      console.error('Error improving text:', error);
      toast.error(`Failed to improve text layout: ${error.message}`);
    } finally {
      setIsImprovingText(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] m-0 p-0 rounded-none flex flex-col">
        <DialogHeader className="flex-shrink-0 p-6 border-b">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Document Image Translation - Full Interface
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
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border rounded-lg p-6 bg-muted/20">
              {/* Left - Upload Controls */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Upload Document Image</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Select Image
                    </Button>
                    
                    {selectedImage && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {selectedImage.name}
                      </Badge>
                    )}
                  </div>

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
            <div className="max-w-4xl mx-auto space-y-4">
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
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Original Text */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Original Text</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {result.detectedLanguage} - {Math.round(result.confidence * 100)}% confidence
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